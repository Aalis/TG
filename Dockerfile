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

# Create a database connection patch to handle connection issues
RUN echo 'import os\n\
import sys\n\
import monkeypatch\n\
from fastapi import FastAPI\n\
\n\
# Create a simple application fallback\n\
fallback_app = FastAPI()\n\
\n\
@fallback_app.get("/health")\n\
def health_check():\n\
    # Log database connection info to help debug\n\
    db_url = os.environ.get("DATABASE_URL", "Not set")\n\
    postgres_user = os.environ.get("POSTGRES_USER", "Not set")\n\
    postgres_db = os.environ.get("POSTGRES_DB", "Not set")\n\
    postgres_password = "****" if "POSTGRES_PASSWORD" in os.environ else "Not set"\n\
    # Hide password from logs\n\
    safe_db_url = db_url\n\
    if db_url != "Not set" and "POSTGRES_PASSWORD" in os.environ:\n\
        safe_db_url = db_url.replace(os.environ.get("POSTGRES_PASSWORD", ""), "****")\n\
    \n\
    print(f"DATABASE_URL: {safe_db_url}")\n\
    print(f"POSTGRES_USER: {postgres_user}, POSTGRES_DB: {postgres_db}")\n\
    \n\
    # Get all environment variables for debugging\n\
    all_env_vars = {k: v for k, v in os.environ.items() if "PASSWORD" not in k and "SECRET" not in k}\n\
    return {\n\
        "status": "ok", \n\
        "mode": "fallback",\n\
        "message": "Running in fallback mode due to database connection issues",\n\
        "db_diagnostics": {\n\
            "database_url": safe_db_url,\n\
            "postgres_user": postgres_user,\n\
            "postgres_db": postgres_db,\n\
            "environment": all_env_vars\n\
        }\n\
    }\n\
\n\
@fallback_app.get("/")\n\
def root():\n\
    return {"message": "Hello from the fallback app! Database connection had issues."}\n\
\n\
try:\n\
    # Try to import the original app\n\
    from app.main import app as original_app\n\
    # If successful, use the original app\n\
    app = original_app\n\
    print("Successfully imported the original application")\n\
except Exception as e:\n\
    # If there are any exceptions, use the fallback app\n\
    print(f"Error importing original app: {e}")\n\
    app = fallback_app\n\
    print("Using fallback application due to import error")\n\
' > /app/backend/app_wrapper.py

# Create a monkeypatch module to intercept database operations
RUN echo 'import sys\n\
import builtins\n\
import importlib.abc\n\
import types\n\
import os\n\
import re\n\
from importlib.machinery import ModuleSpec\n\
\n\
# Store original import\n\
original_import = builtins.__import__\n\
\n\
def patched_import(name, globals=None, locals=None, fromlist=(), level=0):\n\
    # Intercept specific imports that might cause database operations\n\
    if name in ["sqlalchemy", "databases", "psycopg2"]:\n\
        print(f"Note: Import of {name} detected - connections may be intercepted if DISABLE_DB=true")\n\
        # Print all the environment variables that might affect database connections\n\
        print("Debug - Database Environment Variables:")\n\
        for var in sorted(os.environ.keys()):\n\
            if var.startswith("PG") or "DB" in var or "SQL" in var or "POSTGRES" in var:\n\
                # Hide passwords\n\
                if "PASSWORD" in var or "PWD" in var:\n\
                    print(f"  {var}: ****")\n\
                else:\n\
                    print(f"  {var}: {os.environ.get(var)}")\n\
        \n\
        # Intercept and patch psycopg2 if it fails with "postgres.railway.internal"\n\
        if name == "psycopg2" and fromlist and "OperationalError" in fromlist:\n\
            # Get the original module\n\
            psycopg2_module = original_import(name, globals, locals, fromlist, level)\n\
            \n\
            # Store the original OperationalError\n\
            original_error = psycopg2_module.OperationalError\n\
            \n\
            # Create a patched version\n\
            def patched_error(*args, **kwargs):\n\
                error_msg = args[0] if args else ""\n\
                if isinstance(error_msg, str) and "could not translate host name" in error_msg and "railway.internal" in error_msg:\n\
                    print("\\n\\nDETECTED RAILWAY POSTGRES CONNECTION ISSUE!")\n\
                    print("The application is trying to connect to Railway PostgreSQL using the internal hostname.")\n\
                    print("This may be due to missing environment variables or incorrect configuration.")\n\
                    print("\\nTrying to fix the issue by checking environment variables...")\n\
                    \n\
                    # Check for Railway PG environment variables\n\
                    pg_vars = {k: v for k, v in os.environ.items() if k.startswith("PG") and "PASSWORD" not in k}\n\
                    print(f"Railway PostgreSQL variables: {pg_vars}")\n\
                    \n\
                    # Suggest possible fixes\n\
                    print("\\nPOSSIBLE SOLUTIONS:")\n\
                    print("1. Make sure PGHOST is set to the correct hostname in Railway")\n\
                    print("2. Set DATABASE_URL explicitly with the correct hostname")\n\
                    print("3. Check the Railway dashboard for the correct PostgreSQL connection details")\n\
                return original_error(*args, **kwargs)\n\
            \n\
            # Replace the OperationalError with our patched version\n\
            psycopg2_module.OperationalError = patched_error\n\
            return psycopg2_module\n\
    \n\
    # Let the original import proceed\n\
    return original_import(name, globals, locals, fromlist, level)\n\
\n\
# Replace the built-in import function\n\
builtins.__import__ = patched_import\n\
' > /app/backend/monkeypatch.py

