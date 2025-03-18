# Railway Web UI Deployment Guide

This guide provides step-by-step instructions for deploying the Telegram Parser API to Railway using the web UI.

## Prerequisites

1. A Railway account (https://railway.app/)
2. A GitHub repository with your code
3. All the necessary files (Dockerfile, docker-compose.yml, etc.) committed to your repository

## Deployment Steps

### 1. Sign in to Railway

Go to [Railway](https://railway.app/) and sign in using your GitHub account or email.

### 2. Create a New Project

1. From the Railway dashboard, click on the **New Project** button.
2. Select **Deploy from GitHub repo**.
3. If you haven't connected your GitHub account yet, you'll be prompted to do so.
4. Select the repository containing your Telegram Parser API code.

### 3. Configure the Deployment

After selecting your repository, Railway will detect your Dockerfile and automatically configure the deployment:

1. Make sure the **Builder** is set to **Dockerfile**.
2. Verify that the **Dockerfile Path** is set to `Dockerfile` (in the root directory).
3. Click **Deploy** to start the initial deployment.

### 4. Add PostgreSQL Service

1. Once your project is created, click on **New** in your project dashboard.
2. Select **Database** → **PostgreSQL**.
3. Railway will create a new PostgreSQL service and provide connection details automatically.

### 5. Add Redis Service

1. Click on **New** again in your project dashboard.
2. Select **Database** → **Redis**.
3. Railway will create a new Redis service and connect it to your project.

### 6. Configure Environment Variables

1. Go back to your main service (the one running your FastAPI application).
2. Click on the **Variables** tab.
3. Add the following environment variables:

#### Database Configuration
- `DATABASE_URL` will be automatically provided by Railway when you connect the PostgreSQL service
- `POSTGRES_USER`: postgres
- `POSTGRES_DB`: railway

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
- `SERVER_HOST`: Your Railway app URL (will be provided in the Settings tab)
- `FRONTEND_URL`: URL to your frontend application

#### Redis Configuration
- `REDIS_HOST`: Railway will provide this automatically when you add a Redis service
- `REDIS_PORT`: 6379
- `REDIS_DB`: 0
- `REDIS_PASSWORD`: Railway will provide this automatically
- `REDIS_CLIENT_EXPIRY`: 300

#### Application Settings
- `BACKEND_CORS_ORIGINS`: A list of allowed origins for CORS, e.g., `["https://your-frontend-app.up.railway.app"]`
- `PORT`: 8000
- `WORKERS`: 2
- `PYTHONUNBUFFERED`: 1

### 7. Link Services

1. Go to the **Settings** tab of your main service.
2. Scroll down to the **Service Links** section.
3. Link both your PostgreSQL and Redis services.
4. Railway will automatically provide the connection details as environment variables.

### 8. Configure Health Check

1. Go to the **Settings** tab of your main service.
2. Scroll to the **Health Check** section.
3. Set the **Path** to `/health`.
4. Set the **Timeout** to 300 seconds.

### 9. Deploy Again

1. Go to the **Deployments** tab.
2. Click on **Deploy Now** to trigger a new deployment with all your configurations.

### 10. Monitor Deployment

1. Go to the **Deployments** tab to monitor the progress of your deployment.
2. Click on a deployment to view its logs and status.

### 11. Access Your Application

Once the deployment is successful:

1. Go to the **Settings** tab.
2. Find your application's URL under **Domains**.
3. Visit `https://your-app-url/health` to verify that the application is healthy.
4. Visit `https://your-app-url/docs` to access the API documentation.

## Troubleshooting

### Database Connection Issues

If you encounter database connection issues:

1. Make sure the PostgreSQL service is properly linked to your main service.
2. Check the logs for any database connection errors.
3. Verify the `DATABASE_URL` environment variable is correctly set.

### Application Crashes

If your application crashes:

1. Check the logs in the **Deployments** tab.
2. Verify all required environment variables are set correctly.
3. Make sure your health check endpoint is properly implemented.

### Cold Starts

Railway may put your application to sleep if it's not receiving traffic. The first request after a period of inactivity may take longer to respond. This is normal behavior.

## Continuous Deployment

Railway automatically rebuilds and deploys your application when you push changes to your GitHub repository. To disable this:

1. Go to the **Settings** tab.
2. Toggle off the **Auto Deploy** option.

## Cost Optimization

To optimize costs on Railway:

1. Use the smallest possible instance type for your needs.
2. Monitor your usage in the **Usage** tab.
3. Set up spending limits in your Railway account settings. 