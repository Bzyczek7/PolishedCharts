# Plan: Foundation & Core Alerting Infrastructure

## Phase 1: Project Initialization & Backend Setup [checkpoint: 2a37977]
- [x] Task: Initialize project structure (monorepo or separate folders) and Docker Compose configuration for PostgreSQL and Redis. be8ddd5
- [x] Task: Set up FastAPI application skeleton with Pydantic settings management and database connection logic (SQLAlchemy/AsyncPG). 520f93d
- [x] Task: Define initial database models (`User`, `Alert`, `Symbol`, `Candle`) and run migrations (Alembic). 0d04547
- [x] Task: Conductor - User Manual Verification 'Project Initialization & Backend Setup' (Protocol in workflow.md) 2a37977

## Phase 2: Market Data Integration (Alpha Vantage) [checkpoint: e17e263]
- [x] Task: Create a service/module to fetch daily/intraday OHLCV data from Alpha Vantage API. 763d7c2
- [x] Task: Implement a background scheduler (or simple loop) to poll Alpha Vantage for updates (respecting rate limits). 93bcd07
- [x] Task: Create an API endpoint (`GET /api/candles/{symbol}`) to serve stored candle data to the frontend. bd1eec0
- [x] Task: Conductor - User Manual Verification 'Market Data Integration (Alpha Vantage)' (Protocol in workflow.md) e17e263

## Phase 3: Frontend Scaffold & Charting [checkpoint: a19f57e]
- [x] Task: Initialize React application using Vite with TypeScript and Tailwind CSS. c1aa31c
- [x] Task: Implement a basic API client (axios/fetch) to communicate with the FastAPI backend. 55bf6be
- [x] Task: Create a `ChartComponent` using `lightweight-charts` that fetches and displays candle data for a hardcoded symbol (e.g., "IBM"). 9959977
- [x] Task: Conductor - User Manual Verification 'Frontend Scaffold & Charting' (Protocol in workflow.md) a19f57e

## Phase 4: Basic Alert Engine & End-to-End Test
- [x] Task: Implement the "Create Alert" API endpoint (`POST /api/alerts`) and corresponding frontend form. b0dfc88
- [~] Task: Implement the Alert Engine logic: a service that evaluates active alerts against the latest market data.
- [ ] Task: Connect the engine to the data poller: when new data arrives, trigger the evaluation logic.
- [ ] Task: Verify the flow: Set an alert -> Update data (mock or real) -> Verify "ALERT TRIGGERED" log/state change.
- [ ] Task: Conductor - User Manual Verification 'Basic Alert Engine & End-to-End Test' (Protocol in workflow.md)
