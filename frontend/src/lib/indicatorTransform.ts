export interface DataPoint {
    time: number | string;
    value: number;
}

export interface Thresholds {
    high: number;
    low: number;
}

/**
 * Finalizes a series by filtering invalid values and sorting by time.
 * Deduplication is removed to preserve shared endpoints for segmented coloring.
 */
const finalize = (arr: DataPoint[]) => {
  if (arr.length === 0) return [];

  return [...arr]
    .filter(p => p.value !== undefined && p.value !== null && !isNaN(p.value))
    .sort((a, b) => Number(a.time) - Number(b.time));
};

/**
 * Splits a data series based on thresholds into sparse segments.
 */
export const splitSeriesByThresholds = (data: DataPoint[], thresholds: Thresholds) => {
    if (data.length === 0) return { above: [], neutral: [], below: [] };

    const above: DataPoint[] = [];
    const neutral: DataPoint[] = [];
    const below: DataPoint[] = [];

    const getRegime = (val: number) => {
        if (val > thresholds.high) return 'above';
        if (val < thresholds.low) return 'below';
        return 'neutral';
    };

    let currentRegime = getRegime(data[0].value);
    let currentSegment: DataPoint[] = [data[0]];

    for (let i = 1; i < data.length; i++) {
        const curr = data[i];
        const newRegime = getRegime(curr.value);

        if (newRegime === currentRegime) {
            currentSegment.push(curr);
        } else {
            // Regime changed - finalize current segment by including transition point
            currentSegment.push(curr);
            const target = currentRegime === 'above' ? above : currentRegime === 'below' ? below : neutral;
            target.push(...currentSegment);
            
            // Start new segment
            currentSegment = [curr];
            currentRegime = newRegime;
        }
    }

    if (currentSegment.length > 0) {
        const target = currentRegime === 'above' ? above : currentRegime === 'below' ? below : neutral;
        target.push(...currentSegment);
    }

    return { 
        above: finalize(above), 
        neutral: finalize(neutral), 
        below: finalize(below) 
    };
};

/**
 * Splits a series based on trend (up/down/flat) into sparse segments.
 */
export const splitSeriesByTrend = (data: DataPoint[]) => {
    if (data.length === 0) return { up: [], down: [], neutral: [] };

    const up: DataPoint[] = [];
    const down: DataPoint[] = [];
    const neutral: DataPoint[] = [];

    let currentTrend: 'up' | 'down' | 'neutral' = 'neutral';
    let currentSegment: DataPoint[] = [data[0]];

    for (let i = 1; i < data.length; i++) {
        const prev = data[i - 1];
        const curr = data[i];
        
        let newTrend: 'up' | 'down' | 'neutral';
        if (curr.value > prev.value) newTrend = 'up';
        else if (curr.value < prev.value) newTrend = 'down';
        else newTrend = 'neutral';

        if (i === 1) currentTrend = newTrend;

        if (newTrend === currentTrend) {
            currentSegment.push(curr);
        } else {
            // Trend changed - finalize current segment by including transition point
            currentSegment.push(curr);
            const target = currentTrend === 'up' ? up : currentTrend === 'down' ? down : neutral;
            target.push(...currentSegment);
            
            // Start new segment
            currentSegment = [curr];
            currentTrend = newTrend;
        }
    }

    if (currentSegment.length > 0) {
        const target = currentTrend === 'up' ? up : currentTrend === 'down' ? down : neutral;
        target.push(...currentSegment);
    }

    return {
        up: finalize(up),
        down: finalize(down),
        neutral: finalize(neutral)
    };
};
