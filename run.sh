#!/bin/bash

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required dependencies
if ! command_exists python3; then
    echo "Error: Python 3 is required but not installed."
    exit 1
fi

if ! command_exists npm; then
    echo "Error: npm is required but not installed."
    exit 1
fi

# Function to run the backend
run_backend() {
    echo "Starting backend server..."
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install minimal dependencies
    echo "Installing minimal dependencies..."
    pip install --upgrade pip
    pip install wheel
    pip install python-dotenv psycopg2-binary fastapi uvicorn pyjwt passlib python-multipart
    
    # Run the simplified application
    echo "Running simplified backend application..."
    python simple_run.py
}

# Function to run the frontend
run_frontend() {
    echo "Starting frontend server..."
    cd frontend
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Start the development server
    echo "Starting React development server..."
    
    # Check if PORT environment variable is set
    if [ -n "$PORT" ]; then
        echo "Using port: $PORT (0 means auto-select available port)"
        npm start
    else
        # Check if port 3000 is in use
        if lsof -i:3000 >/dev/null 2>&1; then
            echo "Port 3000 is already in use. React will attempt to use a different port."
            # Setting PORT=0 tells React to find an available port
            PORT=0 npm start
        else
            npm start
        fi
    fi
}

# Function to initialize the database
init_db() {
    cd backend
    
    # Create virtual environment if it doesn't exist
    if [ ! -d "venv" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install minimal dependencies for database initialization
    echo "Installing minimal dependencies for database initialization..."
    pip install --upgrade pip
    pip install wheel
    pip install python-dotenv psycopg2-binary passlib[bcrypt]
    
    # Initialize the database
    echo "Initializing database..."
    python simple_init_db.py
}

# Main execution
if [ "$1" == "backend" ]; then
    run_backend
elif [ "$1" == "frontend" ]; then
    run_frontend
elif [ "$1" == "init-db" ]; then
    init_db
else
    echo "Telegram Group Parser"
    echo "====================="
    echo "Usage:"
    echo "  ./run.sh backend    - Run the backend server"
    echo "  ./run.sh frontend   - Run the frontend server"
    echo "  ./run.sh init-db    - Initialize the database"
    echo ""
    echo "For development, run the backend and frontend in separate terminal windows."
fi 