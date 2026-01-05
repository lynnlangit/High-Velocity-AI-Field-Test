# High-Velocity-AI-Field-Test
Gemini at the Race Track

## Gemini Racing Dashboard: v2.5 Architecture Summary

Project: High-Velocity AI Field Test // "The Data Crucible"
Status: v2.5 - The Learning Loop & Dynamic Physics

This summary outlines the evolution of the Gemini Racing Dashboard into a complete "Digital Twin." The project validates the capability of Gemini 2.5 Flash and a simulated Edge TPU (Gemini Nano) to function as a cohesive, real-time coaching team ("The Squad") in a high-stakes environment.

<img src="https://github.com/lynnlangit/High-Velocity-AI-Field-Test/blob/main/squad.png" width=600>

### Architectural Design: The "Squad" Pattern

To solve the conflict between "Instant Reaction" and "Deep Reasoning," we utilized a hybrid multi-agent system.

The Hybrid Pipeline (Hot vs. Warm Paths)
- Path / Agent/Model / Latency / Role

🔥 Hot Path

- NANO (Edge TPU) < 10ms
- Reflexive Safety: Runs locally (mocked logic). Detects high-frequency events (e.g., "Max Grip," "Threshold Limit") at 20Hz. Triggers visual-only alerts to maintain audio clarity.

❄️ Warm Path

- GEMINI (Cloud) ~1.5s
- Cognitive Strategy: Runs in the cloud. Fuses telemetry streams to generate context-aware advice. Routes output to specific "Squad" personas (AJ, Ross, Gemini).

### Squad Dynamics & Expert Memory

We moved beyond generic AI by implementing a Pedagogical Vector Retrieval pattern.

#### The "Pedagogy" Vector DB (Context Injection)

We injected a lightweight "Expert Memory" directly into the system prompt (RACING_PEDAGOGY).
- Mechanism: The AI matches live telemetry patterns (e.g., Early Apex) to specific vector keys ("virtual_trigger": "lat_g_drop_early"), ensuring advice is grounded in professional racing theory.

#### Dynamic Physics Inference
- Problem: Raw telemetry CSVs often lack specific vehicle states (like Gear).
- Solution: We implemented physics-based inference logic in the frontend. The system now calculates the Gear dynamically by analyzing the ratio between RPM and Speed ($Ratio = RPM / Speed$), allowing accurate replay analysis even with incomplete datasets.

### Cognitive Load Optimization (Safety Mode)

- v2.5 introduced strict protocols to manage driver attention.
- Audio De-cluttering & Unified Voice
- Unified Protocol: A single, clear voice profile is used for all agents to prevent cognitive dissonance. Personas are distinguished only by subtle shifts in pitch and rate (AJ = Faster/Higher, Ross = Slower/Deeper).
- Safety Buffer: A 3-second refractory period enforces silence between non-critical messages.
- Priority Queue: Only "High Priority" safety warnings (Red Alerts) can interrupt the buffer.

### The Learning Loop: Post-Run Debrief

- We added a "Third Loop" to the architecture to support post-action analysis.
- Trigger: Stopping the simulation or finishing a CSV replay.
- Process: The system aggregates the session's audio logs and telemetry statistics (Max Speed, Avg Speed).
- Synthesis: It sends this aggregate context back to Gemini 3.0 to generate a structured "Race Engineer Report," providing a Driver Score (0-100), a Verdict, and a specific Action Plan based on the pedagogy.

### Final Prototype: The "Digital Twin"

The application now serves as a full-lifecycle tool:  
- Ingest: CSV replay or Physics Simulation.
- Monitor: Real-time Squad analysis (Hot/Warm paths).
- Improve: Automated post-run debriefing.

This architecture demonstrates a reusable blueprint for "Trustable AI" in professional domains  . 
By combining real-time safety filters (Hot Path) with deep retrospective analysis (Learning Loop), the system provides value both during and after the event.

<img src="https://github.com/lynnlangit/High-Velocity-AI-Field-Test/blob/main/POC-arch.png">
