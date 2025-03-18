import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database.models import Base
from app.core.config import settings
from app.database.database import engine
from sqlalchemy_utils import database_exists, create_database
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_db():
    """Initialize the database with retry logic for Railway deployment"""
    max_retries = 5
    retry_interval = 5  # seconds
    
    for attempt in range(max_retries):
        try:
            logger.info("Checking database connection...")
            
            # Try to connect to the database
            url = os.environ.get("DATABASE_URL", settings.DATABASE_URL)
            logger.info(f"Using database URL: {url.replace('://', '://[user]:[pass]@')}")
            
            # Check if database exists, if not, create it
            if not database_exists(url):
                logger.info("Database does not exist, creating...")
                create_database(url)
                logger.info("Database created.")
            
            # Create the tables
            logger.info("Creating database tables...")
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables created successfully.")
            
            return True
        except Exception as e:
            logger.error(f"Database initialization error: {e}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {retry_interval} seconds... (Attempt {attempt + 1}/{max_retries})")
                time.sleep(retry_interval)
            else:
                logger.error("Max retries reached. Database initialization failed.")
                raise

if __name__ == "__main__":
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully.") 