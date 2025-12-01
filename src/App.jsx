import React, { useState, useRef, useEffect } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { 
  Upload, Layers, Zap, Activity, Image as ImageIcon, Download 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';

// --- CONFIGURATION ---
const API_URL = import.meta.env.VITE_BACKEND_API_BASE + "/stream";

// --- COMPONENTS ---

const StageCard = ({ title, image, status, isActive, onClick, coverage }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={onClick}
    className={clsx(
      "relative group cursor-pointer rounded-xl overflow-hidden border-2 transition-all duration-300 w-32 h-32 flex-shrink-0",
      isActive ? "border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]" : "border-white/5 hover:border-white/20"
    )}
  >
    {image ? (
      <img src={image} className="w-full h-full object-cover" alt={title} />
    ) : (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
        <Activity className="w-6 h-6 text-slate-600 animate-pulse" />
      </div>
    )}
    
    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent p-2 flex flex-col justify-end">
      <p className="text-xs font-medium text-slate-200">{title}</p>
      {coverage && <p className="text-[10px] text-emerald-400">{coverage} Cleaned</p>}
    </div>

    {status === 'loading' && (
      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
      </div>
    )}
  </motion.div>
);

function App() {
  // State for the pipeline stages
  const [stages, setStages] = useState([]);
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [globalStatus, setGlobalStatus] = useState("Ready");
  const fileInputRef = useRef(null);

  // Auto-scroll to newest stage
  useEffect(() => {
    if (stages.length > 0) setActiveStageIdx(stages.length - 1);
  }, [stages.length]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // 1. Initialize Pipeline
    const objectUrl = URL.createObjectURL(file);
    setIsProcessing(true);
    setGlobalStatus("Initializing Uplink...");
    
    // Reset Stages: Start with just Original
    setStages([{
      id: 'original',
      title: 'Original Site',
      image: objectUrl,
      status: 'complete'
    }]);

    const formData = new FormData();
    formData.append("file", file);

    try {
      await fetchEventSource(API_URL, {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "appliation/json",
          "ngrok-skip-browser-warning": "true"
        },
        onmessage(ev) {
          const data = JSON.parse(ev.data);

          if (ev.event === "status") {
            setGlobalStatus(data);
          } 
          else if (ev.event === "preview") {
            // Add Detection Stage
            setStages(prev => {
              // Avoid duplicates if preview fires multiple times
              if (prev.find(s => s.id === 'mask')) return prev;
              return [...prev, {
                id: 'mask',
                title: 'Pollution Map',
                image: `data:image/jpeg;base64,${data.image}`,
                coverage: data.coverage,
                status: 'complete'
              }];
            });
          } 
          else if (ev.event === "result") {
            // Add Final Stage
            setStages(prev => [...prev, {
              id: 'final',
              title: 'Restored',
              image: `data:image/jpeg;base64,${data.image}`,
              status: 'complete'
            }]);
            setIsProcessing(false);
            setGlobalStatus("Restoration Complete");
          }
          else if (ev.event === "error") {
            throw new Error(data.message);
          }
        },
        onerror(err) {
          console.error(err);
          setGlobalStatus("Connection Error");
          setIsProcessing(false);
          throw err; 
        }
      });
    } catch (err) {
      setGlobalStatus("Failed: " + err.message);
      setIsProcessing(false);
    }
  };

  const activeStage = stages[activeStageIdx];

  return (
    <div className="min-h-screen p-6 lg:p-12 flex flex-col items-center">
      
      {/* HEADER */}
      <header className="w-full max-w-6xl flex justify-between items-center mb-8">
        <div className="flex items-center space-x-3">
          <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
            <Layers className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-black">EcoRestoration <span className="text-emerald-400">Pro</span></h1>
            <p className="text-xs text-slate-400 font-mono tracking-widest uppercase">Autonomous Remediation Engine v2.0</p>
          </div>
        </div>
        
        {/* Status Pill */}
        <div className="flex items-center space-x-3 bg-slate-900/80 px-4 py-2 rounded-full border border-white/5 backdrop-blur-md">
          <div className={clsx("w-2 h-2 rounded-full animate-pulse", isProcessing ? "bg-amber-400" : "bg-emerald-400")} />
          <span className="text-sm font-mono text-slate-300">{globalStatus}</span>
        </div>
      </header>

      {/* MAIN CONTENT GRID */}
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6 h-[70vh]">
        
        {/* LEFT: MAIN VIEWPORT */}
        <div className="lg:col-span-9 relative group">
          <div className="absolute inset-0 bg-slate-900/50 rounded-3xl border border-white/10 backdrop-blur-sm overflow-hidden shadow-2xl">
            
            {activeStage ? (
              <>
                <img 
                  src={activeStage.image} 
                  alt="Main View" 
                  className="w-full h-full object-contain"
                />
                
                {/* Overlay UI */}
                <div className="absolute top-6 left-6">
                  <span className="bg-black/60 backdrop-blur-md text-white px-4 py-1.5 rounded-full text-sm font-medium border border-white/10">
                    {activeStage.title}
                  </span>
                </div>

                {/* Download Button (Only on final) */}
                {activeStage.id === 'final' && (
                  <a 
                    href={activeStage.image} 
                    download="eco_restored.jpg"
                    className="absolute bottom-6 right-6 bg-emerald-500 hover:bg-emerald-400 text-white p-3 rounded-full shadow-lg transition-all"
                  >
                    <Download className="w-6 h-6" />
                  </a>
                )}

                {/* Scanning Effect (Only if processing and viewing original/mask) */}
                {isProcessing && activeStageIdx === stages.length - 1 && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="scanning-line" />
                    <div className="scanning-overlay" />
                  </div>
                )}
              </>
            ) : (
              // EMPTY STATE
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
                  <ImageIcon className="w-20 h-20 relative z-10 opacity-50" />
                </div>
                <p className="text-lg font-medium">Upload a site image to begin analysis</p>
                <button 
                  onClick={() => fileInputRef.current.click()}
                  className="px-6 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-emerald-50 transition-colors flex items-center space-x-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Select Image</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: PIPELINE CONTROLS */}
        <div className="lg:col-span-3 flex flex-col space-y-4 h-full">
          
          {/* STAGE LIST */}
          <div className="flex-1 glass-card p-4 overflow-y-auto space-y-4 custom-scrollbar">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Pipeline Stages</h3>
            
            {stages.length === 0 && (
              <div className="h-full flex items-center justify-center opacity-30">
                <p className="text-sm text-center">Waiting for input...</p>
              </div>
            )}

            <AnimatePresence>
              {stages.map((stage, idx) => (
                <StageCard 
                  key={stage.id} 
                  {...stage} 
                  isActive={activeStageIdx === idx}
                  onClick={() => setActiveStageIdx(idx)}
                />
              ))}
            </AnimatePresence>

            {/* Ghost Card for Processing state */}
            {isProcessing && stages.length > 0 && stages.length < 3 && (
              <div className="border-2 border-dashed border-slate-700 rounded-xl w-32 h-32 flex items-center justify-center animate-pulse">
                <Zap className="w-6 h-6 text-slate-600" />
              </div>
            )}
          </div>

          {/* CONTROL PANEL */}
          <div className="glass-card p-6">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept="image/*"
            />
            
            <button 
              onClick={() => !isProcessing && fileInputRef.current.click()}
              disabled={isProcessing}
              className={clsx(
                "w-full py-4 rounded-xl font-bold text-sm tracking-wide transition-all flex items-center justify-center space-x-2",
                isProcessing 
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-lg shadow-emerald-500/20"
              )}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>PROCESSING...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>NEW SCAN</span>
                </>
              )}
            </button>
          </div>

        </div>
      </main>
    </div>
  );
}

export default App;