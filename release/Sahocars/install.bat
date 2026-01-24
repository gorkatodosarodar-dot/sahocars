@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"
set "ENV_FILE=%ROOT%\sahocars.local.env"

call :load_env "%ENV_FILE%"

if not defined SAHOCARS_DATA_DIR set "SAHOCARS_DATA_DIR=%LOCALAPPDATA%\Sahocars\data"

echo Creando data dir en: %SAHOCARS_DATA_DIR%
if not exist "%SAHOCARS_DATA_DIR%" mkdir "%SAHOCARS_DATA_DIR%"
if not exist "%SAHOCARS_DATA_DIR%\storage" mkdir "%SAHOCARS_DATA_DIR%\storage"
if not exist "%SAHOCARS_DATA_DIR%\backups" mkdir "%SAHOCARS_DATA_DIR%\backups"
if not exist "%SAHOCARS_DATA_DIR%\logs" mkdir "%SAHOCARS_DATA_DIR%\logs"

if not exist "%ENV_FILE%" (
  echo Creando %ENV_FILE%...
  >"%ENV_FILE%" echo SAHOCARS_ENV=dev
  >>"%ENV_FILE%" echo SAHOCARS_DATA_DIR=%SAHOCARS_DATA_DIR%
  >>"%ENV_FILE%" echo SAHOCARS_HOST=127.0.0.1
  >>"%ENV_FILE%" echo SAHOCARS_PORT=8000
  >>"%ENV_FILE%" echo SAHOCARS_FRONTEND_URL=http://localhost:5173
  >>"%ENV_FILE%" echo SAHOCARS_ADMIN_ALLOW_REMOTE=false
  >>"%ENV_FILE%" echo SAHOCARS_APP_VERSION=2.0
  >>"%ENV_FILE%" echo SAHOCARS_APP_BRANCH=fase-9c-packaging-update-rollback
  >>"%ENV_FILE%" echo SAHOCARS_APP_COMMIT=dev
  >>"%ENV_FILE%" echo.
  >>"%ENV_FILE%" echo VITE_API_URL=http://127.0.0.1:8000
  >>"%ENV_FILE%" echo VITE_APP_VERSION=2.0
  >>"%ENV_FILE%" echo VITE_APP_BRANCH=fase-9c-packaging-update-rollback
  >>"%ENV_FILE%" echo VITE_APP_COMMIT=dev
)

set "PYTHON_CMD=python"
where py >nul 2>&1
if not errorlevel 1 set "PYTHON_CMD=py -3"

echo Preparando backend...
if not exist "%BACKEND%\requirements.txt" (
  echo ERROR: No existe %BACKEND%\requirements.txt
  exit /b 1
)

pushd "%BACKEND%" >nul
if not exist ".venv\Scripts\python.exe" (
  call %PYTHON_CMD% -m venv .venv
  if errorlevel 1 (
    echo ERROR: No se pudo crear el venv.
    popd >nul
    exit /b 1
  )
)
call ".venv\Scripts\python.exe" -m pip install --upgrade pip
call ".venv\Scripts\python.exe" -m pip install -r requirements.txt
if errorlevel 1 (
  echo ERROR: pip install backend ha fallado.
  popd >nul
  exit /b 1
)
popd >nul

echo Preparando frontend...
if not exist "%FRONTEND%\package.json" (
  echo ERROR: No existe %FRONTEND%\package.json
  exit /b 1
)
pushd "%FRONTEND%" >nul
where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no esta disponible. Instala Node.js y reintenta.
  popd >nul
  exit /b 1
)
call npm install
if errorlevel 1 (
  echo ERROR: npm install ha fallado.
  popd >nul
  exit /b 1
)
popd >nul

echo Instalacion completada.
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
