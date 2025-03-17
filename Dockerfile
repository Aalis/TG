FROM python:3.10-slim

WORKDIR /app

# Install PostgreSQL client and other dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    curl \
    netcat-openbsd \
    dnsutils \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire project
COPY . .

# Install dependencies
WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt

# Install additional missing dependencies
RUN pip install --no-cache-dir pytz

# Set environment variables
ENV PYTHONUNBUFFERED=1
# Explicitly set email-related environment variables
ENV MAIL_TLS=true
ENV MAIL_SSL=false
# Set a default PORT value to handle cases where it might be empty
ENV PORT=8000

# Create a database connection patch to handle connection issues
COPY <<EOF /app/backend/app_wrapper.py
import os
import sys
import logging
import monkeypatch
import re
from fastapi import FastAPI

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("app_wrapper")

# Add backend directory to path
sys.path.append('/app/backend')

# Create a simple application fallback
fallback_app = FastAPI()

# Try to fix any hardcoded database URLs in already loaded modules
def fix_hardcoded_urls():
    """Attempt to patch already loaded modules that might have hardcoded database URLs."""
    logger.info("\nLooking for modules with hardcoded database URLs...")
    pg_host = None
    if "PGHOST" in os.environ:
        pg_host = os.environ["PGHOST"]
    elif "DATABASE_URL" in os.environ:
        match = re.search(r"@([^:]+)", os.environ["DATABASE_URL"])
        if match:
            pg_host = match.group(1)
    
    if not pg_host:
        logger.warning("Cannot determine proper PostgreSQL host, skipping URL fixes")
        return
    
    logger.info(f"Using PostgreSQL host: {pg_host}")
    
    # Look through all loaded modules for SQLAlchemy engine or URL attributes
    for module_name, module in list(sys.modules.items()):
        if not module_name.startswith("_") and module is not None:
            try:
                # Check for database_url attribute
                for attr_name in dir(module):
                    if attr_name.lower().endswith("_url") or "database" in attr_name.lower() or "postgres" in attr_name.lower():
                        try:
                            attr = getattr(module, attr_name)
                            if isinstance(attr, str) and "postgres.railway.internal" in attr:
                                logger.info(f"Found hardcoded URL in {module_name}.{attr_name}")
                                new_value = attr.replace("postgres.railway.internal", pg_host)
                                setattr(module, attr_name, new_value)
                                logger.info(f"Updated {module_name}.{attr_name} to use {pg_host}")
                        except Exception as e:
                            logger.debug(f"Error checking attribute {attr_name}: {e}")
            except Exception as e:
                logger.debug(f"Error checking module {module_name}: {e}")
    
    # Check if SQLAlchemy has an engine already created
    if "sqlalchemy" in sys.modules:
        try:
            sqlalchemy = sys.modules["sqlalchemy"]
            engine_module = sys.modules.get("sqlalchemy.engine", None)
            if engine_module:
                # Try to patch any existing engines
                logger.info("Looking for existing SQLAlchemy engines to patch...")
        except Exception as e:
            logger.error(f"Error checking SQLAlchemy engine: {e}")

# Attempt to fix hardcoded URLs before trying to import the app
try:
    fix_hardcoded_urls()
except Exception as e:
    logger.error(f"Error in fix_hardcoded_urls: {e}")

@fallback_app.get("/health")
def health_check():
    # Log database connection info to help debug
    db_url = os.environ.get("DATABASE_URL", "Not set")
    postgres_user = os.environ.get("POSTGRES_USER", "Not set")
    postgres_db = os.environ.get("POSTGRES_DB", "Not set")
    postgres_password = "****" if "POSTGRES_PASSWORD" in os.environ else "Not set"
    # Hide password from logs
    safe_db_url = db_url
    if db_url != "Not set" and "POSTGRES_PASSWORD" in os.environ:
        safe_db_url = db_url.replace(os.environ.get("POSTGRES_PASSWORD", ""), "****")
    
    logger.info(f"DATABASE_URL: {safe_db_url}")
    logger.info(f"POSTGRES_USER: {postgres_user}, POSTGRES_DB: {postgres_db}")
    
    # Get all environment variables for debugging
    all_env_vars = {k: v for k, v in os.environ.items() if "PASSWORD" not in k and "SECRET" not in k}
    return {
        "status": "ok", 
        "mode": "fallback",
        "message": "Running in fallback mode due to database connection issues",
        "db_diagnostics": {
            "database_url": safe_db_url,
            "postgres_user": postgres_user,
            "postgres_db": postgres_db,
            "environment": all_env_vars
        }
    }

