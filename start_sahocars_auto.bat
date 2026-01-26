@echo off

REM FORZAR PYTHON 3.12 SOLO PARA ESTE SCRIPT
set "PATH=C:\Users\basic\AppData\Local\Programs\Python\Python312;C:\Users\basic\AppData\Local\Programs\Python\Python312\Scripts;%PATH%"

setlocal EnableExtensions EnableDelayedExpansion

REM ============================
REM CONFIG
REM ============================
set "ROOT=C:\sahocars"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

REM Python 3.12 (ajusta si tu ruta real difiere)
set "PYTHON=C:\Users\basic\AppData\Local\Programs\Python\Python312\python.exe"

REM Host/Ports
set "API_HOST=127.0.0.1"
set "API_PORT=8000"
set "WEB_HOST=127.0.0.1"
set "WEB_PORT=5173"

REM Log
set "LOG=%ROOT%\start_sahocars_auto.log"

REM ============================
REM LOG HEADER
REM ============================
> "%LOG%" echo ================================
>>"%LOG%" echo START %DATE% %TIME%
>>"%LOG%" echo ================================
>>"%LOG%" echo ROOT=%ROOT%
>>"%LOG%" echo BACKEND=%BACKEND%
>>"%LOG%" echo FRONTEND=%FRONTEND%
>>"%LOG%" echo PYTHON=%PYTHON%

REM ============================
REM PRECHECKS
REM ============================
if not exist "%ROOT%\" (
  echo ERROR: No existe ROOT: %ROOT%
  >>"%LOG%" echo ERROR: No existe ROOT: %ROOT%
  pause
  exit /b 1
)

if not exist "%PYTHON%" (
  echo ERROR: No existe PYTHON en: %PYTHON%
  >>"%LOG%" echo ERROR: No existe PYTHON en: %PYTHON%
  echo SUGERENCIA: ajusta la variable PYTHON en este .bat
  pause
  exit /b 1
)

REM ============================
REM KILL OLD PROCESSES (non-fatal)
REM ============================
>>"%LOG%" echo Matando procesos antiguos...
taskkill /F /IM uvicorn.exe /T >>"%LOG%" 2>&1
taskkill /F /IM node.exe    /T >>"%LOG%" 2>&1

REM ============================
REM GIT SYNC (safe, optional)
REM ============================
set "GIT_SYNC=0"
if defined SAHOCARS_GIT_SYNC set "GIT_SYNC=%SAHOCARS_GIT_SYNC%"
set "GIT_TARGET_BRANCH="
if defined SAHOCARS_GIT_TARGET_BRANCH set "GIT_TARGET_BRANCH=%SAHOCARS_GIT_TARGET_BRANCH%"

>>"%LOG%" echo Comprobando cambios en Git...
pushd "%ROOT%" >>"%LOG%" 2>&1

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo ERROR: %ROOT% no parece un repo git.
  >>"%LOG%" echo ERROR: %ROOT% no parece un repo git.
  popd
  pause
  exit /b 1
)

if "%GIT_SYNC%"=="1" (
  git fetch origin >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo ERROR: git fetch ha fallado.
    >>"%LOG%" echo ERROR: git fetch ha fallado.
    popd
    pause
    exit /b 1
  )

  for /f %%i in ('git rev-parse --abbrev-ref HEAD') do set "CURRENT_BRANCH=%%i"
  if not defined GIT_TARGET_BRANCH set "GIT_TARGET_BRANCH=!CURRENT_BRANCH!"

  if /I not "!CURRENT_BRANCH!"=="!GIT_TARGET_BRANCH!" (
    echo ERROR: Rama actual !CURRENT_BRANCH! no coincide con la esperada !GIT_TARGET_BRANCH!.
    >>"%LOG%" echo ERROR: Rama actual !CURRENT_BRANCH! no coincide con la esperada !GIT_TARGET_BRANCH!.
    popd
    pause
    exit /b 1
  )

  >>"%LOG%" echo Sync seguro en rama !GIT_TARGET_BRANCH! (ff-only)...
  git pull --ff-only origin !GIT_TARGET_BRANCH! >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo ERROR: git pull --ff-only ha fallado.
    >>"%LOG%" echo ERROR: git pull --ff-only ha fallado.
    popd
    pause
    exit /b 1
  )
) else (
  >>"%LOG%" echo Git sync desactivado (GIT_SYNC=0).
)

