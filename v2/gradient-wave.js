'use strict';
// Animated gradient-wave background (original vanilla canvas implementation, no framework).
// Layered translucent sine bands in the NSE petrol/teal palette, drawn behind a host's content.
// Respects prefers-reduced-motion, pauses off-screen and in hidden tabs, caps pixel ratio at 2.
(() => {
  const LAYERS = [
    { amp: 0.10, len: 1.25, speed: 0.00022, y: 0.58, from: 'rgba(99,215,184,0.30)', to: 'rgba(18,123,105,0.00)' },
    { amp: 0.08, len: 0.90, speed: -0.00030, y: 0.66, from: 'rgba(56,178,172,0.26)', to: 'rgba(17,61,64,0.00)' },
    { amp: 0.12, len: 1.60, speed: 0.00016, y: 0.74, from: 'rgba(196,248,222,0.18)', to: 'rgba(99,215,184,0.04)' },
    { amp: 0.06, len: 0.70, speed: -0.00040, y: 0.84, from: 'rgba(18,123,105,0.40)', to: 'rgba(8,101,83,0.10)' }
  ];
  const reduced = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function mount(host) {
    if (!host || host.querySelector(':scope > canvas.nse-wave')) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'nse-wave';
    canvas.setAttribute('aria-hidden', 'true');
    host.prepend(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }
    let w = 0, h = 0, frame = 0, visible = true;

    const resize = () => {
      const r = host.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width); h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(performance.now());
    };

    function draw(t) {
      ctx.clearRect(0, 0, w, h);
      for (const L of LAYERS) {
        const base = h * L.y, amp = h * L.amp, k = (Math.PI * 2) / (w * L.len), phase = t * L.speed * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let x = 0; x <= w + 8; x += 8) {
          const y = base + Math.sin(x * k + phase) * amp + Math.sin(x * k * 0.5 - phase * 0.7) * amp * 0.45;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h); ctx.closePath();
        const g = ctx.createLinearGradient(0, base - amp, w, h);
        g.addColorStop(0, L.from); g.addColorStop(1, L.to);
        ctx.fillStyle = g; ctx.fill();
      }
    }

    const loop = t => { frame = 0; if (!visible || document.hidden || reduced()) return; draw(t); frame = requestAnimationFrame(loop); };
    const start = () => { if (!frame && visible && !document.hidden && !reduced()) frame = requestAnimationFrame(loop); };

    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host); else addEventListener('resize', resize);
    if ('IntersectionObserver' in window) new IntersectionObserver(e => { visible = e[0].isIntersecting; start(); }).observe(host);
    document.addEventListener('visibilitychange', start);
    resize(); start();
  }

  const style = document.createElement('style');
  style.textContent = '.nse-wave-host{position:relative;overflow:hidden;isolation:isolate}.nse-wave-host>canvas.nse-wave{position:absolute;inset:0;width:100%;height:100%;z-index:-1;pointer-events:none}';
  document.head.append(style);
  window.nseGradientWave = host => { if (!host) return; host.classList.add('nse-wave-host'); mount(host); };
  document.querySelectorAll('.login-story, .hero').forEach(window.nseGradientWave);
})();
