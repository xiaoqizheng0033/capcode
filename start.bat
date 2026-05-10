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

if not exist "client\dist\index.html" (
    echo [1/2] Building frontend...
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
    echo [1/2] Frontend already built, skip.
)

echo [2/2] Starting server...
echo.
start http://localhost:3456
node server/index.js

pause
