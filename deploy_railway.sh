#!/bin/bash
set -e

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}     Telegram Parser API Deployment     ${NC}"
echo -e "${GREEN}========================================${NC}"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo -e "${RED}Railway CLI is not installed.${NC}"
    echo -e "${YELLOW}Installing Railway CLI...${NC}"
    npm install -g @railway/cli
fi

# Check if user is logged in to Railway
echo -e "${YELLOW}Checking Railway login status...${NC}"
railway whoami &> /dev/null || {
    echo -e "${RED}You're not logged in to Railway.${NC}"
    echo -e "${YELLOW}Please log in:${NC}"
    railway login
}

# Check if project is linked
echo -e "${YELLOW}Checking if project is linked...${NC}"
if ! railway list &> /dev/null; then
    echo -e "${YELLOW}No project linked. Do you want to:${NC}"
    echo -e "1. Create a new project"
    echo -e "2. Link to an existing project"
    read -p "Enter your choice (1/2): " choice
    
    if [ "$choice" == "1" ]; then
        echo -e "${YELLOW}Creating a new Railway project...${NC}"
        railway init
    else
        echo -e "${YELLOW}Please select a project to link:${NC}"
        railway link
    fi
fi

# Display current linked project
echo -e "${GREEN}Currently linked project:${NC}"
railway list

# Check for Dockerfile
if [ ! -f "Dockerfile" ]; then
    echo -e "${RED}Dockerfile not found.${NC}"
    exit 1
fi

# Check for railway.toml
if [ ! -f "railway.toml" ]; then
    echo -e "${RED}railway.toml not found.${NC}"
    exit 1
fi

# Check for requirements.txt
if [ ! -f "requirements.txt" ]; then
    echo -e "${RED}requirements.txt not found.${NC}"
    exit 1
fi

# Prompt for deployment
echo -e "${YELLOW}Ready to deploy to Railway.${NC}"
read -p "Do you want to continue? (y/n): " confirm

if [ "$confirm" != "y" ]; then
    echo -e "${RED}Deployment cancelled.${NC}"
    exit 0
fi

# Deploy to Railway
echo -e "${GREEN}Deploying to Railway...${NC}"
railway up

# Check deployment status
echo -e "${GREEN}Deployment initiated.${NC}"
echo -e "${YELLOW}Checking deployment status...${NC}"

# Open Railway dashboard
echo -e "${GREEN}Opening Railway dashboard to monitor deployment...${NC}"
railway open

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}     Deployment Process Complete!       ${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "${YELLOW}Note: Check the Railway dashboard for deployment status.${NC}"
echo -e "${YELLOW}Once deployed, verify health check at your-app-url/health${NC}" 