import type { Layout } from '../components/Toolbar'
import type { Alert } from '../components/AlertsList'

const STORAGE_KEY = 'trading_alert_layouts'
const WATCHLIST_KEY = 'trading_alert_watchlist'
const ALERTS_KEY = 'trading_alert_alerts'

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

export const saveAlerts = (alerts: Alert[]): void => {
    localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts))
}

export const loadAlerts = (): Alert[] => {
    const stored = localStorage.getItem(ALERTS_KEY)
    if (!stored) return [
        { id: '1', symbol: 'IBM', condition: 'price_above', threshold: 150.00, status: 'active', createdAt: new Date().toISOString() }
    ]
    try {
        return JSON.parse(stored)
    } catch (e) {
        console.error('Failed to parse alerts from localStorage', e)
        return [
            { id: '1', symbol: 'IBM', condition: 'price_above', threshold: 150.00, status: 'active', createdAt: new Date().toISOString() }
        ]
    }
}
