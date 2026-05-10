@echo off
chcp 65001 >nul
cd /d "C:\Myfiles\Codes\repo-manager"

echo.
echo   ╔══════════════════════════════════════╗
echo   ║         🐱 CapCode 启动中...        ║
echo   ║     开源项目管理 & AI 智能分析      ║
echo   ╚══════════════════════════════════════╝
echo.

:: Check if node is available
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

:: Build frontend if dist doesn't exist
if not exist "client\dist\index.html" (
    echo [1/2] 构建前端...
    cd client
    call npx vite build
    cd ..
    if %errorlevel% neq 0 (
        echo 前端构建失败！
        pause
        exit /b 1
    )
    echo 前端构建完成
) else (
    echo [1/2] 前端已构建，跳过
)

:: Start server
echo [2/2] 启动服务...
echo.
start http://localhost:3456
node server/index.js

pause
