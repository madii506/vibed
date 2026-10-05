// Motion layer: magnetic buttons, cards that tilt toward the pointer with a moving glare, kickers that decode
// into place, and a marquee that speeds up with the scroll. Everything stops under reduced motion and on touch.
import { $, $$, reduce } from './core.js';
const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

export function magnetic() {
  if (reduce || !fine) return;
  let cur = null;
  const reset = el => { el.style.transform = ''; };
  document.addEventListener('pointermove', e => {
    const b = e.target.closest && e.target.closest('.btn');
    if (cur && cur !== b) { reset(cur); cur = null; }
    if (!b || b.disabled) return;
    cur = b; b.classList.add('mag');
    const r = b.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    b.style.transform = `translate(${dx * 0.18}px, ${dy * 0.28 - 2}px)`;
  }, { passive: true });
  document.addEventListener('pointerleave', () => { if (cur) reset(cur); cur = null; });
}

export function tilt(sel) {
  if (reduce || !fine) return;
  document.addEventListener('pointermove', e => {
    const el = e.target.closest && e.target.closest(sel);
    $$('.tilt.hov').forEach(x => { if (x !== el) { x.classList.remove('hov'); x.style.transform = ''; } });
    if (!el) return;
    el.classList.add('tilt', 'hov');
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    const k = r.width > 700 ? 0.45 : 1;
    el.style.transform = `perspective(1100px) rotateX(${(0.5 - py) * 5 * k}deg) rotateY(${(px - 0.5) * 7 * k}deg) translateY(-2px)`;
    el.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
  }, { passive: true });
}

const GLYPHS = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#%&/<>';
export function scramble(el, ms = 760) {
  const final = el.dataset.text || el.textContent; el.dataset.text = final;
  if (reduce) { el.textContent = final; return; }
  const t0 = performance.now();
  const f = now => {
    const k = Math.min(1, (now - t0) / ms); const n = Math.floor(final.length * k);
    el.textContent = final.slice(0, n) + final.slice(n).replace(/[^\s·—]/g, () => GLYPHS[(Math.random() * GLYPHS.length) | 0]);
    if (k < 1) requestAnimationFrame(f); else el.textContent = final;
  };
  requestAnimationFrame(f);
}
export function kickers() {
  const els = $$('.head .kick');
  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { scramble(e.target); io.unobserve(e.target); } }), { rootMargin: '0px 0px -10% 0px' });
  els.forEach(e => io.observe(e));
}

export function marquee(el) {
  if (!el) return;
  let x = 0, v = 0, lastY = scrollY, on = true, half = 0;
  const measure = () => { half = el.scrollWidth / 2; };
  measure(); addEventListener('resize', measure);
  addEventListener('scroll', () => { v = Math.min(18, v + Math.abs(scrollY - lastY) * 0.06); lastY = scrollY; }, { passive: true });
  const io = new IntersectionObserver(es => { on = es[0].isIntersecting; if (on) requestAnimationFrame(f); }); io.observe(el);
  function f() {
    if (!on || document.hidden) return;
    x += (reduce ? 0 : 0.45) + v; v *= 0.92;
    if (half) x %= half;
    el.style.transform = `translate3d(${-x}px,0,0)`;
    requestAnimationFrame(f);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && on) requestAnimationFrame(f); });
  requestAnimationFrame(f);
}
