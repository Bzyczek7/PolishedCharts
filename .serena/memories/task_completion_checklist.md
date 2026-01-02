# TradingAlert Task Completion Checklist

Use this checklist when completing tasks to ensure code quality and consistency.

## Pre-Implementation Checklist

- [ ] **Understand Requirements**
  - Read and understand the feature specification
  - Identify dependencies and potential conflicts
  - Ask clarifying questions if needed

- [ ] **Plan the Approach**
  - Break down the task into smaller steps
  - Identify affected files and modules
  - Consider backward compatibility

## Implementation Checklist

### Backend Tasks

- [ ] **Code Implementation**
  - Follow Python naming conventions (snake_case for functions/variables)
  - Add type hints to all functions
  - Include Google-style docstrings for public functions/classes
  - Use async/await for I/O operations
  - Handle errors appropriately with specific exception types

- [ ] **Database Changes**
  - Create Alembic migration if schema changes are needed
  - Test migration up and down
  - Update SQLAlchemy models if needed
  - Update Pydantic schemas for API endpoints

- [ ] **API Endpoints**
  - Add new routes to appropriate router modules
  - Include proper HTTP status codes
  - Add request/response models with Pydantic
  - Handle CORS properly

- [ ] **Testing**
  - Write unit tests for new functions
  - Write integration tests for API endpoints
  - Test error cases and edge cases
  - Ensure all tests pass: `pytest`

### Frontend Tasks

- [ ] **Code Implementation**
  - Follow TypeScript naming conventions (PascalCase for components, camelCase for functions)
  - Define proper TypeScript interfaces for props
  - Use functional components with hooks
  - Handle loading and error states

- [ ] **API Integration**
  - Create/update API client functions in `src/api/`
  - Handle errors gracefully
  - Add proper loading states

- [ ] **Testing**
  - Write component tests with React Testing Library
  - Test user interactions and state changes
  - Ensure all tests pass: `npm run test`

## Post-Implementation Checklist

- [ ] **Code Quality**
  - Backend: Run linter `python3 -m ruff check .`
  - Backend: Run type checker `python3 -m mypy app/`
  - Frontend: Run linter `npm run lint`
  - Fix any issues found

- [ ] **Testing**
  - Run all backend tests: `pytest`
  - Run all frontend tests: `npm run test`
  - Verify no regressions in existing functionality

- [ ] **Build Verification**
  - Backend: Verify server starts without errors
  - Frontend: Run `npm run build` to ensure production build works
  - Check for console errors in browser

- [ ] **Manual Testing**
  - Test the feature manually in the browser
  - Test edge cases and error scenarios
  - Verify UI/UX is correct

- [ ] **Documentation**
  - Update relevant documentation if needed
  - Add comments for complex logic
  - Ensure docstrings are accurate

- [ ] **Cleanup**
  - Remove any temporary/test files
  - Remove debugging statements (console.log, print statements, etc.)
  - Clean up unused imports

- [ ] **Git Commit**
  - Stage changes: `git add .`
  - Write clear commit message following convention
  - Format: `type(scope): description`
  - Examples:
    - `feat(indicators): add pandas-ta Bollinger Bands`
    - `fix(api): handle missing ticker in watchlist`
    - `refactor(frontend): extract indicator logic to custom hook`

## Code Review Checklist

When reviewing code (yours or others), check for:

### Backend
- [ ] Proper async/await usage
- [ ] Type hints on all functions
- [ ] Docstrings on public functions/classes
- [ ] Error handling with specific exceptions
- [ ] Database queries use async session
- [ ] SQL injection protection (use parameterized queries)
- [ ] No hardcoded secrets or credentials

### Frontend
- [ ] Proper TypeScript types (no `any` without good reason)
- [ ] Components properly typed with interfaces
- [ ] No memory leaks (proper cleanup in useEffect)
- [ ] Loading and error states handled
- [ ] Accessibility considerations (ARIA labels, keyboard navigation)
- [ ] Responsive design (Tailwind classes)

### Security
- [ ] No exposed secrets in code
- [ ] Proper input validation
- [ ] SQL injection prevention
- [ ] XSS prevention (React auto-escapes, but be careful with dangerouslySetInnerHTML)
- [ ] CORS configuration correct

### Performance
- [ ] No unnecessary re-renders (use memo, useMemo, useCallback)
- [ ] Efficient database queries (use indexes, avoid N+1 queries)
- [ ] Pagination for large datasets
- [ ] Image assets optimized

## Feature-Specific Checklists

### Indicator Implementation
- [ ] Indicator class inherits from base properly
- [ ] `compute()` method returns DataFrame with indicator columns
- [ ] `get_required_columns()` returns correct column list
- [ ] Indicator registered in registry
- [ ] Tests cover computation accuracy
- [ ] Tests handle edge cases (insufficient data, NaN values)
- [ ] Frontend can display indicator correctly
- [ ] Alert templates work with indicator

### API Endpoint Implementation
- [ ] Route added to appropriate router
- [ ] Request model validates input
- [ ] Response model serializes correctly
- [ ] Authentication/authorization check if needed
- [ ] Error responses return proper HTTP status codes
- [ ] Integration tests cover endpoint

### Database Schema Change
- [ ] Alembic migration created
- [ ] Migration tested up and down
- [ ] Model updated with new columns/tables
- [ ] Pydantic schemas updated
- [ ] Backward compatibility considered
- [ ] Data migration script if needed

### Alert Type Implementation
- [ ] AlertConditionType enum updated
- [ ] Alert engine evaluates condition correctly
- [ ] Throttling works properly
- [ ] Alert trigger records created
- [ ] WebSocket notifications sent
- [ ] Frontend can create/edit/delete alert
- [ ] Tests cover trigger scenarios

## Common Pitfalls to Avoid

1. **Forgetting to handle async operations** - Always use `await` for async functions
2. **Missing error handling** - Always wrap risky operations in try/except
3. **Hardcoding values** - Use constants or configuration
4. **Forgetting to clean up** - Remove test files and debug code
5. **Skipping tests** - Write tests for new functionality
6. **Breaking changes** - Consider backward compatibility
7. **Race conditions** - Be careful with concurrent operations
8. **Memory leaks** - Properly close connections and clean up resources
9. **SQL injection** - Use parameterized queries, never string concatenation
10. **XSS vulnerabilities** - Validate and sanitize user input

## Sign-Off Criteria

A task is complete when:
- All functional requirements are met
- All tests pass (backend and frontend)
- Code quality checks pass (linting, type checking)
- Manual testing confirms it works
- Code is committed with clear message
- No temporary files or debug code remain
- Documentation is updated if needed
