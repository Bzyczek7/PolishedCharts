/**
 * TDD Test for useDrawings hook
 * Feature: 002-supercharts-visuals
 *
 * This test is written BEFORE implementation.
 * It should FAIL until the hook is properly implemented.
 */

import { renderHook, act } from '@testing-library/react';
import { Drawing, DrawingType } from '../../src/components/types/drawings';
import { useDrawingStateContext } from '../../src/contexts/DrawingStateContext';
import { DrawingStateProvider } from '../../src/contexts/DrawingStateContext';

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

  // Mock localStorage
  global.localStorage = mockLocalStorage as any;
});

// Helper to create a test drawing
function createTestDrawing(overrides?: Partial<Drawing>): Drawing {
  return {
    id: 'drawing-1',
    type: 'trendline',
    time1: Date.now() - 86400000,
    price1: 150.0,
    time2: Date.now(),
    price2: 155.0,
    color: '#ffff00',
    lineWidth: 2,
    paneId: 'main',
    ...overrides,
  };
}

// Wrapper to provide context
function createWrapper(symbol: string = 'AAPL') {
  return function DrawingStateWrapper({ children }: { children: React.ReactNode }) {
    return <DrawingStateProvider currentSymbol={symbol}>{children}</DrawingStateProvider>;
  };
}

