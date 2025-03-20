from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import redis
import time
from typing import Dict, Any

from app.api.deps import get_db
from app.core.config import settings

router = APIRouter()

@router.get("/health/latency")
def check_latency(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Check latency for database and Redis connections
    """
    # Check database latency
    db_start = time.time()
    try:
        # Simple query to check database connection
        db.execute("SELECT 1")
        db_latency = (time.time() - db_start) * 1000  # Convert to milliseconds
        db_status = "ok"
    except Exception as e:
        db_latency = 0
        db_status = f"error: {str(e)}"

    # Check Redis latency
    redis_client = redis.Redis(
        host=settings.REDIS_HOST,
        port=settings.REDIS_PORT,
        db=settings.REDIS_DB,
        decode_responses=True
    )
    
    redis_start = time.time()
    try:
        redis_client.ping()
        redis_latency = (time.time() - redis_start) * 1000  # Convert to milliseconds
        redis_status = "ok"
    except Exception as e:
        redis_latency = 0
        redis_status = f"error: {str(e)}"
    finally:
        redis_client.close()

    return {
        "database": {
            "status": db_status,
            "latency_ms": round(db_latency, 2)
        },
        "redis": {
            "status": redis_status,
            "latency_ms": round(redis_latency, 2)
        },
        "timestamp": time.time(),
        "redis_config": {
            "host": settings.REDIS_HOST,
            "port": settings.REDIS_PORT,
            "db": settings.REDIS_DB
        }
    } 