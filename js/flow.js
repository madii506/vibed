// The flow field: particles drift along a slowly changing angle field and leave hairline trails,
// the same texture as the brand art. Pauses off screen and in background tabs; static under reduced motion.
const SUN = ['#FF3D8B', '#FF7A45', '#FFB547', '#E5407A'];

export function flow(canvas, o = {}) {
  const opt = Object.assign({ bg: [250, 249, 246], ink: [10, 10, 10], inkA: 0.16, fade: 0.06, density: 1 / 1100, max: 1300,
    accent: 0.05, speed: 1.15, clear: null, scale: 0.0016 }, o);
  const ctx = canvas.getContext('2d', { alpha: false });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 0, h = 0, dpr = 1, parts = [], raf = 0, on = false, t = Math.random() * 1000, last = 0;
  const angle = (x, y) => {
    const s = opt.scale;
    return (Math.sin(x * s + t * 0.00011) * 1.6 + Math.cos(y * s * 1.3 - t * 0.00008) * 1.4 + Math.sin((x + y) * s * 0.7 + 1.7) * 1.1
      + Math.cos((x - y) * s * 0.45 - t * 0.00005) * 0.9) * 1.25;
  };
  const inClear = (x, y) => { if (!opt.clear) return false; const c = opt.clear(w, h); return ((x - c.x) / c.rx) ** 2 + ((y - c.y) / c.ry) ** 2 < 1; };
  const spawn = p => {
    for (let k = 0; k < 12; k++) { p.x = Math.random() * w; p.y = Math.random() * h; if (!inClear(p.x, p.y)) break; }
    p.life = 120 + Math.random() * 260; p.age = 0;
    p.c = Math.random() < opt.accent ? SUN[(Math.random() * SUN.length) | 0] : null;
    return p;
  };
  function size() {
    const r = canvas.getBoundingClientRect(); dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = Math.max(1, Math.round(r.width)); h = Math.max(1, Math.round(r.height));
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = `rgb(${opt.bg})`; ctx.fillRect(0, 0, w, h);
    const n = Math.min(opt.max, Math.round(w * h * opt.density * (innerWidth < 700 ? 0.6 : 1)));
    parts = Array.from({ length: n }, () => spawn({}));
    if (reduce) still();
  }
  function step(dt) {
    ctx.fillStyle = `rgba(${opt.bg},${opt.fade})`; ctx.fillRect(0, 0, w, h);
    ctx.lineWidth = 1;
    const ink = `rgba(${opt.ink},${opt.inkA})`;
    for (const p of parts) {
      const a = angle(p.x, p.y), v = opt.speed * dt;
      const nx = p.x + Math.cos(a) * v, ny = p.y + Math.sin(a) * v;
      p.age++;
      if (p.age > p.life || nx < -5 || ny < -5 || nx > w + 5 || ny > h + 5 || inClear(nx, ny)) { spawn(p); continue; }
      ctx.strokeStyle = p.c ? p.c : ink; ctx.globalAlpha = p.c ? 0.75 : 1;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke();
      p.x = nx; p.y = ny;
    }
    ctx.globalAlpha = 1;
  }
  function still() {
    // reduced motion: draw finished streamlines once
    ctx.fillStyle = `rgb(${opt.bg})`; ctx.fillRect(0, 0, w, h);
    for (const p of parts) { for (let i = 0; i < 90; i++) { const a = angle(p.x, p.y), nx = p.x + Math.cos(a) * 2, ny = p.y + Math.sin(a) * 2; if (inClear(nx, ny)) break;
      ctx.strokeStyle = p.c || `rgba(${opt.ink},${opt.inkA * 0.6})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(nx, ny); ctx.stroke(); p.x = nx; p.y = ny; } }
  }
  function loop(ts) {
    raf = 0; if (!on) return;
    const dt = last ? Math.min(2.2, (ts - last) / 16.7) : 1; last = ts; t += dt * 16.7;
    step(dt);
    raf = requestAnimationFrame(loop);
  }
  function play() { if (reduce || on) return; on = true; last = 0; if (!raf) raf = requestAnimationFrame(loop); }
  function pause() { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  size();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(size, 180); });
  const io = new IntersectionObserver(es => es.forEach(e => (e.isIntersecting && !document.hidden ? play() : pause())), { threshold: 0.01 });
  io.observe(canvas);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else if (canvas.getBoundingClientRect().bottom > 0 && canvas.getBoundingClientRect().top < innerHeight) play(); });
  // warm up so the first frame already has texture
  if (!reduce) for (let i = 0; i < 70; i++) { t += 16.7; step(1); }
  return { play, pause, resize: size };
}
