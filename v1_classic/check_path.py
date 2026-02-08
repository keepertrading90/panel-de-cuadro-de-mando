import os
import sys

# Simular el entorno de ejecución de server.py
DIR = os.path.dirname(os.path.abspath(__file__))
if DIR not in sys.path:
    sys.path.append(DIR)

from backend.core import simulation_core

print(f"Ruta configurada: {simulation_core.EXCEL_PATH}")
if os.path.exists(simulation_core.EXCEL_PATH):
    print("✅ El archivo EXISTE.")
else:
    print("❌ El archivo NO EXISTE.")
