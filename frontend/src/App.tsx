import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { invalidateIndicatorCache } from './lib/indicatorCache'
import './App.css'
import LandingPage from "./LandingPage"
import Layout from './components/Layout'
import Toolbar, { type DataMode } from './components/Toolbar'
import Watchlist from './components/Watchlist'
import AlertsView from './components/AlertsView'
import ChartComponent from './components/ChartComponent'
import { OHLCDisplayWithTime } from './components/chart/OHLCDisplay'
import type { Alert } from './components/AlertsList'
import type { Layout as LayoutType } from './components/Toolbar'
import IndicatorPane from './components/IndicatorPane'
import { loadLayouts, saveLayouts, loadAlerts, saveAlerts } from './services/layoutService'
import { getCandles } from './api/candles'
import type { Candle } from './api/candles'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster, toast } from 'sonner'
import { formatDataForChart, formatIndicatorData } from './utils/chartHelpers'
import { IndicatorProvider, useIndicatorContext } from './contexts/IndicatorContext'
import { IndicatorDialog } from './components/indicators/IndicatorDialog'
import { ErrorBoundary } from './components/ErrorBoundary' // T049: Error boundary for indicator rendering
import { useIndicatorData, useIndicatorDataWithLoading, type IndicatorDataMapWithLoading } from './hooks/useIndicatorData'
import { useIndicatorMigration } from './hooks/useIndicatorMigration'
import type { IndicatorOutput } from './components/types/indicators'
import type { Time, IRange, LogicalRange } from 'lightweight-charts'
import { useWebSocket } from './hooks/useWebSocket'
import { CandleDataProvider } from './components/CandleDataProvider'
import { WatchlistDataProvider } from './components/WatchlistDataProvider'
import type { WatchlistItem } from './api/watchlist'
// Feature 011: Firebase Authentication
import { AuthDialog } from './components/AuthDialog'
import { UserMenu } from './components/UserMenu'
import { useAuth } from './contexts/AuthContext'
// Feature 009: Import watchlist API and search components
import { WatchlistSearch, type SymbolAddResult } from './components/WatchlistSearch'
import { useWatchlist } from './hooks/useWatchlist'
import { useInitialSymbolFromWatchlist } from './hooks/useInitialSymbolFromWatchlist'
import { useScrollBackfill } from './hooks/useScrollBackfill'
import { appendCandleToCache, syncCandlesToCache } from './lib/candleCacheUnified'
import { getWatchlist, addToWatchlist, removeFromWatchlist } from './api/watchlist'
// Feature 008: Overlay indicator instance management with styling
import { useIndicatorInstances } from './hooks/useIndicatorInstances'
import type { IndicatorInstance, IndicatorMetadata, ParameterDefinition } from './components/types/indicators'
import { IndicatorSettingsDialog } from './components/IndicatorSettingsDialog'
import { NotificationSettingsDialog } from './components/settings/NotificationSettingsDialog'
import { OverlayIndicatorLegend } from './components/OverlayIndicatorLegend'
import { SourceCodeModal } from './components/SourceCodeModal'
// Phase 6: Oscillator settings dialog
import { OscillatorSettingsDialog } from './components/OscillatorSettingsDialog'
import { listIndicatorsWithMetadata } from './api/indicators'
import type { IndicatorPane as IndicatorPaneType } from './components/types/indicators'
// Feature 012: Performance monitoring
import { PerformanceReport } from './components/PerformanceReport'

// ============================================================================
// Layout Helper Functions (Plain functions - can be called anywhere)
// ============================================================================

// Canonical name normalization for layouts (duplicate checking)
function normalizeLayoutName(name: string): string {
  return name.trim().toLowerCase()
}

// Canonical indicator name normalization (storage/indexing)
function normalizeIndicatorName(name: string): string {
  return name.toLowerCase()
}

// Validate unique layout name (case-insensitive)
function validateUniqueLayoutName(name: string, layouts: LayoutType[]): boolean {
  const normalized = normalizeLayoutName(name)
  return !layouts.some(layout => normalizeLayoutName(layout.name) === normalized)
}

// Capture current layout snapshot from global indicator state
function captureCurrentLayoutSnapshot(
  oscillatorIndicators: IndicatorPaneType[],
  overlayIndicators: IndicatorInstance[]
): { activeIndicators: string[]; indicatorParams: Record<string, any> } {
  // Get indicator names by category
  const oscillatorNames = oscillatorIndicators.map(
    ind => normalizeIndicatorName(ind.indicatorType.name)
  )
  const overlayNames = overlayIndicators.map(
    inst => normalizeIndicatorName(inst.indicatorType.name)
  )

  // Dedupe and combine to prevent duplicates
  const activeIndicators = Array.from(new Set([...oscillatorNames, ...overlayNames]))

  // Build params from current state (where updateIndicatorParams stores them)
  const indicatorParams: Record<string, any> = {}

  for (const ind of oscillatorIndicators) {
    const name = normalizeIndicatorName(ind.indicatorType.name)
    indicatorParams[name] = ind.indicatorType.params
  }

  for (const inst of overlayIndicators) {
    const name = normalizeIndicatorName(inst.indicatorType.name)
    indicatorParams[name] = inst.indicatorType.params
  }

  return { activeIndicators, indicatorParams }
}

// Create a new layout (shared helper for all layout creation paths)
function createLayout(
  name: string,
  snapshot: { activeIndicators: string[]; indicatorParams: Record<string, any> }
): LayoutType {
  return {
    id: Date.now().toString(),
    name: name.trim(),
    activeIndicators: snapshot.activeIndicators,
    indicatorParams: snapshot.indicatorParams
  }
}

// Feature 008: Load manual test module (available in browser console for testing)
if (import.meta.env.DEV) {
  import('./tests/manual/feature008-manual-test')
}

interface AppContentProps {
  symbol: string
  setSymbol: (symbol: string) => void
}

