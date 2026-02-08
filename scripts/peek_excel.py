import pandas as pd
import os

excel_path = 'backend/MAESTRO FLEJE_v1.xlsx'

if os.path.exists(excel_path):
    try:
        df = pd.read_excel(excel_path)
        print("--- HEAD ---")
        print(df.head())
        print("\n--- COLUMNS ---")
        print(df.columns.tolist())
        print("\n--- SHAPE ---")
        print(df.shape)
    except Exception as e:
        print(f"Error reading Excel: {e}")
else:
    print(f"File not found: {excel_path}")
