import React, { useState, useEffect, useRef } from 'react';
import { Activity, Wifi, Cpu, AlertTriangle, Play, Pause, Database, Eye, Terminal, Zap, MessageSquare, Upload, Volume2, VolumeX, X, FileText, ClipboardList } from 'lucide-react';

import { getGeminiCoaching, getSessionDebrief, getNanoEvents } from './raceEngineer';

// --- Components ---

// --- Components ---

const StatusIndicator = ({ label, status, value }) => (
  <div className="flex items-center justify-between bg-white p-3 rounded border border-gray-200 h-full shadow-sm">
    <span className="text-xs text-gray-500 font-mono uppercase">{label}</span>
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold font-mono ${status === 'active' ? 'text-emerald-600' : 'text-amber-500'}`}>
        {value || status.toUpperCase()}
      </span>
      <div className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
    </div>
  </div>
);

// Resized G-Force Meter (Light Theme)
const GForceMeter = ({ x, y }) => (
  <div className="relative w-40 h-40 bg-white rounded-full border border-gray-200 flex items-center justify-center transition-all duration-300 shadow-inner">
    {/* Grid rings */}
    <div className="absolute w-32 h-32 rounded-full border border-gray-300 opacity-50" />
    <div className="absolute w-16 h-16 rounded-full border border-gray-300 opacity-50" />
    <div className="absolute w-[1px] h-full bg-gray-300" />
    <div className="absolute h-[1px] w-full bg-gray-300" />

    {/* The Dot */}
    <div
      className="absolute w-4 h-4 bg-blue-600 rounded-full shadow-lg transition-all duration-75 ease-linear border border-white"
      style={{
        transform: `translate(${x * 50}px, ${y * -50}px)`
      }}
    />
    <span className="absolute bottom-2 text-[10px] text-gray-400 font-mono">1.5G</span>
  </div>
);

// Resized Telemetry Bar (Light Theme)
const TelemetryBar = ({ label, value, max, color = "bg-blue-500" }) => (
  <div className="flex flex-col gap-2 w-full">
    <div className="flex justify-between text-base font-mono text-gray-600 uppercase">
      <span>{label}</span>
      <span className="pl-4 font-bold">{Math.round(value)}%</span>
    </div>
    {/* Light background for cleaner UI */}
    <div className="h-6 w-full bg-gray-200 rounded-full overflow-hidden border border-gray-100">
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
  const lastSpokenTextRef = useRef("");

  // Update refs when state changes
  useEffect(() => {
    telemetryRef.current = telemetry;
  }, [telemetry]);

  useEffect(() => {
    audioEnabledRef.current = isAudioEnabled;
  }, [isAudioEnabled]);

  // --- Voice Loading Logic ---
  const voicesRef = useRef([]);
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        voicesRef.current = availableVoices;
      }
    };

    // Load immediately
    loadVoices();

    // Load when changed (Chrome async loading)
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // --- Voice Synthesis Logic (Safety Optimized) ---

  const speak = (text, agent, priority) => {
    // 1. Basic check: Is audio on?
    if (!audioEnabledRef.current || !window.speechSynthesis) return;

    const now = Date.now();
    const timeSinceLastSpeech = now - lastSpeechTimeRef.current;

    // 2. Safety Buffer & Deduplication

    // A. Deduplication: Don't repeat the EXACT same message within 8 seconds (prevents "nagging")
    if (text === lastSpokenTextRef.current && (now - lastSpeechTimeRef.current) < 8000) {
      return;
    }

    // B. Safety Buffer: Space out DIFFERENT messages by 3 seconds (unless high priority)
    // This reduces cognitive load on the "driver"
    const safetyBuffer = priority === 'high' ? 0 : 3000;
    if (timeSinceLastSpeech < safetyBuffer) {
      return;
    }

    // 3. Mute Gemini/System from speaking (Visual only as requested)
    if (agent === 'GEMINI' || agent === 'SYSTEM') { return; }

    // Cancel any pending chatter to ensure this message comes through clearly immediately
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    // Ensure voices are loaded
    if (voicesRef.current.length === 0) {
      voicesRef.current = window.speechSynthesis.getVoices();
    }
    const voices = voicesRef.current;

    // 4. Voice Persona Selection
    let selectedVoice = null;

    if (agent === 'AJ') {
      // AJ: Aggressive, US Male (Crew Chief)
      selectedVoice = voices.find(v => v.name.includes('Google US English')) ||
        voices.find(v => v.lang === 'en-US' && v.name.includes('Male')) ||
        voices.find(v => v.lang === 'en-US');
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
    } else if (agent === 'ROSS') {
      // ROSS: Technical, UK Male (Telemetry)
      selectedVoice = voices.find(v => v.name.includes('Google UK English Male')) ||
        voices.find(v => v.name.includes('Great Britain') && v.name.includes('Male')) ||
        voices.find(v => v.lang === 'en-GB');
      utterance.rate = 1.0;
      utterance.pitch = 0.95; // Slightly lower pitch for calmness
    } else if (agent === 'NANO') {
      // NANO: Robotic, Fast Alerts
      selectedVoice = voices.find(v => v.name.includes('Google US English')) || voices[0];
      utterance.rate = 1.25;
      utterance.pitch = 1.1;
    }

    // Fallback if specific voice not found
    if (!selectedVoice) {
      selectedVoice = voices.find(v => v.lang.includes('en-US')) || voices[0];
    }

    if (selectedVoice) utterance.voice = selectedVoice;

    // Sanitize text for speech (User Request: "MAX_GRIP" -> "MAX GRIP")
    const spokenText = text.replace(/_/g, ' ');
    utterance.text = spokenText;

    window.speechSynthesis.speak(utterance);
    lastSpeechTimeRef.current = now;
    lastSpokenTextRef.current = text;
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


  // --- API Logic (Gemini 2.5 Cloud + RAG) ---

  const fetchGeminiGuidance = async () => {
    if (isApiProcessing) return;
    setIsApiProcessing(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || ""; // Read from .env
    const currentData = telemetryRef.current;

    try {
      const coachingMsg = await getGeminiCoaching(currentData, apiKey);
      if (coachingMsg) {
        addLog(coachingMsg);
      }
    } catch (error) {
      console.error("Coaching Error:", error);
    } finally {
      setIsApiProcessing(false);
    }
  };

  const generateSessionDebrief = async () => {
    setIsDebriefLoading(true);
    setShowDebrief(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";

    try {
      const debrief = await getSessionDebrief(logs, speedHistory, apiKey);
      if (debrief) {
        setDebriefReport(debrief);
      }
    } catch (error) {
      console.error("Debrief UI Error:", error);
    } finally {
      setIsDebriefLoading(false);
    }
  };

  // --- Gemini Nano (Mocked Local Edge) ---
  const runGeminiNanoHotCall = () => {
    const t = telemetryRef.current;

    // Use the logic from raceEngineer.js
    const event = getNanoEvents(t);

    if (event) {
      addLog(event);
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
      color: 'text-gray-600',
      border: 'border-gray-200',
      bg: 'bg-white shadow-sm'
    };

    if (data.agent === 'AJ') {
      styles.color = 'text-purple-700';
      styles.border = 'border-purple-200';
      styles.bg = 'bg-purple-50 shadow-sm';
    } else if (data.agent === 'ROSS') {
      styles.color = 'text-blue-700';
      styles.border = 'border-blue-200';
      styles.bg = 'bg-blue-50 shadow-sm';
    } else if (data.agent === 'GEMINI') {
      styles.color = 'text-amber-700';
      styles.border = 'border-amber-200';
      styles.bg = 'bg-amber-50 shadow-sm';
    } else if (data.agent === 'NANO') {
      styles.color = 'text-emerald-700';
      styles.border = 'border-emerald-200';
      styles.bg = 'bg-emerald-50 shadow-sm';
    } else if (data.agent === 'SYSTEM') {
      styles.color = 'text-gray-500';
      styles.border = 'border-gray-200';
      styles.bg = 'bg-gray-50 shadow-sm';
    }

    if (data.priority === 'high') {
      styles.border = 'border-red-300';
      styles.bg = 'bg-red-50 shadow-md';
      styles.color = 'text-red-700 font-bold';
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

      // Force Audio Resume on Start
      if (isAudioEnabled && window.speechSynthesis) {
        window.speechSynthesis.resume();
        // Speak an invisible char to unlock
        const utterance = new SpeechSynthesisUtterance("System engaged.");
        utterance.volume = 0.5;
        utterance.rate = 1.2;
        window.speechSynthesis.speak(utterance);
      }
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
    if (isRunning) {
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
    <div className="w-full min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-500/30 flex flex-col overflow-hidden relative">

      {/* --- DEBRIEF MODAL --- */}
      {showDebrief && (
        <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-8 animate-in fade-in duration-300">
          <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                  <Zap size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-widest text-slate-800">RACE ENGINEER DEBRIEF</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded border border-purple-200 font-bold">GEMINI 2.5 PRO ANALYSIS</span>
                    <span className="text-[10px] text-gray-500 font-mono">{new Date().toLocaleTimeString()}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowDebrief(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={24} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-8 overflow-y-auto bg-white">
              {isDebriefLoading ? (
                <div className="flex flex-col items-center justify-center py-24 gap-6">
                  <div className="w-16 h-16 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin"></div>
                  <p className="text-sm font-mono text-gray-500 animate-pulse uppercase tracking-widest">Synthesizing race data...</p>
                </div>
              ) : debriefReport ? (
                <div className="grid grid-cols-12 gap-8">
                  {/* Left Column: Data & Verdict */}
                  <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
                    {/* Score Card */}
                    <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 text-center relative overflow-hidden shadow-sm">
                      <div className="text-xs text-gray-500 uppercase tracking-widest mb-2 font-semibold">Driver Efficiency Score</div>
                      <div className="text-8xl font-black text-slate-800 tracking-tighter">{debriefReport.score}</div>
                      <div className="absolute bottom-0 left-0 h-1.5 bg-gradient-to-r from-red-500 via-yellow-400 to-emerald-500 w-full opacity-80"></div>
                    </div>

                    {/* Verdict Card */}
                    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                      <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                        <MessageSquare size={14} className="text-blue-500" /> COACH'S VERDICT
                      </h3>
                      <p className="text-xl text-slate-700 font-medium leading-relaxed">
                        "{debriefReport.verdict}"
                      </p>
                    </div>

                    {/* Primary Issue Card */}
                    <div className="bg-red-50 border border-red-100 rounded-xl p-6">
                      <h4 className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-2">
                        <Activity size={14} /> PRIMARY FOCUS AREA
                      </h4>
                      <div className="text-slate-800 font-bold text-2xl">{debriefReport.primary_issue}</div>
                    </div>
                  </div>

                  {/* Right Column: Action Plan (The Meat) */}
                  <div className="col-span-12 lg:col-span-7">
                    <div className="bg-white border border-gray-200 rounded-2xl p-8 h-full shadow-sm">
                      <h4 className="text-sm font-bold text-emerald-600 uppercase mb-6 flex items-center gap-2 border-b border-gray-100 pb-4">
                        <ClipboardList size={18} /> ACTION PLAN FOR NEXT SESSION
                      </h4>

                      {/* Render Action Plan List */}
                      <div className="space-y-4">
                        {debriefReport.action_plan && Array.isArray(debriefReport.action_plan) ? (
                          debriefReport.action_plan.map((step, idx) => (
                            <div key={idx} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-colors">
                              <div className="text-lg">{/* Emoji is in the string, or we could parse it */}</div>
                              <div className="text-slate-700 leading-relaxed text-lg">
                                {/* Simple markdown parsing for bolding */}
                                {step.split('**').map((part, i) =>
                                  i % 2 === 1 ? <span key={i} className="font-bold text-slate-900">{part}</span> : part
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          // Fallback for old/mock format
                          <p className="text-slate-600 whitespace-pre-line leading-relaxed">{debriefReport.coaching_tip}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-red-500 py-12">Failed to load report.</div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setShowDebrief(false)}
                className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all transform hover:scale-[1.02] shadow-lg text-sm uppercase tracking-wide"
              >
                Close & Start New Session
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
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-8 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
            <Cpu size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-widest uppercase text-slate-900">H2 AI Sprint // Antigravity</h1>
            <p className="text-xs text-gray-500 font-mono tracking-wider">PROJECT: HIGH-VELOCITY AI FIELD TEST</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] text-gray-400 uppercase">System Latency</span>
            <span className={`font-mono font-bold ${latency > 40 ? 'text-red-500' : 'text-emerald-500'} pr-1`}>
              {latency.toFixed(1)}ms
            </span>
          </div>
          <div className="h-8 w-[1px] bg-gray-200" />

          {/* Controls */}
          <div className="flex gap-2">
            <button
              onClick={toggleAudio}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border font-mono text-xs uppercase tracking-wide transition-colors ${isAudioEnabled ? 'text-blue-600 bg-blue-50 border-blue-200' : 'text-gray-400 border-gray-200 hover:bg-gray-50'}`}
              title="Toggle Voice Synthesis"
            >
              {isAudioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              onClick={() => speak("Radio check. Loud and clear.", "AJ", "high")}
              className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs font-mono text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors"
              title="Test Audio"
            >
              TEST
            </button>

            <button
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 font-mono text-xs uppercase tracking-wide hover:bg-gray-50 transition-colors text-gray-500"
            >
              <Upload size={14} /> {replayData ? 'CSV Loaded' : 'Load CSV'}
            </button>

            <button
              onClick={handleTogglePlay}
              className={`flex items-center gap-2 px-5 py-1.5 rounded-lg border font-mono text-xs uppercase tracking-wide transition-colors shadow-sm ${isRunning
                ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                : 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
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
          </div>

          {/* Main Center Stage - Expanded to fill dead space */}
          <div className="flex-1 bg-white rounded-2xl border border-gray-200 p-8 flex items-center justify-between relative overflow-hidden pr-12 shadow-sm">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_0px,rgba(0,0,0,0.03)_1px)] bg-[size:100%_4px] pointer-events-none" />

            {/* G-Force - Upscaled */}
            <div className="flex flex-col items-center gap-4">
              <h3 className="text-sm font-mono text-gray-400 uppercase tracking-widest">Lateral G</h3>
              <GForceMeter x={telemetry.gLat} y={telemetry.gLong} />
            </div>

            {/* Speed/RPM Main - Adjusted size to prevent overlap */}
            <div className="flex flex-col items-center z-10 mx-4" style={{ transform: 'translateX(-10%)' }}>
              <div className="text-[9rem] font-black leading-none italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-slate-900 to-slate-500 pr-8">
                {Math.round(telemetry.speed)}
              </div>
              <div className="text-3xl font-mono text-blue-600 font-bold -mt-4">MPH</div>

              {/* RPM Bar - Upscaled */}
              <div className="w-96 h-6 bg-gray-200 rounded mt-8 overflow-hidden flex gap-0.5 border border-gray-100">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 transition-all duration-75 ${(telemetry.rpm / 8000) * 20 > i
                      ? (i > 16 ? 'bg-red-500' : 'bg-blue-600')
                      : 'bg-gray-100'
                      }`}
                  />
                ))}
              </div>
              <div className="flex justify-between w-full mt-1 px-1">
                <span className="text-xs font-mono text-gray-400">0</span>
                <span className="text-xs font-mono text-gray-400">4000</span>
                <span className="text-xs font-mono text-gray-400">8000</span>
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
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h4 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-4">
                <Activity size={14} /> Speed History (Last 2s)
              </h4>
              <div className="flex items-end h-32 gap-1 border-b border-gray-100 pb-1">
                {speedHistory.map((val, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-blue-500 rounded-t-sm opacity-80"
                    style={{
                      height: `${Math.min(100, (val / 180) * 100)}%`, // Scaled to max 180mph
                    }}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-mono text-gray-400">
                <span>-2s</span>
                <span>Now</span>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h4 className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase mb-4">
                <Wifi size={14} /> Signal Strength
              </h4>
              <div className="grid grid-cols-2 gap-4 h-full">
                <div>
                  <div className="text-xs text-gray-400 font-bold">UPLINK</div>
                  <div className="text-xl font-mono text-slate-800">45.2 <span className="text-sm text-gray-400">mbps</span></div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-bold">PACKET LOSS</div>
                  <div className="text-xl font-mono text-emerald-500">0.02%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-400 font-bold">GPS ACCURACY</div>
                  <div className="text-xl font-mono text-slate-800">12 <span className="text-sm text-gray-400">cm</span></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* RIGHT COL: Agentic Reasoning (Gemini Output) */}
        <section className="col-span-4 row-span-6 bg-white border border-gray-200 rounded-2xl p-4 flex flex-col shadow-sm">
          <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Zap size={16} className="text-amber-500" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">GEMINI SQUAD</h3>
            </div>
            <div className="flex items-center gap-2">
              {isApiProcessing && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
              )}
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-200" />
                <div className="w-2 h-2 rounded-full bg-gray-200" />
                <div className="w-2 h-2 rounded-full bg-gray-200" />
              </div>
            </div>
          </div>

          {/* The Chat/Log Stream */}
          <div className="flex-1 p-2 overflow-y-auto font-mono text-xs space-y-3 pr-2 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {!isRunning && (
              <div className="text-gray-400 italic text-center mt-10">
                {replayData ? 'CSV Data Loaded. Ready to Replay.' : 'Waiting for data stream initialization...'}
              </div>
            )}
            {logs.map((log, i) => (
              <div key={i} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex gap-2 text-[10px] text-gray-400 mb-0.5 items-center">
                  <span>[{log.time}]</span>
                  <span className={`${log.color} font-bold`}>{log.agent}</span>
                  <span className="text-gray-500 text-[9px] border border-gray-200 rounded px-1 uppercase">{log.role}</span>
                </div>
                <div className={`p-3 rounded-xl ${log.bg} ${log.border} border shadow-sm`}>
                  <p className={`${log.color} leading-relaxed font-medium`}>{log.msg}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-gray-50 border-t border-gray-100 rounded-b-xl">
            <div className="flex items-center gap-2 text-gray-400 text-xs font-mono uppercase tracking-wide">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span>Multi-agent reasoning active...</span>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
}
