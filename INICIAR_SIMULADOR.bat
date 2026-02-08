@echo off
set "PYTHON_PORTABLE=Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe"

echo.
echo ==========================================
echo    INICIANDO SIMULADOR RPK (PRENSAS)
echo ==========================================
echo.

cd /d "%~dp0"

echo [1/3] Verificando entorno...
if not exist "%PYTHON_PORTABLE%" (
    echo ERROR: No se encuentra el entorno Python en %PYTHON_PORTABLE%
    echo Por favor, verifica la conexion a la unidad Y:
    pause
    exit /b
)

echo [2/3] Iniciando Servidor API en segundo plano...
:: Usamos port 5000 estandarizado para la V2
set PORT=5000
start "RPK_PRENSAS_SERVER_V2" /B "%PYTHON_PORTABLE%" -m uvicorn backend.api.server:app --host 0.0.0.0 --port %PORT%

echo [3/3] Abriendo interfaz en el navegador...
timeout /t 3 >nul
start "" "http://localhost:%PORT%"

echo.
echo ✅ Simulador Activo.
echo Puedes cerrar esta ventana, el servidor seguira corriendo en segundo plano.
echo Para detenerlo totalmente, usa el Administrador de Tareas o INICIAR_SERVER.bat.
echo.
timeout /t 5
exit
