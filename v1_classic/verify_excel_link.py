import os
import sys

# Ajustar sys.path para que pueda importar 'backend' desde el directorio actual
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

try:
    from backend.core import simulation_core
    print(f"Ruta configurada en simulation_core: {simulation_core.EXCEL_PATH}")
    if os.path.exists(simulation_core.EXCEL_PATH):
        print("✅ EXITO: El archivo maestro principal se detecta correctamente.")
    else:
        print("❌ ERROR: El archivo maestro principal NO se encuentra en la ruta especificada.")
except Exception as e:
    print(f"❌ ERROR durante la importacion/verificacion: {e}")
