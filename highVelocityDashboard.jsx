import React, { useState, useEffect, useRef } from 'react';
import { Activity, Wifi, Cpu, AlertTriangle, Play, Pause, Database, Eye, Terminal, Zap, MessageSquare, Microchip, Upload, Volume2, VolumeX, X, FileText, ClipboardList } from 'lucide-react';

// --- Expert Knowledge Base (Pedagogy Vector DB) ---
const RACING_PEDAGOGY = [
  {"id": "NOV_01", "level": "Novice", "concept": "Track Usage", "symptom": "Pinching the exit, narrow radius", "virtual_trigger": "lat_g_drop_early", "advice": "Use all the track. You are pinching the exit. Unwind the wheel and let the car run free to the curb."},
  {"id": "NOV_02", "level": "Novice", "concept": "Vision", "symptom": "Jerky steering inputs, reactive corrections", "virtual_trigger": "high_heading_variance", "advice": "Eyes up. You are reacting to the pavement in front of you. Look for the exit before you even turn in."},
  {"id": "NOV_03", "level": "Novice", "concept": "Braking Zone Definition", "symptom": "Coasting before braking or braking too early", "virtual_trigger": "long_g_gradual_onset", "advice": "Trust your landmarks. Don't coast. Wait for the marker, then transition instantly from gas to brake."},
  {"id": "NOV_04", "level": "Novice", "concept": "Threshold Braking", "symptom": "Insufficient deceleration force", "virtual_trigger": "peak_long_g_low", "advice": "Hit the pedal harder. You are only using 60% of the braking capacity. Compress the nose immediately."},
  {"id": "NOV_05", "level": "Novice", "concept": "Awareness", "symptom": "Blocking faster traffic", "virtual_trigger": "time_delta_loss_on_straight", "advice": "Check your mirrors. If a car is pressing, stay on line, lift on the straight, and give a clear point-by."},
  {"id": "INT_01", "level": "Intermediate", "concept": "Braking Efficiency", "symptom": "Long braking distance, slow ramp up", "virtual_trigger": "braking_slope_lazy", "advice": "Shorten the braking zone. Attack the pedal faster to reach peak G-force instantly, then trail off."},
  {"id": "INT_02", "level": "Intermediate", "concept": "Minimum Speed (Pace)", "symptom": "Overslowing at entry", "virtual_trigger": "apex_velocity_low", "advice": "Roll more speed. You are overslowing the entry. Trust the grip and carry 5 more mph to the apex."},
  {"id": "INT_03", "level": "Intermediate", "concept": "Consistency", "symptom": "High variance in sector times", "virtual_trigger": "sector_variance_high", "advice": "Settle down. Stop experimenting with the line. Hit the same marks three laps in a row before pushing harder."},
  {"id": "INT_04", "level": "Intermediate", "concept": "Slip Angle", "symptom": "Front tire scrub (Understeer)", "virtual_trigger": "yaw_rate_lower_than_curvature", "advice": "You are scrubbing the front tires. Trail brake slightly to pin the nose and help the car rotate."},
  {"id": "INT_05", "level": "Intermediate", "concept": "Traffic Management", "symptom": "Stuck in dirty air/traffic", "virtual_trigger": "consistent_low_speed_with_variance", "advice": "Don't get stuck in their rhythm. Back off to create a gap for a clean lap, or set up a late-brake pass."}
];

// --- Components ---

const StatusIndicator = ({ label, status, value }) => (
  <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded border border-gray-800 h-full">
    <span className="text-xs text-gray-400 font-mono uppercase">{label}</span>
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold font-mono ${status === 'active' ? 'text-green-400' : 'text-amber-400'}`}>
        {value || status.toUpperCase()}
      </span>
      <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-green-500 animate-pulse' : 'bg-amber-500'}`} />
    </div>
  </div>
);

// Resized G-Force Meter (Smaller - w-40)
const GForceMeter = ({ x, y }) => (
  <div className="relative w-40 h-40 bg-gray-900 rounded-full border border-gray-700 flex items-center justify-center transition-all duration-300">
    {/* Grid rings */}
    <div className="absolute w-32 h-32 rounded-full border border-gray-800 opacity-50" />
    <div className="absolute w-16 h-16 rounded-full border border-gray-800 opacity-50" />
    <div className="absolute w-[1px] h-full bg-gray-800" />
    <div className="absolute h-[1px] w-full bg-gray-800" />
    
    {/* The Dot */}
    <div 
      className="absolute w-4 h-4 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)] transition-all duration-75 ease-linear"
      style={{ 
        transform: `translate(${x * 50}px, ${y * -50}px)` 
      }}
    />
    <span className="absolute bottom-2 text-[10px] text-gray-500 font-mono">1.5G</span>
  </div>
);