popd >>"%LOG%" 2>&1

REM ============================
REM VERSION ENV (best effort)
REM ============================
set "GIT_BRANCH="
set "GIT_COMMIT="
where git >nul 2>&1
if not errorlevel 1 (
  pushd "%ROOT%" >nul
  for /f "delims=" %%i in ('git rev-parse --abbrev-ref HEAD 2^>nul') do set "GIT_BRANCH=%%i"
  for /f "delims=" %%i in ('git rev-parse --short HEAD 2^>nul') do set "GIT_COMMIT=%%i"
  popd >nul
)
if not defined SAHOCARS_BRANCH if defined GIT_BRANCH set "SAHOCARS_BRANCH=%GIT_BRANCH%"
if not defined SAHOCARS_COMMIT if defined GIT_COMMIT set "SAHOCARS_COMMIT=%GIT_COMMIT%"
if not defined SAHOCARS_BRANCH set "SAHOCARS_BRANCH=local"
if not defined SAHOCARS_COMMIT set "SAHOCARS_COMMIT=unknown"
if not defined SAHOCARS_APP_BRANCH set "SAHOCARS_APP_BRANCH=%SAHOCARS_BRANCH%"
if not defined SAHOCARS_APP_COMMIT set "SAHOCARS_APP_COMMIT=%SAHOCARS_COMMIT%"
if defined GIT_BRANCH if /I not "%GIT_BRANCH%"=="validaciones" (
  echo WARNING: Rama actual "%GIT_BRANCH%". La rama de trabajo recomendada es "validaciones".
  >>"%LOG%" echo WARNING: Rama actual "%GIT_BRANCH%". La rama de trabajo recomendada es "validaciones".
)

REM ============================
REM BACKEND: VENV + DEPS
REM ============================
>>"%LOG%" echo --- BACKEND ---

if not exist "%BACKEND%\" (
  echo ERROR: No existe backend en %BACKEND%
  >>"%LOG%" echo ERROR: No existe backend en %BACKEND%
  pause
  exit /b 1
)

pushd "%BACKEND%" >>"%LOG%" 2>&1

if not exist ".venv\Scripts\python.exe" (
  >>"%LOG%" echo Creando venv...
  "%PYTHON%" -m venv .venv >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo ERROR: No se pudo crear venv.
    >>"%LOG%" echo ERROR: No se pudo crear venv.
    popd
    pause
    exit /b 1
  )
)

set "VENV_PY=%BACKEND%\.venv\Scripts\python.exe"
set "REQ=%BACKEND%\requirements.txt"
set "REQ_HASH_FILE=%BACKEND%\.venv\.requirements.sha256"

if not exist "%REQ%" (
  echo ERROR: No existe requirements.txt en backend.
  >>"%LOG%" echo ERROR: No existe requirements.txt en backend.
  popd
  pause
  exit /b 1
)

for /f "tokens=1" %%H in ('certutil -hashfile "%REQ%" SHA256 ^| find /I /V "hash" ^| find /I /V "certutil"') do set "REQ_HASH=%%H
set "OLD_REQ_HASH="
if exist "%REQ_HASH_FILE%" set /p OLD_REQ_HASH=<"%REQ_HASH_FILE%"

if /I not "!REQ_HASH!"=="!OLD_REQ_HASH!" (
  >>"%LOG%" echo requirements.txt cambiado: instalando deps...
  "%VENV_PY%" -m pip install --upgrade pip >>"%LOG%" 2>&1
  "%VENV_PY%" -m pip install -r requirements.txt >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo ERROR: pip install backend ha fallado.
    >>"%LOG%" echo ERROR: pip install backend ha fallado.
    popd
    pause
    exit /b 1
  )
  echo !REQ_HASH!>"%REQ_HASH_FILE%"
) else (
  >>"%LOG%" echo requirements.txt sin cambios: deps OK.
)

