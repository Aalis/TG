#!/bin/bash

# Script to build the frontend and copy it to the static directory for Railway deployment

echo "Building frontend for Railway deployment..."

# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Build the frontend
npm run build

# Create the static directory if it doesn't exist
mkdir -p ../static

# Copy the build files to the static directory
cp -R build/* ../static/

echo "Frontend build completed and copied to static directory."
echo "Ready for Railway deployment!" 