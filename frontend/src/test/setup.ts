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

// Use React.createElement to avoid JSX in .ts file

vi.mock('@radix-ui/react-portal', () => ({

  Root: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),

}));



vi.mock('@radix-ui/react-dropdown-menu', async () => {



  const React = await import('react');



  return {



    Root: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    Trigger: React.forwardRef(({ children, asChild, ...props }: any, ref) => React.createElement('button', { ...props, ref }, children)),



    Content: React.forwardRef(({ children }: { children: React.ReactNode }, ref) => React.createElement('div', { ref }, children)),



    Item: React.forwardRef(({ children, ...props }: any, ref) => React.createElement('div', { ...props, ref }, children)),



    Portal: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    Group: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    Label: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    Separator: () => React.createElement('div'),



    Shortcut: ({ children }: { children: React.ReactNode }) => React.createElement('span', null, children),



    CheckboxItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    RadioItem: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    RadioGroup: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    Sub: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    SubTrigger: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



    SubContent: ({ children }: { children: React.ReactNode }) => React.createElement('div', null, children),



  };



});




