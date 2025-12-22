import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import App from '../App'
import { createChart } from 'lightweight-charts'

// Improve ResizeObserver mock for this test
let observers: any[] = [];
class ResizeObserverMock {
  callback: any;
  target: any;
  constructor(callback: any) {
    this.callback = callback;
    observers.push(this);
  }
  observe(target: any) {
    this.target = target;
  }
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as any;

describe('Unified Resizing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    observers = [];
  })

  it('centralizes resizing in App.tsx by observing the main viewport container', async () => {
    render(<App />)

    // Check if any observer is observing a container with data-testid="main-viewport"
    // (We'll need to add this testid to App.tsx)
    const unifiedObserver = observers.find(o => 
        o.target && o.target.getAttribute('data-testid') === 'main-viewport'
    );
    
    expect(unifiedObserver).toBeDefined();
  })
})
