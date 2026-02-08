import sys
import os
sys.path.append(os.getcwd())

try:
    from backend.api.server import app
    print("Importacion exitosa.")
    from backend.core.simulation_core import get_simulation_data
    from backend.db.database import SessionLocal
    db = SessionLocal()
    data = get_simulation_data(db, None)
    print(f"Carga de datos base exitosa: {len(data['detail'])} registros.")
    db.close()
    print("Prueba de backend completada con exito.")
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
