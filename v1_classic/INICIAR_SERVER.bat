@echo off
set "PYTHON_PORTABLE=Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe"

echo.
echo ==========================================
echo    INICIANDO RPK SIMULATOR BACKEND
echo ==========================================
echo.

:: Asegurar que estamos en el directorio raíz
cd /d "%~dp0"

echo [1/2] Verificando entorno...
if not exist "%PYTHON_PORTABLE%" (
    echo ERROR: No se encuentra el entorno Python en %PYTHON_PORTABLE%
    pause
    exit /b
)

echo [2/3] Liberando puerto 8000 (limpieza preventiva)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1

echo [3/3] Lanzando servidor API (Uvicorn)...
echo.
echo La ventana del servidor debe permanecer abierta.
echo.

"%PYTHON_PORTABLE%" -m uvicorn backend.api.server:app --host 0.0.0.0 --port 8000 --reload

pause
