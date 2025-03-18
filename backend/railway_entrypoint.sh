#!/bin/bash
set -e

# Print environment for debugging (without sensitive values)
echo "Environment variables (sensitive values hidden):"
env | grep -v PASSWORD | grep -v SECRET | grep -v TOKEN | sort

# Initialize the database
echo "Initializing database..."
python /app/init_db.py

# Run migrations if alembic is available
if [ -d "/app/alembic" ] && [ -f "/app/alembic.ini" ]; then
    echo "Running database migrations..."
    alembic upgrade head
fi

# Start the application
echo "Starting application with Gunicorn and ${WORKERS:-2} workers..."
exec gunicorn app.main:app \
    --workers ${WORKERS:-2} \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:${PORT:-8000} \
    --access-logfile - \
    --error-logfile - 