describe('useDrawings (TDD - FAILING TEST)', () => {
  describe('CRUD operations', () => {
    it('should initialize with empty drawings array', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      expect(result.current.state.drawings).toEqual([]);
      expect(result.current.state.selectedTool).toBe('cursor');
    });

    it('should add a new drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.addDrawing(drawing);
      });

      expect(result.current.state.drawings).toHaveLength(1);
      expect(result.current.state.drawings[0]).toEqual(drawing);
    });

    it('should update an existing drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.addDrawing(drawing);
      });

      act(() => {
        result.current.updateDrawing('drawing-1', { color: '#ff0000', lineWidth: 3 });
      });

      expect(result.current.state.drawings[0].color).toBe('#ff0000');
      expect(result.current.state.drawings[0].lineWidth).toBe(3);
    });

    it('should remove a drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing1 = createTestDrawing({ id: 'drawing-1' });
      const drawing2 = createTestDrawing({ id: 'drawing-2' });

      act(() => {
        result.current.addDrawing(drawing1);
        result.current.addDrawing(drawing2);
      });

      expect(result.current.state.drawings).toHaveLength(2);

      act(() => {
        result.current.removeDrawing('drawing-1');
      });

      expect(result.current.state.drawings).toHaveLength(1);
      expect(result.current.state.drawings[0].id).toBe('drawing-2');
    });

    it('should clear all drawings', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing1 = createTestDrawing({ id: 'drawing-1' });
      const drawing2 = createTestDrawing({ id: 'drawing-2' });

      act(() => {
        result.current.addDrawing(drawing1);
        result.current.addDrawing(drawing2);
      });

      act(() => {
        result.current.clearDrawings();
      });

      expect(result.current.state.drawings).toEqual([]);
    });
  });

  describe('Drawing tool selection', () => {
    it('should set selected tool', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.setSelectedTool('trendline');
      });

      expect(result.current.state.selectedTool).toBe('trendline');
    });

    it('should cancel active drawing when changing tools', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      // Start a drawing
      act(() => {
        result.current.startDrawing('rectangle');
      });

      expect(result.current.state.activeDrawing.step).toBe(1);

      // Change tool
      act(() => {
        result.current.setSelectedTool('horizontal_line');
      });

      expect(result.current.state.activeDrawing.step).toBe(0);
      expect(result.current.state.selectedTool).toBe('horizontal_line');
    });
  });

  describe('Active drawing operations', () => {
    it('should start a new drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.startDrawing('trendline');
      });

      expect(result.current.state.activeDrawing.type).toBe('trendline');
      expect(result.current.state.activeDrawing.step).toBe(1);
    });

    it('should update active drawing temp data', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.startDrawing('trendline');
      });

      act(() => {
        result.current.updateActiveDrawing({
          time1: Date.now(),
          price1: 150.0,
        });
      });

      expect(result.current.state.activeDrawing.tempData?.time1).toBeDefined();
      expect(result.current.state.activeDrawing.tempData?.price1).toBe(150.0);
    });

    it('should complete and save a drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.completeDrawing(drawing);
      });

      expect(result.current.state.drawings).toHaveLength(1);
      expect(result.current.state.activeDrawing.step).toBe(0);
    });

    it('should cancel an active drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      act(() => {
        result.current.startDrawing('rectangle');
      });

      act(() => {
        result.current.cancelDrawing();
      });

      expect(result.current.state.activeDrawing.step).toBe(0);
      expect(result.current.state.activeDrawing.tempData).toBeUndefined();
    });
  });

  describe('Hover and selection state', () => {
    it('should set hovered drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.setHoveredDrawing(drawing);
      });

      expect(result.current.state.hoveredDrawing).toEqual(drawing);
    });

    it('should clear hovered drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.setHoveredDrawing(drawing);
      });

      act(() => {
        result.current.setHoveredDrawing(undefined);
      });

      expect(result.current.state.hoveredDrawing).toBeUndefined();
    });

    it('should set selected drawing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.setSelectedDrawing(drawing);
      });

      expect(result.current.state.selectedDrawing).toEqual(drawing);
    });

    it('should clear selected drawing when removed', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper(),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.addDrawing(drawing);
        result.current.setSelectedDrawing(drawing);
      });

      expect(result.current.state.selectedDrawing).toEqual(drawing);

      act(() => {
        result.current.removeDrawing(drawing.id);
      });

      expect(result.current.state.selectedDrawing).toBeUndefined();
    });
  });

  describe('localStorage persistence', () => {
    it('should save drawings to localStorage when adding', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper('AAPL'),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.addDrawing(drawing);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'drawings-AAPL',
        expect.stringContaining('"drawing-1"')
      );
    });

    it('should save drawings to localStorage when updating', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper('AAPL'),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.addDrawing(drawing);
      });

      jest.clearAllMocks();

      act(() => {
        result.current.updateDrawing('drawing-1', { color: '#ff0000' });
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'drawings-AAPL',
        expect.stringContaining('"#ff0000"')
      );
    });

    it('should save to localStorage when removing', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper('AAPL'),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.addDrawing(drawing);
      });

      jest.clearAllMocks();

      act(() => {
        result.current.removeDrawing('drawing-1');
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'drawings-AAPL',
        '[]'
      );
    });

    it('should clear drawings from localStorage', () => {
      const { result } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper('AAPL'),
      });

      const drawing = createTestDrawing();

      act(() => {
        result.current.addDrawing(drawing);
      });

      jest.clearAllMocks();

      act(() => {
        result.current.clearDrawings();
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'drawings-AAPL',
        '[]'
      );
    });
  });

  describe('Per-symbol isolation', () => {
    it('should use symbol-specific storage keys', () => {
      const { result: resultAAPL } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper('AAPL'),
      });

      const { result: resultTSLA } = renderHook(() => useDrawingStateContext(), {
        wrapper: createWrapper('TSLA'),
      });

      const aaplDrawing = createTestDrawing({ id: 'aapl-drawing', paneId: 'main' });
      const tslaDrawing = createTestDrawing({ id: 'tsla-drawing', paneId: 'main' });

      mockLocalStorage.setItem.mockClear();

      act(() => {
        resultAAPL.current.addDrawing(aaplDrawing);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'drawings-AAPL',
        expect.any(String)
      );

      mockLocalStorage.setItem.mockClear();

      act(() => {
        resultTSLA.current.addDrawing(tslaDrawing);
      });

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'drawings-TSLA',
        expect.any(String)
      );
    });
  });
});
