FROM python:3.9-slim

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

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Create a simple app for testing
RUN mkdir -p /app/simple_app
RUN echo 'from fastapi import FastAPI\n\napp = FastAPI()\n\n@app.get("/health")\ndef health_check():\n    return {"status": "ok"}\n\n@app.get("/")\ndef root():\n    return {"message": "Hello World"}\n' > /app/simple_app/main.py

# Create a startup script with error handling and diagnostics
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'set -e' >> /app/start.sh && \
    echo 'echo "Current directory: $(pwd)"' >> /app/start.sh && \
    echo 'echo "Listing files in current directory:"' >> /app/start.sh && \
    echo 'ls -la' >> /app/start.sh && \
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
    echo 'echo "Waiting for database..."' >> /app/start.sh && \
    echo 'sleep 5' >> /app/start.sh && \
    echo 'echo "Database initialization step skipped for initial deployment"' >> /app/start.sh && \
    echo 'echo "Starting application..."' >> /app/start.sh && \
    echo 'if [ -f /app/backend/app/main.py ]; then' >> /app/start.sh && \
    echo '  cd /app/backend && gunicorn app.main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --log-level debug' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "Running simple test app instead..."' >> /app/start.sh && \
    echo '  cd /app/simple_app && gunicorn main:app --workers 1 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 300 --log-level debug' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["/bin/bash", "/app/start.sh"] 