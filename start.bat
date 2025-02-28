@echo off
echo === Telegram Group Parser Starter ===
echo Starting both frontend and backend servers...

REM Check for required dependencies
where python >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: Python is required but not installed.
    exit /b 1
)

where npm >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Error: npm is required but not installed.
    exit /b 1
)

REM Check if netstat is available
where netstat >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Warning: netstat not found. Cannot check for port conflicts.
    goto :skip_port_check
)

REM Check if port 3000 is in use
netstat -ano | findstr :3000 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo Port 3000 is already in use.
    set /p KILL_PROCESS="Do you want to kill the process using port 3000? (y/n) "
    if /i "%KILL_PROCESS%"=="y" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000 ^| findstr LISTENING') do (
            echo Killing process with PID: %%a
            taskkill /F /PID %%a
            timeout /t 1 /nobreak >nul
        )
    ) else (
        echo Frontend will attempt to use a different port.
        set PORT=0
    )
)

REM Check if port 8000 is in use
netstat -ano | findstr :8000 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo Port 8000 is already in use.
    set /p KILL_PROCESS="Do you want to kill the process using port 8000? (y/n) "
    if /i "%KILL_PROCESS%"=="y" (
        for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 ^| findstr LISTENING') do (
            echo Killing process with PID: %%a
            taskkill /F /PID %%a
            timeout /t 1 /nobreak >nul
        )
    ) else (
        echo Cannot start backend on port 8000. Please free up the port and try again.
        exit /b 1
    )
)

:skip_port_check

REM Kill any existing servers
echo Stopping any existing servers...
taskkill /F /IM "python.exe" /FI "WINDOWTITLE eq simple_run.py" >nul 2>&1
taskkill /F /IM "node.exe" /FI "WINDOWTITLE eq npm start" >nul 2>&1

REM Start backend in a new window
echo Starting backend server...
start "Backend Server" cmd /c "cd %~dp0 && run.bat backend"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
echo Starting frontend server...
start "Frontend Server" cmd /c "cd %~dp0 && run.bat frontend"

echo Servers started in separate windows.
echo Close the windows to stop the servers.
echo.
echo Press any key to exit this window...
pause >nul 