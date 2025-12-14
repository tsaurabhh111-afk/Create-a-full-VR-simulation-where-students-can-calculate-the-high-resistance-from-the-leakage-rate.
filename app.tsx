import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BookOpen, X, GraduationCap, Github } from 'lucide-react';
import { INITIAL_PARAMS, NOISE_AMPLITUDE } from './constants';
import { ExperimentState, SimulationParams, DataPoint } from './types';
import LabControls from './components/LabControls';
import Oscilloscope from './components/Oscilloscope';
import AssistantChat from './components/AssistantChat';
import Scene3D from './components/Scene3D';

// --- Lab Manual Component ---
const LabManual: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl max-h-[85vh] overflow-hidden rounded-xl shadow-2xl flex flex-col">
        <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-indigo-400" />
            Experiment Manual
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto prose prose-invert max-w-none">
          <h3 className="text-indigo-300">Objective</h3>
          <p>To determine the value of a high resistance (Order of mega-ohms) using the capacitor leakage method.</p>

          <h3 className="text-indigo-300">Theory</h3>
          <p>
            When a charged capacitor is allowed to discharge through a high resistance, the charge (and voltage) on the capacitor decays exponentially over time.
          </p>
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-center my-4">
             Vt = V0 * e^(-t / RC)
          </div>
          <p>Where:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>V0</strong> = Initial Voltage (Volts)</li>
            <li><strong>Vt</strong> = Voltage at time t (Volts)</li>
            <li><strong>t</strong> = Time elapsed (seconds)</li>
            <li><strong>C</strong> = Capacitance (Farads)</li>
            <li><strong>R</strong> = Resistance (Ohms)</li>
          </ul>
          
          <p>Rearranging the formula to solve for Resistance (R):</p>
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 font-mono text-center my-4 text-lg">
             R = t / (C * ln(V0 / Vt))
          </div>

          <h3 className="text-indigo-300">Procedure</h3>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Set the Source Voltage (V0) and Capacitance (C) using the sliders.</li>
            <li>Click <strong>Charge (S1)</strong> to charge the capacitor to V0.</li>
            <li>Click <strong>Isolate</strong> (Open S1) to disconnect the source. The capacitor holds the charge.</li>
            <li>Click <strong>Discharge (S2)</strong> to connect the high resistance. The voltage will start dropping.</li>
            <li>Observe the voltmeter and stopwatch. Note down the time (t) taken for voltage to drop to a specific value (Vt).</li>
            <li>Use the formula or ask the AI Assistant to calculate R.</li>
          </ol>
        </div>
      </div>
    </div>
  );
};


