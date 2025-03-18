#!/bin/bash

# Install dependencies
npm install --legacy-peer-deps

# Build the application
npm run build

# Create static directory in backend if it doesn't exist
mkdir -p ../static

# Copy build files to static directory
cp -r build/* ../static/

echo "Frontend build completed and files copied to ../static/" 