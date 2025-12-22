import { render } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App'

const observers: { target: Element | null }[] = [];
const ResizeObserverMock = vi.fn().mockImplementation(() => ({
    observe: vi.fn().mockImplementation((target) => {
        observers.push({ target });
    }),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

(window as any).ResizeObserver = ResizeObserverMock;

describe('Unified Viewport Resizing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    observers.length = 0
  })

  it('centralizes resizing in App.tsx by observing the main viewport container', async () => {
    render(<App />)

    const unifiedObserver = observers.find((o: any) => 
        o.target && o.target.getAttribute('data-testid') === 'main-viewport'
    );
    
    expect(unifiedObserver).toBeDefined();
  })
})
