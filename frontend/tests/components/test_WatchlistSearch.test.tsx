/**
 * T018 [US1] Frontend unit test for WatchlistSearch component debounce
 *
 * Tests the 300ms debounce behavior on search input:
 * - API calls are delayed until 300ms after input stops
 * - Rapid typing doesn't trigger multiple calls
 * - Debounce timer resets on each input change
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WatchlistSearch } from '@/components/WatchlistSearch'

// Mock the watchlist API
vi.mock('@/api/watchlist', () => ({
  searchSymbols: vi.fn(),
}))

describe('WatchlistSearch Component - Debounce Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should debounce search input with 300ms delay', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)
    mockSearch.mockResolvedValue([
      { symbol: 'AAPL', display_name: 'Apple Inc.' }
    ])

    const onSelectSymbol = vi.fn()
    render(
      <WatchlistSearch
        open={true}
        onOpenChange={vi.fn()}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Type 'AAPL' - should NOT call search immediately
    await userEvent.type(input, 'AAPL')

    // Should NOT have called search yet (< 300ms)
    expect(mockSearch).not.toHaveBeenCalled()

    // Fast-forward 299ms - still should not have called
    vi.advanceTimersByTime(299)
    expect(mockSearch).not.toHaveBeenCalled()

    // Fast-forward to 300ms - NOW should call search
    vi.advanceTimersByTime(1)
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(1)
    })
  })

  it('should reset debounce timer on each keystroke', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)
    mockSearch.mockResolvedValue([])

    const onSelectSymbol = vi.fn()
    render(
      <WatchlistSearch
        open={true}
        onOpenChange={vi.fn()}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Type first character
    await userEvent.type(input, 'A')
    vi.advanceTimersByTime(200) // Wait 200ms

    // Type second character - should reset timer
    await userEvent.type(input, 'A')
    vi.advanceTimersByTime(200) // Wait another 200ms

    // Should NOT have called search yet (timer reset twice)
    expect(mockSearch).not.toHaveBeenCalled()

    // Wait the remaining 100ms
    vi.advanceTimersByTime(100)

    // NOW should call search
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(1)
    })
    expect(mockSearch).toHaveBeenCalledWith('AA')
  })

  it('should only call API once after rapid typing', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)
    mockSearch.mockResolvedValue([])

    const onSelectSymbol = vi.fn()
    render(
      <WatchlistSearch
        open={true}
        onOpenChange={vi.fn()}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Rapidly type multiple characters
    await userEvent.type(input, 'AAPL', { delay: 10 })

    // Advance time past debounce period
    vi.advanceTimersByTime(300)

    // Should have called API exactly once
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(1)
    })
    expect(mockSearch).toHaveBeenCalledWith('AAPL')
  })

  it('should handle empty query without calling API', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)
    mockSearch.mockResolvedValue([])

    const onSelectSymbol = vi.fn()
    render(
      <WatchlistSearch
        open={true}
        onOpenChange={vi.fn()}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Type and then delete all characters
    await userEvent.type(input, 'AAPL')
    await userEvent.clear(input)

    vi.advanceTimersByTime(300)

    // Should NOT call API with empty query
    expect(mockSearch).not.toHaveBeenCalled()
  })

  it('should validate query length (1-5 characters)', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)
    mockSearch.mockResolvedValue([])

    const onSelectSymbol = vi.fn()
    render(
      <WatchlistSearch
        open={true}
        onOpenChange={vi.fn()}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Type more than 5 characters
    await userEvent.type(input, 'ABCDEF')
    vi.advanceTimersByTime(300)

    // Should NOT call API (client-side validation)
    expect(mockSearch).not.toHaveBeenCalled()

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText(/must be 5 characters or less/i)).toBeInTheDocument()
    })
  })

  it('should reset state when dialog closes', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)
    mockSearch.mockResolvedValue([])

    const onOpenChange = vi.fn()
    const onSelectSymbol = vi.fn()

    const { rerender } = render(
      <WatchlistSearch
        open={true}
        onOpenChange={onOpenChange}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Type a search
    await userEvent.type(input, 'AAPL')
    vi.advanceTimersByTime(300)
    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledTimes(1)
    })

    // Close dialog
    rerender(
      <WatchlistSearch
        open={false}
        onOpenChange={onOpenChange}
        onSelectSymbol={onSelectSymbol}
      />
    )

    // Reopen dialog
    rerender(
      <WatchlistSearch
        open={true}
        onOpenChange={onOpenChange}
        onSelectSymbol={onSelectSymbol}
      />
    )

    // Input should be cleared
    const newInput = screen.getByPlaceholderText(/search symbols/i)
    expect(newInput).toHaveValue('')
  })

  it('should show loading state during search', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)

    // Create a promise that we can resolve later
    let resolveSearch: (value: any) => void
    const searchPromise = new Promise(resolve => {
      resolveSearch = resolve
    })
    mockSearch.mockReturnValue(searchPromise)

    const onSelectSymbol = vi.fn()
    render(
      <WatchlistSearch
        open={true}
        onOpenChange={vi.fn()}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Trigger search
    await userEvent.type(input, 'AAPL')
    vi.advanceTimersByTime(300)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText(/searching/i)).toBeInTheDocument()
    })

    // Resolve search
    resolveSearch!([
      { symbol: 'AAPL', display_name: 'Apple Inc.' }
    ])

    // Should hide loading and show results
    await waitFor(() => {
      expect(screen.queryByText(/searching/i)).not.toBeInTheDocument()
    })
  })

  it('should handle search errors gracefully', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)
    mockSearch.mockRejectedValue(new Error('Network error'))

    const onSelectSymbol = vi.fn()
    render(
      <WatchlistSearch
        open={true}
        onOpenChange={vi.fn()}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Trigger search
    await userEvent.type(input, 'AAPL')
    vi.advanceTimersByTime(300)

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument()
    })
  })
})

describe('WatchlistSearch Component - Selection Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should call onSelectSymbol and close dialog on selection', async () => {
    const { searchSymbols } = await import('@/api/watchlist')
    const mockSearch = vi.mocked(searchSymbols)
    mockSearch.mockResolvedValue([
      { symbol: 'AAPL', display_name: 'Apple Inc.' }
    ])

    const onOpenChange = vi.fn()
    const onSelectSymbol = vi.fn()

    render(
      <WatchlistSearch
        open={true}
        onOpenChange={onOpenChange}
        onSelectSymbol={onSelectSymbol}
      />
    )

    const input = screen.getByPlaceholderText(/search symbols/i)

    // Trigger search
    await userEvent.type(input, 'AAPL')
    vi.advanceTimersByTime(300)

    // Wait for results and click one
    await waitFor(() => {
      expect(screen.getByText('AAPL')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('AAPL'))

    // Should call onSelectSymbol and close dialog
    expect(onSelectSymbol).toHaveBeenCalledWith('AAPL')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
