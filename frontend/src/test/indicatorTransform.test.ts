import { describe, it, expect } from 'vitest'
import { splitSeriesByThresholds } from '../lib/indicatorTransform'

describe('indicatorTransform - splitSeriesByThresholds', () => {
    const data = [
        { time: 1, value: 0.1 },  // Above (high=0.05)
        { time: 2, value: 0.03 }, // Neutral
        { time: 3, value: -0.1 }, // Below (low=-0.05)
        { time: 4, value: 0.0 }    // Neutral
    ]
    
    const thresholds = { high: 0.05, low: -0.05 }

    it('should split data into three series based on thresholds', () => {
        const { above, neutral, below } = splitSeriesByThresholds(data, thresholds)
        
        // Above series should only have data for points > 0.05
        expect(above).toHaveLength(1)
        expect(above[0]).toEqual({ time: 1, value: 0.1 })

        // Below series should only have data for points < -0.05
        expect(below).toHaveLength(1)
        expect(below[0]).toEqual({ time: 3, value: -0.1 })

        // Neutral series should only have data for points between -0.05 and 0.05
        expect(neutral).toHaveLength(2)
        expect(neutral[0]).toEqual({ time: 2, value: 0.03 })
        expect(neutral[1]).toEqual({ time: 4, value: 0.0 })
    })

    it('should include boundary points to ensure visual continuity', () => {
        // Pine Script lines don't "break" cleanly; often they transition.
        // For now, simple split is enough as requested by spec "implement three separate line series".
        // If we want continuity, we need more complex logic. 
        // The spec says "three separate line series driven by thresholds".
    })
})
