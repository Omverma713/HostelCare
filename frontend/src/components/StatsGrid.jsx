import React, { memo, useRef, useState, useCallback } from 'react';

/**
 * Interactive 3D Floating Stat Card
 * Tracks pointer movement to compute perspective tilt and dynamic light glare.
 */
function TiltStatCard({ label, value, icon, bgColor, textColor, loading, index }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, isHovered: false });
  const rafRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    if (!cardRef.current) return;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const clientX = e.clientX;
    const clientY = e.clientY;

    rafRef.current = requestAnimationFrame(() => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // 3D perspective rotation angles (deg)
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;

      // Specular light coordinates (%)
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;

      setTilt({ rotateX, rotateY, glareX, glareY, isHovered: true });
    });
  }, []);

  const handleMouseEnter = useCallback(() => {
    setTilt((prev) => ({ ...prev, isHovered: true }));
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setTilt({ rotateX: 0, rotateY: 0, glareX: 50, glareY: 50, isHovered: false });
  }, []);

  // Float animation delay staggering based on index
  const floatDelay = `${index * 0.35}s`;

  // Status-specific subtitle taglines
  const getSubtext = (lbl) => {
    const l = lbl.toLowerCase();
    if (l.includes('total')) return 'All logged tickets';
    if (l.includes('pending')) return 'Awaiting dispatch';
    if (l.includes('progress')) return 'Actively underway';
    if (l.includes('resolved')) return 'Successfully closed';
    return 'Live metric';
  };

  return (
    <div
      ref={cardRef}
      className={`stat-card-3d-wrapper ${tilt.isHovered ? 'hovered' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        animationDelay: floatDelay,
        transform: `perspective(900px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg) ${
          tilt.isHovered ? 'translateZ(18px) scale(1.02)' : 'translateZ(0px) scale(1)'
        }`,
      }}
    >
      <div className="stat-card stat-card-3d">
        {/* Specular Glare Layer */}
        <div
          className="stat-card-glare"
          style={{
            opacity: tilt.isHovered ? 0.35 : 0,
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255, 255, 255, 0.45) 0%, transparent 65%)`,
          }}
        />

        {/* Ambient Neon Rim Glow */}
        <div
          className="stat-card-neon-glow"
          style={{
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, ${textColor}22 0%, transparent 70%)`,
          }}
        />

        {/* Elevated 3D Floating Icon Sphere */}
        <div
          className="stat-icon-3d-box"
          style={{
            backgroundColor: bgColor,
            color: textColor,
            boxShadow: `0 8px 20px -4px ${textColor}44`,
          }}
        >
          <span className="stat-icon-emoji">{icon}</span>
        </div>

        {/* Metric Info */}
        <div className="stat-info">
          <span className="stat-label">{label}</span>
          <span className="stat-value">{loading ? '…' : value}</span>
          <span className="stat-subtext">{getSubtext(label)}</span>
        </div>

        {/* Micro 3D Status Indicator Light */}
        <div className="stat-card-live-dot" style={{ backgroundColor: textColor }} />
      </div>
    </div>
  );
}

/**
 * Data-driven 3D stats cards grid.
 */
function StatsGrid({ stats, loading = false }) {
  return (
    <div className="stats-grid stats-grid-3d">
      {stats.map(({ label, value, icon, bgColor, textColor }, idx) => (
        <TiltStatCard
          key={label}
          label={label}
          value={value}
          icon={icon}
          bgColor={bgColor}
          textColor={textColor}
          loading={loading}
          index={idx}
        />
      ))}
    </div>
  );
}

export default memo(StatsGrid);
