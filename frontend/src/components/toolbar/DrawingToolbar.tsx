/**
 * DrawingToolbar - Left vertical toolbar with drawing tools
 * Feature: 002-supercharts-visuals
 */

import React from 'react';
import { MousePointer2, Minus, RectangleHorizontal } from 'lucide-react';
import type { ToolType } from '../types/drawings';

export interface DrawingToolbarProps {
  selectedTool: ToolType;
  onToolSelect: (tool: ToolType) => void;
  className?: string;
}

const drawingTools: { type: ToolType; icon: React.ReactNode; label: string }[] = [
  { type: 'cursor', icon: <MousePointer2 className="h-4 w-4" />, label: 'Cursor' },
  { type: 'trendline', icon: <Minus className="h-4 w-4 transform rotate-[-45deg]" />, label: 'Trendline' },
  { type: 'horizontal_line', icon: <Minus className="h-4 w-4" />, label: 'Horizontal Line' },
  { type: 'rectangle', icon: <RectangleHorizontal className="h-4 w-4" />, label: 'Rectangle' },
];

/**
 * DrawingToolbar component
 * Vertical toolbar on the left side with drawing tool buttons
 *
 * @example
 * ```tsx
 * <DrawingToolbar
 *   selectedTool="cursor"
 *   onToolSelect={(tool) => setSelectedTool(tool)}
 * />
 * ```
 */
export function DrawingToolbar({ selectedTool, onToolSelect, className = '' }: DrawingToolbarProps) {
  return (
    <div
      className={`flex flex-col items-center gap-1 bg-[#1e222d] border-r border-[#2a2e39] p-1 ${className}`}
      data-testid="drawing-toolbar"
    >
      {drawingTools.map((tool) => (
        <button
          key={tool.type}
          onClick={() => onToolSelect(tool.type)}
          className={`w-9 h-9 flex items-center justify-center rounded transition-colors ${
            selectedTool === tool.type
              ? 'bg-[#26a69a] text-white'
              : 'text-slate-400 hover:text-white hover:bg-[#2a2e39]'
          }`}
          aria-label={tool.label}
          title={tool.label}
          data-testid={`drawing-tool-${tool.type}`}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}

export default DrawingToolbar;