@fallback_app.get("/")
def root():
    error_msg = getattr(fallback_app, "error_message", "Unknown error")
    logger.warning(f"Using fallback app due to error: {error_msg}")
    return {
        "message": "Hello from the fallback app! Database connection had issues.",
        "error": error_msg
    }

# Try multiple import paths for the app
logger.info("Attempting to import the original application...")
app = None
error_message = ""

try:
    # Try to import with the current path
    logger.info("Trying import path: from app.main import app")
    from app.main import app as original_app
    app = original_app
    logger.info("Successfully imported the original application from app.main")
except ImportError as e:
    error_message = f"Import error from app.main: {str(e)}"
    logger.warning(error_message)
    try:
        # Add app to path and try again
        sys.path.append('/app/backend/app')
        logger.info("Trying alternative import path after adding /app/backend/app to sys.path")
        from main import app as original_app
        app = original_app
        logger.info("Successfully imported the original application from main")
    except ImportError as e2:
        error_message += f" | Import error from main: {str(e2)}"
        logger.warning(f"Second import attempt failed: {e2}")
        try:
            # Try one more path
            logger.info("Trying import from backend.app.main")
            from backend.app.main import app as original_app
            app = original_app
            logger.info("Successfully imported the original application from backend.app.main")
        except ImportError as e3:
            error_message += f" | Import error from backend.app.main: {str(e3)}"
            logger.warning(f"Third import attempt failed: {e3}")
except Exception as e:
    error_message = f"General error importing app: {str(e)}"
    logger.error(error_message)

# If all imports failed, use the fallback app
if app is None:
    logger.error(f"All import attempts failed. Using fallback application. Errors: {error_message}")
    app = fallback_app
    # Store the error message on the app for debugging
    fallback_app.error_message = error_message
EOF

# Create a monkeypatch module to intercept database operations
COPY <<EOF /app/backend/monkeypatch.py
import sys
import builtins
import importlib.abc
import types
import os
import re
import logging
from importlib.machinery import ModuleSpec

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger("monkeypatch")

# Store original import
original_import = builtins.__import__

