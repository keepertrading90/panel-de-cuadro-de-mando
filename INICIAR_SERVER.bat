@echo off
set "PYTHON_PORTABLE=Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe"

echo.
echo ==========================================
echo    RPK SIMULATOR SERVER (PRENSAS)
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/2] Verificando entorno...
if not exist "%PYTHON_PORTABLE%" (
    echo ERROR: No se encuentra el entorno Python en %PYTHON_PORTABLE%
    pause
    exit /b
)

echo [2/2] Liberando puerto 5000 (limpieza preventiva)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %%a >nul 2>&1

echo Lanzando servidor en puerto 5000...
set PORT=5000
"%PYTHON_PORTABLE%" -m uvicorn backend.api.server:app --host 0.0.0.0 --port %PORT% --reload

pause
