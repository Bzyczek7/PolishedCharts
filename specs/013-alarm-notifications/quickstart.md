# Implementation Quickstart: Alarm Notification System

**Feature**: 013-alarm-notifications
**Created**: 2025-12-31
**Prerequisites**: Alert system (001-indicator-alerts)

## Overview

Quick reference guide for implementing the notification system with three channels: toast, sound, and Telegram.

## Technology Stack

| Component | Technology | Justification |
|-----------|------------|---------------|
| Toast UI | react-hot-toast | Lightweight, customizable, TypeScript support |
| Sound | HTML5 Audio API | Native browser support, no dependencies |
| Telegram | Python requests + Telegram Bot API | No new library, direct HTTP |
| Preferences | localStorage (guest) / PostgreSQL (auth) | Consistent with existing auth pattern |

## File Structure

```
backend/
├── app/
│   ├── services/
│   │   └── telegram.py           # 50 lines - HTTP Telegram sender
│   └── models/
│       └── notification.py       # 30 lines - Pydantic schemas
frontend/
├── src/
│   ├── components/
│   │   ├── ToastNotification.tsx
│   │   ├── NotificationSettings.tsx
│   │   └── NotificationHistory.tsx
│   ├── hooks/
│   │   └── useNotifications.ts  # Main orchestration hook
│   ├── lib/
│   │   ├── soundManager.ts
│   │   └── toastManager.ts
│   └── assets/
│       └── sounds/
│           ├── bell.mp3
│           ├── alert.mp3
│           └── chime.mp3
```

## Implementation Order

### Phase 1: Foundation
1. Add sound files to `frontend/src/assets/sounds/`
2. Create `soundManager.ts` for audio playback
3. Create `toastManager.ts` for toast orchestration

### Phase 2: UI Components
1. Create `NotificationSettings.tsx` - Preferences form
2. Create `ToastNotification.tsx` - Toast display component
3. Create `NotificationHistory.tsx` - History panel (P3)

### Phase 3: Backend
1. Create `telegram.py` service
2. Create `notification.py` models
3. Add Telegram API endpoint if needed

### Phase 4: Integration
1. Create `useNotifications.ts` hook
2. Integrate with existing alert system
3. Add notification preferences to AlertForm

## Key Integration Points

### Alert Trigger Flow

```
AlertEngine.trigger()
    → check notification preferences
    → useNotifications.trigger(alert)
        → showToast(alert)
        → playSound(alert)
        → sendTelegram(alert)
    → logNotification(alert, type, status)
```

### Toast Configuration

```typescript
const toastConfig = {
  duration: 5000,
  style: {
    background: '#1a1a2e',
    color: '#eee',
    borderLeft: '4px solid #e94560',
  },
  icon: '🔔',
}
```

### Sound Manager API

```typescript
interface SoundManager {
  play(soundType: 'bell' | 'alert' | ' chime'): Promise<void>
  setVolume(volume: number): void
  preload(): void
}
```

### Telegram Service API

```python
class TelegramService:
    def __init__(self, token: str, chat_id: str):
        self.api_url = f"https://api.telegram.org/bot{token}/sendMessage"

    def send_alert(self, alert: Alert) -> bool:
        """Send alert notification to configured chat"""
        payload = {
            "chat_id": self.chat_id,
            "text": self.format_message(alert),
            "parse_mode": "Markdown"
        }
        return requests.post(self.api_url, json=payload).ok
```

## Testing Strategy

| Test Type | Coverage | Tool |
|-----------|----------|------|
| Unit | Sound manager logic, toast config | Vitest |
| Integration | Alert → notification flow | Vitest + MSW |
| E2E | Full notification flow | Playwright |

## Common Issues

### Browser Autoplay Policy
- Sounds may not play without user interaction
- Solution: Request permission on first user interaction

### Telegram Validation
- Test credentials with `getMe` endpoint before saving
- Handle 403 errors (bot blocked by user)

### Toast Queue Overflow
- Limit concurrent toasts to 5
- Older toasts dismissed automatically

## Success Metrics

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Toast latency | < 2s | Performance.now() diff |
| Sound latency | < 1s | Performance.now() diff |
| Telegram latency | < 5s | Request duration |
| Error rate | < 1% | Failed notifications / total |
