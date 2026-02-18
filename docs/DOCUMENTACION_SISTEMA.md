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
    *   `frontend/ui/`: Contiene `index.html`, `styles.css` y `app.js`. La UI es reactiva y se comunica con la API para reflejar cambios instantáneamente.

---

## 🏠 V1 LOCAL (CLASSIC VERSION)

El proyecto incluye una versión denominada **v1_local** o **Classic**, ubicada en la carpeta `/v1_classic/`. Esta versión está optimizada para el uso 100% individual y local.

### Diferencias Clave V1 vs V3:
- **Diseño de Interfaz**: Utiliza un layout de **3 columnas** (Cambios Activos | Dashboard | Histórico) para una visualización completa en una sola pantalla.
- **Puerto de Ejecución**: Configurado por defecto en el puerto **8000**.
- **Acceso**: Restringido a `127.0.0.1` para garantizar la privacidad de las simulaciones locales.
- **Visualización de Histórico**: Panel derecho dedicado para ver las versiones guardadas del escenario actual de forma inmediata.

---

## 🎮 MANUAL DE FUNCIONALIDADES (BOTONES)

### Sidebar / Top Nav (Navegación)
- **🏠 Escenario Base**: Resetea todas las modificaciones locales y carga la situación actual del Excel Maestro.
- **➕ Crear Escenario**: Captura el estado actual de la simulación y solicita un nombre para guardarlo.
- **📂 Gestionar**: Panel para visualizar, cargar o eliminar escenarios guardados en la BD local.
- **📊 Comparativa**: Selecciona dos escenarios para enfrentar sus KPIs en un dashboard dual.

### Filtros y Parámetros
- **Días Laborales**: Ajusta el calendario anual (ej: 238 días).
- **Turnos (Global/Granular)**: Permite configurar turnos generales para toda la planta o específicos por centro de trabajo (1T, 2T, 3T).
- **Seleccionar Centros**: Filtrado por máquinas para enfocar el análisis en secciones críticas.

### Desglose y "What-if Analysis"
- **Botón Ajustar (Tabla)**: Abre el modal de simulación de nivel de artículo:
  - **Nuevo Centro**: Simular el traslado de una referencia a otra máquina.
  - **OEE / PPM**: Evaluar el impacto de mejoras de eficiencia o velocidad.
  - **Ratio MOD**: Ajustar la dotación de personal necesaria.
  - **Setup (h)**: Modificar el tiempo de preparación anual.

---

## 🧠 LÓGICA DE NEGOCIO Y CÁLCULOS

### 1. Cálculo de Tiempos
- **Horas de Producción**: 
  $$Horas_{Producción} = \frac{Volumen \, Anual}{Piezas/Hora \times \%OEE}$$
- **Horas Hombre (MOD)**: 
  $$Horas_{Hombre} = (Horas_{Producción} \times Ratio_{MOD}) + Setup $$

### 2. Cálculo de Saturación
- **Capacidad Anual (H)**: 
  $$Capacidad = Días \, Laborales \times Horas \, Turno$$
- **% Saturación**: 
  $$Saturación = \frac{Horas_{Totales}}{Capacidad}$$

---

## 🚀 PROTOCOLO DE DESARROLLO (SOP)

1. **Validar**: `scripts/qa_scanner.py`
2. **Sincronizar**: `scripts/ops_sync.py "Mensaje"`

---
*Documento certificado por Antigravity APS - Sistema RPK v7.0*
