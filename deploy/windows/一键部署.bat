@echo off
chcp 65001 >nul
setlocal

REM Web Clipper Windows one-click deploy
REM Calls install.ps1 which installs Node.js if needed, installs dependencies,
REM starts the servers and opens the browser. Administrator rights are requested
REM automatically inside the PowerShell script.

echo ============================================
echo   Web Clipper - Windows one-click deploy
echo ============================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] Deploy failed. Please check the messages above.
  echo If Node.js install failed, download it manually: https://nodejs.org/zh-cn/download
  echo.
)
pause
