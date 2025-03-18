# Railway Deployment Guide

This guide provides step-by-step instructions for deploying the Telegram Parser API to Railway.

## Prerequisites

1. A Railway account (https://railway.app/)
2. The Railway CLI installed locally (`npm i -g @railway/cli`)
3. Git repository with your code

## Setup Steps

### 1. Login to Railway

```bash
railway login
```

### 2. Initialize Railway Project

```bash
railway init
```

This will create a new project in Railway. Select the appropriate options when prompted.

### 3. Configure Environment Variables

You need to set up the following environment variables in the Railway dashboard:

#### Database Configuration
- `DATABASE_URL`: Railway will provide this automatically when you add a PostgreSQL service
- `POSTGRES_PASSWORD`: Railway will set this automatically
- `POSTGRES_USER`: Usually 'postgres'
- `POSTGRES_DB`: Usually 'railway'

#### JWT Authentication
- `SECRET_KEY`: Your secret key for JWT token generation
- `ALGORITHM`: HS256
- `ACCESS_TOKEN_EXPIRE_MINUTES`: 10080 (7 days)

#### Telegram API credentials
- `API_ID`: Your Telegram API ID
- `API_HASH`: Your Telegram API Hash
- `TELEGRAM_BOT_TOKENS`: Your comma-separated list of Telegram bot tokens

#### Email Configuration
- `MAIL_USERNAME`: Your email username
- `MAIL_PASSWORD`: Your email password
- `MAIL_FROM`: Your sender email
- `SERVER_HOST`: Your Railway app URL (e.g., https://your-app-name.up.railway.app)
- `FRONTEND_URL`: URL to your frontend application

#### Redis Configuration
- `REDIS_HOST`: Railway will provide this automatically when you add a Redis service
- `REDIS_PORT`: Usually 6379
- `REDIS_DB`: 0
- `REDIS_PASSWORD`: Railway will set this automatically
- `REDIS_CLIENT_EXPIRY`: 300

#### Application Settings
- `BACKEND_CORS_ORIGINS`: A list of allowed origins for CORS, e.g., `["https://your-frontend-app.up.railway.app"]`
- `PORT`: 8000
- `WORKERS`: 2

### 4. Add PostgreSQL and Redis to Your Project

In the Railway dashboard:
1. Go to your project
2. Click "New"
3. Select "Database" → "PostgreSQL"
4. Click "New" again
5. Select "Database" → "Redis"

Railway will automatically inject the database connection details into your application.

### 5. Deploy Your Application

Push your code to GitHub and connect your repository to Railway, or deploy directly using the CLI:

```bash
railway up
```

### 6. Monitor Your Deployment

You can monitor your deployment in the Railway dashboard. Check the logs to ensure everything is working correctly.

### 7. Verify Health Check Endpoint

Once deployed, verify the health check endpoint is working:

```
https://your-app-name.up.railway.app/health
```

It should return a JSON response indicating the application is healthy.

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:
1. Verify the `DATABASE_URL` is correctly set
2. Check if the database has been properly created
3. Ensure your application is using the correct connection details

### Application Crashes

If your application crashes:
1. Check the logs in the Railway dashboard
2. Verify all required environment variables are set
3. Ensure your application's health check endpoint is properly implemented

### Cold Starts

Railway may put your application to sleep if it's not receiving traffic. The first request after a period of inactivity may take longer to respond. This is normal behavior.

## Railway Scaling

Railway automatically scales your application based on usage. You don't need to manually configure scaling settings.

## Cost Optimization

To optimize costs on Railway:
1. Use the smallest possible instance type for your needs
2. Use smaller database instances when possible
3. Monitor usage and adjust resources accordingly

## Continuous Deployment

Railway supports continuous deployment from GitHub. When you push changes to your repository, Railway will automatically deploy them to your application. 