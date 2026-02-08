import pandas as pd
import os
import time
import functools
from sqlalchemy.orm import Session
from typing import List
from backend.db import database

# Usamos ruta absoluta basada en la ubicación de este archivo para evitar errores según el CWD
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL_PATH = os.path.join(BASE_DIR, "MAESTRO FLEJE_v1.xlsx")

# Variable global para cachear el DataFrame
_df_cache = None

def time_it(func):
    """Decorador para medir el tiempo de ejecución de las funciones."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        print(f"⏱️ [PERF] {func.__name__} tardó {end_time - start_time:.4f} segundos")
        return result
    return wrapper

def get_base_dataframe():
    """Retorna una copia del DataFrame maestro, usando una caché binaria en disco para velocidad extra."""
    global _df_cache
    CACHE_PATH = EXCEL_PATH + ".cache.pkl"
    
    if _df_cache is not None:
        return _df_cache.copy()

    # Verificar si existe caché y si es más reciente que el Excel
    use_cache = False
    if os.path.exists(CACHE_PATH) and os.path.exists(EXCEL_PATH):
        if os.path.getmtime(CACHE_PATH) > os.path.getmtime(EXCEL_PATH):
            use_cache = True

    try:
        if use_cache:
            print(f"🚀 Cargando desde caché binaria (Modo Ultra Rápido)...", flush=True)
            start_load = time.perf_counter()
            _df_cache = pd.read_pickle(CACHE_PATH)
            end_load = time.perf_counter()
            print(f"✅ Caché cargada en {end_load - start_load:.4f} segundos.", flush=True)
        else:
            print(f"🚀 Cargando Excel Maestro por primera vez desde: {EXCEL_PATH}...", flush=True)
            if not os.path.exists(EXCEL_PATH):
                raise FileNotFoundError(f"No se encuentra el archivo maestro en: {EXCEL_PATH}")
            
            start_load = time.perf_counter()
            _df_cache = pd.read_excel(EXCEL_PATH)
            
            # Limpieza básica inicial
            _df_cache['Articulo'] = _df_cache['Articulo'].astype(str).str.replace(r'\.0$', '', regex=True)
            _df_cache['Centro'] = _df_cache['Centro'].astype(str).str.replace(r'\.0$', '', regex=True)
            _df_cache = _df_cache[~_df_cache['Centro'].isin(['nan', 'NaN', 'None', '', 'nan.0'])].copy()
            _df_cache['centro_original'] = _df_cache['Centro']
            
            end_load = time.perf_counter()
            print(f"✅ Excel cargado en {end_load - start_load:.4f} segundos.", flush=True)
            
            # Guardar caché para la próxima vez
            print(f"🔄 Generando caché binaria para acelerar futuros arranques...", flush=True)
            _df_cache.to_pickle(CACHE_PATH)
            
    except Exception as e:
        print(f"⚠️ Error cargando datos (reintentando normal): {e}", flush=True)
        _df_cache = pd.read_excel(EXCEL_PATH)

    return _df_cache.copy()

@time_it
def calculate_saturation(df: pd.DataFrame, dias_laborales_override: int = None, horas_turno_default: int = 16):
    """
    Calcula la saturación basada en las columnas del Excel.
    """
    
    # Aseguramos tipos de datos
    df['Volumen anual'] = pd.to_numeric(df['Volumen anual'], errors='coerce').fillna(0)
    df['Piezas por minuto'] = pd.to_numeric(df['Piezas por minuto'], errors='coerce').fillna(0)
    df['%OEE'] = pd.to_numeric(df['%OEE'], errors='coerce').fillna(0)
    
    # Aseguramos que existe la columna horas_turno (puede venir pre-configurada con overrides)
    if 'horas_turno' not in df.columns:
        df['horas_turno'] = horas_turno_default
    
    # Usar override si existe, sino columna del excel, sino default 238
    if dias_laborales_override is not None:
        df['dias laborales 2026'] = dias_laborales_override
    else:
        df['dias laborales 2026'] = pd.to_numeric(df['dias laborales 2026'], errors='coerce').fillna(238)

    # Cálculos dinámicos
    df['Piezas por hora'] = df['Piezas por minuto'] * 60
    
    # Capacidad diaria dinámica según la columna de turnos (que contiene overrides o el valor global)
    df['Capacidad_Dia_H'] = df['Piezas por hora'] * df['horas_turno'] * df['%OEE']
    df['Capacidad_Anual_H'] = df['Capacidad_Dia_H'] * df['dias laborales 2026']
    
    # % Saturación
    df['Saturacion'] = (df['Volumen anual'] / df['Capacidad_Anual_H']).replace([float('inf'), -float('inf')], 0).fillna(0)
    
    return df

@time_it
def get_simulation_data(db: Session, scenario_id: int = None, dias_laborales: int = None, overrides_list: List = None, horas_turno: int = None, center_configs: dict = None):
    # En lugar de pd.read_excel, usamos la caché
    df = get_base_dataframe()
    
    # Asegurar que horas_turno es entero
    h_turno = int(horas_turno) if horas_turno is not None else 16
    df['horas_turno'] = h_turno
    
    # Aplicar configuraciones por centro si existen
    if center_configs:
        for centro, config in center_configs.items():
            if isinstance(config, dict) and 'shifts' in config:
                df.loc[df['Centro'].astype(str) == str(centro), 'horas_turno'] = int(config['shifts'])
    
    selected_overrides = []
    if scenario_id:
        selected_overrides = db.query(database.ScenarioDetail).filter(database.ScenarioDetail.scenario_id == scenario_id).all()
    elif overrides_list:
        selected_overrides = overrides_list

    for ov in selected_overrides:
        # Pydantic models (de server.py) o SQLAlchemy objects tienen atributos similares
        # Si es un dict (de un payload POST), usamos get, si es objeto usamos getattr
        art = getattr(ov, 'articulo', None) or (ov.articulo if hasattr(ov, 'articulo') else None)
        cen = getattr(ov, 'centro', None) or (ov.centro if hasattr(ov, 'centro') else None)
        
        mask = (df['Articulo'].astype(str) == str(art)) & (df['Centro'].astype(str) == str(cen))
        
        oee = getattr(ov, 'oee_override', None)
        ppm = getattr(ov, 'ppm_override', None)
        dem = getattr(ov, 'demanda_override', None)
        nc = getattr(ov, 'new_centro', None)
        ht = getattr(ov, 'horas_turno_override', None)

        if oee is not None: df.loc[mask, '%OEE'] = oee
        if ppm is not None: df.loc[mask, 'Piezas por minuto'] = ppm
        if dem is not None: df.loc[mask, 'Volumen anual'] = dem
        if nc is not None: df.loc[mask, 'Centro'] = nc
        if ht is not None: df.loc[mask, 'horas_turno'] = ht

    d_lab = int(dias_laborales) if dias_laborales is not None else None
    df = calculate_saturation(df, d_lab, h_turno)
    
    # Agrupación por Centro para el resumen de saturación
    centro_summary = df.groupby('Centro').agg({
        'Saturacion': 'sum',
        'Volumen anual': 'sum',
        'Articulo': 'count'
    }).reset_index()
    
    centro_summary.rename(columns={'Articulo': 'Num_Articulos'}, inplace=True)
    
    # Asegurar que no hay NaNs ni Valores Infinitos que rompan el JSON
    df = df.fillna(0).replace([float('inf'), -float('inf')], 0)
    centro_summary = centro_summary.fillna(0).replace([float('inf'), -float('inf')], 0)

    return {
        "detail": df.to_dict(orient="records"),
        "summary": centro_summary.to_dict(orient="records"),
        "meta": {
            "dias_laborales": d_lab if d_lab is not None else 238,
            "horas_turno_global": h_turno,
            "center_configs": center_configs or {}
        }
    }
