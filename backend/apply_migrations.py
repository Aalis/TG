import os
import sys
from alembic import command
from alembic.config import Config

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Create Alembic configuration
alembic_cfg = Config(os.path.join(os.path.dirname(__file__), 'alembic.ini'))

# Apply all migrations
print("Applying migrations...")
command.upgrade(alembic_cfg, "head")
print("Migrations applied successfully!") 