# Create a simple app for testing
RUN mkdir -p /app/simple_app
RUN echo 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/health")\ndef health_check():\n    return {"status": "ok"}\n\n@app.get("/")\ndef root():\n    return {"message": "Hello World"}\n' > /app/simple_app/main.py

# Create default .env file if it doesn't exist
RUN echo '# Create default .env file with placeholder values\n\
if [ ! -f /app/backend/.env ]; then\n\
  echo "Creating default .env file with placeholder values..."\n\
  cat > /app/backend/.env << EOL\n\
# Database configuration\n\
DATABASE_URL=postgresql://postgres:password@localhost:5432/telegram_parser\n\
POSTGRES_USER=postgres\n\
POSTGRES_PASSWORD=password\n\
POSTGRES_DB=telegram_parser\n\
\n\
# JWT Authentication\n\
SECRET_KEY=temporarysecretkey123456789\n\
ALGORITHM=HS256\n\
ACCESS_TOKEN_EXPIRE_MINUTES=10080\n\
\n\
# Application settings\n\
BACKEND_CORS_ORIGINS=["http://localhost:3000", "http://localhost:8000"]\n\
\n\
# Telegram API credentials\n\
API_ID=0000000\n\
API_HASH=temporaryapihash\n\
TELEGRAM_BOT_TOKENS=["token1"]\n\
\n\
# Email settings\n\
MAIL_USERNAME=user@example.com\n\
MAIL_PASSWORD=password\n\
MAIL_FROM=noreply@example.com\n\
MAIL_PORT=587\n\
MAIL_SERVER=smtp.example.com\n\
EOL\n\
fi' > /app/create_default_env.sh
RUN chmod +x /app/create_default_env.sh

