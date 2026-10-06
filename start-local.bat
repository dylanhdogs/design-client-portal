@echo off
setlocal

cd /d "%~dp0"

echo Starting the construction client portal...
echo Frontend and backend will run in this window.
echo Press Ctrl+C to stop the application.
echo.

if not exist "node_modules\.bin\concurrently.cmd" (
    echo Installing project dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install project dependencies.
        pause
        exit /b 1
    )
    echo.
)

if not exist "backend\.env" (
    echo Creating backend environment configuration...
    copy /Y "backend\.env.example" "backend\.env" >nul
    if errorlevel 1 (
        echo Failed to create backend\.env.
        pause
        exit /b 1
    )
    echo.
)

call "%~dp0node_modules\.bin\concurrently.cmd" "cd backend && npm run dev" "cd frontend && npm run dev"

echo.
echo The application has stopped.
pause
