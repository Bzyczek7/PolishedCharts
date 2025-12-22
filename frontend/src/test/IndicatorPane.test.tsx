import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import IndicatorPane from '../components/IndicatorPane'
import React from 'react'

// Mock lightweight-charts
vi.mock('lightweight-charts', () => ({
    createChart: vi.fn(() => ({
        addSeries: vi.fn(() => ({
            setData: vi.fn(),
            applyOptions: vi.fn(),
            createPriceLine: vi.fn(() => ({})),
            removePriceLine: vi.fn(),
            seriesType: vi.fn(() => 'Line')
        })),
        removeSeries: vi.fn(),
        priceScale: vi.fn(() => ({
            applyOptions: vi.fn()
        })),
        timeScale: vi.fn(() => ({
            subscribeVisibleLogicalRangeChange: vi.fn(),
            unsubscribeVisibleLogicalRangeChange: vi.fn()
        })),
        applyOptions: vi.fn(),
        remove: vi.fn()
    })),
    ColorType: { Solid: 'solid' },
    LineSeries: 'Line',
    HistogramSeries: 'Histogram',
    LineStyle: { Dashed: 2 }
}))

describe('IndicatorPane', () => {
    const mainSeries = {
        data: [{ time: 1, value: 10 }],
        color: 'blue',
        displayType: 'line' as const
    }

    it('renders without crashing', () => {
        const { getByTestId } = render(
            <IndicatorPane name="Test" mainSeries={mainSeries} />
        )
        expect(getByTestId('indicator-pane-Test')).toBeTruthy()
    })
})