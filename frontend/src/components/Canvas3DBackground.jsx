import React, { useEffect, useRef } from 'react';

export default function Canvas3DBackground({ role = null, theme = 'dark', concept = 'concept1' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
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
    window.addEventListener('mousemove', handleMouseMove);

    // Particle field with Z-depth
    const PARTICLE_COUNT = 120;
    const particles = [];

    // Colors tailored by role, concept & theme
    const getColors = () => {
      if (role === 'admin') {
        return ['#f59e0b', '#d97706', '#fbbf24', '#f43f5e', '#6366f1'];
      }
      if (role === 'student') {
        return ['#38bdf8', '#0284c7', '#818cf8', '#34d399', '#a855f7'];
      }
      if (concept === 'concept1' && theme === 'dark') {
        // Deep Ocean Bioluminescence — teal, emerald, cyan glow
        return ['#10b981', '#34d399', '#06b6d4', '#14b8a6', '#6ee7b7'];
      }
      return theme === 'dark'
        ? ['#38bdf8', '#818cf8', '#06b6d4', '#3b82f6', '#60a5fa']
        : ['#6366f1', '#ec4899', '#f97316', '#0ea5e9', '#8b5cf6'];
    };

    let colors = getColors();

    class Particle3D {
      constructor() {
        this.reset(true);
      }

      reset(initial = false) {
        this.x = (Math.random() - 0.5) * width * 1.5;
        this.y = (Math.random() - 0.5) * height * 1.5;
        this.z = initial ? Math.random() * 1000 : 1000;
        this.baseSize = Math.random() * 2.8 + 1.2;
        this.speed = Math.random() * 0.8 + 0.3;
        this.color = colors[Math.floor(Math.random() * colors.length)];
        this.angle = Math.random() * Math.PI * 2;
        this.orbitSpeed = (Math.random() - 0.5) * 0.008;
        this.orbitRadius = Math.random() * 35;
      }

      update() {
        this.z -= this.speed;
        this.angle += this.orbitSpeed;

        if (this.z <= 0) {
          this.reset();
        }
      }

      draw(focalLength, cx, cy) {
        if (this.z <= 0) return;

        // 3D Perspective Projection
        const scale = focalLength / (focalLength + this.z);
        const mouseOffsetX = (mouse.x - width / 2) * (1 - scale) * 0.45;
        const mouseOffsetY = (mouse.y - height / 2) * (1 - scale) * 0.45;

        const screenX = cx + (this.x + Math.cos(this.angle) * this.orbitRadius) * scale + mouseOffsetX;
        const screenY = cy + (this.y + Math.sin(this.angle) * this.orbitRadius) * scale + mouseOffsetY;
        const size = Math.max(0.8, this.baseSize * scale * 2.6);

        const opacity = Math.min(1, Math.max(0, (1 - this.z / 1000) * (theme === 'dark' ? 0.9 : 0.75)));

        ctx.save();
        ctx.beginPath();
        ctx.arc(screenX, screenY, size, 0, Math.PI * 2);

        // Glow halo
        ctx.shadowBlur = size * 4;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.globalAlpha = opacity;
        ctx.fill();
        ctx.restore();

        return { screenX, screenY, opacity, z: this.z };
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push(new Particle3D());
    }

    // Connect close particles in 3D space
    const connectParticles = (projected) => {
      const maxDistance = 125;
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const p1 = projected[i];
          const p2 = projected[j];
          if (!p1 || !p2) continue;

          // Don't connect particles too far in depth
          if (Math.abs(p1.z - p2.z) > 180) continue;

          const dx = p1.screenX - p2.screenX;
          const dy = p1.screenY - p2.screenY;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < maxDistance) {
            const lineOpacity = (1 - dist / maxDistance) * Math.min(p1.opacity, p2.opacity) * 0.35;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p1.screenX, p1.screenY);
            ctx.lineTo(p2.screenX, p2.screenY);
            ctx.strokeStyle = theme === 'dark' ? '#818cf8' : '#6366f1';
            ctx.globalAlpha = lineOpacity;
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
          }
        }
      }
    };

    // Render loop
    const focalLength = 320;
    const render = () => {
      // Ease mouse
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      ctx.clearRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;
      const projected = [];

      for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        const pt = particles[i].draw(focalLength, cx, cy);
        if (pt) projected.push(pt);
      }

      connectParticles(projected);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [role, theme]);

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
        zIndex: 2,
      }}
    />
  );
}
