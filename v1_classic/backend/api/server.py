print("DEBUG: Importando librerias base...", flush=True)
import os
import sys
import json
import time

print("DEBUG: Configurando PATH...", flush=True)
# HACK DE RUTAS PARA PRODUCCION
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.append(ROOT_DIR)

print("DEBUG: Importando FastAPI...", flush=True)
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

print("DEBUG: Importando modulos locales...", flush=True)
from backend.db import database
from backend.core import simulation_core

print("DEBUG: Inicializando DB...", flush=True)
try:
    database.init_db()
    print("DEBUG: DB Iniciada OK", flush=True)
except Exception as e:
    print(f"ERROR DB: {e}", flush=True)

print("DEBUG: Creando instancia FastAPI...", flush=True)
app = FastAPI(title="RPK Simulator API")

# Determinar rutas relativas para el frontend
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "..", "..", "frontend", "ui")
print(f"DEBUG: Frontend dir: {FRONTEND_DIR}", flush=True)

# CORS para el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok"}

# Dependency
def get_db():
    db = database.SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic models
class OverrideBase(BaseModel):
    articulo: str
    centro: str
    oee_override: Optional[float] = None
    ppm_override: Optional[float] = None
    demanda_override: Optional[float] = None
    new_centro: Optional[str] = None
    horas_turno_override: Optional[int] = None
    setup_time_override: Optional[float] = None

class ScenarioCreate(BaseModel):
    name: str
    description: Optional[str] = None
    dias_laborales: Optional[int] = 238
    horas_turno_global: Optional[int] = 16
    center_configs: Optional[dict] = {}
    overrides: List[OverrideBase] = []

class ScenarioResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    dias_laborales: int
    horas_turno_global: int
    center_configs_json: Optional[str] = None
    
    class Config:
        from_attributes = True

@app.get("/api/scenarios", response_model=List[ScenarioResponse])
def list_scenarios(db: Session = Depends(get_db)):
    return db.query(database.Scenario).all()

class HistoryResponse(BaseModel):
    id: int
    timestamp: str
    name: str
    changes_count: int
    details_snapshot: Optional[str] = None
    
@app.get("/api/scenarios/{scenario_id}/history", response_model=List[HistoryResponse])
def get_scenario_history(scenario_id: int, db: Session = Depends(get_db)):
    hist = db.query(database.ScenarioHistory).filter(database.ScenarioHistory.scenario_id == scenario_id).order_by(database.ScenarioHistory.timestamp.desc()).all()
    return [{
        "id": h.id,
        "timestamp": h.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
        "name": h.name,
        "changes_count": h.changes_count,
        "details_snapshot": h.details_snapshot
    } for h in hist]

@app.post("/api/scenarios", response_model=ScenarioResponse)
def create_scenario(scenario_data: ScenarioCreate, db: Session = Depends(get_db)):
    # Validar nombre único
    existing = db.query(database.Scenario).filter(database.Scenario.name == scenario_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Ya existe un escenario con el nombre '{scenario_data.name}'.")

    db_scenario = database.Scenario(
        name=scenario_data.name, 
        description=scenario_data.description,
        dias_laborales=scenario_data.dias_laborales,
        horas_turno_global=scenario_data.horas_turno_global,
        center_configs_json=json.dumps(scenario_data.center_configs)
    )
    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)
    
    for ov in scenario_data.overrides:
        db_ov = database.ScenarioDetail(
            scenario_id=db_scenario.id,
            articulo=ov.articulo,
            centro=ov.centro,
            oee_override=ov.oee_override,
            ppm_override=ov.ppm_override,
            demanda_override=ov.demanda_override,
            new_centro=ov.new_centro,
            horas_turno_override=ov.horas_turno_override
        )
        db.add(db_ov)
    
    db.commit()
    
    # Guardar en histórico
    history_entry = database.ScenarioHistory(
        scenario_id=db_scenario.id,
        name=db_scenario.name,
        changes_count=len(scenario_data.overrides),
        details_snapshot=json.dumps([ov.dict() for ov in scenario_data.overrides])
    )
    db.add(history_entry)
    db.commit()
    
    return db_scenario

@app.get("/api/simulate/base")
async def get_base_simulation(db: Session = Depends(get_db), dias_laborales: Optional[int] = None, horas_turno: Optional[int] = None):
    try:
        # get_simulation_data ya devuelve un dict con {"summary": ..., "detail": ...}
        return simulation_core.get_simulation_data(db, dias_laborales=dias_laborales, horas_turno=horas_turno)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/simulate/{scenario_id}")
