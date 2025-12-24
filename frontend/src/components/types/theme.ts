/**
 * Theme settings TypeScript types
 * Feature: 002-supercharts-visuals
 */

/**
 * User-customizable appearance settings
 */
export interface ThemeSettings {
  backgroundBrightness: number; // 0-100 (0 = #131722 default, 100 = #0a0e14 darker)
  grid: {
    visible: boolean;
    opacity: number;           // 0-100
  };
  candleColors: {
    up: string;                // Hex, e.g., "#26a69a"
    down: string;              // Hex, e.g., "#ef5350"
  };
  scaleSettings: {
    showLastPriceLine: boolean;
    showLastPriceLabel: boolean;
    showTimeLabels: boolean;
    showPriceLabels: boolean;
  };
}

/**
 * Theme settings interface (for type checking)
 */
export interface IThemeSettings {
  backgroundBrightness: number;
  grid: {
    visible: boolean;
    opacity: number;
  };
  candleColors: {
    up: string;
    down: string;
  };
  scaleSettings: {
    showLastPriceLine: boolean;
    showLastPriceLabel: boolean;
    showTimeLabels: boolean;
    showPriceLabels: boolean;
  };
}

/**
 * Default theme settings
 */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  backgroundBrightness: 0,
  grid: {
    visible: true,
    opacity: 25,
  },
  candleColors: {
    up: '#26a69a',
    down: '#ef5350',
  },
  scaleSettings: {
    showLastPriceLine: true,
    showLastPriceLabel: true,
    showTimeLabels: true,
    showPriceLabels: true,
  },
};
