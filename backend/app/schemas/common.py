"""Common schemas used across the application."""

from pydantic import BaseModel
from typing import Optional


class ErrorDetail(BaseModel):
    """Standard error response schema."""
    code: Optional[str] = None
    message: str
    served_from_cached: bool = False
    retry_after: Optional[int] = None  # Seconds to wait before retrying