async def get_scenario_simulation(scenario_id: int, db: Session = Depends(get_db), dias_laborales: Optional[int] = None, horas_turno: Optional[int] = None):
    try:
        db_sc = db.query(database.Scenario).filter(database.Scenario.id == scenario_id).first()
        if not db_sc:
            raise HTTPException(status_code=404, detail="Scenario not found")
        
        # Priorizar parámetros de URL, si no, usar los guardados en el escenario
        d_lab = dias_laborales if dias_laborales is not None else db_sc.dias_laborales
        h_tur = horas_turno if horas_turno is not None else db_sc.horas_turno_global
        c_conf = json.loads(db_sc.center_configs_json) if db_sc.center_configs_json else {}

        return simulation_core.get_simulation_data(
            db, 
            scenario_id, 
            dias_laborales=d_lab, 
            horas_turno=h_tur, 
            center_configs=c_conf
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PreviewPayload(BaseModel):
    overrides: List[OverrideBase]
    dias_laborales: Optional[int] = None
    horas_turno: Optional[int] = None
    center_configs: Optional[dict] = None # Nuevo campo para turnos por centro

@app.post("/api/simulate/preview")
async def get_preview_simulation(payload: PreviewPayload, db: Session = Depends(get_db)):
    try:
        # Pasamos los overrides directamente al core
        return simulation_core.get_simulation_data(
            db, 
            overrides_list=payload.overrides, 
            dias_laborales=payload.dias_laborales,
            horas_turno=payload.horas_turno,
            center_configs=payload.center_configs
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/scenarios/{scenario_id}")
def delete_scenario(scenario_id: int, db: Session = Depends(get_db)):
    db_scenario = db.query(database.Scenario).filter(database.Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db.delete(db_scenario)
    db.commit()
    return {"message": "Scenario deleted"}

class ScenarioUpdate(BaseModel):
    name: str
    description: Optional[str] = None

@app.put("/api/scenarios/{scenario_id}", response_model=ScenarioResponse)
def update_scenario(scenario_id: int, data: ScenarioUpdate, db: Session = Depends(get_db)):
    db_scenario = db.query(database.Scenario).filter(database.Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    db_scenario.name = data.name
    if data.description:
        db_scenario.description = data.description
    db.commit()
    db.refresh(db_scenario)
    return db_scenario

@app.put("/api/scenarios/{scenario_id}/full", response_model=ScenarioResponse)
def update_scenario_full(scenario_id: int, scenario_data: ScenarioCreate, db: Session = Depends(get_db)):
    db_scenario = db.query(database.Scenario).filter(database.Scenario.id == scenario_id).first()
    if not db_scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    
    # Validar nombre único si ha cambiado
    if db_scenario.name != scenario_data.name:
        existing = db.query(database.Scenario).filter(database.Scenario.name == scenario_data.name).first()
        if existing:
             raise HTTPException(status_code=400, detail=f"No se puede renombrar: ya existe otro escenario con el nombre '{scenario_data.name}'.")
    
    db_scenario.name = scenario_data.name
    if scenario_data.description:
        db_scenario.description = scenario_data.description
    
    db_scenario.dias_laborales = scenario_data.dias_laborales
    db_scenario.horas_turno_global = scenario_data.horas_turno_global
    db_scenario.center_configs_json = json.dumps(scenario_data.center_configs)
    
    # Borrar detalles antiguos (cascade se encarga en la DB si está configurado, 
    # pero aquí lo hacemos explícito para asegurar reemplazo total)
    db.query(database.ScenarioDetail).filter(database.ScenarioDetail.scenario_id == scenario_id).delete()
    db.query(database.ScenarioHistory).filter(database.ScenarioHistory.scenario_id == scenario_id).delete()
    
    # Añadir nuevos detalles
    for ov in scenario_data.overrides:
        db_ov = database.ScenarioDetail(
            scenario_id=db_scenario.id,
            articulo=ov.articulo,
            centro=ov.centro,
            oee_override=ov.oee_override,
            ppm_override=ov.ppm_override,
            demanda_override=ov.demanda_override,
            new_centro=ov.new_centro,
            horas_turno_override=ov.horas_turno_override
        )
        db.add(db_ov)
    
    db.commit()

    # Guardar en histórico
    history_entry = database.ScenarioHistory(
        scenario_id=db_scenario.id,
        name=db_scenario.name,
        changes_count=len(scenario_data.overrides),
        details_snapshot=json.dumps([ov.dict() for ov in scenario_data.overrides])
    )
    db.add(history_entry)
    db.commit()

    db.refresh(db_scenario)
    return db_scenario

# Servir frontend estático
if os.path.exists(FRONTEND_DIR):
    app.mount("/ui", StaticFiles(directory=FRONTEND_DIR), name="ui")

@app.get("/")
async def read_index():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Frontend no encontrado en " + FRONTEND_DIR}

if __name__ == "__main__":
    import uvicorn
    # Intentar leer puerto de variable de entorno o usar 8080
    port = int(os.environ.get("PORT", 8080))
    print(f"DEBUG: Arrancando Uvicorn en http://localhost:{port} ...", flush=True)
    try:
        uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
    except Exception as e:
        print(f"ERROR AL ARRANCAR SERVIDOR: {e}", flush=True)
        # Si el 8080 falla, intentamos el 8081 como fallback automático
        if port == 8080:
            print("REINTENTANDO en puerto 8081...", flush=True)
            uvicorn.run(app, host="0.0.0.0", port=8081, log_level="info")
