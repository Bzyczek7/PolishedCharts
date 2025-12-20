# TradingAlert Implementation Guide

## Table of Contents
1. [Project Structure](#project-structure)
2. [Backend Implementation](#backend-implementation)
3. [Database Schema](#database-schema)
4. [Market Data Integration](#market-data-integration)
5. [Custom Indicators](#custom-indicators)
6. [Alert Engine](#alert-engine)
7. [Frontend Implementation](#frontend-implementation)
8. [Docker Configuration](#docker-configuration)
9. [Deployment](#deployment)
10. [Testing Strategy](#testing-strategy)

## Project Structure

```
TradingAlert/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI entry point
│   │   ├── config.py              # Settings and environment
│   │   ├── database.py            # DB connection and session
│   │   ├── dependencies.py        # FastAPI dependencies
│   │   ├── models/                # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── market.py
│   │   │   ├── alert.py
│   │   │   └── watchlist.py
│   │   ├── schemas/               # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── user.py
│   │   │   ├── market.py
│   │   │   ├── alert.py
│   │   │   └── watchlist.py
│   │   ├── api/                   # API routers
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── market.py
│   │   │   ├── indicators.py
│   │   │   ├── alerts.py
│   │   │   └── watchlist.py
│   │   ├── services/              # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── market_data_service.py
│   │   │   ├── market_data_provider.py  # Data provider abstraction
│   │   │   ├── indicator_service.py
│   │   │   ├── alert_service.py
│   │   │   └── eodhd_client.py
│   │   ├── indicators/            # Indicator implementations
│   │   │   ├── __init__.py
│   │   │   ├── base.py            # Base indicator interface
│   │   │   ├── standard/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── sma.py
│   │   │   │   ├── ema.py
│   │   │   │   ├── rsi.py
│   │   │   │   ├── macd.py
│   │   │   │   └── atr.py
│   │   │   └── custom/
│   │   │       ├── __init__.py
│   │   │       ├── tdfi.py
│   │   │       ├── crsi.py
│   │   │       └── adxvma.py
│   │   ├── workers/               # Background workers
│   │   │   ├── __init__.py
│   │   │   ├── alert_worker.py
│   │   │   └── market_data_worker.py
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── security.py
│   │       └── helpers.py
│   ├── tests/
│   ├── alembic/                   # Database migrations
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── charts/
│   │   │   │   ├── TradingChart.tsx
│   │   │   │   ├── ChartControls.tsx
│   │   │   │   └── IndicatorPanel.tsx
│   │   │   ├── alerts/
│   │   │   ├── watchlist/
│   │   │   └── auth/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── store/
│   │   ├── utils/
│   │   ├── types/
│   │   ├── App.tsx
│   │   └── index.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── docker-compose.yml
├── docker-compose.prod.yml
├── nginx.conf
└── README.md
```

## Backend Implementation

### 1. FastAPI Main Application

```python
# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from contextlib import asynccontextmanager
import uvicorn

from app.config import settings
from app.database import engine, Base
from app.api import auth, market, indicators, alerts, watchlist
from app.services.alert_service import AlertService
from app.services.market_data_service import MarketDataService


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    # Create database tables
    Base.metadata.create_all(bind=engine)

    # Initialize services
    market_service = MarketDataService()
    alert_service = AlertService()

    # Start background workers
    # (Will be separate Docker service in production)

    yield

    # Shutdown
    pass


app = FastAPI(
    title="TradingAlert API",
    description="TradingView-style web app with unlimited alerts",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["authentication"])
app.include_router(market.router, prefix="/api/markets", tags=["market data"])
app.include_router(indicators.router, prefix="/api/indicators", tags=["indicators"])
app.include_router(alerts.router, prefix="/api/alerts", tags=["alerts"])
app.include_router(watchlist.router, prefix="/api/watchlist", tags=["watchlist"])

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG
    )
```

### 2. Configuration

```python
# backend/app/config.py
from pydantic_settings import BaseSettings
from typing import List, Optional
import os


class Settings(BaseSettings):
    # App
    DEBUG: bool = False
    SECRET_KEY: str

    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost/trading_alert"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Market Data
    EODHD_API_KEY: str
    MARKET_DATA_PROVIDER: str = "eodhd"  # For future flexibility

    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000"]

    # JWT
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Alert Engine
    ALERT_WORKER_CONCURRENCY: int = 4
    ALERT_EVALUATION_INTERVAL_SECONDS: int = 60  # For 15-min delayed data

    # WebSocket
    WS_HEARTBEAT_INTERVAL: int = 30

    class Config:
        env_file = ".env"


settings = Settings()
```

### 3. Database Models

```python
# backend/app/models/market.py
from sqlalchemy import Column, Integer, String, Date, DECIMAL, BigInteger, ForeignKey, Index
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM
from app.database import Base
import enum


class Timeframe(str, enum.Enum):
    M1 = "1M"
    M5 = "5M"
    M15 = "15M"
    M30 = "30M"
    H1 = "1H"
    H4 = "4H"
    D1 = "1D"
    W1 = "1W"
    MN1 = "1MN"


class Symbol(Base):
    __tablename__ = "symbols"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(255))
    exchange = Column(String(50))
    sector = Column(String(100))
    industry = Column(String(100))
    currency = Column(String(10), default="USD")

    # Relationships
    ohlc_data = relationship("OHLC", back_populates="symbol")
    alerts = relationship("Alert", back_populates="symbol")


class OHLC(Base):
    __tablename__ = "ohlc_data"

    # Composite primary key
    symbol_id = Column(Integer, ForeignKey("symbols.id"), primary_key=True)
    timeframe = Column(ENUM(Timeframe), primary_key=True)
    date = Column(Date, primary_key=True)

    # Price data
    open = Column(DECIMAL(10, 2), nullable=False)
    high = Column(DECIMAL(10, 2), nullable=False)
    low = Column(DECIMAL(10, 2), nullable=False)
    close = Column(DECIMAL(10, 2), nullable=False)
    volume = Column(BigInteger, nullable=False)

    # Metadata
    adjusted_close = Column(DECIMAL(10, 2))

    # Relationships
    symbol = relationship("Symbol", back_populates="ohlc_data")

    # Index for efficient latest-bar queries
    __table_args__ = (
        Index('idx_symbol_timeframe_date', 'symbol_id', 'timeframe', 'date.desc'),
    )
```

```python
# backend/app/models/alert.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON, DECIMAL
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import ENUM, UUID
from datetime import datetime
import uuid
import enum

from app.database import Base


class AlertConditionType(str, enum.Enum):
    PRICE_ABOVE = "price_above"
    PRICE_BELOW = "price_below"
    PRICE_CROSS_UP = "price_cross_up"
    PRICE_CROSS_DOWN = "price_cross_down"
    INDICATOR_CROSS_UP = "indicator_cross_up"
    INDICATOR_CROSS_DOWN = "indicator_cross_down"
    INDICATOR_ABOVE = "indicator_above"
    INDICATOR_BELOW = "indicator_below"
    CUSTOM_TDFI = "custom_tdfi"
    CUSTOM_CRSI = "custom_crsi"
    CUSTOM_ADXVMA = "custom_adxvma"


class AlertThrottle(str, enum.Enum):
    NONE = "none"
    ONCE_PER_BAR = "once_per_bar"
    ONCE_PER_DAY = "once_per_day"


class AlertDirection(str, enum.Enum):
    LONG = "long"
    SHORT = "short"
    BOTH = "both"


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # User and symbol
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    symbol_id = Column(Integer, ForeignKey("symbols.id"), nullable=False)

    # Basic info
    name = Column(String(255), nullable=False)
    description = Column(String(500))

    # Normalized condition fields (for fast filtering)
    condition_type = Column(ENUM(AlertConditionType), nullable=False)
    indicator_type = Column(String(50))  # 'SMA', 'RSI', 'TDFI', etc.
    timeframe = Column(String(10))  # '1D', '4H', etc.
    direction = Column(ENUM(AlertDirection), default=AlertDirection.BOTH)

    # Condition details (JSON for complex conditions)
    parameters = Column(JSON, nullable=False)  # {"threshold": 100, "period": 14}

    # Throttling
    throttle = Column(ENUM(AlertThrottle), default=AlertThrottle.ONCE_PER_BAR)
    last_triggered_at = Column(DateTime(timezone=True))

    # Status
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="alerts")
    symbol = relationship("Symbol", back_populates="alerts")
    triggers = relationship("AlertTrigger", back_populates="alert")

    # Indexes for efficient alert lookups
    __table_args__ = (
        Index('idx_active_alerts', 'is_active', 'symbol_id', 'timeframe'),
        Index('idx_user_alerts', 'user_id', 'is_active'),
    )


class AlertTrigger(Base):
    __tablename__ = "alert_triggers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    alert_id = Column(UUID(as_uuid=True), ForeignKey("alerts.id"), nullable=False)

    # Trigger data
    triggered_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    trigger_value = Column(DECIMAL(10, 2))
    metadata = Column(JSON)  # Full market snapshot at trigger time

    # Relationships
    alert = relationship("Alert", back_populates="triggers")
```

### 4. Market Data Provider Abstraction

```python
# backend/app/services/market_data_provider.py
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any
from datetime import date, datetime
import pandas as pd


class MarketDataProvider(ABC):
    """Abstract base class for market data providers"""

    @abstractmethod
    async def get_symbols(self, exchange: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get list of available symbols"""
        pass

    @abstractmethod
    async def search_symbols(self, query: str) -> List[Dict[str, Any]]:
        """Search for symbols by name or ticker"""
        pass

    @abstractmethod
    async def get_exchanges(self) -> List[Dict[str, Any]]:
        """Get list of available exchanges"""
        pass

    @abstractmethod
    async def get_historical_data(
        self,
        symbol: str,
        from_date: date,
        to_date: Optional[date] = None,
        timeframe: str = "1D"
    ) -> pd.DataFrame:
        """Get historical OHLCV data"""
        pass

    @abstractmethod
    async def get_real_time_quote(self, symbol: str) -> Dict[str, Any]:
        """Get real-time (or delayed) quote"""
        pass

    @abstractmethod
    async def validate_symbol(self, symbol: str) -> bool:
        """Check if symbol exists and is tradeable"""
        pass


class EODHDProvider(MarketDataProvider):
    """EODHD API implementation"""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://eodhd.com/api"

    async def get_symbols(self, exchange: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get symbols from EODHD"""
        # Implementation using EODHD API
        pass

    async def get_historical_data(
        self,
        symbol: str,
        from_date: date,
        to_date: Optional[date] = None,
        timeframe: str = "1D"
    ) -> pd.DataFrame:
        """Get OHLCV data from EODHD"""
        # Implementation with proper format conversion
        # Return DataFrame with columns: date, open, high, low, close, volume
        pass

    # ... implement other methods


class MarketDataService:
    """Service that wraps the market data provider"""

    def __init__(self, provider: MarketDataProvider):
        self.provider = provider

    async def update_symbol_data(self, symbol_id: int):
        """Update historical data for a symbol"""
        # Get symbol from database
        # Fetch latest data from provider
        # Store in database
        # Update cache
        pass

    async def get_latest_bar(self, symbol: str, timeframe: str = "1D"):
        """Get the most recent bar, checking cache first"""
        # Check Redis cache
        # Fall back to database
        # Update cache if needed
        pass
```

## Database Schema

### Migration File Example

```sql
-- alembic/versions/001_initial_schema.py

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Symbols table
CREATE TABLE symbols (
    id SERIAL PRIMARY KEY,
    ticker VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    exchange VARCHAR(50),
    sector VARCHAR(100),
    industry VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- OHLC data table
CREATE TABLE ohlc_data (
    symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
    timeframe VARCHAR(10) NOT NULL,
    date DATE NOT NULL,
    open DECIMAL(10,2) NOT NULL,
    high DECIMAL(10,2) NOT NULL,
    low DECIMAL(10,2) NOT NULL,
    close DECIMAL(10,2) NOT NULL,
    volume BIGINT NOT NULL,
    adjusted_close DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (symbol_id, timeframe, date)
);

-- Create index for latest-bar queries
CREATE INDEX idx_ohlc_latest ON ohlc_data (symbol_id, timeframe, date DESC);

-- Alerts table
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    condition_type VARCHAR(50) NOT NULL,
    indicator_type VARCHAR(50),
    timeframe VARCHAR(10),
    direction VARCHAR(10) DEFAULT 'both',
    parameters JSONB NOT NULL,
    throttle VARCHAR(20) DEFAULT 'once_per_bar',
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient alert lookups
CREATE INDEX idx_alerts_active ON alerts (is_active, symbol_id, timeframe);
CREATE INDEX idx_alerts_user ON alerts (user_id, is_active);

-- Alert triggers
CREATE TABLE alert_triggers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    triggered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    trigger_value DECIMAL(10,2),
    metadata JSONB
);

-- Watchlist
CREATE TABLE watchlist (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    symbol_id INTEGER REFERENCES symbols(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, symbol_id)
);

-- Indicator presets
CREATE TABLE indicator_presets (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    indicator_type VARCHAR(50) NOT NULL,
    parameters JSONB NOT NULL,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Custom Indicators

### 1. Base Indicator Interface

```python
# backend/app/indicators/base.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
import pandas as pd


class Indicator(ABC):
    """Base class for all indicators"""

    def __init__(self, **params):
        self.params = params

    @abstractmethod
    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Compute indicator values

        Args:
            df: DataFrame with OHLCV columns

        Returns:
            DataFrame with indicator columns added
        """
        pass

    @abstractmethod
    def get_required_columns(self) -> list:
        """Return list of required OHLCV columns"""
        pass

    def validate_params(self) -> bool:
        """Validate indicator parameters"""
        return True

    def get_signal(self, row: pd.Series) -> Dict[str, Any]:
        """Generate trading signal from current indicator values"""
        return {"signal": "neutral", "strength": 0.0}


class IndicatorRegistry:
    """Registry for available indicators"""

    _indicators = {}

    @classmethod
    def register(cls, name: str, indicator_class: type):
        cls._indicators[name] = indicator_class

    @classmethod
    def get_indicator(cls, name: str, **params) -> Indicator:
        if name not in cls._indicators:
            raise ValueError(f"Indicator '{name}' not found")
        return cls._indicators[name](**params)

    @classmethod
    def list_indicators(cls) -> Dict[str, Dict[str, Any]]:
        """List all available indicators with their parameters"""
        result = {}
        for name, indicator_class in cls._indicators.items():
            # Get parameter info from class docstring or attributes
            result[name] = {
                "class": indicator_class.__name__,
                "description": indicator_class.__doc__ or "",
                "params": {}  # Could be populated via inspection
            }
        return result
```

### 2. TDFI Implementation

```python
# backend/app/indicators/custom/tdfi.py
import numpy as np
import pandas as pd
from typing import Dict, Any
from app.indicators.base import Indicator, IndicatorRegistry


class TDFI(Indicator):
    """
    Trend Direction Force Index

    A momentum indicator that measures trend strength based on
    price movements and their smoothing.

    Parameters:
    - period: Lookback period for EMA calculations (default: 13)
    - filter_high: Upper filter threshold (default: 0.05)
    - filter_low: Lower filter threshold (default: -0.05)
    - price_field: Price field to use ('close', 'open', etc.)
    """

    def __init__(self, period: int = 13, filter_high: float = 0.05,
                 filter_low: float = -0.05, price_field: str = "close"):
        super().__init__(
            period=period,
            filter_high=filter_high,
            filter_low=filter_low,
            price_field=price_field
        )

    def get_required_columns(self) -> list:
        return [self.params["price_field"]]

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute TDFI values"""
        period = self.params["period"]
        price_field = self.params["price_field"]

        # Extract price series
        price = df[price_field] * 1000  # Scale as per original Pine Script

        # Calculate MMA and SMMA
        mma = price.ewm(span=period).mean()
        smma = mma.ewm(span=period).mean()

        # Calculate momentum
        impet_mma = mma.diff()
        impet_smma = smma.diff()

        # Average momentum
        aver_impet = (impet_mma + impet_smma) / 2

        # Apply cubic transformation
        result = aver_impet ** 3

        # Calculate divisor
        divma = abs(mma - smma)
        divma = divma.replace(0, np.nan)  # Avoid division by zero

        # Calculate TDFI
        tdf = result / divma

        # Normalize over lookback * 3 period
        lookback = period * 3
        ntdf = tdf / abs(tdf).rolling(window=lookback, min_periods=1).max()

        # Add to DataFrame
        df = df.copy()
        df["tdfi_raw"] = tdf
        df["tdfi_normalized"] = ntdf
        df["tdfi_signal"] = self._generate_signals(ntdf)

        return df

    def _generate_signals(self, ntdf: pd.Series) -> pd.Series:
        """Generate color signals based on TDFI values"""
        filter_high = self.params["filter_high"]
        filter_low = self.params["filter_low"]

        signals = pd.Series(index=ntdf.index, dtype="object")
        signals[ntdf > filter_high] = "bullish"
        signals[ntdf < filter_low] = "bearish"
        signals[(ntdf >= filter_low) & (ntdf <= filter_high)] = "neutral"

        return signals

    def get_signal(self, row: pd.Series) -> Dict[str, Any]:
        """Generate comprehensive signal from TDFI"""
        ntdf = row.get("tdfi_normalized", 0)
        signal_type = row.get("tdfi_signal", "neutral")

        # Calculate signal strength (0 to 1)
        filter_high = self.params["filter_high"]
        filter_low = self.params["filter_low"]

        if signal_type == "bullish":
            strength = min((ntdf - filter_high) / (1 - filter_high), 1.0)
        elif signal_type == "bearish":
            strength = min((filter_low - ntdf) / (abs(filter_low) + 1), 1.0)
        else:
            strength = 0.0

        return {
            "signal": signal_type,
            "strength": strength,
            "value": float(ntdf),
            "above_upper": ntdf > filter_high,
            "below_lower": ntdf < filter_low
        }


# Register the indicator
IndicatorRegistry.register("TDFI", TDFI)
```

### 3. cRSI Implementation

```python
# backend/app/indicators/custom/crsi.py
import numpy as np
import pandas as pd
from typing import Dict, Any, Tuple
from app.indicators.base import Indicator, IndicatorRegistry


class cRSI(Indicator):
    """
    Composite RSI (Cyclic Smoothed RSI)

    Combines RSI with momentum and rate of change for robust signals.
    Calculates dynamic bands for overbought/oversold detection.

    Parameters:
    - domcycle: Dominant cycle length (default: 20)
    - vibration: Vibration period (default: 14)
    - leveling: Leveling percentage (default: 11.0)
    """

    def __init__(self, domcycle: int = 20, vibration: int = 14, leveling: float = 11.0):
        cyclelen = domcycle // 2
        cyclicmemory = domcycle * 2

        super().__init__(
            domcycle=domcycle,
            cyclelen=cyclelen,
            vibration=vibration,
            leveling=leveling,
            cyclicmemory=cyclicmemory
        )

    def get_required_columns(self) -> list:
        return ["close"]

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute cRSI values and dynamic bands"""
        cyclelen = self.params["cyclelen"]
        vibration = self.params["vibration"]
        cyclicmemory = self.params["cyclicmemory"]
        leveling = self.params["leveling"]

        # Calculate standard RSI
        rsi = self._calculate_rsi(df["close"], cyclelen)

        # Calculate torque
        torque = 2 / (vibration + 1)
        phasing_lag = (vibration - 1) / 2

        # Apply torque smoothing
        crsi = np.zeros(len(rsi))
        crsi[0] = rsi.iloc[0]

        for i in range(1, len(rsi)):
            lagged_idx = max(0, i - int(phasing_lag))
            crsi[i] = (torque * (2 * rsi.iloc[i] - rsi.iloc[lagged_idx]) +
                      (1 - torque) * crsi[i-1])

        # Calculate dynamic bands
        upper_band, lower_band = self._calculate_dynamic_bands(
            pd.Series(crsi, index=df.index),
            cyclicmemory,
            leveling
        )

        # Add to DataFrame
        df = df.copy()
        df["crsi"] = crsi
        df["crsi_upper_band"] = upper_band
        df["crsi_lower_band"] = lower_band

        # Generate signals
        df["crsi_signal"] = self._generate_signals(df["crsi"], upper_band, lower_band)

        return df

    def _calculate_rsi(self, prices: pd.Series, period: int) -> pd.Series:
        """Calculate standard RSI"""
        delta = prices.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()

        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))

        return rsi

    def _calculate_dynamic_bands(self, crsi: pd.Series, memory: int,
                                leveling: float) -> Tuple[pd.Series, pd.Series]:
        """Calculate dynamic upper and lower bands"""
        upper_band = pd.Series(index=crsi.index, dtype=float)
        lower_band = pd.Series(index=crsi.index, dtype=float)

        for i in range(memory, len(crsi)):
            window = crsi.iloc[i-memory+1:i+1]
            lmax = window.max()
            lmin = window.min()

            mstep = (lmax - lmin) / 100
            aperc = leveling / 100

            # Find upper band (approximation)
            ub_candidates = np.arange(lmin, lmax + mstep, mstep)
            ub_percentages = [(window < ub).mean() for ub in ub_candidates]
            ub = ub_candidates[np.argmin(np.abs(np.array(ub_percentages) - (1 - aperc)))]

            # Find lower band (approximation)
            db_candidates = np.arange(lmin, lmax + mstep, mstep)
            db_percentages = [(window < db).mean() for db in db_candidates]
            db = db_candidates[np.argmin(np.abs(np.array(db_percentages) - aperc))]

            upper_band.iloc[i] = ub
            lower_band.iloc[i] = db

        # Forward fill initial values
        upper_band = upper_band.ffill()
        lower_band = lower_band.ffill()

        return upper_band, lower_band

    def _generate_signals(self, crsi: pd.Series, upper_band: pd.Series,
                         lower_band: pd.Series) -> pd.Series:
        """Generate trading signals"""
        signals = pd.Series(index=crsi.index, dtype="object")

        # Current conditions
        above_upper = crsi > upper_band
        below_lower = crsi < lower_band

        # Cross detection
        cross_above_upper = ~above_upper.shift(1).fillna(False) & above_upper
        cross_below_lower = ~below_lower.shift(1).fillna(False) & below_lower

        # Assign signals
        signals[cross_above_upper] = "sell"
        signals[cross_below_lower] = "buy"
        signals[above_upper] = "overbought"
        signals[below_lower] = "oversold"

        # Default to neutral
        signals[signals.isna()] = "neutral"

        return signals

    def get_signal(self, row: pd.Series) -> Dict[str, Any]:
        """Generate comprehensive signal from cRSI"""
        crsi = row.get("crsi", 50)
        upper = row.get("crsi_upper_band", 70)
        lower = row.get("crsi_lower_band", 30)
        signal_type = row.get("crsi_signal", "neutral")

        # Calculate position within bands
        if upper != lower:
            position = (crsi - lower) / (upper - lower)
            position = np.clip(position, 0, 1)
        else:
            position = 0.5

        return {
            "signal": signal_type,
            "value": float(crsi),
            "upper_band": float(upper),
            "lower_band": float(lower),
            "position": float(position),
            "above_upper": crsi > upper,
            "below_lower": crsi < lower
        }


# Register the indicator
IndicatorRegistry.register("cRSI", cRSI)
```

### 4. ADXVMA Implementation

```python
# backend/app/indicators/custom/adxvma.py
import numpy as np
import pandas as pd
from typing import Dict, Any
from app.indicators.base import Indicator, IndicatorRegistry


class ADXVMA(Indicator):
    """
    ADX Volatility Moving Average

    Combines ADX (Average Directional Index) with volume-weighted
    moving average to create a trend-following indicator that adapts
    to volatility.

    Parameters:
    - period: Calculation period (default: 14)
    - adx_period: ADX period (default: 14)
    """

    def __init__(self, period: int = 14, adx_period: int = 14):
        super().__init__(period=period, adx_period=adx_period)

    def get_required_columns(self) -> list:
        return ["high", "low", "close", "volume"]

    def compute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute ADXVMA values"""
        period = self.params["period"]
        adx_period = self.params["adx_period"]

        # Calculate True Range
        df_temp = df.copy()
        df_temp["tr1"] = df_temp["high"] - df_temp["low"]
        df_temp["tr2"] = abs(df_temp["high"] - df_temp["close"].shift())
        df_temp["tr3"] = abs(df_temp["low"] - df_temp["close"].shift())
        df_temp["tr"] = df_temp[["tr1", "tr2", "tr3"]].max(axis=1)

        # Calculate ATR
        atr = df_temp["tr"].rolling(window=adx_period).mean()

        # Calculate directional movement
        df_temp["plus_dm"] = np.where(
            (df_temp["high"] - df_temp["high"].shift()) >
            (df_temp["low"].shift() - df_temp["low"]),
            df_temp["high"] - df_temp["high"].shift(),
            0
        )
        df_temp["minus_dm"] = np.where(
            (df_temp["low"].shift() - df_temp["low"]) >
            (df_temp["high"] - df_temp["high"].shift()),
            df_temp["low"].shift() - df_temp["low"],
            0
        )

        # Calculate smoothed values
        plus_di = 100 * (df_temp["plus_dm"].ewm(span=adx_period).mean() /
                         atr.ewm(span=adx_period).mean())
        minus_di = 100 * (df_temp["minus_dm"].ewm(span=adx_period).mean() /
                          atr.ewm(span=adx_period).mean())

        # Calculate ADX
        dx = 100 * abs(plus_di - minus_di) / (plus_di + minus_di)
        adx = dx.ewm(span=adx_period).mean()

        # Calculate Volume Weighted Price
        vwp = (df["high"] + df["low"] + df["close"] + df["open"]) / 4

        # Calculate Volume Weighted Moving Average
        vwma = ((vwp * df["volume"]).rolling(window=period).sum() /
                df["volume"].rolling(window=period).sum())

        # Adjust VWMA based on ADX (trend strength)
        adx_factor = 1 + (adx / 100 - 0.5) * 0.2  # ADX adjustment factor
        adxvma = vwma * adx_factor

        # Determine trend direction and strength
        trend = self._determine_trend(adxvma, period)

        # Add to DataFrame
        result = df.copy()
        result["adxvma"] = adxvma
        result["adx"] = adx
        result["plus_di"] = plus_di
        result["minus_di"] = minus_di
        result["trend_direction"] = trend["direction"]
        result["trend_strength"] = trend["strength"]

        return result

    def _determine_trend(self, adxvma: pd.Series, period: int) -> Dict[str, pd.Series]:
        """Determine trend direction and strength"""
        # Calculate slope over period
        slope = adxvma.diff(period)

        # Determine direction
        direction = pd.Series(index=adxvma.index, dtype="object")
        direction[slope > 0] = "up"
        direction[slope < 0] = "down"
        direction[slope == 0] = "flat"

        # Calculate strength based on slope magnitude
        strength = abs(slope) / adxvma.rolling(window=period).mean()
        strength = strength.fillna(0)

        return {
            "direction": direction,
            "strength": strength
        }

    def get_signal(self, row: pd.Series) -> Dict[str, Any]:
        """Generate comprehensive signal from ADXVMA"""
        adxvma = row.get("adxvma", 0)
        adx = row.get("adx", 0)
        trend_dir = row.get("trend_direction", "flat")
        trend_strength = row.get("trend_strength", 0)

        # Determine signal strength
        if adx > 25:
            signal_strength = "strong"
        elif adx > 20:
            signal_strength = "moderate"
        else:
            signal_strength = "weak"

        return {
            "signal": trend_dir,
            "value": float(adxvma),
            "adx": float(adx),
            "strength": signal_strength,
            "trend_strength": float(trend_strength),
            "is_trending": adx > 20,
            "direction": trend_dir
        }


# Register the indicator
IndicatorRegistry.register("ADXVMA", ADXVMA)
```

## Alert Engine

### 1. Alert Worker

```python
# backend/app/workers/alert_worker.py
import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Dict, List, Set, Optional
import redis
import pandas as pd
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.database import SessionLocal, engine
from app.models.alert import Alert, AlertTrigger, AlertConditionType, AlertThrottle
from app.services.market_data_service import MarketDataService
from app.services.indicator_service import IndicatorService
from app.indicators.base import IndicatorRegistry
from app.config import settings

logger = logging.getLogger(__name__)


class AlertWorker:
    """Background worker for evaluating alerts"""

    def __init__(self):
        self.redis = redis.from_url(settings.REDIS_URL)
        self.market_service = MarketDataService()
        self.indicator_service = IndicatorService()
        self.running = False
        self.pubsub = None

    async def start(self):
        """Start the alert worker"""
        logger.info("Starting alert worker...")
        self.running = True

        # Initialize pubsub for market data events
        self.pubsub = self.redis.pubsub()
        await self.pubsub.subscribe("market_data:bar_closed")

        # Start evaluation loop
        tasks = [
            asyncio.create_task(self._evaluation_loop()),
            asyncio.create_task(self._market_data_listener()),
            asyncio.create_task(self._cleanup_loop())
        ]

        try:
            await asyncio.gather(*tasks)
        except Exception as e:
            logger.error(f"Alert worker error: {e}")
        finally:
            await self.stop()

    async def stop(self):
        """Stop the alert worker"""
        logger.info("Stopping alert worker...")
        self.running = False

        if self.pubsub:
            await self.pubsub.unsubscribe()
            await self.pubsub.close()

    async def _evaluation_loop(self):
        """Main evaluation loop for periodic checks"""
        while self.running:
            try:
                # Get active alerts that need evaluation
                db = SessionLocal()
                try:
                    alerts = db.query(Alert).filter(
                        Alert.is_active == True
                    ).all()

                    # Group alerts by symbol and timeframe
                    alert_groups = self._group_alerts(alerts)

                    # Evaluate each group
                    for (symbol_id, timeframe), group_alerts in alert_groups.items():
                        await self._evaluate_alert_group(
                            db, symbol_id, timeframe, group_alerts
                        )

                finally:
                    db.close()

                # Wait for next evaluation
                await asyncio.sleep(settings.ALERT_EVALUATION_INTERVAL_SECONDS)

            except Exception as e:
                logger.error(f"Error in evaluation loop: {e}")
                await asyncio.sleep(5)

    async def _market_data_listener(self):
        """Listen for real-time market data events"""
        while self.running:
            try:
                message = await self.pubsub.get_message(timeout=1.0)

                if message and message["type"] == "message":
                    data = json.loads(message["data"])
                    await self._handle_market_data_event(data)

            except Exception as e:
                logger.error(f"Error in market data listener: {e}")
                await asyncio.sleep(1)

    async def _handle_market_data_event(self, event_data: Dict):
        """Handle a market data event (e.g., new bar closed)"""
        symbol_id = event_data["symbol_id"]
        timeframe = event_data["timeframe"]

        db = SessionLocal()
        try:
            # Get active alerts for this symbol/timeframe
            alerts = db.query(Alert).filter(
                and_(
                    Alert.is_active == True,
                    Alert.symbol_id == symbol_id,
                    Alert.timeframe == timeframe
                )
            ).all()

            if alerts:
                await self._evaluate_alert_group(db, symbol_id, timeframe, alerts)

        finally:
            db.close()

    def _group_alerts(self, alerts: List[Alert]) -> Dict[tuple, List[Alert]]:
        """Group alerts by symbol and timeframe for efficient evaluation"""
        groups = {}
        for alert in alerts:
            key = (alert.symbol_id, alert.timeframe or "1D")
            if key not in groups:
                groups[key] = []
            groups[key].append(alert)
        return groups

    async def _evaluate_alert_group(self, db: Session, symbol_id: int,
                                   timeframe: str, alerts: List[Alert]):
        """Evaluate a group of alerts for the same symbol/timeframe"""
        try:
            # Get latest market data
            market_data = await self.market_service.get_latest_bars(
                symbol_id, timeframe, limit=100
            )

            if market_data.empty:
                return

            # Get required indicators
            indicator_types = set(
                alert.indicator_type for alert in alerts
                if alert.indicator_type
            )

            indicator_data = {}
            if indicator_types:
                indicator_data = await self.indicator_service.calculate_indicators(
                    market_data, list(indicator_types), timeframe
                )

            # Merge market and indicator data
            evaluation_data = market_data.copy()
            for indicator_type, data in indicator_data.items():
                for col in data.columns:
                    evaluation_data[f"{indicator_type}_{col}"] = data[col]

            # Evaluate each alert
            for alert in alerts:
                await self._evaluate_single_alert(db, alert, evaluation_data)

        except Exception as e:
            logger.error(f"Error evaluating alert group: {e}")

    async def _evaluate_single_alert(self, db: Session, alert: Alert,
                                    data: pd.DataFrame):
        """Evaluate a single alert condition"""
        try:
            # Check throttle
            if not self._check_throttle(alert):
                return

            # Get the latest row (current bar)
            latest = data.iloc[-1]
            previous = data.iloc[-2] if len(data) > 1 else None

            # Evaluate condition
            triggered = await self._evaluate_condition(alert, latest, previous)

            if triggered:
                await self._trigger_alert(db, alert, latest.to_dict())

        except Exception as e:
            logger.error(f"Error evaluating alert {alert.id}: {e}")

    async def _evaluate_condition(self, alert: Alert, current: pd.Series,
                                 previous: Optional[pd.Series]) -> bool:
        """Evaluate alert condition"""
        condition_type = alert.condition_type
        params = alert.parameters

        if condition_type == AlertConditionType.PRICE_ABOVE:
            return current["close"] > params["threshold"]

        elif condition_type == AlertConditionType.PRICE_BELOW:
            return current["close"] < params["threshold"]

        elif condition_type == AlertConditionType.PRICE_CROSS_UP:
            threshold = params["threshold"]
            if previous is None:
                return False
            return previous["close"] <= threshold < current["close"]

        elif condition_type == AlertConditionType.PRICE_CROSS_DOWN:
            threshold = params["threshold"]
            if previous is None:
                return False
            return previous["close"] >= threshold > current["close"]

        elif condition_type == AlertConditionType.CUSTOM_TDFI:
            # TDFI-specific logic
            tdfi_key = f"{alert.indicator_type}_tdfi_normalized"
            if tdfi_key not in current:
                return False

            tdfi_value = current[tdfi_key]
            filter_high = params.get("filter_high", 0.05)
            filter_low = params.get("filter_low", -0.05)

            if params.get("signal_type") == "above_upper":
                return tdfi_value > filter_high
            elif params.get("signal_type") == "below_lower":
                return tdfi_value < filter_low

        elif condition_type == AlertConditionType.CUSTOM_CRSI:
            # cRSI-specific logic
            crsi_key = f"{alert.indicator_type}_crsi"
            upper_key = f"{alert.indicator_type}_crsi_upper_band"
            lower_key = f"{alert.indicator_type}_crsi_lower_band"

            if not all(k in current for k in [crsi_key, upper_key, lower_key]):
                return False

            if previous is None:
                return False

            crsi_value = current[crsi_key]
            prev_crsi = previous[crsi_key]
            upper_band = current[upper_key]
            lower_band = current[lower_key]

            # Check for cross events
            if prev_crsi <= upper_band and crsi_value > upper_band:
                return True  # Cross above upper band
            if prev_crsi >= lower_band and crsi_value < lower_band:
                return True  # Cross below lower band

        elif condition_type == AlertConditionType.CUSTOM_ADXVMA:
            # ADXVMA-specific logic
            adxvma_key = f"{alert.indicator_type}_adxvma"
            trend_key = f"{alert.indicator_type}_trend_direction"
            adx_key = f"{alert.indicator_type}_adx"

            if not all(k in current for k in [adxvma_key, trend_key, adx_key]):
                return False

            trend = current[trend_key]
            adx = current[adx_key]

            if params.get("signal_type") == "trend_change":
                if previous is None:
                    return False
                prev_trend = previous[trend_key]
                return trend != prev_trend and adx > 20

            elif params.get("signal_type") == "strong_trend":
                return adx > params.get("adx_threshold", 25)

        return False

    def _check_throttle(self, alert: Alert) -> bool:
        """Check if alert should trigger based on throttle settings"""
        if alert.throttle == AlertThrottle.NONE:
            return True

        if not alert.last_triggered_at:
            return True

        now = datetime.utcnow()

        if alert.throttle == AlertThrottle.ONCE_PER_DAY:
            return (now - alert.last_triggered_at) >= timedelta(days=1)

        elif alert.throttle == AlertThrottle.ONCE_PER_BAR:
            # For daily timeframe, this means once per day
            # For intraday, could check actual bar timestamps
            return (now - alert.last_triggered_at) >= timedelta(hours=1)

        return True

    async def _trigger_alert(self, db: Session, alert: Alert, data: Dict):
        """Trigger an alert and send notifications"""
        try:
            # Create trigger record
            trigger = AlertTrigger(
                alert_id=alert.id,
                trigger_value=data.get("close", 0),
                metadata=data
            )
            db.add(trigger)

            # Update alert
            alert.last_triggered_at = datetime.utcnow()
            db.commit()

            # Send notifications
            await self._send_notifications(alert, data)

            # Publish to WebSocket
            await self._publish_to_websocket(alert, data)

            logger.info(f"Alert triggered: {alert.name} for user {alert.user_id}")

        except Exception as e:
            logger.error(f"Error triggering alert {alert.id}: {e}")
            db.rollback()

    async def _send_notifications(self, alert: Alert, data: Dict):
        """Send alert notifications (email, webhook, etc.)"""
        # Implementation would depend on notification services
        # Could send email, webhook, push notification, etc.
        pass

    async def _publish_to_websocket(self, alert: Alert, data: Dict):
        """Publish alert trigger to WebSocket channel"""
        message = {
            "type": "alert_triggered",
            "alert_id": str(alert.id),
            "alert_name": alert.name,
            "user_id": str(alert.user_id),
            "trigger_value": data.get("close", 0),
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": data
        }

        # Publish to user-specific channel
        channel = f"alerts:user:{alert.user_id}"
        self.redis.publish(channel, json.dumps(message))

    async def _cleanup_loop(self):
        """Periodic cleanup tasks"""
        while self.running:
            try:
                # Clean up old alert triggers (keep last 30 days)
                cutoff_date = datetime.utcnow() - timedelta(days=30)

                db = SessionLocal()
                try:
                    db.query(AlertTrigger).filter(
                        AlertTrigger.triggered_at < cutoff_date
                    ).delete()
                    db.commit()
                finally:
                    db.close()

                # Sleep for a day
                await asyncio.sleep(86400)

            except Exception as e:
                logger.error(f"Error in cleanup loop: {e}")
                await asyncio.sleep(3600)


# Worker entry point
async def main():
    worker = AlertWorker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
```

### 2. Alert Service

```python
# backend/app/services/alert_service.py
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import uuid

from app.models.alert import Alert, AlertTrigger, AlertConditionType, AlertThrottle
from app.models.user import User
from app.models.market import Symbol
from app.schemas.alert import AlertCreate, AlertUpdate
from app.database import get_db


class AlertService:
    """Service for managing alerts"""

    def __init__(self):
        pass

    def create_alert(self, db: Session, user_id: uuid.UUID,
                    alert_data: AlertCreate) -> Alert:
        """Create a new alert"""
        # Validate symbol exists
        symbol = db.query(Symbol).filter(
            Symbol.ticker == alert_data.symbol
        ).first()

        if not symbol:
            raise ValueError(f"Symbol {alert_data.symbol} not found")

        # Create alert
        alert = Alert(
            user_id=user_id,
            symbol_id=symbol.id,
            name=alert_data.name,
            description=alert_data.description,
            condition_type=alert_data.condition_type,
            indicator_type=alert_data.indicator_type,
            timeframe=alert_data.timeframe,
            direction=alert_data.direction,
            parameters=alert_data.parameters,
            throttle=alert_data.throttle
        )

        db.add(alert)
        db.commit()
        db.refresh(alert)

        return alert

    def get_user_alerts(self, db: Session, user_id: uuid.UUID,
                       active_only: bool = False) -> List[Alert]:
        """Get all alerts for a user"""
        query = db.query(Alert).filter(Alert.user_id == user_id)

        if active_only:
            query = query.filter(Alert.is_active == True)

        return query.order_by(Alert.created_at.desc()).all()

    def get_alert(self, db: Session, alert_id: uuid.UUID,
                  user_id: uuid.UUID) -> Optional[Alert]:
        """Get a specific alert by ID"""
        return db.query(Alert).filter(
            and_(
                Alert.id == alert_id,
                Alert.user_id == user_id
            )
        ).first()

    def update_alert(self, db: Session, alert_id: uuid.UUID,
                    user_id: uuid.UUID, updates: AlertUpdate) -> Optional[Alert]:
        """Update an existing alert"""
        alert = self.get_alert(db, alert_id, user_id)

        if not alert:
            return None

        # Update fields
        update_data = updates.dict(exclude_unset=True)
        for field, value in update_data.items():
            setattr(alert, field, value)

        alert.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(alert)

        return alert

    def delete_alert(self, db: Session, alert_id: uuid.UUID,
                    user_id: uuid.UUID) -> bool:
        """Delete an alert"""
        alert = self.get_alert(db, alert_id, user_id)

        if not alert:
            return False

        db.delete(alert)
        db.commit()

        return True

    def toggle_alert(self, db: Session, alert_id: uuid.UUID,
                    user_id: uuid.UUID) -> Optional[Alert]:
        """Toggle alert active/inactive status"""
        alert = self.get_alert(db, alert_id, user_id)

        if not alert:
            return None

        alert.is_active = not alert.is_active
        alert.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(alert)

        return alert

    def get_alert_triggers(self, db: Session, alert_id: uuid.UUID,
                          user_id: uuid.UUID, limit: int = 100) -> List[AlertTrigger]:
        """Get trigger history for an alert"""
        # Verify ownership
        alert = self.get_alert(db, alert_id, user_id)
        if not alert:
            return []

        return db.query(AlertTrigger).filter(
            AlertTrigger.alert_id == alert_id
        ).order_by(AlertTrigger.triggered_at.desc()).limit(limit).all()

    def get_active_alerts_for_symbol(self, db: Session, symbol_id: int,
                                   timeframe: Optional[str] = None) -> List[Alert]:
        """Get all active alerts for a symbol (used by worker)"""
        query = db.query(Alert).filter(
            and_(
                Alert.is_active == True,
                Alert.symbol_id == symbol_id
            )
        )

        if timeframe:
            query = query.filter(or_(
                Alert.timeframe == timeframe,
                Alert.timeframe.is_(None)
            ))

        return query.all()

    def get_alert_statistics(self, db: Session, user_id: uuid.UUID) -> Dict[str, Any]:
        """Get alert statistics for a user"""
        total_alerts = db.query(Alert).filter(Alert.user_id == user_id).count()
        active_alerts = db.query(Alert).filter(
            and_(Alert.user_id == user_id, Alert.is_active == True)
        ).count()

        # Get trigger count in last 30 days
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        triggers = db.query(AlertTrigger).join(Alert).filter(
            and_(
                Alert.user_id == user_id,
                AlertTrigger.triggered_at >= thirty_days_ago
            )
        ).count()

        # Get most triggered alert
        most_triggered = db.query(
            Alert.name,
            db.func.count(AlertTrigger.id).label('trigger_count')
        ).join(AlertTrigger).filter(
            Alert.user_id == user_id
        ).group_by(Alert.id, Alert.name).order_by(
            db.func.count(AlertTrigger.id).desc()
        ).first()

        return {
            "total_alerts": total_alerts,
            "active_alerts": active_alerts,
            "inactive_alerts": total_alerts - active_alerts,
            "triggers_last_30_days": triggers,
            "most_triggered_alert": {
                "name": most_triggered[0],
                "count": most_triggered[1]
            } if most_triggered else None
        }
```

## Frontend Implementation

### 1. Trading Chart Component

```tsx
// frontend/src/components/charts/TradingChart.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, Time } from 'lightweight-charts';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useMarketData } from '../../hooks/useMarketData';
import { IndicatorConfig, OHLCData } from '../../types';

interface TradingChartProps {
  symbol: string;
  timeframe: string;
  indicators: IndicatorConfig[];
  onAlertCreate?: (condition: any) => void;
  height?: number;
  width?: number;
}

export const TradingChart: React.FC<TradingChartProps> = ({
  symbol,
  timeframe,
  indicators,
  onAlertCreate,
  height = 600,
  width = 800
}) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const indicatorSeriesRef = useRef<Map<string, ISeriesApi<any>>>(new Map());

  const { data: ohlcData, loading, error } = useMarketData(symbol, timeframe);
  const { subscribe, unsubscribe } = useWebSocket();

  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      width,
      height,
      layout: {
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 0,
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#cccccc',
      },
    });

    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    chartRef.current = chart;
    candlestickSeriesRef.current = candlestickSeries;

    return () => {
      chart.remove();
    };
  }, [width, height]);

  // Update chart data
  useEffect(() => {
    if (!candlestickSeriesRef.current || !ohlcData) return;

    const formattedData: CandlestickData[] = ohlcData.map((bar) => ({
      time: bar.time as Time,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
    }));

    candlestickSeriesRef.current.setData(formattedData);
  }, [ohlcData]);

  // Handle WebSocket updates
  useEffect(() => {
    const handleUpdate = (data: any) => {
      if (data.symbol === symbol && data.timeframe === timeframe) {
        const newBar: CandlestickData = {
          time: data.timestamp as Time,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
        };

        candlestickSeriesRef.current?.update(newBar);
      }
    };

    const subscription = {
      channel: 'market_data',
      symbol,
      timeframe,
    };

    subscribe(subscription, handleUpdate);

    return () => {
      unsubscribe(subscription);
    };
  }, [symbol, timeframe, subscribe, unsubscribe]);

  // Render indicators
  useEffect(() => {
    if (!chartRef.current || !candlestickSeriesRef.current) return;

    // Clear existing indicator series
    indicatorSeriesRef.current.forEach((series) => {
      chartRef.current?.removeSeries(series);
    });
    indicatorSeriesRef.current.clear();

    // Add new indicators
    indicators.forEach((indicator) => {
      const series = createIndicatorSeries(
        chartRef.current!,
        indicator.type,
        indicator.params
      );

      if (series && indicator.data) {
        series.setData(indicator.data);
        indicatorSeriesRef.current.set(indicator.id, series);
      }
    });
  }, [indicators]);

  // Handle chart click for alert creation
  const handleChartClick = useCallback((param: any) => {
    if (param.time && onAlertCreate) {
      const alertCondition = {
        symbol,
        timeframe,
        timestamp: param.time,
        price: param.seriesPrices.get(candlestickSeriesRef.current),
      };

      onAlertCreate(alertCondition);
    }
  }, [symbol, timeframe, onAlertCreate]);

  // Register click handler
  useEffect(() => {
    if (!chartRef.current) return;

    chartRef.current.subscribeClick(handleChartClick);

    return () => {
      chartRef.current?.unsubscribeClick(handleChartClick);
    };
  }, [handleChartClick]);

  if (loading) return <div>Loading chart...</div>;
  if (error) return <div>Error loading chart: {error}</div>;

  return (
    <div className="trading-chart">
      <div ref={chartContainerRef} />
      <div className="chart-controls">
        {/* Chart controls will be added here */}
      </div>
    </div>
  );
};

// Helper function to create indicator series
function createIndicatorSeries(
  chart: IChartApi,
  type: string,
  params: any
): ISeriesApi<any> | null {
  switch (type) {
    case 'line':
      return chart.addLineSeries({
        color: params.color || '#2196f3',
        lineWidth: params.lineWidth || 2,
        priceScaleId: params.priceScaleId || 'right',
      });

    case 'area':
      return chart.addAreaSeries({
        topColor: params.topColor || 'rgba(33, 150, 243, 0.56)',
        bottomColor: params.bottomColor || 'rgba(33, 150, 243, 0.04)',
        lineColor: params.lineColor || '#2196f3',
        lineWidth: params.lineWidth || 2,
      });

    case 'histogram':
      return chart.addHistogramSeries({
        color: params.color || '#2196f3',
        priceFormat: {
          type: 'price',
          precision: 2,
          minMove: 0.01,
        },
      });

    default:
      console.error(`Unknown indicator series type: ${type}`);
      return null;
  }
}
```

### 2. WebSocket Hook

```typescript
// frontend/src/hooks/useWebSocket.ts
import { useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '../store';

interface Subscription {
  channel: string;
  symbol?: string;
  timeframe?: string;
}

interface WSMessage {
  type: string;
  data: any;
}

export const useWebSocket = () => {
  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Map<string, Set<Function>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const { token } = useSelector((state: RootState) => state.auth);

  const connect = useCallback(() => {
    const wsUrl = `${process.env.REACT_APP_WS_URL}?token=${token}`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WebSocket connected');

      // Resubscribe to all channels
      subscriptionsRef.current.forEach((callbacks, key) => {
        ws.send(JSON.stringify({ type: 'subscribe', channel: key }));
      });
    };

    ws.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data);
        const callbacks = subscriptionsRef.current.get(message.type);

        if (callbacks) {
          callbacks.forEach(callback => callback(message.data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');

      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 5000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, [token]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const subscribe = useCallback((
    subscription: Subscription,
    callback: Function
  ) => {
    const key = JSON.stringify(subscription);

    if (!subscriptionsRef.current.has(key)) {
      subscriptionsRef.current.set(key, new Set());

      // Send subscription message if connected
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'subscribe',
          ...subscription
        }));
      }
    }

    subscriptionsRef.current.get(key)!.add(callback);

    return () => {
      const callbacks = subscriptionsRef.current.get(key);
      if (callbacks) {
        callbacks.delete(callback);

        if (callbacks.size === 0) {
          subscriptionsRef.current.delete(key);

          // Send unsubscribe message if connected
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'unsubscribe',
              ...subscription
            }));
          }
        }
      }
    };
  }, []);

  const unsubscribe = useCallback((subscription: Subscription) => {
    const key = JSON.stringify(subscription);
    subscriptionsRef.current.delete(key);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        ...subscription
      }));
    }
  }, []);

  const send = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);

  // Auto-connect when token changes
  useEffect(() => {
    if (token) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [token, connect, disconnect]);

  return {
    subscribe,
    unsubscribe,
    send,
    connected: wsRef.current?.readyState === WebSocket.OPEN,
  };
};
```

### 3. Market Data Hook

```typescript
// frontend/src/hooks/useMarketData.ts
import { useState, useEffect, useCallback } from 'react';
import { marketService } from '../services/marketService';
import { OHLCData } from '../types';

