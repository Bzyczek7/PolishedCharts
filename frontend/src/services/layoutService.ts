import type { Layout } from '../components/LayoutManager'

const STORAGE_KEY = 'trading_alert_layouts'
const WATCHLIST_KEY = 'trading_alert_watchlist'

export const saveLayouts = (layouts: Layout[]): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layouts))
}

export const loadLayouts = (): Layout[] => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    try {
        return JSON.parse(stored)
    } catch (e) {
        console.error('Failed to parse layouts from localStorage', e)
        return []
    }
}

export const saveWatchlist = (symbols: string[]): void => {
    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(symbols))
}

export const loadWatchlist = (): string[] => {
    const stored = localStorage.getItem(WATCHLIST_KEY)
    if (!stored) return ['IBM', 'AAPL']
    try {
        return JSON.parse(stored)
    } catch (e) {
        console.error('Failed to parse watchlist from localStorage', e)
        return ['IBM', 'AAPL']
    }
}