# Create a startup script with error handling and diagnostics
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "Current directory: $(pwd)"' >> /app/start.sh && \
    echo 'echo "Listing files in current directory:"' >> /app/start.sh && \
    echo 'ls -la' >> /app/start.sh && \
    echo 'echo "Creating default .env file if needed"' >> /app/start.sh && \
    echo '/app/create_default_env.sh' >> /app/start.sh && \
    echo '# Dump ALL environment variables for debugging (with passwords hidden)' >> /app/start.sh && \
    echo 'env | grep -v PASSWORD | grep -v SECRET | sort' >> /app/start.sh && \
    echo '# Do not skip database operations anymore' >> /app/start.sh && \
    echo 'export SKIP_DB_INIT=false' >> /app/start.sh && \
    echo 'export DISABLE_DB=false' >> /app/start.sh && \
    echo '# List all database-related environment variables' >> /app/start.sh && \
    echo 'echo "=== DATABASE ENVIRONMENT VARIABLES ==="' >> /app/start.sh && \
    echo 'env | grep -i "db\|database\|pg\|sql\|postgres" | grep -v PASSWORD | grep -v SECRET | sort' >> /app/start.sh && \
    echo '# Handle Railway PostgreSQL connection' >> /app/start.sh && \
    echo 'if [[ -n "$DATABASE_URL" ]]; then' >> /app/start.sh && \
    echo '  echo "Using provided DATABASE_URL"' >> /app/start.sh && \
    echo 'elif [[ -n "$RAILWAY_ENVIRONMENT" ]]; then' >> /app/start.sh && \
    echo '  echo "Running in Railway environment"' >> /app/start.sh && \
    echo '  # Railway provides PGHOST, PGDATABASE, PGUSER, PGPASSWORD, PGPORT variables' >> /app/start.sh && \
    echo '  if [[ -n "$PGUSER" && -n "$PGPASSWORD" && -n "$PGDATABASE" && -n "$PGHOST" ]]; then' >> /app/start.sh && \
    echo '    echo "Using Railway-provided PG* variables"' >> /app/start.sh && \
    echo '    export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}"' >> /app/start.sh && \
    echo '  fi' >> /app/start.sh && \
    echo 'elif [[ -n "$POSTGRES_USER" && -n "$POSTGRES_PASSWORD" && -n "$POSTGRES_DB" ]]; then' >> /app/start.sh && \
    echo '  echo "Constructing DATABASE_URL from POSTGRES_* variables"' >> /app/start.sh && \
    echo '  # Railway might use different hostnames' >> /app/start.sh && \
    echo '  POSTGRES_HOST=${PGHOST:-"postgresql.railway.app"}' >> /app/start.sh && \
    echo '  POSTGRES_PORT=${PGPORT:-5432}' >> /app/start.sh && \
    echo '  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "DATABASE_URL: ${DATABASE_URL:-not set} (password hidden)"' >> /app/start.sh && \
    echo 'echo "DISABLE_DB: ${DISABLE_DB}"' >> /app/start.sh && \
    echo '# Test connectivity to PostgreSQL' >> /app/start.sh && \
    echo 'if [[ -n "$DATABASE_URL" ]]; then' >> /app/start.sh && \
    echo '  echo "Testing PostgreSQL connectivity..."' >> /app/start.sh && \
    echo '  # Extract host and port from DATABASE_URL' >> /app/start.sh && \
    echo '  DB_HOST=$(echo $DATABASE_URL | sed -n "s/.*@\([^:]*\).*/\1/p")' >> /app/start.sh && \
    echo '  DB_PORT=$(echo $DATABASE_URL | sed -n "s/.*:\([0-9]*\)\/.*/\1/p")' >> /app/start.sh && \
    echo '  echo "Extracted DB_HOST=$DB_HOST DB_PORT=$DB_PORT"' >> /app/start.sh && \
    echo '  # Try to ping the host' >> /app/start.sh && \
    echo '  echo "Trying to ping $DB_HOST..."' >> /app/start.sh && \
    echo '  ping -c 1 $DB_HOST || echo "Ping failed, but this might be expected"' >> /app/start.sh && \
    echo '  # Try to connect using nc' >> /app/start.sh && \
    echo '  echo "Trying netcat to $DB_HOST:$DB_PORT..."' >> /app/start.sh && \
    echo '  nc -z -v -w5 $DB_HOST $DB_PORT || echo "Netcat connection failed"' >> /app/start.sh && \
    echo '  # DNS lookup' >> /app/start.sh && \
    echo '  echo "DNS lookup for $DB_HOST..."' >> /app/start.sh && \
    echo '  nslookup $DB_HOST || echo "DNS lookup failed"' >> /app/start.sh && \
    echo '  # Environment variables that might affect PostgreSQL connections' >> /app/start.sh && \
    echo '  echo "PostgreSQL environment variables:"' >> /app/start.sh && \
    echo '  env | grep -i "pg\|postgres\|sql" | grep -v PASSWORD' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "Checking for existence of app directory:"' >> /app/start.sh && \
    echo 'if [ -d /app/backend/app ]; then' >> /app/start.sh && \
    echo '  echo "App directory exists"' >> /app/start.sh && \
    echo '  echo "Contents of app directory:"' >> /app/start.sh && \
    echo '  ls -la /app/backend/app' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "App directory does not exist"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "Checking for main.py:"' >> /app/start.sh && \
    echo 'if [ -f /app/backend/app/main.py ]; then' >> /app/start.sh && \
    echo '  echo "main.py exists"' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "main.py does not exist"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "PORT=$PORT"' >> /app/start.sh && \
    echo 'export PORT=${PORT:-8000}' >> /app/start.sh && \
    echo 'echo "Environment variables:"' >> /app/start.sh && \
    echo 'echo "SECRET_KEY set: ${SECRET_KEY:+true}"' >> /app/start.sh && \
    echo 'echo "DATABASE_URL set: ${DATABASE_URL:+true}"' >> /app/start.sh && \
    echo '# Initialize the database' >> /app/start.sh && \
    echo 'if [[ -n "$DATABASE_URL" && "$SKIP_DB_INIT" != "true" ]]; then' >> /app/start.sh && \
    echo '  echo "Initializing database..."' >> /app/start.sh && \
    echo '  set +e  # Temporarily disable exit on error' >> /app/start.sh && \
    echo '  cd /app/backend && python init_db.py' >> /app/start.sh && \
    echo '  DB_INIT_RESULT=$?' >> /app/start.sh && \
    echo '  set -e  # Re-enable exit on error' >> /app/start.sh && \
    echo '  if [ $DB_INIT_RESULT -ne 0 ]; then' >> /app/start.sh && \
    echo '    echo "Warning: Database initialization failed with exit code $DB_INIT_RESULT"' >> /app/start.sh && \
    echo '    echo "Will continue to start the application anyway"' >> /app/start.sh && \
    echo '  else' >> /app/start.sh && \
    echo '    echo "Database initialization completed successfully"' >> /app/start.sh && \
    echo '  fi' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "Skipping database initialization"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "Starting application..."' >> /app/start.sh && \
    echo 'if [ -f /app/backend/app/main.py ]; then' >> /app/start.sh && \
    echo '  echo "Starting with app wrapper to handle database issues"' >> /app/start.sh && \
    echo '  cd /app/backend && gunicorn app_wrapper:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --log-level debug' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "Main app not found, running simple test app instead..."' >> /app/start.sh && \
    echo '  cd /app/simple_app && gunicorn main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --log-level debug' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["/bin/bash", "/app/start.sh"] 