interface UseMarketDataOptions {
  symbol: string;
  timeframe: string;
  from?: string;
  to?: string;
  limit?: number;
}

export const useMarketData = (
  symbol: string,
  timeframe: string,
  options?: Partial<UseMarketDataOptions>
) => {
  const [data, setData] = useState<OHLCData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await marketService.getOHLCData(symbol, timeframe, {
        from: options?.from,
        to: options?.to,
        limit: options?.limit || 1000,
      });

      setData(response.data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch market data');
    } finally {
      setLoading(false);
    }
  }, [symbol, timeframe, options]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
};
```

## Docker Configuration

### 1. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: trading_alert
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-password}@postgres:5432/trading_alert
      REDIS_URL: redis://redis:6379
      EODHD_API_KEY: ${EODHD_API_KEY}
      SECRET_KEY: ${SECRET_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      DEBUG: "true"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-password}@postgres:5432/trading_alert
      REDIS_URL: redis://redis:6379
      EODHD_API_KEY: ${EODHD_API_KEY}
      SECRET_KEY: ${SECRET_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: python -m app.workers.alert_worker
    deploy:
      replicas: 2

  market-data-worker:
    build:
      context: ./backend
      dockerfile: Dockerfile
    environment:
      DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD:-password}@postgres:5432/trading_alert
      REDIS_URL: redis://redis:6379
      EODHD_API_KEY: ${EODHD_API_KEY}
      SECRET_KEY: ${SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    volumes:
      - ./backend:/app
    command: python -m app.workers.market_data_worker

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    environment:
      REACT_APP_API_URL: http://localhost:8000
      REACT_APP_WS_URL: ws://localhost:8000/ws
    depends_on:
      - backend
    ports:
      - "3000:80"
    volumes:
      - ./frontend:/app
      - /app/node_modules

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend

volumes:
  postgres_data:
  redis_data:
```

