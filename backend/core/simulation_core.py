import pandas as pd
import os
import time
import functools
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timedelta
from backend.db import database

# Usamos la ruta del Maestro Fleje en el directorio raíz del backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL_PATH = os.path.join(BASE_DIR, "MAESTRO FLEJE_v1.xlsx")

print(f"DEBUG:simulation_core: Usando EXCEL_PATH = {EXCEL_PATH}", flush=True)

# Variable global para cachear el DataFrame
_df_cache = None

def time_it(func):
    """Decorador para medir el tiempo de ejecución de las funciones."""
    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.perf_counter()
        result = func(*args, **kwargs)
        end_time = time.perf_counter()
        print(f"DEBUG: [PERF] {func.__name__} tardó {end_time - start_time:.4f} segundos")
        return result
    return wrapper

def get_actual_dataframe(dias_laborales: int = None):
    """Carga los pedidos reales de Nexus v2 y los cruza con el maestro de cadencias."""
    try:
        # Ruta al Data Lake de Nexus v2 (Proyectos hermanos en MIS HERRAMIENTAS)
        LAKE_PEDIDOS_DIR = os.path.normpath(os.path.join(os.path.dirname(os.getcwd()), "Plan Maestro RPK NEXUS_v2", "backend", "data_lake", "transaccional", "pedidos"))
        
        # Buscar el parquet más reciente rumbiando por carpetas
        if not os.path.exists(LAKE_PEDIDOS_DIR):
            print(f"DEBUG: No se encontro el Data Lake en {LAKE_PEDIDOS_DIR}", flush=True)
            return None

        years = sorted([d for d in os.listdir(LAKE_PEDIDOS_DIR) if d.startswith("year=")], reverse=True)
        if not years: return None
        
        months = sorted([d for d in os.listdir(os.path.join(LAKE_PEDIDOS_DIR, years[0])) if d.startswith("month=")], reverse=True)
        if not months: return None
        
        day_dir = os.path.join(LAKE_PEDIDOS_DIR, years[0], months[0])
        files = sorted([f for f in os.listdir(day_dir) if f.endswith(".parquet")], reverse=True)
        if not files: return None
        
        latest_parquet = os.path.join(day_dir, files[0])
        print(f"DEBUG: Cargando Pedidos Actuales: {latest_parquet}", flush=True)
        
        df_orders = pd.read_parquet(latest_parquet)
        source_name = files[0] # Guardamos el nombre para el UI
        
        # --- FILTRADO POR HORIZONTE TEMPORAL (Días Laborales) ---
        if dias_laborales is not None and 'F.ENT.PREV' in df_orders.columns:
            try:
                # Convertir a datetime (el formato suele ser DD/MM/YYYY en los excels de Nexus)
                df_orders['F.ENT.PREV'] = pd.to_datetime(df_orders['F.ENT.PREV'], dayfirst=True, errors='coerce')
                # El horizonte es HOY + N días naturales
                horizonte = datetime.now() + timedelta(days=dias_laborales)
                # Filtrar solo pedidos pendientes con fecha de entrega <= horizonte
                df_orders = df_orders[df_orders['F.ENT.PREV'] <= horizonte].copy()
                print(f"DEBUG: Filtrando pedidos hasta {horizonte.strftime('%Y-%m-%d')} ({dias_laborales} dias)", flush=True)
                source_name += f" (Filtrado: {dias_laborales}d)"
            except Exception as e:
                print(f"DEBUG: Error filtrando fechas de pedidos: {e}", flush=True)

        # DNA RPK: Normalizar columnas y limpiar articulos
        df_orders['ARTICULO'] = df_orders['ARTICULO'].astype(str).str.strip().str.replace(r'\.0$', '', regex=True)
        
        # Sumar PENDIENT. por Articulo
        if 'PENDIENT.' in df_orders.columns:
            df_orders['PENDIENT.'] = pd.to_numeric(df_orders['PENDIENT.'], errors='coerce').fillna(0)
            df_actual = df_orders.groupby('ARTICULO')['PENDIENT.'].sum().reset_index()
            df_actual.columns = ['Articulo', 'Volumen anual']
            # Eliminar articulos con demanda 0
            df_actual = df_actual[df_actual['Volumen anual'] > 0]
        else:
            print(f"DEBUG: Columna PENDIENT. no encontrada en {latest_parquet}", flush=True)
            return None

        # Cruzar con el Maestro para obtener CADENCIAS (PPM, OEE, Centro)
        df_master = get_base_dataframe()
        
        # Join: Queremos solo los artículos que tienen pedidos actuales, pero con los datos técnicos del maestro
        df_merged = pd.merge(
            df_actual, 
            df_master.drop(columns=['Volumen anual']), 
            on='Articulo', 
            how='inner'
        )
        
        print(f"DEBUG: Datos Actuales cargados: {len(df_merged)} articulos cruzados.", flush=True)
        return df_merged, source_name
        
    except Exception as e:
        print(f"DEBUG: Error en get_actual_dataframe: {e}", flush=True)
        return None, None

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
            print(f"DEBUG: Carga desde cache binaria (Modo Ultra Rapido)...", flush=True)
            start_load = time.perf_counter()
            _df_cache = pd.read_pickle(CACHE_PATH)
            end_load = time.perf_counter()
            print(f"DEBUG: Cache cargada en {end_load - start_load:.4f} segundos.", flush=True)
        else:
            print(f"DEBUG: Cargando Excel Maestro por primera vez desde: {EXCEL_PATH}...", flush=True)
            if not os.path.exists(EXCEL_PATH):
                raise FileNotFoundError(f"No se encuentra el archivo maestro en: {EXCEL_PATH}")
            
            start_load = time.perf_counter()
            _df_cache = pd.read_excel(EXCEL_PATH)
            
            # Limpieza básica inicial
            _df_cache['Articulo'] = _df_cache['Articulo'].astype(str).str.replace(r'\.0$', '', regex=True)
            _df_cache['Centro'] = _df_cache['Centro'].astype(str).str.replace(r'\.0$', '', regex=True)
            _df_cache = _df_cache[~_df_cache['Centro'].isin(['nan', 'NaN', 'None', '', 'nan.0'])].copy()
            
            end_load = time.perf_counter()
            print(f"✅ Excel cargado en {end_load - start_load:.4f} segundos.", flush=True)
            
            # Guardar caché para la próxima vez
            print(f"🔄 Generando caché binaria para acelerar futuros arranques...", flush=True)
            _df_cache.to_pickle(CACHE_PATH)
            
    except Exception as e:
        print(f"❌ Error al cargar DataFrame maestro: {e}")
        return None

    # Asegurar que centro_original existe (por si la caché es vieja)
    if 'centro_original' not in _df_cache.columns:
        _df_cache['centro_original'] = _df_cache['Centro']
        
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

    # Aseguramos que existe la columna de setup
    if 'Setup (h)' not in df.columns:
        for col in ['Setup', 'Preparacion', 'Tiempo Preparacion']:
            if col in df.columns:
                df['Setup (h)'] = pd.to_numeric(df[col], errors='coerce').fillna(0)
                break
        else:
            df['Setup (h)'] = 0.0
    else:
        df['Setup (h)'] = pd.to_numeric(df['Setup (h)'], errors='coerce').fillna(0)

    # --- LÓGICA MOD (PERSONAL) ---
    if 'Ratio_MOD' not in df.columns:
        for col in ['Ratio MOD', 'Ratio Persona Maquina', 'Ratio Persona Articulo', 'MOD']:
            if col in df.columns:
                df['Ratio_MOD'] = pd.to_numeric(df[col], errors='coerce').fillna(1.0)
                break
        else:
            df['Ratio_MOD'] = 1.0
    else:
        df['Ratio_MOD'] = pd.to_numeric(df['Ratio_MOD'], errors='coerce').fillna(1.0)

    # Cálculos dinámicos
    df['Piezas por hora'] = df['Piezas por minuto'] * 60
    
    # Manejo de OEE
    oee_mask = df['%OEE'] > 1.1
    df_oee_calc = df['%OEE'].copy()
    if oee_mask.any():
        df_oee_calc = df_oee_calc.apply(lambda x: x/100.0 if x > 1.1 else x)

    # Horas requeridas
    denominador = (df['Piezas por hora'] * df_oee_calc)
    df['Horas_Produccion'] = (df['Volumen anual'] / denominador).replace([float('inf'), -float('inf')], 0).fillna(0)
    df['Horas_Totales'] = df['Horas_Produccion'] + df['Setup (h)']
    
    # CÁLCULO HORAS HOMBRE (MOD)
    df['Horas_Hombre'] = (df['Horas_Produccion'] * df['Ratio_MOD'].fillna(1.0)) + df['Setup (h)']
    
    # Capacidad Anual en Horas
    df['Capacidad_Anual_H'] = df['dias laborales 2026'] * df['horas_turno']
    
    # % Saturación
    df['Saturacion'] = (df['Horas_Totales'] / df['Capacidad_Anual_H']).replace([float('inf'), -float('inf')], 0).fillna(0)

    # CÁLCULO IMPACTO
    total_horas_global = df['Horas_Totales'].sum()
    if total_horas_global > 0:
        df['Impacto'] = df['Horas_Totales'] / total_horas_global
    else:
        df['Impacto'] = 0.0
    
    return df

