FROM python:3.9-slim

WORKDIR /app

# Install PostgreSQL client and other dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire project
COPY . .

# Install dependencies
WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Create a patch for the FastAPI app to add healthcheck
RUN echo 'from fastapi import FastAPI\n\ndef add_healthcheck(app: FastAPI):\n    @app.get("/health")\n    def health_check():\n        return {"status": "ok"}' > /app/healthcheck.py

# Modify the main FastAPI app to include the health check if it doesn't exist
RUN if [ -f /app/backend/app/main.py ]; then \
        echo "Patching main.py with healthcheck endpoint"; \
        grep -q "add_healthcheck" /app/backend/app/main.py || \
        sed -i '/import /a import sys\nsys.path.insert(0, "/app")\nfrom healthcheck import add_healthcheck' /app/backend/app/main.py; \
        grep -q "add_healthcheck(app)" /app/backend/app/main.py || \
        sed -i '/app = FastAPI/a add_healthcheck(app)' /app/backend/app/main.py; \
    fi

# Create a startup script
RUN echo '#!/bin/bash' > /app/start.sh && \
    echo 'echo "Waiting for database..."' >> /app/start.sh && \
    echo 'sleep 20' >> /app/start.sh && \
    echo 'echo "Initializing database..."' >> /app/start.sh && \
    echo 'cd /app/backend && python init_db.py || echo "Database initialization failed but continuing"' >> /app/start.sh && \
    echo 'echo "Starting application..."' >> /app/start.sh && \
    echo 'cd /app/backend && gunicorn app.main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT --timeout 180' >> /app/start.sh && \
    chmod +x /app/start.sh

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["/bin/bash", "/app/start.sh"] 