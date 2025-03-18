#!/usr/bin/env python3
"""
Health check script to verify database and Redis connections.
This is helpful for diagnosing connection issues during deployment.
"""
import os
import logging
import sys
import time

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('health_check')

def check_postgres():
    """Check PostgreSQL connection"""
    try:
        import psycopg2
        from app.core.config import settings
        
        # Get database URL from environment or settings
        db_url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)
        
        # Log the host part of the URL (hide credentials)
        db_host = db_url.split('@')[-1].split('/')[0]
        logger.info(f"Checking PostgreSQL connection to {db_host}")
        
        # Try to connect
        conn = psycopg2.connect(db_url)
        cursor = conn.cursor()
        
        # Test query
        cursor.execute("SELECT version();")
        version = cursor.fetchone()
        logger.info(f"PostgreSQL connection successful: {version[0]}")
        
        # Check for tables
        cursor.execute("""
            SELECT tablename FROM pg_catalog.pg_tables
            WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
        """)
        tables = cursor.fetchall()
        logger.info(f"Found {len(tables)} tables in the database")
        
        cursor.close()
        conn.close()
        return True
    except ImportError as e:
        logger.error(f"PostgreSQL driver not installed: {e}")
        return False
    except Exception as e:
        logger.error(f"PostgreSQL connection error: {e}")
        return False

def check_redis():
    """Check Redis connection"""
    try:
        import redis
        from app.core.config import settings
        
        # Get Redis connection details
        redis_host = os.environ.get("REDIS_HOST", settings.REDIS_HOST)
        redis_port = int(os.environ.get("REDIS_PORT", settings.REDIS_PORT))
        redis_db = int(os.environ.get("REDIS_DB", settings.REDIS_DB))
        redis_password = os.environ.get("REDIS_PASSWORD", settings.REDIS_PASSWORD)
        
        logger.info(f"Checking Redis connection to {redis_host}:{redis_port}")
        
        # Try to connect
        r = redis.Redis(
            host=redis_host,
            port=redis_port,
            db=redis_db,
            password=redis_password,
            socket_timeout=5
        )
        
        # Test connection
        r.ping()
        logger.info("Redis connection successful")
        
        # Test set/get
        r.set('health_check', 'ok')
        value = r.get('health_check')
        logger.info(f"Redis set/get test: {value}")
        
        return True
    except ImportError as e:
        logger.error(f"Redis driver not installed: {e}")
        return False
    except Exception as e:
        logger.error(f"Redis connection error: {e}")
        return False

def main():
    """Run all health checks"""
    logger.info("Starting health checks...")
    
    postgres_ok = check_postgres()
    redis_ok = check_redis()
    
    if postgres_ok and redis_ok:
        logger.info("All health checks passed!")
        return 0
    else:
        logger.error("Some health checks failed!")
        return 1

if __name__ == "__main__":
    # Add retries with backoff
    max_retries = 3
    retry_delay = 2  # seconds
    
    for attempt in range(max_retries):
        try:
            exit_code = main()
            sys.exit(exit_code)
        except Exception as e:
            logger.error(f"Health check error: {e}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_delay} seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(retry_delay)
                retry_delay *= 2  # Exponential backoff
            else:
                logger.error("Max retries reached. Health check failed.")
                sys.exit(1) 