@echo off
setlocal EnableExtensions

rem Registers a Windows Task Scheduler job for daily Render DB backup.
rem Run once on your PC (right-click → Run as administrator if task creation fails).

set "SCRIPT_DIR=%~dp0"
set "BACKUP_BAT=%SCRIPT_DIR%backup-render-db.bat"
set "TASK_NAME=AnantaOne Render DB Backup"
set "RUN_AT=03:00"

if not exist "%BACKUP_BAT%" (
  echo [ERROR] Missing %BACKUP_BAT%
  exit /b 1
)

if not exist "%SCRIPT_DIR%backup-render-db.env" (
  echo [ERROR] Create %SCRIPT_DIR%backup-render-db.env first.
  echo   copy "%SCRIPT_DIR%backup-render-db.env.example" "%SCRIPT_DIR%backup-render-db.env"
  echo Then edit DATABASE_URL with your Render connection string.
  exit /b 1
)

schtasks /Create /F /TN "%TASK_NAME%" /TR "\"%BACKUP_BAT%\"" /SC DAILY /ST %RUN_AT% /RL LIMITED
if errorlevel 1 (
  echo.
  echo Task creation failed. Try: right-click this file → Run as administrator
  exit /b 1
)

echo.
echo Registered daily task: "%TASK_NAME%"
echo   Runs at: %RUN_AT% every day
echo   Script:  %BACKUP_BAT%
echo.
echo Test now:  "%BACKUP_BAT%"
echo Remove:    schtasks /Delete /F /TN "%TASK_NAME%"
echo.
pause
