@echo off
set "PYTHON_PORTABLE=Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe"

echo Iniciando Servidor de API RPK...
start "RPK API SERVER" /B "%PYTHON_PORTABLE%" -m uvicorn backend.api.server:app --host 0.0.0.0 --port 8000 --reload

echo Abriendo Simulador en el navegador...
start "" "frontend\ui\index.html"

echo.
echo === SIMULADOR RPK ACTIVO ===
echo API: http://localhost:8000
echo UI: Local file frontend\ui\index.html
echo ============================
pause
