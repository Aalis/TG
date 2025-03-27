#!/bin/bash

# Exit on error
set -e

echo "Starting frontend build process..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Set environment variables for production build
export NODE_ENV=production
export INLINE_RUNTIME_CHUNK=false  # Avoid inline scripts for better CSP
export GENERATE_SOURCEMAP=false    # Reduce file size in production

# Add public URL if specified, otherwise use relative paths
if [ -n "$PUBLIC_URL" ]; then
  echo "Using PUBLIC_URL: $PUBLIC_URL"
else
  echo "Using relative paths for assets"
  export PUBLIC_URL="./"
fi

# Clean any previous build
echo "Cleaning previous build..."
rm -rf build

# Build the React app
echo "Building React app..."
npm run build

# Ensure all necessary files exist
echo "Verifying build output..."
if [ ! -f "build/index.html" ]; then
  echo "ERROR: build/index.html does not exist!"
  exit 1
fi

# Make sure asset-manifest.json exists in root
if [ ! -f "build/asset-manifest.json" ]; then
  echo "ERROR: build/asset-manifest.json does not exist!"
  exit 1
fi

# Create a version.json file with build timestamp
echo "Adding version info..."
echo "{\"buildTime\": \"$(date -u +"%Y-%m-%dT%H:%M:%SZ")\", \"version\": \"$(node -p "require('./package.json').version")\"}" > build/version.json

# Copy to backend static directory if specified
if [ "$1" == "copy" ]; then
  echo "Copying build to backend/static..."
  
  # Create backend/static directory if it doesn't exist
  mkdir -p ../backend/static
  
  # Copy all files
  cp -R build/* ../backend/static/
  
  echo "Build successfully copied to backend/static/"
else
  echo "Build completed successfully"
  echo "To copy to backend, run: ./build.sh copy"
fi 