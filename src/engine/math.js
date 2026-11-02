// Tiện ích toán học dùng chung cho engine và client (không phụ thuộc DOM).
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const hypot = Math.hypot;
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const angTo = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const deg = (d) => (d * Math.PI) / 180;
export const round = (v, k = 10) => Math.round(v * k) / k;

// RNG có seed (mulberry32) — gameplay dùng RNG riêng của trận.
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
