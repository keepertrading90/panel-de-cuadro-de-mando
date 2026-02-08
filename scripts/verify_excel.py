import pandas as pd
import os
import sys

# Definir la ruta del Excel
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL_PATH = os.path.join(BASE_DIR, "backend", "MAESTRO FLEJE_v1.xlsx")

print(f"Verificando archivo: {EXCEL_PATH}")

if not os.path.exists(EXCEL_PATH):
    print(f"ERROR: Archivo no encontrado.")
    sys.exit(1)

try:
    # Leer el excel
    df = pd.read_excel(EXCEL_PATH)
    print(f"Columnas encontradas: {df.columns.tolist()}")
    print(f"Total de filas: {len(df)}")
    print("\nPrimeras 5 filas:")
    print(df.head())
except Exception as e:
    print(f"ERROR al leer el archivo: {e}")
