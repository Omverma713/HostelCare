import React, { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import FuturisticHostel3DScene from './FuturisticHostel3DScene';

gsap.registerPlugin(ScrollTrigger);

/**
 * ScrollVideoBackground
 * 
 * Drives the 3D futuristic hostel campus environment synchronously with page scroll.
 * Features 3D architectural dormitory wings, glowing student room windows, illuminated
 * skywalks, volumetric fog, and spline camera fly-through with continuous lerp smoothing.
 */
export default function ScrollVideoBackground({
  videoSrc = '/videos/login-background.mp4',
  scrollContainerRef,
  onTelemetryUpdate,
  overlayOpacity = 0.35,
  vignetteStrength = 'heavy',
}) {
  const animFrameIdRef = useRef(null);
  const [currentProgress, setCurrentProgress] = useState(0);

  // Mutable refs for high-frequency animation loop
  const progressRef = useRef(0);
  const targetProgressRef = useRef(0);

  // GSAP ScrollTrigger setup
  useEffect(() => {
    const scrollElem = scrollContainerRef?.current || document.body;

    const st = ScrollTrigger.create({
      trigger: scrollElem,
      start: 'top top',
      end: 'bottom bottom',
      scrub: false,
      onUpdate: (self) => {
        targetProgressRef.current = Math.max(0, Math.min(1, self.progress));
      },
    });

    return () => {
      st.kill();
    };
  }, [scrollContainerRef]);

  // RequestAnimationFrame lerp loop
  useEffect(() => {
    let lastFpsTime = performance.now();
    let frameCount = 0;
    let currentFps = 60;

    const loop = (time) => {
      frameCount++;
      if (time - lastFpsTime >= 500) {
        currentFps = Math.round((frameCount * 1000) / (time - lastFpsTime));
        frameCount = 0;
        lastFpsTime = time;
      }

      // Smooth lerp
      const lerpFactor = 0.085;
      const prevProgress = progressRef.current;
      const targetProgress = targetProgressRef.current;
      progressRef.current += (targetProgress - prevProgress) * lerpFactor;

      if (Math.abs(progressRef.current - targetProgress) < 0.0001) {
        progressRef.current = targetProgress;
      }

      const smoothed = progressRef.current;
      setCurrentProgress(smoothed);

      if (onTelemetryUpdate) {
        onTelemetryUpdate({
          progress: smoothed,
          targetProgress,
          currentTime: smoothed * 10,
          duration: 10,
          fps: currentFps,
          isVideo: true,
        });
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
    };
  }, [onTelemetryUpdate]);

  return (
    <div className="fixed inset-0 w-full h-full pointer-events-none overflow-hidden select-none z-0">
      {/* 3D WebGL Futuristic Hostel Campus Scene */}
      <FuturisticHostel3DScene progress={currentProgress} />

      {/* Dark Translucent Tint Overlay */}
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[1px] transition-opacity duration-700 pointer-events-none"
        style={{ opacity: overlayOpacity }}
      />

      {/* Subtle Color Grading Overlay: Deep Indigo & Cyan Accents */}
      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-950/30 via-transparent to-cyan-950/20 mix-blend-color-dodge pointer-events-none" />

      {/* Cinematic Vignette Overlay */}
      <div
        className={`absolute inset-0 pointer-events-none ${
          vignetteStrength === 'heavy'
            ? 'cinematic-vignette-heavy'
            : vignetteStrength === 'medium'
            ? 'cinematic-vignette-medium'
            : 'cinematic-vignette-light'
        }`}
      />

      {/* High-tech Subtle Grid Grain */}
      <div className="absolute inset-0 opacity-[0.025] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Cinematic Top/Bottom Letterbox Glow */}
      <div className="absolute top-0 inset-x-0 h-28 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none" />
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
    </div>
  );
}
