import React, { useRef, useEffect } from 'react';
import { Volume2, VolumeX, Activity, Compass, Film, ChevronDown } from 'lucide-react';

function formatTimecode(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(2, '0')}`;
}

const TIMELINE_MARKERS = [
  { label: '01. GATEWAY', progress: 0.00, caption: 'Campus Entrance' },
  { label: '02. CORRIDOR', progress: 0.25, caption: 'Dorm Wings A & B' },
  { label: '03. SKYBRIDGE', progress: 0.50, caption: 'Smart Skywalk' },
  { label: '04. SECURITY', progress: 0.75, caption: 'IoT Quad Node' },
  { label: '05. NEXUS', progress: 1.00, caption: 'Management Hub' },
];

export default function CinematicVideoHUD({
  telemetry,
  onSeekToProgress,
  isMuted = true,
  onToggleMute,
}) {
  const timecodeRef = useRef(null);
  const progressPercentRef = useRef(null);
  const progressBarRef = useRef(null);
  const fpsRef = useRef(null);

  useEffect(() => {
    if (!telemetry) return;

    if (timecodeRef.current) {
      timecodeRef.current.textContent = `${formatTimecode(telemetry.currentTime)} / ${formatTimecode(telemetry.duration || 10)}`;
    }
    if (progressPercentRef.current) {
      progressPercentRef.current.textContent = `${Math.round(telemetry.progress * 100)}%`;
    }
    if (progressBarRef.current) {
      progressBarRef.current.style.width = `${Math.min(100, Math.max(0, telemetry.progress * 100))}%`;
    }
    if (fpsRef.current && telemetry.fps) {
      fpsRef.current.textContent = `${telemetry.fps} FPS`;
    }
  }, [telemetry]);

  const handleMarkerClick = (targetProgress) => {
    if (onSeekToProgress) {
      onSeekToProgress(targetProgress);
    }
  };

  const handleScrubberClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const targetProgress = Math.max(0, Math.min(1, clickX / rect.width));
    if (onSeekToProgress) {
      onSeekToProgress(targetProgress);
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col justify-between p-4 md:p-8 select-none text-xs font-mono text-slate-300">
      {/* Top HUD Telemetry Bar */}
      <div className="flex items-center justify-between gap-4 pointer-events-auto">
        {/* Left: Brand / System Status */}
        <div className="flex items-center gap-3 bg-slate-950/70 backdrop-blur-md border border-slate-800/90 px-4 py-2 rounded-full shadow-xl shadow-black/50">
          <div className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
          </div>
          <span className="font-semibold tracking-wider text-slate-200 uppercase text-[11px] flex items-center gap-2">
            <Film className="w-3.5 h-3.5 text-cyan-400" />
            3D HOSTEL CAMPUS ENGINE
          </span>
          <span className="hidden sm:inline-block w-px h-3 bg-slate-700"></span>
          <span ref={fpsRef} className="hidden sm:inline-block text-[10px] text-cyan-400 font-bold tracking-tight">
            60 FPS
          </span>
        </div>

        {/* Right: Timecode */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-slate-950/70 backdrop-blur-md border border-slate-800/90 px-3.5 py-2 rounded-full shadow-xl">
            <Activity className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="text-slate-400 uppercase text-[10px] tracking-widest hidden md:inline">TIMECODE:</span>
            <span ref={timecodeRef} className="text-indigo-200 font-semibold tracking-wider">
              00:00.00 / 00:10.00
            </span>
          </div>

          {onToggleMute && (
            <button
              type="button"
              onClick={onToggleMute}
              title={isMuted ? 'Unmute audio' : 'Mute audio'}
              className="p-2 rounded-full bg-slate-950/70 backdrop-blur-md border border-slate-800/90 hover:border-cyan-500/50 hover:bg-slate-900 text-slate-300 hover:text-white transition-all cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
          )}
        </div>
      </div>

      {/* Floating Center-Bottom Scroll Indicator */}
      <div className="absolute bottom-24 inset-x-0 flex flex-col items-center justify-center pointer-events-none opacity-85 hover:opacity-100 transition-opacity">
        <div className="flex flex-col items-center gap-1.5 animate-bounce">
          <span className="text-[10px] tracking-[0.25em] uppercase text-cyan-300 font-bold bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 px-3.5 py-1 rounded-full shadow-xl">
            Scroll to navigate 3D campus
          </span>
          <ChevronDown className="w-4 h-4 text-cyan-400" />
        </div>
      </div>

      {/* Bottom Timeline Scrubber & Milestones */}
      <div className="pointer-events-auto w-full max-w-4xl mx-auto flex flex-col gap-2.5 bg-slate-950/80 backdrop-blur-xl border border-slate-800/90 p-3 md:p-4 rounded-2xl shadow-2xl shadow-black/80">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400 font-semibold tracking-wider">CAMPUS NAVIGATION:</span>
            <span ref={progressPercentRef} className="text-white font-bold">
              0%
            </span>
          </div>
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Compass className="w-3 h-3 text-cyan-400" />
            <span>Scroll-Controlled Camera Spline</span>
          </div>
        </div>

        {/* Clickable Progress Bar */}
        <div
          onClick={handleScrubberClick}
          className="relative w-full h-2.5 bg-slate-800/90 rounded-full overflow-hidden cursor-pointer group border border-slate-700/60 transition-all hover:h-3"
          title="Click to jump camera position"
        >
          <div
            ref={progressBarRef}
            className="h-full bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 rounded-full relative transition-[width] duration-75 ease-out shadow-[0_0_12px_rgba(6,182,212,0.8)]"
            style={{ width: '0%' }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_8px_#fff] opacity-90 group-hover:scale-125 transition-transform" />
          </div>
        </div>

        {/* Milestone Buttons */}
        <div className="grid grid-cols-5 gap-1.5 pt-1">
          {TIMELINE_MARKERS.map((marker, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleMarkerClick(marker.progress)}
              className="flex flex-col items-center justify-center p-1.5 rounded-lg bg-slate-900/70 hover:bg-cyan-950/50 border border-slate-800/70 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-200 transition-all cursor-pointer group"
            >
              <span className="text-[10px] font-bold text-slate-300 group-hover:text-white tracking-wider">
                {marker.label}
              </span>
              <span className="text-[9px] text-slate-400 hidden sm:inline">
                {marker.caption}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
