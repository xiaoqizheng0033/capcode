@echo off
cd /d "C:\Myfiles\Codes\repo-manager"

echo ========================================
echo         CapCode - Repo Manager
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js not found. Please install Node.js first.
    pause
    exit /b 1
)

echo [1/3] Killing existing server on port 3456...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3456 ^| findstr LISTENING') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul

if not exist "client\dist\index.html" (
    echo [2/3] Building frontend...
    cd client
    call npx vite build
    cd ..
    if %errorlevel% neq 0 (
        echo Frontend build failed!
        pause
        exit /b 1
    )
    echo Frontend built successfully.
) else (
    echo [2/3] Frontend already built, skip.
)

echo [3/3] Starting server...
echo.
start http://localhost:3456
node server/index.js

pause
