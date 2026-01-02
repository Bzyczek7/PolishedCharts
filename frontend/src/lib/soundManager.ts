/**
 * Sound Manager

Manages audio notification playback with the following UX MVP behaviors:
- Play at most 1 sound per alert trigger (deduplicate concurrent alerts)
- Default volume: 70% of system volume
- If autoplay blocked, queue sound for next user interaction
- Supports multiple sound types: bell, alert, chime

Usage:
    import { soundManager } from '@/lib/soundManager';

    // Play a sound
    soundManager.play('bell');

    // Set volume (0-1)
    soundManager.setVolume(0.7);

    // Mute/unmute
    soundManager.setMuted(false);
*/

import bellSound from "@/assets/sounds/bell.mp3";
import alertSound from "@/assets/sounds/alert.mp3";
import chimeSound from "@/assets/sounds/chime.mp3";

const DEFAULT_VOLUME = 0.7;
const MAX_CONCURRENT_SOUNDS = 1;
const QUEUED_SOUND_KEY = "queued_sound";

type SoundType = "bell" | "alert" | "chime";

interface SoundConfig {
  src: string;
  label: string;
}

const SOUNDS: Record<SoundType, SoundConfig> = {
  bell: { src: bellSound, label: "Bell" },
  alert: { src: alertSound, label: "Alert" },
  chime: { src: chimeSound, label: "Chime" },
};

class SoundManager {
  private audio: HTMLAudioElement | null = null;
  private volume: number = DEFAULT_VOLUME;
  private muted: boolean = false;
  private activeSounds: number = 0;
  private queuedSound: SoundType | null = null;
  private lastPlayedTime: number = 0;
  private minInterval: number = 500; // Minimum ms between sounds to avoid spam

  constructor() {
    // Create a single audio element for playback
    if (typeof window !== "undefined") {
      this.audio = new Audio();
      this.audio.volume = this.volume;
    }

    // Restore queued sound from localStorage
    this.restoreQueuedSound();
  }

  /**
   * Play a notification sound
   */
  async play(soundType: SoundType = "bell"): Promise<boolean> {
    if (!this.audio || this.muted) {
      return false;
    }

    // Check for concurrent sounds
    if (this.activeSounds >= MAX_CONCURRENT_SOUNDS) {
      // Queue the sound for later
      this.queueSound(soundType);
      return false;
    }

    // Check minimum interval to prevent sound spam
    const now = Date.now();
    if (now - this.lastPlayedTime < this.minInterval) {
      // Queue instead of playing immediately
      this.queueSound(soundType);
      return false;
    }

    return this.playNow(soundType);
  }

  /**
   * Play sound immediately (internal)
   */
  private async playNow(soundType: SoundType): Promise<boolean> {
    if (!this.audio) return false;

    const sound = SOUNDS[soundType];
    if (!sound) {
      console.warn("[SoundManager] Unknown sound type:", soundType);
      return false;
    }

    try {
      this.activeSounds++;
      this.lastPlayedTime = Date.now();

      // Set up the audio source
      this.audio.src = sound.src;
      this.audio.load();

      // Play with error handling
      const playPromise = this.audio.play();

      // Handle autoplay policy
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Sound playing successfully
          })
          .catch((error) => {
            // Autoplay blocked - queue for later
            console.debug("[SoundManager] Autoplay blocked:", error.name);
            this.queueSound(soundType);
          })
          .finally(() => {
            this.activeSounds = Math.max(0, this.activeSounds - 1);
            this.processQueuedSound();
          });
      }

      return true;
    } catch (error) {
      console.error("[SoundManager] Failed to play sound:", error);
      this.activeSounds = Math.max(0, this.activeSounds - 1);
      return false;
    }
  }

  /**
   * Queue a sound for playback when user interacts
   */
  private queueSound(soundType: SoundType): void {
    this.queuedSound = soundType;
    this.saveQueuedSound();

    // Listen for user interaction to play queued sound
    this.setupInteractionListener();
  }

  /**
   * Set up one-time listener for user interaction
   */
  private setupInteractionListener(): void {
    const handleInteraction = () => {
      this.processQueuedSound();
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };

    // Listen for first user interaction
    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("keydown", handleInteraction, { once: true });
  }

  /**
   * Process any queued sound
   */
  private processQueuedSound(): void {
    if (this.queuedSound && !this.muted) {
      const soundToPlay = this.queuedSound;
      this.queuedSound = null;
      this.clearQueuedSound();

      // Play after a short delay to ensure audio context is ready
      setTimeout(() => {
        this.playNow(soundToPlay);
      }, 100);
    }
  }

  /**
   * Save queued sound to localStorage
   */
  private saveQueuedSound(): void {
    if (typeof window !== "undefined" && this.queuedSound) {
      try {
        localStorage.setItem(QUEUED_SOUND_KEY, this.queuedSound);
      } catch (e) {
        // localStorage might be full or unavailable
      }
    }
  }

  /**
   * Restore queued sound from localStorage
   */
  private restoreQueuedSound(): void {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(QUEUED_SOUND_KEY);
        if (saved && SOUNDS[saved as SoundType]) {
          this.queuedSound = saved as SoundType;
          this.setupInteractionListener();
        }
      } catch (e) {
        // Ignore localStorage errors
      }
    }
  }

  /**
   * Clear any queued sound
   */
  private clearQueuedSound(): void {
    this.queuedSound = null;
    if (typeof window !== "undefined") {
      localStorage.removeItem(QUEUED_SOUND_KEY);
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Mute/unmute sounds
   */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.muted && this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  /**
   * Check if sounds are muted
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Get available sound types
   */
  getAvailableSounds(): SoundType[] {
    return Object.keys(SOUNDS) as SoundType[];
  }

  /**
   * Get sound info
   */
  getSoundInfo(soundType: SoundType): SoundConfig | null {
    return SOUNDS[soundType] || null;
  }

  /**
   * Check if a sound is currently playing
   */
  isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused;
  }

  /**
   * Stop current sound
   */
  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }
}

// Singleton instance
export const soundManager = new SoundManager();
