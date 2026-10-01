@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
title Web Clipper 一键部署

REM ================================================================
REM Web Clipper Windows 一键部署（纯 CMD 版）
REM 自动检测并安装 Node.js，安装前后端依赖，启动服务并打开浏览器。
REM 适用于本地测试。如需生产模式或仅安装环境，请使用 install.ps1。
REM ================================================================

for %%I in ("%~dp0..\..") do set "ROOT=%%~fI"
cd /d "%ROOT%"

echo ============================================
echo   Web Clipper 一键部署（CMD 版）
echo   项目目录：%ROOT%
echo ============================================
echo.

set "NODE_MIN=20"

REM ---------- 1. 检查 / 安装 Node.js ----------
call :check_node
if "%NODE_OK%"=="1" goto node_ready

echo [1/3] 未检测到 Node.js %NODE_MIN%+，尝试自动安装...
call :install_node
call :check_node
if not "%NODE_OK%"=="1" (
  echo.
  echo [错误] Node.js 自动安装失败，请手动安装后重试：
  echo   https://nodejs.org/zh-cn/download
  echo.
  pause
  exit /b 1
)

:node_ready
echo [1/3] Node.js 就绪：%NODE_VER%
echo.

REM ---------- 2. 安装依赖 ----------
echo [2/3] 安装前后端依赖，首次执行较慢，请耐心等待...
call :install_deps "%ROOT%\backend"
if errorlevel 1 goto deps_failed
call :install_deps "%ROOT%\frontend"
if errorlevel 1 goto deps_failed

if not exist "%ROOT%\backend\.env" if exist "%ROOT%\backend\.env.example" (
  copy /y "%ROOT%\backend\.env.example" "%ROOT%\backend\.env" >nul
  echo   已生成 backend\.env
)
echo [2/3] 依赖安装完成
echo.

REM ---------- 3. 启动服务 ----------
echo [3/3] 启动后端 3001 与前端 5173...
start "Web Clipper Backend" /d "%ROOT%\backend" cmd /k "npm run dev"
start "Web Clipper Frontend" /d "%ROOT%\frontend" cmd /k "npm run dev"

call :wait_port 5173 60
start "" "http://localhost:5173"

echo.
echo ============================================
echo   部署完成，已在浏览器打开 http://localhost:5173
echo   首次使用请先注册账号。
echo   关闭弹出的两个命令行窗口即可停止服务。
echo ============================================
echo.
pause
exit /b 0

:deps_failed
echo.
echo [错误] 依赖安装失败。可切换国内镜像后重新运行本脚本：
echo   npm config set registry https://registry.npmmirror.com
echo.
pause
exit /b 1

REM ---------------- 子过程 ----------------

:check_node
set "NODE_OK=0"
set "NODE_VER="
where node >nul 2>nul
if errorlevel 1 (
  if exist "%ProgramFiles%\nodejs\node.exe" set "PATH=%PATH%;%ProgramFiles%\nodejs"
)
where node >nul 2>nul
if errorlevel 1 exit /b 0
set "NV="
for /f "tokens=1 delims=." %%v in ('node -v') do set "NV=%%v"
set "NV=!NV:v=!"
if not defined NV exit /b 0
if !NV! LSS %NODE_MIN% exit /b 0
set "NODE_OK=1"
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
exit /b 0

:install_node
where winget >nul 2>nul
if errorlevel 1 (
  echo   [提示] 系统未安装 winget，请手动安装 Node.js：
  echo   https://nodejs.org/zh-cn/download
  exit /b 1
)
echo   使用 winget 安装 Node.js LTS，可能弹出 UAC 授权窗口...
winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements --silent
set "PATH=%PATH%;%ProgramFiles%\nodejs"
exit /b 0

:install_deps
pushd "%~1"
if exist package-lock.json (
  call npm ci
) else (
  call npm install
)
set "RC=%errorlevel%"
popd
exit /b %RC%

:wait_port
set /a _tries=0
:wait_port_loop
curl -s -o nul --max-time 2 "http://localhost:%~1" >nul 2>nul
if not errorlevel 1 exit /b 0
set /a _tries+=1
if %_tries% geq %~2 exit /b 1
timeout /t 2 /nobreak >nul
goto wait_port_loop
