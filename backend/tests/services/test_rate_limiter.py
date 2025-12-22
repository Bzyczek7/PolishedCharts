import pytest
import asyncio
import time
from app.services.rate_limiter import RateLimiter, rate_limit

@pytest.mark.asyncio
async def test_rate_limiter_allows_burst():
    # 2 requests per 1 second
    limiter = RateLimiter(2, 1.0)
    
    start = time.monotonic()
    await limiter.acquire()
    await limiter.acquire()
    end = time.monotonic()
    
    # Should be almost instantaneous
    assert (end - start) < 0.1

@pytest.mark.asyncio
async def test_rate_limiter_blocks_excessive_requests():
    # 1 request per 0.5 second
    limiter = RateLimiter(1, 0.5)
    
    await limiter.acquire() # Immediate
    
    start = time.monotonic()
    await limiter.acquire() # Should wait ~0.5s
    end = time.monotonic()
    
    assert (end - start) >= 0.4

@pytest.mark.asyncio
async def test_rate_limit_decorator():
    limiter = RateLimiter(1, 0.5)
    
    calls = []
    
    @rate_limit(limiter)
    async def limited_func():
        calls.append(time.monotonic())
        
    await limited_func()
    await limited_func()
    
    assert len(calls) == 2
    assert (calls[1] - calls[0]) >= 0.4
