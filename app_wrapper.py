#!/usr/bin/env python3
"""
Application wrapper to handle database connection issues and provide fallback.
"""
import os
import sys
import traceback
import logging
import importlib.util
from pathlib import Path

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s [%(name)s] %(levelname)s: %(message)s')
logger = logging.getLogger("app_wrapper")

# Import monkeypatch module to patch SQLAlchemy create_engine
try:
    import monkeypatch
    logger.info("Imported monkeypatch module successfully")
except ImportError:
    logger.error("Could not import monkeypatch module, some functionality may be unavailable")

import re
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, HTMLResponse

# Add backend directory to Python path to help with imports
backend_dir = Path(__file__).parent
logger.info(f"Adding backend directory to Python path: {backend_dir}")
sys.path.append(str(backend_dir))

# Also add app subdirectory to Python path if it exists
app_dir = backend_dir / "app"
if app_dir.exists() and app_dir.is_dir():
    logger.info(f"Adding app directory to Python path: {app_dir}")
    sys.path.append(str(app_dir))

# Add potential parent directories to help with imports
parent_dir = backend_dir.parent
logger.info(f"Adding parent directory to Python path: {parent_dir}")
sys.path.append(str(parent_dir))

# Create a fallback application in case the main app fails to load
fallback_app = FastAPI(title="Fallback Application")
# Store errors for debugging
fallback_app.state.errors = []
fallback_app.state.import_attempts = []

