# 🌐 RPK INDUSTRIAL ECOSYSTEM - MASTER INDEX

## Arquitectura Global
El sistema opera bajo una arquitectura de microservicios locales desacoplados, compartiendo un Bus de Datos basado en archivos (Excel/Pickle) en la red LAN.

## Mapa de Interacciones (Mermaid)
```mermaid
graph TD
    subgraph Data_Sources [Fuentes de Datos - Excel]
        ERP_Tiempos[Reportes Tiempos]
        ERP_Stock[Listado Existencias]
        Maestro_Fleje[MAESTRO FLEJE_v1.xlsx]
    end

    subgraph Processing_Core [Motores Python FastAPI]
        Engine_Tiempos(Tiempos Backend)
        Engine_Stock(Stock Backend)
        Engine_Sim(Simulador Core)
    end

    subgraph UI_Layer [Frontend Dark Mode #E30613]
        Dash_Tiempos[UI Tiempos]
        Dash_Stock[UI Stock]
        Dash_Sim[UI Simulador]
    end

    ERP_Tiempos --> Engine_Tiempos --> Dash_Tiempos
    ERP_Stock --> Engine_Stock --> Dash_Stock
    Maestro_Fleje --> Engine_Sim --> Dash_Sim
    
    %% Propuesta Antigravity: Flujos Cruzados
    Engine_Stock -.->|Disponibilidad MP| Engine_Sim
    Engine_Tiempos -.->|Saturación Real| Engine_Sim