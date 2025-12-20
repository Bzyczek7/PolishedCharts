import type { Layout } from '../components/LayoutManager'

const STORAGE_KEY = 'trading_alert_layouts'

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