@fallback_app.get("/")
async def fallback_root():
    """Root endpoint for the fallback application."""
    html_content = """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Fallback Application</title>
        <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            .error { background-color: #ffebee; border-left: 5px solid #f44336; padding: 10px; margin-bottom: 10px; }
            .attempt { background-color: #e8f5e9; border-left: 5px solid #4caf50; padding: 10px; margin-bottom: 10px; }
            h1 { color: #333; }
            h2 { color: #555; margin-top: 20px; }
            pre { background-color: #f5f5f5; padding: 10px; overflow: auto; }
        </style>
    </head>
    <body>
        <h1>Hello from the fallback app! Database connection had issues.</h1>
        <p>The main application could not be started. This could be due to database connection issues or import errors.</p>
        
        <h2>Environment Information</h2>
        <ul>
            <li>DATABASE_URL set: """ + str(bool('DATABASE_URL' in os.environ)) + """</li>
            <li>Python path: """ + str(sys.path) + """</li>
            <li>Working directory: """ + str(os.getcwd()) + """</li>
        </ul>
        
        <h2>Import Attempts</h2>
        """ + ''.join([f'<div class="attempt"><p>{attempt}</p></div>' for attempt in fallback_app.state.import_attempts]) + """
        
        <h2>Errors</h2>
        """ + ''.join([f'<div class="error"><pre>{error}</pre></div>' for error in fallback_app.state.errors]) + """
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@fallback_app.get("/health")
async def fallback_health():
    """Health check endpoint for the fallback application."""
    status = {
        "status": "warning",
        "message": "Running in fallback mode due to database connection issues",
        "database_url_provided": 'DATABASE_URL' in os.environ,
        "errors": fallback_app.state.errors,
        "import_attempts": fallback_app.state.import_attempts
    }
    return JSONResponse(content=status)

def fix_hardcoded_urls():
    """Fix hardcoded database URLs in already loaded modules."""
    try:
        logger.info("Checking for hardcoded database URLs in loaded modules")
        
        for name, module in list(sys.modules.items()):
            if not module or not hasattr(module, '__dict__'):
                continue
            
            # Skip standard library modules
            if not hasattr(module, '__file__') or not module.__file__:
                continue
            
            # Look for string attributes that might be database URLs
            for attr_name in dir(module):
                try:
                    attr = getattr(module, attr_name)
                    if not isinstance(attr, str):
                        continue
                    
                    # Check if it looks like a PostgreSQL URL
                    if 'postgresql://' in attr and 'railway.internal' in attr:
                        logger.info(f"Found hardcoded database URL in {name}.{attr_name}")
                        
                        # Fix the URL
                        if hasattr(monkeypatch, '_fix_postgresql_hostname'):
                            fixed_url = monkeypatch._fix_postgresql_hostname(attr)
                            if fixed_url != attr:
                                logger.info(f"Fixed hardcoded URL in {name}.{attr_name}")
                                setattr(module, attr_name, fixed_url)
                except Exception as e:
                    logger.debug(f"Error checking attribute {attr_name} in module {name}: {e}")
        
        logger.info("Finished checking for hardcoded database URLs")
    except Exception as e:
        logger.error(f"Error in fix_hardcoded_urls: {e}")
        logger.error(traceback.format_exc())

def load_and_verify_app():
    """Load and verify the original application."""
    # First, check if any existing SQLAlchemy engines need to be updated
    try:
        import sqlalchemy
        logger.info("SQLAlchemy version: %s", sqlalchemy.__version__)
        
        # Find all engine instances in the sqlalchemy module
        engine_count = 0
        if hasattr(sqlalchemy, 'engine'):
            for attr_name in dir(sqlalchemy.engine):
                attr = getattr(sqlalchemy.engine, attr_name)
                if 'Engine' in str(type(attr)):
                    engine_count += 1
                    logger.info(f"Found SQLAlchemy engine: {attr}")
        
        logger.info(f"Found {engine_count} SQLAlchemy engines")
    except ImportError:
        logger.info("SQLAlchemy not imported, skipping engine check")
    except Exception as e:
        logger.error(f"Error checking SQLAlchemy engines: {e}")
    
    # Try to fix any hardcoded database URLs
    try:
        fix_hardcoded_urls()
    except Exception as e:
        logger.error(f"Error fixing hardcoded URLs: {e}")
    
    # Try different import strategies
    import_attempts = []
    error_details = []
    
    # Try importing from the app.main module (standard FastAPI structure)
    logger.info("Attempt 1: Importing app from app.main")
    try:
        fallback_app.state.import_attempts.append("Attempt 1: from app.main import app")
        from app.main import app
        logger.info("Successfully imported app from app.main")
        return app
    except ImportError as e:
        error_msg = f"ImportError: {e}"
        logger.warning(f"Could not import app from app.main: {e}")
        error_details.append(error_msg)
        fallback_app.state.errors.append(error_msg)
    except Exception as e:
        error_msg = f"Error importing from app.main: {e}\n{traceback.format_exc()}"
        logger.error(error_msg)
        error_details.append(error_msg)
        fallback_app.state.errors.append(error_msg)
    
    # Try importing from the main module (sometimes FastAPI apps are in main.py)
    logger.info("Attempt 2: Importing app from main")
    try:
        fallback_app.state.import_attempts.append("Attempt 2: from main import app")
        from main import app
        logger.info("Successfully imported app from main")
        return app
    except ImportError as e:
        error_msg = f"ImportError: {e}"
        logger.warning(f"Could not import app from main: {e}")
        error_details.append(error_msg)
        fallback_app.state.errors.append(error_msg)
    except Exception as e:
        error_msg = f"Error importing from main: {e}\n{traceback.format_exc()}"
        logger.error(error_msg)
        error_details.append(error_msg)
        fallback_app.state.errors.append(error_msg)
    
    # Try importing from backend.app.main
    logger.info("Attempt 3: Importing app from backend.app.main")
    try:
        fallback_app.state.import_attempts.append("Attempt 3: from backend.app.main import app")
        from backend.app.main import app
        logger.info("Successfully imported app from backend.app.main")
        return app
    except ImportError as e:
        error_msg = f"ImportError: {e}"
        logger.warning(f"Could not import app from backend.app.main: {e}")
        error_details.append(error_msg)
        fallback_app.state.errors.append(error_msg)
    except Exception as e:
        error_msg = f"Error importing from backend.app.main: {e}\n{traceback.format_exc()}"
        logger.error(error_msg)
        error_details.append(error_msg)
        fallback_app.state.errors.append(error_msg)
    
    # Try a dynamic approach to find and load the main application module
    logger.info("Attempt 4: Searching for the main application module")
    fallback_app.state.import_attempts.append("Attempt 4: Dynamic search for main application module")
    
    # Get a list of potential app modules
    app_modules = []
    for root, dirs, files in os.walk(str(backend_dir)):
        for file in files:
            if file == "main.py":
                app_modules.append(os.path.join(root, file))
    
    logger.info(f"Found {len(app_modules)} potential main.py files: {app_modules}")
    
    # Try to import each potential app module
    for app_module_path in app_modules:
        try:
            module_name = os.path.splitext(os.path.basename(app_module_path))[0]
            logger.info(f"Trying to import from {app_module_path} as {module_name}")
            
            # Use importlib to load the module from its file path
            spec = importlib.util.spec_from_file_location(module_name, app_module_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                
                # Check if the module has an 'app' attribute
                if hasattr(module, "app"):
                    logger.info(f"Found app in {app_module_path}")
                    return module.app
        except Exception as e:
            error_msg = f"Error importing from {app_module_path}: {e}\n{traceback.format_exc()}"
            logger.error(error_msg)
            error_details.append(error_msg)
            fallback_app.state.errors.append(error_msg)
    
    # If all import attempts failed, use the fallback app
    logger.error("All import attempts failed, using fallback app")
    fallback_app.state.import_attempts.append("All import attempts failed, using fallback app")
    
    return fallback_app

# Import the app
try:
    app = load_and_verify_app()
    logger.info(f"Successfully loaded application: {app}")
except Exception as e:
    logger.error(f"Error loading app: {e}")
    logger.error(traceback.format_exc())
    fallback_app.state.errors.append(f"Fatal error: {e}\n{traceback.format_exc()}")
    app = fallback_app 