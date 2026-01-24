@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "CURRENT=%ROOT%"
set "NEW_PATH=%~1"
set "LOCAL_ENV=%ROOT%\sahocars.local.env"
set "FALLBACK_ENV=%ROOT%\.env.local"

call :load_env "%LOCAL_ENV%"
call :load_env "%FALLBACK_ENV%"

if not defined SAHOCARS_DATA_DIR set "SAHOCARS_DATA_DIR=%LOCALAPPDATA%\Sahocars\data"
if not defined SAHOCARS_HOST set "SAHOCARS_HOST=127.0.0.1"
if not defined SAHOCARS_PORT set "SAHOCARS_PORT=8000"

if "%NEW_PATH%"=="" (
  set /p NEW_PATH=Ruta a la nueva version (carpeta Sahocars):
)

if "%NEW_PATH%"=="" (
  echo ERROR: Ruta nueva no indicada.
  exit /b 1
)

if not exist "%NEW_PATH%\install.bat" (
  echo ERROR: No se encuentra install.bat en la ruta nueva.
  exit /b 1
)

for /f "delims=" %%i in ('powershell -NoProfile -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%i"
set "LOG=%SAHOCARS_DATA_DIR%\logs\update.log"
set "ROLLBACK_INFO=%SAHOCARS_DATA_DIR%\backups\rollback.info"

if not exist "%SAHOCARS_DATA_DIR%\logs" mkdir "%SAHOCARS_DATA_DIR%\logs"
if not exist "%SAHOCARS_DATA_DIR%\backups" mkdir "%SAHOCARS_DATA_DIR%\backups"

>>"%LOG%" echo =======================================
>>"%LOG%" echo UPDATE %DATE% %TIME%
>>"%LOG%" echo CURRENT=%CURRENT%
>>"%LOG%" echo NEW=%NEW_PATH%
>>"%LOG%" echo DATA_DIR=%SAHOCARS_DATA_DIR%

echo Parando procesos (si existen)...
taskkill /F /IM uvicorn.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

call :backup_data
if errorlevel 1 (
  echo ERROR: Backup fallido. Ver log.
  exit /b 1
)

set "OLD_DIR=%CURRENT%_old_%TS%"
set "ENV_BACKUP=%TEMP%\sahocars_env_%TS%.env"

if exist "%CURRENT%\sahocars.local.env" copy "%CURRENT%\sahocars.local.env" "%ENV_BACKUP%" >nul 2>&1
if exist "%CURRENT%\.env.local" copy "%CURRENT%\.env.local" "%ENV_BACKUP%.fallback" >nul 2>&1

echo Copiando codigo actual a %OLD_DIR%...
robocopy "%CURRENT%" "%OLD_DIR%" /MIR /XD ".git" "backend\.venv" "frontend\node_modules" "frontend\dist" "dist_package" >nul

echo Actualizando codigo con la nueva version...
robocopy "%NEW_PATH%" "%CURRENT%" /MIR /XD ".git" "backend\.venv" "frontend\node_modules" "frontend\dist" "dist_package" >nul

if exist "%ENV_BACKUP%" copy "%ENV_BACKUP%" "%CURRENT%\sahocars.local.env" >nul 2>&1
if exist "%ENV_BACKUP%.fallback" copy "%ENV_BACKUP%.fallback" "%CURRENT%\.env.local" >nul 2>&1

echo Ejecutando install.bat en la nueva version...
pushd "%CURRENT%" >nul
call install.bat >>"%LOG%" 2>&1
popd >nul

call :check_health
if "%HEALTH_OK%"=="1" (
  echo Actualizacion correcta.
  >>"%LOG%" echo OK
  exit /b 0
)

echo ERROR: /health fallo, intentando rollback...
>>"%LOG%" echo FAIL health
call rollback.bat
exit /b 1

:backup_data
set "BACKUP_MODE=files"
set "BACKUP_ID="
set "BACKUP_DIR=%SAHOCARS_DATA_DIR%\backups\update_%TS%"

call :check_health
if "%HEALTH_OK%"=="1" (
  for /f "delims=" %%i in ('powershell -NoProfile -Command "try { $r=Invoke-RestMethod -Method Post -Uri http://%SAHOCARS_HOST%:%SAHOCARS_PORT%/admin/backups -ContentType 'application/json' -Body '{\"include_files\":true}'; $r.id } catch { '' }"') do set "BACKUP_ID=%%i"
  if not "%BACKUP_ID%"=="" (
    set "BACKUP_MODE=api"
  )
)

if "%BACKUP_MODE%"=="api" (
  echo Backup API OK: %BACKUP_ID%
  >>"%LOG%" echo Backup API OK: %BACKUP_ID%
) else (
  echo Backup por copia local...
  mkdir "%BACKUP_DIR%" >nul 2>&1
  if exist "%SAHOCARS_DATA_DIR%\db.sqlite" copy "%SAHOCARS_DATA_DIR%\db.sqlite" "%BACKUP_DIR%\db.sqlite" >nul 2>&1
  if exist "%SAHOCARS_DATA_DIR%\storage" robocopy "%SAHOCARS_DATA_DIR%\storage" "%BACKUP_DIR%\storage" /MIR >nul
)

> "%ROLLBACK_INFO%" echo CURRENT_DIR=%CURRENT%
>>"%ROLLBACK_INFO%" echo OLD_DIR=%OLD_DIR%
>>"%ROLLBACK_INFO%" echo BACKUP_MODE=%BACKUP_MODE%
>>"%ROLLBACK_INFO%" echo BACKUP_ID=%BACKUP_ID%
>>"%ROLLBACK_INFO%" echo BACKUP_DIR=%BACKUP_DIR%
>>"%ROLLBACK_INFO%" echo TS=%TS%
exit /b 0

:check_health
set "HEALTH_OK=0"
for /f "delims=" %%i in ('powershell -NoProfile -Command "try { (Invoke-WebRequest -UseBasicParsing http://%SAHOCARS_HOST%:%SAHOCARS_PORT%/health -TimeoutSec 2).StatusCode } catch { 0 }"') do set "STATUS=%%i"
if "%STATUS%"=="200" set "HEALTH_OK=1"
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
