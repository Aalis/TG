from typing import Any, List, Optional, Union
import os

from pydantic import AnyHttpUrl, PostgresDsn, validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "TG Parser API"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8  # 8 days
    SERVER_HOST: str = "http://localhost:8000"  # Change this in production
    FRONTEND_URL: str = "http://localhost:3000"  # Change this in production
    
    # CORS
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = []

    @validator("BACKEND_CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    @validator("SERVER_HOST", pre=True)
    def validate_server_host(cls, v: str) -> str:
        # For Railway deployment, get from environment or construct from RAILWAY_STATIC_URL
        if os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_STATIC_URL"):
            # First check if SERVER_HOST is explicitly set in env
            if os.environ.get("SERVER_HOST"):
                return os.environ.get("SERVER_HOST")
                
            # For Railway, use their provided URL or fallback to a constructed one
            railway_url = os.environ.get("RAILWAY_PUBLIC_DOMAIN")
            if railway_url:
                return f"https://{railway_url}"
                
            # Use RAILWAY_STATIC_URL as last resort (removing any path components)
            static_url = os.environ.get("RAILWAY_STATIC_URL")
            if static_url and static_url.startswith("https://"):
                # Extract just the domain part
                from urllib.parse import urlparse
                parsed = urlparse(static_url)
                return f"{parsed.scheme}://{parsed.netloc}"
        
        # Return the original value if no Railway environment is detected
        return v
        
    @validator("FRONTEND_URL", pre=True)
    def validate_frontend_url(cls, v: str, values: dict) -> str:
        # For Railway deployment, match SERVER_HOST if not explicitly set
        if os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_STATIC_URL"):
            # First check if FRONTEND_URL is explicitly set in env
            if os.environ.get("FRONTEND_URL"):
                return os.environ.get("FRONTEND_URL")
                
            # In most deployments, frontend and backend share the same host
            server_host = values.get("SERVER_HOST")
            if server_host and not server_host.startswith("http://localhost"):
                return server_host
        
        # Return the original value if no Railway environment is detected
        return v

    # Database
    DATABASE_URL: Optional[PostgresDsn] = None
    POSTGRES_USER: Optional[str] = None
    POSTGRES_PASSWORD: Optional[str] = None
    POSTGRES_DB: Optional[str] = None
    
    @validator("DATABASE_URL", pre=True)
    def assemble_db_url(cls, v: Optional[str], values: dict) -> Any:
        if v is not None:
            return v
        
        # For Railway deployment
        if os.environ.get("RAILWAY_ENVIRONMENT") or os.environ.get("RAILWAY_STATIC_URL"):
            # Use Railway PostgreSQL
            user = values.get("POSTGRES_USER") or os.environ.get("POSTGRES_USER") or "postgres"
            password = values.get("POSTGRES_PASSWORD") or os.environ.get("POSTGRES_PASSWORD") or ""
            db = values.get("POSTGRES_DB") or os.environ.get("POSTGRES_DB") or "railway"
            
            # Use the Railway PostgreSQL hostname
            return f"postgresql://{user}:{password}@postgresql.railway.app:5432/{db}"

        # Local development or other environments
        user = values.get("POSTGRES_USER")
        password = values.get("POSTGRES_PASSWORD")
        db = values.get("POSTGRES_DB")
        
        if not all([user, password, db]):
            return None
            
        return f"postgresql://{user}:{password}@localhost:5432/{db}"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: Optional[str] = None
    REDIS_CLIENT_EXPIRY: int = 300  # 5 minutes in seconds

    # Telegram API
    API_ID: Optional[str] = None
    API_HASH: Optional[str] = None
    TELEGRAM_BOT_TOKENS: str

    # Email Settings
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_TLS: bool = True
    MAIL_SSL: bool = False

    class Config:
        env_file = ".env"


settings = Settings() 