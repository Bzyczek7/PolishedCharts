/**
 * TDD Test for useThemeSettings hook
 * Feature: 002-supercharts-visuals
 *
 * This test is written BEFORE implementation.
 * It should FAIL until the hook is properly implemented.
 */

import { renderHook, act } from '@testing-library/react';
import { DEFAULT_THEME_SETTINGS } from '../../src/components/types/theme';
import { useThemeSettingsContext } from '../../src/contexts/ThemeSettingsContext';
import { ThemeSettingsProvider } from '../../src/contexts/ThemeSettingsContext';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};

beforeEach(() => {
  // Clear all mocks before each test
  mockLocalStorage.getItem.mockClear();
  mockLocalStorage.setItem.mockClear();
  mockLocalStorage.removeItem.mockClear();
  mockLocalStorage.clear.mockClear();

  // Mock localStorage to return null by default (use defaults)
  mockLocalStorage.getItem.mockReturnValue(null);

  global.localStorage = mockLocalStorage as any;
});

// Wrapper to provide context
function createWrapper() {
  return function ThemeSettingsWrapper({ children }: { children: React.ReactNode }) {
    return <ThemeSettingsProvider>{children}</ThemeSettingsProvider>;
  };
}

describe('useThemeSettings (TDD - FAILING TEST)', () => {
  describe('Default values', () => {
    it('should initialize with default theme settings', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.settings).toEqual(DEFAULT_THEME_SETTINGS);
    });

    it('should load from localStorage if available', () => {
      const savedSettings = {
        backgroundBrightness: 50,
        grid: { visible: false, opacity: 50 },
        candleColors: { up: '#00ff00', down: '#ff0000' },
        scaleSettings: {
          showLastPriceLine: false,
          showLastPriceLabel: false,
          showTimeLabels: true,
          showPriceLabels: true,
        },
      };

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(savedSettings));

      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.settings.backgroundBrightness).toBe(50);
      expect(result.current.settings.grid.visible).toBe(false);
    });
  });

  describe('Background brightness', () => {
    it('should set background brightness', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setBackgroundBrightness(75);
      });

      expect(result.current.settings.backgroundBrightness).toBe(75);
    });

    it('should clamp brightness to minimum 0', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setBackgroundBrightness(-10);
      });

      expect(result.current.settings.backgroundBrightness).toBe(0);
    });

    it('should clamp brightness to maximum 100', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setBackgroundBrightness(150);
      });

      expect(result.current.settings.backgroundBrightness).toBe(100);
    });
  });

  describe('Grid settings', () => {
    it('should set grid visibility', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.settings.grid.visible).toBe(true);

      act(() => {
        result.current.setGridVisible(false);
      });

      expect(result.current.settings.grid.visible).toBe(false);
    });

    it('should set grid opacity', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setGridOpacity(60);
      });

      expect(result.current.settings.grid.opacity).toBe(60);
    });

    it('should clamp opacity to minimum 0', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setGridOpacity(-5);
      });

      expect(result.current.settings.grid.opacity).toBe(0);
    });

    it('should clamp opacity to maximum 100', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setGridOpacity(200);
      });

      expect(result.current.settings.grid.opacity).toBe(100);
    });
  });

  describe('Candle colors', () => {
    it('should set up candle color', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setCandleColor('up', '#00ff00');
      });

      expect(result.current.settings.candleColors.up).toBe('#00ff00');
    });

    it('should set down candle color', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setCandleColor('down', '#ff0000');
      });

      expect(result.current.settings.candleColors.down).toBe('#ff0000');
    });
  });

  describe('Scale settings', () => {
    it('should set showLastPriceLine', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setScaleSetting('showLastPriceLine', false);
      });

      expect(result.current.settings.scaleSettings.showLastPriceLine).toBe(false);
    });

    it('should set showLastPriceLabel', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setScaleSetting('showLastPriceLabel', false);
      });

      expect(result.current.settings.scaleSettings.showLastPriceLabel).toBe(false);
    });

    it('should set showTimeLabels', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setScaleSetting('showTimeLabels', false);
      });

      expect(result.current.settings.scaleSettings.showTimeLabels).toBe(false);
    });

    it('should set showPriceLabels', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setScaleSetting('showPriceLabels', false);
      });

      expect(result.current.settings.scaleSettings.showPriceLabels).toBe(false);
    });
  });

  describe('Reset to defaults', () => {
    it('should reset all settings to defaults', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      // Modify settings
      act(() => {
        result.current.setBackgroundBrightness(75);
        result.current.setGridVisible(false);
        result.current.setCandleColor('up', '#00ff00');
        result.current.setScaleSetting('showLastPriceLine', false);
      });

      expect(result.current.settings.backgroundBrightness).toBe(75);
      expect(result.current.settings.grid.visible).toBe(false);

      // Reset
      act(() => {
        result.current.resetToDefaults();
      });

      expect(result.current.settings).toEqual(DEFAULT_THEME_SETTINGS);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist settings to localStorage on change', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      jest.clearAllMocks();

      act(() => {
        result.current.setBackgroundBrightness(50);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chart-theme-settings',
        expect.stringContaining('"backgroundBrightness":50')
      );
    });

    it('should persist grid settings to localStorage', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      jest.clearAllMocks();

      act(() => {
        result.current.setGridVisible(false);
        result.current.setGridOpacity(80);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chart-theme-settings',
        expect.stringContaining('"visible":false')
      );
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chart-theme-settings',
        expect.stringContaining('"opacity":80')
      );
    });

    it('should persist candle colors to localStorage', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      jest.clearAllMocks();

      act(() => {
        result.current.setCandleColor('up', '#00ff00');
        result.current.setCandleColor('down', '#ff0000');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chart-theme-settings',
        expect.stringContaining('"up":"#00ff00"')
      );
    });

    it('should persist scale settings to localStorage', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      jest.clearAllMocks();

      act(() => {
        result.current.setScaleSetting('showLastPriceLine', false);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chart-theme-settings',
        expect.stringContaining('"showLastPriceLine":false')
      );
    });

    it('should persist reset to defaults', () => {
      const { result } = renderHook(() => useThemeSettingsContext(), {
        wrapper: createWrapper(),
      });

      // Modify settings first
      act(() => {
        result.current.setBackgroundBrightness(75);
      });

      jest.clearAllMocks();

      act(() => {
        result.current.resetToDefaults();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chart-theme-settings',
        JSON.stringify(DEFAULT_THEME_SETTINGS)
      );
    });
  });
});
