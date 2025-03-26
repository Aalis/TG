#!/bin/bash

# This script forces a clean build on Railway by passing a unique timestamp as CACHE_BUST_TIME

# Generate a unique timestamp
TIMESTAMP=$(date +%Y%m%d%H%M%S)

# Deploy with the unique timestamp
railway up --detach --build-arg CACHE_BUST_TIME=$TIMESTAMP

echo "Deployed with cache-busting timestamp: $TIMESTAMP" 