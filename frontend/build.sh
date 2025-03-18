#!/bin/bash
set -e

echo "Installing frontend dependencies..."
npm install --legacy-peer-deps

echo "Building frontend application..."
npm run build

echo "Creating static directory..."
mkdir -p ../backend/static

echo "Copying build files to static directory..."
cp -r build/* ../backend/static/

echo "Frontend build and copy completed successfully!" 