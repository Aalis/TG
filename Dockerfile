FROM python:3.9-slim

WORKDIR /app

# Install PostgreSQL client and other dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy the entire project
COPY . .

# Install dependencies
WORKDIR /app/backend
RUN pip install --no-cache-dir -r requirements.txt

# Set environment variables
ENV PYTHONUNBUFFERED=1

# Create a startup script
RUN echo '#!/bin/bash\n\
# Wait for database to be ready\n\
echo "Waiting for database..."\n\
sleep 10\n\
\n\
# Initialize the database\n\
echo "Initializing database..."\n\
python init_db.py || echo "Database initialization failed but continuing"\n\
\n\
# Start the application\n\
echo "Starting application..."\n\
gunicorn app.main:app --workers 2 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT\n\
' > /app/start.sh && chmod +x /app/start.sh

# Expose the port
EXPOSE 8000

# Command to run the application
CMD ["/app/start.sh"] 