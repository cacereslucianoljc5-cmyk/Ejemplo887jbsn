import React, { useEffect, useRef } from 'react';

// Adapted from Cursify <SpotlightCursor/> + useSpotlightEffect hook.
// The original paints a DARK overlay with a hole (built for dark themes).
// This site is 70% paper-white, so we invert it: an ADDITIVE lime glow that
// follows the cursor with the same lerp smoothing + pulse from the hook.
export default function SpotlightCursor({
  size = 260,
  intensity = 0.16,
  smoothing = 0.12,
  color = '204, 255, 1', // lime #CCFF01
  pulseSpeed = 2600,
}) {
  const canvasRef = useRef(null);
  const pos = useRef({ x: -9999, y: -9999 });
  const target = useRef({ x: -9999, y: -9999 });
  const raf = useRef(null);
  const active = useRef(false);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return; // skip touch
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    const lerp = (a, b, f) => a + (b - a) * f;
    const onMove = (e) => {
      target.current = { x: e.clientX, y: e.clientY };
      active.current = true;
    };
    const onLeave = () => { active.current = false; };

    const render = () => {
      pos.current.x = lerp(pos.current.x, target.current.x, smoothing);
      pos.current.y = lerp(pos.current.y, target.current.y, smoothing);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (active.current) {
        const pulse = 1 + 0.08 * Math.sin((Date.now() / pulseSpeed) * Math.PI * 2);
        const r = size * pulse;
        const g = ctx.createRadialGradient(
          pos.current.x, pos.current.y, 0,
          pos.current.x, pos.current.y, r
        );
        g.addColorStop(0, `rgba(${color}, ${intensity})`);
        g.addColorStop(0.4, `rgba(${color}, ${intensity * 0.4})`);
        g.addColorStop(1, `rgba(${color}, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pos.current.x, pos.current.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf.current = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseout', onLeave);
    raf.current = requestAnimationFrame(render);
    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [size, intensity, smoothing, color, pulseSpeed]);

  return <canvas ref={canvasRef} className="spotlight-cursor" aria-hidden="true" />;
}
