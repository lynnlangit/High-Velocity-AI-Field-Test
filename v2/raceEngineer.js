
// --- Expert Knowledge Base (Pedagogy Vector DB) ---
export const RACING_PEDAGOGY = [
    { "id": "NOV_01", "level": "Novice", "concept": "Track Usage", "symptom": "Pinching the exit, narrow radius", "virtual_trigger": "lat_g_drop_early", "advice": "Use all the track. You are pinching the exit. Unwind the wheel and let the car run free to the curb." },
    { "id": "NOV_02", "level": "Novice", "concept": "Vision", "symptom": "Jerky steering inputs, reactive corrections", "virtual_trigger": "high_heading_variance", "advice": "Eyes up. You are reacting to the pavement in front of you. Look for the exit before you even turn in." },
    { "id": "NOV_03", "level": "Novice", "concept": "Braking Zone Definition", "symptom": "Coasting before braking or braking too early", "virtual_trigger": "long_g_gradual_onset", "advice": "Trust your landmarks. Don't coast. Wait for the marker, then transition instantly from gas to brake." },
    { "id": "NOV_04", "level": "Novice", "concept": "Threshold Braking", "symptom": "Insufficient deceleration force", "virtual_trigger": "peak_long_g_low", "advice": "Hit the pedal harder. You are only using 60% of the braking capacity. Compress the nose immediately." },
    { "id": "NOV_05", "level": "Novice", "concept": "Awareness", "symptom": "Blocking faster traffic", "virtual_trigger": "time_delta_loss_on_straight", "advice": "Check your mirrors. If a car is pressing, stay on line, lift on the straight, and give a clear point-by." },
    { "id": "INT_01", "level": "Intermediate", "concept": "Braking Efficiency", "symptom": "Long braking distance, slow ramp up", "virtual_trigger": "braking_slope_lazy", "advice": "Shorten the braking zone. Attack the pedal faster to reach peak G-force instantly, then trail off." },
    { "id": "INT_02", "level": "Intermediate", "concept": "Minimum Speed (Pace)", "symptom": "Overslowing at entry", "virtual_trigger": "apex_velocity_low", "advice": "Roll more speed. You are overslowing the entry. Trust the grip and carry 5 more mph to the apex." },
    { "id": "INT_03", "level": "Intermediate", "concept": "Consistency", "symptom": "High variance in sector times", "virtual_trigger": "sector_variance_high", "advice": "Settle down. Stop experimenting with the line. Hit the same marks three laps in a row before pushing harder." },
    { "id": "INT_04", "level": "Intermediate", "concept": "Slip Angle", "symptom": "Front tire scrub (Understeer)", "virtual_trigger": "yaw_rate_lower_than_curvature", "advice": "You are scrubbing the front tires. Trail brake slightly to pin the nose and help the car rotate." },
    { "id": "INT_05", "level": "Intermediate", "concept": "Traffic Management", "symptom": "Stuck in dirty air/traffic", "virtual_trigger": "consistent_low_speed_with_variance", "advice": "Don't get stuck in their rhythm. Back off to create a gap for a clean lap, or set up a late-brake pass." }
];

// --- Mock Generation Logic ---
const generateMockGeminiMessage = (currentData) => {
    // Triggers relaxed to ensure AJ/Ross speak during simulation (Speed range: 80-160, Brake max: 40)
    if (currentData.speed > 135) {
        return { agent: "AJ", role: "CREW CHIEF", msg: "Good pace. Keep the momentum up.", priority: "normal" };
    } else if (Math.abs(currentData.gLat) > 1.1) {
        return { agent: "ROSS", role: "TELEMETRY", msg: "High lateral load detected. Smooth inputs.", priority: "normal" };
    } else if (currentData.brake > 30) {
        return { agent: "AJ", role: "CREW CHIEF", msg: "Braking zone. Compress the pedal.", priority: "high" };
    } else {
        return null;
    }
};

const generateMockDebrief = () => {
    return {
        score: Math.floor(85 + Math.random() * 10),
        verdict: "Strong pace, but consistency needs work in Sector 2.",
        primary_issue: "Braking Efficiency",
        coaching_tip: "You are over-slowing at Turn 1. Trust the aero and carry 5mph more to the apex."
    };
};

