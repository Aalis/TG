#!/bin/bash
set -e

echo "Setting up your FastAPI application for Railway deployment..."

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "Railway CLI is not installed. Installing..."
    npm install -g @railway/cli
    echo "Railway CLI installed successfully!"
else
    echo "Railway CLI is already installed."
fi

# Log in to Railway
echo "Please log in to your Railway account..."
railway login

# Create a new project
echo "Creating a new Railway project..."
railway init

# Link environment variables
echo "This script will now help you set up your environment variables."
echo "You'll need to provide:"
echo "  1. PostgreSQL connection details"
echo "  2. Redis connection details"
echo "  3. JWT secret key"
echo "  4. Telegram API credentials"
echo "  5. Email service credentials"

# Generate a random secret key
SECRET_KEY=$(openssl rand -hex 32)
echo "Generated a random secret key."

# Set up environment variables
echo "Setting up environment variables..."
railway variables set SECRET_KEY=$SECRET_KEY
railway variables set ALGORITHM=HS256
railway variables set ACCESS_TOKEN_EXPIRE_MINUTES=10080
railway variables set WORKERS=2
railway variables set PYTHONUNBUFFERED=1
railway variables set BACKEND_CORS_ORIGINS='["https://<your-app-url>", "http://localhost:3000"]'

# Prompt for required variables
echo "Please provide your Telegram API credentials:"
read -p "API_ID: " API_ID
read -p "API_HASH: " API_HASH
read -p "TELEGRAM_BOT_TOKENS (comma-separated): " TELEGRAM_BOT_TOKENS

echo "Please provide your email service credentials:"
read -p "MAIL_USERNAME: " MAIL_USERNAME
read -p "MAIL_PASSWORD: " MAIL_PASSWORD
read -p "MAIL_FROM: " MAIL_FROM
read -p "FRONTEND_URL: " FRONTEND_URL

# Set the variables
railway variables set API_ID=$API_ID
railway variables set API_HASH=$API_HASH
railway variables set TELEGRAM_BOT_TOKENS=$TELEGRAM_BOT_TOKENS
railway variables set MAIL_USERNAME=$MAIL_USERNAME
railway variables set MAIL_PASSWORD=$MAIL_PASSWORD
railway variables set MAIL_FROM=$MAIL_FROM
railway variables set FRONTEND_URL=$FRONTEND_URL

echo "Environment variables set successfully!"

# Deploy the application
echo "Ready to deploy your application to Railway?"
read -p "Deploy now? (y/n): " DEPLOY_NOW

if [[ $DEPLOY_NOW == "y" ]]; then
    echo "Deploying to Railway..."
    railway up
    echo "Deployment initiated! You can check the status on the Railway dashboard."
else
    echo "You can deploy later by running: railway up"
fi

echo "Setup complete! Your FastAPI application is ready for Railway deployment." 