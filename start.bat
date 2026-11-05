@echo off
REM ============================================================
REM  Start script for www.riviratech.com
REM  - Backend server (Express)  : http://localhost:5000
REM  - Frontend app (Vite/React) : http://localhost:5173
REM  Each runs in its own window.
REM ============================================================

cd /d "%~dp0"

echo.
echo === Rivira Technologies - Starting App + Server ===
echo.

REM --- Install frontend dependencies if needed ---
if not exist "node_modules" (
    echo [app] node_modules not found. Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo [ERROR] Frontend npm install failed.
        pause
        exit /b 1
    )
)

REM --- Install backend dependencies if needed ---
if not exist "api\node_modules" (
    echo [server] node_modules not found. Installing backend dependencies...
    call npm install --prefix api
    if errorlevel 1 (
        echo [ERROR] Backend npm install failed.
        pause
        exit /b 1
    )
)

echo Starting backend server on http://localhost:5000 ...
start "RiviraTech Server (port 5000)" cmd /k "cd /d "%~dp0api" && set PORT=5000 && set API_WORKERS=1 && node server.js"

echo Starting frontend app on http://localhost:5173 ...
start "RiviraTech App (port 5173)" cmd /k "cd /d "%~dp0" && npm run dev"
