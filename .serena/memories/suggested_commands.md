# TradingAlert Suggested Commands

## Backend Development Commands

### Running the Backend Server
```bash
# Start backend server (from /home/marek/DQN/TradingAlert/backend)
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Or using the start_server script
python3 start_server.py
```

### Database Commands
```bash
# Run Alembic migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "description"

# Rollback migration
alembic downgrade -1

# View migration history
alembic history
```

### Testing Commands
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/services/test_indicator_registry.py

# Run with coverage
pytest --cov=app --cov-report=html

# Run verbose output
pytest -v

# Run only tests matching pattern
pytest -k "test_crsi" -v
```

### Code Quality Commands
```bash
# Run ruff linter
python3 -m ruff check .

# Run ruff formatter
python3 -m ruff format .

# Run mypy type checker
python3 -m mypy app/

# Run all quality checks
python3 -m ruff check . && python3 -m mypy app/
```

### Dependency Management
```bash
# Install requirements
pip install -r requirements.txt

# Create requirements from current env
pip freeze > requirements.txt
```

## Frontend Development Commands

### Running the Frontend
```bash
# Start dev server (from /home/marek/DQN/TradingAlert/frontend)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Testing Commands
```bash
# Run tests
npm run test

# Run tests with coverage
npm run test -- --coverage

# Run tests in watch mode
npm run test -- --watch

# Run tests matching pattern
npm run test -- IndicatorPane
```

### Code Quality Commands
```bash
# Run ESLint
npm run lint

# Auto-fix ESLint issues
npm run lint -- --fix

# Type checking (built into build)
npm run build
```

### Dependency Management
```bash
# Install dependencies
npm install

# Add new dependency
npm install <package>

# Add dev dependency
npm install -D <package>
```

## Docker Commands

### Starting Services
```bash
# Start all services (from project root)
docker-compose up -d

# Start specific service
docker-compose up -d db

# View logs
docker-compose logs -f backend

# Stop all services
docker-compose down
```

### Database Operations
```bash
# Connect to PostgreSQL
docker-compose exec db psql -U trading -d tradingalert

# Backup database
docker-compose exec db pg_dump -U trading tradingalert > backup.sql

# Restore database
docker-compose exec -T db psql -U trading tradingalert < backup.sql
```

### Redis Operations
```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Monitor Redis commands
docker-compose exec redis redis-cli MONITOR

# Flush all data
docker-compose exec redis redis-cli FLUSHALL
```

## System Utilities (Linux)

### File Operations
```bash
# List files with details
ls -la

# Find files by name
find . -name "*.py"

# Search for files recursively
find . -type f -name "*.py" | head -20

# Count lines in file
wc -l file.py

# View file size
du -sh directory/
```

### Process Management
```bash
# Find running processes
ps aux | grep python

# Kill process by name
pkill -f uvicorn

# List ports in use
netstat -tulpn | grep LISTEN

# Or using ss
ss -tulpn
```

### Git Commands
```bash
# Show working tree status
git status

# Show diff
git diff

# Show log
git log --oneline -10

# Create new branch
git checkout -b branch-name

# Switch branch
git checkout branch-name

# Stash changes
git stash

# Apply stashed changes
git stash pop
```

## Development Workflow

### Typical Backend Development Flow
```bash
# 1. Start services
docker-compose up -d db redis

# 2. Activate virtual environment (if applicable)
source ../.venv/bin/activate

# 3. Run migrations
alembic upgrade head

# 4. Start backend server
python3 -m uvicorn app.main:app --reload

# 5. In another terminal, run tests
pytest -k "test_name"

# 6. Check code quality
python3 -m ruff check . && python3 -m mypy app/
```

### Typical Frontend Development Flow
```bash
# 1. Start backend (if not running)
cd ../backend && python3 -m uvicorn app.main:app --reload

# 2. In another terminal, start frontend
cd frontend && npm run dev

# 3. Run tests in watch mode
npm run test -- --watch

# 4. Check linting
npm run lint
```

### Feature Development Workflow
```bash
# 1. Create feature branch
git checkout -b feat/your-feature

# 2. Make changes and run tests
pytest
npm run test

# 3. Check code quality
python3 -m ruff check .
python3 -m mypy app/
npm run lint

# 4. Stage and commit
git add .
git commit -m "feat(scope): description"

# 5. Push to remote
git push origin feat/your-feature
```

## Project-Specific Scripts

### Backend Scripts (from backend/)
```bash
# Populate test data
python3 populate_real_data.py

# Check for duplicates
python3 check_duplicates.py

# Clean duplicates
python3 clean_sdiv_duplicates_v2.py
```

### Specify Framework Scripts (from project root)
```bash
# Check prerequisites
.specify/scripts/bash/check-prerequisites.sh

# Setup plan mode
.specify/scripts/bash/setup-plan.sh

# Update agent context
.specify/scripts/bash/update-agent-context.sh

# Create new feature
.specify/scripts/bash/create-new-feature.sh
```

## Troubleshooting Commands

### Backend Issues
```bash
# Check if backend is running
curl http://localhost:8000/health

# Check database connection
docker-compose exec db pg_isready -U trading

# View backend logs
docker-compose logs -f backend

# Check Redis connection
docker-compose exec redis redis-cli ping
```

### Frontend Issues
```bash
# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf dist
npm run dev

# Check port availability
ss -tulpn | grep :5173
```

### Database Issues
```bash
# Reset database (WARNING: destroys data)
docker-compose down -v
docker-compose up -d db
alembic upgrade head

# View database size
docker-compose exec db psql -U trading -d tradingalert -c "SELECT pg_size_pretty(pg_database_size('tradingalert'));"
```
