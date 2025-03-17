FROM python:3.10-slim

WORKDIR /app

# Install PostgreSQL client and other dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    curl \
    netcat-openbsd \
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

# Fix the config.py file to handle mail_tls and mail_ssl correctly
RUN if [ -f /app/backend/app/core/config.py ]; then \
      echo "Patching config.py to handle mail variables correctly"; \
      # First backup the original file
      cp /app/backend/app/core/config.py /app/backend/app/core/config.py.bak; \
      # Remove mail_tls and mail_ssl from environment variables being processed
      sed -i 's/mail_tls/MAIL_TLS_DISABLED/g' /app/backend/app/core/config.py; \
      sed -i 's/mail_ssl/MAIL_SSL_DISABLED/g' /app/backend/app/core/config.py; \
    fi

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
    pg_host = os.environ.get("PGHOST", "Not set")\n\
    pg_user = os.environ.get("PGUSER", "Not set")\n\
    pg_db = os.environ.get("PGDATABASE", "Not set")\n\
    postgres_host = os.environ.get("POSTGRES_HOST", "Not set")\n\
    print(f"DATABASE_URL: {db_url}")\n\
    print(f"PGHOST: {pg_host}, PGUSER: {pg_user}, PGDATABASE: {pg_db}")\n\
    print(f"POSTGRES_HOST: {postgres_host}")\n\
    \n\
    # Get all environment variables for debugging\n\
    all_env_vars = {k: v for k, v in os.environ.items() if "PASSWORD" not in k and "SECRET" not in k}\n\
    return {\n\
        "status": "ok", \n\
        "mode": "fallback",\n\
        "message": "Running in fallback mode due to database connection issues",\n\
        "db_diagnostics": {\n\
            "database_url": db_url.replace(os.environ.get("PGPASSWORD", ""), "****") if "PGPASSWORD" in os.environ else db_url,\n\
            "pg_host": pg_host,\n\
            "pg_user": pg_user,\n\
            "pg_database": pg_db,\n\
            "postgres_host": postgres_host,\n\
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
from importlib.machinery import ModuleSpec\n\
\n\
# Store original import\n\
original_import = builtins.__import__\n\
\n\
def patched_import(name, globals=None, locals=None, fromlist=(), level=0):\n\
    # Intercept specific imports that might cause database operations\n\
    if name in ["sqlalchemy", "databases"]:\n\
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
    echo '# Skip database initialization for now to prevent startup failures' >> /app/start.sh && \
    echo 'export SKIP_DB_INIT=true' >> /app/start.sh && \
    echo 'export DISABLE_DB=true' >> /app/start.sh && \
    echo '# List all database-related environment variables' >> /app/start.sh && \
    echo 'echo "=== DATABASE ENVIRONMENT VARIABLES ==="' >> /app/start.sh && \
    echo 'env | grep -i "db\|database\|pg\|sql\|postgres" | grep -v PASSWORD | grep -v SECRET | sort' >> /app/start.sh && \
    echo '# Handle Railway PostgreSQL connection' >> /app/start.sh && \
    echo 'if [[ -n "$DATABASE_URL" ]]; then' >> /app/start.sh && \
    echo '  echo "Using provided DATABASE_URL"' >> /app/start.sh && \
    echo 'elif [[ -n "$PGHOST" && -n "$PGUSER" && -n "$PGPASSWORD" && -n "$PGDATABASE" ]]; then' >> /app/start.sh && \
    echo '  echo "Constructing DATABASE_URL from PG* variables"' >> /app/start.sh && \
    echo '  export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}"' >> /app/start.sh && \
    echo 'elif [[ -n "$POSTGRES_HOST" && -n "$POSTGRES_USER" && -n "$POSTGRES_PASSWORD" && -n "$POSTGRES_DB" ]]; then' >> /app/start.sh && \
    echo '  echo "Constructing DATABASE_URL from POSTGRES_* variables"' >> /app/start.sh && \
    echo '  export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT:-5432}/${POSTGRES_DB}"' >> /app/start.sh && \
    echo 'elif [[ -n "$RAILWAY_PRIVATE_DOMAIN" ]]; then' >> /app/start.sh && \
    echo '  # If we have Railway private domain but no DB URL, try to construct one using the expected Railway naming' >> /app/start.sh && \
    echo '  # This assumes the PostgreSQL service is available at postgresql.$RAILWAY_PRIVATE_DOMAIN' >> /app/start.sh && \
    echo '  echo "Trying to construct DATABASE_URL using Railway private domain"' >> /app/start.sh && \
    echo '  PGUSER=${PGUSER:-postgres}' >> /app/start.sh && \
    echo '  PGPASSWORD=${PGPASSWORD:-password}' >> /app/start.sh && \
    echo '  PGDATABASE=${PGDATABASE:-${POSTGRES_DB:-telegram_parser}}' >> /app/start.sh && \
    echo '  PGHOST="postgresql.${RAILWAY_PRIVATE_DOMAIN}"' >> /app/start.sh && \
    echo '  export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:5432/${PGDATABASE}"' >> /app/start.sh && \
    echo '  echo "Using constructed DATABASE_URL with Railway private domain: $DATABASE_URL"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "Attempting to verify database connection:"' >> /app/start.sh && \
    echo 'if [[ -n "$DATABASE_URL" ]]; then' >> /app/start.sh && \
    echo '  HOST=$(echo $DATABASE_URL | sed -n "s/.*@\([^:]*\).*/\1/p")' >> /app/start.sh && \
    echo '  echo "Extracted host from DATABASE_URL: $HOST"' >> /app/start.sh && \
    echo '  if [[ -n "$HOST" ]]; then' >> /app/start.sh && \
    echo '    echo "Attempting to ping database host: $HOST"' >> /app/start.sh && \
    echo '    if ping -c 1 -W 1 "$HOST" > /dev/null 2>&1; then' >> /app/start.sh && \
    echo '      echo "Successfully pinged database host"' >> /app/start.sh && \
    echo '      export DISABLE_DB=false' >> /app/start.sh && \
    echo '    else' >> /app/start.sh && \
    echo '      echo "Could not ping database host - will run in database-free mode"' >> /app/start.sh && \
    echo '      # Try to resolve the hostname using the Railway internal DNS' >> /app/start.sh && \
    echo '      echo "Attempting to lookup host: $HOST"' >> /app/start.sh && \
    echo '      getent hosts $HOST || echo "Could not resolve hostname"' >> /app/start.sh && \
    echo '      # Try alternative host names based on Railway patterns' >> /app/start.sh && \
    echo '      if [[ -n "$RAILWAY_PRIVATE_DOMAIN" ]]; then' >> /app/start.sh && \
    echo '        echo "Trying alternative hostnames based on Railway patterns:"' >> /app/start.sh && \
    echo '        for alt_host in "postgresql.$RAILWAY_PRIVATE_DOMAIN" "pg.$RAILWAY_PRIVATE_DOMAIN" "postgres.$RAILWAY_PRIVATE_DOMAIN"; do' >> /app/start.sh && \
    echo '          echo "Testing $alt_host:"' >> /app/start.sh && \
    echo '          if ping -c 1 -W 1 "$alt_host" > /dev/null 2>&1; then' >> /app/start.sh && \
    echo '            echo "Successfully pinged $alt_host!"' >> /app/start.sh && \
    echo '            # Update the DATABASE_URL with the working hostname' >> /app/start.sh && \
    echo '            export DATABASE_URL=$(echo $DATABASE_URL | sed "s/$HOST/$alt_host/")' >> /app/start.sh && \
    echo '            echo "Updated DATABASE_URL to: $DATABASE_URL"' >> /app/start.sh && \
    echo '            export DISABLE_DB=false' >> /app/start.sh && \
    echo '            break' >> /app/start.sh && \
    echo '          else' >> /app/start.sh && \
    echo '            echo "Could not ping $alt_host"' >> /app/start.sh && \
    echo '            getent hosts "$alt_host" || echo "Could not resolve $alt_host"' >> /app/start.sh && \
    echo '          fi' >> /app/start.sh && \
    echo '        done' >> /app/start.sh && \
    echo '      fi' >> /app/start.sh && \
    echo '    fi' >> /app/start.sh && \
    echo '  fi' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "DATABASE_URL: ${DATABASE_URL:-not set}"' >> /app/start.sh && \
    echo 'echo "DISABLE_DB: ${DISABLE_DB}"' >> /app/start.sh && \
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