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
    echo '# Dump environment variables for debugging' >> /app/start.sh && \
    echo 'env | sort' >> /app/start.sh && \
    echo '# Skip database initialization for now to prevent startup failures' >> /app/start.sh && \
    echo 'export SKIP_DB_INIT=true' >> /app/start.sh && \
    echo '# Handle Railway PostgreSQL connection' >> /app/start.sh && \
    echo 'if [[ -n "$DATABASE_URL" ]]; then' >> /app/start.sh && \
    echo '  echo "Using provided DATABASE_URL"' >> /app/start.sh && \
    echo 'elif [[ -n "$PGHOST" && -n "$PGUSER" && -n "$PGPASSWORD" && -n "$PGDATABASE" ]]; then' >> /app/start.sh && \
    echo '  echo "Constructing DATABASE_URL from PG* variables"' >> /app/start.sh && \
    echo '  export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT:-5432}/${PGDATABASE}"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'echo "DATABASE_URL: ${DATABASE_URL:-not set}"' >> /app/start.sh && \
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
    echo '  echo "Starting the actual FastAPI application"' >> /app/start.sh && \
    echo '  cd /app/backend && gunicorn app.main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --log-level debug' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "Main app not found, running simple test app instead..."' >> /app/start.sh && \
    echo '  cd /app/simple_app && gunicorn main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --log-level debug' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["/bin/bash", "/app/start.sh"] 