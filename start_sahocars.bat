@echo off
setlocal
title SAHOCARS START (diagnostico)

set "REPO=C:\sahocars"
set "LAUNCHER_PY=%REPO%\launcher\launcher.py"

echo =========================================
echo   SAHOCARS - START (diagnostico)
echo =========================================
echo REPO: %REPO%
echo LAUNCHER: %LAUNCHER_PY%
echo.

if not exist "%REPO%\" (
  echo ERROR: No existe %REPO%
  echo.
  pause
  exit /b 1
)

if not exist "%LAUNCHER_PY%" (
  echo ERROR: No existe el launcher.py en:
  echo %LAUNCHER_PY%
  echo.
  dir /b "%REPO%\launcher"
  echo.
  pause
  exit /b 1
)

cd /d "%REPO%"
echo OK: cd a %CD%
echo.

echo Comprobando Python...
where python
echo.

echo Ejecutando launcher...
python "%LAUNCHER_PY%"
echo.

echo (Si ves esto, el launcher ha terminado o ha fallado.)
pause
endlocal
