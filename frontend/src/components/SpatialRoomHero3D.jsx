import React, { useState, useEffect, useRef } from 'react';

/**
 * SpatialRoomHero3D
 * An interactive 3D Digital Twin Hostel Room Pod.
 * Features mouse parallax tilt, glowing ambient lighting, and clickable interactive hotspots (Electrical, Plumbing, Desk, Bed, Water) to pre-fill maintenance complaints.
 */
export default function SpatialRoomHero3D({ studentName, roomNo = '302-B', hostel = 'BH-1', onSelectHotspot }) {
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  const [activeHotspot, setActiveHotspot] = useState(null);
  const containerRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
      return;
    }

    const handleMouseMove = (e) => {
      if (!containerRef.current) return;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      const clientX = e.clientX;
      const clientY = e.clientY;

      rafRef.current = requestAnimationFrame(() => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const nx = ((x / rect.width) - 0.5) * 2;
        const ny = ((y / rect.height) - 0.5) * 2;
        setMouseOffset({ x: Math.max(-1, Math.min(1, nx)), y: Math.max(-1, Math.min(1, ny)) });
      });
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove, { passive: true });
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
      }
    };
  }, []);

  const handleMouseLeave = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setMouseOffset({ x: 0, y: 0 });
    setActiveHotspot(null);
  };

  const podTilt = `perspective(1000px) rotateX(${8 - mouseOffset.y * 10}deg) rotateY(${-10 + mouseOffset.x * 12}deg) translateZ(12px)`;
  const badge1Float = `translate3d(${mouseOffset.x * 14}px, ${mouseOffset.y * 12}px, 35px)`;
  const badge2Float = `translate3d(${mouseOffset.x * -12}px, ${mouseOffset.y * 14}px, 45px)`;

  const hotspots = [
    { id: 'electrical', label: 'Lighting / Power', icon: '⚡', category: 'Electrical', top: '38%', left: '72%' },
    { id: 'plumbing', label: 'Water & Pipes', icon: '🔧', category: 'Plumbing', top: '56%', left: '22%' },
    { id: 'furniture', label: 'Desk & Bed', icon: '🪑', category: 'Carpentry', top: '64%', left: '60%' },
    { id: 'civil', label: 'Walls & Fixtures', icon: '🧱', category: 'Civil', top: '28%', left: '38%' },
  ];

  return (
    <div
      ref={containerRef}
      className="spatial-room-card"
      onMouseLeave={handleMouseLeave}
      aria-label="3D Digital Twin Hostel Room Pod"
    >
      {/* Top Card Header */}
      <div className="spatial-room-topbar">
        <div className="spatial-room-title-group">
          <div className="spatial-top-eyebrow-row">
            <span className="spatial-live-pill">
              <span className="live-pulse-dot" /> DIGITAL TWIN POD
            </span>
            <span className="spatial-hostel-tag-chip">
              {hostel ? (hostel.toLowerCase().startsWith('hostel') ? hostel : `Hostel ${hostel}`) : 'Hostel BH-1'}
            </span>
          </div>
          <h3 className="spatial-room-heading">
            Room {roomNo}
          </h3>
        </div>
        <div className="spatial-telemetry-badge">
          <span className="telemetry-icon">📡</span>
          <span className="telemetry-text">Sensors Online</span>
        </div>
      </div>

      {/* Holographic Status Chips Row (Clean Non-Colliding Layout) */}
      <div className="spatial-room-chips-bar">
        <div className="spatial-room-meta-chip">
          <span className="chip-icon">💳</span>
          <div className="chip-content">
            <span className="chip-title">RFID Access</span>
            <span className="chip-subtitle">Keycard Verified</span>
          </div>
        </div>

        <div className="spatial-room-meta-chip">
          <span className="chip-icon">⚡</span>
          <div className="chip-content">
            <span className="chip-title">Smart Hub</span>
            <span className="chip-subtitle">24/7 Monitored</span>
          </div>
        </div>
      </div>

      {/* Interactive 3D Room Visual Stage */}
      <div className="spatial-pod-stage" style={{ transform: podTilt }}>
        <div className="spatial-pod-halo" />

        <svg
          viewBox="0 0 400 380"
          className="spatial-room-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="spatialFloor" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#1e2238" />
              <stop offset="50%" stopColor="#14172a" />
              <stop offset="100%" stopColor="#0c0e1d" />
            </linearGradient>

            <linearGradient id="spatialWallL" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#283050" />
              <stop offset="100%" stopColor="#171b30" />
            </linearGradient>

            <linearGradient id="spatialWallR" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#35406b" />
              <stop offset="100%" stopColor="#1e2540" />
            </linearGradient>

            <linearGradient id="spatialBed" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#4361ee" />
            </linearGradient>

            <linearGradient id="spatialWood" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#92400e" />
            </linearGradient>

            <radialGradient id="lampGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
            </radialGradient>

            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="5" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Pod Base Shadow */}
          <ellipse cx="200" cy="345" rx="155" ry="34" fill="rgba(0,0,0,0.6)" filter="blur(12px)" />

          {/* Isometric Ground Platform */}
          <polygon
            points="200,355 365,260 200,165 35,260"
            fill="#0b0e1e"
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth="2"
          />

          {/* Left Wall */}
          <polygon points="200,165 35,260 35,130 200,35" fill="url(#spatialWallL)" stroke="rgba(255,255,255,0.08)" />

          {/* Right Wall */}
          <polygon points="200,165 365,260 365,130 200,35" fill="url(#spatialWallR)" stroke="rgba(255,255,255,0.08)" />

          {/* Floor */}
          <polygon points="200,165 355,255 200,345 45,255" fill="url(#spatialFloor)" />

          {/* Futuristic Window with cyber skyline */}
          <polygon points="55,160 110,128 110,182 55,215" fill="#080c18" stroke="#38bdf8" strokeWidth="1.5" />
          <polygon points="58,163 107,132 107,178 58,210" fill="url(#spatialBed)" opacity="0.35" />
          <line x1="82" y1="145" x2="82" y2="198" stroke="#38bdf8" strokeWidth="1.2" />

          {/* 3D Student Bed */}
          <g>
            <polygon points="68,235 145,190 185,215 108,260" fill="#312215" />
            <polygon points="68,235 108,260 108,274 68,250" fill="#1c130c" />
            <polygon points="108,260 185,215 185,230 108,274" fill="#24170d" />
            {/* Cyan Blanket */}
            <polygon points="73,230 142,188 180,211 111,253" fill="url(#spatialBed)" filter="url(#neonGlow)" />
            {/* Pillow */}
            <polygon points="120,197 140,187 155,195 135,205" fill="#ffffff" opacity="0.9" />
          </g>

          {/* Study Desk & Glowing Laptop Setup */}
          <g>
            <polygon points="230,222 308,178 338,196 260,240" fill="url(#spatialWood)" stroke="#78350f" strokeWidth="1" />
            <line x1="235" y1="226" x2="235" y2="275" stroke="#334155" strokeWidth="3" />
            <line x1="260" y1="240" x2="260" y2="290" stroke="#334155" strokeWidth="3" />
            <line x1="333" y1="198" x2="333" y2="245" stroke="#334155" strokeWidth="3" />

            {/* Glowing Laptop */}
            <polygon points="262,210 282,198 292,204 272,216" fill="#475569" />
            <polygon points="282,198 282,183 292,189 292,204" fill="#38bdf8" filter="url(#neonGlow)" />

            {/* Desk Lamp */}
            <circle cx="312" cy="178" r="30" fill="url(#lampGlow)" />
            <line x1="312" y1="185" x2="312" y2="192" stroke="#cbd5e1" strokeWidth="2.5" />
            <ellipse cx="312" cy="192" rx="4.5" ry="2.5" fill="#94a3b8" />

            {/* Bookshelf with colorful books */}
            <polygon points="250,110 318,72 336,83 268,121" fill="#451a03" />
            <rect x="268" y="93" width="5" height="17" rx="1" fill="#f43f5e" />
            <rect x="275" y="89" width="5" height="21" rx="1" fill="#38bdf8" />
            <rect x="282" y="85" width="7" height="25" rx="1" fill="#fbbf24" />
            <rect x="291" y="81" width="6" height="29" rx="1" fill="#10b981" />
          </g>

          {/* Ambient LED Ground Border */}
          <polyline
            points="35,260 200,355 365,260"
            stroke="#38bdf8"
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#neonGlow)"
          />
        </svg>

        {/* Clickable Hotspot Pins */}
        {hotspots.map((spot) => (
          <button
            key={spot.id}
            type="button"
            className={`room-hotspot-pin ${activeHotspot === spot.id ? 'active' : ''}`}
            style={{ top: spot.top, left: spot.left }}
            onMouseEnter={() => setActiveHotspot(spot.id)}
            onMouseLeave={() => setActiveHotspot(null)}
            onClick={() => onSelectHotspot && onSelectHotspot(spot.category)}
            title={`Report ${spot.label} issue`}
          >
            <span className="hotspot-pulse-ring" />
            <span className="hotspot-dot">{spot.icon}</span>
            <span className="hotspot-tooltip">{spot.label}</span>
          </button>
        ))}
      </div>

      {/* Bottom Quick-Action Prompt */}
      <div className="spatial-room-footer">
        <span className="footer-hint">💡 Click any 3D pin to file an issue instantly</span>
      </div>
    </div>
  );
}
