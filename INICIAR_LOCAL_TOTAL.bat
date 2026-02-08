@echo off
set "PYTHON_LOCAL=%~dp0_SISTEMA\runtime_python\python.exe"

echo.
echo ==========================================
echo    INICIANDO SIMULADOR RPK (MODO LOCAL)
echo    Versión Ejecutiva V2 - Sin Red
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando entorno local...
if not exist "%PYTHON_LOCAL%" (
    echo.
    echo 🔴 ERROR: No se encuentra Python en %PYTHON_LOCAL%
    echo Asegúrate de terminar de copiar la carpeta 'runtime_python' a:
    echo C:\Users\ismael.rodriguez\MIS HERRAMIENTAS\_SISTEMA\
    echo.
    pause
    exit /b
)

echo [2/3] Liberando puerto 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %%a >nul 2>&1

echo [3/3] Lanzando Servidor y Aplicacion...
set PORT=5000
start "RPK_SIM_LOCAL" /B "%PYTHON_LOCAL%" -m uvicorn backend.api.server:app --host 127.0.0.1 --port %PORT%

timeout /t 3 >nul
start "" "http://127.0.0.1:%PORT%"

echo.
echo ✅ LISTO: La aplicacion ahora es 100 por ciento independiente.
echo Puedes cerrar esta ventana.
echo.
timeout /t 5
exit