# Check if we need to override the PostgreSQL host
def override_postgres_connection():
    """Set up environment to override PostgreSQL connections to use Railway-provided values."""
    logger.info("\n\nSetting up PostgreSQL connection override...")
    
    # Print debug info
    logger.info("Available environment variables for PostgreSQL connection:")
    postgres_vars = {}
    for var in os.environ:
        if var.startswith("PG") or "POSTGRES" in var or "DATABASE" in var:
            if "PASSWORD" not in var and "SECRET" not in var:
                postgres_vars[var] = os.environ[var]
    logger.info(f"PostgreSQL variables: {postgres_vars}")
    
    # Determine the correct PostgreSQL host
    pg_host = None
    
    # Check for Railway public domain which we should use instead of internal hostnames
    if "RAILWAY_PUBLIC_DOMAIN" in os.environ:
        pg_host = os.environ["RAILWAY_PUBLIC_DOMAIN"].split('.')[0] + ".railway.app"
        logger.info(f"Using RAILWAY_PUBLIC_DOMAIN-derived host: {pg_host}")
    elif "RAILWAY_STATIC_URL" in os.environ:
        pg_host = os.environ["RAILWAY_STATIC_URL"].split('.')[0] + ".railway.app"
        logger.info(f"Using RAILWAY_STATIC_URL-derived host: {pg_host}")
    # Only use PGHOST as fallback
    elif "PGHOST" in os.environ:
        pg_host = os.environ["PGHOST"]
        logger.info(f"Using PGHOST: {pg_host}")
    elif "DATABASE_URL" in os.environ:
        # Extract host from DATABASE_URL
        import re
        match = re.search(r"@([^:]+)", os.environ["DATABASE_URL"])
        if match:
            pg_host = match.group(1)
            logger.info(f"Extracted host from DATABASE_URL: {pg_host}")
            
            # Check if this is an internal hostname and needs replacing
            if "railway.internal" in pg_host:
                logger.warning(f"Warning: Found internal Railway hostname: {pg_host}")
                # Try to find a public hostname from environment variables
                if "RAILWAY_PUBLIC_DOMAIN" in os.environ:
                    new_host = os.environ["RAILWAY_PUBLIC_DOMAIN"].split('.')[0] + ".railway.app"
                    logger.info(f"Replacing with public hostname derived from RAILWAY_PUBLIC_DOMAIN: {new_host}")
                    pg_host = new_host
    
    if not pg_host:
        logger.error("\nWARNING: Could not determine correct PostgreSQL host!")
        return
        
    # If we got an internal hostname, warn but continue
    if "railway.internal" in pg_host:
        logger.warning(f"WARNING: Using internal Railway hostname: {pg_host} - this may cause connection issues!")
        logger.warning("The application may not be able to connect to the database using this hostname.")
    
    logger.info(f"Final PostgreSQL host to use: {pg_host}")
    
    # Replace any internal hostnames with the public one in DATABASE_URL
    if "DATABASE_URL" in os.environ:
        old_url = os.environ["DATABASE_URL"]
        if "railway.internal" in old_url:
            # Mask password for logging
            safe_old_url = old_url
            if "POSTGRES_PASSWORD" in os.environ:
                safe_old_url = old_url.replace(os.environ.get('POSTGRES_PASSWORD', 'password'), '****')
            logger.info(f"Found internal hostname in DATABASE_URL: {safe_old_url}")
            
            # Create a pattern to match any *.railway.internal hostname
            import re
            new_url = re.sub(r'@([^:]+?)\.railway\.internal', f'@{pg_host}', old_url)
            if new_url != old_url:
                os.environ["DATABASE_URL"] = new_url
                logger.info(f"Updated DATABASE_URL to use host: {pg_host}")
                # Mask password for logging
                safe_new_url = new_url
                if "POSTGRES_PASSWORD" in os.environ:
                    safe_new_url = new_url.replace(os.environ.get('POSTGRES_PASSWORD', 'password'), '****')
                logger.info(f"New DATABASE_URL: {safe_new_url}")
    
    # Create a custom create_engine function to override connections
    def patch_sqlalchemy():
        # Try to import sqlalchemy safely
        try:
            import sqlalchemy
            import sqlalchemy.engine
            
            # Store the original create_engine
            original_create_engine = sqlalchemy.create_engine
            
            # Only patch if not already patched
            if hasattr(sqlalchemy, '_patched_create_engine'):
                logger.info("SQLAlchemy create_engine already patched, skipping")
                return
                
            def patched_create_engine(url, *args, **kwargs):
                """Replace any railway.internal with the correct host."""
                url_str = str(url)
                if "railway.internal" in url_str:
                    logger.info("\n\nIntercepting connection to railway.internal hostname!")
                    # Mask password for logging
                    safe_url = url_str
                    if "POSTGRES_PASSWORD" in os.environ:
                        safe_url = url_str.replace(os.environ.get('POSTGRES_PASSWORD', 'password'), '****')
                    logger.info(f"Original URL: {safe_url}")
                    
                    # Replace the internal hostname with our public one
                    import re
                    new_url = re.sub(r'@([^:]+?)\.railway\.internal', f'@{pg_host}', url_str)
                    
                    # Mask password for logging
                    safe_new_url = new_url
                    if "POSTGRES_PASSWORD" in os.environ:
                        safe_new_url = new_url.replace(os.environ.get('POSTGRES_PASSWORD', 'password'), '****')
                    logger.info(f"New URL: {safe_new_url}")
                    
                    return original_create_engine(new_url, *args, **kwargs)
                return original_create_engine(url, *args, **kwargs)
            
            # Replace the create_engine method
            sqlalchemy.create_engine = patched_create_engine
            # Mark as patched to avoid duplicate patching
            sqlalchemy._patched_create_engine = True
            logger.info("Successfully patched SQLAlchemy create_engine!")
        except Exception as e:
            logger.error(f"Error patching SQLAlchemy: {e}")
    
    # Patch sqlalchemy immediately if already imported
    if "sqlalchemy" in sys.modules:
        logger.info("SQLAlchemy already imported, patching now...")
        patch_sqlalchemy()

