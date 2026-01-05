# Strategy Brief: Rapid CI/CD for High-Velocity Track Testing

*Objective: Establish a sub-5-minute deployment loop for the "Gemini Racing Dashboard" (Streaming Update) to support real-time iteration during a live track day.*

## Constraints:
- Connectivity: Trackside internet (LTE/5G) is unreliable.
- Latency: Updates must be deployed while the car is pitting (approx. 10-15 mins).
- Safety: Untested code cannot be deployed to a moving vehicle.

## The Architecture: "Pit Lane Local Cloud"

To bypass public internet latency and bandwidth caps, we will establish a local "Pit Lane Cloud."
- The "Engineer Station" (Server): A high-performance laptop located in the pit box acting as the primary build server and local static host.
- The "Car Client" (Edge): The tablet or laptop inside the race car.
- The Link: A private, high-throughput WiFi 6 Router (Mesh) covering the pit lane. The car automatically connects when it enters the pits.

## The Deployment Workflow (The "Hot Lap" Loop)

This workflow is designed to execute safely within a standard pit stop window.

Code & Commit (The Engineer):
- Developers push changes to a local Git server on the Engineer Station.
- Constraint: No external npm installs. All dependencies must be vendored/cached pre-track.

Local Build (The Pipeline):
A local script builds the React bundle.
- Validation Gate (Crucial): The build is automatically opened in a headless browser running the v2.5 CSV Replay Mode.

Pass Criteria: If the dashboard renders and the "Gemini Squad" produces >3 logs from the CSV data without crashing, the build passes.

Sync to Car (The Deploy):
- Method: When the car pits and connects to WiFi, an rsync or local HMR (Hot Module Replacement) server pushes the new build bundle to the Car Client.
- Versioning: The new build is deployed to a .../next URL (e.g., 192.168.1.100:3000). The .../stable URL remains untouched as a fallback.

Pit Verification (The Driver Check):
- The Race Engineer opens the .../next URL on the car's device.
- They toggle "Start Sim" (Physics Simulation) for 5 seconds to verify the UI rendering and audio engine are functional.

Go/No-Go: If greenlit, the browser stays on this tab for the next run.

## Handling Real-Time Event Streams

Since the other team is adding live streaming (WebSocket/UDP), we must treat the data stream as a distinct dependency.

1. The "Virtual Streamer" (Mocking the Car)
- We cannot wait for the car to move to test if the stream works.
- Action: Create a Node.js script on the Engineer Station that reads the v2.5 track_telemetry_example.csv.
- Output: It broadcasts this CSV data over the local WiFi via WebSocket, mimicking the exact protocol of the real car hardware.
- Benefit: Developers can code against the "Live Stream" while the car is engine-off in the garage.

2. Failure Mode: "Data Fallback"
If the real-time stream fails (hardware issue), the app must degrade gracefully.
- Logic: If Stream_Connection_Lost > 2 seconds:
- Visual Alert: "TELEMETRY LOST - SWITCHING TO GPS".
- Fallback: The app automatically attempts to fallback to the internal GPS sensor (if available on the tablet) or simple accelerometer data to keep the "Hot Path" (Nano) alive.

## Safety & Rollback Protocol

The "Red Button" Rule:
If the new build glitches (e.g., UI freezes, Audio lag distracts driver):
- The driver or engineer hits a physical "Refresh" button or bookmark.
- The browser is hard-coded to default back to the .../stable URL (the morning's verified build).
- Logs: The glitchy session logs are saved to localStorage for post-run debrief analysis using the Gemini 3.0 "Debrief Mode" (to diagnose why it failed).

## Preparation Checklist (Pre-Track Day)

[ ] Dependency Freeze: npm ci and cache all node_modules offline.  
[ ] Data Pack: Ensure the RACING_PEDAGOGY vector DB is hardcoded/cached; do not rely on fetching it from a CMS.  
[ ] Hardware Mock: Ensure the "Virtual Streamer" script accurately replicates the exact JSON packet structure of the race car devices.  
