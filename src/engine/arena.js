// Sàn đấu: hình tròn / elip / chữ nhật / bát giác, có cột chắn. Dữ liệu tĩnh, tra theo id.
import { TAU, clamp } from './math.js';

const DEFS = {
  go: {
    name: 'Sân Gỗ Làng Gió', shape: 'circle', r: 440, fric: 1,
    pillars: [{ x: 0, y: -235, r: 34 }, { x: 0, y: 235, r: 34 }],
    c: { top: '#9a7448', top2: '#86633b', rim: '#e0bf84', side: '#4a3420', bg1: '#20354a', bg2: '#0b1520', deco: 'planks' },
    desc: 'Sàn tròn vừa phải, hai cột gỗ chắn giữa.',
  },
  da: {
    name: 'Đấu Trường Đá', shape: 'rect', w: 1060, h: 600, fric: 1,
    pillars: [{ x: -300, y: -165, r: 38 }, { x: 300, y: -165, r: 38 }, { x: -300, y: 165, r: 38 }, { x: 300, y: 165, r: 38 }],
    c: { top: '#7d7f86', top2: '#6a6c72', rim: '#c9cbd2', side: '#33343a', bg1: '#2a2233', bg2: '#0e0b14', deco: 'tiles' },
    desc: 'Sàn chữ nhật rộng, bốn cột đá — đập tường bị choáng.',
  },
  bang: {
    name: 'Hồ Băng', shape: 'ellipse', a: 580, b: 360, fric: 0.6,
    pillars: [{ x: 0, y: -175, r: 36 }, { x: 0, y: 175, r: 36 }],
    c: { top: '#a9dcf2', top2: '#8ccbe8', rim: '#eafaff', side: '#3d6f8a', bg1: '#11324a', bg2: '#050f1a', deco: 'ice' },
    desc: 'Sàn trơn: lực văng tắt chậm hơn, dễ trượt ra mép.',
  },
  ngai: {
    name: 'Ngai Võ Thần', shape: 'ngon', n: 8, r: 540, squash: 0.72, fric: 1,
    pillars: [{ x: -270, y: -135, r: 36 }, { x: 270, y: -135, r: 36 }, { x: -270, y: 135, r: 36 }, { x: 270, y: 135, r: 36 }],
    c: { top: '#3a2a5a', top2: '#2e2148', rim: '#ffd76a', side: '#140c22', bg1: '#2a0f40', bg2: '#05020a', deco: 'runes' },
    desc: 'Bát giác lớn, bốn cột ở các góc.',
  },
  troi: {
    name: 'Đảo Thiên Không', shape: 'rect', w: 940, h: 520, fric: 1,
    pillars: [{ x: -250, y: -120, r: 34 }, { x: 250, y: -120, r: 34 }, { x: 0, y: 150, r: 34 }],
    c: { top: '#7fc06a', top2: '#6aab57', rim: '#d9ffc4', side: '#6b4a2e', bg1: '#4a8ad0', bg2: '#a9d4ff', deco: 'grass' },
    desc: 'Đảo nhỏ — ít chỗ lùi, kết liễu nhanh.',
  },
};

for (const [id, d] of Object.entries(DEFS)) {
  d.id = id;
  if (d.shape === 'rect') {
    const w = d.w / 2, h = d.h / 2;
    d.poly = [[-w, -h], [w, -h], [w, h], [-w, h]];
  } else if (d.shape === 'ngon') {
    d.poly = [];
    for (let i = 0; i < d.n; i++) {
      const a = (i / d.n) * TAU + TAU / (2 * d.n);
      d.poly.push([Math.cos(a) * d.r, Math.sin(a) * d.r * d.squash]);
    }
  } else if (d.shape === 'circle') {
    d.a = d.b = d.r;
  }
  if (d.poly) {
    d.edges = d.poly.map((p, i) => {
      const q = d.poly[(i + 1) % d.poly.length];
      const dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy);
      // pháp tuyến hướng vào trong (đa giác theo chiều kim đồng hồ trên màn hình)
      return { x: p[0], y: p[1], nx: -dy / L, ny: dx / L };
    });
    d.hx = Math.max(...d.poly.map((p) => Math.abs(p[0])));
    d.hy = Math.max(...d.poly.map((p) => Math.abs(p[1])));
  } else {
    d.hx = d.a; d.hy = d.b;
  }
}

export const ARENAS = DEFS;
export const ARENA_IDS = Object.keys(DEFS);

// Khoảng cách tới mép (dương = bên trong sàn)
export function edgeDist(A, x, y) {
  if (A.poly) {
    let m = Infinity;
    for (const e of A.edges) {
      const d = (x - e.x) * e.nx + (y - e.y) * e.ny;
      if (d < m) m = d;
    }
    return m;
  }
  const L = Math.hypot(x, y);
  if (L < 1e-6) return Math.min(A.a, A.b);
  const c = x / L, s = y / L;
  const rdir = 1 / Math.sqrt((c / A.a) ** 2 + (s / A.b) ** 2);
  return rdir - L;
}

// Đẩy điểm về trong sàn, cách mép ít nhất margin
export function clampInside(A, p, margin = 0) {
  if (A.poly) {
    for (let k = 0; k < 3; k++) {
      for (const e of A.edges) {
        const d = (p.x - e.x) * e.nx + (p.y - e.y) * e.ny;
        if (d < margin) { p.x += e.nx * (margin - d); p.y += e.ny * (margin - d); }
      }
    }
    return p;
  }
  const L = Math.hypot(p.x, p.y);
  if (L < 1e-6) return p;
  const c = p.x / L, s = p.y / L;
  const rdir = 1 / Math.sqrt((c / A.a) ** 2 + (s / A.b) ** 2);
  if (L > rdir - margin) { const k = Math.max(0, rdir - margin) / L; p.x *= k; p.y *= k; }
  return p;
}

// Đoạn a→b có bị cột che không
export function blockedBy(A, ax, ay, bx, by, pad = 0) {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1;
  for (const c of A.pillars) {
    const t = clamp(((c.x - ax) * dx + (c.y - ay) * dy) / L2, 0, 1);
    if (Math.hypot(ax + dx * t - c.x, ay + dy * t - c.y) < c.r + pad) return c;
  }
  return null;
}
