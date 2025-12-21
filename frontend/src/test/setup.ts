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

global.ResizeObserver = ResizeObserverMock;

window.Element.prototype.scrollIntoView = vi.fn();

// dnd-kit needs PointerEvent
if (!global.PointerEvent) {
    class PointerEvent extends MouseEvent {
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
      }
    }
    // @ts-ignore
    global.PointerEvent = PointerEvent;
}

// Mock Radix UI Portal
vi.mock('@radix-ui/react-portal', () => ({
  Root: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),
}));

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