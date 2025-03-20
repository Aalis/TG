# Base image
FROM python:3.11-slim as base

# Set up environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKERS=2 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app/backend \
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

WORKDIR /frontend

# Copy frontend source
COPY frontend/ .

# Install dependencies and build
RUN npm install --legacy-peer-deps && \
    npm run build

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

# Create static directory and set permissions (as root)
RUN mkdir -p /app/static && \
    chmod 777 /app/static

# Copy the application code
COPY backend /app/backend/
COPY railway.toml /app/
COPY railway-setup.sh /app/

# Copy frontend build from frontend-builder stage
COPY --from=frontend-builder /frontend/build/ /app/static/

# Set final permissions
RUN chown -R appuser:appuser /app && \
    chmod -R 755 /app && \
    chmod +x /app/backend/startup.py && \
    chmod -R 777 /app/static

# Expose the port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Use the Python startup script
CMD ["python", "/app/backend/startup.py"]
