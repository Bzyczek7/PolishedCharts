# Research: Alarm Notification System

**Feature**: 013-alarm-notifications
**Created**: 2025-12-31

## Research Questions

### Q1: Toast Notification Library

**Question**: What is the best lightweight toast notification library for React 19?

**Findings**:
- **react-hot-toast**: Most popular, 4.3KB gzipped, excellent TypeScript support
- **sonner**: Modern, 2KB gzipped, minimal API, good animations
- **react-toastify**: Larger (7KB), more features, good accessibility

**Decision**: react-hot-toast
**Rationale**: Best balance of size, features, and TypeScript support. Active maintenance.

### Q2: Sound Notification Approach

**Question**: How to handle browser autoplay policies for sound notifications?

**Findings**:
- Modern browsers block audio without user interaction
- Solution: Request permission on first user click
- Store permission state in localStorage
- Use HTML5 Audio API (no library needed)

**Decision**: HTML5 Audio with permission request
**Rationale**: Native browser support, no external dependencies, works offline

### Q3: Telegram Integration

**Question**: Best approach for Telegram bot integration in Python?

**Findings**:
- **python-telegram-bot**: Full library, async support, but adds dependency
- **requests + Bot API HTTP**: Lightweight, no new dependency
- **aiohttp + Bot API**: Async without library

**Decision**: Direct HTTP requests to Bot API
**Rationale**: Minimal dependency footprint, sufficient for simple message sending

## Technology Decisions

| Component | Decision | Rationale |
|-----------|----------|-----------|
| Toast library | react-hot-toast | Lightweight, TypeScript, customizable |
| Sound | HTML5 Audio API | Native, no deps, works offline |
| Telegram | HTTP + Bot API | Minimal dependencies |
| Preferences storage | localStorage (guest) / DB (auth) | Consistent with existing pattern |

## Alternatives Considered

### Toast Alternatives
- **sonner**: Smaller but fewer customization options
- **react-toastify**: Too large for simple use case

### Sound Alternatives
- **Howler.js**: 7KB library, more features, overkill for simple sounds
- **Web Audio API**: More powerful but more complex

### Telegram Alternatives
- **python-telegram-bot**: Adds dependency, async complexity
- **webhook approach**: Requires HTTPS endpoint, more complex setup

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Toast (Notifications API) | 70+ | 70+ | 14+ | 79+ |
| HTML5 Audio | All | All | All | All |
| Autoplay policy | Limited | Limited | Limited | Limited |

## Security Considerations

1. **Telegram tokens**: Store encrypted in DB, never log
2. **Sound files**: Bundle with app, no external loading
3. **Toast content**: Sanitize user input (alert names)

## Performance Impact

| Operation | Estimated Time | Notes |
|-----------|---------------|-------|
| Toast show | < 50ms | Client-side only |
| Sound play | < 100ms | Audio loading on first use |
| Telegram send | 500-2000ms | Network-dependent |

## References

- [react-hot-toast docs](https://react-hot-toast.com/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [HTML5 Audio](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/audio)
- [Browser Autoplay Policy](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide)
