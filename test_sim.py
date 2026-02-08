
import sys
import os

# Set up paths
sys.path.append(r"c:\Users\ismael.rodriguez\MIS HERRAMIENTAS\SIMULADOR FLEJE_PRENSAS")

from backend.core import simulation_core
from backend.db import database
from sqlalchemy.orm import Session

def test():
    db = database.SessionLocal()
    try:
        print("Testing simulation_core.get_simulation_data(db, None)...")
        data = simulation_core.get_simulation_data(db, None)
        print("Successfully retrieved data.")
        print(f"Summary keys: {data.keys()}")
        print(f"Summary rows: {len(data['summary'])}")
        print(f"Detail rows: {len(data['detail'])}")
    except Exception as e:
        print(f"FAILED with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test()
