@echo off
setlocal

rem Rutas base (normaliza el path absoluto sin barra final)
set "ROOT=%~dp0"
for %%I in ("%ROOT%") do set "ROOT=%%~fI"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
set "BACKEND=%ROOT%\backend"
set "FRONTEND=%ROOT%\frontend"

echo === Preparando backend ===
pushd "%BACKEND%"
if not exist ".venv" (
  echo Creando entorno virtual de Python...
  python -m venv .venv
)
call ".venv\Scripts\activate"
python -m pip install --upgrade pip >nul
pip install -r requirements.txt
popd

echo === Arrancando backend (puerto 8000) ===
start "sahocars-backend" cmd /K "cd /d \"%BACKEND%\" && call .venv\Scripts\activate && uvicorn main:app --reload --host 0.0.0.0 --port 8000"

echo === Preparando frontend ===
pushd "%FRONTEND%"
if not exist "node_modules" (
  npm ci
) else (
  echo node_modules ya existe, saltando npm ci
)
popd

echo === Arrancando frontend (puerto 5173) ===
start "sahocars-frontend" cmd /K "cd /d \"%FRONTEND%\" && npm run dev -- --host 0.0.0.0 --port 5173"

echo === Abriendo navegador ===
start "" "http://localhost:5173/"

echo Listo. Se han abierto dos ventanas de terminal con backend y frontend.

endlocal
