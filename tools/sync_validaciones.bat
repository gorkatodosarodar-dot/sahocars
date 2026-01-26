@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "ROOT=%SCRIPT_DIR%"

:find_root
if exist "%ROOT%\.git" goto root_found
for %%i in ("%ROOT%\..") do set "PARENT=%%~fi"
if /I "%PARENT%"=="%ROOT%" goto root_not_found
set "ROOT=%PARENT%"
goto find_root

:root_not_found
echo ERROR: No se pudo localizar .git desde %SCRIPT_DIR%.
exit /b 1

:root_found
pushd "%ROOT%" >nul

where git >nul 2>&1
if errorlevel 1 (
  echo ERROR: git no esta disponible en PATH.
  popd
  exit /b 1
)

git fetch origin --prune
if errorlevel 1 (
  echo ERROR: git fetch ha fallado.
  popd
  exit /b 1
)

set "DIRTY="
for /f %%i in ('git status --porcelain') do set "DIRTY=1"
if defined DIRTY (
  echo ERROR: Hay cambios locales. Haz commit o stash antes de sincronizar.
  popd
  exit /b 1
)

git show-ref --verify --quiet refs/remotes/origin/validaciones
if errorlevel 1 (
  echo ERROR: No existe origin/validaciones.
  popd
  exit /b 1
)

git show-ref --verify --quiet refs/heads/validaciones
if errorlevel 1 (
  git checkout -b validaciones origin/validaciones
  if errorlevel 1 goto checkout_failed
) else (
  git checkout validaciones
  if errorlevel 1 goto checkout_failed
)
goto checkout_ok

:checkout_failed
echo ERROR: No se pudo hacer checkout de validaciones.
popd
exit /b 1

:checkout_ok
git branch --set-upstream-to=origin/validaciones validaciones >nul 2>&1

git pull --ff-only origin validaciones
if errorlevel 1 (
  echo ERROR: git pull --ff-only ha fallado. Revisa divergencias.
  popd
  exit /b 1
)

git show-ref --verify --quiet refs/remotes/origin/fase-9c-packaging-update-rollback
if not errorlevel 1 (
  git merge-base --is-ancestor origin/fase-9c-packaging-update-rollback HEAD
  if errorlevel 1 (
    echo WARNING: La rama validaciones NO cuelga de v2.0 (fase-9c-packaging-update-rollback).
  )
)

for /f "delims=" %%i in ('git branch --show-current') do set "CUR_BRANCH=%%i"
for /f "delims=" %%i in ('git rev-parse --short HEAD') do set "CUR_SHA=%%i"
echo OK: Rama actual %CUR_BRANCH% @ %CUR_SHA%

popd >nul
exit /b 0