function AppContent({ symbol, setSymbol }: AppContentProps) {
  const [chartInterval, setChartInterval] = useState('1d')
  const [dataMode, setDataMode] = useState<DataMode>('websocket') // T026: Data mode toggle state
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isIndicatorsOpen, setIsIndicatorsOpen] = useState(false)
  // Feature 011: Auth state
  const { userProfile, isAuthenticated, isLoading: authLoading } = useAuth()
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [authDialogDefaultTab, setAuthDialogDefaultTab] = useState<'sign-in' | 'sign-up'>('sign-in')
  const mainViewportRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [mainTimeScale, setMainTimeScale] = useState<any>(null)
  const indicatorTimeScalesRef = useRef<Map<string, any>>(new Map())
  const { connect, disconnect, lastMessage } = useWebSocket();

  // Feature 009: Use API-based watchlist hook instead of localStorage
  const {
    entries: apiWatchlistEntries,
    symbols: watchlistSymbols,
    isLoading: watchlistLoading,
    error: watchlistError,
    refetch: refetchWatchlist,
    addSymbol: addSymbolToWatchlist,
    removeSymbol: removeSymbolFromWatchlist,
    updateOrder: updateWatchlistOrder,
    clearError: clearWatchlistError,
  } = useWatchlist(isAuthenticated)

  // Local state for visual ordering (drag-and-drop reordering)
  // Used for optimistic UI updates during reordering, synchronized with API
  const [orderedSymbols, setOrderedSymbols] = useState<string[]>([])

  // Update ordered symbols when API watchlist changes
  useEffect(() => {
    setOrderedSymbols(prev => {
      // Normalize API symbols to uppercase for consistency
      const apiSymbolsNormalized = watchlistSymbols.map(s => s.toUpperCase())

      // If local order is empty or lengths differ, use API order
      if (prev.length === 0 || prev.length !== apiSymbolsNormalized.length) {
        return apiSymbolsNormalized
      }
      // Check if the symbol sets actually match (handle reordering case)
      const prevSet = new Set(prev.map(s => s.toUpperCase()))
      const apiSet = new Set(apiSymbolsNormalized)
      const hasAllPrev = prev.every(s => apiSet.has(s.toUpperCase()))
      const hasAllApi = apiSymbolsNormalized.every(s => prevSet.has(s))

      // If both sets contain the same symbols, keep prev's order (user may have reordered)
      if (hasAllPrev && hasAllApi && prev.length === apiSymbolsNormalized.length) {
        return prev
      }

      // Otherwise, sync with API order (handles adds/removes)
      return apiSymbolsNormalized
    })
  }, [watchlistSymbols])

  // Memoize watchlist items for Watchlist component
  // Price data will be populated by WatchlistDataProvider
  const watchlist = useMemo(() => {
    return orderedSymbols.map(symbol => ({ symbol }))
  }, [orderedSymbols])

  const [alerts, setAlerts] = useState<Alert[]>(() => loadAlerts())
  const [layouts, setLayouts] = useState<LayoutType[]>([])
  const [activeLayout, setActiveLayout] = useState<LayoutType | null>(null)
  const [candles, setCandles] = useState<Candle[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // Track the request range for candle cache hits with indicators
  const [candleRequestRange, setCandleRequestRange] = useState<{from: string; to: string} | null>(null)
  const [hasMoreHistory, setHasMoreHistory] = useState(true)
  const lastFetchedToDateRef = useRef<string | null>(null)
  const [visibleRange, setVisibleRange] = useState<IRange<Time> | null>(null)
  const [crosshairTime, setCrosshairTime] = useState<number | null>(null)
  const [crosshairCandle, setCrosshairCandle] = useState<Candle | null>(null)
  const [indicatorSettings, setIndicatorSettings] = useState<Record<string, { visible: boolean; series: Record<string, boolean>; showLevels: boolean; showLastValue: boolean }>>({})
  const [isInitialLoading, setIsInitialLoading] = useState(true) // T101: Initial loading state (deprecated, use split states)
  const [isCandlesReady, setIsCandlesReady] = useState(false) // Candles loaded and ready
  const [areIndicatorsReady, setAreIndicatorsReady] = useState(false) // Indicators loaded (or not loading)
  const [error, setError] = useState<string | null>(null) // T102: Error state
  const mainChartRef = useRef<any>(null)
  const indicatorChartsRef = useRef<Map<string, { chart: any; series: any }>>(new Map())
  // T072: Store the polling refresh function for manual refresh button
  const candleRefreshRef = useRef<(() => void) | null>(null)
  // Store dataVersion from useCandleData to trigger indicator refetch on backfill
  const [candleDataVersion, setCandleDataVersion] = useState(0)

  // Phase 5: Synchronized backfill state - hold pending candles until indicators are ready
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [pendingCandleData, setPendingCandleData] = useState<Candle[] | null>(null)

  // Safety limit to prevent memory issues with large datasets
  const MAX_CANDLES = 50000

  // Use the new indicator system
  const { indicators, addIndicator, removeIndicator, updateIndicatorStyle, updateIndicatorParams } = useIndicatorContext()

  // Run migration to convert per-symbol data to global (runs once on mount)
  useIndicatorMigration()

  // Phase 5: Compute TARGET date range for indicators (MUST be before hook calls to avoid circular dependency)
  // During normal operation: use request range (for cache hits) or candle range
  // During backfill: includes pending candle data
  // IMPORTANT: Pending candle data may not be sorted - use min/max to find bounds
  const targetCandleDateRange = useMemo(() => {
    if (pendingCandleData && pendingCandleData.length > 0) {
      // Find earliest timestamp in pending data (may not be at index 0)
      const pendingEarliest = pendingCandleData.reduce((earliest, c) =>
        c.timestamp < earliest ? c.timestamp : earliest,
        pendingCandleData[0].timestamp
      )

      // Target range = earliest pending to latest existing
      const range = {
        from: pendingEarliest,
        to: candles[candles.length - 1].timestamp
      }
      console.log('[targetCandleDateRange] Backfill mode:', {
        pendingCount: pendingCandleData.length,
        from: range.from,
        to: range.to,
        candleCount: candles.length
      })
      return range
    }

    // No pending data - use request range for initial load (cache hit optimization)
    // Fall back to actual candle timestamps for backfill
    if (candleRequestRange) {
      console.log('[targetCandleDateRange] Using request range for cache alignment:', {
        from: candleRequestRange.from,
        to: candleRequestRange.to,
        candleCount: candles.length
      })
      return candleRequestRange
    }

    if (candles.length === 0) return undefined
    const range = {
      from: candles[0].timestamp,
      to: candles[candles.length - 1].timestamp
    }
    console.log('[targetCandleDateRange] Normal mode (fallback):', {
      from: range.from,
      to: range.to,
      candleCount: candles.length
    })
    return range
  }, [candles, pendingCandleData, candleRequestRange])

  // Use indicator data with loading state to synchronize chart rendering
  // Pass candleDataVersion and targetCandleDateRange for synchronized loading
  const indicatorDataMap = useIndicatorDataWithLoading(indicators, symbol, chartInterval, candleDataVersion, targetCandleDateRange, candles)
  const indicatorsLoading = indicatorDataMap.isLoading || false  // Changed from _isLoading

  // Feature 008 - T014: Integrate useIndicatorInstances for overlay indicator management
  // Now uses global storage - no longer per-symbol
  const {
    instances: overlayInstances,
    isLoaded: overlayInstancesLoaded,
    addIndicator: addOverlayInstance,
    removeIndicator: removeOverlayInstance,
    updateStyle,
    toggleVisibility,
    updateInstance, // T047: Generic instance update for settings dialog
    isOffline: overlayOffline
  } = useIndicatorInstances()

  // T047: Settings dialog state for overlay indicators
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsIndicatorId, setSettingsIndicatorId] = useState<string | null>(null)

  // Phase 6: Oscillator settings dialog state
  const [oscillatorSettingsOpen, setOscillatorSettingsOpen] = useState(false)
  const [oscillatorSettingsIndicatorId, setOscillatorSettingsIndicatorId] = useState<string | null>(null)

  // Phase 6: Cache for indicator metadata to avoid repeated API calls
  const [indicatorMetadataCache, setIndicatorMetadataCache] = useState<Record<string, any>>({})

  // Feature 008: Source code modal state
  const [sourceCodeIndicatorId, setSourceCodeIndicatorId] = useState<string | null>(null)

  // Feature 008 - T015: Fetch data for overlay instances using useIndicatorDataWithLoading
  // Cast IndicatorInstance[] to IndicatorPane[] for compatibility (both have id and indicatorType)
  // Separate data from loading state to avoid accidentally treating isLoading/error as indicator IDs
  const overlayInstanceResult = useIndicatorDataWithLoading(overlayInstances as any, symbol, chartInterval, candleDataVersion, targetCandleDateRange, candles)
  const overlayInstanceDataMap: Record<string, IndicatorOutput> = {}
  const overlayInstancesLoading = overlayInstanceResult.isLoading || false

  // Extract indicator data from the result, excluding metadata keys (isLoading, error)
  Object.entries(overlayInstanceResult).forEach(([key, value]) => {
    if (key !== 'isLoading' && key !== 'error') {
      overlayInstanceDataMap[key] = value as IndicatorOutput
    }
  })

  // Phase 6: Load indicator metadata from backend on mount
  useEffect(() => {
    listIndicatorsWithMetadata()
      .then(indicators => {
        const cache: Record<string, any> = {};
        indicators.forEach(ind => {
          // Normalize parameters from object to array format
          const normalizedInd = {
            ...ind,
            parameters: ind.parameters
              ? Object.entries(ind.parameters).map(([paramName, def]) => ({
                  name: paramName,
                  ...def,
                }))
              : undefined,
          };
          cache[ind.name] = normalizedInd;
        });
        setIndicatorMetadataCache(cache);
      })
      .catch(err => {
        console.error('Failed to load indicator metadata:', err);
      });
  }, [])

  // REMOVED: Auto-sync effect that mutated layouts based on context
  // This was causing layouts to change when switching symbols
  // Layouts should now only change when explicitly saved

  const toggleIndicatorVisibility = useCallback((indicatorId: string) => {
    setIndicatorSettings(prev => ({
        ...prev,
        [indicatorId]: {
            ...prev[indicatorId],
            visible: prev[indicatorId]?.visible === false ? true : false
        }
    }))
  }, [])

  const toggleSeriesVisibility = useCallback((indicatorId: string, seriesId: string) => {
    setIndicatorSettings(prev => ({
        ...prev,
        [indicatorId]: {
            ...prev[indicatorId],
            series: {
                ...prev[indicatorId]?.series,
                [seriesId]: prev[indicatorId]?.series?.[seriesId] === false ? true : false
            }
        }
    }))
  }, [])

  const toggleLevelsVisibility = useCallback((indicatorId: string) => {
    setIndicatorSettings(prev => ({
        ...prev,
        [indicatorId]: {
            ...prev[indicatorId],
            showLevels: prev[indicatorId]?.showLevels === false ? true : false
        }
    }))
  }, [])

  const toggleLastValueVisibility = useCallback((indicatorId: string) => {
    setIndicatorSettings(prev => ({
      ...prev,
      [indicatorId]: {
        ...prev[indicatorId],
        showLastValue: !(prev[indicatorId]?.showLastValue ?? false)
      }
    }))
  }, [])

  useEffect(() => {
    if (!mainViewportRef.current) return

    const observer = new ResizeObserver((entries) => {
        if (entries[0]) {
            const { width, height } = entries[0].contentRect
            setDimensions({ width, height })
        }
    })

    observer.observe(mainViewportRef.current)
    return () => observer.disconnect()
  }, [])

  // Feature 011: Fetch alerts from API when authenticated, use localStorage when guest
  useEffect(() => {
    const fetchAlerts = async () => {
      if (isAuthenticated) {
        try {
          const { listAlerts, getAlertNotificationSettings } = await import('./api/alerts')
          const backendAlerts = await listAlerts()

          // Fetch notification settings for all alerts in parallel
          const notificationSettingsPromises = backendAlerts.map(async (alert) => {
            try {
              const settings = await getAlertNotificationSettings(String(alert.id))
              return { alertId: alert.id, settings }
            } catch (err) {
              // 404 means no custom settings (use global defaults)
              return { alertId: alert.id, settings: null }
            }
          })

          const notificationSettingsResults = await Promise.all(notificationSettingsPromises)
          const settingsMap = new Map(
            notificationSettingsResults.map(r => [r.alertId, r.settings])
          )

          // Convert backend alerts to local Alert format (from AlertsList)
          const convertedAlerts = backendAlerts.map(a => ({
            id: String(a.id),
            symbol: a.symbol || '',
            condition: a.condition,
            threshold: a.threshold,
            status: a.is_active ? 'active' as const : 'muted' as const,
            createdAt: a.created_at,
            interval: a.interval,
            indicator_name: a.indicator_name,
            indicator_field: a.indicator_field,
            indicator_params: a.indicator_params,
            enabled_conditions: a.enabled_conditions,
            messages: a.messages,
            notificationSettings: settingsMap.get(a.id) ?? undefined
          }))
          setAlerts(convertedAlerts)
        } catch (error) {
          console.error('Failed to fetch alerts from backend:', error)
          // Keep localStorage alerts if backend fetch fails
        }
      }
      // When not authenticated, alerts are already loaded from localStorage via useState initializer
    }

    // Only fetch after auth loading is complete
    if (!authLoading) {
      fetchAlerts()
    }
  }, [isAuthenticated, authLoading])

  useEffect(() => {
    if (!mainTimeScale) return

    const handleRangeChange = (range: any) => {
        if (!range) return
        indicatorTimeScalesRef.current.forEach((ts) => {
          try {
            // Validate time scale is in a good state before setting range
            // This prevents errors from destroyed/invalid indicator charts
            const currentVisible = ts.getVisibleRange()
            if (currentVisible !== null) {
              ts.setVisibleLogicalRange(range)
            }
          } catch (e) {
            // Ignore errors from indicator charts that are being destroyed/unmounted
            // This can happen during rapid symbol changes or when the chart is updating
            // Also filters out invalid time scales from the ref
            console.debug('[Chart] Ignoring time scale error from indicator chart:', e)
          }
        })
    }

    mainTimeScale.subscribeVisibleLogicalRangeChange(handleRangeChange)
    
    const currentRange = mainTimeScale.getVisibleLogicalRange()
    if (currentRange) {
        indicatorTimeScalesRef.current.forEach((ts) => {
          try {
            // Validate time scale is in a good state before setting range
            const indicatorVisible = ts.getVisibleRange()
            if (indicatorVisible !== null) {
              ts.setVisibleLogicalRange(currentRange)
            }
          } catch (e) {
            console.debug('[Chart] Ignoring time scale error from indicator chart:', e)
          }
        })
    }

    return () => {
        mainTimeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange)
    }
  }, [mainTimeScale, activeLayout?.activeIndicators, candles])

  // Feature 009: Removed localStorage saveWatchlist - watchlist is now managed by API
  // useEffect(() => {
  //   saveWatchlist(watchlist.map(item => item.symbol))
  // }, [watchlist])

  useEffect(() => {
    saveAlerts(alerts)
  }, [alerts])

  useEffect(() => {
    // Connect to websocket for real-time updates only in WebSocket mode
    // Allow initial SPY load - chart will switch to watchlist symbol when available
    if (dataMode === 'websocket' && symbol && chartInterval) {
        const wsUrl = `ws://localhost:8000/api/v1/candles/ws/${symbol}?interval=${chartInterval}`;
        connect(wsUrl);
    } else {
        disconnect();
    }
    return () => {
        disconnect();
    };
  }, [symbol, chartInterval, connect, disconnect, dataMode]);

  useEffect(() => {
    // Skip WS updates until initial REST data has loaded (prevents visual flicker).
    // Also checks prevCandles.length inside setCandles to prevent processing messages when REST failed/returned empty.
    if (lastMessage && !isInitialLoading) {
      const newCandle = JSON.parse(lastMessage.data);
      setCandles(prevCandles => {
        // Skip processing if REST data hasn't loaded successfully (empty or failed)
        if (prevCandles.length === 0) {
          return prevCandles;
        }

        // Keep existing epoch-ms Map dedupe logic
        const uniqueCandlesMap = new Map();

        // Add all existing candles to the map (using timestamp as key)
        prevCandles.forEach(candle => {
          const timestampKey = new Date(candle.timestamp).getTime();
          uniqueCandlesMap.set(timestampKey, candle);
        });

        // Add or update the new candle
        const newCandleTimestamp = new Date(newCandle.timestamp).getTime();
        const existingCandle = uniqueCandlesMap.get(newCandleTimestamp);

        // Optional: Skip update if OHLC values are identical (prevents unnecessary re-renders)
        if (existingCandle &&
            existingCandle.open === newCandle.open &&
            existingCandle.high === newCandle.high &&
            existingCandle.low === newCandle.low &&
            existingCandle.close === newCandle.close &&
            existingCandle.volume === newCandle.volume) {
          return prevCandles; // No change, skip re-render
        }

        uniqueCandlesMap.set(newCandleTimestamp, newCandle);

        // Convert back to array and sort
        const updatedCandles = Array.from(uniqueCandlesMap.values());
        const finalCandles = updatedCandles.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

        // Fire-and-forget async cache update (don't await, don't block render)
        // Sync both caches with the final candles array after dedupe/merge/sort
        syncCandlesToCache(symbol, chartInterval, finalCandles)
          .catch(err => console.warn('[Cache] Failed to sync:', err));

        return finalCandles;
      });
    }
  }, [lastMessage, isInitialLoading, symbol, chartInterval]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Cmd/Ctrl+K: Open search
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsSearchOpen((open) => !open)
      }
      // Cmd/Ctrl+I: Open indicators
      if (e.key === "i" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsIndicatorsOpen((open) => !open)
      }
      // T095, T096: Plus/Equals key to zoom in, Minus to zoom out
      if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        // Zoom in by reducing visible range
        if (mainTimeScale) {
          const currentRange = mainTimeScale.getVisibleLogicalRange()
          if (currentRange) {
            const rangeWidth = currentRange.to - currentRange.from
            const newRangeWidth = rangeWidth * 0.8 // Zoom in by 20%
            const center = (currentRange.from + currentRange.to) / 2
            mainTimeScale.setVisibleLogicalRange({
              from: center - newRangeWidth / 2,
              to: center + newRangeWidth / 2
            })
          }
        }
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        // Zoom out by increasing visible range
        if (mainTimeScale) {
          const currentRange = mainTimeScale.getVisibleLogicalRange()
          if (currentRange) {
            const rangeWidth = currentRange.to - currentRange.from
            const newRangeWidth = rangeWidth * 1.2 // Zoom out by 20%
            const center = (currentRange.from + currentRange.to) / 2
            mainTimeScale.setVisibleLogicalRange({
              from: center - newRangeWidth / 2,
              to: center + newRangeWidth / 2
            })
          }
        }
      }
      // T097: 0 to reset zoom (R key removed)
      if ((e.key === "0" && !e.ctrlKey && !e.metaKey)) {
        // Only reset zoom if not typing in an input field
        if (e.target instanceof HTMLElement && 
            (e.target.tagName === "INPUT" || 
             e.target.tagName === "TEXTAREA" || 
             e.target.contentEditable === "true")) {
          // Allow typing in input fields, textarea, or contentEditable elements
          return;
        }
        e.preventDefault()
        if (mainTimeScale) {
          mainTimeScale.fitContent()
        }
      }
      // T098: Escape to exit drawing mode (if implemented)
      if (e.key === "Escape") {
        // This will be used when drawing tools are implemented
        // For now, just ensure no modal is open
        if (isSearchOpen) setIsSearchOpen(false)
        if (isIndicatorsOpen) setIsIndicatorsOpen(false)
      }
      // T099: C to toggle crosshair (handled by lightweight-charts natively)
      // The crosshair visibility is managed by lightweight-charts internal state
    }
    window.addEventListener("keydown", down)
    return () => window.removeEventListener("keydown", down)
  }, [mainTimeScale, isSearchOpen, isIndicatorsOpen])

  useEffect(() => {
    const saved = loadLayouts()
    setLayouts(saved)
    if (saved.length > 0) {
        setActiveLayout(saved[0])
    } else {
        const defaultLayout: LayoutType = {
            id: 'default',
            name: 'Default Layout',
            activeIndicators: [],
            indicatorParams: {}
        }
        setActiveLayout(defaultLayout)
    }
  }, [])

  useEffect(() => {
    console.log('[Initial Fetch] Triggered for symbol:', symbol, 'interval:', chartInterval, 'dataMode:', dataMode)
    console.log('[Initial Fetch] useEffect executing, current candles:', candles.length)

    // Reset pagination state when symbol or interval changes
    setHasMoreHistory(true)
    lastFetchedToDateRef.current = null
    setIsInitialLoading(true) // T101: Set loading state
    setError(null) // T102: Clear error state

    const fetchData = async () => {
        try {
            console.log('[Initial Fetch] fetchData() called for symbol:', symbol, 'interval:', chartInterval)
            // For daily intervals, use yesterday's close to avoid "gap" detection for today's incomplete candle
            // For intraday intervals, use current time (real-time updates expected)
            const now = new Date()
            let to: Date
            if (chartInterval === '1d' || chartInterval === '1wk') {
                // Daily/weekly: use end of previous day
                to = new Date(now)
                to.setHours(23, 59, 59, 999)
                to.setDate(to.getDate() - 1)  // Yesterday
            } else {
                // Intraday: use current time
                to = now
            }

            const toStr = to.toISOString()
            // 200 candles for chart + 500 candles warmup for indicator cache alignment
            const INITIAL_CANDLE_COUNT = 200 + 500
            const intervalMs = getIntervalMilliseconds(chartInterval)
            const fromDate = new Date(to.getTime() - (INITIAL_CANDLE_COUNT * intervalMs))
            const from = fromDate.toISOString()

            // Store request range for indicator cache alignment
            setCandleRequestRange({ from, to: toStr })

            console.log('[Initial Fetch] Fetching candles from', from, 'to', toStr)
            // Only fetch candles - indicator data is fetched by useIndicatorDataWithLoading hook
            const candleData = await getCandles(symbol, chartInterval, from, toStr).catch((err) => {
  console.error('[Initial Fetch] ERROR fetching candles:', err);
  return [];
})
            console.log('[Initial Fetch] Received', candleData.length, 'candles')

            // CRITICAL: Only update candles if we got valid data
            // If fetch fails (returns empty), preserve existing data to prevent infinite scroll loop
            if (candleData.length > 0) {
                setCandles(candleData)
                setError(null)
                // Invalidate indicator cache and trigger recalculation with new historical data
                invalidateIndicatorCache(symbol)
                setCandleDataVersion(v => v + 1)

                // AUTO-BACKFILL DISABLED: Let user scroll to trigger backfill
                // Auto-backfill was interfering with initial load timing and causing
                // double fetches. User can scroll back to trigger historical data.
            } else if (candles.length === 0) {
                // Only set empty state if we don't have any data yet
                setCandles([])
                setError(`No data available for ${symbol}`)
            }
            // If we already have candles and the fetch failed, keep the existing data
        } catch (e) {
            console.error('Failed to fetch data', e)
            // T102: Set error state only if we don't have data
            if (candles.length === 0) {
                setError(`Failed to load data for ${symbol}. Please try again.`)
            }
        }
        // Don't set isInitialLoading(false) here - wait for indicators too
    }
    fetchData()
  }, [symbol, chartInterval])

  // Split loading states: candles vs indicators
  // This allows scroll/backfill to work independently of indicator loading
  // while preventing the "indicator jump" issue when both are ready
  useEffect(() => {
    setIsCandlesReady(candles.length > 0)
  }, [candles.length])

  useEffect(() => {
    // "Ready" means either:
    // 1. Not loading (even if no indicators selected), OR
    // 2. Loading is complete AND we have indicators
    // This prevents areIndicatorsReady from being false forever when no indicators selected
    // IMPORTANT: Must wait for BOTH oscillator indicators AND overlay indicators
    const allIndicatorsLoading = indicatorsLoading || overlayInstancesLoading
    const hasAnyIndicators = indicators.length > 0 || overlayInstances.length > 0
    setAreIndicatorsReady(!allIndicatorsLoading || !hasAnyIndicators)
  }, [indicatorsLoading, overlayInstancesLoading, indicators.length, overlayInstances.length])

  // DERIVED: Combined ready state for UI loading overlay
  // This prevents the "indicator jump" issue that prompted the original coupling
  const isEverythingReady = isCandlesReady && areIndicatorsReady

  // Keep isInitialLoading in sync for backwards compatibility during transition
  useEffect(() => {
    if (isEverythingReady && isInitialLoading) {
      setIsInitialLoading(false)
    }
  }, [isEverythingReady, isInitialLoading])

  // Track load timing for symbol changes - granular phases T1-T5
  const loadStartTimeRef = useRef<number | null>(null)
  const loadingSymbolRef = useRef<string | null>(null)
  const t2TimeRef = useRef<number | null>(null)    // T2: Candles received
  const t4TimeRef = useRef<number | null>(null)    // T4: Indicators done
  const [candlesDone, setCandlesDone] = useState(false)
  const [indicatorsDone, setIndicatorsDone] = useState(false)
  const indicatorDoneTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const t4CountRef = useRef<number>(0)  // Track number of T4 DONE messages

  // T024b: Refs to track indicator state for immediate interactivity optimization
  // These refs are updated synchronously when indicators change
  const indicatorsRef = useRef(indicators)
  const overlayInstancesRef = useRef(overlayInstances)
  indicatorsRef.current = indicators
  overlayInstancesRef.current = overlayInstances

  // Listen for timing events from hooks and WebSocket
  useEffect(() => {
    const originalLog = console.log

    console.log = (...args) => {
      originalLog.apply(console, args)

      // Only track if we're actively timing a symbol load
      if (!loadStartTimeRef.current || !loadingSymbolRef.current) return

      const message = args[0]
      if (typeof message !== 'string') return

      const currentSymbol = loadingSymbolRef.current

      // Check for candles received - "Received" appears in "[Initial Fetch] Received X candles"
      // Note: This message doesn't include the symbol name, so we just check for "Received"
      if (message.includes('[Initial Fetch] Received')) {
        // Capture T2 timestamp for duration breakdown
        if (loadStartTimeRef.current) {
          t2TimeRef.current = performance.now()
        }
        setCandlesDone(true)
        console.log(`%c[T2 DONE] Candles received for ${currentSymbol}`, 'color: #FF9800; font-weight: bold')

        // T024b: If no indicators are configured, set indicatorsDone immediately
        // This allows the chart to become interactive immediately without waiting for debounce
        const hasNoIndicators = indicatorsRef.current.length === 0 && overlayInstancesRef.current.length === 0
        if (hasNoIndicators) {
          console.log(`%c[INDICATORS DONE] No indicators configured - immediate ready state`, 'color: #4CAF50; font-weight: bold')
          setIndicatorsDone(true)
        }
      }

      // Check for indicators done - use debounce to wait for ALL rounds
      // Count T4 DONE messages to track when all batches are complete
      if (message.includes('[T4 DONE]')) {
        // Increment T4 count
        t4CountRef.current++

        // Capture T4 timestamp for duration breakdown
        if (loadStartTimeRef.current) {
          t4TimeRef.current = performance.now()
        }

        // Clear any existing timeout
        if (indicatorDoneTimeoutRef.current) {
          clearTimeout(indicatorDoneTimeoutRef.current)
        }

        // Set new timeout - wait 100ms after the LAST T4 DONE message
        // Short delay to catch rapid successive T4 messages (backfill indicators)
        // but fast enough that timer appears when chart is actually visible
        indicatorDoneTimeoutRef.current = setTimeout(() => {
          // Check if we're in a stable state (no more T4s for a while)
          console.log(`%c[INDICATORS DONE] Total T4 DONE messages: ${t4CountRef.current}`, 'color: #4CAF50; font-weight: bold')
          setIndicatorsDone(true)
          t4CountRef.current = 0  // Reset for next load
        }, 100)
      }
    }

    return () => {
      console.log = originalLog
      if (indicatorDoneTimeoutRef.current) {
        clearTimeout(indicatorDoneTimeoutRef.current)
      }
    }
  }, [])

  // Watch for both candles and indicators to be done, then wait for chart rendering
  useEffect(() => {
    if (!loadStartTimeRef.current || !loadingSymbolRef.current) return

    if (candlesDone && indicatorsDone) {
      const symbolForTiming = loadingSymbolRef.current
      const loadStart = loadStartTimeRef.current

      // Reset tracking to prevent double-firing
      setCandlesDone(false)
      setIndicatorsDone(false)

      // Wait for React to flush updates (single frame is enough)
      const waitForChartRender = () => {
        requestAnimationFrame(() => {
              const endTime = performance.now()
              const loadTimeMs = endTime - loadStart

              // Performance: Mark chart render complete (T5)
              console.log(`%c[T5 DONE] Chart render complete for ${symbolForTiming}`, 'color: #2196F3; font-weight: bold')

              // Compute phase durations for bottleneck analysis
              const tCandles = t2TimeRef.current ? t2TimeRef.current - loadStartTimeRef.current : 0
              const tIndicators = t4TimeRef.current && t2TimeRef.current ? t4TimeRef.current - t2TimeRef.current : 0
              const tRender = loadTimeMs - (t4TimeRef.current ? t4TimeRef.current - loadStartTimeRef.current : 0)

              // Log with phase breakdown
              console.log(
                `%c[LOAD DONE] ${symbolForTiming} - ${loadTimeMs.toFixed(0)}ms TOTAL (candles: ${tCandles.toFixed(0)}ms, indicators: ${tIndicators.toFixed(0)}ms, render: ${tRender.toFixed(0)}ms)`,
                `color: ${loadTimeMs < 500 ? '#4CAF50' : loadTimeMs < 1000 ? '#FF9800' : '#F44336'}; font-weight: bold; font-size: 14px`
              )

              // Add keyframes if not exists
              if (!document.getElementById('load-time-animations')) {
                const style = document.createElement('style')
                style.id = 'load-time-animations'
                style.textContent = `
                  @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                  }
                  @keyframes fadeOut {
                    from { opacity: 1; transform: translateY(0); }
                    to { opacity: 0; transform: translateY(-10px); }
                  }
                `
                document.head.appendChild(style)
              }

              // Also show in a visible overlay
              const existingOverlay = document.getElementById('load-time-overlay')
              if (existingOverlay) {
                existingOverlay.remove()
              }

              const overlay = document.createElement('div')
              overlay.id = 'load-time-overlay'
              overlay.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                background: ${loadTimeMs < 500 ? '#4CAF50' : loadTimeMs < 1000 ? '#FF9800' : '#F44336'};
                color: white;
                padding: 10px 15px;
                border-radius: 5px;
                font-family: monospace;
                font-weight: bold;
                font-size: 14px;
                z-index: 10000;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                animation: fadeIn 0.3s ease-in;
                max-width: 300px;
              `
              overlay.innerHTML = `⏱ ${symbolForTiming}: ${loadTimeMs.toFixed(0)}ms<br><small>candles: ${tCandles.toFixed(0)}ms | indicators: ${tIndicators.toFixed(0)}ms | render: ${tRender.toFixed(0)}ms</small>`
              document.body.appendChild(overlay)

              // Auto-remove after 3 seconds
              setTimeout(() => {
                overlay.style.animation = 'fadeOut 0.3s ease-out'
                setTimeout(() => overlay.remove(), 300)
              }, 3000)

              // Clear refs
              loadStartTimeRef.current = null
              loadingSymbolRef.current = null
              t2TimeRef.current = null
              t4TimeRef.current = null
            })
      }
      waitForChartRender()
    }
  }, [candlesDone, indicatorsDone])

  // Feature 009: Simplified handleSymbolSelect - just changes the active symbol
  // Adding to watchlist is now done via WatchlistSearch component
  const handleSymbolSelect = useCallback((newSymbol: string) => {
    loadStartTimeRef.current = performance.now()
    loadingSymbolRef.current = newSymbol
    // Performance: Mark T1 (symbol click)
    console.log(`%c[T1 START] Symbol click: ${newSymbol}`, 'color: #4CAF50; font-weight: bold; font-size: 14px')

    // Clear candles synchronously to prevent useIndicatorData from fetching with stale data
    // This ensures the guard in useIndicatorData will trigger (candles.length === 0)
    setCandles([])

    setSymbol(newSymbol)
    // Note: No longer automatically adds to watchlist - user must explicitly add via search
  }, [])

  const handleLayoutSave = useCallback((name: string) => {
    // Normalize and validate name
    const trimmedName = name.trim()
    if (!trimmedName) {
      return
    }

    // Check for duplicate names (case-insensitive, using canonical normalization)
    if (!validateUniqueLayoutName(trimmedName, layouts)) {
      toast.error(`Layout "${trimmedName}" already exists`)
      return
    }

    // Capture current indicator state from global context
    const snapshot = captureCurrentLayoutSnapshot(indicators, overlayInstances)

    // Create new layout using shared helper
    const newLayout = createLayout(trimmedName, snapshot)

    const updated = [...layouts, newLayout]
    setLayouts(updated)
    saveLayouts(updated)
    setActiveLayout(newLayout)
  }, [layouts, indicators, overlayInstances])

  const handleLayoutUpdate = useCallback(() => {
    // Only allow update if there's an active non-default layout
    if (!activeLayout || activeLayout.id === 'default') {
      return
    }

    // Capture current indicator state from global context
    const { activeIndicators, indicatorParams } = captureCurrentLayoutSnapshot(
      indicators,
      overlayInstances
    )

    // Update existing layout by id
    const updatedLayout: LayoutType = {
      ...activeLayout,
      activeIndicators,
      indicatorParams
    }

    const updatedLayouts = layouts.map(l =>
      l.id === activeLayout.id ? updatedLayout : l
    )

    setLayouts(updatedLayouts)
    saveLayouts(updatedLayouts)
    setActiveLayout(updatedLayout)
  }, [activeLayout, layouts, indicators, overlayInstances])

  const toggleIndicator = useCallback((indicator: string) => {
    // Determine if indicator is overlay or oscillator from metadata cache
    const metadata = indicatorMetadataCache[indicator.toLowerCase()]
    if (!metadata) {
      console.warn(`Unknown indicator: ${indicator}`)
      return
    }

    const category = metadata.category  // 'overlay' or 'oscillator'

    // Handle differently based on category
    if (category === 'oscillator') {
      // Check if oscillator pane indicator exists
      const exists = indicators.find(ind => ind.indicatorType.name.toLowerCase() === indicator.toLowerCase())
      if (exists) {
        removeIndicator(exists.id)  // Use useIndicators context's removeIndicator
      } else {
        const params = activeLayout?.indicatorParams[indicator] || {}
        const indicatorType = {
          category: 'oscillator' as const,
          name: indicator,
          params
        }
        addIndicator(indicatorType)  // Use useIndicators context's addIndicator
      }
    } else if (category === 'overlay') {
      // Check if overlay instance exists
      const exists = overlayInstances.find(inst => inst.indicatorType.name.toLowerCase() === indicator.toLowerCase())
      if (exists) {
        removeOverlayInstance(exists.id)  // Use useIndicatorInstances context's removeIndicator
      } else {
        const params = activeLayout?.indicatorParams[indicator] || {}
        addOverlayInstance(indicator, params)  // Use useIndicatorInstances context's addIndicator
      }
    }
    // Note: Do NOT mutate activeLayout.activeIndicators
  }, [indicators, overlayInstances, activeLayout, indicatorMetadataCache, addIndicator, removeIndicator, addOverlayInstance, removeOverlayInstance])

  const handleLayoutSelect = useCallback((layout: LayoutType) => {
    // Set the active layout
    setActiveLayout(layout)

    // Build sets of current indicators by category
    const currentOscillatorNames = new Set(
      indicators.map(ind => ind.indicatorType.name.toLowerCase())
    )
    const currentOverlayNames = new Set(
      overlayInstances.map(inst => inst.indicatorType.name.toLowerCase())
    )

    // Separate layout indicators by category using metadata cache
    const layoutOscillators: string[] = []
    const layoutOverlays: string[] = []

    for (const indicatorName of layout.activeIndicators) {
      const metadata = indicatorMetadataCache[indicatorName.toLowerCase()]
      if (!metadata) {
        console.warn(`Unknown indicator in layout: ${indicatorName}`)
        continue
      }

      if (metadata.category === 'oscillator') {
        layoutOscillators.push(indicatorName)
      } else if (metadata.category === 'overlay') {
        layoutOverlays.push(indicatorName)
      }
    }

    // Remove oscillators not in layout
    for (const pane of indicators) {
      const name = pane.indicatorType.name.toLowerCase()
      if (!layoutOscillators.includes(name)) {
        removeIndicator(pane.id)
      }
    }

    // Add missing oscillators from layout
    for (const indicatorName of layoutOscillators) {
      if (!currentOscillatorNames.has(indicatorName)) {
        const params = layout.indicatorParams[indicatorName] || {}
        const indicatorType = {
          category: 'oscillator' as const,
          name: indicatorName,
          params
        }
        addIndicator(indicatorType)
      }
    }

    // Remove overlays not in layout
    for (const instance of overlayInstances) {
      const name = instance.indicatorType.name.toLowerCase()
      if (!layoutOverlays.includes(name)) {
        removeOverlayInstance(instance.id)
      }
    }

    // Add missing overlays from layout
    for (const indicatorName of layoutOverlays) {
      if (!currentOverlayNames.has(indicatorName)) {
        const params = layout.indicatorParams[indicatorName] || {}
        addOverlayInstance(indicatorName, params)
      }
    }
  }, [
    indicators,
    overlayInstances,
    indicatorMetadataCache,
    addIndicator,
    removeIndicator,
    addOverlayInstance,
    removeOverlayInstance
  ])

  const triggeredCount = alerts.filter(a => a.status === 'triggered').length

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  }, [])

  // T026: Toggle between WebSocket and polling modes
  const handleDataModeToggle = useCallback(() => {
    setDataMode(prev => prev === 'websocket' ? 'polling' : 'websocket')
  }, [])

  // T072: Handle manual refresh button click
  const handleManualRefresh = useCallback(() => {
    if (dataMode === 'polling' && candleRefreshRef.current) {
      candleRefreshRef.current()
    }
  }, [dataMode])

  // Feature 009: Watchlist handlers using API
  const handleWatchlistRemove = useCallback(async (symbols: string[]) => {
    // Remove each symbol from the API
    for (const symbol of symbols) {
      try {
        await removeSymbolFromWatchlist(symbol)
        // Update local orderedSymbols state to remove the symbol immediately
        setOrderedSymbols(prev => prev.filter(s => s !== symbol))
        toast.success(`Removed ${symbol} from watchlist`)
      } catch (error) {
        console.error('Failed to remove symbol:', error)
        toast.error(`Failed to remove ${symbol}`)
      }
    }
  }, [removeSymbolFromWatchlist])

  // Handle watchlist reordering with optimistic updates and error rollback
  const handleWatchlistReorder = useCallback(async (items: WatchlistItem[]) => {
    // items contains just the moved symbols: [{symbol: active}, {symbol: over}]
    let newOrder: string[]

    if (items.length === 2) {
      // New format: just the two symbols being moved
      const [active, over] = items
      // Use case-insensitive matching for robustness
      const oldIndex = orderedSymbols.findIndex(s => s.toUpperCase() === active.symbol.toUpperCase())
      const newIndex = orderedSymbols.findIndex(s => s.toUpperCase() === over.symbol.toUpperCase())

      if (oldIndex === -1 || newIndex === -1) {
        console.error('[REORDER] Symbol not found in orderedSymbols:', active.symbol, over.symbol)
        console.error('[REORDER] orderedSymbols contains:', orderedSymbols.slice(0, 10), '...')
        return
      }

      // Apply the move to the full orderedSymbols list
      // Normalize to uppercase for consistency with backend
      newOrder = orderedSymbols.map(s => s.toUpperCase())
      const [moved] = newOrder.splice(oldIndex, 1)
      newOrder.splice(newIndex, 0, moved)
    } else {
      // Legacy format: full items array (fallback)
      newOrder = items.map(item => item.symbol.toUpperCase())
    }

    // Save previous order for rollback
    const previousOrder = orderedSymbols

    // Optimistic update - update UI immediately for responsiveness
    setOrderedSymbols(newOrder)

    try {
      // Persist to backend
      await updateWatchlistOrder(newOrder)
    } catch (error) {
      console.error('Failed to persist watchlist order:', error)
      // Rollback to previous order
      setOrderedSymbols(previousOrder)
      toast.error('Failed to save watchlist order. Please try again.')
      // Refetch to get accurate server state
      refetchWatchlist()
    }
  }, [updateWatchlistOrder, orderedSymbols, refetchWatchlist])

  // Feature 009: Handler for search dialog - adds to watchlist AND changes chart symbol
  // CRITICAL: Never throw - always return { ok: true | false } so WatchlistSearch can handle errors
  const handleSearchSelectSymbol = useCallback(async (selectedSymbol: string): Promise<SymbolAddResult> => {
    // Normalize once - backend and API client also normalize, but we need consistent display
    const normalized = selectedSymbol.trim().toUpperCase()

    try {
      // Add to watchlist first (triggers backfill if new symbol)
      const result = await addSymbolToWatchlist(normalized)

      // Handle based on returned status (not throwing errors)
      // Result can be WatchlistAddResponse object or just the status string
      const status = typeof result === 'string' ? result : result.status

      if (status === 'already_present') {
        setSymbol(normalized)
        toast.success(`${normalized} is already in your watchlist`)
      } else {
        // status === 'added'
        setSymbol(normalized)
        toast.success(`Added ${normalized} to watchlist`)
      }
      return { ok: true }
    } catch (error) {
      console.error('Failed to add symbol to watchlist:', error)

      // Parse error from Axios response
      const axiosError = error as { response?: { data?: { detail?: string } } }
      const errorDetail = axiosError.response?.data?.detail || ''

      // Backend error format: invalidticker, nodata, timeout, ratelimited (no underscores/colons)
      if (errorDetail.startsWith('invalidticker')) {
        return { ok: false, detail: `${normalized} is not a valid ticker on Yahoo Finance` }
      } else if (errorDetail.startsWith('nodata')) {
        return { ok: false, detail: `No historical data available for ${normalized}` }
      } else if (errorDetail.startsWith('timeout')) {
        return { ok: false, detail: `Validation timed out. Yahoo Finance may be slow. Please try again.` }
      } else if (errorDetail.startsWith('ratelimited')) {
        return { ok: false, detail: `Rate limited by Yahoo Finance. Please wait a moment and try again.` }
      } else {
        // Generic fallback - API may return "Failed to add {symbol} to watchlist"
        return { ok: false, detail: errorDetail || `Failed to add ${normalized} to watchlist` }
      }
    }
  }, [addSymbolToWatchlist, setSymbol])

  // Separate overlay indicators from pane indicators
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

        const mainSeries = data.metadata.series_metadata[0]
        if (!mainSeries) return;

        const seriesData = data.data[mainSeries.field]
        if (!seriesData) return;

        // Keep timestamps as numbers - they're already Unix seconds from the backend
        const timestamps = data.timestamps

        // Check if indicator has a signal series for coloring (e.g., ADXVMA_Signal)
        const signalSeries = data.metadata.series_metadata.find(s => s.role === 'signal')
        const signalData = signalSeries ? data.data[signalSeries.field] : null

        if (signalData) {
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
                mainSeries.line_color

              return { time, value: value as number, color }
            })
            .filter((p): p is { time: number; value: number; color: string } => p !== null)

          const typeKey = ind.indicatorType.name.toLowerCase()
          const showLastValue =
            indicatorSettings[ind.id]?.showLastValue ??
            indicatorSettings[typeKey]?.showLastValue ??
            true
          formattedOverlays.push({
            id: ind.id,
            data: coloredData,
            color: mainSeries.line_color,     // series default; per-point overrides it
            lineWidth: mainSeries.line_width,
            showLastValue,
          })
        } else {
          // existing non-signal path
          const formattedData = formatDataForChart(timestamps, seriesData)
          const typeKey = ind.indicatorType.name.toLowerCase()
          const showLastValue =
            indicatorSettings[ind.id]?.showLastValue ??
            indicatorSettings[typeKey]?.showLastValue ??
            true
          formattedOverlays.push({
            id: ind.id,
            data: formattedData,
            color: mainSeries.line_color,
            lineWidth: mainSeries.line_width,
            showLastValue,
          })
        }
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

        // Check if this indicator has multiple band series (e.g., BBands)
        // Band indicators have all series with role="band", no main series
        const allBands = data.metadata.series_metadata.every(s => s.role === 'band');

        if (allBands && data.metadata.series_metadata.length > 1) {
          // Multi-band indicator: render each band as a separate overlay
          data.metadata.series_metadata.forEach(series => {
            const seriesData = data.data[series.field];
            if (!seriesData) return;

            // Format this band's data
            const formattedData = data.timestamps
              .map((t, i) => {
                const value = seriesData[i];
                if (value === null || value === undefined) return null;
                return { time: t, value: value as number };
              })
              .filter((p): p is { time: number; value: number } => p !== null);

            // Use series-specific color from instance.style.seriesColors or metadata default
            const bandColor = instance.style.seriesColors?.[series.field] || series.line_color;

            formattedOverlays.push({
              id: `${instance.id}-${series.field}`,  // Unique ID per band
              data: formattedData,
              color: bandColor,
              lineWidth: instance.style.lineWidth || series.line_width || 1,
              showLastValue: instance.style.showLastValue,
              visible: instance.isVisible,
            });
          });
        } else {
          // Single-series overlay: use formatIndicatorData helper
          const formattedData = formatIndicatorData(data, undefined, instance.style.seriesColors);

          formattedOverlays.push({
            id: instance.id,
            data: formattedData,
            color: instance.style.color,
            lineWidth: instance.style.lineWidth,
            showLastValue: instance.style.showLastValue,
            visible: instance.isVisible,
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
      if (!entry || !entry.chart || !entry.series) return

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
        try {
          entry.chart.setCrosshairPosition(v, t, entry.series)
        } catch (error) {
          // Silently handle crosshair positioning errors (e.g., chart not ready, series detached)
          console.debug('[App] Failed to set crosshair position for indicator:', ind.id, error)
        }
      } else {
        try {
          entry.chart.clearCrosshairPosition?.()
        } catch (error) {
          // Ignore errors when clearing crosshair
        }
      }
    })
  }, [paneIndicators, indicatorDataMap, candles])

  const handleIntervalSelect = useCallback((newInterval: string) => {
    setChartInterval(newInterval.toLowerCase())
  }, [])

  // Phase 6: Oscillator context menu handlers
  const handleOscillatorSettings = useCallback((indicatorId: string) => {
    setOscillatorSettingsIndicatorId(indicatorId)
    setOscillatorSettingsOpen(true)
  }, [])

  const handleOscillatorRemove = useCallback((indicatorId: string) => {
    removeIndicator(indicatorId)
  }, [removeIndicator])

  const handleOscillatorApplyChanges = useCallback((indicatorId: string, style: Partial<import('./components/types/indicators').IndicatorStyle>) => {
    if (updateIndicatorStyle) {
      updateIndicatorStyle(indicatorId, style)
    }
  }, [updateIndicatorStyle])

  const handleOscillatorViewSource = useCallback((indicatorId: string) => {
    setSourceCodeIndicatorId(indicatorId)
  }, [])

  // Ref to avoid circular dependency in handleVisibleTimeRangeChange
  const fetchMoreHistoryRef = useRef<any>(null)

  const fetchMoreHistory = useCallback(async () => {
    if (isLoading || !hasMoreHistory || candles.length === 0) return

    const earliestDateStr = candles[0].timestamp
    if (lastFetchedToDateRef.current === earliestDateStr) return
    lastFetchedToDateRef.current = earliestDateStr

    setIsLoading(true)
    setIsBackfilling(true)  // Phase 5: Mark backfill in progress

    try {
        const earliestDate = new Date(earliestDateStr)
        const to = earliestDate.toISOString()

        const fromDate = new Date(earliestDate)
        // Set chunk size based on interval (must match API MAX_RANGE_DAYS in candles.py and backend providers.py)
        const daysBackMap: Record<string, number> = {
            '1m': 7, '2m': 30, '5m': 30, '15m': 30,
            '30m': 60, '1h': 60, '4h': 120,
            '1d': 365 * 5,  // 5 years - matches backend CHUNK_POLICIES
            '1wk': 365 * 10  // 10 years - matches backend CHUNK_POLICIES
        }
        const daysBack = daysBackMap[chartInterval] || 60
        fromDate.setDate(fromDate.getDate() - daysBack)
        const from = fromDate.toISOString()

        const moreCandles = await getCandles(symbol, chartInterval, from, to)

        if (moreCandles.length > 0) {
            // Phase 5: Store pending candle data instead of immediately applying
            // Indicators will be fetched using the target date range (pending + existing)
            setPendingCandleData(moreCandles)

            // Invalidate cache and increment version to trigger indicator fetch
            // Indicator hook will use target date range (computed from targetCandleDateRange)
            invalidateIndicatorCache(symbol)
            setCandleDataVersion(v => v + 1)
            // NOTE: Do NOT set isBackfilling(false) here - it remains true
            // until pending candles are applied (see useEffect below)
        } else {
            // Don't immediately give up - try a smaller window to handle edge cases
            // Some symbols might have gaps in their history
            console.log('[fetchMoreHistory] No data returned, trying smaller window...')
            const smallerFromDate = new Date(earliestDate)
            smallerFromDate.setDate(smallerFromDate.getDate() - (daysBack / 2)) // Try half the range
            const smallerFrom = smallerFromDate.toISOString()

            const retryCandles = await getCandles(symbol, chartInterval, smallerFrom, to)

            if (retryCandles.length > 0) {
                // Phase 5: Store pending candle data
                setPendingCandleData(retryCandles)

                // Invalidate cache and trigger indicator refetch
                invalidateIndicatorCache(symbol)
                setCandleDataVersion(v => v + 1)
                // NOTE: Do NOT set isBackfilling(false) here
            } else {
                // Still no data - we've likely reached the start of available history
                setHasMoreHistory(false)
                console.warn(`[fetchMoreHistory] Reached beginning of available data for ${symbol}`)
                // Clear backfill state on failure
                setIsBackfilling(false)
                setPendingCandleData(null)
            }
        }
    } catch (e) {
        console.error('Failed to fetch more history', e)
        // Clear backfill state on error
        setIsBackfilling(false)
        setPendingCandleData(null)
    } finally {
        setIsLoading(false)
    }
  }, [isLoading, hasMoreHistory, candles, symbol, chartInterval])

  // Keep ref updated
  useEffect(() => {
    fetchMoreHistoryRef.current = fetchMoreHistory
  }, [fetchMoreHistory])

  // Phase 5: Apply pending candle data only when indicators are ready
  // Gating: isLoading === false means "all fetched" (even if some are null from errors)
  // This prevents deadlock on indicator errors while still waiting for successful fetches
  useEffect(() => {
    if (pendingCandleData && !indicatorsLoading && !overlayInstancesLoading && isBackfilling) {
      // Both candles and indicators are ready - apply together
      // Helper function to merge and deduplicate candles
      const mergeAndDeduplicateCandles = (existing: Candle[], newCandles: Candle[]): Candle[] => {
        const combined = [...newCandles, ...existing]
        const unique = combined.filter((c, index, self) =>
          index === self.findIndex((t) => t.timestamp === c.timestamp)
        )
        return unique.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      }

      const merged = mergeAndDeduplicateCandles(candles, pendingCandleData)

      // Safety limit to prevent memory issues
      if (merged.length > MAX_CANDLES) {
        console.warn(`[Backfill] Reached maximum candle limit (${MAX_CANDLES})`)
        setHasMoreHistory(false)
      }

      setCandles(merged)
      setPendingCandleData(null)
      setIsBackfilling(false)  // Clear backfill state AFTER applying
    }
  }, [pendingCandleData, indicatorsLoading, overlayInstancesLoading, isBackfilling, candles])

  // WebSocket mode: Use unified scroll backfill hook
  const handleVisibleTimeRangeChange = useCallback((range: IRange<Time> | null) => {
    // Update visible range state
    if (!range) return
    setVisibleRange(range)
  }, [candles.length, symbol, hasMoreHistory, isLoading, isCandlesReady])

  // Use unified scroll backfill hook for WebSocket mode (uses LogicalRange for backfill detection)
  const wsScrollBackfillHandler = useScrollBackfill({
    candles,
    symbol,
    interval: chartInterval,
    hasMore: hasMoreHistory,
    isFetching: isLoading,
    onFetchMore: fetchMoreHistory,
  })

  // Keep time range handler for logging only (no backfill here)
  const handleWSVisibleTimeRangeChange = useCallback((range: IRange<Time> | null) => {
    handleVisibleTimeRangeChange(range)
  }, [handleVisibleTimeRangeChange])

  // Logical range handler for scroll backfill (index-based, detects when range.from < 0)
  const handleWSVisibleLogicalRangeChange = useCallback((range: LogicalRange | null) => {
    wsScrollBackfillHandler(range)
  }, [wsScrollBackfillHandler])

  return (
    <>
      <Toaster />
      {/* T018, T019: Add PerformanceReport component for development */}
      <PerformanceReport />
      <TooltipProvider>
        <Layout
            alertsBadgeCount={triggeredCount}
            userMenuContent={userProfile ? <UserMenu /> : null}
            watchlistContent={
                <WatchlistDataProvider symbols={orderedSymbols}>
                    {(watchlistState) => (
                        <Watchlist
                            items={watchlistState.entries.length > 0 ? watchlistState.entries : watchlist}
                            onAddClick={() => setIsSearchOpen(true)}
                            onRemove={handleWatchlistRemove}
                            onSelect={handleSymbolSelect}
                            onReorder={handleWatchlistReorder}
                            isRefreshing={watchlistState.isRefreshing}
                            lastUpdate={watchlistState.lastUpdate}
                        />
                    )}
                </WatchlistDataProvider>
            }
            alertsContent={
                <AlertsView
                    alerts={alerts}
                    symbol={symbol}
                    onToggleMute={async (id) => {
                        const alert = alerts.find(a => a.id === id)
                        if (!alert) return
                        try {
                            const { muteAlert, unmuteAlert } = await import('./api/alerts')
                            if (alert.status === 'muted') {
                                await unmuteAlert(Number(id))
                                setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'active' as const } : a))
                                toast.success('Alert unmuted')
                            } else {
                                await muteAlert(Number(id))
                                setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'muted' as const } : a))
                                toast.success('Alert muted')
                            }
                        } catch (error) {
                            console.error('Failed to toggle mute:', error)
                            toast.error('Failed to toggle mute')
                        }
                    }}
                    onDelete={async (id) => {
                        try {
                            if (isAuthenticated) {
                                // Authenticated: delete from backend
                                const { deleteAlert } = await import('./api/alerts')
                                await deleteAlert(Number(id))
                            } else {
                                // Guest: delete from localStorage using the same format as loadAlerts
                                const { saveAlerts } = await import('./services/layoutService')
                                const currentAlerts = alerts.filter(a => a.id !== id)
                                saveAlerts(currentAlerts)
                            }
                            setAlerts(prev => prev.filter(a => a.id !== id))
                            toast.success('Alert deleted')
                        } catch (error) {
                            console.error('Failed to delete alert:', error)
                            toast.error('Failed to delete alert')
                        }
                    }}
                    onSelect={setSymbol}
                    onTriggerDemo={(id) => setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'triggered' } : a))}
                    onAlertCreated={(newAlert) => setAlerts(prev => [...prev, newAlert])}
                />
            }
        >
            <div ref={mainViewportRef} data-testid="main-viewport" className="flex flex-col h-full w-full p-0 space-y-0">

                <Toolbar
                    symbol={symbol}
                    interval={chartInterval}
                    onIntervalSelect={handleIntervalSelect}
                    onSymbolClick={() => setIsSearchOpen(true)}
                    onIndicatorsClick={() => setIsIndicatorsOpen(true)}
                    onFullscreenToggle={toggleFullscreen}
                    activeLayout={activeLayout}
                    savedLayouts={layouts}
                    onLayoutSelect={handleLayoutSelect}
                    onLayoutSave={handleLayoutSave}
                    indicatorSettings={indicatorSettings}
                    indicators={indicators}
                    onToggleIndicatorVisibility={toggleIndicatorVisibility}
                    onToggleSeriesVisibility={toggleSeriesVisibility}
                    onToggleLevelsVisibility={toggleLevelsVisibility}
                    onToggleLastValueVisibility={toggleLastValueVisibility}
                    onRemoveIndicator={(indicatorIdOrName) => {
                        // indicatorIdOrName can be either:
                        // 1. A unique pane ID like "indicator-1234567890-abc123"
                        // 2. A type name like "sma" (from activeLayout.activeIndicators)

                        // First, try to find an indicator with matching ID
                        const matchingById = indicators.find(ind => ind.id === indicatorIdOrName);

                        if (matchingById) {
                            // It's a unique ID, remove directly
                            removeIndicator(indicatorIdOrName);
                            return;
                        }

                        // It's a type name, find the first indicator with matching type (case-insensitive)
                        const matchingByType = indicators.find(ind =>
                            ind.indicatorType.name.toLowerCase() === indicatorIdOrName.toLowerCase()
                        );

                        if (matchingByType) {
                            removeIndicator(matchingByType.id);
                        } else {
                            console.warn(`Could not find indicator to remove: ${indicatorIdOrName}`);
                        }
                    }}
                    dataMode={dataMode}
                    onDataModeToggle={handleDataModeToggle}
                    onManualRefresh={handleManualRefresh}
                    onLayoutUpdate={handleLayoutUpdate}
                />

                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="bg-[#131722] px-2 py-1 flex items-center justify-between">
                            <OHLCDisplayWithTime candle={crosshairCandle} interval={chartInterval} />
                        </div>

                        <div style={{ height: mainHeight }} className="shrink-0 bg-slate-900 border-b-0 border-slate-800 relative min-h-0 overflow-hidden w-full">

                        {/* Feature 008: Overlay indicator legend - minimal style matching IndicatorPane */}
                        {overlayInstances.length > 0 && (
                          <div className="absolute left-2 top-1 z-10 flex gap-2 text-xs pointer-events-none">
                            <OverlayIndicatorLegend
                              instances={overlayInstances}
                              symbol={symbol}
                              interval={chartInterval}
                              onToggleVisibility={(instanceId) => toggleVisibility(instanceId)}
                              onRemove={(instanceId) => removeOverlayInstance(instanceId)}
                              onSettings={(instanceId) => {
                                setSettingsIndicatorId(instanceId)
                                setIsSettingsOpen(true)
                              }}
                              onViewSource={(instanceId) => setSourceCodeIndicatorId(instanceId)}
                              onAlertCreated={async () => {
                                // Refresh alerts - handle both authenticated and guest modes
                                try {
                                  if (isAuthenticated) {
                                    // Authenticated: fetch all alerts from backend
                                    const { listAlerts, getAlertNotificationSettings } = await import('./api/alerts');
                                    const backendAlerts = await listAlerts();

                                    // Fetch notification settings for all alerts in parallel
                                    const notifPromises = backendAlerts.map(async (alert) => {
                                      try {
                                        const settings = await getAlertNotificationSettings(String(alert.id));
                                        return { alertId: alert.id, settings };
                                      } catch {
                                        return { alertId: alert.id, settings: null };
                                      }
                                    });
                                    const notifResults = await Promise.all(notifPromises);
                                    const settingsMap = new Map(notifResults.map(r => [r.alertId, r.settings]));

                                    // Convert backend format to frontend format
                                    const convertedAlerts = backendAlerts.map(a => ({
                                      id: String(a.id),
                                      symbol: a.symbol || '',
                                      condition: a.condition,
                                      threshold: a.threshold,
                                      status: a.is_active ? 'active' as const : 'muted' as const,
                                      createdAt: a.created_at,
                                      interval: a.interval,
                                      indicator_name: a.indicator_name,
                                      indicator_field: a.indicator_field,
                                      indicator_params: a.indicator_params,
                                      enabled_conditions: a.enabled_conditions,
                                      messages: a.messages,
                                      notificationSettings: settingsMap.get(a.id) ?? undefined
                                    }))
                                    setAlerts(convertedAlerts);
                                  } else {
                                    // Guest: get from localStorage (polishedcharts_data format)
                                    const { getGuestAlerts } = await import('./api/alerts');
                                    const guestAlerts = getGuestAlerts();
                                    // Convert guest format to frontend format
                                    const convertedAlerts = guestAlerts.map(a => ({
                                      id: a.uuid,
                                      symbol: a.symbol,
                                      condition: a.condition.replace('-', '_'),
                                      threshold: a.target,
                                      status: a.enabled ? 'active' as const : 'muted' as const,
                                      createdAt: a.created_at,
                                      interval: undefined,
                                      indicator_name: undefined,
                                      indicator_field: undefined,
                                      indicator_params: undefined,
                                      enabled_conditions: undefined,
                                      messages: undefined
                                    }))
                                    setAlerts(convertedAlerts);
                                  }
                                } catch (error) {
                                  console.error('Failed to refresh alerts:', error);
                                }
                              }}
                              crosshairTime={crosshairTime}
                              seriesDataMap={overlaySeriesDataMap}
                            />
                          </div>
                        )}
                            {/* T026: Conditional rendering based on data mode */}
                            {dataMode === 'polling' ? (
                                /* Polling mode: Use CandleDataProvider wrapper */
                                <CandleDataProvider symbol={symbol} interval={chartInterval}>
                                    {(candleState) => {
                                        // T072: Store the refresh function for manual refresh button
                                        candleRefreshRef.current = candleState.refresh
                                        // Update data version state for indicator refetch on backfill
                                        setCandleDataVersion(candleState.dataVersion)

                                        // Polling mode: Use unified scroll backfill hook (uses LogicalRange)
                                        const pollingScrollBackfillHandler = useScrollBackfill({
                                            candles: candleState.candles,
                                            symbol,
                                            interval: chartInterval,
                                            hasMore: candleState.hasMore,
                                            isFetching: candleState.isRefreshing,
                                            onFetchMore: candleState.fetchCandlesWithRange,
                                        })

                                        // Keep logging for debugging (time range only)
                                        const handlePollingScrollRangeChange = (range: IRange<Time> | null) => {
                                            console.log('[Scroll] handlePollingScrollRangeChange called', {
                                                range,
                                                candlesLength: candleState.candles.length,
                                                hasMore: candleState.hasMore,
                                                isRefreshing: candleState.isRefreshing
                                            })
                                        }

                                        // Logical range handler for scroll backfill (index-based)
                                        const handlePollingScrollLogicalRangeChange = (range: LogicalRange | null) => {
                                            console.log('[Scroll] handlePollingScrollLogicalRangeChange called', {
                                                range,
                                                candlesLength: candleState.candles.length,
                                                hasMore: candleState.hasMore,
                                            })
                                            pollingScrollBackfillHandler(range)
                                        }

                                        return (
                                        <>
                                            {/* T027: Loading indicator display */}
                                            {candleState.isLoading && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                                                    <div className="flex flex-col items-center gap-3">
                                                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                                                        <span className="text-slate-400 text-sm">Loading chart data...</span>
                                                    </div>
                                                </div>
                                            )}
                                            {/* T037: Visual refresh indicator during background updates */}
                                            {candleState.isRefreshing && !candleState.isLoading && (
                                                <div className="absolute top-2 right-2 z-10">
                                                    <div className="flex items-center gap-2 bg-slate-800 px-2 py-1 rounded">
                                                        <div className="animate-spin rounded-full h-3 w-3 border border-blue-400 border-t-transparent"></div>
                                                        <span className="text-xs text-slate-400">Updating...</span>
                                                        {/* T029: Last update timestamp display */}
                                                        {candleState.lastUpdate && (
                                                            <span className="text-xs text-slate-500">
                                                                {candleState.lastUpdate.toLocaleTimeString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                            {/* T029: Last update timestamp display (when not refreshing) */}
                                            {!candleState.isRefreshing && !candleState.isLoading && candleState.lastUpdate && (
                                                <div className="absolute top-2 right-2 z-10">
                                                    <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded">
                                                        Updated: {candleState.lastUpdate.toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            )}
                                            {/* T028: Error display */}
                                            {candleState.error && !candleState.isLoading && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                                                    <div className="flex flex-col items-center gap-3 text-center px-4">
                                                        <div className="text-red-400 text-sm font-medium">{candleState.error}</div>
                                                        <button
                                                            onClick={candleState.refresh}
                                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                                                        >
                                                            Retry
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                            {/* T049: Error boundary for indicator rendering failures (polling mode) */}
                                            <ErrorBoundary fallback={
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                                                    <div className="text-center">
                                                        <div className="text-red-400 text-sm mb-2">Chart rendering failed</div>
                                                        <button
                                                            onClick={() => window.location.reload()}
                                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                                                        >
                                                            Reload
                                                        </button>
                                                    </div>
                                                </div>
                                            }>
                                                <ChartComponent
                                                    key={`${symbol}-${chartInterval}-polling`}
                                                    symbol={symbol}
                                                    candles={candleState.candles}
                                                    width={dimensions.width}
                                                    height={mainHeight}
                                                    onTimeScaleInit={setMainTimeScale}
                                                    onCrosshairMove={handleMainCrosshairMove}
                                                    overlays={mergedOverlays}
                                                    onVisibleTimeRangeChange={handlePollingScrollRangeChange}
                                                    onVisibleLogicalRangeChange={handlePollingScrollLogicalRangeChange}
                                                    showVolume={true}
                                                    showLastPrice={true}
                                                />
                                            </ErrorBoundary>
                                        </>
                                        )
                                    }}
                                </CandleDataProvider>
                            ) : (
                                /* WebSocket mode: Use existing behavior */
                                <>
                                    {/* T101: Loading state - spinner while fetching initial data */}
                                    {/* Use isEverythingReady (candles + indicators) to prevent indicator jump */}
                                    {!isEverythingReady && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent"></div>
                                                <span className="text-slate-400 text-sm">Loading chart data...</span>
                                            </div>
                                        </div>
                                    )}
                                    {/* T102: Error state - show error message */}
                                    {error && isEverythingReady && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                                            <div className="flex flex-col items-center gap-3 text-center px-4">
                                                <div className="text-red-400 text-sm font-medium">{error}</div>
                                                <button
                                                    onClick={() => {
                                                        setError(null)
                                                        // Trigger refetch by changing symbol then changing back
                                                        const currentSymbol = symbol
                                                        setSymbol('')
                                                        setTimeout(() => setSymbol(currentSymbol), 0)
                                                    }}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                                                >
                                                    Retry
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    {/* T049: Error boundary for indicator rendering failures */}
                                    <ErrorBoundary fallback={
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10">
                                            <div className="text-center">
                                                <div className="text-red-400 text-sm mb-2">Chart rendering failed</div>
                                                <button
                                                    onClick={() => window.location.reload()}
                                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                                                >
                                                    Reload
                                                </button>
                                            </div>
                                        </div>
                                    }>
                                        <ChartComponent
                                            key={`${symbol}-${chartInterval}`}
                                            symbol={symbol}
                                            candles={candles}
                                            width={dimensions.width}
                                            height={mainHeight}
                                            onTimeScaleInit={setMainTimeScale}
                                            onCrosshairMove={handleMainCrosshairMove}
                                            overlays={mergedOverlays}
                                            onVisibleTimeRangeChange={handleWSVisibleTimeRangeChange}
                                            onVisibleLogicalRangeChange={handleWSVisibleLogicalRangeChange}
                                            showVolume={true}
                                            showLastPrice={true}
                                        />
                                    </ErrorBoundary>
                                </>
                            )}
                        </div>

                        {/* Dynamically render indicator panes */}
                        {effectiveVisibleOscillators.length > 0 && (
                            <div className="flex flex-col gap-0 min-h-0 w-full">
                                {effectiveVisibleOscillators.map((ind, index) => {
                                    const data = indicatorDataMap[ind.id] ?? undefined
                                    const isVisible = ind.displaySettings.visible && indicatorSettings[ind.id]?.visible !== false
                                    const isLast = index === effectiveVisibleOscillators.length - 1

                                    if (!isVisible) return null
                                    // Don't filter out indicators that don't have data yet - they might be loading

                                    const typeKey = ind.indicatorType.name.toLowerCase()
                                    const showLastValue =
                                      indicatorSettings[ind.id]?.showLastValue ??
                                      indicatorSettings[typeKey]?.showLastValue ??
                                      true

                                    return (
                                        <div
                                            key={ind.id}
                                            className="bg-slate-900 p-1 border border-t-0 border-slate-800 w-full relative shrink-0"
                                            style={{
                                                borderRadius: isLast ? '0 0 0.5rem 0.5rem' : '0',
                                                height: eachPaneHeight  // Feature 005: Explicit pixel height instead of flex-1
                                            }}
                                        >
                                            <IndicatorPane
                                                name={ind.name}
                                                displayName={ind.name}
                                                indicatorId={ind.id}
                                                style={ind.style}
                                                symbol={symbol}
                                                interval={chartInterval}
                                                width={dimensions.width}
                                                height={eachPaneHeight}
                                                onTimeScaleInit={(ts) => {
                                                    if (ts) {
                                                        indicatorTimeScalesRef.current.set(ind.id, ts)
                                                        if (mainTimeScale) {
                                                            const range = mainTimeScale.getVisibleLogicalRange()
                                                            if (range) ts.setVisibleLogicalRange(range)
                                                        }
                                                    } else {
                                                        indicatorTimeScalesRef.current.delete(ind.id)
                                                    }
                                                }}
                                                onChartInit={(chart, series) => {
                                                    indicatorChartsRef.current.set(ind.id, { chart, series });
                                                }}
                                                candles={candles}
                                                indicatorData={data}
                                                crosshairTime={crosshairTime}
                                                showLastValue={showLastValue}
                                                onSettingsClick={() => handleOscillatorSettings(ind.id)}
                                                onViewSource={() => handleOscillatorViewSource(ind.id)}
                                                onRemove={() => removeIndicator(ind.id)}
                                                onAlertCreated={async () => {
                                                    // Refresh alerts - handle both authenticated and guest modes
                                                    try {
                                                        if (isAuthenticated) {
                                                          // Authenticated: fetch all alerts from backend
                                                          const { listAlerts, getAlertNotificationSettings } = await import('./api/alerts');
                                                          const backendAlerts = await listAlerts();

                                                          // Fetch notification settings for all alerts in parallel
                                                          const notifPromises = backendAlerts.map(async (alert) => {
                                                            try {
                                                              const settings = await getAlertNotificationSettings(String(alert.id));
                                                              return { alertId: alert.id, settings };
                                                            } catch {
                                                              return { alertId: alert.id, settings: null };
                                                            }
                                                          });
                                                          const notifResults = await Promise.all(notifPromises);
                                                          const settingsMap = new Map(notifResults.map(r => [r.alertId, r.settings]));

                                                          // Convert backend format to frontend format
                                                          const convertedAlerts = backendAlerts.map(a => ({
                                                            id: String(a.id),
                                                            symbol: a.symbol || '',
                                                            condition: a.condition,
                                                            threshold: a.threshold,
                                                            status: a.is_active ? 'active' as const : 'muted' as const,
                                                            createdAt: a.created_at,
                                                            interval: a.interval,
                                                            indicator_name: a.indicator_name,
                                                            indicator_field: a.indicator_field,
                                                            indicator_params: a.indicator_params,
                                                            enabled_conditions: a.enabled_conditions,
                                                            messages: a.messages,
                                                            notificationSettings: settingsMap.get(a.id) ?? undefined
                                                          }))
                                                          setAlerts(convertedAlerts);
                                                        } else {
                                                          // Guest: get from localStorage (polishedcharts_data format)
                                                          const { getGuestAlerts } = await import('./api/alerts');
                                                          const guestAlerts = getGuestAlerts();
                                                          // Convert guest format to frontend format
                                                          const convertedAlerts = guestAlerts.map(a => ({
                                                            id: a.uuid,
                                                            symbol: a.symbol,
                                                            condition: a.condition.replace('-', '_'),
                                                            threshold: a.target,
                                                            status: a.enabled ? 'active' as const : 'muted' as const,
                                                            createdAt: a.created_at,
                                                            interval: undefined,
                                                            indicator_name: undefined,
                                                            indicator_field: undefined,
                                                            indicator_params: undefined,
                                                            enabled_conditions: undefined,
                                                            messages: undefined
                                                          }))
                                                          setAlerts(convertedAlerts);
                                                        }
                                                    } catch (error) {
                                                        console.error('Failed to refresh alerts:', error);
                                                    }
                                                }}
                                                params={ind.indicatorType.params}
                                                alerts={alerts}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
            </div>
        </Layout>

        <IndicatorDialog
          open={isIndicatorsOpen}
          onOpenChange={setIsIndicatorsOpen}
          onAddOverlayInstance={(indicatorName, params) => addOverlayInstance(indicatorName, params)}
        />

        {/* T047: Indicator settings dialog for overlay indicators */}
        <IndicatorSettingsDialog
          open={isSettingsOpen}
          onOpenChange={setIsSettingsOpen}
          indicator={overlayInstances.find(i => i.id === settingsIndicatorId) || null}
          indicatorMetadata={settingsIndicatorId ? (() => {
            const instance = overlayInstances.find(i => i.id === settingsIndicatorId);
            if (!instance) return undefined;
            const cached = indicatorMetadataCache[instance.indicatorType.name];
            if (!cached) return undefined;

            // Merge cached metadata with calculation metadata
            // Cached has array format parameters, calculation metadata doesn't have parameters
            const merged = {
              ...cached,
              ...overlayInstanceDataMap[settingsIndicatorId]?.metadata,
            };

            // Ensure parameters remain in array format (calculation metadata doesn't override)
            if (cached.parameters && !Array.isArray(merged.parameters)) {
              merged.parameters = cached.parameters;
            }

            return merged;
          })() : undefined}
          onApplyChanges={(instanceId, updates) => {
            updateInstance(instanceId, updates);
          }}
          onRemove={(instanceId) => {
            removeOverlayInstance(instanceId);
            setIsSettingsOpen(false);
          }}
        />

        {/* Phase 6: Oscillator settings dialog */}
        <OscillatorSettingsDialog
          open={oscillatorSettingsOpen}
          onOpenChange={setOscillatorSettingsOpen}
          indicator={indicators.find(i => i.id === oscillatorSettingsIndicatorId) || null}
          indicatorMetadata={oscillatorSettingsIndicatorId ? (() => {
            const indicator = indicators.find(i => i.id === oscillatorSettingsIndicatorId);
            if (!indicator) {
              return undefined;
            }

            const indicatorName = indicator.indicatorType.name;

            const indicatorInfo = indicatorMetadataCache[indicatorName];
            if (!indicatorInfo || !indicatorInfo.parameters) {
              return undefined;
            }

            // Parameters are already normalized to array format in indicatorMetadataCache
            // Just use them directly (avoid double-transformation)
            const parametersArray = Array.isArray(indicatorInfo.parameters)
              ? indicatorInfo.parameters
              : Object.entries(indicatorInfo.parameters).map(([name, def]: [string, any]) => ({
                  name,
                  type: def.type,
                  default: def.default,
                  min: def.min,
                  max: def.max,
                  step: def.step,
                  description: def.description,
                }));

            return {
              ...(indicatorInfo.metadata || {}),
              parameters: parametersArray,
              series_metadata: indicatorDataMap[oscillatorSettingsIndicatorId]?.metadata.series_metadata,
            } as IndicatorMetadata & { parameters: ParameterDefinition[] };
          })() : undefined}
          onStyleChange={handleOscillatorApplyChanges}
          onParamsChange={(indicatorId, params) => {
            updateIndicatorParams(indicatorId, params);
          }}
          onVisibilityToggle={(indicatorId) => {
            // Use existing toggleIndicator from context
            const indicator = indicators.find(ind => ind.id === indicatorId);
            if (indicator) {
              // The toggleIndicator function exists in the context but we need to import it
              // For now, we'll use the indicatorSettings override
              setIndicatorSettings(prev => ({
                ...prev,
                [indicatorId]: {
                  ...prev[indicatorId],
                  visible: prev[indicatorId]?.visible === false ? true : false
                }
              }));
            }
          }}
          onRemove={handleOscillatorRemove}
        />

        {/* Feature 008: Source code modal for overlay indicators */}
        <SourceCodeModal
          open={sourceCodeIndicatorId !== null}
          onOpenChange={(open) => !open && setSourceCodeIndicatorId(null)}
          indicator={overlayInstances.find(i => i.id === sourceCodeIndicatorId) || null}
        />

        {/* Feature 009: Watchlist search dialog */}
        <WatchlistSearch
          open={isSearchOpen}
          onOpenChange={setIsSearchOpen}
          onSelectSymbol={handleSearchSelectSymbol}
        />

        {/* Feature 011: Auth dialog */}
        <AuthDialog
          open={isAuthDialogOpen}
          onOpenChange={setIsAuthDialogOpen}
          defaultTab={authDialogDefaultTab}
        />
      </TooltipProvider>
    </>
  )
}

/**
 * Helper function to get interval duration in milliseconds.
 * Used for calculating fixed candle count initial load and backfill.
 */
function getIntervalMilliseconds(interval: string): number {
  const map: Record<string, number> = {
    '1m': 60000, '2m': 120000, '5m': 300000, '15m': 900000,
    '30m': 1800000, '1h': 3600000, '4h': 14400000,
    '1d': 86400000, '1wk': 604800000
  }
  return map[interval] || 86400000
}

// Main App component - manages symbol state and wraps with IndicatorProvider
function App() {
  // Feature 011: Auth state - use auth to determine landing vs main app
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const [isAuthDialogOpen, setIsAuthDialogOpen] = useState(false)
  const [authDialogDefaultTab, setAuthDialogDefaultTab] = useState<'sign-in' | 'sign-up'>('sign-in')

  // Feature 009 + 011: Initialize symbol from watchlist after auth
  // Use watchlist's first symbol if available, otherwise SPY (S&P 500 ETF - popular default)
  const watchlistData = useWatchlist(isAuthenticated)
  const [symbol, setSymbol] = useState(() => {
    // Initialize with placeholder - actual symbol set by useInitialSymbolFromWatchlist
    return 'LOADING'
  })

  // Suppress lightweight-charts errors that occur during rapid symbol changes or zoom on empty charts
  // These are internal lightweight-charts errors that don't affect functionality but clutter the console
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      // Check if error is from lightweight-charts
      if (event.message.includes('Value is null') &&
          event.filename && event.filename.includes('lightweight-charts')) {
        // Suppress the error - it's a known edge case in lightweight-charts
        event.preventDefault()
        console.debug('[Chart] Suppressed lightweight-charts error (edge case during zoom/symbol change)')
      }
    }

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if error is from lightweight-charts
      if (event.reason instanceof Error &&
          event.reason.message.includes('Value is null') &&
          event.reason.stack && event.reason.stack.includes('lightweight-charts')) {
        // Suppress the error
        event.preventDefault()
        console.debug('[Chart] Suppressed lightweight-charts promise rejection (edge case during zoom/symbol change)')
      }
    }

    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Initialize symbol from watchlist using reusable hook pattern
  // Prevents race conditions and ensures single initialization
  useInitialSymbolFromWatchlist(
    { isLoading: watchlistData.isLoading, symbols: watchlistData.symbols },
    symbol,
    setSymbol
  )

  // Show loading state while auth is initializing OR watchlist is loading
  if (authLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    )
  }

  // Show landing page for unauthenticated users
  if (!isAuthenticated) {
    return (
      <>
        <LandingPage
          onOpenChart={() => {
            // Allow guest access to chart - just set authenticated state locally
            // This bypasses auth but keeps the landing->app flow working
          }}
          onLoginClick={() => {
            // Open auth dialog with sign-in tab
            setAuthDialogDefaultTab('sign-in')
            setIsAuthDialogOpen(true)
          }}
          onGoogleClick={() => {
            // Open auth dialog with sign-in tab (user can choose Google)
            setAuthDialogDefaultTab('sign-in')
            setIsAuthDialogOpen(true)
          }}
          onEmailClick={() => {
            // Open auth dialog with sign-in tab (user can choose email)
            setAuthDialogDefaultTab('sign-in')
            setIsAuthDialogOpen(true)
          }}
        />
        <AuthDialog
          open={isAuthDialogOpen}
          onOpenChange={setIsAuthDialogOpen}
          defaultTab={authDialogDefaultTab}
        />
      </>
    );
  }

  // Authenticated users - show loading while watchlist loads
  if (symbol === 'LOADING' || watchlistData.isLoading) {
    return <div className="flex items-center justify-center h-screen text-slate-400">Loading chart...</div>
  }

  // Authenticated users see the main app
  return (
    <IndicatorProvider>
      <AppContent
        symbol={symbol}
        setSymbol={setSymbol}
      />
    </IndicatorProvider>
  )
}

export default App