export const formatDataForChart = (timestamps: string[] | undefined, values: (number | null)[] | undefined) => {
    if (!timestamps || !values || timestamps.length === 0) return []
    
    const formatted = values.map((v, i) => {
        if (v === null || v === undefined) return null;
        const ts = timestamps[i];
        if (!ts) return null;
        // The timestamps from API are Unix timestamps (seconds), but Date constructor expects milliseconds
        const time = Number(ts);  // Unix timestamp in seconds
        if (isNaN(time)) return null;
        return {
            time: time as any,
            value: v
        };
    }).filter((item): item is { time: any; value: number } => item !== null);
    
    const sorted = formatted.sort((a, b) => a.time - b.time)
    return sorted.filter((item, index, arr) => 
        index === 0 || item.time !== arr[index - 1].time
    )
}