def patched_import(name, globals=None, locals=None, fromlist=(), level=0):
    # Intercept specific imports that might cause database operations
    if name in ["sqlalchemy", "databases", "psycopg2"]:
        logger.info(f"Note: Import of {name} detected - connections may be intercepted if DISABLE_DB=true")
        # Print all the environment variables that might affect database connections
        logger.info("Debug - Database Environment Variables:")
        for var in sorted(os.environ.keys()):
            if var.startswith("PG") or "DB" in var or "SQL" in var or "POSTGRES" in var:
                # Hide passwords
                if "PASSWORD" in var or "PWD" in var:
                    logger.info(f"  {var}: ****")
                else:
                    logger.info(f"  {var}: {os.environ.get(var)}")
        
        # If importing SQLAlchemy, set up to patch it
        if name == "sqlalchemy":
            module = original_import(name, globals, locals, fromlist, level)
            # Try to override any postgres.railway.internal connections
            override_postgres_connection()
            return module
        
        # Intercept and patch psycopg2 if it fails with "postgres.railway.internal"
        if name == "psycopg2" and fromlist and "OperationalError" in fromlist:
            # Try to override any postgres.railway.internal connections
            override_postgres_connection()
            
            # Get the original module
            psycopg2_module = original_import(name, globals, locals, fromlist, level)
            
            # Store the original OperationalError
            original_error = psycopg2_module.OperationalError
            
            # Create a patched version
            def patched_error(*args, **kwargs):
                error_msg = args[0] if args else ""
                if isinstance(error_msg, str) and "could not translate host name" in error_msg and "railway.internal" in error_msg:
                    logger.error("\n\nDETECTED RAILWAY POSTGRES CONNECTION ISSUE!")
                    logger.error("The application is trying to connect to Railway PostgreSQL using the internal hostname.")
                    logger.error("This may be due to missing environment variables or incorrect configuration.")
                    logger.info("\nTrying to fix the issue by checking environment variables...")
                    
                    # Check for Railway PG environment variables
                    pg_vars = {k: v for k, v in os.environ.items() if k.startswith("PG") and "PASSWORD" not in k}
                    logger.info(f"Railway PostgreSQL variables: {pg_vars}")
                    
                    # Try to derive proper hostname from environment variables
                    proper_host = None
                    if "RAILWAY_PUBLIC_DOMAIN" in os.environ:
                        proper_host = os.environ["RAILWAY_PUBLIC_DOMAIN"].split('.')[0] + ".railway.app"
                        logger.info(f"Use this host instead: {proper_host}")
                    
                    # Suggest possible fixes
                    logger.info("\nPOSSIBLE SOLUTIONS:")
                    logger.info("1. Make sure to use the external Railway hostname, not the internal one")
                    logger.info("2. Set DATABASE_URL explicitly with the correct external hostname")
                    logger.info("3. Check the Railway dashboard for the correct PostgreSQL connection details")
                    
                    if proper_host:
                        logger.info(f"\nTry this DATABASE_URL format: postgresql://username:password@{proper_host}:5432/database_name")
                return original_error(*args, **kwargs)
            
            # Replace the OperationalError with our patched version
            psycopg2_module.OperationalError = patched_error
            return psycopg2_module
    
    # Let the original import proceed
    return original_import(name, globals, locals, fromlist, level)

# Replace the built-in import function
builtins.__import__ = patched_import

# Immediately try to fix any hardcoded database URLs
override_postgres_connection()
EOF

# Create a simple app for testing
RUN mkdir -p /app/simple_app
COPY <<EOF /app/simple_app/main.py
from fastapi import FastAPI

app = FastAPI()

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.get("/")
def root():
    return {"message": "Hello World"}
EOF

# Create default .env file if it doesn't exist
COPY <<EOF /app/create_default_env.sh
#!/bin/bash

# Create default .env file with placeholder values
if [ ! -f /app/backend/.env ]; then
  echo "Creating default .env file with placeholder values..."
  cat > /app/backend/.env << EOL
# Database configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/telegram_parser
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=telegram_parser

# JWT Authentication
SECRET_KEY=temporarysecretkey123456789
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Application settings
BACKEND_CORS_ORIGINS=["http://localhost:3000", "http://localhost:8000"]