>>"%LOG%" echo Arrancando backend...
start "Sahocars Backend" cmd /k ""%VENV_PY%" -m uvicorn main:app --reload --host %API_HOST% --port %API_PORT%"

popd >>"%LOG%" 2>&1

REM ============================
REM FRONTEND: DEPS + RUN DEV
REM ============================
>>"%LOG%" echo --- FRONTEND ---

if not exist "%FRONTEND%\" (
  echo ERROR: No existe frontend en %FRONTEND%
  >>"%LOG%" echo ERROR: No existe frontend en %FRONTEND%
  pause
  exit /b 1
)

pushd "%FRONTEND%" >>"%LOG%" 2>&1

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm no está en PATH (Node.js no instalado o PATH no cargado).
  >>"%LOG%" echo ERROR: npm no está en PATH (Node.js no instalado o PATH no cargado).
  popd
  pause
  exit /b 1
)

set "LOCK=%FRONTEND%\package-lock.json"
set "LOCK_HASH_FILE=%FRONTEND%\.package-lock.sha256"

set "NEED_NPM_INSTALL=0"
if not exist "node_modules\" set "NEED_NPM_INSTALL=1"

if exist "%LOCK%" (
  for /f "tokens=1" %%H in ('certutil -hashfile "%LOCK%" SHA256 ^| find /I /V "hash" ^| find /I /V "certutil"') do set "LOCK_HASH=%%H
  set "OLD_LOCK_HASH="
  if exist "%LOCK_HASH_FILE%" set /p OLD_LOCK_HASH=<"%LOCK_HASH_FILE%"
  if /I not "!LOCK_HASH!"=="!OLD_LOCK_HASH!" set "NEED_NPM_INSTALL=1"
) else (
  REM Si no hay lockfile, mejor forzar install (evita "vite no se reconoce")
  set "NEED_NPM_INSTALL=1"
)

if "%NEED_NPM_INSTALL%"=="1" (
  >>"%LOG%" echo Instalando deps frontend (npm install)...
  call npm install >>"%LOG%" 2>&1
  if errorlevel 1 (
    echo ERROR: npm install ha fallado.
    >>"%LOG%" echo ERROR: npm install ha fallado.
    popd
    pause
    exit /b 1
  )
  if exist "%LOCK%" (
    for /f "tokens=1" %%H in ('certutil -hashfile "%LOCK%" SHA256 ^| find /I /V "hash" ^| find /I /V "certutil"') do set "LOCK_HASH=%%H
    echo !LOCK_HASH!>"%LOCK_HASH_FILE%"
  )
) else (
  >>"%LOG%" echo Frontend deps OK (sin cambios).
)

>>"%LOG%" echo Arrancando frontend...
start "Sahocars Frontend" cmd /k "npm run dev -- --host %WEB_HOST% --port %WEB_PORT%"

popd >>"%LOG%" 2>&1

REM ============================
REM WAIT FOR SERVICES + OPEN BROWSER
REM ============================
>>"%LOG%" echo Esperando a que arranquen servicios...

REM Espera backend /health (hasta ~30s)
for /L %%i in (1,1,30) do (
  powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://%API_HOST%:%API_PORT%/health -TimeoutSec 2).StatusCode -eq 200}catch{exit 1}" >nul 2>&1
  if not errorlevel 1 goto BACKEND_OK
  timeout /t 1 >nul
)
:BACKEND_OK

REM Espera frontend (hasta ~30s)
for /L %%i in (1,1,30) do (
  powershell -NoProfile -Command "try{(Invoke-WebRequest -UseBasicParsing http://%WEB_HOST%:%WEB_PORT% -TimeoutSec 2).StatusCode -ge 200}catch{exit 1}" >nul 2>&1
  if not errorlevel 1 goto FRONTEND_OK
  timeout /t 1 >nul
)
:FRONTEND_OK

>>"%LOG%" echo Abriendo navegador...
start "" "http://%WEB_HOST%:%WEB_PORT%/"
start "" "http://%API_HOST%:%API_PORT%/docs"

>>"%LOG%" echo FIN OK
echo FIN OK >>"%LOG%"

exit /b 0

