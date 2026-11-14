@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher.ps1" %*
set "GARDEN_EXIT=%ERRORLEVEL%"
if not "%GARDEN_EXIT%"=="0" pause
exit /b %GARDEN_EXIT%