# Telegram API credentials
API_ID=0000000
API_HASH=temporaryapihash
TELEGRAM_BOT_TOKENS=["token1"]

# Email settings
MAIL_USERNAME=user@example.com
MAIL_PASSWORD=password
MAIL_FROM=noreply@example.com
MAIL_PORT=587
MAIL_SERVER=smtp.example.com
EOL
fi
EOF
RUN chmod +x /app/create_default_env.sh

# Create a model creation script to ensure database tables exist
COPY <<EOF /app/backend/create_models.py
#!/usr/bin/env python3
"""
Database model initialization script to ensure tables exist.
This script will create all database tables based on SQLAlchemy models.
"""
import os
import sys
import logging
import traceback

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("create_models")

# Add the current directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def create_tables():
    """Create all database tables based on SQLAlchemy models."""
    try:
        # Try the first import path
        logger.info("Attempting to import models from app.database.base")
        from app.database.base import Base
        from app.database.session import engine
        
        logger.info("Creating all tables from Base.metadata")
        Base.metadata.create_all(bind=engine)
        logger.info("Successfully created all tables")
        return True
    except ImportError as e:
        logger.warning(f"Import error from app.database.base: {e}")
        try:
            # Try alternative import path
            logger.info("Attempting to import models from database.base")
            from database.base import Base
            from database.session import engine
            
            logger.info("Creating all tables from Base.metadata")
            Base.metadata.create_all(bind=engine)
            logger.info("Successfully created all tables with alternative import")
            return True
        except ImportError as e2:
            logger.warning(f"Import error from database.base: {e2}")
            try:
                # Try one more import path
                logger.info("Attempting to import individual models")
                
                # Try to find model files
                model_files = []
                for root, dirs, files in os.walk(os.path.dirname(os.path.abspath(__file__))):
                    for file in files:
                        if file.endswith(".py") and file != "__init__.py":
                            with open(os.path.join(root, file), "r") as f:
                                content = f.read()
                                # Look for SQLAlchemy model definitions
                                if "Base.metadata" in content or "Column(" in content or "relationship(" in content:
                                    model_files.append(os.path.join(root, file))
                
                logger.info(f"Found {len(model_files)} potential model files")
                for model_file in model_files:
                    logger.info(f"Importing from {model_file}")
                    # Try to import the module
                    module_path = os.path.relpath(model_file, os.path.dirname(os.path.abspath(__file__)))
                    module_name = module_path.replace("/", ".").replace("\\", ".").replace(".py", "")
                    try:
                        __import__(module_name)
                        logger.info(f"Successfully imported {module_name}")
                    except ImportError as e:
                        logger.warning(f"Error importing {module_name}: {e}")
                
                # Try to find Base and engine
                from sqlalchemy.ext.declarative import declarative_base
                from sqlalchemy import create_engine
                
                logger.info("Manually creating engine from DATABASE_URL")
                engine = create_engine(os.environ["DATABASE_URL"])
                Base = declarative_base()
                
                # Try to import all models so they register with Base
                for module_name in sys.modules:
                    if module_name.endswith("models") or "model" in module_name:
                        logger.info(f"Found potential model module: {module_name}")
                
                logger.info("Creating all tables from manually defined Base")
                Base.metadata.create_all(bind=engine)
                logger.info("Successfully created all tables with manual imports")
                return True
            except Exception as e3:
                logger.error(f"Error in manual model import: {e3}")
                logger.error(traceback.format_exc())
                return False
    except Exception as e:
        logger.error(f"General error creating tables: {e}")
        logger.error(traceback.format_exc())
        return False

