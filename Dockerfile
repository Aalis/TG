# Base image
# ABSOLUTE FORCE REBUILD TIMESTAMP: 2023-03-26-13:45:22
# CACHE_BUST_ATTEMPT: USE DATAPREFETCHERNEW WITH MAX_PREFETCH_ITEMS=30
FROM python:3.11-slim as base

# Add build date argument to force rebuild every time
ARG BUILD_DATE=unknown
RUN echo "Build date: $BUILD_DATE"

# Set up environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKERS=2 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    STATIC_FILES_DIR=/app/static \
    NO_CACHE=1

WORKDIR /app

# Build stage for installing dependencies
FROM base as builder

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements files
COPY backend/requirements.txt .
COPY requirements.txt ./root-requirements.txt

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt -r root-requirements.txt

# Frontend build stage
FROM node:18 as frontend-builder

# Add build date argument to force rebuild every time
ARG BUILD_DATE=unknown
RUN echo "Frontend build date: $BUILD_DATE"

# Add build argument that changes with each build
ARG CACHE_BUST_TIME
RUN echo "Cache bust at: $CACHE_BUST_TIME"

WORKDIR /frontend

# Copy package files first
COPY frontend/package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy frontend source with cache busting comments
# FORCE REBUILD 2025-03-26: Using DataPrefetcherNew instead of DataPrefetcher
# Cache busting for DataPrefetcherNew: $CACHE_BUST_TIME
# Cache busting for useChannels: $CACHE_BUST_TIME
# Cache busting for ParsedChannels: $CACHE_BUST_TIME
# Cache busting for api.js: $CACHE_BUST_TIME
COPY frontend/ .

# Add force rebuild command to clear any caches - this line should always be different on every build
RUN echo "FORCE REBUILD AT: $CACHE_BUST_TIME" > /frontend/src/components/build-timestamp.txt && \
    echo "Using DataPrefetcherNew with MAX_PREFETCH_ITEMS=30" >> /frontend/src/components/build-timestamp.txt

# Install Material-UI dependencies explicitly
RUN npm install @mui/material @mui/icons-material @emotion/react @emotion/styled @babel/runtime --legacy-peer-deps

# Force cache invalidation by using the build argument
RUN echo "Building at: $CACHE_BUST_TIME" && npm run build

# Final stage
FROM base

# Copy installed packages from builder stage
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Install runtime dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    procps \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create a non-root user to run the application
RUN useradd -m appuser

# Create necessary directories and set permissions (as root)
RUN mkdir -p /app/static /app/app && \
    chmod 777 /app/static

# Copy the application code
# Cache busting for telegram.py: $CACHE_BUST_TIME
COPY backend/app /app/app/
COPY backend/startup.py /app/
COPY backend/init_db.py /app/
COPY backend/create_superuser.py /app/
COPY backend/alembic.ini /app/
COPY backend/alembic /app/alembic/
COPY railway.toml /app/
COPY railway-setup.sh /app/

# Add cache-busting for backend files
ARG CACHE_BUST_TIME
RUN echo "Backend files copied at: $CACHE_BUST_TIME"

# Copy frontend build from frontend-builder stage
COPY --from=frontend-builder /frontend/build/ /app/static/

# Set final permissions
RUN chown -R appuser:appuser /app && \
    chmod -R 755 /app && \
    chmod +x /app/startup.py && \
    chmod -R 777 /app/static

# Expose the port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Use the Python startup script
CMD ["python", "/app/startup.py"]
