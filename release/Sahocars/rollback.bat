@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "LOCAL_ENV=%ROOT%\sahocars.local.env"
set "FALLBACK_ENV=%ROOT%\.env.local"

call :load_env "%LOCAL_ENV%"
call :load_env "%FALLBACK_ENV%"

if not defined SAHOCARS_DATA_DIR set "SAHOCARS_DATA_DIR=%LOCALAPPDATA%\Sahocars\data"
if not defined SAHOCARS_HOST set "SAHOCARS_HOST=127.0.0.1"
if not defined SAHOCARS_PORT set "SAHOCARS_PORT=8000"

set "LOG=%SAHOCARS_DATA_DIR%\logs\rollback.log"
set "ROLLBACK_INFO=%SAHOCARS_DATA_DIR%\backups\rollback.info"

>>"%LOG%" echo =======================================
>>"%LOG%" echo ROLLBACK %DATE% %TIME%

if not exist "%ROLLBACK_INFO%" (
  echo ERROR: rollback.info no encontrado.
  >>"%LOG%" echo rollback.info missing
  exit /b 1
)

for /f "usebackq tokens=1,* delims==" %%A in ("%ROLLBACK_INFO%") do (
  set "%%A=%%B"
)

echo Parando procesos (si existen)...
taskkill /F /IM uvicorn.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1

if defined OLD_DIR if exist "%OLD_DIR%" (
  echo Restaurando codigo desde %OLD_DIR%...
  robocopy "%OLD_DIR%" "%ROOT%" /MIR /XD ".git" "backend\.venv" "frontend\node_modules" "frontend\dist" "dist_package" >nul
)

if /I "%BACKUP_MODE%"=="api" (
  call :check_health
  if "%HEALTH_OK%"=="1" (
    echo Restaurando backup %BACKUP_ID% via API...
    powershell -NoProfile -Command "Invoke-RestMethod -Method Post -Uri http://%SAHOCARS_HOST%:%SAHOCARS_PORT%/admin/backups/%BACKUP_ID%/restore -ContentType 'application/json' -Body '{\"dry_run\":false}'" >>"%LOG%" 2>&1
  ) else (
    echo Backend no disponible para restore API.
    >>"%LOG%" echo Backend no disponible para restore API.
  )
) else (
  if defined BACKUP_DIR if exist "%BACKUP_DIR%\db.sqlite" (
    echo Restaurando DB desde %BACKUP_DIR%...
    copy "%BACKUP_DIR%\db.sqlite" "%SAHOCARS_DATA_DIR%\db.sqlite" >nul 2>&1
  )
  if defined BACKUP_DIR if exist "%BACKUP_DIR%\storage" (
    echo Restaurando storage desde %BACKUP_DIR%...
    robocopy "%BACKUP_DIR%\storage" "%SAHOCARS_DATA_DIR%\storage" /MIR >nul
  )
)

call :check_health
if "%HEALTH_OK%"=="1" (
  echo Rollback OK.
  >>"%LOG%" echo Rollback OK
) else (
  echo Rollback finalizado, pero /health fallo.
  >>"%LOG%" echo Rollback health fail
)

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
