@echo off
cd /d C:\sahocars\backend

set "GIT_BRANCH="
set "GIT_COMMIT="
where git >nul 2>&1
if not errorlevel 1 (
  for /f "delims=" %%i in ('git -C .. rev-parse --abbrev-ref HEAD 2^>nul') do set "GIT_BRANCH=%%i"
  for /f "delims=" %%i in ('git -C .. rev-parse --short HEAD 2^>nul') do set "GIT_COMMIT=%%i"
)
if not defined SAHOCARS_BRANCH if defined GIT_BRANCH set "SAHOCARS_BRANCH=%GIT_BRANCH%"
if not defined SAHOCARS_COMMIT if defined GIT_COMMIT set "SAHOCARS_COMMIT=%GIT_COMMIT%"
if not defined SAHOCARS_BRANCH set "SAHOCARS_BRANCH=local"
if not defined SAHOCARS_COMMIT set "SAHOCARS_COMMIT=unknown"
if not defined SAHOCARS_APP_BRANCH set "SAHOCARS_APP_BRANCH=%SAHOCARS_BRANCH%"
if not defined SAHOCARS_APP_COMMIT set "SAHOCARS_APP_COMMIT=%SAHOCARS_COMMIT%"

python -m uvicorn main:app --host 0.0.0.0 --port 8000
pause
