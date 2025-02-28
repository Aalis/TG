# Telegram Group Parser

A modern web application for parsing Telegram groups using bot tokens. Built with FastAPI and React.

## Features

- Parse Telegram groups using bot token or user account
- Modern, responsive UI with light/dark mode
- Secure authentication with JWT
- Data persistence with PostgreSQL
- Real-time updates
- Export group members to CSV

## Tech Stack

### Backend
- FastAPI - Modern, fast web framework for building APIs
- SQLAlchemy - SQL toolkit and ORM
- PostgreSQL - Relational database
- Telethon - Telegram client library
- JWT - Authentication

### Frontend
- React - UI library
- Material-UI - Component library
- React Router - Routing
- Formik & Yup - Form handling and validation
- Axios - HTTP client

## Getting Started

### Prerequisites

- Python 3.8+
- Node.js 14+
- PostgreSQL
- Docker & Docker Compose (optional, for containerized deployment)

### Quick Start

The application includes convenient scripts to set up and run both the backend and frontend:

1. Clone the repository:
```bash
git clone https://github.com/yourusername/telegram-group-parser.git
cd telegram-group-parser
```

2. Create a `.env` file based on `.env.example`:
```bash
cp backend/.env.example backend/.env
```

3. Edit the `.env` file with your configuration:
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/telegram_parser
SECRET_KEY=your_secret_key_here
API_ID=your_telegram_api_id
API_HASH=your_telegram_api_hash
```

4. Initialize the database:
```bash
# Linux/macOS
./run.sh init-db

# Windows
run.bat init-db
```

5. Run both backend and frontend servers with a single command:
```bash
# Linux/macOS
./start.sh

# Windows
start.bat
```

   This script will:
   - Start both servers in parallel
   - Automatically stop any existing server instances
   - Check for port conflicts (3000 for frontend, 8000 for backend) and offer to resolve them
   - Allow you to stop both servers with a single Ctrl+C command (Linux/macOS) or by closing the windows (Windows)
   - Provide colored output for better readability (Linux/macOS)

   If port 3000 is already in use, the script will:
   - Offer to kill the process using that port
   - If you decline, it will automatically use a different available port for the frontend

   Alternatively, you can still run the servers separately:
   ```bash
   # Linux/macOS
   # Run the backend server
   ./run.sh backend
   
   # In a separate terminal, run the frontend server
   ./run.sh frontend
   
   # Windows
   # Run the backend server
   run.bat backend
   
   # In a separate terminal, run the frontend server
   run.bat frontend
   ```

### Docker Deployment

For a containerized deployment using Docker:

1. Create a `.env` file based on `.env.example`:
```bash
cp backend/.env.example backend/.env
```

2. Edit the `.env` file with your configuration (make sure to use `db` as the database host):
```
DATABASE_URL=postgresql://postgres:password@db:5432/telegram_parser
SECRET_KEY=your_secret_key_here
API_ID=your_telegram_api_id
API_HASH=your_telegram_api_hash
POSTGRES_PASSWORD=password
POSTGRES_USER=postgres
POSTGRES_DB=telegram_parser
```

3. Start the containers:
```bash
docker-compose up -d
```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000
   - API Documentation: http://localhost:8000/docs

5. To stop the containers:
```bash
docker-compose down
```

### Manual Setup

#### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment and install dependencies:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. Initialize the database:
```bash
python init_db.py
```

4. Run the backend server:
```bash
python run.py
```

#### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the frontend development server:
```bash
npm start
```

## Usage

1. Register a new account (or use the default admin account: username: `admin`, password: `admin123`)
2. Add your Telegram API credentials (get from https://my.telegram.org/apps)
3. Parse Telegram groups by entering the group link
4. View and export group members

## API Documentation

API documentation is available at `/docs` or `/redoc` when the backend server is running.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
