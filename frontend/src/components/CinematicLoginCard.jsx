import React, { useRef, useState } from 'react';
import { ShieldCheck, Building2, Terminal } from 'lucide-react';
import CinematicLoginForm from './CinematicLoginForm';

export default function CinematicLoginCard({
  onLogin,
  onActivate,
  loading,
  selectedRole,
  setSelectedRole,
  telemetry,
}) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });

  const handleMouseMove = (e) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -5;
    const rotateY = ((x - centerX) / centerX) * 5;

    const glareX = (x / rect.width) * 100;
    const glareY = (y / rect.height) * 100;

    setTilt({ rotateX, rotateY, glareX, glareY });
  };

  const handleMouseLeave = () => {
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50 });
  };

  const progress = telemetry?.progress || 0;
  const parallaxOffsetY = (progress - 0.5) * -16;

  return (
    <div
      className="relative z-30 pointer-events-auto w-full max-w-md mx-auto transition-transform duration-300 ease-out my-auto"
      style={{
        transform: `translateY(${parallaxOffsetY}px)`,
        perspective: '1200px',
      }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transition: 'transform 0.15s ease-out',
        }}
        className="relative overflow-hidden rounded-3xl bg-slate-950/75 backdrop-blur-2xl border border-slate-700/70 p-6 sm:p-8 shadow-2xl shadow-black/90 text-center select-none"
      >
        {/* Dynamic Specular Light Glare */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-40 mix-blend-overlay"
          style={{
            background: `radial-gradient(circle 320px at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.22), transparent 70%)`,
          }}
        />

        {/* Ambient Top Glow Accent */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent" />
        <div className="absolute top-0 right-1/4 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Header: Logo, Title & Subtitle */}
        <div className="flex flex-col items-center mb-5 space-y-2">
          <div className="relative p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 shadow-lg shadow-cyan-950/50 mb-1">
            <Building2 className="w-7 h-7 text-cyan-400" />
            <div className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </div>
          </div>

          <div className="space-y-0.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
              <span>HostelCare</span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 bg-cyan-950/80 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                Portal
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Next-Gen Scroll-Driven Campus Living Ecosystem
            </p>
          </div>
        </div>

        {/* Form Component */}
        <CinematicLoginForm
          onLogin={onLogin}
          onActivate={onActivate}
          loading={loading}
          selectedRole={selectedRole}
          setSelectedRole={setSelectedRole}
        />

        {/* Footer */}
        <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>256-Bit Encrypted</span>
          </div>
          <div className="flex items-center gap-1 text-slate-400">
            <Terminal className="w-3 h-3 text-slate-400" />
            <span>HostelCare v2.5</span>
          </div>
        </div>
      </div>
    </div>
  );
}
