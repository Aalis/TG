#!/usr/bin/env python
"""
Python startup script for Railway deployment
This replaces the bash entrypoint script to avoid any shell issues
"""

import os
import sys
import subprocess
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("startup")

def run_command(command, ignore_errors=False):
    """Run a shell command and log the output"""
    logger.info(f"Running command: {command}")
    try:
        result = subprocess.run(
            command, 
            shell=True, 
            check=not ignore_errors,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        logger.info(f"Command output: {result.stdout}")
        if result.stderr:
            logger.warning(f"Command stderr: {result.stderr}")
        return result.returncode == 0
    except Exception as e:
        logger.error(f"Error running command: {e}")
        if not ignore_errors:
            raise
        return False

def check_environment():
    """Log environment information"""
    logger.info("Checking environment...")
    logger.info(f"Current directory: {os.getcwd()}")
    logger.info(f"Python version: {sys.version}")
    logger.info(f"PYTHONPATH: {os.environ.get('PYTHONPATH', 'Not set')}")
    
    # List files in current directory
    logger.info("Directory listing:")
    for item in os.listdir("."):
        if os.path.isdir(item):
            logger.info(f"  DIR: {item}")
        else:
            logger.info(f"  FILE: {item}")
    
    # Check if app directory exists
    if os.path.isdir("/app/app"):
        logger.info("Found /app/app directory")
        # List files in app directory
        for item in os.listdir("/app/app"):
            if os.path.isdir(f"/app/app/{item}"):
                logger.info(f"  DIR: /app/app/{item}")
            else:
                logger.info(f"  FILE: /app/app/{item}")
    else:
        logger.warning("WARNING: /app/app directory not found!")

def initialize_database():
    """Initialize the database"""
    logger.info("Initializing database...")
    if os.path.isfile("/app/init_db.py"):
        logger.info("Found init_db.py, attempting to run it...")
        run_command("python /app/init_db.py", ignore_errors=True)
    else:
        logger.warning("Warning: /app/init_db.py not found, skipping database initialization")

def run_migrations():
    """Run database migrations"""
    logger.info("Running database migrations...")
    if os.path.isdir("/app/alembic") and os.path.isfile("/app/alembic.ini"):
        logger.info("Found alembic files, running migrations...")
        # Set PYTHONPATH environment variable
        os.environ["PYTHONPATH"] = "/app"
        run_command("alembic -c /app/alembic.ini upgrade head", ignore_errors=True)
    else:
        logger.warning("Alembic files not found, skipping migrations")

def create_superuser():
    """Create superuser if credentials are provided"""
    logger.info("Checking for superuser creation...")
    if os.environ.get("SUPERUSER_EMAIL") and os.environ.get("SUPERUSER_PASSWORD"):
        logger.info("Superuser credentials found, attempting to create superuser...")
        if os.path.isfile("/app/create_superuser.py"):
            run_command("python /app/create_superuser.py", ignore_errors=True)
        else:
            logger.warning("Warning: /app/create_superuser.py not found, skipping superuser creation")
    else:
        logger.info("No superuser credentials provided, skipping superuser creation")

def start_application():
    """Start the Gunicorn application server"""
    logger.info("Starting application...")
    
    # Set environment variables
    os.environ["PYTHONPATH"] = "/app"
    
    # Get configuration from environment variables
    workers = os.environ.get("WORKERS", "2")
    port = os.environ.get("PORT", "8000")
    
    # Build the command
    command = (
        f"gunicorn --chdir /app app.main:app "
        f"--workers {workers} "
        f"--worker-class uvicorn.workers.UvicornWorker "
        f"--bind 0.0.0.0:{port} "
        f"--timeout 120 "
        f"--access-logfile - "
        f"--error-logfile -"
    )
    
    logger.info(f"Executing: {command}")
    
    # Execute Gunicorn directly using os.execvp to replace the current process
    os.execvp("gunicorn", command.split())

def main():
    """Main entry point"""
    try:
        logger.info("Starting application initialization...")
        check_environment()
        initialize_database()
        run_migrations()
        create_superuser()
        start_application()
    except Exception as e:
        logger.error(f"Fatal error during startup: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 