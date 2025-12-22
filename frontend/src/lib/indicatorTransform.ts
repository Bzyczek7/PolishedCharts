export interface DataPoint {
    time: number | string;
    value: number;
}

export interface Thresholds {
    high: number;
    low: number;
}

/**
 * Splits a single indicator data series into three series based on thresholds:
 * 1. above: points > high threshold
 * 2. neutral: points between low and high (inclusive)
 * 3. below: points < low threshold
 * 
 * Note: To avoid gaps in the line chart, we could include connecting points,
 * but for the first pass, we follow the simple 3-series split.
 */
export const splitSeriesByThresholds = (data: DataPoint[], thresholds: Thresholds) => {
    const above: DataPoint[] = [];
    const neutral: DataPoint[] = [];
    const below: DataPoint[] = [];

    data.forEach(p => {
        if (p.value > thresholds.high) {
            above.push(p);
        } else if (p.value < thresholds.low) {
            below.push(p);
        } else {
            neutral.push(p);
        }
    });

    return { above, neutral, below };
};
