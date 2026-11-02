// Hàm dựng sự kiện chiêu dùng chung cho các file tướng.
import { angDiff, deg, clamp } from './math.js';
import { clampInside, edgeDist } from './arena.js';

export const arc = (at, o) => Object.assign({ at, do: 'arc' }, o);
export const line = (at, o) => Object.assign({ at, do: 'line' }, o);
export const circle = (at, o) => Object.assign({ at, do: 'circle' }, o);
export const proj = (at, o) => Object.assign({ at, do: 'proj' }, o);
export const dash = (at, o) => Object.assign({ at, do: 'dash' }, o);
export const custom = (at, fn, o) => Object.assign({ at, do: 'custom', fn }, o);
export const fx = (at, kind, o) => Object.assign({ at, do: 'fx', kind }, o);
export const behind = (t, a) => Math.abs(angDiff(t.facing, Math.atan2(a.y - t.y, a.x - t.x))) > deg(110);
export const D2R = deg;

// dịch chuyển an toàn (trong sàn, không kẹt cột)
export function teleport(w, f, x, y, margin) {
  const p = { x, y };
  clampInside(w.A, p, margin ?? f.r + 4);
  for (const c of w.A.pillars) {
    const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
    if (d < c.r + f.r) { const k = (c.r + f.r + 2) / (d || 1); p.x = c.x + dx * k; p.y = c.y + dy * k; }
  }
  w.ev('fx', { kind: 'blink', x: f.x, y: f.y, r: 30, color: w.H(f).color, life: 0.3 });
  f.x = p.x; f.y = p.y; f.vx = 0; f.vy = 0;
  w.ev('fx', { kind: 'blink', x: f.x, y: f.y, r: 30, color: w.H(f).color, life: 0.3 });
}
export function behindPos(t, d) { return { x: t.x - Math.cos(t.facing) * d, y: t.y - Math.sin(t.facing) * d }; }
export const near = (a, b, d) => Math.hypot(a.x - b.x, a.y - b.y) < d;
export const angOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
// hướng từ tâm sàn ra phía mép gần nhất của t (để đánh văng ra ngoài)
export function outAng(w, t) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, d = edgeDist(w.A, t.x + Math.cos(a) * 60, t.y + Math.sin(a) * 60);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}
export function foeOf(w, f) { const t = w.foe(f); return t && w.alive(t) ? t : null; }
export function gauge(f, k, v, max = 100) { f.ws[k] = clamp((f.ws[k] || 0) + v, 0, max); return f.ws[k]; }
// thời điểm hiện tại (giây trận)
export const now = (w) => w.s.t;
