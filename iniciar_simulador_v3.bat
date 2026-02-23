@echo off
TITLE RPK NEXUS SIMULADOR V3.5 - CLASSIC CORE
SET PYTHON_PATH=c:\Users\ismael.rodriguez\MIS HERRAMIENTAS\SIMULADOR FLEJE_PRENSAS V3\_SISTEMA\runtime_python\python.exe
SET APP_PATH=c:\Users\ismael.rodriguez\MIS HERRAMIENTAS\SIMULADOR FLEJE_PRENSAS V3

echo.
echo ========================================================
echo   RPK NEXUS V5.5 - MOTOR DE SIMULACION (CARRIL B)
echo ========================================================
echo.
echo [1/3] Verificando entorno...
if not exist "%PYTHON_PATH%" (
    echo [ERROR] No se encuentra el runtime en _SISTEMA.
    pause
    exit
)

echo [2/3] Liberando puerto 5000 (si esta ocupado)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /F /PID %%a 2>nul

echo [3/3] Iniciando Servidor y Navegador...
start http://localhost:5000
cd /d "%APP_PATH%"
"%PYTHON_PATH%" -m uvicorn backend.api.server:app --host 0.0.0.0 --port 5000

pause
