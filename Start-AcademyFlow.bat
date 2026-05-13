@echo off
setlocal enabledelayedexpansion

REM One-click launcher for AcademyFlow (Windows)

set SCRIPT_DIR=%~dp0
pushd "%SCRIPT_DIR%"

where powershell >nul 2>&1
if %ERRORLEVEL% neq 0 (
  echo PowerShell is required but not found. Please run scripts\start-academyflow.ps1 manually.
  pause
  exit /b 1
)

powershell -NoProfile -ExecutionPolicy Bypass -NoExit -File scripts\start-academyflow.ps1 %*
if errorlevel 1 (
  echo.
  echo Script failed. Press any key to view errors...
  pause
)

popd
endlocal

