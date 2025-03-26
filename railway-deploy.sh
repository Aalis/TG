#!/bin/bash

# This script forces a clean build on Railway by modifying a file to break caching

# Generate a unique timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Create or update a cache busting file
echo "CACHE_BUST_TIME=$TIMESTAMP" > .cache-bust

# Add and commit the change
git add .cache-bust
git commit -m "Cache bust for deployment: $TIMESTAMP"

# Push to Railway
git push origin railway-test3

echo "Pushed cache busting update with timestamp: $TIMESTAMP"
echo "Now deploy via Railway dashboard or CLI:"
echo "railway up --detach" 