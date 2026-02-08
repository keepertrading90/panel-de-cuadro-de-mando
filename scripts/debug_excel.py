
import pandas as pd
import os

BASE_DIR = r"c:\Users\ismael.rodriguez\MIS HERRAMIENTAS\SIMULADOR FLEJE_PRENSAS\backend"
EXCEL_PATH = os.path.join(BASE_DIR, "MAESTRO FLEJE_v1.xlsx")
LOG_PATH = r"c:\Users\ismael.rodriguez\MIS HERRAMIENTAS\SIMULADOR FLEJE_PRENSAS\scripts\debug_output.txt"

with open(LOG_PATH, "w", encoding="utf-8") as f:
    f.write(f"Iniciando auditoria de columnas: {EXCEL_PATH}\n")
    try:
        df = pd.read_excel(EXCEL_PATH)
        f.write(f"Todas las columnas disponibles:\n{df.columns.tolist()}\n")
        
        # Buscar palabras clave como 'maquina', 'puesto', 'cantidad', 'num'
        missing_logic_cols = [c for c in df.columns if any(k in c.lower() for k in ['maq', 'puest', 'cant', 'num', 'dispo'])]
        f.write(f"\nColumnas candidatas para capacidad multiple:\n{missing_logic_cols}\n")
        
    except Exception as e:
        f.write(f"ERROR: {e}\n")
