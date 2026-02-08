
import pandas as pd
import os
import sys

# Simular el entorno del core
BASE_DIR = r"c:\Users\ismael.rodriguez\MIS HERRAMIENTAS\SIMULADOR FLEJE_PRENSAS\backend"
EXCEL_PATH = os.path.join(BASE_DIR, "MAESTRO FLEJE_v1.xlsx")

print(f"Probando lectura de {EXCEL_PATH}...")
try:
    df = pd.read_excel(EXCEL_PATH)
    print(f"Éxito: {len(df)} filas cargadas.")
    print("Columnas:", df.columns.tolist())
    
    # Probar cálculos
    df['Volumen anual'] = pd.to_numeric(df['Volumen anual'], errors='coerce').fillna(0)
    df['Piezas por minuto'] = pd.to_numeric(df['Piezas por minuto'], errors='coerce').fillna(0)
    df['%OEE'] = pd.to_numeric(df['%OEE'], errors='coerce').fillna(0)
    df['dias laborales 2026'] = pd.to_numeric(df['dias laborales 2026'], errors='coerce').fillna(238)
    
    df['Piezas por hora'] = df['Piezas por minuto'] * 60
    df['Capacidad_Dia_16H'] = df['Piezas por hora'] * 16 * df['%OEE']
    df['Capacidad_Anual_16H'] = df['Capacidad_Dia_16H'] * df['dias laborales 2026']
    df['Saturacion'] = (df['Volumen anual'] / df['Capacidad_Anual_16H']).replace([float('inf'), -float('inf')], 0).fillna(0)
    
    print("Cálculo de saturación completado.")
    print("Resumen de saturación por centro:")
    summary = df.groupby('Centro')['Saturacion'].mean()
    print(summary)

except Exception as e:
    print(f"ERROR: {e}")
