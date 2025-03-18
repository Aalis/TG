#!/bin/bash
set -e

# Print environment for debugging (without sensitive values)
echo "Environment variables (sensitive values hidden):"
env | grep -v PASSWORD | grep -v SECRET | grep -v TOKEN | sort

# Print current directory
echo "Current directory: $(pwd)"
echo "Directory listing:"
ls -la

# Check if Python is available
echo "Python version:"
python --version

# Check if the database URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "WARNING: DATABASE_URL is not set!"
else
    echo "DATABASE_URL is set (value hidden)"
fi

# Initialize the database
echo "Initializing database..."
if [ -f "/app/init_db.py" ]; then
    echo "Found init_db.py, attempting to run it..."
    python /app/init_db.py || echo "Warning: init_db.py execution failed but continuing"
else
    echo "Warning: /app/init_db.py not found, skipping database initialization"
    ls -la /app/
fi

# Run migrations if alembic is available
if [ -d "/app/alembic" ] && [ -f "/app/alembic.ini" ]; then
    echo "Running database migrations..."
    cd /app && alembic upgrade head || echo "Warning: alembic migrations failed but continuing"
else
    echo "Alembic files not found, skipping migrations"
    echo "Contents of /app directory:"
    ls -la /app/
fi

# Create superuser if environment variables are set
if [ -n "$SUPERUSER_EMAIL" ] && [ -n "$SUPERUSER_PASSWORD" ]; then
    echo "Creating superuser..."
    if [ -f "/app/create_superuser.py" ]; then
        python /app/create_superuser.py || echo "Warning: superuser creation failed but continuing"
    else
        echo "Warning: /app/create_superuser.py not found, skipping superuser creation"
    fi
else
    echo "No superuser credentials provided, skipping superuser creation"
fi

# Start the application
echo "Starting application with Gunicorn and ${WORKERS:-2} workers..."
cd /app || { echo "Error: Failed to change directory to /app"; exit 1; }

# Check if the Python module structure is correct
if [ -d "/app/app" ]; then
    echo "Found /app/app directory, proceeding..."
    ls -la /app/app/
else
    echo "WARNING: /app/app directory not found! Application may fail to start."
    echo "Content of /app directory:"
    ls -la /app/
fi

# Start Gunicorn with error handling
echo "Executing: gunicorn app.main:app --workers ${WORKERS:-2} --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:${PORT:-8000}"
exec gunicorn app.main:app \
    --workers ${WORKERS:-2} \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:${PORT:-8000} \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - 