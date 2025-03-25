# Base image
FROM python:3.11-slim as base

# Set up environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKERS=2 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    STATIC_FILES_DIR=/app/static

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

# Add build argument that changes with each build
ARG CACHE_BUST_TIME
RUN echo "Cache bust at: $CACHE_BUST_TIME"

WORKDIR /frontend

# Copy package files first
COPY frontend/package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy frontend source
COPY frontend/ .

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
COPY backend/app /app/app/
COPY backend/startup.py /app/
COPY backend/init_db.py /app/
COPY backend/create_superuser.py /app/
COPY backend/alembic.ini /app/
COPY backend/alembic /app/alembic/
COPY railway.toml /app/
COPY railway-setup.sh /app/

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