@time_it
def get_simulation_data(db: Session, scenario_id: int = None, dias_laborales: int = None, overrides_list: List = None, horas_turno: int = None, center_configs: dict = None, use_actual_data: bool = False):
    # Selección de fuente de datos
    source_file = None
    scenario_name = "Escenario Base"
    
    if use_actual_data:
        scenario_name = "Escenario Actual (Nexus v2)"
        df, source_file = get_actual_dataframe(dias_laborales)
        if df is None:
            print("DEBUG: Fallo al cargar datos ACTUALES. Usando BASE como fallback.", flush=True)
            df = get_base_dataframe()
    else:
        df = get_base_dataframe()
        if scenario_id:
            db_sc = db.query(database.Scenario).filter(database.Scenario.id == scenario_id).first()
            if db_sc:
                scenario_name = db_sc.name
    
    # Asegurar que horas_turno es entero
    h_turno = int(horas_turno) if horas_turno is not None else 16
    df['horas_turno'] = h_turno
    
    # Aplicar configuraciones por centro si existen
    if center_configs:
        for centro, config in center_configs.items():
            mask_c = df['Centro'].astype(str) == str(centro)
            if isinstance(config, dict):
                if 'shifts' in config:
                    df.loc[mask_c, 'horas_turno'] = int(config['shifts'])
                if 'personnel_ratio' in config:
                    df.loc[mask_c, 'Ratio_MOD'] = float(config['personnel_ratio'])
    
    selected_overrides = []
    if scenario_id:
        selected_overrides = db.query(database.ScenarioDetail).filter(database.ScenarioDetail.scenario_id == scenario_id).all()
    elif overrides_list:
        selected_overrides = overrides_list

    for ov in selected_overrides:
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
        
        if hasattr(ov, 'personnel_ratio_override') and ov.personnel_ratio_override is not None:
            df.loc[mask, 'Ratio_MOD'] = ov.personnel_ratio_override
        if getattr(ov, 'setup_time_override', None) is not None: 
            df.loc[mask, 'Setup (h)'] = ov.setup_time_override

    d_lab = int(dias_laborales) if dias_laborales is not None else None
    df = calculate_saturation(df, d_lab, h_turno)
    
    # Agrupación por Centro para el resumen de saturación
    centro_summary = df.groupby('Centro').agg({
        'Saturacion': 'sum',
        'Volumen anual': 'sum',
        'Horas_Totales': 'sum',
        'Horas_Hombre': 'sum',
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
            "scenario_name": scenario_name,
            "source_actual": source_file,
            "center_configs": center_configs or {},
            "applied_overrides": [
                {
                    "articulo": getattr(ov, 'articulo', None) or (ov.articulo if hasattr(ov, 'articulo') else None),
                    "centro": getattr(ov, 'centro', None) or (ov.centro if hasattr(ov, 'centro') else None),
                    "oee_override": getattr(ov, 'oee_override', None),
                    "ppm_override": getattr(ov, 'ppm_override', None),
                    "demanda_override": getattr(ov, 'demanda_override', None),
                    "new_centro": getattr(ov, 'new_centro', None),
                    "horas_turno_override": getattr(ov, 'horas_turno_override', None),
                    "personnel_ratio_override": getattr(ov, 'personnel_ratio_override', None),
                    "setup_time_override": getattr(ov, 'setup_time_override', None)
                } for ov in selected_overrides
            ] if selected_overrides else []
        }
    }
