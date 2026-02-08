# High Velocity AI Field Test - v2

## Overview
**v2** represents a next-step refactor of the original prototype. The focus has shifted from "proof of concept" to **safety, clarity, and latency**.

## Key Updates (vs v1)

### 1. Architecture & Refactoring
*   **Separation of Concerns**: The monolithic codebase has been split.
    *   `highVelocityDashboard.jsx`: Handles UI rendering, state, and audio synthesis.
    *   `raceEngineer.js`: **[NEW]** specialized module containing all AI prompts, pedagogy, and API integration logic.
*   **Robust Error Handling**: Added "Mock Mode" fallbacks. If the API key is missing or network fails, a local simulation engine takes over to ensure the demo never crashes.

### 2. AI Model Upgrades
*   **Live Coaching**: Now powered by **Gemini 2.0 Flash (001)**. Reduced latency allows for sub-second responses to telemetry events.
*   **Post-Race Debrief**: Now powered by **Gemini 2.5 Pro**. Generates deep, structured analysis with specific root-cause identification and actionable steps.

### 3. Audio & Personas
*   **Safety-First Queue**: Implemented a priority buffer. Critical alerts (e.g., "BRAKE") bypass the queue, while routine coaching waits for a 3-second clear channel to reduce driver cognitive load.
*   **Distinct Voices**:
    *   **AJ (Crew Chief)**: Locked to **US English Male** (Commanding).
    *   **Ross (Telemetry)**: Locked to **UK English Male** (Technical).
    *   **Nano (Safety)**: Fast, robotic alerts.
    *   **Gemini (Reasoning)**: **Silent**. Visible in logs only.

### 4. UI Overhaul
*   **Light Theme**: Switched from dark mode to a high-contrast **Slate/White** professional aesthetic for better daylight readability.
*   **Enhanced Debrief**: Redesigned the post-race modal to be larger (5XL) and use **Emojis & Lists** for instant scanability of the "Action Plan".
*   **Visual Polish**: Updated G-Force meters, telemetry bars, and status indicators to match the new design system.

## Setup
1.  `cd v2`
2.  `npm install`
3.  `npm run dev`