// --- Live Coaching API ---
export const getGeminiCoaching = async (telemetry, apiKey) => {
    // 1. Mock Fallback Check
    if (!apiKey) {
        await new Promise(r => setTimeout(r, 800)); // Simulate latency
        return generateMockGeminiMessage(telemetry);
    }

    // 2. Prepare Prompt
    const systemPrompt = `
      You are the "Antigravity Squad", an AI coaching system for high-speed racing.
      
      *** EXPERT KNOWLEDGE BASE (PEDAGOGY) ***
      Use the following specific coaching concepts to ground your advice. If telemetry matches a "virtual_trigger" or "symptom", use the exact "advice" provided in this JSON:
      ${JSON.stringify(RACING_PEDAGOGY)}
      ****************************************

      Select ONE persona to speak based on the telemetry:
      1. AJ (Role: CREW CHIEF): Aggressive, strategic. Uses the PEDAGOGY to correct driving lines and habits.
      2. ROSS (Role: TELEMETRY): Technical, calm. Reports on physics (G-force, tires).
      3. GEMINI (Role: CORE): Analytical. Synthesizes data.

      Input Telemetry: Speed (MPH), RPM, G-Force (Lateral).
      
      Output ONLY a raw JSON object (no markdown) with these keys:
      - "agent": "AJ", "ROSS", or "GEMINI"
      - "role": "CREW CHIEF", "TELEMETRY", or "CORE"
      - "msg": A short (under 10 words) coaching command or observation. Prioritize Pedagogy advice if applicable.
      - "priority": "normal" or "high"
    `;

    const userPrompt = `Telemetry: Speed ${Math.round(telemetry.speed)} MPH, RPM ${Math.round(telemetry.rpm)}, Lateral G ${telemetry.gLat.toFixed(2)}.`;

    // 3. Call API with Timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    try {
        console.log("Calling Gemini API with key length:", apiKey.length);
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: userPrompt }] }],
                    systemInstruction: { parts: [{ text: systemPrompt }] },
                    generationConfig: { responseMimeType: "application/json" }
                }),
                signal: controller.signal
            }
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (resultText) {
            return JSON.parse(resultText);
        }
    } catch (error) {
        console.error("Gemini API Error in getGeminiCoaching:", error);

        // Fallback logic on error
        const isAuthOrNotFoundError = error.message.includes("404") || error.message.includes("400") || error.message.includes("403");

        // Return a system warning if it's a connection issue (not auth)
        if (!isAuthOrNotFoundError && error.name !== 'AbortError') {
            // Return special object to indicate system warning
            return {
                agent: "SYSTEM",
                role: "WARNING",
                msg: "Connection unstable. Switching to cached pedagogy.",
                priority: "normal"
            };
        }

        // Otherwise return mock message
        return generateMockGeminiMessage(telemetry);
    }

    return null;
};

// --- Post-Race Debrief API ---
export const getSessionDebrief = async (logs, speedHistory, apiKey) => {
    // 1. Mock Fallback Check
    if (!apiKey) {
        await new Promise(r => setTimeout(r, 1500));
        return generateMockDebrief();
    }

    // 2. Aggregating session data
    const sessionLogs = logs.slice(0, 15).map(l => `[${l.agent}] ${l.msg}`).join('\n');
    const maxSpeed = Math.max(...speedHistory, 0);
    const avgSpeed = speedHistory.length ? (speedHistory.reduce((a, b) => a + b, 0) / speedHistory.length) : 0;

    // 3. Prepare Prompt
    const debriefPrompt = `
      ACT AS: Lead Race Engineer (AJ).
      TASK: Analyze the telemetry logs from the last session and provide a DETAILED, HIGH-LEVEL POST-RUN DEBRIEF.
      
      SESSION STATS:
      Max Speed: ${maxSpeed.toFixed(0)} MPH
      Avg Speed: ${avgSpeed.toFixed(0)} MPH
      
      DRIVER LOGS (Audio Transcripts):
      ${sessionLogs}
      
      REFERENCE PEDAGOGY:
      ${JSON.stringify(RACING_PEDAGOGY)}
      
      REQUIREMENTS:
      1. Analyze the driver's consistency and aggression.
      2. Identify the ROOT CAUSE of the primary issue (not just the symptom).
      3. Provide 3 SPECIFIC, ACTIONABLE steps to improve on the next lap.
      
      OUTPUT JSON ONLY:
      {
        "score": 0-100 (integer),
        "verdict": "One sentence summary of performance.",
        "primary_issue": "The main technical flaw (e.g. 'Late Braking at Turn 1')",
        "coaching_tip": "Detailed action plan: 1. Landmark identification. 2. Pedal application technique. 3. Exit vision."
      }
    `;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: debriefPrompt }] }],
                    generationConfig: { responseMimeType: "application/json" }
                }),
            }
        );

        if (!response.ok) throw new Error("Debrief API Error");

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (resultText) {
            return JSON.parse(resultText);
        }
    } catch (error) {
        console.error("Debrief Error in getSessionDebrief:", error);
        return {
            score: 0,
            verdict: "Data analysis failed.",
            primary_issue: "Connection Error",
            coaching_tip: "Please check network connection and try again."
        };
    }
    return null;
};

// --- Nano (Edge TPU) Logic ---
export const getNanoEvents = (telemetry) => {
    const t = telemetry;
    const events = [];

    // Key Driving Events triggers
    if (t.gLat > 1.3) events.push("APEX_ENTRY: HIGH_LOAD");
    if (t.gLat < -1.3) events.push("CORNER_EXIT: MAX_GRIP");
    if (t.brake > 85) events.push("BRAKING: THRESHOLD_LIMIT");
    if (t.throttle > 98 && t.speed > 140) events.push("STRAIGHT: VMAX_PEAK");
    if (t.rpm > 7800) events.push("ENGINE: SHIFT_POINT");
    if (Math.random() > 0.9) events.push("OPPORTUNITY: TRUE_APEX_MISSED");
    if (Math.random() > 0.95) events.push("SECTOR_1: PERSONAL_BEST");

    if (events.length > 0 && Math.random() > 0.7) {
        const eventMsg = events[Math.floor(Math.random() * events.length)];
        return {
            agent: "NANO",
            role: "EDGE_TPU",
            msg: eventMsg,
            priority: "normal" // Nano is almost always normal priority (visual info)
        };
    }
    return null;
};
