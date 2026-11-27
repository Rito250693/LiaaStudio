@echo off
chcp 65001 >nul
title LIAA Studio - Servidor Local (UAZ)
cd /d "%~dp0"

set "FNM_NODE=%APPDATA%\fnm\node-versions\v26.13.1\installation"
if exist "%FNM_NODE%\node.exe" (
  set "PATH=%FNM_NODE%;%PATH%"
)

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo [ERROR] No se encontro Node.js en este equipo.
  echo Instala Node.js v22.5 o superior ^(recomendado v24/v26^) y vuelve a intentarlo.
  echo.
  pause
  exit /b 1
)

echo ============================================================
echo   LIAA Studio - Portal Web y Panel Administrativo (UAZ)
echo ============================================================
echo.
echo   Sitio publico : http://localhost:5173/
echo   Panel Admin   : http://localhost:5173/admin
echo.
echo   Mantener esta ventana abierta mientras uses el sitio.
echo   Para detener el servidor presiona Ctrl + C o cierra esta ventana.
echo ============================================================
echo.

start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5173/"
call npm.cmd run dev -- --port 5173 --strictPort

echo.
echo El servidor se ha detenido.
pause
