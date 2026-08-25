import React, { useId } from 'react';
import './FuturisticLoader.css';

/**
 * FuturisticLoader - A premium, minimal circular ring loader matching the HostelCare 3D aesthetic.
 * Simulates a digital scanner / holographic credential verification sequence.
 *
 * @param {('sm'|'md'|'lg'|number)} size - Size of the loader ('sm': 22px, 'md': 36px, 'lg': 56px, or custom px)
 * @param {string} className - Optional additional CSS class
 * @param {string} variant - 'ring' (default) | 'scanner' | 'pulse'
 */
export default function FuturisticLoader({
  size = 'sm',
  className = '',
  variant = 'ring',
}) {
  const reactId = useId();
  const ringGradId = `cyberRingGrad-${reactId.replace(/:/g, '')}`;
  const trackGradId = `cyberTrackGrad-${reactId.replace(/:/g, '')}`;
  const glowFilterId = `cyanGlow-${reactId.replace(/:/g, '')}`;

  let dimension = 22;
  if (typeof size === 'number') {
    dimension = size;
  } else if (size === 'sm') {
    dimension = 22;
  } else if (size === 'md') {
    dimension = 36;
  } else if (size === 'lg') {
    dimension = 56;
  }

  const strokeWidth = dimension <= 24 ? 2 : dimension <= 40 ? 2.5 : 3;
  const radius = Math.max(1, (dimension - strokeWidth * 2) / 2);
  const circumference = 2 * Math.PI * radius;
  // Arc length for the leading scanner beam (72% visible arc, 28% gap)
  const strokeDasharray = `${circumference * 0.72} ${circumference * 0.28}`;

  return (
    <div
      className={`futuristic-loader-root futuristic-loader-${variant} ${className}`}
      style={{ width: `${dimension}px`, height: `${dimension}px` }}
      role="status"
      aria-label="Verifying credentials"
    >
      <svg
        className="futuristic-loader-svg"
        viewBox={`0 0 ${dimension} ${dimension}`}
        width={dimension}
        height={dimension}
      >
        <defs>
          <linearGradient id={ringGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00f2fe" stopOpacity="1" />
            <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#6366f1" stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id={trackGradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.08" />
          </linearGradient>
          <filter id={glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation={dimension <= 24 ? '0.8' : '1.8'} result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Ambient Guide Track */}
        <circle
          className="futuristic-track"
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={`url(#${trackGradId})`}
          strokeWidth={strokeWidth}
        />

        {/* Rotating Futuristic Arc with Cyan/Blue Glow */}
        <circle
          className="futuristic-ring"
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          fill="none"
          stroke={`url(#${ringGradId})`}
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeLinecap="round"
          filter={`url(#${glowFilterId})`}
        />

        {/* Inner Digital Scanner Core Dot */}
        <circle
          className="futuristic-core-dot"
          cx={dimension / 2}
          cy={dimension / 2}
          r={Math.max(1.3, dimension * 0.08)}
          fill="#38bdf8"
        />
      </svg>
    </div>
  );
}
