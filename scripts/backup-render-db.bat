@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem AnantaOne — daily Render Postgres backup (run on local Windows PC)
rem Requires PostgreSQL client tools (pg_dump on PATH).

set "SCRIPT_DIR=%~dp0"
set "ENV_FILE=%SCRIPT_DIR%backup-render-db.env"
set "LOG_DIR=%SCRIPT_DIR%..\backups\logs"
set "RETENTION_DAYS=30"
set "BACKUP_LABEL=anantaone_render"

if not exist "%ENV_FILE%" (
  echo [ERROR] Missing %ENV_FILE%
  echo Copy backup-render-db.env.example to backup-render-db.env and set DATABASE_URL.
  exit /b 1
)

for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%ENV_FILE%") do (
  if /I "%%~A"=="DATABASE_URL" set "DATABASE_URL=%%~B"
  if /I "%%~A"=="BACKUP_DIR" set "BACKUP_DIR=%%~B"
  if /I "%%~A"=="RETENTION_DAYS" set "RETENTION_DAYS=%%~B"
  if /I "%%~A"=="BACKUP_LABEL" set "BACKUP_LABEL=%%~B"
)

if not defined DATABASE_URL (
  echo [ERROR] DATABASE_URL is not set in %ENV_FILE%
  exit /b 1
)

if not defined BACKUP_DIR set "BACKUP_DIR=%USERPROFILE%\AnantaOne\backups\postgres"

where pg_dump >nul 2>&1
if errorlevel 1 (
  echo [ERROR] pg_dump not found. Install PostgreSQL client tools for Windows:
  echo   https://www.postgresql.org/download/windows/
  echo Add the "bin" folder to PATH, e.g. C:\Program Files\PostgreSQL\18\bin
  exit /b 1
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

for /f %%I in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "STAMP=%%I"
set "BACKUP_FILE=%BACKUP_DIR%\%BACKUP_LABEL%_%STAMP%.dump"
set "LOG_FILE=%LOG_DIR%\backup_%STAMP%.log"

echo [%date% %time%] Starting backup to %BACKUP_FILE% > "%LOG_FILE%"

set "DUMP_URL=!DATABASE_URL!"
echo !DUMP_URL! | findstr /I "sslmode=" >nul
if errorlevel 1 (
  if "!DUMP_URL!"=="!DUMP_URL:?=!" (
    set "DUMP_URL=!DUMP_URL!?sslmode=require"
  ) else (
    set "DUMP_URL=!DUMP_URL!&sslmode=require"
  )
)

pg_dump "!DUMP_URL!" --no-owner --no-acl --format=custom --file="!BACKUP_FILE!" >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo [ERROR] pg_dump failed. See %LOG_FILE%
  exit /b 1
)

for %%F in ("!BACKUP_FILE!") do set "SIZE=%%~zF"
echo [%date% %time%] OK — !BACKUP_FILE! ^(!SIZE! bytes^) >> "%LOG_FILE%"
echo Backup saved: !BACKUP_FILE!

powershell -NoProfile -Command ^
  "$days=%RETENTION_DAYS%; $dir='%BACKUP_DIR%'; $cut=(Get-Date).AddDays(-$days); Get-ChildItem -Path $dir -Filter '%BACKUP_LABEL%_*.dump' -File | Where-Object { $_.LastWriteTime -lt $cut } | Remove-Item -Force" >> "%LOG_FILE%" 2>&1

echo Done. Log: %LOG_FILE%
exit /b 0
