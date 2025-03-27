#!/bin/bash

echo "=== Restarting Backend Server ==="

# Kill any existing uvicorn processes
echo "Stopping any running uvicorn processes..."
pkill -f "uvicorn app.main:app" || true
sleep 2

# Navigate to backend directory
cd backend

# Set the static files directory to the absolute path
STATIC_DIR=$(pwd)/static
echo "Using static directory: $STATIC_DIR"

# Check if the static directory exists and contains index.html
if [ -d "$STATIC_DIR" ]; then
    echo "Static directory exists."
    
    # Count files in static directory
    FILE_COUNT=$(find "$STATIC_DIR" -type f | wc -l)
    echo "Found $FILE_COUNT files in static directory."
    
    if [ -f "$STATIC_DIR/index.html" ]; then
        echo "index.html found."
    else
        echo "WARNING: index.html not found in static directory!"
        echo "Run ./update_static.sh first to build and copy frontend files."
    fi
else
    echo "ERROR: Static directory does not exist!"
    mkdir -p "$STATIC_DIR"
    echo "Created empty static directory."
fi

# Start the server
echo "Starting uvicorn server..."
STATIC_FILES_DIR="$STATIC_DIR" uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 