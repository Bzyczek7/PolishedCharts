  const overlayIndicators = useMemo(() => {
    return indicators.filter(ind => ind.indicatorType.category === 'overlay')
  }, [indicators])

  const paneIndicators = useMemo(() => {
    return indicators.filter(ind => ind.indicatorType.category === 'oscillator')
  }, [indicators])

  // Feature 005: Ratio-based pane height allocation (TradingView-like behavior)
  // Compute visible oscillator panes using same visibility check as rendering
  const visibleOscillators = useMemo(() => {
    return paneIndicators.filter(ind => {
      const data = indicatorDataMap[ind.id]
      return data && ind.displaySettings.visible && indicatorSettings[ind.id]?.visible !== false
    })
  }, [paneIndicators, indicatorDataMap, indicatorSettings])

  // Ratio-based allocation: mainWeight=3, each pane gets paneWeight=1
  // This guarantees: N=0 → main=100%, N increases → all panes shrink smoothly
  const MAIN_WEIGHT = 3
  const PANE_WEIGHT = 1
  const MIN_PANE_HEIGHT = 100  // Minimum height for oscillator panels to ensure visibility

  const availableHeight = Math.max(dimensions.height - 40, 300)  // Subtract padding
  const maxPossiblePanes = Math.floor(availableHeight / MIN_PANE_HEIGHT)
  const effectiveVisibleOscillators = visibleOscillators.slice(0, maxPossiblePanes)

  const totalWeight = MAIN_WEIGHT + (effectiveVisibleOscillators.length * PANE_WEIGHT)

  const mainHeight = effectiveVisibleOscillators.length === 0
    ? availableHeight
    : availableHeight * (MAIN_WEIGHT / totalWeight)

  const eachPaneHeight = effectiveVisibleOscillators.length > 0
    ? Math.max(availableHeight * (PANE_WEIGHT / totalWeight), MIN_PANE_HEIGHT)
    : 0

  // Format overlay indicators for ChartComponent
  const overlays = useMemo(() => {
    const formattedOverlays: Array<{ id: string; data: { time: number; value: number; color?: string }[]; color: string; lineWidth: number; showLastValue?: boolean }> = [];

    overlayIndicators
      .filter(ind => indicatorSettings[ind.id]?.visible !== false)
      .forEach(ind => {
        const data = indicatorDataMap[ind.id]
        if (!data) return;

        // Keep timestamps as numbers - they're already Unix seconds from the backend
        const timestamps = data.timestamps

        // Loop through ALL series in series_metadata (for multi-series indicators like BBANDS)
        data.metadata.series_metadata.forEach((seriesMeta: any) => {
          const seriesData = data.data[seriesMeta.field]
          if (!seriesData) return;

          // Check if indicator has a signal series for coloring (e.g., ADXVMA_Signal)
          const signalSeries = data.metadata.series_metadata.find((s: any) => s.role === 'signal')
          const signalData = signalSeries ? data.data[signalSeries.field] : null

          if (signalData && seriesMeta.role !== 'signal') {
            // One series, per-point color (TradingView-like)
            const coloredData = timestamps
              .map((t, i) => {
                const value = seriesData[i]
                const signal = signalData[i]

                if (value === null || value === undefined) return null

                const time = t // keep numeric, no toUnixSeconds conversion needed since timestamps are already numeric
                const color =
                  signal === 1 ? '#00FF00' :
                  signal === 0 ? '#FFFF00' :
                  signal === -1 ? '#ef5350' :
                  seriesMeta.line_color

                return { time, value: value as number, color }
              })
              .filter((p): p is { time: number; value: number; color: string } => p !== null)

            const typeKey = ind.indicatorType.name.toLowerCase()
            const showLastValue =
              indicatorSettings[ind.id]?.showLastValue ??
              indicatorSettings[typeKey]?.showLastValue ??
              true
            formattedOverlays.push({
              id: `${ind.id}-${seriesMeta.field}`, // Unique ID for multi-series indicators
              data: coloredData,
              color: seriesMeta.line_color,     // series default; per-point overrides it
              lineWidth: seriesMeta.line_width,
              showLastValue,
            })
          } else if (seriesMeta.role !== 'signal') {
            // Non-signal series path (for BBANDS upper/middle/lower, etc.)
            const formattedData = formatDataForChart(timestamps, seriesData)
            const typeKey = ind.indicatorType.name.toLowerCase()
            const showLastValue =
              indicatorSettings[ind.id]?.showLastValue ??
              indicatorSettings[typeKey]?.showLastValue ??
              true
            formattedOverlays.push({
              id: `${ind.id}-${seriesMeta.field}`, // Unique ID for multi-series indicators
              data: formattedData,
              color: seriesMeta.line_color,
              lineWidth: seriesMeta.line_width,
              showLastValue,
            })
          }
        })
      })

    return formattedOverlays
  }, [overlayIndicators, indicatorDataMap, indicatorSettings])

  // Feature 008 - T015: Format overlay instances with per-instance styling
  const feature008Overlays = useMemo(() => {
    const formattedOverlays: Array<{
      id: string;
      data: { time: number; value: number; color?: string }[];
      color: string;
      lineWidth: number;
      showLastValue?: boolean;
      visible?: boolean; // T013: Support visibility option
    }> = [];

    overlayInstances
      .filter(instance => instance.isVisible) // T013: Respect isVisible from instance
      .forEach(instance => {
        const data = overlayInstanceDataMap[instance.id];
        if (!data) return;

        // For multi-series indicators like BBANDS, loop through all series
        if (data.metadata?.series_metadata && data.metadata.series_metadata.length > 1) {
          data.metadata.series_metadata.forEach((seriesMeta: any) => {
            const fieldData = data.data[seriesMeta.field];
            if (!fieldData) return;

            const timestamps = data.timestamps;
            const formattedData = timestamps.map((ts: any, i: number) => {
              const value = fieldData[i];
              if (value === null || value === undefined) return null;
              return { time: ts, value: value as number };
            }).filter((item: any): item is { time: number; value: number } => item !== null);

            formattedOverlays.push({
              id: `${instance.id}-${seriesMeta.field}`,
              data: formattedData,
              color: seriesMeta.line_color,
              lineWidth: seriesMeta.line_width,
              showLastValue: false, // Hide last value for additional series
              visible: instance.isVisible,
            });
          });
        } else {
          // Single series indicator
          const formattedData = formatIndicatorData(data, undefined, instance.style.seriesColors);

          formattedOverlays.push({
            id: instance.id,
            data: formattedData,
            color: instance.style.color,
            lineWidth: instance.style.lineWidth,
            showLastValue: instance.style.showLastValue,
            visible: instance.isVisible, // T013: Pass visibility to ChartComponent
          });
        }
      });

    return formattedOverlays;
  }, [overlayInstances, overlayInstanceDataMap]);

  // Feature 008 - T015: Merge existing overlays with Feature 008 overlays
  // Priority: Feature 008 overlays (with per-instance styling) take precedence over existing overlays
  const mergedOverlays = useMemo(() => {
    const existingOverlayIds = new Set(overlays.map(o => o.id));
    const merged = [...overlays];

    // Add or replace with Feature 008 overlays
    feature008Overlays.forEach(feature008Overlay => {
      const existingIndex = merged.findIndex(o => o.id === feature008Overlay.id);
      if (existingIndex >= 0) {
        // Replace with Feature 008 overlay (has styling priority)
        merged[existingIndex] = feature008Overlay;
      } else {
        // Add new Feature 008 overlay
        merged.push(feature008Overlay);
      }
    });

    return merged;
  }, [overlays, feature008Overlays]);

  // Phase 0: Create series data map for overlay legend crosshair values
  // Maps instance ID to formatted data points {time, value}
  const overlaySeriesDataMap = useMemo(() => {
    const map: Record<string, { time: number; value: number }[]> = {};
    feature008Overlays.forEach(overlay => {
      map[overlay.id] = overlay.data;
    });
    return map;
  }, [feature008Overlays]);

  // Main crosshair move handler
  const handleMainCrosshairMove = useCallback((param: any) => {
    // ignore non-pointer / programmatic moves to avoid jitter during scroll
    if (!param?.sourceEvent) return

    const t = param?.time
    if (!t) {
      indicatorChartsRef.current.forEach(({ chart }) => {
        try {
          chart.clearCrosshairPosition?.()
        } catch(e) {}
      })
      setCrosshairCandle(null)
      return
    }

    setCrosshairTime(t)

    // Find the candle at the crosshair time for OHLCDisplay
    const matchedCandle = candles.find(c => {
      const candleTime = Math.floor(new Date(c.timestamp).getTime() / 1000)
      return candleTime === t
    })
    setCrosshairCandle(matchedCandle || null)

    // Sync crosshair to all dynamic indicator panes
    paneIndicators.forEach(ind => {
      const entry = indicatorChartsRef.current.get(ind.id)
      if (!entry) return

      const data = indicatorDataMap[ind.id]
      if (!data) return

      // Find the value at the crosshair time
      const firstSeries = data.metadata.series_metadata[0]
      if (!firstSeries) return

      const seriesData = data.data[firstSeries.field]
      if (!seriesData) return

      // Find the value at the timestamp
      const timestampIndex = data.timestamps.indexOf(t as unknown as number)
      if (timestampIndex === -1) return

      const v = seriesData[timestampIndex]
      if (v !== null && v !== undefined) {
        entry.chart.setCrosshairPosition(v, t, entry.series)
      } else {
        entry.chart.clearCrosshairPosition?.()
      }
    })
  }, [paneIndicators, indicatorDataMap, candles])

  const handleIntervalSelect = useCallback((newInterval: string) => {
    setChartInterval(newInterval.toLowerCase())
  }, [])
