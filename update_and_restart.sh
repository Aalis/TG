#!/bin/bash

# Run update_static.sh to build the frontend and update static files
echo "Step 1: Updating static files..."
./update_static.sh

# Check if update was successful
if [ $? -ne 0 ]; then
    echo "Static files update failed. Aborting restart."
    exit 1
fi

# Stop any running uvicorn processes
echo ""
echo "Step 2: Stopping any running uvicorn processes..."
pkill -f "uvicorn app.main:app" || true
sleep 2

# Navigate to backend directory and start the server
echo ""
echo "Step 3: Starting the server..."
cd backend
STATIC_FILES_DIR=$(pwd)/static uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 