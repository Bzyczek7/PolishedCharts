# TradingAlert Project Purpose

TradingAlert is a TradingView-style web application for financial market analysis with unlimited alerting capabilities.

## Core Features

1. **Real-time Market Data Display**
   - Interactive candlestick charts using lightweight-charts
   - Multiple timeframe support (1M, 5M, 15M, 30M, 1H, 4H, 1D, 1W, 1MN)
   - Support for stocks, crypto, and other financial instruments

2. **Technical Indicators**
   - Standard indicators: SMA, EMA, RSI, MACD, Bollinger Bands, ATR
   - Custom indicators: TDFI (Trend Direction Force Index), cRSI (Composite RSI), ADXVMA
   - Parameterized indicator instances with automatic unique naming
   - Configurable indicator settings (colors, periods, visibility)

3. **Alert System**
   - Unlimited alerts per user
   - Price-based alerts (above, below, cross up/down)
   - Indicator-based alerts (indicator crossovers, threshold breaches)
   - Custom indicator alerts (TDFI, cRSI, ADXVMA signals)
   - Throttling options (none, once per bar, once per day)
   - Alert trigger history and statistics

4. **Watchlist Management**
   - Symbol search and ticker universe
   - Add/remove symbols from watchlist
   - Market hours gating for equity symbols

## Architecture

- **Backend**: FastAPI (Python 3.11+)
- **Frontend**: React 19 + TypeScript 5.9 + Vite
- **Database**: PostgreSQL with SQLAlchemy (async)
- **Caching**: Redis for real-time data and WebSocket pub/sub
- **Charts**: Lightweight Charts 5.1.0
- **Market Data**: yfinance (primary), with provider abstraction for flexibility

## Key Design Patterns

1. **Provider Pattern**: Abstract `MarketDataProvider` for pluggable data sources
2. **Registry Pattern**: `IndicatorRegistry` for dynamic indicator registration
3. **Service Layer**: Separation of business logic from API routes
4. **Async/Await**: Full async stack for optimal performance
5. **Worker Pattern**: Background workers for data polling and alert evaluation
