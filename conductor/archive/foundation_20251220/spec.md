# Specification: Foundation & Core Alerting Infrastructure

## 1. Overview
This track establishes the technological bedrock for the "TradingAlert" platform. It focuses on initializing the Python/FastAPI backend, the React/TypeScript frontend, and the PostgreSQL/Redis data layer. Crucially, it implements the first end-to-end data pipeline: fetching OHLCV candle data from the Alpha Vantage (free) API, storing it, and enabling a basic "Price Crossover" alert to verify the alerting engine's core logic.

## 2. Goals
- **Scaffold Project Structure:** Create the repository structure for backend (Python) and frontend (React).
- **Database Initialization:** Set up PostgreSQL for persistence (Users, Alerts, Market Data) and Redis for caching/messaging.
- **Market Data Integration:** Implement a service to fetch and normalize OHLCV data from Alpha Vantage.
- **Basic Alert Engine:** Build a rudimentary engine that can evaluate a simple condition (e.g., "Close > Moving Average" or "Close > X").
- **Frontend Dashboard MVP:** Create a minimal UI to view a chart and set a simple alert.

## 3. Key Components

### 3.1. Backend (FastAPI)
- **API Setup:** Initialize FastAPI with CORS, basic error handling, and environment configuration.
- **Models (Pydantic/SQLAlchemy):** Define models for `User`, `Alert`, `Symbol`, and `Candle`.
- **Alpha Vantage Client:** Create a wrapper around the Alpha Vantage API to fetch data (respecting free tier limits).
- **Websockets:** Set up a WebSocket endpoint to stream (simulated or real) price updates to the frontend.

### 3.2. Data Layer
- **PostgreSQL:**
  - `users`: Basic auth (placeholder for now).
  - `alerts`: Stores alert definitions (symbol, condition, threshold).
  - `market_data`: Stores historical candles.
- **Redis:**
  - Used for queuing alert processing tasks (Celery or simple background tasks).

### 3.3. Frontend (React + TypeScript)
- **Scaffold:** Initialize with Vite.
- **Charting:** Integrate `lightweight-charts` to display a basic candlestick chart.
- **Alert Form:** A simple form to input a symbol and a price threshold for an alert.
- **Alert List:** A view to see active and triggered alerts.

### 3.4. Alert Engine Logic (MVP)
- A background process that:
  1. Checks for new market data.
  2. Retrieves active alerts for the updated symbol.
  3. Evaluates the condition (e.g., `current_price > threshold`).
  4. Logs the result (Triggered/Not Triggered).

## 4. Non-Functional Requirements
- **Modularity:** Ensure the data source (Alpha Vantage) is decoupled so it can be swapped later.
- **Scalability:** Design the alert engine to handle multiple alerts efficiently (even if MVP is single-threaded).
- **Type Safety:** Strict typing in Python (Pydantic) and TypeScript.

## 5. Success Criteria
- Backend is running and serving API endpoints.
- Frontend is running and displaying a chart with data from Alpha Vantage.
- A user can set a "Price > X" alert via the UI.
- When the mock/real price crosses X, the system logs a "ALERT TRIGGERED" message.
