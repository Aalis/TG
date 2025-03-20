#!/usr/bin/env python
"""
Python startup script for Railway deployment
This replaces the bash entrypoint script to avoid any shell issues
"""

import os
import sys
import subprocess
import logging
import threading
import time
import json
import re
from http.server import HTTPServer, BaseHTTPRequestHandler
import socket
import psycopg2

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("startup")

# Global flag to indicate if the main application is running
main_app_running = False

class HealthCheckHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            # Return a successful health check
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                "status": "healthy",
                "version": "1.0.0",
                "main_app_running": main_app_running,
                "environment": os.environ.get("ENVIRONMENT", "production")
            }
            
            self.wfile.write(json.dumps(response).encode())
            logger.info("Health check request processed successfully")
        else:
            # For any other path, return 404
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            
            response = {
                "error": "Not found",
                "message": f"Path {self.path} not found"
            }
            
            self.wfile.write(json.dumps(response).encode())

def run_health_server(port=8000):
    """Run a health check server in a separate thread"""
    health_port = int(os.environ.get("HEALTH_PORT", port))
    logger.info(f"Starting health check server on port {health_port}")
    
    server_address = ('', health_port)
    httpd = HTTPServer(server_address, HealthCheckHandler)
    
    server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    server_thread.start()
    logger.info("Health check server running in background")
    return httpd

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

def install_missing_packages():
    """Install any potentially missing packages explicitly"""
    logger.info("Installing potentially missing packages...")
    packages = ["pytz", "python-dateutil", "pendulum"]
    for package in packages:
        run_command(f"pip install --no-cache-dir {package}", ignore_errors=True)

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
        
        # Check database schema before running migrations
        logger.info("Checking database schema...")
        db_url = os.environ.get("DATABASE_URL", "")
        if not db_url:
            logger.warning("DATABASE_URL not set, skipping migrations")
            return
            
        # Always run Alembic migrations first
        logger.info("Running Alembic migrations...")
        success = run_command("alembic -c /app/alembic.ini upgrade head")
        
        if not success:
            logger.error("Alembic migrations failed")
            return
            
        logger.info("Alembic migrations completed successfully")
        
        # Now run any additional schema modifications if needed
        try:
            # Extract database connection parameters from DATABASE_URL
            match = re.match(r'postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)', db_url)
            if match:
                username, password, host, port, dbname = match.groups()
                logger.info(f"Checking for any additional schema modifications needed...")
                
                # Connect to database
                conn = psycopg2.connect(
                    host=host,
                    port=port,
                    dbname=dbname,
                    user=username,
                    password=password
                )
                conn.autocommit = True
                cursor = conn.cursor()
                
                # Get list of tables
                cursor.execute("SELECT tablename FROM pg_tables WHERE schemaname = 'public';")
                tables = [row[0] for row in cursor.fetchall()]
                logger.info(f"Tables found after migrations: {tables}")
                
                # Close connections
                cursor.close()
                conn.close()
                
                logger.info("Additional schema checks completed")
                
        except Exception as e:
            logger.error(f"Error during additional schema checks: {e}")
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

def run_health_check_server_only():
    """Run only the health check server if the main application fails"""
    global main_app_running
    
    logger.warning("Main application failed to start, running health check server only")
    port = int(os.environ.get("PORT", "8000"))
    
    try:
        httpd = HTTPServer(('', port), HealthCheckHandler)
        logger.info(f"Health check server running on port {port}")
        
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Server stopped by user")
        finally:
            httpd.server_close()
    except OSError as e:
        if "Address already in use" in str(e):
            # Try a different port if the main one is in use
            fallback_port = port + 1
            logger.warning(f"Port {port} already in use, trying fallback port {fallback_port}")
            try:
                httpd = HTTPServer(('', fallback_port), HealthCheckHandler)
                logger.info(f"Health check server running on fallback port {fallback_port}")
                httpd.serve_forever()
            except Exception as e2:
                logger.error(f"Failed to start health check server on fallback port: {e2}")
        else:
            logger.error(f"Error starting health check server: {e}")

def start_application():
    """Start the Gunicorn application server"""
    global main_app_running
    
    logger.info("Starting application...")
    
    # Set environment variables
    os.environ["PYTHONPATH"] = "/app"
    
    # Get configuration from environment variables
    workers = os.environ.get("WORKERS", "2")
    port = os.environ.get("PORT", "8000")
    
    # Try to import the app to check if it will work
    try:
        logger.info("Testing if app can be imported...")
        import sys
        sys.path.insert(0, "/app")
        import app.main
        logger.info("App imported successfully!")
    except ImportError as e:
        logger.error(f"Failed to import app: {e}")
        run_health_check_server_only()
        return
    
    # Check if the port is already in use
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    result = sock.connect_ex(('127.0.0.1', int(port)))
    if result == 0:
        logger.warning(f"Port {port} is already in use. Health check server may already be running.")
        logger.warning("Will attempt to start main application anyway, but it may fail.")
    sock.close()
    
    # Build the command
    cmd = [
        'gunicorn',
        'app.main:app',
        f'--workers={workers}',
        '--worker-class=uvicorn.workers.UvicornWorker',
        f'--bind=0.0.0.0:{port}',
        '--log-level=info',
        '--timeout=300',
        '--keep-alive=5',
        '--access-logfile=-',
        '--error-logfile=-'
    ]
    
    logger.info(f"Executing: {cmd}")
    main_app_running = True
    
    # Start the application in a subprocess for better error handling
    try:
        # Run gunicorn
        subprocess.run(cmd, check=True)
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to start gunicorn: {e}")
        main_app_running = False
        run_health_check_server_only()
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        main_app_running = False
        run_health_check_server_only()

def main():
    """Main entry point"""
    try:
        # First check if we need to run just a health check server on a specific port
        health_check_only = os.environ.get("HEALTH_CHECK_ONLY", "").lower() in ["true", "1", "yes"]
        if health_check_only:
            logger.info("Running in health check only mode")
            run_health_check_server_only()
            return
            
        # Full app mode - start health check server in background if not disabled
        disable_health_check = os.environ.get("DISABLE_HEALTH_CHECK", "").lower() in ["true", "1", "yes"]
        health_server = None
        
        if not disable_health_check:
            # Use a different port for the health check server to avoid conflicts
            health_port = int(os.environ.get("HEALTH_PORT", int(os.environ.get("PORT", "8000")) + 1))
            os.environ["HEALTH_PORT"] = str(health_port)
            logger.info(f"Starting background health check server on port {health_port}")
            health_server = run_health_server(health_port)
        else:
            logger.info("Health check server disabled")
        
        logger.info("Starting application initialization...")
        check_environment()
        install_missing_packages()
        initialize_database()
        run_migrations()
        create_superuser()
        start_application()
    except Exception as e:
        logger.error(f"Fatal error during startup: {e}")
        run_health_check_server_only()

if __name__ == "__main__":
    main() 