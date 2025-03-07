#!/bin/bash

# Colors for better readability
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== Telegram Group Parser Starter ===${NC}"
echo -e "${BLUE}Starting both frontend and backend servers...${NC}"

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check for required dependencies
if ! command_exists python3; then
    echo -e "${RED}Error: Python 3 is required but not installed.${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}Error: npm is required but not installed.${NC}"
    exit 1
fi

# Function to check if a port is in use
port_in_use() {
    lsof -i:"$1" >/dev/null 2>&1
}

# Function to kill process using a specific port
kill_process_on_port() {
    local port=$1
    local pids=$(lsof -t -i:"$port" 2>/dev/null)
    
    if [ -n "$pids" ]; then
        echo -e "${YELLOW}Found process(es) using port $port. Stopping them...${NC}"
        for pid in $pids; do
            echo -e "${YELLOW}Killing process with PID: $pid${NC}"
            kill -9 "$pid" 2>/dev/null
        done
        
        # Wait to ensure the port is released
        sleep 2
        
        # Verify the port is now free
        if port_in_use "$port"; then
            echo -e "${RED}Failed to free up port $port. Please check manually.${NC}"
            return 1
        else
            echo -e "${GREEN}Successfully freed port $port${NC}"
            return 0
        fi
    fi
    
    return 0
}

# Kill any existing servers
echo -e "${BLUE}Stopping any existing servers...${NC}"
pkill -f "python simple_run.py" 2>/dev/null
pkill -f "npm start" 2>/dev/null
sleep 2

# Check and clear port 3000 (React default)
if port_in_use 3000; then
    echo -e "${YELLOW}Port 3000 is already in use.${NC}"
    read -p "Do you want to kill the process using port 3000? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if ! kill_process_on_port 3000; then
            echo -e "${YELLOW}Could not free port 3000. Frontend will attempt to use a different port.${NC}"
            export PORT=0
        fi
    else
        echo -e "${YELLOW}Frontend will attempt to use a different port.${NC}"
        export PORT=0
    fi
fi

# Check and clear port 8000 (Backend default)
if port_in_use 8000; then
    echo -e "${YELLOW}Port 8000 is already in use.${NC}"
    read -p "Do you want to kill the process using port 8000? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if ! kill_process_on_port 8000; then
            echo -e "${RED}Cannot start backend on port 8000. Please free up the port manually and try again.${NC}"
            exit 1
        fi
    else
        echo -e "${RED}Cannot start backend on port 8000. Please free up the port and try again.${NC}"
        exit 1
    fi
fi

# Start backend in background
echo -e "${GREEN}Starting backend server...${NC}"
./run.sh backend &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend in background
echo -e "${GREEN}Starting frontend server...${NC}"
./run.sh frontend &
FRONTEND_PID=$!

echo -e "${GREEN}Servers started with PIDs: Backend=${BACKEND_PID}, Frontend=${FRONTEND_PID}${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop both servers${NC}"

# Function to kill both processes on exit
cleanup() {
    echo -e "${BLUE}Stopping servers...${NC}"
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    
    # Kill any remaining processes
    pkill -f "python simple_run.py" 2>/dev/null
    pkill -f "npm start" 2>/dev/null
    
    echo -e "${GREEN}Servers stopped${NC}"
    exit 0
}

# Set trap for cleanup on Ctrl+C
trap cleanup INT

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID 