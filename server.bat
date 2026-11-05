@echo off
REM ============================================================
REM  Production build + preview server for
REM  www.riviratech.com (Vite + React)
REM ============================================================

cd /d "%~dp0"

echo.
echo === KKR GenAI Innovations - Build and Preview ===
echo.

if not exist "node_modules" (
    echo node_modules not found. Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo [ERROR] npm install failed.
        pause
        exit /b 1
    )
)

echo Building app...
call npm run build
if errorlevel 1 (
    echo.
    echo [ERROR] Build failed.
    pause
    exit /b 1
)

echo.
echo Starting preview server...
call npm run preview

pause
