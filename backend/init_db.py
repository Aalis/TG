import os
import sys
import importlib.util

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.config import settings
from app.schemas.user import UserCreate
from app.crud.user import create as create_user
from app.database.models import Base

def init_db():
    from app.database.database import SessionLocal, engine
    
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    # Check if alembic is installed
    alembic_installed = importlib.util.find_spec("alembic") is not None
    
    if alembic_installed:
        try:
            from alembic import command
            from alembic.config import Config
            
            # Create Alembic configuration
            alembic_cfg = Config(os.path.join(os.path.dirname(__file__), 'alembic.ini'))
            
            print("Applying migrations...")
            command.upgrade(alembic_cfg, "head")
        except ImportError as e:
            print(f"Warning: Could not import Alembic modules: {e}")
            print("Skipping migrations, but tables will still be created.")
    else:
        print("Alembic not installed. Skipping migrations, but tables will still be created.")
    
    db = SessionLocal()
    
    try:
        print("Creating superuser...")
        # Check if superuser already exists
        from app.crud.user import get_by_username
        superuser = get_by_username(db, username="admin")
        
        if not superuser:
            user_in = UserCreate(
                email="admin@example.com",
                username="admin",
                password="admin123",
                is_superuser=True,
            )
            create_user(db, obj_in=user_in)
            print("Superuser created successfully!")
        else:
            print("Superuser already exists.")
    finally:
        db.close()
    
    print("Database initialization completed!")


if __name__ == "__main__":
    init_db() 