// Resized Telemetry Bar (Larger Container in parent)
const TelemetryBar = ({ label, value, max, color = "bg-blue-500" }) => (
  <div className="flex flex-col gap-2 w-full">
    <div className="flex justify-between text-base font-mono text-gray-400 uppercase">
      <span>{label}</span>
      <span className="pl-4">{Math.round(value)}%</span>
    </div>
    {/* Transparent background for cleaner UI */}
    <div className="h-6 w-full bg-gray-700/20 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} transition-all duration-75 ease-out`} 
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  </div>
);

// --- Main Application ---

export default function HighVelocityDashboard() {
  const [isRunning, setIsRunning] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  
  // Data State
  const [telemetry, setTelemetry] = useState({
    speed: 0,
    rpm: 0,
    throttle: 0,
    brake: 0,
    gLat: 0,
    gLong: 0,
    gear: 'N'
  });

  // Track the last 40 speed points for the graph
  const [speedHistory, setSpeedHistory] = useState(new Array(40).fill(0));
  const [logs, setLogs] = useState([]);
  const [latency, setLatency] = useState(24);
  const [isApiProcessing, setIsApiProcessing] = useState(false);
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  
  // Debrief State
  const [showDebrief, setShowDebrief] = useState(false);
  const [debriefReport, setDebriefReport] = useState(null);
  const [isDebriefLoading, setIsDebriefLoading] = useState(false);

  // Replay State
  const [replayData, setReplayData] = useState(null); // Array of telemetry objects
  const [replayIndex, setReplayIndex] = useState(0);
  const fileInputRef = useRef(null);

  // Simulation Refs
  const simInterval = useRef(null);
  const logInterval = useRef(null);
  const nanoInterval = useRef(null);
  
  // IMPORTANT: Stores the current telemetry for the API interval to access without dependencies
  const telemetryRef = useRef(telemetry); 
  // Stores audio state for interval access
  const audioEnabledRef = useRef(isAudioEnabled);
  // Stores last speech time for debouncing/safety
  const lastSpeechTimeRef = useRef(0);

  // Update refs when state changes
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    audioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  // --- Voice Synthesis Logic (Safety Optimized) ---
  
  const speak = (text, agent, priority) => {
    // 1. Basic check: Is audio on?
    if (!audioEnabledRef.current || !window.speechSynthesis) return;

    const now = Date.now();
    const timeSinceLastSpeech = now - lastSpeechTimeRef.current;
    
    // 2. Safety Buffer: Don't speak if we just spoke < 3 seconds ago, UNLESS it's high priority
    // This reduces cognitive load on the "driver"
    const safetyBuffer = 3000; 
    if (timeSinceLastSpeech < safetyBuffer && priority !== 'high') {
        return; 
    }

    // 3. Nano Mute: NANO/EDGE_TPU messages are high frequency and visual only, unless critical
    if (agent === 'NANO' && priority !== 'high') {
        return;
    }

    // Cancel any pending chatter to ensure this message comes through clearly immediately
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();

    // 4. Voice Consistency: Use a SINGLE, clear voice for all agents to avoid "chaotic" feeling.
    // We only vary rate/pitch slightly to distinguish personas.
    // Prefer "Google US English" or default system voice.
    let selectedVoice = voices.find(v => v.name.includes('Google US English')) || 
                        voices.find(v => v.lang.includes('en-US')) || 
                        voices[0];
    
    // Persona Tuning (Subtle)
    if (agent === 'AJ') {
        utterance.rate = 1.15; // Slightly faster, commanding
        utterance.pitch = 1.05; 
    } else if (agent === 'ROSS') {
        utterance.rate = 0.95; // Slower, technical
        utterance.pitch = 0.95; 
    } else if (agent === 'GEMINI') {
        utterance.rate = 1.0; // Standard, robotic
        utterance.pitch = 1.0;
    } else if (agent === 'NANO') {
        utterance.rate = 1.3; // Fast alerts
        utterance.pitch = 1.1;
    }

    if (selectedVoice) utterance.voice = selectedVoice;
    
    window.speechSynthesis.speak(utterance);
    lastSpeechTimeRef.current = now;
  };

  // Ensure voices are loaded (Chrome requirement)
  useEffect(() => {
    const loadVoices = () => { window.speechSynthesis.getVoices(); };
    window.speechSynthesis.onvoiceschanged = loadVoices;
    loadVoices();
  }, []);

  const toggleAudio = () => {
    const newState = !isAudioEnabled;
    setIsAudioEnabled(newState);
    // Explicitly resume audio context if browser suspended it
    if (newState && window.speechSynthesis) {
        window.speechSynthesis.resume();
        // A silent utterance can help "unlock" audio on some mobile browsers
        const utterance = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(utterance);
    } else {
        window.speechSynthesis.cancel();
    }
  };

  const testAudio = () => {
    if (!isAudioEnabled) return;
    speak("Audio check. Systems nominal.", "AJ", "high");
  };


  // --- API Logic (Gemini 2.5 Cloud + RAG) ---

  const fetchGeminiGuidance = async () => {
    if (isApiProcessing) return;
    setIsApiProcessing(true);

    const apiKey = ""; // Injected by environment
    const currentData = telemetryRef.current;

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

    const userPrompt = `Telemetry: Speed ${Math.round(currentData.speed)} MPH, RPM ${Math.round(currentData.rpm)}, Lateral G ${currentData.gLat.toFixed(2)}.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: userPrompt }] }],
            systemInstruction: { parts: [{ text: systemPrompt }] },
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );

      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (resultText) {
        const parsed = JSON.parse(resultText);
        addLog(parsed);
      }
    } catch (error) {
      console.error("Gemini API Error:", error);
      // Fallback for demo continuity if API fails/limits
      addLog({ 
        agent: "SYSTEM", 
        role: "ERROR", 
        msg: "Connection interrupted. Retrying...", 
        priority: "high" 
      });
    } finally {
      setIsApiProcessing(false);
    }
  };

  const generateSessionDebrief = async () => {
    setIsDebriefLoading(true);
    setShowDebrief(true);

    const apiKey = ""; // Injected by environment
    
    // Aggregating session data for prompt
    const sessionLogs = logs.slice(0, 15).map(l => `[${l.agent}] ${l.msg}`).join('\n');
    const maxSpeed = Math.max(...speedHistory, 0);
    const avgSpeed = speedHistory.length ? (speedHistory.reduce((a,b)=>a+b,0) / speedHistory.length) : 0;

    const debriefPrompt = `
      ACT AS: Lead Race Engineer (AJ).
      TASK: Analyze the telemetry logs from the last session and provide a POST-RUN DEBRIEF using Gemini 3.0 capabilities.
      
      SESSION STATS:
      Max Speed: ${maxSpeed.toFixed(0)} MPH
      Avg Speed: ${avgSpeed.toFixed(0)} MPH
      
      DRIVER LOGS (Audio Transcripts):
      ${sessionLogs}
      
      REFERENCE PEDAGOGY:
      ${JSON.stringify(RACING_PEDAGOGY)}
      
      OUTPUT JSON ONLY:
      {
        "score": 0-100 (integer),
        "verdict": "Short summary of performance (max 15 words)",
        "primary_issue": "The main pedagogy concept to work on (e.g. 'Braking Efficiency')",
        "coaching_tip": "Specific, actionable advice for the next run based on the primary issue."
      }
    `;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: debriefPrompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          }),
        }
      );

      const data = await response.json();
      const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      
      if (resultText) {
        setDebriefReport(JSON.parse(resultText));
      }
    } catch (error) {
      console.error("Debrief Error:", error);
      setDebriefReport({
          score: 0,
          verdict: "Data analysis failed.",
          primary_issue: "Connection Error",
          coaching_tip: "Please check network connection and try again."
      });
    } finally {
      setIsDebriefLoading(false);
    }
  };

  // --- Gemini Nano (Mocked Local Edge) ---
  const runGeminiNanoHotCall = () => {
      const t = telemetryRef.current;
      const events = [];

      // Logic derived from "Garmin Device Manual" context (Key Driving Events)
      if (t.gLat > 1.3) events.push("APEX_ENTRY: HIGH_LOAD");
      if (t.gLat < -1.3) events.push("CORNER_EXIT: MAX_GRIP");
      if (t.brake > 85) events.push("BRAKING: THRESHOLD_LIMIT");
      if (t.throttle > 98 && t.speed > 140) events.push("STRAIGHT: VMAX_PEAK");
      if (t.rpm > 7800) events.push("ENGINE: SHIFT_POINT");
      if (Math.random() > 0.9) events.push("OPPORTUNITY: TRUE_APEX_MISSED"); 
      if (Math.random() > 0.95) events.push("SECTOR_1: PERSONAL_BEST");

      if (events.length > 0 && Math.random() > 0.7) {
          const eventMsg = events[Math.floor(Math.random() * events.length)];
          addLog({
              agent: "NANO",
              role: "EDGE_TPU",
              msg: eventMsg,
              priority: "normal" // Nano is almost always normal priority (visual info)
          });
      }
  };

  const addLog = (data) => {
    // 1. Speak the message (if audio enabled and meets safety criteria)
    speak(data.msg, data.agent, data.priority);

    // 2. Add to visual log
    let styles = {
        agent: data.agent,
        role: data.role,
        msg: data.msg,
        color: 'text-gray-400',
        border: 'border-gray-600',
        bg: 'bg-gray-900/50'
    };

    if (data.agent === 'AJ') {
        styles.color = 'text-purple-400';
        styles.border = 'border-purple-500';
        styles.bg = 'bg-purple-900/20';
    } else if (data.agent === 'ROSS') {
        styles.color = 'text-blue-400';
        styles.border = 'border-blue-500';
        styles.bg = 'bg-blue-900/20';
    } else if (data.agent === 'GEMINI') {
        styles.color = 'text-yellow-400';
        styles.border = 'border-yellow-500';
        styles.bg = 'bg-yellow-900/10';
    } else if (data.agent === 'NANO') {
        styles.color = 'text-emerald-400';
        styles.border = 'border-emerald-500';
        styles.bg = 'bg-emerald-900/20';
    } else if (data.agent === 'SYSTEM') {
        styles.color = 'text-gray-400';
        styles.border = 'border-gray-600';
        styles.bg = 'bg-gray-900/50';
    }

    if (data.priority === 'high') {
         styles.border = 'border-red-500';
         styles.bg = 'bg-red-900/20';
         styles.color = 'text-red-400';
    }

    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    setLogs(prev => [{ ...styles, time: timestamp }, ...prev].slice(0, 10)); 
  };

  // --- Helper: Dynamic Gear Calculation ---
  const calculateEstimatedGear = (speed, rpm) => {
    if (speed < 1 || rpm < 800) return 'N';
    const ratio = rpm / speed;
    if (ratio > 150) return '1';
    if (ratio > 110) return '2';
    if (ratio > 80) return '3';
    if (ratio > 60) return '4';
    if (ratio > 45) return '5';
    return '6';
  };

  // --- CSV Ingestion Logic ---
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const rows = text.split('\n');
      const headers = rows[0].split(',').map(h => h.trim().toLowerCase());
      
      const parsedData = rows.slice(1).map(row => {
          const vals = row.split(',');
          if (vals.length < headers.length) return null;
          
          const speedIdx = headers.findIndex(h => h.includes('speed'));
          const rpmIdx = headers.findIndex(h => h.includes('rpm'));
          const throttleIdx = headers.findIndex(h => h.includes('throttle'));
          const brakeIdx = headers.findIndex(h => h.includes('brake'));
          const gLatIdx = headers.findIndex(h => h.includes('lat') && h.includes('g'));
          
          const speed = speedIdx > -1 ? parseFloat(vals[speedIdx]) : 0;
          const rpm = rpmIdx > -1 ? parseFloat(vals[rpmIdx]) : 0;

          const gear = calculateEstimatedGear(speed, rpm);

          return {
            speed: speed,
            rpm: rpm,
            throttle: throttleIdx > -1 ? parseFloat(vals[throttleIdx]) : 0,
            brake: brakeIdx > -1 ? parseFloat(vals[brakeIdx]) : 0,
            gLat: gLatIdx > -1 ? parseFloat(vals[gLatIdx]) : 0,
            gLong: 0,
            gear: gear
          };
      }).filter(Boolean);

      if (parsedData.length > 0) {
        setReplayData(parsedData);
        setReplayIndex(0);
        addLog({ agent: "SYSTEM", role: "INGEST", msg: `CSV Loaded: ${parsedData.length} frames ready.`, priority: "normal" });
      } else {
        addLog({ agent: "SYSTEM", role: "ERROR", msg: "Failed to parse CSV. Check format.", priority: "high" });
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // reset input
  };

  // --- Simulation/Replay Loop ---

  const generateTelemetry = () => {
    let newData;

    if (replayData && replayIndex < replayData.length) {
       // REPLAY MODE
       newData = replayData[replayIndex];
       setReplayIndex(prev => (prev + 1) % replayData.length); // Loop replay
    } else {
       // SIMULATION MODE
       const t = Date.now() / 1000;
       
       const throttleInput = (Math.sin(t) + 1) * 50; 
       const brakeInput = (Math.cos(t + 2) + 1) * 20;
       const newSpeed = Math.max(0, 120 + Math.sin(t * 0.5) * 40 + (Math.random() * 2));
       const newRpm = Math.max(800, 4000 + Math.sin(t * 0.5) * 3000);
       const newGLat = Math.sin(t * 0.8) * 1.5;
       const newGear = calculateEstimatedGear(newSpeed, newRpm);

       newData = {
          speed: newSpeed,
          rpm: newRpm,
          throttle: throttleInput,
          brake: brakeInput,
          gLat: newGLat,
          gLong: Math.cos(t * 0.8) * 0.5,
          gear: newGear
       };
    }

    setTelemetry(newData);
    // telemetryRef is updated in useEffect now

    // Update history graph
    setSpeedHistory(prev => {
        const newHistory = [...prev.slice(1), newData.speed];
        return newHistory;
    });

    setLatency(20 + Math.random() * 15);
  };

  // --- Toggle Logic ---
  const handleTogglePlay = () => {
      if (isRunning) {
          setIsRunning(false);
          // If we have some logs, assume a run just finished and trigger debrief
          if (logs.length > 3) {
              generateSessionDebrief();
          }
      } else {
          setIsRunning(true);
          setShowDebrief(false);
          setDebriefReport(null);
          
          // Clear previous logs but ADD initial system message so it's not empty
          const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
          setLogs([{ 
              agent: "SYSTEM", 
              role: "STATUS", 
              msg: "Session started. Telemetry stream active.", 
              time: timestamp,
              color: "text-gray-400",
              border: "border-gray-600",
              bg: "bg-gray-900/50"
          }]); 
          
          setSpeedHistory(new Array(40).fill(0));
      }
  };

  // --- Lifecycle ---

  useEffect(() => {
    if (isRunning) {
      simInterval.current = setInterval(generateTelemetry, 50); // 20Hz update (Physics)
      
      // Trigger first Gemini call immediately so user doesn't wait 4s for first insight
      fetchGeminiGuidance();
      
      logInterval.current = setInterval(fetchGeminiGuidance, 4000); // 4s update (Cloud AI Agent)
      nanoInterval.current = setInterval(runGeminiNanoHotCall, 800); // 0.8s update (Local Nano "Hot Call")
    } else {
      clearInterval(simInterval.current);
      clearInterval(logInterval.current);
      clearInterval(nanoInterval.current);
      window.speechSynthesis?.cancel(); // Stop talking on stop
    }
    return () => {
      clearInterval(simInterval.current);
      clearInterval(logInterval.current);
      clearInterval(nanoInterval.current);
      window.speechSynthesis?.cancel();
    };
  }, [isRunning, replayData, replayIndex]); 

  useEffect(() => {
     let interval;
     if(isRunning) {
        interval = setInterval(() => setCurrentTime(c => c + 1), 1000);
     }
     return () => clearInterval(interval);
  }, [isRunning]);

  const formatTime = (s) => {
      const mins = Math.floor(s / 60).toString().padStart(2, '0');
      const secs = (s % 60).toString().padStart(2, '0');
      return `${mins}:${secs}`;
  };

  return (
    <div className="w-full min-h-screen bg-black text-gray-100 font-sans selection:bg-blue-500/30 flex flex-col overflow-hidden relative">
      
      {/* --- DEBRIEF MODAL --- */}
      {showDebrief && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-8 animate-in fade-in duration-300">
              <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-full">
                  
                  {/* Modal Header */}
                  <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-gray-950">
                      <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
                              <Zap size={24} />
                          </div>
                          <div>
                              <h2 className="text-xl font-bold tracking-widest text-white">RACE ENGINEER DEBRIEF</h2>
                              <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">GEMINI 3.0 ANALYSIS</span>
                                  <span className="text-[10px] text-gray-500 font-mono">{new Date().toLocaleTimeString()}</span>
                              </div>
                          </div>
                      </div>
                      <button onClick={() => setShowDebrief(false)} className="text-gray-500 hover:text-white transition-colors">
                          <X size={24} />
                      </button>
                  </div>

                  {/* Modal Content */}
                  <div className="p-8 overflow-y-auto">
                      {isDebriefLoading ? (
                          <div className="flex flex-col items-center justify-center py-12 gap-4">
                              <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                              <p className="text-sm font-mono text-gray-400 animate-pulse">Aggregating telemetry & synthesizing report...</p>
                          </div>
                      ) : debriefReport ? (
                          <div className="grid grid-cols-2 gap-8">
                              {/* Left: Score & Verdict */}
                              <div className="col-span-2 md:col-span-1 flex flex-col gap-6">
                                  <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 text-center relative overflow-hidden">
                                      <div className="text-xs text-gray-400 uppercase tracking-widest mb-2">Driver Efficiency Score</div>
                                      <div className="text-6xl font-black text-white">{debriefReport.score}</div>
                                      <div className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 w-full" style={{ opacity: 0.5 }}></div>
                                  </div>
                                  
                                  <div>
                                      <h3 className="text-sm font-bold text-gray-300 mb-2 flex items-center gap-2">
                                          <MessageSquare size={16} className="text-blue-400"/> COACH'S VERDICT
                                      </h3>
                                      <p className="text-lg text-white font-medium leading-relaxed">
                                          "{debriefReport.verdict}"
                                      </p>
                                  </div>
                              </div>

                              {/* Right: Technical Breakdown */}
                              <div className="col-span-2 md:col-span-1 space-y-6">
                                  <div className="bg-blue-900/10 border border-blue-500/30 rounded-lg p-4">
                                      <h4 className="text-xs font-bold text-blue-400 uppercase mb-2 flex items-center gap-2">
                                          <Activity size={14}/> PRIMARY FOCUS AREA
                                      </h4>
                                      <div className="text-white font-bold text-xl mb-1">{debriefReport.primary_issue}</div>
                                      <div className="text-xs text-blue-300/70">Detected via Squad Logs</div>
                                  </div>

                                  <div className="bg-green-900/10 border border-green-500/30 rounded-lg p-4">
                                      <h4 className="text-xs font-bold text-green-400 uppercase mb-2 flex items-center gap-2">
                                          <ClipboardList size={14}/> ACTION PLAN
                                      </h4>
                                      <p className="text-sm text-gray-300 leading-relaxed">
                                          {debriefReport.coaching_tip}
                                      </p>
                                  </div>
                              </div>
                          </div>
                      ) : (
                          <div className="text-center text-red-400">Failed to load report.</div>
                      )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-gray-950 border-t border-gray-800 flex justify-end">
                      <button 
                          onClick={() => setShowDebrief(false)}
                          className="px-6 py-2 bg-white text-black font-bold rounded hover:bg-gray-200 transition-colors text-sm uppercase tracking-wide"
                      >
                          Close & New Session
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Hidden CSV Input */}
      <input 
        type="file" 
        accept=".csv" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        style={{ display: 'none' }} 
      />

      {/* --- Top Bar: Project Status --- */}
      <header className="h-14 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-6 z-10">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600/20 text-blue-400 p-1.5 rounded">
            <Cpu size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-widest uppercase text-white">H2 AI Sprint // Antigravity</h1>
            <p className="text-xs text-gray-500 font-mono tracking-wider">PROJECT: HIGH-VELOCITY AI FIELD TEST</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
             <span className="text-[10px] text-gray-500 uppercase">System Latency</span>
             <span className={`font-mono font-bold ${latency > 40 ? 'text-red-400' : 'text-green-400'} pr-1`}>
                {latency.toFixed(1)}ms
             </span>
          </div>
          <div className="h-8 w-[1px] bg-gray-800" />
          
          {/* Controls */}
          <div className="flex gap-2">
            <button 
                onClick={toggleAudio}
                className={`flex items-center gap-2 px-3 py-1.5 rounded border border-gray-700 font-mono text-xs uppercase tracking-wide transition-colors ${isAudioEnabled ? 'text-blue-400 bg-blue-900/20 border-blue-500/50' : 'text-gray-500 hover:bg-gray-800'}`}
                title="Toggle Voice Synthesis"
            >
                {isAudioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>

            <button
                onClick={testAudio}
                disabled={!isAudioEnabled} 
                className={`flex items-center gap-2 px-3 py-1.5 rounded border border-gray-700 font-mono text-xs uppercase tracking-wide transition-colors ${!isAudioEnabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800 text-gray-400'}`}
                title="Test Audio Output"
            >
                <Play size={14} /> Test
            </button>

            <button 
                onClick={() => fileInputRef.current.click()}
                className="flex items-center gap-2 px-3 py-1.5 rounded border border-gray-700 font-mono text-xs uppercase tracking-wide hover:bg-gray-800 transition-colors text-gray-400"
            >
                <Upload size={14} /> {replayData ? 'CSV Loaded' : 'Load CSV'}
            </button>

            <button 
                onClick={handleTogglePlay}
                className={`flex items-center gap-2 px-4 py-1.5 rounded border font-mono text-xs uppercase tracking-wide transition-colors ${
                    isRunning 
                    ? 'border-red-500/50 bg-red-500/10 text-red-400 hover:bg-red-500/20' 
                    : 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                }`}
            >
                {isRunning ? <><Pause size={14} /> Stop Stream</> : <><Play size={14} /> {replayData ? 'Replay Data' : 'Start Sim'}</>}
            </button>
          </div>
        </div>
      </header>

      {/* --- Main Dashboard Grid --- */}
      <main className="flex-1 p-4 grid grid-cols-12 grid-rows-6 gap-4 h-[calc(100vh-3.5rem)]">
        
        {/* MIDDLE COL: Telemetry Cluster (Expanded Layout) */}
        <section className="col-span-8 row-span-6 flex flex-col gap-4">
           
           {/* Top Stats - Compact */}
           <div className="h-16 grid grid-cols-3 gap-4 shrink-0">
              <StatusIndicator label="Edge Ingestion" status={isRunning ? "active" : "standby"} value={isRunning ? (replayData ? "CSV REPLAY" : "SIMULATION") : "WAITING"} />
              <StatusIndicator label="AGV Pipeline" status={isRunning ? "active" : "standby"} value="SYNCED" />
              <StatusIndicator label="Gemini Model" status="active" value="v2.5-FLASH" />
           </div>

           {/* Main Center Stage - Expanded to fill dead space */}
           <div className="flex-1 bg-gray-900/40 rounded-xl border border-gray-800 p-8 flex items-center justify-between relative overflow-hidden pr-12">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_0px,rgba(0,0,0,0.2)_1px)] bg-[size:100%_4px] pointer-events-none" />
              
              {/* G-Force - Upscaled */}
              <div className="flex flex-col items-center gap-4">
                 <h3 className="text-sm font-mono text-gray-500 uppercase tracking-widest">Lateral G</h3>
                 <GForceMeter x={telemetry.gLat} y={telemetry.gLong} />
              </div>

              {/* Speed/RPM Main - Adjusted size to prevent overlap */}
              <div className="flex flex-col items-center z-10 mx-4" style={{ transform: 'translateX(-10%)' }}>
                 <div className="text-[9rem] font-black leading-none italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 pr-8">
                    {Math.round(telemetry.speed)}
                 </div>
                 <div className="text-3xl font-mono text-blue-400 font-bold -mt-4">MPH</div>
                 
                 {/* RPM Bar - Upscaled */}
                 <div className="w-96 h-6 bg-gray-800 rounded mt-8 overflow-hidden flex gap-0.5">
                    {Array.from({length: 20}).map((_, i) => (
                        <div 
                            key={i} 
                            className={`flex-1 transition-all duration-75 ${
                                (telemetry.rpm / 8000) * 20 > i 
                                ? (i > 16 ? 'bg-red-500' : 'bg-blue-500') 
                                : 'bg-gray-800'
                            }`} 
                        />
                    ))}
                 </div>
                 <div className="flex justify-between w-full mt-1 px-1">
                     <span className="text-xs font-mono text-gray-500">0</span>
                     <span className="text-xs font-mono text-gray-500">4000</span>
                     <span className="text-xs font-mono text-gray-500">8000</span>
                 </div>
              </div>

              {/* Pedals - Adjusted width and margin to fix cut-off */}
              <div className="w-40 flex flex-col gap-8 mr-4 z-20">
                 <TelemetryBar label="Throttle" value={telemetry.throttle} max={100} color="bg-green-500" />
                 <TelemetryBar label="Brake" value={telemetry.brake} max={100} color="bg-red-500" />
              </div>
           </div>

           {/* Bottom Graphs - Fixed Height */}
           <div className="h-64 grid grid-cols-2 gap-4 shrink-0">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                 <h4 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-4">
                    <Activity size={14} /> Speed History (Last 2s)
                 </h4>
                 <div className="flex items-end h-32 gap-1">
                    {speedHistory.map((val, i) => (
                        <div 
                            key={i} 
                            className="flex-1 bg-blue-500 hover:bg-blue-400 transition-colors"
                            style={{ 
                                height: `${Math.min(100, (val / 180) * 100)}%`, // Scaled to max 180mph
                            }}
                        />
                    ))}
                 </div>
              </div>
              
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                 <h4 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-4">
                    <Wifi size={14} /> Signal Strength
                 </h4>
                 <div className="grid grid-cols-2 gap-4 h-full">
                     <div>
                         <div className="text-xs text-gray-500">UPLINK</div>
                         <div className="text-xl font-mono text-white">45.2 <span className="text-sm text-gray-600">mbps</span></div>
                     </div>
                     <div>
                         <div className="text-xs text-gray-500">PACKET LOSS</div>
                         <div className="text-xl font-mono text-green-400">0.02%</div>
                     </div>
                     <div>
                         <div className="text-xs text-gray-500">GPS ACCURACY</div>
                         <div className="text-xl font-mono text-white">12 <span className="text-sm text-gray-600">cm</span></div>
                     </div>
                 </div>
              </div>
           </div>
        </section>

        {/* RIGHT COL: Agentic Reasoning (Gemini Output) */}
        <section className="col-span-4 row-span-6 bg-gray-900/80 rounded-xl border border-gray-700 flex flex-col backdrop-blur-sm overflow-hidden">
            <div className="bg-gray-800/50 p-3 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Zap size={16} className="text-yellow-400" />
                    <span className="font-bold text-sm tracking-wide text-gray-200">GEMINI SQUAD</span>
                </div>
                <div className="flex items-center gap-2">
                    {isApiProcessing && (
                        <span className="flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                    )}
                    <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-gray-600" />
                        <div className="w-2 h-2 rounded-full bg-gray-600" />
                        <div className="w-2 h-2 rounded-full bg-gray-600" />
                    </div>
                </div>
            </div>
            
            {/* The Chat/Log Stream */}
            <div className="flex-1 p-4 overflow-y-auto font-mono text-xs space-y-3">
                {!isRunning && (
                    <div className="text-gray-500 italic text-center mt-10">
                        {replayData ? 'CSV Data Loaded. Ready to Replay.' : 'Waiting for data stream initialization...'}
                    </div>
                )}
                {logs.map((log, i) => (
                    <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <div className="flex gap-2 text-[10px] text-gray-500 mb-0.5 items-center">
                            <span>[{log.time}]</span>
                            <span className={`${log.color} font-bold`}>{log.agent}</span>
                            <span className="text-gray-600 text-[9px] border border-gray-700 rounded px-1">{log.role}</span>
                        </div>
                        <div className={`p-2 rounded border-l-2 ${log.bg} ${log.border} text-gray-300`}>
                            {log.msg}
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-3 bg-gray-950 border-t border-gray-800">
                <div className="flex items-center gap-2 text-gray-500 text-xs">
                    <MessageSquare size={12} />
                    <span>Multi-agent reasoning active...</span>
                </div>
            </div>
        </section>

      </main>
    </div>
  );
}
