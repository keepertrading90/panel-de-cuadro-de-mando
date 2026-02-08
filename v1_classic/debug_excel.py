import pandas as pd
import os

path = r'C:\Users\ismael.rodriguez\MIS HERRAMIENTAS\SIMULADOR FLEJE_PRENSAS\backend\MAESTRO FLEJE_v1.xlsx'
if os.path.exists(path):
    df = pd.read_excel(path)
    print("COLUMNS:", df.columns.tolist())
    print("HEAD:")
    print(df.head(5).to_string())
else:
    print("FILE NOT FOUND")
