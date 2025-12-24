/**
 * IndicatorPaneContext - Pane management, add/remove/position
 * Feature: 002-supercharts-visuals
 */

import React, { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { IndicatorPane, IndicatorType } from '../components/types/indicators';

interface IndicatorPaneContextValue {
  panes: IndicatorPane[];
  focusedPaneId: string | null;
  addPane: (indicatorType: IndicatorType, position?: number) => void;
  removePane: (paneId: string) => void;
  setPaneHeight: (paneId: string, height: number) => void;
  setPanePosition: (paneId: string, position: number) => void;
  setPaneVisibility: (paneId: string, visible: boolean) => void;
  setFocusedPane: (paneId: string | null) => void;
  reorderPanes: (newOrder: string[]) => void;
  getPaneById: (paneId: string) => IndicatorPane | undefined;
  clearAllPanes: () => void;
}

const IndicatorPaneContext = createContext<IndicatorPaneContextValue | undefined>(undefined);

export interface IndicatorPaneProviderProps {
  children: ReactNode;
}

/**
 * Generate a unique ID for indicator panes
 */
function generatePaneId(): string {
  return `indicator-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Create default display name for an indicator
 */
function getIndicatorDisplayName(indicator: IndicatorType): string {
  const params = Object.entries(indicator.params)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');
  return params ? `${indicator.name} (${params})` : indicator.name;
}

export function IndicatorPaneProvider({ children }: IndicatorPaneProviderProps) {
  const [panes, setPanes] = useState<IndicatorPane[]>([]);
  const [focusedPaneId, setFocusedPaneId] = useState<string | null>(null);

  const addPane = useCallback((indicatorType: IndicatorType, position?: number) => {
    const newPane: IndicatorPane = {
      id: generatePaneId(),
      indicatorType,
      name: getIndicatorDisplayName(indicatorType),
      displaySettings: {
        visible: true,
        height: 25, // Default 25% of chart height
        position: position ?? panes.length + 1,
      },
      scaleRange: indicatorType.category === 'oscillator'
        ? { min: 0, max: 100, auto: false }
        : undefined,
      focusState: 'active',
    };

    setPanes(prev => {
      // If position specified, insert at that position and shift others
      if (position !== undefined) {
        const adjusted = prev.map(p => ({
          ...p,
          displaySettings: {
            ...p.displaySettings,
            position: p.displaySettings.position >= position
              ? p.displaySettings.position + 1
              : p.displaySettings.position,
          },
        }));
        return [...adjusted, newPane].sort((a, b) =>
          a.displaySettings.position - b.displaySettings.position
        );
      }
      return [...prev, newPane];
    });

    // Auto-focus the new pane
    setFocusedPaneId(newPane.id);
  }, [panes.length]);

  const removePane = useCallback((paneId: string) => {
    setPanes(prev => {
      const removedPosition = prev.find(p => p.id === paneId)?.displaySettings.position;
      const filtered = prev.filter(p => p.id !== paneId);

      // If we removed a pane, shift positions of panes below it up
      if (removedPosition !== undefined) {
        return filtered
          .map(p => ({
            ...p,
            displaySettings: {
              ...p.displaySettings,
              position: p.displaySettings.position > removedPosition
                ? p.displaySettings.position - 1
                : p.displaySettings.position,
            },
          }))
          .sort((a, b) => a.displaySettings.position - b.displaySettings.position);
      }

      return filtered;
    });

    // Clear focus if removed pane was focused
    setFocusedPaneId(prev => prev === paneId ? null : prev);
  }, []);

  const setPaneHeight = useCallback((paneId: string, height: number) => {
    setPanes(prev =>
      prev.map(p =>
        p.id === paneId
          ? { ...p, displaySettings: { ...p.displaySettings, height } }
          : p
      )
    );
  }, []);

  const setPanePosition = useCallback((paneId: string, position: number) => {
    setPanes(prev => {
      const pane = prev.find(p => p.id === paneId);
      if (!pane) return prev;

      const oldPosition = pane.displaySettings.position;
      if (oldPosition === position) return prev;

      return prev
        .map(p => {
          if (p.id === paneId) {
            return { ...p, displaySettings: { ...p.displaySettings, position } };
          }
          // Shift other panes accordingly
          if (oldPosition < position) {
            // Moving down: shift panes in (oldPosition, position] up by 1
            if (p.displaySettings.position > oldPosition && p.displaySettings.position <= position) {
              return { ...p, displaySettings: { ...p.displaySettings, position: p.displaySettings.position - 1 } };
            }
          } else {
            // Moving up: shift panes in [position, oldPosition) down by 1
            if (p.displaySettings.position >= position && p.displaySettings.position < oldPosition) {
              return { ...p, displaySettings: { ...p.displaySettings, position: p.displaySettings.position + 1 } };
            }
          }
          return p;
        })
        .sort((a, b) => a.displaySettings.position - b.displaySettings.position);
    });
  }, []);

  const setPaneVisibility = useCallback((paneId: string, visible: boolean) => {
    setPanes(prev =>
      prev.map(p =>
        p.id === paneId
          ? { ...p, displaySettings: { ...p.displaySettings, visible } }
          : p
      )
    );
  }, []);

  const setFocusedPane = useCallback((paneId: string | null) => {
    setFocusedPaneId(paneId);
    setPanes(prev =>
      prev.map(p => ({
        ...p,
        focusState: p.id === paneId ? 'focused' : (paneId === null ? 'active' : 'inactive'),
      }))
    );
  }, []);

  const reorderPanes = useCallback((newOrder: string[]) => {
    setPanes(prev =>
      newOrder
        .map((id, index) => {
          const pane = prev.find(p => p.id === id);
          return pane
            ? { ...pane, displaySettings: { ...pane.displaySettings, position: index + 1 } }
            : null;
        })
        .filter((p): p is IndicatorPane => p !== null)
    );
  }, []);

  const getPaneById = useCallback((paneId: string): IndicatorPane | undefined => {
    return panes.find(p => p.id === paneId);
  }, [panes]);

  const clearAllPanes = useCallback(() => {
    setPanes([]);
    setFocusedPaneId(null);
  }, []);

  const value: IndicatorPaneContextValue = {
    panes,
    focusedPaneId,
    addPane,
    removePane,
    setPaneHeight,
    setPanePosition,
    setPaneVisibility,
    setFocusedPane,
    reorderPanes,
    getPaneById,
    clearAllPanes,
  };

  return (
    <IndicatorPaneContext.Provider value={value}>
      {children}
    </IndicatorPaneContext.Provider>
  );
}

export function useIndicatorPaneContext(): IndicatorPaneContextValue {
  const context = useContext(IndicatorPaneContext);
  if (!context) {
    throw new Error('useIndicatorPaneContext must be used within IndicatorPaneProvider');
  }
  return context;
}
