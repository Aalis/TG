@echo off
setlocal enabledelayedexpansion

REM Function to check if a command exists
where %1 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: %1 is required but not installed.
    exit /b 1
)

REM Check for required dependencies
call :check_command python
call :check_command npm

REM Main execution
if "%1"=="backend" (
    call :run_backend
) else if "%1"=="frontend" (
    call :run_frontend
) else if "%1"=="init-db" (
    call :init_db
) else (
    echo Telegram Group Parser
    echo =====================
    echo Usage:
    echo   run.bat backend    - Run the backend server
    echo   run.bat frontend   - Run the frontend server
    echo   run.bat init-db    - Initialize the database
    echo.
    echo For development, run the backend and frontend in separate terminal windows.
    exit /b 0
)
exit /b 0

:check_command
where %1 >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: %1 is required but not installed.
    exit /b 1
)
exit /b 0

:run_backend
echo Starting backend server...
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install minimal dependencies
echo Installing minimal dependencies...
pip install --upgrade pip
pip install wheel
pip install python-dotenv fastapi uvicorn pyjwt passlib python-multipart

REM Run the simplified application
echo Running simplified backend application...
python simple_run.py
exit /b 0

:run_frontend
echo Starting frontend server...
cd frontend

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

REM Start the development server
echo Starting React development server...
REM If PORT is set to 0, React will automatically find an available port
npm start
exit /b 0

:init_db
cd backend

REM Create virtual environment if it doesn't exist
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
call venv\Scripts\activate.bat

REM Install minimal dependencies for database initialization
echo Installing minimal dependencies for database initialization...
pip install --upgrade pip
pip install wheel
pip install python-dotenv passlib[bcrypt]

REM Initialize the database
echo Initializing database...
python simple_init_db.py
exit /b 0 