/**
 * DrawingContextMenu - Right-click context menu for drawings
 * Feature: 002-supercharts-visuals
 */

import React from 'react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Trash2, Palette, Minus } from 'lucide-react';
import type { Drawing } from '../types/drawings';

export interface DrawingContextMenuProps {
  drawing: Drawing;
  onDelete: (id: string) => void;
  onChangeColor: (id: string, color: string) => void;
  onChangeThickness: (id: string, thickness: number) => void;
  children: React.ReactNode;
}

const DRAWING_COLORS = [
  { name: 'Yellow', value: '#ffff00' },
  { name: 'Red', value: '#ef5350' },
  { name: 'Green', value: '#26a69a' },
  { name: 'Blue', value: '#2962ff' },
  { name: 'White', value: '#ffffff' },
];

const LINE_THICKNESS = [1, 2, 3, 4];

/**
 * DrawingContextMenu component
 * Right-click menu for drawings with Delete, Change Color, Change Thickness options
 */
export function DrawingContextMenu({
  drawing,
  onDelete,
  onChangeColor,
  onChangeThickness,
  children,
}: DrawingContextMenuProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="bg-[#1e222d] border-[#2a2e39] text-slate-200 min-w-40">
        <ContextMenuItem
          onClick={() => onDelete(drawing.id)}
          className="text-slate-400 hover:text-red-400 hover:bg-[#2a2e39] focus:bg-[#2a2e39]"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete
        </ContextMenuItem>

        <div className="px-2 py-1.5 text-xs text-slate-500 font-semibold">Color</div>
        {DRAWING_COLORS.map((color) => (
          <ContextMenuItem
            key={color.value}
            onClick={() => onChangeColor(drawing.id, color.value)}
            className="hover:bg-[#2a2e39] focus:bg-[#2a2e39]"
          >
            <div
              className="w-4 h-4 mr-2 rounded border border-slate-600"
              style={{ backgroundColor: color.value }}
            />
            {color.name}
          </ContextMenuItem>
        ))}

        <div className="px-2 py-1.5 text-xs text-slate-500 font-semibold">Thickness</div>
        {LINE_THICKNESS.map((thickness) => (
          <ContextMenuItem
            key={thickness}
            onClick={() => onChangeThickness(drawing.id, thickness)}
            className="hover:bg-[#2a2e39] focus:bg-[#2a2e39]"
          >
            <Minus className="h-4 w-4 mr-2" style={{ height: thickness + 'px' }} />
            {thickness}px
          </ContextMenuItem>
        ))}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default DrawingContextMenu;
