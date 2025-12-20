from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "TradingAlert"
    API_V1_STR: str = "/api/v1"
    
    POSTGRES_USER: str = "trading"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "tradingalert"
    POSTGRES_SERVER: str = "localhost"
    DATABASE_URL: Optional[str] = None
    
    ALPHA_VANTAGE_API_KEY: str = "demo"
    @property
    def async_database_url(self) -> str:
        if self.DATABASE_URL:
            return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}/{self.POSTGRES_DB}"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        env_file=".env",
        extra="ignore"
    )

settings = Settings()
