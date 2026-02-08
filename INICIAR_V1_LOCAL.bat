@echo off
set "PYTHON_LOCAL=%~dp0_SISTEMA\runtime_python\python.exe"
set "V1_DIR=%~dp0v1_classic"

echo.
echo ==========================================
echo    INICIANDO SIMULADOR RPK (V1 CLASICO)
echo    Ejecución 100 por ciento LOCAL
echo ==========================================
echo.

if not exist "%PYTHON_LOCAL%" (
    echo 🔴 ERROR: No se encuentra Python local en _SISTEMA.
    pause
    exit /b
)

cd /d "%V1_DIR%"

echo [1/2] Liberando puerto 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do taskkill /f /pid %%a >nul 2>&1

echo [2/2] Lanzando V1 Clasico en puerto 8000...
set PORT=8000
start "RPK_V1_CLASICO" /B "%PYTHON_LOCAL%" -m uvicorn backend.api.server:app --host 127.0.0.1 --port %PORT%

timeout /t 3 >nul
start "" "http://127.0.0.1:%PORT%"

echo ✅ Proceso completado.
timeout /t 5
exit
