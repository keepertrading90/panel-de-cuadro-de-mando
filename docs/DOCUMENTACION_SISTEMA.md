# 🏭 SIMULADOR FLEJE_PRENSAS V3 | RPK v7.0 Industrial Documentation

## 📌 DESCRIPCIÓN GENERAL
El **Simulador Fleje_Prensas V3** es una herramienta analítica de alto rendimiento diseñada para la planificación estratégica de la producción en RPK. Permite realizar simulaciones dinámicas de carga de trabajo, saturación de centros y requerimientos de personal (MOD) basándose en un modelo de datos maestro industrial.

---

## 🛠️ ARQUITECTURA TÉCNICA (INFRAESTRUCTURA)

El sistema sigue el estándar RPK v7.0 "Zero-Trust" con una arquitectura desacoplada:

### 1. Backend (Core & API)
- **Framework**: FastAPI (Python 3.12+ Portable Runtime).
- **Motor de Datos**: `pandas` con sistema de **Caché Binaria (.pkl)** para acceso ultra-rápido (<0.1s) al Maestro Excel.
- **Servidor API**: Uvicorn configurado en puerto `5000` para acceso remoto LAN.
- **Base de Datos**: SQLite Local (`backend/db/simulador.db`) gestionada vía SQLAlchemy. Prohibido el uso de servicios Cloud según normativa RPK.

### 2. Frontend (UI/UX)
- **Tecnología**: Vanilla JavaScript, HTML5 semántico y CSS3 avanzado.
- **Diseño**: Dark Mode nativo con acentos en **RPK Red (#E30613)**.
- **Visualización**: Dashboard interactivo con filtrado dinámico y comparación de escenarios en tiempo real.

### 3. Sistema de Automatización (SOP)
- **QA Scanner**: Auditoría AST para validación de sintaxis y patrones industriales (`scripts/qa_scanner.py`).
- **Ops Sync**: Sistema de sincronización segura con GitHub y registro de cambios (`scripts/ops_sync.py`).

---

## 🧠 LÓGICA DE NEGOCIO Y CÁLCULOS

El simulador procesa la capacidad basada en las siguientes fórmulas maestras:

### 1. Cálculo de Tiempos
- **Horas de Producción**: 
  $$Horas_{Producción} = \frac{Volumen \, Anual}{Piezas/Hora \times \%OEE}$$
- **Horas Totales**: 
  $$Horas_{Totales} = Horas_{Producción} + Setup \, (h)$$
- **Horas Hombre (MOD)**: 
  $$Horas_{Hombre} = (Horas_{Producción} \times Ratio_{MOD}) + Setup \, (h)$$
  *Nota: El setup siempre tiene ratio 1.0 por definición técnica.*

### 2. Cálculo de Capacidad y Saturación
- **Capacidad Anual (H)**: 
  $$Capacidad = Días \, Laborales \times Horas \, Turno$$
- **% Saturación**: 
  $$Saturación = \frac{Horas_{Totales}}{Capacidad}$$

### 3. Gestión de Escenarios
El sistema permite crear "Scenarios" que son sobreescrituras (overrides) de la realidad base:
- Cambio de centro de trabajo (Cargar un artículo en otra máquina).
- Ajuste de demanda (Previsiones comerciales).
- Mejora de OEE o Cadencia (PPM).
- Ajuste de dotación (Ratio MOD).

---

## 📂 ESTRUCTURA DE ARCHIVOS CRÍTICOS

- `/backend/core/simulation_core.py`: Motor de cálculo y gestión de caché.
- `/backend/api/server.py`: Definición de endpoints y orquestación del servidor.
- `/backend/db/database.py`: Esquemas de persistencia de escenarios.
- `/frontend/ui/app.js`: Lógica de la interfaz y comunicación con API.
- `/MAESTRO FLEJE_v1.xlsx`: Origen de datos (SSOT - Single Source of Truth).

---

## 🚀 PROTOCOLO DE MANTENIMIENTO (SOP)

Para cualquier modificación en el código:
1. **Validar** con el scanner industrial:
   ```bash
   "Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe" scripts/qa_scanner.py
   ```
2. **Sincronizar** y cerrar tarea:
   ```bash
   "Y:\Supply Chain\PLAN PRODUCCION\PANEL\_SISTEMA\runtime_python\python.exe" scripts/ops_sync.py "Descripción del cambio"
   ```

---
*Documento generado automáticamente por Antigravity APS - Sistema RPK v7.0*
