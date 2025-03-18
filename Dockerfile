FROM python:3.11-slim as base

# Set up environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKERS=2 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    STATIC_DIR=/static

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

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

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

# Create and set up directories
RUN mkdir -p /app /static && \
    chown -R appuser:appuser /app /static && \
    chmod -R 755 /app && \
    chmod -R 777 /static

# Copy the application code
COPY backend /app/

# Copy static files
COPY static /static

# Set final permissions
RUN chown -R appuser:appuser /app /static && \
    chmod +x /app/startup.py

# Expose the port
EXPOSE 8000

# Switch to non-root user
USER appuser

# Use the Python startup script
CMD ["python", "/app/startup.py"]
