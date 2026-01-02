import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

(window as any).ResizeObserver = ResizeObserverMock;

window.Element.prototype.scrollIntoView = vi.fn();

// dnd-kit needs PointerEvent
if (!(window as any).PointerEvent) {
    class PointerEvent extends MouseEvent {
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
      }
    }
    // @ts-ignore
    (window as any).PointerEvent = PointerEvent;
}

// Mock lightweight-charts
vi.mock('lightweight-charts', () => {
  const mockSeries = {
    setData: vi.fn(),
    createPriceLine: vi.fn(),
    applyOptions: vi.fn(),
    priceScale: vi.fn().mockReturnValue({
      applyOptions: vi.fn(),
    }),
  };

  // Create mock constructors for Series types
  const LineSeries = vi.fn().mockReturnValue(mockSeries);
  const CandlestickSeries = vi.fn().mockReturnValue(mockSeries);
  const HistogramSeries = vi.fn().mockReturnValue(mockSeries);

  return {
    createChart: vi.fn().mockReturnValue({
      addSeries: vi.fn().mockReturnValue(mockSeries),
      applyOptions: vi.fn(),
      remove: vi.fn(),
      timeScale: vi.fn().mockReturnValue({
        fitContent: vi.fn(),
        getVisibleRange: vi.fn(),
        setVisibleRange: vi.fn(),
        scrollToPosition: vi.fn(),
      }),
      priceScale: vi.fn().mockReturnValue({
        applyOptions: vi.fn(),
      }),
    }),
    ColorType: { Solid: 'solid' },
    LineSeries,
    CandlestickSeries,
    HistogramSeries,
    LineStyle: {
      Solid: 0,
      Dashed: 1,
      Dotted: 2,
      LargeDashed: 3,
      SparseDotted: 4,
    },
    CrosshairMode: {
      Normal: 0,
      Magnet: 1,
    },
  };
});

// Mock Radix UI Tooltip
vi.mock('@radix-ui/react-tooltip', async () => {
  const React = await import('react');
  return {
    Provider: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Root: ({ children }: any) => React.createElement('div', null, children),
    Trigger: React.forwardRef(({ children, ...props }: any, ref) => React.createElement('div', { ...props, ref }, children)),
    Content: React.forwardRef(({ children }: { children: React.ReactNode }, ref) => React.createElement('div', { ref }, children)),
    Portal: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Arrow: () => React.createElement('div'),
  };
});

// Mock Radix UI ContextMenu
vi.mock('@radix-ui/react-context-menu', async () => {
  const React = await import('react');
  return {
    Root: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Trigger: React.forwardRef(({ children, ...props }: any, ref) => React.createElement('div', { ...props, ref }, children)),
    Content: React.forwardRef(({ children }: { children: React.ReactNode }, ref) => React.createElement('div', { ref }, children)),
    Portal: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Item: React.forwardRef(({ children, ...props }: any, ref) => React.createElement('div', { ...props, ref, onClick: props.onClick }, children)),
    Separator: () => React.createElement('div'),
    Label: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    CheckboxItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    RadioItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    RadioGroup: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Sub: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    SubTrigger: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    SubContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
    Group: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
  };
});