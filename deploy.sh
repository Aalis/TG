#!/bin/bash

# Get current timestamp
TIMESTAMP=$(date +%s)

# Build the Docker image with the timestamp as a build argument
docker build --build-arg CACHE_BUST_TIME=$TIMESTAMP -t tg-app .

# Push changes to git
git add .
git commit -m "deploy: force rebuild with timestamp $TIMESTAMP"
git push

echo "Deployment triggered with timestamp: $TIMESTAMP"
echo "Railway should now rebuild without using cache for the frontend." 