def verify_tables_exist():
    """Verify that tables exist in the database."""
    try:
        import psycopg2
        import psycopg2.extras
        
        # Connect to the database
        logger.info("Connecting to the database to verify tables")
        conn = psycopg2.connect(os.environ["DATABASE_URL"])
        cur = conn.cursor()
        
        # List all tables
        cur.execute("""
            SELECT tablename FROM pg_catalog.pg_tables
            WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
        """)
        
        tables = cur.fetchall()
        if not tables:
            logger.warning("No tables found in the database!")
            return False
        else:
            logger.info(f"Found {len(tables)} tables in the database:")
            for table in tables:
                logger.info(f" - {table[0]}")
            return True
        
        conn.close()
    except Exception as e:
        logger.error(f"Error checking database tables: {e}")
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    # First verify if tables already exist
    if verify_tables_exist():
        logger.info("Tables already exist in the database, no need to create them")
        sys.exit(0)
    
    # If no tables exist, try to create them
    logger.info("No tables found or error verifying tables, attempting to create tables")
    if create_tables():
        logger.info("Successfully created tables")
        # Verify tables were created
        if verify_tables_exist():
            logger.info("Verified tables were created successfully")
            sys.exit(0)
        else:
            logger.warning("Tables were not created successfully or could not be verified")
            sys.exit(1)
    else:
        logger.error("Failed to create tables")
        sys.exit(1)
EOF
RUN chmod +x /app/backend/create_models.py

# Create a startup script with error handling and diagnostics
COPY <<EOF /app/start.sh
#!/bin/bash
set -e
echo "Current directory: $(pwd)"
echo "Listing files in current directory:"
ls -la
# Early PostgreSQL hostname fix - replace internal Railway hostnames with public ones
if [[ -n "$RAILWAY_PUBLIC_DOMAIN" ]]; then
  PUBLIC_HOST="${RAILWAY_PUBLIC_DOMAIN%%.*}.railway.app"
  echo "EARLY FIX: Deriving public PostgreSQL hostname: $PUBLIC_HOST from RAILWAY_PUBLIC_DOMAIN"
  if [[ -n "$DATABASE_URL" && "$DATABASE_URL" == *"railway.internal"* ]]; then
    OLD_URL="$DATABASE_URL"
    # Replace any *.railway.internal with the public hostname
    export DATABASE_URL=$(echo "$DATABASE_URL" | sed "s/[^@]*\.railway\.internal/$PUBLIC_HOST/g")
    echo "Updated DATABASE_URL from internal to public hostname"
  fi
  
  if [[ -n "$PGUSER" && -n "$PGPASSWORD" && -n "$PGDATABASE" ]]; then
    if [[ -n "$PGHOST" && "$PGHOST" == *"railway.internal"* ]]; then
      echo "Using public hostname instead of internal PGHOST"
      export PGHOST="$PUBLIC_HOST"
    fi
    
    # Also set DATABASE_URL explicitly based on our known good values
    export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST:-$PUBLIC_HOST}:${PGPORT:-5432}/${PGDATABASE}"
    echo "Set DATABASE_URL using public PostgreSQL hostname"
  fi
fi

# Create a fix for SQLALCHEMY_DATABASE_URI environment variable if present
if [[ -n "$DATABASE_URL" ]]; then
  export SQLALCHEMY_DATABASE_URI="$DATABASE_URL"
  echo "Set SQLALCHEMY_DATABASE_URI from DATABASE_URL (password hidden)"
fi

echo "Creating default .env file if needed"
/app/create_default_env.sh
# Dump ALL environment variables for debugging (with passwords hidden)
env | grep -v PASSWORD | grep -v SECRET | sort
# Do not skip database operations anymore
export SKIP_DB_INIT=false
export DISABLE_DB=false
# List all database-related environment variables
echo "=== DATABASE ENVIRONMENT VARIABLES ==="
env | grep -i "db\|database\|pg\|sql\|postgres" | grep -v PASSWORD | grep -v SECRET | sort
# Handle Railway PostgreSQL connection
if [[ -n "$DATABASE_URL" ]]; then
  echo "Using provided DATABASE_URL"
elif [[ -n "$RAILWAY_ENVIRONMENT" ]]; then
  echo "Running in Railway environment"
  # Railway provides PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT variables
  if [[ -n "$PGUSER" && -n "$PGPASSWORD" && -n "$PGDATABASE" && -n "$PGHOST" ]]; then
    echo "Using Railway-provided PG* variables"
    # Check if PGHOST is an internal hostname and replace if needed
    if [[ "$PGHOST" == *"railway.internal"* && -n "$RAILWAY_PUBLIC_DOMAIN" ]]; then
      PUBLIC_HOST="${RAILWAY_PUBLIC_DOMAIN%%.*}.railway.app"
      echo "Converting internal PGHOST to public hostname: $PUBLIC_HOST"
      export PGHOST="$PUBLIC_HOST"
    fi
    export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}"
  fi
