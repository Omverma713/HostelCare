import React, { useState, useEffect } from 'react';

export default function IsometricHostelRoom3D({ role = null }) {
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      setMouseOffset({ x: nx, y: ny });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const podTilt = `perspective(1000px) rotateX(${10 - mouseOffset.y * 12}deg) rotateY(${-12 + mouseOffset.x * 14}deg) translateZ(10px)`;
  const cardFloat = `translate3d(${mouseOffset.x * -16}px, ${mouseOffset.y * -14}px, 45px) rotate(${mouseOffset.x * 8}deg)`;
  const badge1Float = `translate3d(${mouseOffset.x * 12}px, ${mouseOffset.y * 10}px, 30px)`;
  const badge2Float = `translate3d(${mouseOffset.x * -10}px, ${mouseOffset.y * 14}px, 35px)`;

  return (
    <div className="iso-room-container" aria-label="3D Isometric Hostel Room Pod">
      {/* 3D Floating Feature Badges */}
      <div className="iso-floating-badge iso-badge-card" style={{ transform: cardFloat }}>
        <div className="iso-badge-icon">💳</div>
        <div className="iso-badge-text">
          <span className="iso-badge-title">Smart Access</span>
          <span className="iso-badge-sub">RFID Keycard Active</span>
        </div>
      </div>

      <div className="iso-floating-badge iso-badge-room" style={{ transform: badge1Float }}>
        <div className="iso-badge-icon">🛏️</div>
        <div className="iso-badge-text">
          <span className="iso-badge-title">Room 302-B</span>
          <span className="iso-badge-sub">Block H-1 Assigned</span>
        </div>
      </div>

      <div className="iso-floating-badge iso-badge-status" style={{ transform: badge2Float }}>
        <div className="iso-badge-icon">⚡</div>
        <div className="iso-badge-text">
          <span className="iso-badge-title">24/7 Portal</span>
          <span className="iso-badge-sub">Care & Maintenance</span>
        </div>
      </div>

      {/* 3D Isometric Room Pod Visual */}
      <div className="iso-room-pod-wrapper" style={{ transform: podTilt }}>
        <div className="iso-pod-halo"></div>

        <svg
          viewBox="0 0 400 400"
          className="iso-room-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Room Gradients */}
            <linearGradient id="floorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B2618" />
              <stop offset="100%" stopColor="#22140C" />
            </linearGradient>

            <linearGradient id="wallBackLeft" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2A324B" />
              <stop offset="100%" stopColor="#171C2E" />
            </linearGradient>

            <linearGradient id="wallBackRight" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#394465" />
              <stop offset="100%" stopColor="#1E243A" />
            </linearGradient>

            <linearGradient id="bedSheetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#1D4ED8" />
            </linearGradient>

            <linearGradient id="deskGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#E2A76F" />
              <stop offset="100%" stopColor="#A76834" />
            </linearGradient>

            <radialGradient id="lampGlowLight" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FEF08A" stopOpacity="0.85" />
              <stop offset="40%" stopColor="#F59E0B" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
            </radialGradient>

            <filter id="neonSoftGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Pod Base Shadow */}
          <ellipse cx="200" cy="355" rx="160" ry="38" fill="rgba(0,0,0,0.5)" filter="blur(10px)" />

          {/* Isometric Ground Outer Ring Platform */}
          <polygon
            points="200,370 370,270 200,170 30,270"
            fill="#0F172A"
            stroke="rgba(56, 189, 248, 0.4)"
            strokeWidth="2"
          />

          {/* Left Back Wall */}
          <polygon points="200,170 30,270 30,130 200,30" fill="url(#wallBackLeft)" stroke="rgba(255,255,255,0.08)" />

          {/* Right Back Wall */}
          <polygon points="200,170 370,270 370,130 200,30" fill="url(#wallBackRight)" stroke="rgba(255,255,255,0.08)" />

          {/* Floor */}
          <polygon points="200,170 360,265 200,360 40,265" fill="url(#floorGrad)" />

          {/* Window on Left Wall with Sunset/Neon Skyline view */}
          <polygon points="50,165 110,130 110,185 50,220" fill="#0B1329" stroke="rgba(56, 189, 248, 0.6)" strokeWidth="2" />
          <polygon points="54,169 106,134 106,181 54,216" fill="url(#bedSheetGrad)" opacity="0.45" />
          <line x1="80" y1="148" x2="80" y2="202" stroke="#38BDF8" strokeWidth="1.5" />
          <line x1="52" y1="193" x2="108" y2="158" stroke="#38BDF8" strokeWidth="1.5" />

          {/* 3D Student Bed (Left side) */}
          <g>
            {/* Bed Frame */}
            <polygon points="65,240 145,195 185,220 105,265" fill="#4B311E" />
            <polygon points="65,240 105,265 105,280 65,255" fill="#2E1D11" />
            <polygon points="105,265 185,220 185,235 105,280" fill="#3D2717" />

            {/* Mattress & Cyan Blanket */}
            <polygon points="70,235 142,193 180,216 108,258" fill="url(#bedSheetGrad)" filter="url(#neonSoftGlow)" />
            {/* Pillow */}
            <polygon points="120,202 140,192 155,200 135,210" fill="#FFFFFF" opacity="0.9" />
          </g>

          {/* Study Desk & Laptop Setup (Right Side) */}
          <g>
            {/* Wooden Desk Top */}
            <polygon points="230,225 310,180 340,198 260,243" fill="url(#deskGrad)" stroke="#5C3818" strokeWidth="1" />
            {/* Desk Legs */}
            <line x1="235" y1="230" x2="235" y2="280" stroke="#1E293B" strokeWidth="3" />
            <line x1="260" y1="243" x2="260" y2="295" stroke="#1E293B" strokeWidth="3" />
            <line x1="335" y1="200" x2="335" y2="250" stroke="#1E293B" strokeWidth="3" />

            {/* Glowing Laptop */}
            <polygon points="265,212 285,200 295,206 275,218" fill="#64748B" />
            {/* Open Laptop Screen */}
            <polygon points="285,200 285,185 295,191 295,206" fill="#38BDF8" filter="url(#neonSoftGlow)" />

            {/* Glowing Desk Lamp */}
            <circle cx="315" cy="180" r="32" fill="url(#lampGlowLight)" />
            <line x1="315" y1="188" x2="315" y2="195" stroke="#E2E8F0" strokeWidth="2.5" />
            <ellipse cx="315" cy="195" rx="5" ry="3" fill="#94A3B8" />

            {/* Books on Bookshelf (Upper right wall) */}
            <polygon points="250,110 320,70 340,82 270,122" fill="#5C3818" />
            <rect x="268" y="92" width="6" height="18" rx="1" fill="#F43F5E" />
            <rect x="276" y="88" width="6" height="22" rx="1" fill="#38BDF8" />
            <rect x="284" y="84" width="8" height="26" rx="1" fill="#FBBF24" />
            <rect x="294" y="80" width="7" height="30" rx="1" fill="#10B981" />
          </g>

          {/* Warm Ambient Floor Lighting */}
          <ellipse cx="270" cy="250" rx="45" ry="20" fill="rgba(251, 191, 36, 0.2)" filter="blur(8px)" />

          {/* Futuristic Ambient LED Base Trim */}
          <polyline
            points="30,270 200,370 370,270"
            stroke="#38BDF8"
            strokeWidth="3.5"
            strokeLinecap="round"
            filter="url(#neonSoftGlow)"
          />
        </svg>
      </div>
    </div>
  );
}