// --- Main App Component ---
const App: React.FC = () => {
  // State
  const [params, setParams] = useState<SimulationParams>(INITIAL_PARAMS);
  const [state, setState] = useState<ExperimentState>(ExperimentState.IDLE);
  const [time, setTime] = useState(0);
  const [voltage, setVoltage] = useState(0);
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [isManualOpen, setIsManualOpen] = useState(false);
  
  // Refs for simulation loop
  const requestRef = useRef<number>();
  const lastTimeRef = useRef<number>();

  // Physics Engine
  const updatePhysics = useCallback((timestamp: number) => {
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;
    const deltaTime = (timestamp - lastTimeRef.current) / 1000; // in seconds
    lastTimeRef.current = timestamp;

    if (state === ExperimentState.CHARGING) {
      setVoltage(prev => {
        const diff = params.voltageSource - prev;
        const change = diff * 10 * deltaTime;
        if (Math.abs(diff) < 0.01) return params.voltageSource;
        return prev + change; 
      });
      setTime(0);
      setDataPoints([]); 
    } else if (state === ExperimentState.DISCHARGING) {
      const RC = params.resistance * params.capacitance;
      setVoltage(prev => prev * Math.exp(-deltaTime / RC));
      setTime(prev => prev + deltaTime);
    }

    requestRef.current = requestAnimationFrame(updatePhysics);
  }, [state, params.voltageSource, params.resistance, params.capacitance]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updatePhysics);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [updatePhysics]);

  useEffect(() => {
    if (state === ExperimentState.DISCHARGING) {
      const noise = (Math.random() - 0.5) * NOISE_AMPLITUDE; 
      setDataPoints(prev => [...prev, { time: time, voltage: Math.max(0, voltage + noise) }]);
    }
  }, [time, voltage, state]);

  // Handlers
  const handleCharge = (e?: any) => setState(ExperimentState.CHARGING);
  const handleDischarge = (e?: any) => setState(ExperimentState.DISCHARGING);
  const handleStop = (e?: any) => setState(ExperimentState.PAUSED);
  const handleReset = () => {
    setState(ExperimentState.IDLE);
    setVoltage(0);
    setTime(0);
    setDataPoints([]);
  };

  const toggleCharge = () => {
    if (state === ExperimentState.CHARGING) handleStop();
    else handleCharge();
  }

  const toggleDischarge = () => {
    if (state === ExperimentState.DISCHARGING) handleStop();
    else handleDischarge();
  }

  const aiContext = {
    v0: params.voltageSource,
    vt: Number(voltage.toFixed(3)),
    t: Number(time.toFixed(2)),
    c: params.capacitance
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-200 overflow-hidden flex flex-col font-sans">
      
      {/* --- Navigation Header --- */}
      <header className="h-14 bg-slate-900 border-b border-slate-700 flex items-center justify-between px-6 z-20 shadow-lg shrink-0">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
                <GraduationCap className="text-white w-5 h-5" />
            </div>
            <h1 className="font-bold text-lg tracking-tight text-slate-100">
                <span className="text-indigo-400">Physics</span>VR Lab
            </h1>
        </div>
        
        <div className="flex items-center gap-4">
            <button 
                onClick={() => setIsManualOpen(true)}
                className="flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 px-3 py-1.5 rounded-md transition-colors"
            >
                <BookOpen className="w-4 h-4" />
                Lab Manual
            </button>
            <div className="h-4 w-px bg-slate-700 mx-1 hidden md:block"></div>
            <span className="text-xs font-mono text-slate-500 hidden md:block">v1.2.0-beta</span>
        </div>
      </header>

      {/* --- Main Content Area --- */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        
        {/* 3D Viewport - Top Section */}
        <div className="flex-1 relative z-0 min-h-[40%]">
            <Scene3D 
                state={state} 
                voltage={voltage}
                capacitance={params.capacitance}
                resistance={params.resistance}
                onToggleCharge={toggleCharge}
                onToggleDischarge={toggleDischarge}
            />
        </div>

        {/* Control Station - Bottom Section */}
        <div className="h-[400px] bg-slate-900 border-t border-slate-700 flex flex-col md:flex-row shadow-[0_-10px_50px_rgba(0,0,0,0.5)] z-10 shrink-0">
            
            {/* Left: Oscilloscope */}
            <div className="w-full md:w-[30%] p-4 border-r border-slate-800 flex flex-col gap-2 bg-slate-900/50">
                <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Oscilloscope</h3>
                        <div className="font-mono text-amber-500 font-bold text-xl">{time.toFixed(1)}s</div>
                </div>
                <div className="flex-1 min-h-0 rounded-lg overflow-hidden border border-slate-800 bg-slate-950">
                    <Oscilloscope data={dataPoints} />
                </div>
            </div>

            {/* Center: Controls */}
            <div className="w-full md:w-[40%] p-4 border-r border-slate-800 overflow-y-auto bg-slate-900">
                <LabControls 
                    state={state}
                    params={params}
                    setParams={setParams}
                    onCharge={handleCharge}
                    onDischarge={handleDischarge}
                    onStop={handleStop}
                    onReset={handleReset}
                />
            </div>

            {/* Right: AI Assistant */}
            <div className="w-full md:w-[30%] p-0 bg-slate-800">
                <AssistantChat currentContext={aiContext} />
            </div>

        </div>
      </div>

      {/* Lab Manual Modal */}
      <LabManual isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} />

    </div>
  );
};

export default App;
