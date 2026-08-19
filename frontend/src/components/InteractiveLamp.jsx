import React, { useState, useRef, useEffect, useCallback } from 'react';

export default function InteractiveLamp({
  isOn = false,
  onToggle = () => {},
  isTypingPassword = false,
}) {
  // Drag & Hover physics state: supports X/Y elastic deflection + hover sway
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [cordOffset, setCordOffset] = useState({ x: 0, y: 0 });
  const [springAnimation, setSpringAnimation] = useState({ x: 0, y: 0, angle: 0 });

  const dragStartRef = useRef({ x: 0, y: 0 });
  const currentOffsetRef = useRef({ x: 0, y: 0 });
  const springAnimFrameRef = useRef(null);
  const hoverAnimFrameRef = useRef(null);

  // Synthesize realistic mechanical pull switch click
  const playClickSound = useCallback((turningOn) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(turningOn ? 920 : 720, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.085);
    } catch {
      // Audio context policy
    }
  }, []);

  // Hover floating motion loop
  useEffect(() => {
    if (isDragging) return;

    let startTime = performance.now();

    const animateHover = (currentTime) => {
      if (!isDragging) {
        const time = (currentTime - startTime) * 0.003;
        
        if (isHovered) {
          // Gentle lively hover sway motion
          const swayX = Math.sin(time * 2.8) * 8.5;
          const bounceY = (Math.sin(time * 5.6) + 1) * 2.5;
          const tiltAngle = Math.sin(time * 2.8) * 14;

          setCordOffset({ x: swayX, y: bounceY });
          setSpringAnimation({ x: swayX, y: bounceY, angle: tiltAngle });
        } else {
          // Subtle resting breathing sway (very gentle)
          const subtleSway = Math.sin(time * 1.5) * 1.2;
          setCordOffset({ x: subtleSway, y: 0 });
          setSpringAnimation({ x: subtleSway, y: 0, angle: subtleSway * 2 });
        }
      }
      hoverAnimFrameRef.current = requestAnimationFrame(animateHover);
    };

    hoverAnimFrameRef.current = requestAnimationFrame(animateHover);

    return () => {
      if (hoverAnimFrameRef.current) cancelAnimationFrame(hoverAnimFrameRef.current);
    };
  }, [isHovered, isDragging]);

  const handlePointerDown = (e) => {
    e.preventDefault();
    if (springAnimFrameRef.current) cancelAnimationFrame(springAnimFrameRef.current);
    if (hoverAnimFrameRef.current) cancelAnimationFrame(hoverAnimFrameRef.current);

    setIsDragging(true);
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;

    dragStartRef.current = { x: clientX, y: clientY };
    currentOffsetRef.current = { x: 0, y: 0 };
    setSpringAnimation({ x: 0, y: 0, angle: 0 });
  };

  const handlePointerMove = useCallback(
    (e) => {
      if (!isDragging) return;
      const clientX = e.clientX || (e.touches && e.touches[0]?.clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0]?.clientY) || 0;

      const rawDx = clientX - dragStartRef.current.x;
      const rawDy = clientY - dragStartRef.current.y;

      // Elastic non-linear resistance formula
      const maxDistance = 95;
      const distance = Math.sqrt(rawDx * rawDx + rawDy * rawDy);
      const resistedDist = Math.min(maxDistance, distance * 0.78);
      const angle = Math.atan2(rawDy, rawDx);

      const resistedX = Math.cos(angle) * resistedDist * 0.88;
      const resistedY = Math.max(0, Math.sin(angle) * resistedDist);

      currentOffsetRef.current = { x: resistedX, y: resistedY };
      setCordOffset({ x: resistedX, y: resistedY });
    },
    [isDragging]
  );

  // Recoil spring harmonic oscillation on release
  const handlePointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    const { x: releaseX, y: releaseY } = currentOffsetRef.current;
    const shouldToggle = releaseY > 20 || (Math.abs(releaseX) < 5 && releaseY < 5);

    if (shouldToggle) {
      playClickSound(!isOn);
      onToggle(!isOn);
    }

    // Damped harmonic oscillator simulation
    let startTime = performance.now();
    const duration = 750; // ms
    const initialAmplitudeX = releaseX;
    const initialAmplitudeY = releaseY;

    const animateSpring = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = elapsed / duration;

      if (progress < 1) {
        const decay = Math.exp(-progress * 5.0);
        const bounceY = initialAmplitudeY * decay * Math.cos(progress * Math.PI * 8);
        const swayX = initialAmplitudeX * decay * Math.cos(progress * Math.PI * 6);
        const tiltAngle = (swayX / 40) * 20 * decay;

        setCordOffset({ x: swayX, y: Math.max(0, bounceY) });
        setSpringAnimation({ x: swayX, y: bounceY, angle: tiltAngle });

        springAnimFrameRef.current = requestAnimationFrame(animateSpring);
      } else {
        setCordOffset({ x: 0, y: 0 });
        setSpringAnimation({ x: 0, y: 0, angle: 0 });
        currentOffsetRef.current = { x: 0, y: 0 };
      }
    };

    springAnimFrameRef.current = requestAnimationFrame(animateSpring);
  }, [isDragging, isOn, onToggle, playClickSound]);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      window.addEventListener('touchmove', handlePointerMove);
      window.addEventListener('touchend', handlePointerUp);
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isDragging, handlePointerMove, handlePointerUp]);

  // Coordinates for dynamic Cubic Bézier String Curve (Tucked inside the lamp socket)
  const cordOriginX = 108;
  const cordOriginY = 188;
  const cordBaseEndY = 272;

  const targetEndX = cordOriginX + cordOffset.x;
  const targetEndY = cordBaseEndY + cordOffset.y;

  // Dual control points for ultra-smooth realistic sag & bend
  const cp1X = cordOriginX + cordOffset.x * 0.22;
  const cp1Y = cordOriginY + (targetEndY - cordOriginY) * 0.36;

  const cpMidX = cordOriginX + cordOffset.x * 0.5;
  const cpMidY = cordOriginY + (targetEndY - cordOriginY) * 0.55;

  const cp2X = cordOriginX + cordOffset.x * 0.76;
  const cp2Y = cordOriginY + (targetEndY - cordOriginY) * 0.76;

  const cordPath = `M ${cordOriginX} ${cordOriginY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${targetEndX} ${targetEndY}`;

  // Tangent angle of the knob at string end
  const knobAngle = (cordOffset.x / 80) * 28 + springAnimation.angle;

  return (
    <div className={`lamp-scene ${isOn ? 'lamp-on' : 'lamp-off'}`}>
      {/* Volumetric Light Beam Cone (Visible when ON) */}
      <div className="lamp-light-cone"></div>

      {/* Floating Dust Motes in Light Beam */}
      {isOn && (
        <div className="lamp-dust-container">
          <div className="dust-particle dp-1"></div>
          <div className="dust-particle dp-2"></div>
          <div className="dust-particle dp-3"></div>
          <div className="dust-particle dp-4"></div>
          <div className="dust-particle dp-5"></div>
        </div>
      )}

      {/* Interactive Lamp SVG Visual */}
      <div className="lamp-body-wrapper">
        <svg
          viewBox="0 0 280 410"
          className="lamp-svg"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Lampshade Gradients */}
            <linearGradient id="shadeOffGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#4A4E5A" />
              <stop offset="45%" stopColor="#2D323E" />
              <stop offset="100%" stopColor="#1C2029" />
            </linearGradient>

            <linearGradient id="shadeOnGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#9C877B" />
              <stop offset="40%" stopColor="#78665B" />
              <stop offset="100%" stopColor="#4E3E36" />
            </linearGradient>

            {/* Brass Pull Knob Gradient */}
            <linearGradient id="brassKnobGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FEF08A" />
              <stop offset="40%" stopColor="#F59E0B" />
              <stop offset="85%" stopColor="#B45309" />
              <stop offset="100%" stopColor="#78350F" />
            </linearGradient>

            {/* Metallic Stand & Base Gradients */}
            <linearGradient id="standGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="35%" stopColor="#F8FAFC" />
              <stop offset="70%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            <linearGradient id="baseGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#CBD5E1" />
              <stop offset="60%" stopColor="#64748B" />
              <stop offset="100%" stopColor="#334155" />
            </linearGradient>

            <linearGradient id="bulbChamberGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#FFFBEB" />
              <stop offset="60%" stopColor="#FEF08A" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>

            <filter id="lampGlowFilter" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="10" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Lamp Base Platform Drop Shadow */}
          <ellipse cx="140" cy="380" rx="65" ry="14" fill="rgba(0,0,0,0.5)" filter="blur(6px)" />

          {/* Lamp Base Platform */}
          <ellipse cx="140" cy="370" rx="56" ry="13" fill="url(#baseGrad)" />
          <ellipse cx="140" cy="367" rx="52" ry="10" fill="#E2E8F0" opacity={isOn ? 0.95 : 0.45} />

          {/* Lamp Pole Stand */}
          <rect x="133" y="160" width="14" height="210" rx="4" fill="url(#standGrad)" />

          {/* Glowing Bulb Chamber under Lampshade */}
          {isOn && (
            <g filter="url(#lampGlowFilter)">
              <ellipse cx="140" cy="180" rx="70" ry="16" fill="url(#bulbChamberGrad)" />
              <circle cx="140" cy="176" r="15" fill="#FFFFFF" />
            </g>
          )}

          {/* 3D Modern Lampshade Body */}
          <path
            d="M 85 45 Q 140 35 195 45 L 215 175 Q 140 195 65 175 Z"
            fill={isOn ? 'url(#shadeOnGrad)' : 'url(#shadeOffGrad)'}
            stroke={isOn ? 'rgba(254, 243, 199, 0.45)' : 'rgba(255, 255, 255, 0.18)'}
            strokeWidth="1.6"
          />

          {/* Lampshade Top Bezel Rim */}
          <ellipse cx="140" cy="45" rx="55" ry="8" fill={isOn ? '#6E5D53' : '#333742'} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

          {/* Cute Face Expressions on Lampshade */}
          <g className="lamp-face-group">
            {!isOn ? (
              /* Sleeping Face (When OFF) */
              <g className="face-sleeping">
                {/* Left Sleeping Eye with Eyelash */}
                <path
                  d="M 96 108 Q 106 118 116 108"
                  stroke="#FEF08A"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Right Sleeping Eye with Eyelash */}
                <path
                  d="M 164 108 Q 174 118 184 108"
                  stroke="#FEF08A"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Cute Rosy Sleeping Blush */}
                <ellipse cx="90" cy="116" rx="7" ry="4" fill="#FB7185" opacity="0.65" />
                <ellipse cx="190" cy="116" rx="7" ry="4" fill="#FB7185" opacity="0.65" />
                {/* Cute Sleeping Smile */}
                <path
                  d="M 134 122 Q 140 127 146 122"
                  stroke="#FEF08A"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* High Contrast Z-Z-Z Snore */}
                <text x="194" y="82" fill="#FEF08A" fontSize="18" fontWeight="800" opacity="0.95">
                  z
                </text>
                <text x="210" y="66" fill="#FDE047" fontSize="14" fontWeight="800" opacity="0.85">
                  z
                </text>
                <text x="224" y="52" fill="#FACC15" fontSize="11" fontWeight="800" opacity="0.7">
                  z
                </text>
              </g>
            ) : isTypingPassword ? (
              /* Shy Closed Eyes when typing password */
              <g className="face-shy">
                <path
                  d="M 96 108 L 106 115 L 116 108"
                  stroke="#1C1917"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  d="M 164 108 L 174 115 L 184 108"
                  stroke="#1C1917"
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <ellipse cx="90" cy="118" rx="8" ry="4" fill="#F43F5E" opacity="0.65" />
                <ellipse cx="190" cy="118" rx="8" ry="4" fill="#F43F5E" opacity="0.65" />
                <path
                  d="M 134 122 Q 140 126 146 122"
                  stroke="#1C1917"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            ) : (
              /* Happy Cheerful Awake Face */
              <g className="face-awake">
                <path
                  d="M 96 108 Q 106 96 116 108"
                  stroke="#1C1917"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 164 108 Q 174 96 184 108"
                  stroke="#1C1917"
                  strokeWidth="4.2"
                  strokeLinecap="round"
                  fill="none"
                />
                <ellipse cx="90" cy="116" rx="8" ry="4" fill="#FB7185" opacity="0.6" />
                <ellipse cx="190" cy="116" rx="8" ry="4" fill="#FB7185" opacity="0.6" />
                {/* Cheerful Open Smile */}
                <path
                  d="M 127 114 Q 140 136 153 114 Q 140 120 127 114 Z"
                  fill="#1C1917"
                />
                <path
                  d="M 133 123 Q 140 135 147 123 Z"
                  fill="#F43F5E"
                />
              </g>
            )}
          </g>

          {/* ===============================================================
              DYNAMIC FLEXIBLE PULL STRING & HOVER SWAY PHYSICS
              =============================================================== */}
          <g
            className="lamp-cord-interactive-layer"
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
          >
            {/* Invisible full-length thick hit area: allows pulling from ANY point on the string */}
            <path
              d={cordPath}
              stroke="transparent"
              strokeWidth="48"
              strokeLinecap="round"
              fill="none"
              onPointerDown={handlePointerDown}
              style={{ cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'all' }}
            />

            {/* Elastic Flexible Cord Path emerging from inside the lamp */}
            <path
              d={cordPath}
              stroke={isHovered ? '#FEF08A' : '#E2E8F0'}
              strokeWidth={isHovered ? '3.2' : '2.8'}
              strokeLinecap="round"
              fill="none"
              filter={isHovered ? 'drop-shadow(0 0 6px rgba(254, 240, 138, 0.7))' : 'drop-shadow(0 2px 3px rgba(0,0,0,0.4))'}
              onPointerDown={handlePointerDown}
              style={{ cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'all', transition: 'stroke 0.2s ease, stroke-width 0.2s ease' }}
            />

            {/* Cord Beaded Chain Texture Links */}
            <circle cx={cp1X} cy={cp1Y} r="2.4" fill={isHovered ? '#FEF08A' : '#F8FAFC'} opacity="0.9" onPointerDown={handlePointerDown} style={{ cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'all' }} />
            <circle cx={cpMidX} cy={cpMidY} r="2.4" fill={isHovered ? '#FEF08A' : '#F8FAFC'} opacity="0.9" onPointerDown={handlePointerDown} style={{ cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'all' }} />
            <circle cx={cp2X} cy={cp2Y} r="2.4" fill={isHovered ? '#FEF08A' : '#F8FAFC'} opacity="0.9" onPointerDown={handlePointerDown} style={{ cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'all' }} />

            {/* Interactive Pull Knob & Touch Target */}
            <g
              transform={`translate(${targetEndX}, ${targetEndY}) rotate(${knobAngle})`}
              onPointerDown={handlePointerDown}
              style={{ cursor: isDragging ? 'grabbing' : 'grab', pointerEvents: 'all' }}
            >
              {/* Invisible Large Hit Area for effortless grabbing */}
              <circle cx="0" cy="6" r="32" fill="transparent" />

              {/* Knob Drop Shadow */}
              <ellipse cx="0" cy="12" rx="6" ry="3" fill="rgba(0,0,0,0.4)" filter="blur(2px)" />

              {/* Metallic Brass Pull Cylinder & Acorn Bell */}
              <rect x="-4.5" y="0" width="9" height="12" rx="3.5" fill="url(#brassKnobGrad)" stroke={isHovered ? '#FFFFFF' : '#FEF08A'} strokeWidth={isHovered ? '1.2' : '0.8'} filter={isHovered ? 'drop-shadow(0 0 8px rgba(254, 240, 138, 0.8))' : 'none'} />
              <circle cx="0" cy="12" r="5" fill="url(#brassKnobGrad)" stroke={isHovered ? '#FFFFFF' : '#FEF08A'} strokeWidth={isHovered ? '1.2' : '0.8'} />

              {/* Specular Light Reflection */}
              <ellipse cx="-1.5" cy="4" rx="1.2" ry="4" fill="#FFFFFF" opacity="0.85" />
              <circle cx="-1.5" cy="11" r="1.2" fill="#FFFFFF" opacity="0.9" />
            </g>
          </g>
        </svg>
      </div>

      {/* Floating Pull Hint Button */}
      <button
        type="button"
        className="lamp-pull-cue-pill"
        onClick={() => {
          playClickSound(!isOn);
          onToggle(!isOn);
        }}
      >
        <span>👇</span>
        <span>{isOn ? 'Click / Pull string to turn OFF' : 'Click / Pull string to turn ON'}</span>
      </button>
    </div>
  );
}
