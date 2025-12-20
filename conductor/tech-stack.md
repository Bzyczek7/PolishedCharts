# Tech Stack - TradingAlert

## Backend
- **Language:** Python 3.10+
- **Framework:** FastAPI (for high-performance API endpoints)
- **Data Processing:** Pandas, NumPy
- **Technical Analysis:** TA-Lib or Pandas-TA (Planned)
- **Task Queue/Real-time:** Redis (for pub/sub alerting and caching)
- **Background Tasks:** asyncio.create_task (for polling)

## Frontend
- **Framework:** React (TypeScript)
- **State Management:** React Hooks/Context API (MVP)
- **Charting:** Lightweight Charts v5 (by TradingView)
- **Styling:** Tailwind CSS (for rapid UI development)
- **Icons:** Lucide React

## Database
- **Primary Database:** PostgreSQL (for users, alert configurations, and metadata)
- **Caching/Messaging:** Redis

## Infrastructure
- **Containerization:** Docker & Docker Compose (Planned, Local PostgreSQL used)
- **Real-time Data:** WebSockets (via FastAPI)
