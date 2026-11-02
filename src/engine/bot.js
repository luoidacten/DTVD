// ===== Bot offline =====
// Bot chỉ tạo InputFrame giống người chơi (di chuyển, ngắm, bấm/giữ nút) — không chạm vào state trận.
import { clamp, angDiff, dist } from './math.js';
import { edgeDist, blockedBy } from './arena.js';
import { HEROES } from './heroes.js';
import { KEYS } from './world.js';

export const BOT_LEVELS = {
  easy: { name: 'Dễ', react: 0.38, aimErr: 0.22, aggr: 0.55, lead: 0.3, edge: 70, dodge: 0.1 },
  normal: { name: 'Thường', react: 0.22, aimErr: 0.1, aggr: 0.8, lead: 0.7, edge: 95, dodge: 0.3 },
  hard: { name: 'Khó', react: 0.1, aimErr: 0.04, aggr: 1, lead: 1, edge: 120, dodge: 0.55 },
};

export class Bot {
  constructor(slot, level = 'normal', seed = 1) {
    this.slot = slot; this.dummy = level === 'dummy'; this.L = BOT_LEVELS[level] || BOT_LEVELS.normal;
    this.think = 0; this.strafe = 1; this.strafeT = 0; this.holdKey = null; this.holdT = 0;
    this.mx = 0; this.my = 0; this.press = null;
    let s = seed >>> 0 || 1;
    this.rng = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  input(w) {
    const me = w.s.fighters[this.slot], foe = w.foe(me);
    const out = { mx: 0, my: 0, ax: me.x + Math.cos(me.facing) * 100, ay: me.y + Math.sin(me.facing) * 100, aim: false, held: {}, pressed: {} };
    if (this.dummy || !w.alive(me) || w.s.phase !== 'fight' || !foe) return out;
    const H = HEROES[me.hero], A = w.A, dt = 1 / 60, L = this.L;
    const d = dist(me, foe), foeAlive = w.alive(foe);
    const ranged = (H.skills.A.ai.max || 100) > 200;
    const pref = ranged ? 330 : Math.max(55, (H.skills.A.ai.max || 80) * 0.75);

    // --- ngắm (có đón đầu với chiêu bắn) ---
    const lead = ranged ? (d / 900) * L.lead : 0.05;
    let tx = foe.x + (foe.mvx + foe.vx * 0.3) * lead, ty = foe.y + (foe.mvy + foe.vy * 0.3) * lead;
    const err = (this.rng() - 0.5) * 2 * L.aimErr * Math.min(1, 120 / Math.max(40, d)) * 2;
    const a0 = Math.atan2(ty - me.y, tx - me.x) + err;
    out.ax = me.x + Math.cos(a0) * Math.hypot(tx - me.x, ty - me.y); out.ay = me.y + Math.sin(a0) * Math.hypot(tx - me.x, ty - me.y);
    out.aim = true;

    // --- đang giữ nút tụ lực ---
    if (this.holdKey) {
      this.holdT -= dt;
      out.held[this.holdKey] = this.holdT > 0;
      if (this.holdT <= 0) this.holdKey = null;
    }
    // --- Borg đang túm: ném ra phía mép gần nhất ---
    if (me.ws.grab) {
      const oa = Math.atan2(foe.y, foe.x);
      out.ax = me.x + Math.cos(oa) * 200; out.ay = me.y + Math.sin(oa) * 200;
      return out;
    }

    // --- di chuyển ---
    this.think -= dt; this.strafeT -= dt;
    if (this.strafeT <= 0) { this.strafe = this.rng() < 0.5 ? -1 : 1; this.strafeT = 0.8 + this.rng() * 1.4; }
    if (this.think <= 0) {
      this.think = L.react * (0.7 + this.rng() * 0.6);
      let vx = 0, vy = 0;
      const ux = (foe.x - me.x) / (d || 1), uy = (foe.y - me.y) / (d || 1);
      if (foeAlive) {
        if (d > pref + 25) { vx += ux; vy += uy; }
        else if (d < pref - 45 && ranged) { vx -= ux; vy -= uy; }
        vx += -uy * this.strafe * 0.6; vy += ux * this.strafe * 0.6;
      } else { vx -= me.x / 300; vy -= me.y / 300; }
      // né mép sàn: kéo về tâm
      const ed = edgeDist(A, me.x, me.y);
      if (ed < L.edge) { const k = (L.edge - ed) / L.edge * 2.2, cl = Math.hypot(me.x, me.y) || 1; vx -= (me.x / cl) * k; vy -= (me.y / cl) * k; }
      // né cột chặn đường
      const c = blockedBy(A, me.x, me.y, foe.x, foe.y, me.r);
      if (c && ranged) { vx += -uy * this.strafe; vy += ux * this.strafe; }
      // né đạn đang bay tới
      const thr = this.threat(w, me);
      if (thr && this.rng() < L.dodge) { vx = thr.x * 2.5 + vx * 0.3; vy = thr.y * 2.5 + vy * 0.3; }
      const n = Math.hypot(vx, vy);
      this.mx = n > 0.05 ? vx / n : 0; this.my = n > 0.05 ? vy / n : 0;
      this.press = foeAlive && !this.holdKey ? this.pickSkill(w, me, foe, d, H, ranged) : null;
    }
    out.mx = this.mx; out.my = this.my;
    if (this.press) {
      const k = this.press; this.press = null;
      const sk = H.skills[k];
      out.pressed[k] = true; out.held[k] = true;
      if (sk.hold) { this.holdKey = k; this.holdT = sk.hold * (0.35 + this.rng() * 0.65); }
      // chiêu cơ động (lướt) khi gần mép: hướng về tâm sàn
      if (sk.ai.kind === 'mob' && edgeDist(A, me.x, me.y) < L.edge + 40) {
        const back = sk.shape && sk.shape.back;
        const a = Math.atan2(-me.y, -me.x) + (back ? Math.PI : 0);
        out.ax = me.x + Math.cos(a) * 200; out.ay = me.y + Math.sin(a) * 200;
      }
    }
    return out;
  }
  // đạn sắp trúng trong ~0.45s → trả về hướng né vuông góc (tránh hướng ra mép)
  threat(w, me) {
    for (const p of w.s.projs) {
      if (p.team === me.team) continue;
      const sp = Math.hypot(p.vx, p.vy) || 1, ux = p.vx / sp, uy = p.vy / sp;
      const rx = me.x - p.x, ry = me.y - p.y, along = rx * ux + ry * uy;
      if (along < 0 || along / sp > 0.45) continue;
      const perp = rx * -uy + ry * ux;
      if (Math.abs(perp) > me.r + p.r + 24) continue;
      let s = perp >= 0 ? 1 : -1;
      const nx = -uy * s, ny = ux * s;
      if (edgeDist(w.A, me.x + nx * 80, me.y + ny * 80) < 40) { s = -s; }
      return { x: -uy * s, y: ux * s };
    }
    return null;
  }
  pickSkill(w, me, foe, d, H, ranged) {
    const L = this.L, r = this.rng, gap = d - foe.r;
    const foeEdge = edgeDist(w.A, foe.x, foe.y), meEdge = edgeDist(w.A, me.x, me.y);
    const foeAtk = !!(foe.act && foe.act.key !== 'C') || !!foe.charge;
    const order = ['U', 'B', 'D', 'C', 'A'];
    for (const k of order) {
      const sk = H.skills[k];
      if (!sk || !w.canUse(me, k)) continue;
      const ai = sk.ai || {}, max = (ai.max ?? 9999), min = ai.min ?? 0;
      const inR = gap <= max && d >= min;
      let want = false;
      switch (ai.kind) {
        case 'atk': want = inR && r() < L.aggr; break;
        case 'poke': want = inR && r() < L.aggr * 0.8 && !blockedBy(w.A, me.x, me.y, foe.x, foe.y, 4); break;
        case 'fin': want = inR && (foe.percent > 55 || foeEdge < 160 || r() < 0.15) && r() < L.aggr; break;
        case 'def': want = (gap < 110 && (foeAtk || r() < 0.25)) || (gap < (max || 110) && r() < 0.15 && max < 9999); break;
        case 'mob': want = (meEdge < L.edge + 30 && r() < 0.7) || (!ranged && gap > 180 && gap < 320 && r() < 0.25) || (ranged && gap < 110 && r() < 0.5); break;
        case 'buff': want = inR && r() < 0.5; break;
        case 'ult': want = inR && (foe.percent > 45 || r() < 0.2) && r() < 0.6; break;
        default: want = inR;
      }
      if (want) return k;
    }
    return null;
  }
}

export { KEYS };
