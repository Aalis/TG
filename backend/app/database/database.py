from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import QueuePool

from app.core.config import settings

# Convert PostgresDsn to string for SQLAlchemy
SQLALCHEMY_DATABASE_URL = str(settings.DATABASE_URL)

# Create SQLAlchemy engine with increased connection pool settings
# pool_size: Number of permanent connections to keep in the pool
# max_overflow: Maximum number of connections to create above pool_size
# pool_timeout: Seconds to wait before giving up on getting a connection from the pool
# pool_recycle: Seconds after which a connection is automatically recycled (helps with stale connections)
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    pool_size=20,           # Increased from 5 to 20 permanent connections
    max_overflow=30,        # Increased from 10 to 30 overflow connections
    pool_timeout=30,        # 30 seconds timeout when waiting for a connection
    pool_recycle=1800,      # Recycle connections after 30 minutes
    poolclass=QueuePool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close() 