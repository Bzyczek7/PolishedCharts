# Tech Stack - TradingAlert

## Backend
- **Language:** Python 3.10+
- **Framework:** FastAPI (for high-performance API endpoints)
- **Data Processing:** Pandas, NumPy
- **Technical Analysis:** TA-Lib or Pandas-TA
- **Task Queue/Real-time:** Redis (for pub/sub alerting and caching)

## Frontend
- **Framework:** React (TypeScript)
- **State Management:** Redux Toolkit or Zustand
- **Charting:** Lightweight Charts (by TradingView)
- **Styling:** Tailwind CSS (for rapid UI development)
- **Icons:** Lucide React

## Database
- **Primary Database:** PostgreSQL (for users, alert configurations, and metadata)
- **Caching/Messaging:** Redis

## Infrastructure
- **Containerization:** Docker & Docker Compose
- **Real-time Data:** WebSockets (via FastAPI)
