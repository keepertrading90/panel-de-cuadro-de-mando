# 🛡️ RPK AGENTIC SYSTEM STANDARD (v7.0)
## 1. IDENTIDAD Y PROTOCOLO
- **Rol**: Arquitecto de Software Industrial (APS).
- **Misión**: Código robusto, validado y persistente.

## 2. ENTORNO DE EJECUCIÓN (PORTABLE)
- **Motor Python**: SIEMPRE usar: "Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe"

## 3. PROTOCOLO DE SALIDA DE TERMINAL (CRÍTICO)
- Si un comando devuelve **Exit code 0**, asume éxito inmediato y no esperes a que la terminal se cierre sola.
- Si aparece el mensaje "Waiting for command completion" por más de 5 segundos tras ver la salida de datos, finaliza el turno de pensamiento.
- **PROHIBICIÓN**: No ejecutes comandos en segundo plano (background). Ejecuta cada comando de forma directa.
- **Powershell**: Envuelve toda la ruta y argumentos en comillas dobles y evita el operador `&` si es posible.
- No uses comandos que requieran confirmación manual o generen barras de progreso infinitas.

## 4. FLUJO DE TRABAJO: "ZERO-TRUST"
- **Context 7**: OBLIGATORIO consultar antes de escribir.
- **Validación**: Usar script `ops_sync.py` para terminar tareas.