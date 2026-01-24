@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "ENV_FILE=%ROOT%\.env.local"

call :load_env "%ENV_FILE%"

if not defined SAHOCARS_ENV set "SAHOCARS_ENV=dev"
if not defined SAHOCARS_HOST set "SAHOCARS_HOST=127.0.0.1"
if not defined SAHOCARS_PORT set "SAHOCARS_PORT=8000"
if not defined SAHOCARS_FRONTEND_URL set "SAHOCARS_FRONTEND_URL=http://localhost:5173"
if not defined SAHOCARS_ADMIN_ALLOW_REMOTE set "SAHOCARS_ADMIN_ALLOW_REMOTE=false"
if not defined SAHOCARS_DATA_DIR set "SAHOCARS_DATA_DIR=%LOCALAPPDATA%\Sahocars\data"
if not defined SAHOCARS_APP_VERSION set "SAHOCARS_APP_VERSION=1.91"

set "GIT_BRANCH="
set "GIT_COMMIT="
where git >nul 2>&1
if not errorlevel 1 (
  pushd "%ROOT%" >nul
  for /f "delims=" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "GIT_BRANCH=%%i"
  for /f "delims=" %%i in ('git rev-parse --short HEAD 2^>nul') do set "GIT_COMMIT=%%i"
  popd >nul
)
if not defined SAHOCARS_APP_BRANCH if defined GIT_BRANCH set "SAHOCARS_APP_BRANCH=%GIT_BRANCH%"
if not defined SAHOCARS_APP_COMMIT if defined GIT_COMMIT set "SAHOCARS_APP_COMMIT=%GIT_COMMIT%"
if not defined SAHOCARS_APP_BRANCH set "SAHOCARS_APP_BRANCH=local"
if not defined SAHOCARS_APP_COMMIT set "SAHOCARS_APP_COMMIT=unknown"

if not defined VITE_APP_VERSION set "VITE_APP_VERSION=%SAHOCARS_APP_VERSION%"
if not defined VITE_APP_BRANCH set "VITE_APP_BRANCH=%SAHOCARS_APP_BRANCH%"
if not defined VITE_APP_COMMIT set "VITE_APP_COMMIT=%SAHOCARS_APP_COMMIT%"
if not defined VITE_API_URL set "VITE_API_URL=http://%SAHOCARS_HOST%:%SAHOCARS_PORT%"

set "WEB_HOST=127.0.0.1"
set "WEB_PORT=5173"

if not exist "%SAHOCARS_DATA_DIR%" mkdir "%SAHOCARS_DATA_DIR%"
if not exist "%SAHOCARS_DATA_DIR%\storage" mkdir "%SAHOCARS_DATA_DIR%\storage"
if not exist "%SAHOCARS_DATA_DIR%\backups" mkdir "%SAHOCARS_DATA_DIR%\backups"
if not exist "%SAHOCARS_DATA_DIR%\logs" mkdir "%SAHOCARS_DATA_DIR%\logs"

echo Sahocars v%SAHOCARS_APP_VERSION% - %SAHOCARS_APP_BRANCH% - %SAHOCARS_APP_COMMIT%
echo Data dir: %SAHOCARS_DATA_DIR%

if not exist "%BACKEND%\.venv\Scripts\python.exe" (
  echo ERROR: No se encuentra el venv del backend. Ejecuta install.bat primero.
  exit /b 1
)

pushd "%BACKEND%" >nul
set "RELOAD_FLAG=--reload"
if /I "%SAHOCARS_ENV%"=="prod" set "RELOAD_FLAG="
start "Sahocars Backend" cmd /k ""%BACKEND%\.venv\Scripts\python.exe" -m uvicorn main:app %RELOAD_FLAG% --host %SAHOCARS_HOST% --port %SAHOCARS_PORT%"
popd >nul

pushd "%FRONTEND%" >nul
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no esta disponible. Instala Node.js y reintenta.
  popd >nul
  exit /b 1
)
start "Sahocars Frontend" cmd /k "npm run dev -- --host %WEB_HOST% --port %WEB_PORT%"
popd >nul

start "" "http://%WEB_HOST%:%WEB_PORT%/"
exit /b 0

:load_env
set "ENV_PATH=%~1"
if not exist "%ENV_PATH%" exit /b 0
for /f "usebackq tokens=1,* delims==" %%A in ("%ENV_PATH%") do (
  set "KEY=%%A"
  if not "!KEY!"=="" if "!KEY:~0,1!" neq "#" (
    set "%%A=%%B"
  )
)
exit /b 0
