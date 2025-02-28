import os
import sys
from alembic import command
from alembic.config import Config

# Add the parent directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Create Alembic configuration
alembic_cfg = Config(os.path.join(os.path.dirname(__file__), 'alembic.ini'))

# Create initial migration
print("Creating initial migration...")
command.revision(alembic_cfg, 
                 message="Initial database setup", 
                 autogenerate=True)
print("Initial migration created successfully!") 