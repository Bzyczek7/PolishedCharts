# Specification: Advanced Indicator Support and Alerting

## 1. Overview
This track implements support for three advanced technical indicators: TDFI (Trend Direction Force Index), cRSI (cyclic Smoothed Relative Strength Index), and ADXVMA (Adaptive Moving Average). It includes backend logic for calculating these indicators, frontend components for rendering them, and a robust alerting system based on their signals. The implementation will also feature a "Layout" system, allowing users to save and switch between different indicator and chart configurations.

## 2. Functional Requirements

### 2.1. Backend
- **Indicator Calculation:**
  - Implement Python functions to calculate TDFI, cRSI, and ADXVMA based on OHLCV data.
  - These calculations should be efficient and integrated into a new or existing data processing service.
- **Alert Evaluation:**
  - Enhance the `AlertEngine` to support new alert conditions.
  - For cRSI, this includes a "band-cross" condition where an alert is triggered if the cRSI value crosses above its dynamic upper band or below its dynamic lower band. The evaluation must happen on candle close.
  - The engine must be able to handle these complex, stateful conditions.
- **Indicator Output Schema:**
  Each indicator must output structured data including:
  - Main series values (e.g., cRSI value, TDFI value, ADXVMA line)
  - Auxiliary series for alerts (e.g., cRSI upper/lower bands, TDFI filter levels)
  - Metadata for rendering (display type: overlay vs pane, color schemes, scale ranges)
  This enables the frontend to correctly position and style indicators without hardcoding display logic.

### 2.2. Frontend
- **Indicator Display:**
  - Oscillators (cRSI, TDFI) will be rendered in their own dedicated panes below the main price chart.
  - Overlay-type indicators (ADXVMA) will be plotted directly on the main price chart.
- **Layout Management System:**
  - Users can save the current configuration of indicators (including their parameters) and chart style (e.g., candles, line) as a named "Layout".
  - Users can easily switch between saved layouts.
  - When a user switches symbols (e.g., from IBM to AAPL), the currently active layout persists and is applied to the new symbol's chart.
- **UI Controls:**
  - The UI must provide intuitive controls within the layout management system to enable/disable indicators and adjust their parameters.

## 3. Non-Functional Requirements
- **Performance:** Indicator calculations should not significantly degrade backend performance. Frontend rendering must remain smooth and responsive.
- **Modularity:** The implementation of each indicator should be self-contained to allow for easy addition of new indicators in the future.
- **Data Integrity:** Alert conditions, especially dynamic ones like cRSI band-crosses, must be evaluated accurately on each new candle to prevent false signals.

## 4. Acceptance Criteria
- TDFI, cRSI, and ADXVMA can be calculated on the backend.
- cRSI, TDFI, and ADXVMA can be rendered correctly on the frontend chart in their respective panes/overlays, utilizing the structured output from the backend.
- Users can create, save, and apply different named layouts of indicator configurations.
- An alert can be successfully created for a cRSI band-cross and is triggered when the condition is met on a new candle.
- Switching between symbols preserves the active indicator layout.

## 5. Out of Scope
- Support for indicators other than TDFI, cRSI, and ADXVMA.
- User-defined custom indicator scripting (this is a future goal).
- Alert notifications via channels other than UI/log updates (e.g., email, SMS).
