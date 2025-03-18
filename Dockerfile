FROM python:3.11-slim as base

# Set up environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    WORKERS=2 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

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
COPY backend/requirements.txt .

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
    bash \
    procps \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# First copy only the files needed for initialization
COPY backend/init_db.py /app/init_db.py
COPY backend/create_superuser.py /app/create_superuser.py
COPY backend/alembic.ini /app/alembic.ini
COPY backend/alembic /app/alembic/

# Then copy the rest of the application code
COPY backend /app/

# Copy the entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Make sure files are accessible
RUN chmod -R 755 /app

# Expose the port
EXPOSE 8000

# Create a non-root user to run the application
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

# Set the entrypoint with explicit shell
ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]
