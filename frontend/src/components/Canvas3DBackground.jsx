import React, { useEffect, useRef } from 'react';

export default function Canvas3DBackground({ role = null, theme = 'dark', concept = 'concept2' }) {
  const canvasRef = useRef(null);
  const themeRef = useRef(theme);
  const roleRef = useRef(role);
  const conceptRef = useRef(concept);

  themeRef.current = theme;
  roleRef.current = role;
  conceptRef.current = concept;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId;
    let isMounted = true;

    let width = (canvas.width = Math.max(window.innerWidth, window.screen?.width || 0));
    let height = (canvas.height = Math.max(window.innerHeight, window.screen?.height || 0));

    const handleResize = () => {
      if (!canvas || !isMounted) return;
      const newWidth = Math.max(window.innerWidth, window.screen?.width || 0);
      const newHeight = Math.max(window.innerHeight, window.screen?.height || 0);
      if (Math.abs(width - newWidth) > 50 || Math.abs(height - newHeight) > 100) {
        width = canvas.width = newWidth;
        height = canvas.height = newHeight;
      }
    };

    window.addEventListener('resize', handleResize);

    // Mouse coordinates with depth
    let mouse = {
      x: width / 2,
      y: height / 2,
      targetX: width / 2,
      targetY: height / 2,
    };

    const handleMouseMove = (e) => {
      mouse.targetX = e.clientX;
      mouse.targetY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // Particle field with Z-depth
    const isCoarse = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const isMobile = (typeof window !== 'undefined' && window.innerWidth < 768) || isCoarse;
    const PARTICLE_COUNT = isMobile ? 6 : 24;
    const particles = [];

    // Track active scrolling to eliminate frame drops during scrolling
    let isScrolling = false;
    let scrollTimer = null;
    const handleScroll = () => {
      isScrolling = true;
      if (scrollTimer) clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        isScrolling = false;
      }, 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Pause animation during theme switch to avoid frame collision with style recalculation
    let isSwitchingTheme = false;
    let themeSwitchTimer = null;
    const handleThemeSwitchStart = () => {
      isSwitchingTheme = true;
      if (themeSwitchTimer) clearTimeout(themeSwitchTimer);
      themeSwitchTimer = setTimeout(() => {
        isSwitchingTheme = false;
      }, 250);
    };
    window.addEventListener('theme-switching-start', handleThemeSwitchStart);

    const getColors = (currentRole, currentTheme, currentConcept) => {
      if (currentRole === 'admin') {
        return ['#f59e0b', '#d97706', '#fbbf24', '#f43f5e', '#6366f1'];
      }
      if (currentRole === 'student') {
        return ['#38bdf8', '#0284c7', '#818cf8', '#34d399', '#a855f7'];
      }
      if (currentConcept === 'concept4') {
        return currentTheme === 'dark'
          ? ['#d946ef', '#a855f7', '#8b5cf6', '#ec4899', '#38bdf8']
          : ['#c084fc', '#f472b6', '#e879f9', '#818cf8', '#fb7185'];
      }
      return currentTheme === 'dark'
        ? ['#38bdf8', '#818cf8', '#06b6d4', '#3b82f6', '#60a5fa']
        : ['#6366f1', '#ec4899', '#f97316', '#0ea5e9', '#8b5cf6'];
    };

    class Particle3D {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = (Math.random() - 0.5) * width * 1.5;
        this.y = (Math.random() - 0.5) * height * 1.5;
        this.z = initial ? Math.random() * 1000 : 1000;
        this.baseSize = Math.random() * 2.0 + 1.0;
        this.speed = Math.random() * 0.5 + 0.25;
        const currentColors = getColors(roleRef.current, themeRef.current, conceptRef.current);
        this.color = currentColors[Math.floor(Math.random() * currentColors.length)];
        this.angle = Math.random() * Math.PI * 2;
        this.orbitSpeed = (Math.random() - 0.5) * 0.005;
        this.orbitRadius = Math.random() * 20;
      }

      update() {
        this.z -= this.speed;
        this.angle += this.orbitSpeed;
        if (this.z <= 0) {
          this.reset();
        }
      }

      draw(focalLength, cx, cy) {
        if (this.z <= 0) return null;

        const scale = focalLength / (focalLength + this.z);
        const mouseOffsetX = isMobile ? 0 : (mouse.x - width / 2) * (1 - scale) * 0.35;
        const mouseOffsetY = isMobile ? 0 : (mouse.y - height / 2) * (1 - scale) * 0.35;

        const screenX = cx + (this.x + Math.cos(this.angle) * this.orbitRadius) * scale + mouseOffsetX;
        const screenY = cy + (this.y + Math.sin(this.angle) * this.orbitRadius) * scale + mouseOffsetY;
        const size = Math.max(0.8, this.baseSize * scale * 2.0);
        const opacity = Math.min(1, Math.max(0, (1 - this.z / 1000) * (themeRef.current === 'dark' ? 0.8 : 0.65)));

        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.globalAlpha = opacity;
        ctx.fill();

        return { screenX, screenY, opacity, z: this.z };
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle3D());
    }

    // Connect close particles in 3D space with single batched draw call
    const maxDistance = isMobile ? 50 : 85;
    const maxDistanceSq = maxDistance * maxDistance;

    const connectParticles = (projected) => {
      const len = projected.length;
      if (len < 2) return;

      const strokeColor = themeRef.current === 'dark' ? 'rgba(129, 140, 248, 0.25)' : 'rgba(99, 102, 241, 0.2)';
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 0.7;
      ctx.globalAlpha = 1;
      ctx.beginPath();

      let hasLines = false;
      for (let i = 0; i < len; i++) {
        const p1 = projected[i];
        if (!p1) continue;

        for (let j = i + 1; j < len; j++) {
          const p2 = projected[j];
          if (!p2 || Math.abs(p1.z - p2.z) > 120) continue;

          const dx = p1.screenX - p2.screenX;
          const dy = p1.screenY - p2.screenY;
          const distSq = dx * dx + dy * dy;

          if (distSq < maxDistanceSq) {
            ctx.moveTo(p1.screenX, p1.screenY);
            ctx.lineTo(p2.screenX, p2.screenY);
            hasLines = true;
          }
        }
      }

      if (hasLines) {
        ctx.stroke();
      }
    };

    const focalLength = 320;
    const render = () => {
      if (!isMounted) return;

      if (document.hidden) {
        return;
      }

      if (!isMobile) {
        mouse.x += (mouse.targetX - mouse.x) * 0.05;
        mouse.y += (mouse.targetY - mouse.y) * 0.05;
      }

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        const pt = particles[i].draw(focalLength, cx, cy);
        if (pt) projected.push(pt);
      }

      // Skip line mesh on mobile entirely (O(n²) per frame — not worth it on low-end GPUs)
      // Skip on scroll, skip during theme switching (avoids frame collision with style recalc)
      if (!isScrolling && !isMobile && !isSwitchingTheme) {
        connectParticles(projected);
      }

      animationFrameId = requestAnimationFrame(render);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden && isMounted) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(render);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    render();

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('theme-switching-start', handleThemeSwitchStart);
      if (scrollTimer) clearTimeout(scrollTimer);
      if (themeSwitchTimer) clearTimeout(themeSwitchTimer);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="canvas-3d-bg"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    />
  );
}
