# 🏭 SIMULADOR FLEJE_PRENSAS V3 | RPK v7.0 Industrial Documentation

## 📌 DESCRIPCIÓN GENERAL
El **Simulador Fleje_Prensas V3** es una herramienta analítica de alto rendimiento diseñada para la planificación estratégica de la producción en RPK. Permite realizar simulaciones dinámicas de carga de trabajo, saturación de centros y requerimientos de personal (MOD) basándose en un modelo de datos maestro industrial.

---

## 🛠️ ARQUITECTURA DEL PROYECTO (PASO A PASO)

El sistema está estructurado modularmente para garantizar escalabilidad y mantenimiento industrial:

1.  **Capa de Datos (Persistence)**:
    *   `backend/db/`: Contiene `database.py` (modelos SQLAlchemy) y `simulador.db` (SQLite local). Almacena los escenarios guardados por los usuarios.
    *   `MAESTRO FLEJE_v1.xlsx`: Fuente de verdad (SSOT) que contiene cadencias, OEEs y demandas base.

2.  **Motor de Simulación (Core Logic)**:
    *   `backend/core/simulation_core.py`: Procesa el DataFrame maestro. Implementa un sistema de **Caché Binaria (.pkl)** para cargar el Excel en milisegundos. Calcula saturaciones y MOD usando las fórmulas industriales de RPK.

3.  **Servidor de Aplicación (API)**:
    *   `backend/api/server.py`: Orquestador FastAPI. Expone endpoints REST para simular en tiempo real, guardar escenarios y servir los archivos estáticos del frontend.

4.  **Interfaz de Usuario (Frontend)**:
    *   `frontend/ui/`: Contiene `index.html`, `styles.css` y `app.js`.
    *   La UI es reactiva y se comunica con la API para reflejar cambios instantáneamente.

5.  **Automatización y QA**:
    *   `scripts/`: Utilidades para auditoría de código (`qa_scanner.py`) y sincronización con GitHub (`ops_sync.py`).

---

## 🎮 MANUAL DE FUNCIONALIDADES (BOTONES)

### Sidebar (Navegación Principal)
- **🏠 Escenario Base**: Resetea todas las modificaciones locales y carga la situación actual del Excel Maestro.
- **➕ Crear Escenario**: Captura el estado actual de la simulación (cambios aplicados) y solicita un nombre para guardarlo permanentemente en la base de datos.
- **📂 Gestionar**: Abre un panel para visualizar escenarios guardados, permitiendo cargarlos o eliminarlos de forma segura.
- **📊 Comparativa**: Permite seleccionar dos escenarios distintos para analizar sus diferencias en un dashboard dual (Gráfico + Tabla).

### Barra de Filtros y Parámetros
- **Días Laborales**: Input numérico para ajustar el calendario laboral anual (por defecto 238). Impacta directamente en la capacidad instalada.
- **Turnos (Global)**: Selector de turnos estándar (1T, 2T, 3T) aplicable a toda la planta.
- **Seleccionar Centros**: Desplegable con checkboxes para filtrar la visualización a máquinas específicas. Incluye botones rápidos (1T, 2T, 3T) por cada centro para ajustes granulares de capacidad.
- **Botón Aplicar**: Refresca la vista con los filtros de centros seleccionados.
- **Botón Limpiar**: Resetea los filtros de visualización al estado "Todos".

### Desglose de Artículos (Tabla)
- **🔍 Buscar (Input)**: Filtrado en tiempo real por Referencia de Artículo o Centro de Trabajo.
- **Botón Ajustar**: El botón más potente. Abre un modal para realizar "What-if analysis" sobre un artículo específico:
  - Cambiar de máquina (Nuevo Centro).
  - Modificar OEE o PPM estimados.
  - Ajustar demanda para simular picos de producción.
  - Configurar ratio de personal (MOD).

---

## 🧠 LÓGICA DE NEGOCIO Y CÁLCULOS

### 1. Cálculo de Tiempos
- **Horas de Producción**: 
  $$Horas_{Producción} = \frac{Volumen \, Anual}{Piezas/Hora \times \%OEE}$$
- **Horas Totales**: 
  $$Horas_{Totales} = Horas_{Producción} + Setup \, (h)$$
- **Horas Hombre (MOD)**: 
  $$Horas_{Hombre} = (Horas_{Producción} \times Ratio_{MOD}) + Setup \, (h)$$

### 2. Cálculo de Saturación
- **Capacidad Anual (H)**: 
  $$Capacidad = Días \, Laborales \times Horas \, Turno$$
- **% Saturación**: 
  $$Saturación = \frac{Horas_{Totales}}{Capacidad}$$

---

## 🚀 PROTOCOLO DE DESARROLLO (SOP)

1. **Validar**: `"Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe" scripts/qa_scanner.py`
2. **Sincronizar**: `"Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe" scripts/ops_sync.py "Mensaje"`

---
*Documento certificado por Antigravity APS - Sistema RPK v7.0*
