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
 * To ensure visual continuity without overlapping segments (which causes "dual lines"),
 * each segment [Ti, Ti+1] is assigned to exactly one series based on the regime 
 * of the second point (Ti+1).
 */
export const splitSeriesByThresholds = (data: DataPoint[], thresholds: Thresholds) => {
    const above: DataPoint[] = [];
    const neutral: DataPoint[] = [];
    const below: DataPoint[] = [];

    const getRegime = (val: number) => {
        if (val > thresholds.high) return 'above';
        if (val < thresholds.low) return 'below';
        return 'neutral';
    };

    data.forEach((p, i) => {
        const regime = getRegime(p.value);

        if (i === 0) {
            // First point: just add to its regime
            if (regime === 'above') above.push(p);
            else if (regime === 'below') below.push(p);
            else neutral.push(p);
            return;
        }

        const prev = data[i - 1];
        const prevRegime = getRegime(prev.value);

        // Assign the current segment [prev, p] to a series
        // We use the current regime to determine the segment color
        if (regime === 'above') {
            // Segment is Above. Ensure both points are in 'above' series.
            if (prevRegime !== 'above') above.push(prev);
            above.push(p);
        } else if (regime === 'below') {
            // Segment is Below.
            if (prevRegime !== 'below') below.push(prev);
            below.push(p);
        } else {
            // Segment is Neutral.
            if (prevRegime !== 'neutral') neutral.push(prev);
            neutral.push(p);
        }
    });

    const finalize = (arr: DataPoint[]) => {
        if (arr.length === 0) return [];
        // Sort and deduplicate by time
        const sorted = [...arr].sort((a, b) => Number(a.time) - Number(b.time));
        return sorted.filter((item, index, self) => 
            index === 0 || item.time !== self[index - 1].time
        );
    };

    return {
        above: finalize(above),
        neutral: finalize(neutral),
        below: finalize(below)
    };
};