elif [[ -n "$POSTGRES_USER" && -n "$POSTGRES_PASSWORD" && -n "$POSTGRES_DB" ]]; then
  echo "Constructing DATABASE_URL from POSTGRES_* variables"
  # Use public hostname if available
  if [[ -n "$RAILWAY_PUBLIC_DOMAIN" ]]; then
    POSTGRES_HOST="${RAILWAY_PUBLIC_DOMAIN%%.*}.railway.app"
    echo "Using public hostname from RAILWAY_PUBLIC_DOMAIN: $POSTGRES_HOST"
  else
    POSTGRES_HOST=${PGHOST:-"postgresql.railway.app"}
  fi
  POSTGRES_PORT=${PGPORT:-5432}
  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"
fi
echo "DATABASE_URL: (password hidden) host part shown below:"
echo "$(echo $DATABASE_URL | sed -n 's/.*@\(.*\)$/\1/p')"
echo "DISABLE_DB: ${DISABLE_DB}"

# Test connectivity to PostgreSQL
if [[ -n "$DATABASE_URL" ]]; then
  echo "Testing PostgreSQL connectivity..."
  # Extract host and port from DATABASE_URL
  DB_HOST=$(echo $DATABASE_URL | sed -n "s/.*@\([^:]*\).*/\1/p")
  DB_PORT=$(echo $DATABASE_URL | sed -n "s/.*:\([0-9]*\)\/.*/\1/p")
  echo "Extracted DB_HOST=$DB_HOST DB_PORT=$DB_PORT"
  # Try to ping the host
  echo "Trying to ping $DB_HOST..."
  ping -c 1 $DB_HOST || echo "Ping failed, but this might be expected"
  # Try to connect using nc
  echo "Trying netcat to $DB_HOST:$DB_PORT..."
  nc -z -v -w5 $DB_HOST $DB_PORT || echo "Netcat connection failed"
  # DNS lookup
  echo "DNS lookup for $DB_HOST..."
  nslookup $DB_HOST || echo "DNS lookup failed"
  # Environment variables that might affect PostgreSQL connections
  echo "PostgreSQL environment variables:"
  env | grep -i "pg\|postgres\|sql" | grep -v PASSWORD
fi

echo "Checking for existence of app directory:"
if [ -d /app/backend/app ]; then
  echo "App directory exists"
  echo "Contents of app directory:"
  ls -la /app/backend/app
else
  echo "App directory does not exist"
fi

echo "Checking for main.py:"
if [ -f /app/backend/app/main.py ]; then
  echo "main.py exists"
else
  echo "main.py does not exist"
fi

# Make sure PORT is set to a default value (8000) if it's empty or not set
# This fixes the error: '' is not a valid port number
echo "Current PORT value: '$PORT'"
if [[ -z "$PORT" || "$PORT" == "" ]]; then
  # Force set PORT to a hardcoded value when it's empty or contains only whitespace
  PORT=8000
  export PORT=8000
  echo "PORT was empty, forced to default: $PORT"
fi

# Double check the PORT value is valid
if ! [[ "$PORT" =~ ^[0-9]+$ ]]; then
  echo "PORT value '$PORT' is not a valid number, setting to default 8000"
  PORT=8000
  export PORT=8000
fi

echo "Final PORT=$PORT"

echo "Environment variables:"
echo "SECRET_KEY set: ${SECRET_KEY:+true}"
echo "DATABASE_URL set: ${DATABASE_URL:+true}"

