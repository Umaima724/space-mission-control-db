"""Application configuration using Pydantic Settings."""
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    db_user: str = "SPACE_ADMIN"
    db_password: str = "password"
    db_dsn: str = "localhost:1521/xe"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    settings = Settings()
    print(f"DEBUG: DSN = '{settings.db_dsn}'")  # Check for hidden quotes!
    return settings
