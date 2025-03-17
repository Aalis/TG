#!/bin/bash

# Kill all Gunicorn processes
echo "Killing all Gunicorn processes..."
pkill -9 -f gunicorn

# Wait a moment to ensure all processes are terminated
sleep 2

# Check if port 8000 is still in use
if ss -tuln | grep -q 8000; then
    echo "Port 8000 is still in use. Please check manually."
    exit 1
fi

# Navigate to the backend directory
cd backend

# Start Gunicorn in the background
echo "Starting Gunicorn in the background with 2 workers..."
nohup gunicorn app.main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000 --log-level info > ../gunicorn.log 2>&1 &

echo "Gunicorn started with PID: $!"
echo "Logs are being written to gunicorn.log" 