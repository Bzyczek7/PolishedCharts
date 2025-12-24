/**
 * DrawingStateContext - Drawing tools, active drawing, drawings array
 * Feature: 002-supercharts-visuals
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Drawing, DrawingState, ToolType, DrawingType } from '../components/types/drawings';
import { loadDrawings, saveDrawings } from '../utils/localStorage';

interface DrawingStateContextValue {
  state: DrawingState;
  setSelectedTool: (tool: ToolType) => void;
  startDrawing: (type: DrawingType) => void;
  updateActiveDrawing: (data: Partial<Drawing>) => void;
  completeDrawing: (drawing: Drawing) => void;
  cancelDrawing: () => void;
  addDrawing: (drawing: Drawing) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  removeDrawing: (id: string) => void;
  setHoveredDrawing: (drawing: Drawing | undefined) => void;
  setSelectedDrawing: (drawing: Drawing | undefined) => void;
  loadDrawingsForSymbol: (symbol: string) => void;
  clearDrawings: () => void;
}

const DrawingStateContext = createContext<DrawingStateContextValue | undefined>(undefined);

export interface DrawingStateProviderProps {
  children: ReactNode;
  currentSymbol?: string;
}

export function DrawingStateProvider({
  children,
  currentSymbol = 'AAPL',
}: DrawingStateProviderProps) {
  const [state, setState] = useState<DrawingState>(() => ({
    selectedTool: 'cursor',
    activeDrawing: {
      type: 'trendline',
      step: 0,
    },
    drawings: [],
  }));

  const setSelectedTool = useCallback((tool: ToolType) => {
    setState(prev => ({
      ...prev,
      selectedTool: tool,
      // Cancel any active drawing when changing tools
      activeDrawing: { type: 'trendline', step: 0 },
    }));
  }, []);

  const startDrawing = useCallback((type: DrawingType) => {
    setState(prev => ({
      ...prev,
      activeDrawing: {
        type,
        step: 1, // First click
      },
    }));
  }, []);

  const updateActiveDrawing = useCallback((data: Partial<Drawing>) => {
    setState(prev => ({
      ...prev,
      activeDrawing: {
        ...prev.activeDrawing,
        tempData: {
          ...prev.activeDrawing.tempData,
          ...data,
        },
      },
    }));
  }, []);

  const completeDrawing = useCallback((drawing: Drawing) => {
    setState(prev => {
      const newDrawings = [...prev.drawings, drawing];
      // Persist to localStorage
      saveDrawings(currentSymbol, newDrawings);
      return {
        ...prev,
        drawings: newDrawings,
        activeDrawing: {
          type: 'trendline',
          step: 0,
          tempData: undefined,
        },
      };
    });
  }, [currentSymbol]);

  const cancelDrawing = useCallback(() => {
    setState(prev => ({
      ...prev,
      activeDrawing: {
        type: 'trendline',
        step: 0,
        tempData: undefined,
      },
    }));
  }, []);

  const addDrawing = useCallback((drawing: Drawing) => {
    setState(prev => {
      const newDrawings = [...prev.drawings, drawing];
      saveDrawings(currentSymbol, newDrawings);
      return {
        ...prev,
        drawings: newDrawings,
      };
    });
  }, [currentSymbol]);

  const updateDrawing = useCallback((id: string, updates: Partial<Drawing>) => {
    setState(prev => {
      const newDrawings = prev.drawings.map(d =>
        d.id === id ? { ...d, ...updates } : d
      );
      saveDrawings(currentSymbol, newDrawings);
      return {
        ...prev,
        drawings: newDrawings,
      };
    });
  }, [currentSymbol]);

  const removeDrawing = useCallback((id: string) => {
    setState(prev => {
      const newDrawings = prev.drawings.filter(d => d.id !== id);
      saveDrawings(currentSymbol, newDrawings);
      return {
        ...prev,
        drawings: newDrawings,
        selectedDrawing: prev.selectedDrawing?.id === id ? undefined : prev.selectedDrawing,
      };
    });
  }, [currentSymbol]);

  const setHoveredDrawing = useCallback((drawing: Drawing | undefined) => {
    setState(prev => ({ ...prev, hoveredDrawing: drawing }));
  }, []);

  const setSelectedDrawing = useCallback((drawing: Drawing | undefined) => {
    setState(prev => ({ ...prev, selectedDrawing: drawing }));
  }, []);

  const loadDrawingsForSymbol = useCallback((symbol: string) => {
    const drawings = loadDrawings<Drawing>(symbol);
    setState(prev => ({
      ...prev,
      drawings,
    }));
  }, []);

  const clearDrawings = useCallback(() => {
    setState(prev => {
      saveDrawings(currentSymbol, []);
      return {
        ...prev,
        drawings: [],
      };
    });
  }, [currentSymbol]);

  const value: DrawingStateContextValue = {
    state,
    setSelectedTool,
    startDrawing,
    updateActiveDrawing,
    completeDrawing,
    cancelDrawing,
    addDrawing,
    updateDrawing,
    removeDrawing,
    setHoveredDrawing,
    setSelectedDrawing,
    loadDrawingsForSymbol,
    clearDrawings,
  };

  return (
    <DrawingStateContext.Provider value={value}>
      {children}
    </DrawingStateContext.Provider>
  );
}

export function useDrawingStateContext(): DrawingStateContextValue {
  const context = useContext(DrawingStateContext);
  if (!context) {
    throw new Error('useDrawingStateContext must be used within DrawingStateProvider');
  }
  return context;
}
