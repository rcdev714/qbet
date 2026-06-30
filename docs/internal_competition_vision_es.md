# Estrategia de Competición Interna: "Futuros Medidos"

**Visión**: Si se puede medir en el futuro, podemos crear un mercado.

## Resumen Ejecutivo

Este documento describe una aplicación estratégica de **Anymarkt** diseñada
específicamente para equipos de ventas de alto rendimiento. Aprovechando la
funcionalidad de grupos privados y mercados de apuestas internos, transformamos
las métricas de rendimiento estándar en competiciones atractivas y de alta
energía.

## El Concepto Central: "Respaldar tus palabras"

Los agentes de ventas prosperan con la competencia. Las tablas de clasificación
tradicionales son estáticas y a menudo pierden su poder de motivación a mitad de
mes. **Anymarkt** introduce una capa financiera dinámica y en tiempo real al
seguimiento del rendimiento.

### 1. El Mecanismo: Pools Mensuales Activos

En lugar de una estructura de bonificación pasiva, implementamos un modelo de
participación activa:

- **La Entrada (Buy-In)**: Un porcentaje establecido (por ejemplo, x%) se deduce
  de las comisiones o se aporta mensualmente a un **Fondo del Grupo** (Pool)
  localizado.
- **El Mercado**: Este fondo se convierte en la liquidez para las predicciones
  internas.
- **La Apuesta**: Los agentes no solo trabajan para alcanzar objetivos;
  _apuestan_ por ellos.
  - _"¿Llegará el equipo a $500k para el viernes?"_
  - _"¿Cerrará el Agente X el trato Enterprise?"_

### 2. Funcionalidad de Chat Grupal

La `GroupScreen` de la aplicación sirve como el "Piso de Ventas" digital:

- **Mercados Integrados**: Los mercados de predicción viven directamente dentro
  del flujo del chat, no en un panel separado.
- **Interacción en Tiempo Real**: Las apuestas activan notificaciones,
  impulsando la participación y la rivalidad amistosa.
- **Discreto y Seguro**: Los grupos son privados. Los datos y las conversaciones
  permanecen internos a la organización.

### 3. Impulsor Psicológico: Rendimiento y Energía

Este sistema alinea los incentivos de dos maneras:

1. **Rendimiento Directo**: Los ganadores de las métricas se llevan la mayor
   parte del fondo.
2. **Inteligencia de Mercado**: Los agentes que evalúan honestamente la realidad
   del piso (por ejemplo, apostando _en contra_ de un objetivo poco realista)
   proporcionan una señal valiosa a la gerencia.

## Estructura de Tarifas y Transparencia

Priorizamos un modelo económico transparente y justo (referenciado en
`TopUpScreen`):

- **Curva de Retiro Justa**: Utilizamos un algoritmo de curva suave para los
  retiros.
  - **Tarifas bajas para alto volumen**: El porcentaje disminuye a medida que
    aumenta el volumen (limitado entre 2% - 15%).
  - **Lógica**: `% Tarifa = 0.41 / Cantidad^0.44`. Esto asegura que los pequeños
    jugadores casuales no sean excluidos, mientras que los traders de altas
    apuestas (sus mejores agentes de ventas) conservan una mayor parte de sus
    ganancias.
- **Sin Costos Ocultos**: Las "deducciones" van al **Fondo**, no a la
  plataforma. La plataforma solo cobra una tarifa en el retiro, asegurando que
  la "casa" (el equipo) mantenga la mayoría del valor.

## Ruta de Implementación

1. **Configuración**: El gerente crea un Grupo Privado.
2. **Incorporación**: Los miembros del equipo se unen mediante Código de
   Invitación.
3. **Fondeo**: Los usuarios recargan (o asignan x%) a su billetera.
4. **Ejecución**: El gerente publica los mercados mensuales; comienza el juego.

## Estructura del Ecosistema Digital

```mermaid
graph TD
    subgraph Setup ["1. La Configuración"]
        M[Gerente] -->|Crea Grupo Privado| G[Grupo "Piso de Ventas"]
        A[Agentes de Ventas] -->|Unirse con Código| G
        A -->|Entrada %| P[(Liquidez del Fondo)]
    end

    subgraph Action ["2. La Acción"]
        M -->|Publica Objetivo| Q{Mercado de Predicción<br/>"¿Llegaremos a $500k?"}
        A -->|Apuestan al Resultado| Q
        Q -.->|Señal| I[Insight Gerencial<br/>"Sentimiento Real"]
    end

    subgraph Result ["3. El Resultado"]
        Q -->|Resolver| R[Resultado Real]
        R -->|Ganadores| W[$$$ Pago]
        W -->|Retiro| F[Tarifa <br/>(Reinvertida/Plataforma)]
    end

    style G fill:#f9f,stroke:#333,stroke-width:2px
    style P fill:#ff9,stroke:#333,stroke-width:2px
    style W fill:#9f9,stroke:#333,stroke-width:2px
```

---

_Impulsado por Anymarkt – Convirtiendo Métricas en Mercados._
