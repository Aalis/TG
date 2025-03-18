# Railway Deployment Guide for FastAPI Project

This guide walks you through the process of deploying the FastAPI Telegram Parser application to Railway.

## Preparation

1. Make sure your code is committed to a Git repository
2. Sign up for a Railway account at https://railway.app
3. Install the Railway CLI if you want to deploy from your local machine:
   ```
   npm install -g @railway/cli
   ```

## Required Files

The following files are required for deployment:

- `Dockerfile` - Defines the container image
- `railway.toml` - Railway-specific configuration
- `backend/requirements.txt` - Python dependencies
- `backend/entrypoint.sh` - Container startup script
- `backend/.env` - Environment variables (not committed to Git)
- `Procfile` - Alternative way to start your application

## Environment Variables

Ensure the following environment variables are set in Railway:

```
# Database configuration
DATABASE_URL=postgresql://postgres:password@postgres-service:5432/railway

# JWT Authentication
SECRET_KEY=your_secret_key_here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Telegram API credentials
API_ID=your_api_id
API_HASH=your_api_hash
TELEGRAM_BOT_TOKENS=bot_token1,bot_token2,bot_token3

# Email settings
MAIL_USERNAME=your_gmail_username
MAIL_PASSWORD=your_gmail_app_password
MAIL_FROM=your_gmail_address
SERVER_HOST=your_railway_url
FRONTEND_URL=your_frontend_url

# Redis settings
REDIS_HOST=redis-service
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
REDIS_CLIENT_EXPIRY=300

# Application settings
WORKERS=2
PYTHONUNBUFFERED=1
PORT=8000
```

## Deployment Methods

### Method 1: Using the Railway Dashboard

1. Log in to your Railway dashboard
2. Create a new project
3. Select "Deploy from GitHub repo"
4. Select your GitHub repository
5. Railway will automatically detect the Dockerfile and deploy your application
6. Add the required environment variables in the project settings
7. Add PostgreSQL and Redis services from the "New Service" option
8. Connect the services to your application

### Method 2: Using the Railway CLI

1. Log in to the Railway CLI:
   ```
   railway login
   ```

2. Initialize a new project:
   ```
   railway init
   ```

3. Link your project to Railway:
   ```
   railway link
   ```

4. Set environment variables:
   ```
   railway variables set SECRET_KEY=your_secret_key_here
   # Set other environment variables similarly
   ```

5. Deploy the application:
   ```
   railway up
   ```

### Method 3: Using the Setup Script

We've provided a setup script to streamline the deployment process:

1. Make sure the script is executable:
   ```
   chmod +x setup_railway.sh
   ```

2. Run the script:
   ```
   ./setup_railway.sh
   ```

3. Follow the prompts to set up your environment variables and deploy

## Verifying Deployment

1. Check the deployment logs in the Railway dashboard
2. Access your application at the provided Railway URL
3. Verify health check endpoint works: `<your-railway-url>/health`
4. Run the health check script locally to test connections:
   ```
   python backend/health_check.py
   ```

## Troubleshooting

1. If your application fails to start, check the logs in the Railway dashboard
2. Verify that all environment variables are correctly set
3. Ensure PostgreSQL and Redis services are properly connected
4. Check if the database migrations are running correctly
5. Verify the entrypoint script has execute permissions

## Database Migrations

If you need to run migrations manually:

1. Connect to your container shell through the Railway dashboard
2. Navigate to the application directory: `cd /app`
3. Run Alembic migrations: `alembic upgrade head`

## Scaling

To scale your application:

1. Adjust the `WORKERS` environment variable to control the number of Gunicorn workers
2. Use Railway's auto-scaling features in the Pro plan

## Monitoring

1. Set up monitoring using Railway's built-in metrics dashboard
2. Configure alerts for CPU, memory, and disk usage 