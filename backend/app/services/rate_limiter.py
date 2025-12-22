import asyncio
import time
import logging
from functools import wraps

logger = logging.getLogger(__name__)

class RateLimiter:
    """
    Simple token bucket rate limiter for asyncio.
    """
    def __init__(self, requests_per_period: int, period: float):
        self.requests_per_period = requests_per_period
        self.period = period
        self.tokens = requests_per_period
        self.last_refill = time.monotonic()
        self._lock = asyncio.Lock()

    async def acquire(self):
        async with self._lock:
            while self.tokens <= 0:
                self._refill()
                if self.tokens <= 0:
                    # Wait for a fraction of the period
                    await asyncio.sleep(self.period / self.requests_per_period)
            
            self.tokens -= 1

    def _refill(self):
        now = time.monotonic()
        elapsed = now - self.last_refill
        new_tokens = elapsed * (self.requests_per_period / self.period)
        if new_tokens >= 1:
            self.tokens = min(self.requests_per_period, self.tokens + new_tokens)
            self.last_refill = now

def rate_limit(limiter: RateLimiter):
    """
    Decorator to apply rate limiting to an async function.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            await limiter.acquire()
            return await func(*args, **kwargs)
        return wrapper
    return decorator
