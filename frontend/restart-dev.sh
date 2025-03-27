#!/bin/bash

echo "Stopping any running React development servers..."
pkill -f "node.*react-scripts start" || true

echo "Clearing browser cache (if Chrome is running)..."
# You may need to adapt this for your specific OS
# This is for Linux
pkill -f "google-chrome.*Developer Tools" || true

echo "Starting React development server..."
npm start 