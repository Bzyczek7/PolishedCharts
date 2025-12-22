export const formatDataForChart = (timestamps: string[] | undefined, values: (number | null)[] | undefined) => {
    if (!timestamps || !values || timestamps.length === 0) return []
    
    const formatted = values.map((v, i) => {
        if (v === null || v === undefined) return null;
        const ts = timestamps[i];
        if (!ts) return null;
        const time = Math.floor(new Date(ts).getTime() / 1000);
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