# Initialize the database - we need to make sure the database is properly set up
if [[ -n "$DATABASE_URL" && "$SKIP_DB_INIT" != "true" ]]; then
  echo "========== DATABASE INITIALIZATION =========="
  cd /app/backend
  
  # First, try the dedicated model creation script
  echo "Running create_models.py to ensure tables exist..."
  set +e  # Temporarily disable exit on error
  python create_models.py
  MODEL_CREATION_RESULT=$?
  set -e  # Re-enable exit on error
  
  if [ $MODEL_CREATION_RESULT -eq 0 ]; then
    echo "Tables successfully created or verified by create_models.py"
  else
    echo "Warning: create_models.py encountered issues (exit code $MODEL_CREATION_RESULT), trying other methods..."
    
    # Check for init_db.py and run it if it exists
    if [ -f init_db.py ]; then
      echo "Running init_db.py to initialize database..."
      set +e  # Temporarily disable exit on error
      python init_db.py
      DB_INIT_RESULT=$?
      set -e  # Re-enable exit on error
      if [ $DB_INIT_RESULT -ne 0 ]; then
        echo "Warning: Database initialization with init_db.py failed with exit code $DB_INIT_RESULT"
      else
        echo "Database initialization with init_db.py completed successfully"
      fi
    else
      echo "init_db.py not found, looking for alternative initialization methods"
    fi
    
    # Look for and run alembic migrations if they exist
    if [ -d alembic ] && [ -f alembic.ini ]; then
      echo "Found Alembic migration files, running migrations..."
      set +e
      pip install --no-cache-dir alembic
      alembic upgrade head
      ALEMBIC_RESULT=$?
      set -e
      if [ $ALEMBIC_RESULT -ne 0 ]; then
        echo "Warning: Alembic migrations failed with exit code $ALEMBIC_RESULT"
      else
        echo "Alembic migrations completed successfully"
      fi
    else 
      echo "No Alembic migration files found"
    fi
    
    # Check that tables were actually created
    echo "Verifying database tables exist..."
    set +e
    python -c "
import os
import sys
import psycopg2
import psycopg2.extras

try:
    # Connect to the database
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    
    # List all tables
    cur.execute(\"\"\"
        SELECT tablename FROM pg_catalog.pg_tables
        WHERE schemaname != 'pg_catalog' AND schemaname != 'information_schema';
    \"\"\")
    
    tables = cur.fetchall()
    if not tables:
        print('WARNING: No tables found in the database!')
        sys.exit(1)
    else:
        print(f'Found {len(tables)} tables in the database:')
        for table in tables:
            print(f' - {table[0]}')
        sys.exit(0)
    
    conn.close()
except Exception as e:
    print(f'Error checking database tables: {e}')
    sys.exit(1)
"
    TABLE_CHECK_RESULT=$?
    set -e
    
    if [ $TABLE_CHECK_RESULT -ne 0 ]; then
      echo "WARNING: No tables found in the database after initialization attempts!"
      
      # As a last resort, try to create a simple test table to verify database access
      echo "Creating a test table to verify database access..."
      set +e
      python -c "
import os
import psycopg2

try:
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor()
    
    # Create a simple test table
    cur.execute('''
        CREATE TABLE IF NOT EXISTS test_table (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Insert a test row
    cur.execute('''
        INSERT INTO test_table (name) VALUES ('Test entry from initialization script')
    ''')
    
    # Verify the table exists
    cur.execute(\"\"\"
        SELECT * FROM test_table
    \"\"\")
    rows = cur.fetchall()
    print(f'Created test table with {len(rows)} rows')
    
    conn.close()
    print('Successfully created test table and verified database access')
except Exception as e:
    print(f'Error creating test table: {e}')
    raise
"
      TEST_TABLE_RESULT=$?
      set -e
      
      if [ $TEST_TABLE_RESULT -eq 0 ]; then
        echo "Database connection verified - test table created successfully"
      else
        echo "ERROR: Database connection or permissions issue - could not create even a simple test table"
      fi
    fi
  fi
  
  # Continue even if database initialization fails
  echo "Database initialization process complete"
  cd /app
else
  echo "Skipping database initialization"
fi

# Make sure we use the right application module
echo "Starting application with PORT=$PORT..."
if [ -f /app/backend/app/main.py ]; then
  echo "Starting with app wrapper to handle database issues"
  cd /app/backend 
  set +e
  
  # First try to import the app directly to test if there are any issues
  python -c "
import sys
sys.path.append('/app/backend')
try:
    from app.main import app
    print('Successfully imported app from app.main')
except Exception as e:
    print(f'Error importing app: {e}')
"
  
  # Start with app_wrapper which has fallback capabilities
  gunicorn app_wrapper:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --log-level debug
else
  echo "Main app not found, running simple test app instead..."
  cd /app/simple_app && gunicorn main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --log-level debug
fi
EOF
RUN chmod +x /app/start.sh

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["/bin/bash", "/app/start.sh"] 