### 2. Production Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  backend:
    image: tradingalert-backend:latest
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      EODHD_API_KEY: ${EODHD_API_KEY}
      SECRET_KEY: ${SECRET_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      DEBUG: "false"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    deploy:
      replicas: 3

  worker:
    image: tradingalert-backend:latest
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      EODHD_API_KEY: ${EODHD_API_KEY}
      SECRET_KEY: ${SECRET_KEY}
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    command: python -m app.workers.alert_worker
    deploy:
      replicas: 4

  market-data-worker:
    image: tradingalert-backend:latest
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      EODHD_API_KEY: ${EODHD_API_KEY}
      SECRET_KEY: ${SECRET_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    command: python -m app.workers.market_data_worker

  frontend:
    image: tradingalert-frontend:latest
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.prod.conf:/etc/nginx/conf.d/default.conf
      - /etc/letsencrypt:/etc/letsencrypt
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### 3. Backend Dockerfile

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim as base

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PY=/usr/local/bin/python

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r app && useradd -r -g app app

# Set work directory
WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project
COPY . .

# Chown all files to app user
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 4. Frontend Dockerfile

```dockerfile
# frontend/Dockerfile
# Build stage
FROM node:18-alpine as build

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Change ownership of nginx directories
RUN chown -R nextjs:nodejs /var/cache/nginx && \
    chown -R nextjs:nodejs /var/log/nginx && \
    chown -R nextjs:nodejs /etc/nginx/conf.d && \
    chown -R nextjs:nodejs /usr/share/nginx/html && \
    touch /var/run/nginx.pid && \
    chown -R nextjs:nodejs /var/run/nginx.pid

# Switch to non-root user
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

### 5. Nginx Configuration

```nginx
# nginx.conf
upstream backend {
    server backend:8000;
}

upstream websocket {
    ip_hash;
    server backend:8000;
}

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=ws:10m rate=1r/s;

server {
    listen 80;
    server_name localhost;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # CORS headers
        add_header 'Access-Control-Allow-Origin' '$http_origin' always;
        add_header 'Access-Control-Allow-Credentials' 'true' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization' always;

        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '$http_origin';
            add_header 'Access-Control-Allow-Credentials' 'true';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS';
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # WebSocket
    location /ws {
        limit_req zone=ws burst=10 nodelay;

        proxy_pass http://websocket;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket specific headers
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_connect_timeout 86400;
    }

    # Health check
    location /health {
        proxy_pass http://backend/health;
        access_log off;
    }
}

# HTTPS configuration (for production)
server {
    listen 443 ssl http2;
    server_name tradingalert.example.com;

    # SSL certificates
    ssl_certificate /etc/letsencrypt/live/tradingalert.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tradingalert.example.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000" always;

    # Same proxy configuration as HTTP
    location / {
        proxy_pass http://frontend;
        # ... same headers as above
    }

    location /api/ {
        # ... same as above
    }

    location /ws {
        # ... same as above
    }
}
```

## Environment Files

### 1. Development Environment

```env
# .env
# Database
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://postgres:your_secure_password@localhost:5432/trading_alert

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# Market Data
EODHD_API_KEY=your_eodhd_api_key

# JWT
SECRET_KEY=your_super_secret_key_here
JWT_SECRET_KEY=your_jwt_secret_key_here

# Frontend
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws

# Debug
DEBUG=true
```

### 2. Production Environment

```env
# .env.production
# Database
POSTGRES_DB=trading_alert_prod
POSTGRES_USER=tradinguser
POSTGRES_PASSWORD=your_production_password
DATABASE_URL=postgresql://tradinguser:your_production_password@postgres:5432/trading_alert_prod

# Redis
REDIS_URL=redis://:your_redis_password@redis:6379
REDIS_PASSWORD=your_redis_password

# Market Data
EODHD_API_KEY=your_eodhd_prod_api_key

# JWT
SECRET_KEY=your_production_secret_key
JWT_SECRET_KEY=your_production_jwt_secret

# Frontend
REACT_APP_API_URL=https://tradingalert.example.com/api
REACT_APP_WS_URL=wss://tradingalert.example.com/ws

# Debug
DEBUG=false

# SSL
SSL_CERT_PATH=/etc/letsencrypt/live/tradingalert.example.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/tradingalert.example.com/privkey.pem
```

## Testing Strategy

### 1. Backend Tests

```python
# backend/tests/test_indicators.py
import pytest
import pandas as pd
import numpy as np
from app.indicators.custom.tdfi import TDFI
from app.indicators.custom.crsi import cRSI
from app.indicators.custom.adxvma import ADXVMA


@pytest.fixture
def sample_ohlc_data():
    """Generate sample OHLC data for testing"""
    np.random.seed(42)
    n_periods = 100

    # Generate realistic price movements
    returns = np.random.normal(0.001, 0.02, n_periods)
    prices = 100 * np.exp(np.cumsum(returns))

    # Add noise for high/low
    high_noise = np.random.uniform(0, 0.01, n_periods)
    low_noise = np.random.uniform(0, 0.01, n_periods)

    data = pd.DataFrame({
        'date': pd.date_range('2023-01-01', periods=n_periods, freq='D'),
        'open': prices,
        'high': prices * (1 + high_noise),
        'low': prices * (1 - low_noise),
        'close': prices,
        'volume': np.random.randint(1000000, 10000000, n_periods)
    })

    return data


class TestTDFI:
    """Test TDFI indicator implementation"""

    def test_tdfi_computation(self, sample_ohlc_data):
        """Test TDFI calculation"""
        tdfi = TDFI(period=13)
        result = tdfi.compute(sample_ohlc_data)

        # Check if all expected columns exist
        assert 'tdfi_raw' in result.columns
        assert 'tdfi_normalized' in result.columns
        assert 'tdfi_signal' in result.columns

        # Check if normalized values are within expected range
        assert result['tdfi_normalized'].between(-1, 1).all()

        # Check signal types
        valid_signals = {'bullish', 'bearish', 'neutral'}
        assert result['tdfi_signal'].isin(valid_signals).all()

    def test_tdfi_signal_generation(self, sample_ohlc_data):
        """Test TDFI signal generation"""
        tdfi = TDFI(period=13)
        result = tdfi.compute(sample_ohlc_data)

        # Test signal method on last row
        last_row = result.iloc[-1]
        signal = tdfi.get_signal(last_row)

        assert 'signal' in signal
        assert 'strength' in signal
        assert 'value' in signal
        assert signal['signal'] in {'bullish', 'bearish', 'neutral'}


class TestcRSI:
    """Test cRSI indicator implementation"""

    def test_crsi_computation(self, sample_ohlc_data):
        """Test cRSI calculation"""
        crsi = cRSI(domcycle=20)
        result = crsi.compute(sample_ohlc_data)

        # Check if all expected columns exist
        assert 'crsi' in result.columns
        assert 'crsi_upper_band' in result.columns
        assert 'crsi_lower_band' in result.columns
        assert 'crsi_signal' in result.columns

        # Check if bands are properly ordered
        assert (result['crsi_upper_band'] >= result['crsi_lower_band']).all()

        # Check signal types
        valid_signals = {'buy', 'sell', 'overbought', 'oversold', 'neutral'}
        assert result['crsi_signal'].isin(valid_signals).all()

    def test_crsi_dynamic_bands(self, sample_ohlc_data):
        """Test cRSI dynamic band calculation"""
        crsi = cRSI(domcycle=20)
        result = crsi.compute(sample_ohlc_data)

        # Bands should be dynamic (not constant)
        assert not result['crsi_upper_band'].nunique() == 1
        assert not result['crsi_lower_band'].nunique() == 1


class TestADXVMA:
    """Test ADXVMA indicator implementation"""

    def test_adxvma_computation(self, sample_ohlc_data):
        """Test ADXVMA calculation"""
        adxvma = ADXVMA(period=14)
        result = adxvma.compute(sample_ohlc_data)

        # Check if all expected columns exist
        assert 'adxvma' in result.columns
        assert 'adx' in result.columns
        assert 'plus_di' in result.columns
        assert 'minus_di' in result.columns
        assert 'trend_direction' in result.columns
        assert 'trend_strength' in result.columns

        # Check if ADX values are positive
        assert (result['adx'] >= 0).all()

        # Check trend directions
        valid_directions = {'up', 'down', 'flat'}
        assert result['trend_direction'].isin(valid_directions).all()


class TestAlertEngine:
    """Test alert engine logic"""

    def test_price_above_condition(self):
        """Test price above alert condition"""
        from app.workers.alert_worker import AlertWorker

        worker = AlertWorker()

        # Mock data
        current = pd.Series({'close': 105.0})

        # Mock alert
        class MockAlert:
            condition_type = "price_above"
            parameters = {"threshold": 100.0}

        alert = MockAlert()

        # Test condition
        result = worker._evaluate_condition(alert, current, None)
        assert result == True

        # Test when condition is not met
        current_low = pd.Series({'close': 95.0})
        result = worker._evaluate_condition(alert, current_low, None)
        assert result == False

    def test_cross_over_condition(self):
        """Test cross over alert condition"""
        from app.workers.alert_worker import AlertWorker
        from app.models.alert import AlertConditionType

        worker = AlertWorker()

        # Mock data for cross over
        previous = pd.Series({'close': 99.0})
        current = pd.Series({'close': 101.0})

        # Mock alert
        class MockAlert:
            condition_type = AlertConditionType.PRICE_CROSS_UP
            parameters = {"threshold": 100.0}

        alert = MockAlert()

        # Test condition
        result = worker._evaluate_condition(alert, current, previous)
        assert result == True

        # Test when no cross occurs
        current_no_cross = pd.Series({'close': 98.0})
        result = worker._evaluate_condition(alert, current_no_cross, previous)
        assert result == False
```

### 2. Frontend Tests

```typescript
// frontend/src/components/charts/__tests__/TradingChart.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TradingChart } from '../TradingChart';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

// Mock lightweight-charts
jest.mock('lightweight-charts', () => ({
  createChart: jest.fn(() => ({
    addCandlestickSeries: jest.fn(() => ({
      setData: jest.fn(),
      update: jest.fn(),
    })),
    addLineSeries: jest.fn(),
    removeSeries: jest.fn(),
    subscribeClick: jest.fn(),
    unsubscribeClick: jest.fn(),
    remove: jest.fn(),
  })),
}));

// Mock hooks
jest.mock('../../hooks/useMarketData', () => ({
  useMarketData: jest.fn(() => ({
    data: [
      { time: '2023-01-01', open: 100, high: 105, low: 95, close: 102 },
      { time: '2023-01-02', open: 102, high: 108, low: 100, close: 105 },
    ],
    loading: false,
    error: null,
  })),
}));

jest.mock('../../hooks/useWebSocket', () => ({
  useWebSocket: jest.fn(() => ({
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    connected: true,
  })),
}));

const createMockStore = () => {
  return configureStore({
    reducer: {
      auth: () => ({ token: 'mock-token' }),
    },
  });
};

describe('TradingChart', () => {
  it('renders without crashing', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <TradingChart
          symbol="AAPL"
          timeframe="1D"
          indicators={[]}
        />
      </Provider>
    );

    // Chart should render
    expect(screen.getByRole('generic')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    const { useMarketData } = require('../../hooks/useMarketData');
    useMarketData.mockReturnValue({
      data: [],
      loading: true,
      error: null,
    });

    const store = createMockStore();

    render(
      <Provider store={store}>
        <TradingChart
          symbol="AAPL"
          timeframe="1D"
          indicators={[]}
        />
      </Provider>
    );

    expect(screen.getByText('Loading chart...')).toBeInTheDocument();
  });

  it('displays error state', () => {
    const { useMarketData } = require('../../hooks/useMarketData');
    useMarketData.mockReturnValue({
      data: [],
      loading: false,
      error: 'Failed to load data',
    });

    const store = createMockStore();

    render(
      <Provider store={store}>
        <TradingChart
          symbol="AAPL"
          timeframe="1D"
          indicators={[]}
        />
      </Provider>
    );

    expect(screen.getByText(/Error loading chart/)).toBeInTheDocument();
  });
});
```

## Deployment Instructions

### 1. Local Development Setup

```bash
# Clone the repository
git clone https://github.com/your-org/TradingAlert.git
cd TradingAlert

# Create environment files
cp .env.example .env
# Edit .env with your credentials

# Start services with Docker Compose
docker-compose up -d

# Run database migrations
docker-compose exec backend alembic upgrade head

# Create superuser (optional)
docker-compose exec backend python -m app.scripts.create_superuser

# Access the application
# Frontend: http://localhost:3000
# API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### 2. Production Deployment

```bash
# Production server setup
# 1. Install Docker and Docker Compose
# 2. Configure domain and SSL certificates
# 3. Set up environment variables

# Deploy
docker-compose -f docker-compose.prod.yml up -d

# Scale services as needed
docker-compose -f docker-compose.prod.yml up -d --scale worker=4

# Monitor logs
docker-compose -f docker-compose.prod.yml logs -f worker

# Backup database
docker-compose exec postgres pg_dump -U postgres trading_alert_prod > backup.sql
```

### 3. Monitoring and Maintenance

```bash
# Check service health
curl http://localhost/health

# Monitor Redis
docker-compose exec redis redis-cli info

# Monitor PostgreSQL
docker-compose exec postgres psql -U postgres -c "SELECT * FROM pg_stat_activity;"

# View alert metrics
docker-compose exec backend python -m app.scripts.alert_metrics

# Clean up old data
docker-compose exec backend python -m app.scripts.cleanup_old_data
```

This comprehensive implementation guide provides everything needed to build a TradingView-style web application with unlimited alerts, custom indicators, and real-time market data processing. The architecture is scalable, maintainable, and follows best practices for both backend and frontend development.