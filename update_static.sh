#!/bin/bash

echo "=== Updating frontend static files ==="

# Navigate to frontend directory
cd frontend

# Build the frontend
echo "Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error: Frontend build failed!"
    exit 1
fi

# Copy built files to backend static directory
echo "Copying files to backend/static..."
rm -rf ../backend/static/*
cp -r build/* ../backend/static/

# Create env-config.js if it doesn't exist
if [ ! -f ../backend/static/env-config.js ]; then
    echo "Creating env-config.js..."
    echo 'window.ENV = { API_URL: "/api/v1" };' > ../backend/static/env-config.js
fi

# Verify index.html exists
if [ -f ../backend/static/index.html ]; then
    echo "Verified: index.html exists in backend/static/"
else
    echo "ERROR: index.html not found in backend/static/"
    exit 1
fi

# List important files
echo "Verifying static files..."
echo "Static root files:"
ls -la ../backend/static/ | head -10

echo "JS files:"
ls -la ../backend/static/static/js/ | grep main

echo "CSS files:"
ls -la ../backend/static/static/css/ | grep main

echo "=== Static files update complete ==="
echo ""
echo "To restart the server, run:"
echo "cd backend && STATIC_FILES_DIR=\$(pwd)/static uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" 