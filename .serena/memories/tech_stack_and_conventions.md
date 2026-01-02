# TradingAlert Tech Stack and Code Conventions

## Backend Stack

### Core Technologies
- **Python**: 3.11+
- **Web Framework**: FastAPI 0.104+
- **Database**: PostgreSQL with SQLAlchemy 2.0+ (async with asyncpg driver)
- **Caching**: Redis 5.0+
- **Data Processing**: pandas 2.1+, numpy 1.26+
- **Indicators**: pandas-ta 0.3.14b0+
- **Market Data**: yfinance 1.0+
- **Async Runtime**: asyncio + uvicorn[standard]

### Key Libraries
- `pydantic` 2.5.0 - Data validation
- `alembic` 1.13.1 - Database migrations
- `python-jose` - JWT authentication
- `passlib` - Password hashing
- `aiohttp` 3.9.1 - Async HTTP client
- `pytz` - Timezone handling

## Frontend Stack

### Core Technologies
- **Framework**: React 19.2.0
- **Language**: TypeScript 5.9+
- **Build Tool**: Vite 7.2+
- **Testing**: Vitest 4.0+ + React Testing Library

### UI Libraries
- **Charts**: lightweight-charts 5.1.0
- **Components**: Radix UI (dialogs, dropdowns, tabs, etc.)
- **Styling**: Tailwind CSS 3.4+ + shadcn/ui
- **Icons**: lucide-react
- **DnD**: @dnd-kit for drag-and-drop
- **Notifications**: sonner

### Dev Tools
- **Linting**: ESLint 9.39+
- **Type Checking**: TypeScript
- **Testing**: Vitest + jsdom

## Code Conventions

### Python Backend

#### Naming
- **Modules**: `snake_case` (e.g., `indicator_registry.py`)
- **Classes**: `PascalCase` (e.g., `IndicatorRegistry`)
- **Functions/Variables**: `snake_case` (e.g., `get_indicator`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_TIMEFRAME`)

#### Type Hints
- All functions must have type hints
- Use `typing` module for complex types (List, Dict, Optional, etc.)
- Return types always specified

```python
async def get_indicator(name: str, **params: Any) -> Indicator:
    """Get indicator instance by name."""
    pass
```

#### Docstrings
- Use Google-style docstrings
- All public functions/classes must have docstrings

```python
def compute(self, df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute indicator values.

    Args:
        df: DataFrame with OHLCV columns

    Returns:
        DataFrame with indicator columns added
    """
    pass
```

#### Async/Await
- All database operations must be async
- Use `AsyncSession` for DB sessions
- Use `async/await` for I/O operations

```python
async def get_candles(symbol: str, timeframe: str) -> List[Candle]:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Candle).where(...))
        return result.scalars().all()
```

#### Error Handling
- Use specific exception types
- Log errors with context
- Raise `HTTPException` for API errors

### TypeScript Frontend

#### Naming
- **Components**: `PascalCase` (e.g., `IndicatorDialog.tsx`)
- **Functions/Variables**: `camelCase` (e.g., `useIndicatorData`)
- **Types/Interfaces**: `PascalCase` (e.g., `IndicatorConfig`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_INTERVAL`)

#### Type Safety
- Strict TypeScript mode enabled
- Avoid `any` - use proper types or `unknown`
- Interface for component props

```typescript
interface IndicatorDialogProps {
  indicator: Indicator;
  onSave: (config: IndicatorConfig) => void;
  onCancel: () => void;
}
```

#### Hooks
- Custom hooks named with `use` prefix
- Return consistent shape: `{ data, loading, error }`

```typescript
export function useIndicatorData(symbol: string, timeframe: string) {
  const [data, setData] = useState<IndicatorData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  return { data, loading, error, refetch };
}
```

#### Component Structure
- Functional components with hooks
- Props destructured with types
- Early returns for loading/error states

```typescript
export const IndicatorPane: React.FC<IndicatorPaneProps> = ({
  indicators,
  onUpdate,
  onRemove
}) => {
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return <div>...</div>;
};
```

## File Organization

### Backend Structure
```
backend/
├── app/
│   ├── api/           # API route handlers
│   ├── core/          # Configuration, security
│   ├── db/            # Database session management
│   ├── models/        # SQLAlchemy models
│   ├── schemas/       # Pydantic schemas
│   ├── services/      # Business logic
│   └── tasks/         # Background tasks
├── tests/             # Test suites
├── alembic/           # Database migrations
└── requirements.txt   # Python dependencies
```

### Frontend Structure
```
frontend/
├── src/
│   ├── api/           # API client functions
│   ├── components/    # React components
│   ├── hooks/         # Custom hooks
│   ├── lib/           # Utilities
│   ├── types/         # TypeScript types
│   └── utils/         # Helper functions
├── tests/             # Test suites
└── package.json       # Node dependencies
```

## Git Conventions

### Branch Naming
- Feature branches: `feat/feature-name`
- Bugfix branches: `fix/bug-description`
- Spec branches: `###-feature-name` (e.g., `010-pandas-ta-indicators`)

### Commit Messages
- Format: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
- Examples:
  - `feat(indicators): add pandas-ta integration`
  - `fix(api): handle missing ticker gracefully`
  - `test(frontend): add IndicatorPane tests`
