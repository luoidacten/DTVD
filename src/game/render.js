// ===== Vẽ trận đấu bằng Canvas 2D =====
// Chỉ đọc "view" (xem engine/view.js). Hiệu ứng hạt chạy riêng ở client, không ảnh hưởng gameplay.
import { ARENAS } from '../engine/arena.js';
import { HEROES } from '../engine/heroes.js';
import { TAU, clamp, lerp, deg } from '../engine/math.js';

const TEAM = ['#4aa8ff', '#ff5a5a'];
const KEYS = ['A', 'B', 'C', 'D', 'U'];
const PART_CAP = 260;
export function pctColor(p) {
  if (p < 40) return '#ffffff';
  if (p < 80) return '#ffe066';
  if (p < 120) return '#ffa040';
  if (p < 160) return '#ff5a3a';
  return '#d0203a';
}

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.g = canvas.getContext('2d');
    this.W = 0; this.H = 0; this.dpr = 1;
    this.cam = { x: 0, y: 0, s: 1 };
    this.parts = []; this.texts = []; this.fx = []; this.shakeP = 0; this.flashT = 0; this.banner = null; this.count = null;
    this.seen = 0; this.mobile = false;
    this.resize();
  }
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = window.innerWidth; this.H = window.innerHeight;
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
  }
  w2s(x, y) { const c = this.cam; return [(x - c.x) * c.s + this.W / 2, (y - c.y) * c.s + this.H / 2]; }
  s2w(x, y) { const c = this.cam; return [(x - this.W / 2) / c.s + c.x, (y - this.H / 2) / c.s + c.y]; }
  reset() { this.parts = []; this.texts = []; this.fx = []; this.seen = 0; this.banner = null; this.count = null; this.cam.init = false; }

  // ---------- sự kiện → hiệu ứng ----------
  events(evs, view, sfx) {
    for (const e of evs) {
      if (e.id <= this.seen) continue;
      this.seen = e.id;
      switch (e.type) {
        case 'hit': {
          const n = Math.min(16, 3 + e.mag / 70);
          for (let i = 0; i < n; i++) this.part(e.x, e.y, { color: i % 2 ? '#ffffff' : e.color, life: 0.2 + Math.random() * 0.3, size: 2 + Math.random() * 3, vx: (Math.random() - 0.5) * 520, vy: (Math.random() - 0.5) * 520 });
          if (e.dmg >= 0.5) this.addText(e.x + (Math.random() - 0.5) * 20, e.y - 34, `+${e.dmg < 3 ? e.dmg.toFixed(1) : Math.round(e.dmg)}%`, pctColor(e.pct), 13 + Math.min(10, e.dmg));
          this.fx.push({ kind: e.mag > 600 ? 'sun' : 'spark', x: e.x, y: e.y, r: e.mag > 600 ? 46 : 22, color: e.blocked ? '#9ec9ff' : e.color, life: 0.25, max: 0.25 });
          if (e.mag > 550) this.shake(Math.min(16, e.mag / 90));
          if (e.blocked) this.addText(e.x, e.y - 52, 'CHẶN', '#9ec9ff', 13);
          sfx && sfx('hit', e.mag, e.blocked);
          break;
        }
        case 'fx': this.fx.push(Object.assign({ max: e.life }, e)); if (e.kind === 'boom' || e.kind === 'firering') for (let i = 0; i < 10; i++) this.part(e.x, e.y, { color: i % 2 ? '#ffd27a' : e.color, life: 0.4, size: 3 + Math.random() * 3, vx: (Math.random() - 0.5) * e.r * 7, vy: (Math.random() - 0.5) * e.r * 7 }); break;
        case 'text': this.addText(e.x, e.y, e.txt, e.color, e.size); break;
        case 'shake': this.shake(e.p); break;
        case 'sfx': sfx && sfx(e.name, e.v); break;
        case 'cast': sfx && sfx('cast', e.key, e.fid); break;
        case 'ko': {
          this.fx.push({ kind: 'kobeam', x: e.x, y: e.y, a: e.a, color: e.color, life: 0.9, max: 0.9 });
          this.addText(e.x, e.y - 30, 'KO!', '#ffffff', 38); this.shake(18); this.flashT = 0.15;
          sfx && sfx('ko');
          break;
        }
        case 'respawn': this.fx.push({ kind: 'ring', x: e.x, y: e.y, r: 50, color: '#ffffff', life: 0.5, max: 0.5 }); break;
        case 'count': this.count = { n: e.n, t: 0.9 }; sfx && sfx('count', e.n); break;
        case 'ult': { const f = view && view.f.find((x) => x.id === e.fid); this.banner = { txt: e.name, color: f ? HEROES[f.hero].color : '#fff', t: 1.4 }; this.flashT = 0.1; sfx && sfx('ult'); break; }
        case 'end': sfx && sfx('end'); break;
      }
    }
  }
  part(x, y, o) { if (this.parts.length < PART_CAP) this.parts.push(Object.assign({ x, y, life: 0.4, max: o.life || 0.4, size: 3, vx: 0, vy: 0, color: '#fff' }, o)); }
  addText(x, y, txt, color, size) { this.texts.push({ x, y, txt, color, size, life: 0.9, max: 0.9 }); if (this.texts.length > 40) this.texts.shift(); }
  shake(p) { this.shakeP = Math.max(this.shakeP, p); }

  // ---------- camera ----------
  updateCam(view, dt) {
    const A = ARENAS[view.arena];
    const fit = Math.min(this.W / (A.hx * 2 + 120), this.H / (A.hy * 2 + 170));
    const live = view.f.filter((f) => !f.dead && f.rsp <= 0);
    let cx = 0, cy = 0, s = fit;
    if (live.length) {
      const xs = live.map((f) => f.x), ys = live.map((f) => f.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      cx = (x0 + x1) / 2 * 0.6; cy = (y0 + y1) / 2 * 0.6;
      const mob = this.mobile || Math.min(this.W, this.H) < 500;
      const need = Math.min(this.W / (x1 - x0 + (mob ? 420 : 620)), this.H / (y1 - y0 + (mob ? 300 : 460)));
      s = mob ? clamp(need, fit * 1.1, fit * 1.9) : clamp(need, fit, fit * 1.2);
    }
    const c = this.cam;
    if (!c.init) { c.x = cx; c.y = cy; c.s = s; c.init = true; }
    const k = 1 - Math.exp(-dt * 3);
    c.x = lerp(c.x, cx, k); c.y = lerp(c.y, cy, k); c.s = lerp(c.s, s, k);
  }

  // ---------- khung hình ----------
  draw(view, o) {
    const g = this.g, dt = o.dt;
    this.updateCam(view, dt);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const A = ARENAS[view.arena];
    const bg = g.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, A.c.bg1); bg.addColorStop(1, A.c.bg2);
    g.fillStyle = bg; g.fillRect(0, 0, this.W, this.H);
    let sx = 0, sy = 0;
    if (this.shakeP > 0.3) { sx = (Math.random() - 0.5) * this.shakeP; sy = (Math.random() - 0.5) * this.shakeP; this.shakeP *= Math.exp(-dt * 9); } else this.shakeP = 0;
    const c = this.cam;
    g.setTransform(this.dpr * c.s, 0, 0, this.dpr * c.s, this.dpr * (this.W / 2 - c.x * c.s + sx), this.dpr * (this.H / 2 - c.y * c.s + sy));
    this.drawArena(A);
    this.drawZones(view, A);
    // bóng + vòng đội
    for (const f of view.f) this.drawShadow(f, o);
    if (o.aim) this.drawAim(o.aim);
    const items = [];
    for (const f of view.f) items.push({ y: f.y, f });
    for (const p of A.pillars) items.push({ y: p.y, pil: p });
    items.sort((a, b) => a.y - b.y);
    for (const it of items) { if (it.f) this.drawFighter(it.f, view, o); else this.drawPillar(it.pil, A); }
    this.drawEnts(view, o);
    this.drawProjs(view);
    this.drawFx(dt);
    this.drawParts(dt);
    this.drawTexts(dt);
    for (const f of view.f) this.drawOverhead(f, view, o);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawDark(view, o);
    if (this.flashT > 0) { g.fillStyle = `rgba(255,255,255,${this.flashT * 2})`; g.fillRect(0, 0, this.W, this.H); this.flashT -= dt; }
    this.drawHud(view, o, dt);
  }

  drawArena(A) {
    const g = this.g, D = 34;
    const path = (oy) => {
      g.beginPath();
      if (A.poly) { A.poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + oy) : g.moveTo(p[0], p[1] + oy))); g.closePath(); }
      else g.ellipse(0, oy, A.a, A.b, 0, 0, TAU);
    };
    // thân sàn (chiều sâu)
    g.fillStyle = A.c.side; path(D); g.fill();
    g.fillRect(-A.hx, 0, A.hx * 2, D * 0.01);
    for (let k = D; k > 0; k -= 4) { path(k); g.fill(); }
    // mặt sàn
    const gr = g.createRadialGradient(0, 0, 40, 0, 0, Math.max(A.hx, A.hy));
    gr.addColorStop(0, A.c.top); gr.addColorStop(1, A.c.top2);
    g.fillStyle = gr; path(0); g.fill();
    // họa tiết
    g.save(); path(0); g.clip();
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
    if (A.c.deco === 'planks') for (let y = -A.hy; y < A.hy; y += 44) { g.beginPath(); g.moveTo(-A.hx, y); g.lineTo(A.hx, y); g.stroke(); }
    else if (A.c.deco === 'tiles') for (let x = -A.hx; x < A.hx; x += 80) for (let y = -A.hy; y < A.hy; y += 80) g.strokeRect(x, y, 80, 80);
    else if (A.c.deco === 'ice') { g.strokeStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(-A.hx + i * 140, -A.hy); g.lineTo(-A.hx + i * 140 + 160, A.hy); g.stroke(); } }
    else if (A.c.deco === 'runes') { g.strokeStyle = 'rgba(255,215,106,0.18)'; for (const r of [120, 220, 320]) { g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke(); } }
    else if (A.c.deco === 'grass') { g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 60; i++) g.fillRect(((i * 97) % (A.hx * 2)) - A.hx, ((i * 53) % (A.hy * 2)) - A.hy, 4, 10); }
    // vùng nguy hiểm sát mép
    g.restore();
    g.strokeStyle = A.c.rim; g.lineWidth = 5; path(0); g.stroke();
    g.strokeStyle = 'rgba(255,80,80,0.25)'; g.lineWidth = 2; g.setLineDash([10, 10]);
    g.save(); g.scale(0.86, 0.86); path(0); g.restore(); g.stroke(); g.setLineDash([]);
  }
  drawPillar(p, A) {
    const g = this.g, h = 46;
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(p.x + 4, p.y + 6, p.r, p.r * 0.6, 0, 0, TAU); g.fill();
    g.fillStyle = A.c.side; g.fillRect(p.x - p.r, p.y - h, p.r * 2, h);
    g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * 0.55, 0, 0, Math.PI); g.fill();
    g.fillStyle = A.c.rim; g.beginPath(); g.ellipse(p.x, p.y - h, p.r, p.r * 0.55, 0, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; g.stroke();
  }
  drawZones(view) {
    const g = this.g;
    for (const z of view.z) {
      const [, kind, x, y, r, t, delay, dur, team, color] = z;
      if (kind === 'meteor') {
        if (t < delay) {
          const k = t / delay;
          g.strokeStyle = '#ff5a2a'; g.lineWidth = 4; g.setLineDash([12, 8]);
          g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, TAU); g.stroke(); g.setLineDash([]);
          g.fillStyle = `rgba(255,90,40,${0.12 + 0.25 * k})`; g.beginPath(); g.ellipse(x, y, r * k, r * 0.8 * k, 0, 0, TAU); g.fill();
          // thiên thạch rơi
          const hgt = (1 - k) * 600;
          g.fillStyle = '#ffb060'; g.beginPath(); g.arc(x + hgt * 0.4, y - hgt, 26, 0, TAU); g.fill();
          g.fillStyle = '#ff5a2a'; g.beginPath(); g.arc(x + hgt * 0.4, y - hgt, 18, 0, TAU); g.fill();
        } else {
          const left = delay + dur - t, a = Math.min(1, left);
          g.fillStyle = `rgba(255,100,40,${0.22 * a})`; g.beginPath(); g.ellipse(x, y, r * 0.86, r * 0.7, 0, 0, TAU); g.fill();
          for (let i = 0; i < 3; i++) { const ang = t * 2 + i * 2.1; this.part(x + Math.cos(ang) * r * 0.6 * Math.random(), y + Math.sin(ang) * r * 0.5 * Math.random(), { color: '#ff8a3a', life: 0.4, size: 3, vy: -60 }); }
        }
      } else if (kind === 'cage') {
        const a = Math.min(1, dur - t);
        g.strokeStyle = `rgba(255,154,106,${0.9 * a})`; g.lineWidth = 6;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${0.5 * a})`; g.lineWidth = 2; g.beginPath(); g.arc(x, y, r - 6, 0, TAU); g.stroke();
        for (let i = 0; i < 8; i++) { const ang = (i / 8) * TAU; g.fillStyle = `rgba(90,60,40,${a})`; g.fillRect(x + Math.cos(ang) * r - 5, y + Math.sin(ang) * r - 20, 10, 24); }
      } else if (delay && t < delay) {
        const k = t / delay;
        g.strokeStyle = '#ff4a3a'; g.lineWidth = 3; g.setLineDash([10, 7]);
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.setLineDash([]);
        g.fillStyle = `rgba(255,70,50,${0.1 + 0.25 * k})`; g.beginPath(); g.arc(x, y, r * k, 0, TAU); g.fill();
      } else if (dur > 0.1) {
        const a = Math.min(1, (delay + dur - t) * 2);
        g.globalAlpha = a; g.fillStyle = color + '30'; g.strokeStyle = color + '90'; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); g.globalAlpha = 1;
        if (kind === 'stage' || kind === 'domain' || kind === 'flag') { g.strokeStyle = color; g.lineWidth = 4; g.setLineDash([16, 10]); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.setLineDash([]); }
      }
    }
  }
  drawShadow(f, o) {
    if (f.dead || f.rsp > 0) return;
    const g = this.g;
    if (f.fall > 0) return;
    const k = 1 / (1 + Math.max(0, f.z) / 200);
    g.fillStyle = 'rgba(0,0,0,0.32)'; g.beginPath(); g.ellipse(f.x, f.y + f.r * 0.5, f.r * 1.1 * k, f.r * 0.5 * k, 0, 0, TAU); g.fill();
    if (f.fall > 0) return;
    if (f.st.invis && f.slot !== o.me) return;
    g.strokeStyle = TEAM[f.slot]; g.lineWidth = f.slot === o.me ? 3 : 2;
    g.globalAlpha = f.st.invis ? 0.35 : 0.9;
    g.beginPath(); g.ellipse(f.x, f.y + f.r * 0.5, f.r + 6, (f.r + 6) * 0.5, 0, 0, TAU); g.stroke();
    g.globalAlpha = 1;
  }

  drawFighter(f, view, o) {
    if (f.dead || f.rsp > 0) return;
    const g = this.g, H = HEROES[f.hero];
    let alpha = 1;
    if (f.st.invis) alpha = f.slot === o.me ? 0.35 : 0.04 + (f.mv ? 0.05 : 0);
    if (f.inv && Math.floor(view.t * 12) % 2 === 0 && f.fall <= 0) alpha *= 0.55;
    let sc = 1;
    if (f.fall > 0) { sc = Math.max(0.1, f.fall / 0.8); alpha *= sc; }
    g.save();
    g.globalAlpha = alpha;
    g.translate(f.x, f.y - f.z - f.r * 0.6);
    g.scale(sc, sc);
    const r = f.r;
    const bob = f.mv ? Math.sin(view.t * 16) * 1.6 : 0;
    g.translate(0, bob);
    // vũ khí phía sau thân nếu hướng lên
    const behindBody = Math.sin(f.fa) < -0.2;
    if (behindBody) this.drawWeapon(f, H);
    // thân
    const body = g.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r * 1.1);
    body.addColorStop(0, lighten(H.color, 0.45)); body.addColorStop(1, darken(H.color, 0.35));
    g.fillStyle = f.fl ? '#ffffff' : body;
    g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
    g.strokeStyle = darken(H.color, 0.6); g.lineWidth = 2.5; g.stroke();
    // mặt (hướng nhìn)
    const ex = Math.cos(f.fa), ey = Math.sin(f.fa);
    if (ey > -0.5) {
      g.fillStyle = '#ffffff';
      for (const s of [-1, 1]) {
        const px = ex * r * 0.45 - ey * s * r * 0.32, py = ey * r * 0.3 + ex * s * r * 0.32 * 0.6 - r * 0.15;
        g.beginPath(); g.arc(px, py, r * 0.16, 0, TAU); g.fill();
        g.fillStyle = '#1a1a22'; g.beginPath(); g.arc(px + ex * 1.5, py + ey * 1.2, r * 0.08, 0, TAU); g.fill(); g.fillStyle = '#ffffff';
      }
    }
    if (!behindBody) this.drawWeapon(f, H);
    // trạng thái phòng thủ
    if (f.st.block) { g.strokeStyle = '#9ec9ff'; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r + 8, f.fa - 1, f.fa + 1); g.stroke(); }
    if (f.st.armor) { g.strokeStyle = 'rgba(255,220,120,0.8)'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r + 5, 0, TAU); g.stroke(); }
    if (f.st.immortal) { g.strokeStyle = `rgba(255,215,106,${0.6 + 0.4 * Math.sin(view.t * 10)})`; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, r + 9, 0, TAU); g.stroke(); }
    if (f.st.shield) { g.strokeStyle = 'rgba(140,240,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r + 7, 0, TAU); g.stroke(); g.fillStyle = 'rgba(140,240,255,0.12)'; g.fill(); }
    if (f.st.petrify) { g.fillStyle = 'rgba(150,140,120,0.75)'; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); }
    if (f.st.reflect || f.st.bwall) { g.strokeStyle = f.st.reflect ? '#ffffff' : '#a0ffd0'; g.lineWidth = 3; g.setLineDash([6, 4]); g.beginPath(); g.arc(0, 0, r + 12, 0, TAU); g.stroke(); g.setLineDash([]); }
    if (f.st.grabbed) { g.strokeStyle = '#ff9a6a'; g.lineWidth = 3; g.beginPath(); g.arc(0, 0, r + 4, 0, TAU); g.stroke(); }
    g.restore();
  }

  drawWeapon(f, H) {
    const g = this.g, r = f.r, col = H.color;
    let a = f.fa, ext = 0;
    const act = f.act;
    if (act) {
      const [, t, dur, anim, ang] = act;
      const k = clamp(t / Math.max(0.01, dur), 0, 1);
      a = ang;
      if (anim === 'swing' || anim === 'wide') a = ang + lerp(-1.3, 1.3, easeOut(k)) * (anim === 'wide' ? 1.3 : 1);
      else if (anim === 'thrust' || anim === 'punch' || anim === 'uppercut' || anim === 'grab') ext = Math.sin(k * Math.PI) * 14;
      else if (anim === 'slam') a = ang + lerp(-0.4, 0, Math.min(1, k * 1.8));
      else if (anim === 'spin') a = ang + k * TAU;
    }
    if (f.ch) ext = -6;
    const ca = Math.cos(a), sa = Math.sin(a);
    g.save();
    g.lineCap = 'round';
    switch (H.weapon) {
      case 'swordshield': {
        g.strokeStyle = '#dfe8f5'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(ca * r * 0.6 - sa * 8, sa * r * 0.6 + ca * 8); g.lineTo(ca * (r + 34 + ext) - sa * 8, sa * (r + 34 + ext) + ca * 8); g.stroke();
        const sh = f.st.block ? f.fa : f.fa - 0.9;
        g.save(); g.translate(Math.cos(sh) * (r + 2), Math.sin(sh) * (r + 2)); g.rotate(sh);
        g.fillStyle = '#3a6ab0'; g.strokeStyle = '#ffd76a'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(0, 0, 6, 14, 0, 0, TAU); g.fill(); g.stroke(); g.restore();
        break;
      }
      case 'greatsword':
        g.strokeStyle = '#7a5a20'; g.lineWidth = 6; g.beginPath(); g.moveTo(ca * r * 0.4, sa * r * 0.4); g.lineTo(ca * (r + 8), sa * (r + 8)); g.stroke();
        g.strokeStyle = '#e8eef8'; g.lineWidth = 8; g.beginPath(); g.moveTo(ca * (r + 8), sa * (r + 8)); g.lineTo(ca * (r + 70 + ext), sa * (r + 70 + ext)); g.stroke();
        g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.moveTo(ca * (r + 6) - sa * 9, sa * (r + 6) + ca * 9); g.lineTo(ca * (r + 6) + sa * 9, sa * (r + 6) - ca * 9); g.stroke();
        break;
      case 'katana':
        g.strokeStyle = '#f2f4f8'; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(ca * (r * 0.5), sa * (r * 0.5)); g.quadraticCurveTo(ca * (r + 26) - sa * 6, sa * (r + 26) + ca * 6, ca * (r + 46 + ext), sa * (r + 46 + ext)); g.stroke();
        g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(ca * r * 0.4, sa * r * 0.4); g.lineTo(ca * (r + 4), sa * (r + 4)); g.stroke();
        break;
      case 'dagger':
        for (const s of [-1, 1]) {
          const aa = a + s * 0.5;
          g.strokeStyle = '#d8d0f0'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(Math.cos(aa) * r * 0.8, Math.sin(aa) * r * 0.8); g.lineTo(Math.cos(aa) * (r + 16 + ext), Math.sin(aa) * (r + 16 + ext)); g.stroke();
        }
        break;
      case 'staff':
        g.strokeStyle = '#6a4020'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-ca * 10 + sa * 10, -sa * 10 - ca * 10); g.lineTo(ca * (r + 26) + sa * 10, sa * (r + 26) - ca * 10); g.stroke();
        g.fillStyle = '#ffb060'; g.shadowColor = '#ff7a3a'; g.shadowBlur = 12;
        g.beginPath(); g.arc(ca * (r + 28) + sa * 10, sa * (r + 28) - ca * 10, 6 + (f.ch ? 4 + f.ch[1] * 5 : 0), 0, TAU); g.fill();
        break;
      case 'bow': {
        g.save(); g.translate(ca * (r + 6), sa * (r + 6)); g.rotate(a);
        g.strokeStyle = '#8a5a2a'; g.lineWidth = 3; g.beginPath(); g.arc(-8, 0, 20, -1.2, 1.2); g.stroke();
        const pull = f.ch ? Math.min(1, f.ch[1] / 1.5) * 14 : 0;
        g.strokeStyle = '#eee'; g.lineWidth = 1; g.beginPath(); g.moveTo(Math.cos(-1.2) * 20 - 8, Math.sin(-1.2) * 20); g.lineTo(-pull, 0); g.lineTo(Math.cos(1.2) * 20 - 8, Math.sin(1.2) * 20); g.stroke();
        if (f.ch) { g.strokeStyle = '#e0ffe0'; g.lineWidth = 2; g.beginPath(); g.moveTo(-pull, 0); g.lineTo(18, 0); g.stroke(); }
        g.restore();
        break;
      }
      case 'pistol':
        g.save(); g.translate(ca * (r + 2), sa * (r + 2)); g.rotate(a);
        g.fillStyle = '#3a3e46'; g.fillRect(0, -4, 20, 8); g.fillStyle = '#9aa0a8'; g.fillRect(2, -3, 16, 3);
        g.restore();
        break;
      case 'spear': case 'pole': case 'scythe': {
        const L = H.weapon === 'pole' ? 76 : 66;
        g.strokeStyle = H.weapon === 'pole' ? '#c08030' : '#7a5a30'; g.lineWidth = 4;
        g.beginPath(); g.moveTo(-ca * 16, -sa * 16); g.lineTo(ca * (r + L + ext), sa * (r + L + ext)); g.stroke();
        if (H.weapon === 'spear') { g.fillStyle = '#eef'; g.beginPath(); g.moveTo(ca * (r + L + 14 + ext), sa * (r + L + 14 + ext)); g.lineTo(ca * (r + L + ext) - sa * 6, sa * (r + L + ext) + ca * 6); g.lineTo(ca * (r + L + ext) + sa * 6, sa * (r + L + ext) - ca * 6); g.fill(); }
        if (H.weapon === 'scythe') { g.strokeStyle = '#d0c8e8'; g.lineWidth = 4; g.beginPath(); g.arc(ca * (r + L + ext) - sa * 18, sa * (r + L + ext) + ca * 18, 22, a - 2.4, a + 0.3); g.stroke(); }
        break;
      }
      case 'rapier': case 'cane':
        g.strokeStyle = H.weapon === 'cane' ? '#2a1a3a' : '#f0f0ff'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(ca * r * 0.6, sa * r * 0.6); g.lineTo(ca * (r + 44 + ext), sa * (r + 44 + ext)); g.stroke();
        g.fillStyle = col; g.beginPath(); g.arc(ca * (r + 2), sa * (r + 2), 4, 0, TAU); g.fill();
        break;
      case 'claws': case 'twin': case 'axes':
        for (const s of [-1, 1]) {
          const aa = a + s * 0.55, L = H.weapon === 'claws' ? 12 : H.weapon === 'axes' ? 22 : 30;
          g.strokeStyle = H.weapon === 'axes' ? '#bfefff' : '#e8eef8'; g.lineWidth = H.weapon === 'axes' ? 6 : 3;
          g.beginPath(); g.moveTo(Math.cos(aa) * r * 0.8, Math.sin(aa) * r * 0.8); g.lineTo(Math.cos(aa) * (r + L + ext), Math.sin(aa) * (r + L + ext)); g.stroke();
        }
        break;
      case 'crossbow': case 'shotgun': case 'revolver': case 'rifle': case 'laser': {
        const L = { crossbow: 18, shotgun: 30, revolver: 18, rifle: 38, laser: 26 }[H.weapon];
        g.save(); g.translate(ca * (r + 2), sa * (r + 2)); g.rotate(a);
        g.fillStyle = H.weapon === 'laser' ? '#2a4a5a' : '#3a3026'; g.fillRect(0, -4, L, 8);
        g.fillStyle = H.weapon === 'laser' ? '#69e3ff' : '#8a8a90'; g.fillRect(L * 0.4, -2, L * 0.6, 3);
        if (H.weapon === 'crossbow') { g.strokeStyle = '#8a5a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(L - 4, -12); g.lineTo(L, 0); g.lineTo(L - 4, 12); g.stroke(); }
        g.restore(); break;
      }
      case 'voice': case 'orb': case 'book': case 'flask': case 'wrench': case 'flag': case 'fan': case 'cards': case 'swords': {
        const px = ca * (r + 10), py = sa * (r + 10);
        if (H.weapon === 'flag') { g.strokeStyle = '#5a4030'; g.lineWidth = 3; g.beginPath(); g.moveTo(px, py + 10); g.lineTo(px, py - 36); g.stroke(); g.fillStyle = col; g.fillRect(px, py - 36, 22, 14); break; }
        if (H.weapon === 'fan') { g.fillStyle = col + 'cc'; g.beginPath(); g.moveTo(px - ca * 8, py - sa * 8); g.arc(px - ca * 8, py - sa * 8, 22, a - 0.7, a + 0.7); g.closePath(); g.fill(); break; }
        if (H.weapon === 'wrench') { g.strokeStyle = '#b0b0b8'; g.lineWidth = 5; g.beginPath(); g.moveTo(px - ca * 10, py - sa * 10); g.lineTo(px + ca * 14 + ext * ca, py + sa * 14 + ext * sa); g.stroke(); break; }
        if (H.weapon === 'cards') { g.fillStyle = '#fff'; g.strokeStyle = col; g.lineWidth = 1.5; for (let i = 0; i < 3; i++) { g.save(); g.translate(px, py); g.rotate(a + (i - 1) * 0.3); g.fillRect(-4, -6, 8, 12); g.strokeRect(-4, -6, 8, 12); g.restore(); } break; }
        if (H.weapon === 'swords') { for (let i = 0; i < 3; i++) { const aa = a + Math.PI + (i - 1) * 0.6; g.strokeStyle = '#e0f6ff'; g.lineWidth = 2; g.beginPath(); g.moveTo(Math.cos(aa) * (r + 6), Math.sin(aa) * (r + 6) - 10); g.lineTo(Math.cos(aa) * (r + 22), Math.sin(aa) * (r + 22) - 10); g.stroke(); } break; }
        g.fillStyle = H.weapon === 'book' ? '#f0e6c0' : H.weapon === 'flask' ? '#7ae04a' : col; g.shadowColor = col; g.shadowBlur = 10;
        if (H.weapon === 'book') g.fillRect(px - 7, py - 9, 14, 18); else { g.beginPath(); g.arc(px, py, H.weapon === 'voice' ? 5 : 7, 0, TAU); g.fill(); }
        break;
      }
      case 'chain':
        g.strokeStyle = '#a0a0a8'; g.lineWidth = 3; g.setLineDash([4, 3]); g.beginPath(); g.arc(0, 0, r + 10, a - 1, a + 1); g.stroke(); g.setLineDash([]);
        g.fillStyle = '#c0c0c8'; g.beginPath(); g.arc(ca * (r + 14 + ext), sa * (r + 14 + ext), 6, 0, TAU); g.fill();
        break;
      case 'fists':
        for (const s of [-1, 1]) {
          const aa = a + s * 0.6, e2 = s === 1 ? ext : ext * 0.3;
          g.fillStyle = '#c04a2a'; g.strokeStyle = '#5a1a0a'; g.lineWidth = 2;
          g.beginPath(); g.arc(Math.cos(aa) * (r + 4 + e2), Math.sin(aa) * (r + 4 + e2), 8, 0, TAU); g.fill(); g.stroke();
        }
        break;
    }
    g.restore();
  }

  drawOverhead(f, view, o) {
    if (f.dead || f.rsp > 0 || f.fall > 0) return;
    if (f.st.invis && f.slot !== o.me) return;
    const g = this.g, H = HEROES[f.hero];
    const top = f.y - f.z - f.r * 2 - 14;
    g.textAlign = 'center'; g.font = 'bold 12px system-ui, sans-serif';
    g.fillStyle = TEAM[f.slot]; g.fillText(f.slot === o.me ? 'BẠN' : f.name.slice(0, 12), f.x, top - 14);
    g.font = 'bold 15px system-ui, sans-serif'; g.fillStyle = pctColor(f.pc);
    g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3;
    g.strokeText(Math.round(f.pc) + '%', f.x, top); g.fillText(Math.round(f.pc) + '%', f.x, top);
    // biểu tượng trạng thái
    const icons = [];
    if (f.st.stun) icons.push('💫'); if (f.st.silence) icons.push('🔇'); if (f.st.slow) icons.push('🐌'); if (f.st.root) icons.push('⛓');
    if (f.st.burn) icons.push('🔥'.repeat(Math.min(3, f.st.burn[3] || 1))); if (f.st.marked) icons.push('🎯'); if (f.st.haste) icons.push('💨'); if (f.st.empower) icons.push('⚔');
    if (f.st.sleep) icons.push('💤'); if (f.st.petrify) icons.push('🗿'); if (f.st.charm) icons.push('💗'); if (f.st.nodash) icons.push('⛔'); if (f.st.blind) icons.push('🙈');
    if (f.st.bleed) icons.push('🩸' + f.st.bleed[3]); if (f.st.poison) icons.push('☠' + f.st.poison[3]); if (f.st.qi) icons.push('✦' + (f.st.qi[3] || 1)); if (f.st.tide) icons.push('🌊' + f.st.tide[3]); if (f.st.marks4) icons.push('✧✧');
    if (icons.length) { g.font = '13px system-ui'; g.fillText(icons.join(''), f.x, top - 30); }
    // thanh tụ lực
    if (f.ch) {
      const sk = H.skills[f.ch[0]], k = clamp(f.ch[1] / sk.hold, 0, 1);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(f.x - 26, f.y + f.r + 6, 52, 7);
      g.fillStyle = k >= 1 ? '#ffffff' : '#ffd24a'; g.fillRect(f.x - 25, f.y + f.r + 7, 50 * k, 5);
    }
    // tài nguyên riêng
    if (f.hero === 'zero') {
      const n = f.ws.ammo ?? 0;
      for (let i = 0; i < 9; i++) { g.fillStyle = i < n ? (i < (f.ws.exp || 0) ? '#ffb060' : '#e8eef4') : 'rgba(255,255,255,0.15)'; g.fillRect(f.x - 22 + i * 5, f.y + f.r + 16, 3, 6); }
      if (f.ws.reload > 0) { g.fillStyle = '#ffd24a'; g.font = 'bold 10px system-ui'; g.fillText('NẠP ĐẠN', f.x, f.y + f.r + 32); }
    }
    if (f.hero === 'ryoma') {
      if (f.ws.ki) { g.fillStyle = '#ff9ab0'; g.font = 'bold 10px system-ui'; g.fillText('KIẾM KHÍ', f.x, f.y + f.r + 20); }
    }
    const res = resText(f);
    if (res) { g.font = 'bold 10px system-ui'; g.fillStyle = HEROES[f.hero].color; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.lineWidth = 3; g.strokeText(res, f.x, f.y + f.r + 34); g.fillText(res, f.x, f.y + f.r + 34); }
    if (f.hero === 'valerius' && f.ws.stk) { g.fillStyle = '#9ec9ff'; g.font = 'bold 10px system-ui'; g.fillText('🛡'.repeat(f.ws.stk), f.x, f.y + f.r + 20); }
    if (f.hero === 'elara' && f.slot === o.me && view.t - (f.ws.lastAtk ?? -99) >= 4) { g.fillStyle = '#b0ffb0'; g.font = 'bold 10px system-ui'; g.fillText('TẬP TRUNG', f.x, f.y + f.r + 20); }
  }

  drawEnts(view, o) {
    const g = this.g;
    for (const e of view.e || []) {
      const [, kind, x, y, r, team, h, fa, t, dur] = e;
      const H = HEROES[h] || {}, col = H.color || '#ffffff';
      const fade = dur ? Math.min(1, (dur - t) * 3) : 1;
      g.save(); g.globalAlpha = fade;
      switch (kind) {
        case 'illu': case 'decoy': case 'dimg': case 'clone': case 'nclone': case 'shade': {
          // ảo ảnh vẽ giống chủ nhân để đánh lừa (bóng ma của Death thì mờ)
          const ghost = kind === 'shade';
          const ff = { x, y, z: 0, r, fa, hero: h, slot: team, st: {}, ws: {}, act: 0, ch: 0, mv: 1, fl: 0, inv: 0, fall: 0, dead: 0, rsp: 0, pc: 0 };
          g.globalAlpha = fade * (ghost ? 0.45 : 1);
          this.drawShadow(ff, { me: -1 });
          g.restore(); g.save(); g.globalAlpha = fade * (ghost ? 0.45 : 1);
          this.drawFighter(ff, view, { me: -1 });
          const own = view.f.find((q) => q.team === team || q.slot === team);
          if (!ghost && own) { g.restore(); g.save(); g.globalAlpha = fade; this.drawOverhead(Object.assign(ff, { pc: own.pc, name: own.name, slot: own.slot, ws: {} }), view, { me: own.slot === o.me ? -2 : -1 }); }
          break;
        }
        case 'okt': {
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + r * 0.5, r * 1.1, r * 0.5, 0, 0, TAU); g.fill();
          const gr = g.createRadialGradient(x - 8, y - r - 8, 4, x, y - r * 0.6, r * 1.2); gr.addColorStop(0, '#b8f0c8'); gr.addColorStop(1, '#3a8a5a');
          g.fillStyle = gr; g.beginPath(); g.arc(x, y - r * 0.6, r, 0, TAU); g.fill(); g.strokeStyle = '#1a4a2a'; g.lineWidth = 3; g.stroke();
          g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(x + Math.cos(fa) * 10 - Math.sin(fa) * s * 8, y - r * 0.7 + Math.sin(fa) * 6, 4, 0, TAU); g.fill(); }
          g.font = 'bold 10px system-ui'; g.textAlign = 'center'; g.fillStyle = '#9affc0'; g.fillText('Oktava', x, y - r * 1.8);
          break;
        }
        case 'sol': case 'turret': case 'tzero': {
          const big = kind === 'tzero', sz = big ? 30 : kind === 'turret' ? 16 : 11;
          g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(x, y + 4, sz, sz * 0.45, 0, 0, TAU); g.fill();
          g.fillStyle = kind === 'sol' ? '#a03a3a' : big ? '#c08020' : '#806040'; g.strokeStyle = '#201810'; g.lineWidth = 2;
          if (kind === 'sol') { g.beginPath(); g.arc(x, y - 8, sz, 0, TAU); g.fill(); g.stroke(); } else { g.fillRect(x - sz, y - sz * 1.4, sz * 2, sz * 1.6); g.strokeRect(x - sz, y - sz * 1.4, sz * 2, sz * 1.6); }
          g.strokeStyle = '#303038'; g.lineWidth = big ? 8 : 4; g.beginPath(); g.moveTo(x, y - sz * 0.7); g.lineTo(x + Math.cos(fa) * sz * 1.6, y - sz * 0.7 + Math.sin(fa) * sz * 1.6); g.stroke();
          if (big) { g.font = 'bold 11px system-ui'; g.textAlign = 'center'; g.fillStyle = '#ffd080'; g.fillText('T-ZERO', x, y - sz * 1.9); }
          break;
        }
        case 'gear': g.fillStyle = '#ffd24a'; g.strokeStyle = '#8a6a10'; g.lineWidth = 2; g.translate(x, y); g.rotate(view.t * 2); for (let i = 0; i < 6; i++) { g.rotate(TAU / 6); g.fillRect(-3, -r - 3, 6, 5); } g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill(); g.stroke(); break;
        case 'spin': g.translate(x, y); g.rotate(view.t * 14); g.strokeStyle = '#d0c8e8'; g.lineWidth = 5; g.beginPath(); g.arc(0, 0, 26, 0, 4); g.stroke(); g.strokeStyle = 'rgba(160,140,210,0.4)'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 140, 0, TAU); g.stroke(); break;
        case 'smoke': g.fillStyle = 'rgba(110,115,130,0.55)'; for (let i = 0; i < 6; i++) { const a = i + t; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.4, r * 0.55, 0, TAU); g.fill(); } break;
        case 'oca': g.fillStyle = '#20242c'; g.translate(x, y - 50); g.rotate(fa); g.beginPath(); g.moveTo(14, 0); g.lineTo(-10, -12 * Math.abs(Math.sin(view.t * 12))); g.lineTo(-6, 0); g.lineTo(-10, 12 * Math.abs(Math.sin(view.t * 12))); g.fill(); break;
        case 'rift': g.strokeStyle = '#b09aff'; g.lineWidth = 3; g.beginPath(); g.ellipse(x, y, r + 6, (r + 6) * 1.6, 0.5, 0, TAU); g.stroke(); break;
        case 'dome': g.fillStyle = 'rgba(80,40,140,0.25)'; g.strokeStyle = '#936fed'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.stroke(); break;
        case 'rose': g.fillStyle = '#e887ba'; for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5 + view.t; g.beginPath(); g.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, 0, TAU); g.fill(); } break;
        case 'trap': g.strokeStyle = team === o.me ? '#a08060' : 'rgba(160,128,96,0.25)'; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.setLineDash([]); break;
      }
      g.restore();
    }
  }
  // tầm nhìn bị che (Màn Đêm / Mù) của chính mình
  drawDark(view, o) {
    const me = view.f[o.me]; if (!me || (!me.st.dark && !me.st.blind)) return;
    const g = this.g, [sx, sy] = this.w2s(me.x, me.y), R = (me.st.dark ? 150 : 260) * this.cam.s;
    const gr = g.createRadialGradient(sx, sy, R * 0.4, sx, sy, R);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, me.st.dark ? 'rgba(0,0,6,0.94)' : 'rgba(10,10,10,0.7)');
    g.fillStyle = gr; g.fillRect(0, 0, this.W, this.H);
  }
  drawProjs(view) {
    const g = this.g;
    for (const p of view.p) {
      const [, kind, x, y, a, r, color] = p;
      g.save(); g.translate(x, y); g.rotate(a);
      switch (kind) {
        case 'arrow': case 'bigarrow': case 'godarrow': {
          const L = kind === 'godarrow' ? 70 : kind === 'bigarrow' ? 34 : 22;
          g.strokeStyle = kind === 'godarrow' ? '#d8ffd8' : '#e8d8b0'; g.lineWidth = kind === 'godarrow' ? 8 : kind === 'bigarrow' ? 4 : 2;
          if (kind === 'godarrow') { g.shadowColor = '#7ad67a'; g.shadowBlur = 20; }
          g.beginPath(); g.moveTo(-L, 0); g.lineTo(0, 0); g.stroke();
          g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(6 + r * 0.5, 0); g.lineTo(-4, -4 - r * 0.3); g.lineTo(-4, 4 + r * 0.3); g.fill();
          break;
        }
        case 'bullet': g.fillStyle = '#fff6c0'; g.fillRect(-10, -2, 14, 4); break;
        case 'xbullet': g.fillStyle = '#ffb060'; g.shadowColor = '#ff7a3a'; g.shadowBlur = 10; g.beginPath(); g.arc(0, 0, 6, 0, TAU); g.fill(); break;
        case 'fireball': case 'bigfire': {
          g.shadowColor = '#ff7a3a'; g.shadowBlur = 18;
          g.fillStyle = '#ff5a1a'; g.beginPath(); g.arc(0, 0, r * 1.2, 0, TAU); g.fill();
          g.fillStyle = '#ffd27a'; g.beginPath(); g.arc(r * 0.2, 0, r * 0.7, 0, TAU); g.fill();
          if (Math.random() < 0.6) this.part(x, y, { color: '#ff8a3a', life: 0.3, size: r * 0.4, vx: -Math.cos(a) * 60, vy: -Math.sin(a) * 60 });
          break;
        }
        case 'wave':
          g.strokeStyle = '#ffd0dc'; g.lineWidth = 5; g.shadowColor = '#ff5a7a'; g.shadowBlur = 14;
          g.beginPath(); g.arc(-10, 0, r * 1.6, -1.1, 1.1); g.stroke();
          break;
        case 'knife': case 'knifeU':
          g.fillStyle = '#d8d0f0'; g.beginPath(); g.moveTo(10, 0); g.lineTo(-6, -3); g.lineTo(-6, 3); g.fill();
          g.fillStyle = '#5a3a8a'; g.fillRect(-11, -2, 5, 4);
          break;
        case 'star':
          g.fillStyle = '#c0f0ff'; g.shadowColor = '#7ad6ff'; g.shadowBlur = 10; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
          break;
        default:
          g.fillStyle = color; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.fill();
      }
      g.restore();
    }
  }

  drawFx(dt) {
    const g = this.g, keep = [];
    for (const e of this.fx) {
      e.life -= dt;
      if (e.life <= 0) continue;
      keep.push(e);
      const k = 1 - e.life / e.max;
      g.save();
      g.globalAlpha = Math.max(0, 1 - k);
      switch (e.kind) {
        case 'arc': {
          g.fillStyle = e.color + '55'; g.strokeStyle = '#ffffff'; g.lineWidth = 3;
          const half = deg(e.arc) / 2;
          g.beginPath(); g.moveTo(e.x, e.y); g.arc(e.x, e.y, e.r, e.a - half, e.a + half); g.closePath(); g.fill();
          g.beginPath(); g.arc(e.x, e.y, e.r * (0.85 + 0.15 * k), e.a - half, e.a + half); g.stroke();
          break;
        }
        case 'thrust': {
          g.translate(e.x, e.y); g.rotate(e.a);
          g.fillStyle = e.color + '55'; g.fillRect(0, -e.w / 2 * (1 - k), e.r, e.w * (1 - k));
          g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(e.r * 0.3, 0); g.lineTo(e.r, 0); g.stroke();
          break;
        }
        case 'ring': case 'boom': case 'firering': case 'quake': case 'halo': {
          g.strokeStyle = e.color; g.lineWidth = e.kind === 'quake' ? 10 : 5;
          g.beginPath(); g.arc(e.x, e.y, e.r * (0.3 + 0.7 * k), 0, TAU); g.stroke();
          if (e.kind !== 'ring' && e.kind !== 'halo') { g.fillStyle = e.color + '40'; g.fill(); }
          break;
        }
        case 'slash': case 'bigslash': {
          g.translate(e.x, e.y); g.rotate(e.a);
          g.strokeStyle = '#ffffff'; g.lineWidth = e.kind === 'bigslash' ? 8 : 4; g.shadowColor = e.color; g.shadowBlur = 16;
          g.beginPath(); g.moveTo(-e.r / 2, -e.r / 3); g.lineTo(e.r / 2, e.r / 3); g.stroke();
          break;
        }
        case 'blink': case 'smoke': case 'puff': case 'dust':
          g.fillStyle = e.kind === 'blink' ? e.color + '88' : 'rgba(200,200,210,0.5)';
          g.beginPath(); g.arc(e.x, e.y, e.r * (0.5 + 0.8 * k), 0, TAU); g.fill();
          break;
        case 'spark': case 'sun':
          g.strokeStyle = e.color; g.lineWidth = e.kind === 'sun' ? 4 : 2;
          for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU + e.x; g.beginPath(); g.moveTo(e.x + Math.cos(a) * e.r * 0.3, e.y + Math.sin(a) * e.r * 0.3); g.lineTo(e.x + Math.cos(a) * e.r * (0.5 + k), e.y + Math.sin(a) * e.r * (0.5 + k)); g.stroke(); }
          break;
        case 'crack':
          g.translate(e.x, e.y); g.rotate(e.a); g.strokeStyle = 'rgba(40,30,20,0.8)'; g.lineWidth = 4;
          g.beginPath(); g.moveTo(20, 0); for (let i = 1; i < 8; i++) g.lineTo(20 + (e.r / 8) * i, (i % 2 ? 1 : -1) * 6); g.stroke();
          break;
        case 'kobeam': {
          g.translate(e.x, e.y); g.rotate(e.a);
          const grd = g.createLinearGradient(0, 0, 900, 0);
          grd.addColorStop(0, '#ffffff'); grd.addColorStop(0.3, e.color); grd.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = grd; g.fillRect(0, -30 * (1 - k), 900, 60 * (1 - k));
          break;
        }
      }
      g.restore();
    }
    this.fx = keep;
  }
  drawParts(dt) {
    const g = this.g, keep = [];
    for (const p of this.parts) {
      p.life -= dt; if (p.life <= 0) continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9;
      g.globalAlpha = Math.max(0, p.life / p.max); g.fillStyle = p.color;
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      keep.push(p);
    }
    g.globalAlpha = 1; this.parts = keep;
  }
  drawTexts(dt) {
    const g = this.g, keep = [];
    g.textAlign = 'center';
    for (const t of this.texts) {
      t.life -= dt; if (t.life <= 0) continue;
      t.y -= 40 * dt;
      g.globalAlpha = Math.min(1, t.life * 2.5);
      g.font = `900 ${t.size}px system-ui, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.75)'; g.strokeText(t.txt, t.x, t.y);
      g.fillStyle = t.color; g.fillText(t.txt, t.x, t.y);
      keep.push(t);
    }
    g.globalAlpha = 1; this.texts = keep;
  }

  // ---------- vùng ngắm của người chơi ----------
  drawAim(a) {
    const g = this.g, sh = a.shape;
    if (!sh) return;
    const { x, y, ang } = a;
    g.save();
    g.fillStyle = a.cancel ? 'rgba(255,80,80,0.18)' : 'rgba(255,255,255,0.16)';
    g.strokeStyle = a.cancel ? 'rgba(255,90,90,0.9)' : 'rgba(255,255,255,0.75)';
    g.lineWidth = 2; g.setLineDash([8, 6]);
    switch (sh.type) {
      case 'arc': { const h = deg(sh.arc) / 2; g.beginPath(); g.moveTo(x, y); g.arc(x, y, sh.range, ang - h, ang + h); g.closePath(); g.fill(); g.stroke(); break; }
      case 'cone': { const h = deg(sh.arc) / 2; g.beginPath(); g.moveTo(x, y); g.arc(x, y, sh.len, ang - h, ang + h); g.closePath(); g.fill(); g.stroke(); break; }
      case 'line': case 'proj': case 'dash': {
        const dir = sh.back ? ang + Math.PI : ang;
        g.translate(x, y); g.rotate(dir);
        const wdt = sh.w || 22;
        g.fillRect(0, -wdt / 2, sh.len, wdt); g.strokeRect(0, -wdt / 2, sh.len, wdt);
        g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,0.8)';
        g.beginPath(); g.moveTo(sh.len + 10, 0); g.lineTo(sh.len - 6, -9); g.lineTo(sh.len - 6, 9); g.fill();
        break;
      }
      case 'circle': g.beginPath(); g.arc(x, y, sh.r, 0, TAU); g.fill(); g.stroke(); break;
      case 'point': {
        g.beginPath(); g.arc(x, y, sh.range, 0, TAU); g.stroke();
        g.setLineDash([]); g.beginPath(); g.arc(a.px, a.py, sh.r, 0, TAU); g.fill(); g.stroke();
        break;
      }
      case 'self': g.beginPath(); g.arc(x, y, 40, 0, TAU); g.stroke(); break;
    }
    g.restore();
  }

  // ---------- HUD ----------
  drawHud(view, o, dt) {
    const g = this.g, W = this.W, Hh = this.H, mob = this.mobile;
    const sc = clamp(Math.min(W / 900, Hh / 560), 0.6, 1.1);
    // đồng hồ
    if (view.timeLimit) {
      const left = Math.max(0, view.timeLimit - view.clock), m = Math.floor(left / 60), s = Math.floor(left % 60);
      g.font = `bold ${Math.round(22 * sc)}px system-ui`; g.textAlign = 'center';
      g.fillStyle = left < 30 ? '#ff6a6a' : '#ffffff'; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 4;
      const ts = `${m}:${String(s).padStart(2, '0')}`; g.strokeText(ts, W / 2, 30 * sc + 6); g.fillText(ts, W / 2, 30 * sc + 6);
    }
    // thẻ người chơi (trên cùng hai bên)
    for (const f of view.f) this.drawCard(f, view, o, sc);
    // đếm ngược / banner
    if (this.count) {
      this.count.t -= dt;
      if (this.count.t <= 0) this.count = null;
      else {
        const txt = this.count.n > 0 ? String(this.count.n) : 'ĐẤU!';
        const k = 1 + (0.9 - this.count.t) * 0.6;
        g.font = `900 ${Math.round(90 * sc * k)}px system-ui`; g.textAlign = 'center'; g.globalAlpha = Math.min(1, this.count.t * 2);
        g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.7)'; g.strokeText(txt, W / 2, Hh / 2); g.fillStyle = this.count.n > 0 ? '#ffffff' : '#ffd24a'; g.fillText(txt, W / 2, Hh / 2);
        g.globalAlpha = 1;
      }
    }
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
      else {
        g.globalAlpha = Math.min(1, this.banner.t * 2);
        g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, Hh * 0.28 - 30 * sc, W, 54 * sc);
        g.font = `900 ${Math.round(30 * sc)}px system-ui`; g.textAlign = 'center'; g.fillStyle = this.banner.color;
        g.fillText('⚡ ' + this.banner.txt + ' ⚡', W / 2, Hh * 0.28 + 6 * sc);
        g.globalAlpha = 1;
      }
    }
    // thanh chiêu cho PC
    if (!mob && o.me != null && o.me >= 0) this.drawSkillBar(view.f[o.me], sc);
    if (o.netInfo) { g.font = '11px system-ui'; g.textAlign = 'left'; g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText(o.netInfo, 8, Hh - 8); }
  }
  drawCard(f, view, o, sc) {
    const g = this.g, H = HEROES[f.hero], left = f.slot === 0;
    const w = 210 * sc, h = 62 * sc, pad = 10;
    const x = left ? pad : this.W - pad - w, y = pad;
    g.fillStyle = 'rgba(8,12,20,0.72)'; roundRect(g, x, y, w, h, 10 * sc); g.fill();
    g.strokeStyle = TEAM[f.slot]; g.lineWidth = 2; g.stroke();
    // chân dung
    const px = left ? x + 30 * sc : x + w - 30 * sc, py = y + h / 2;
    g.fillStyle = H.color; g.beginPath(); g.arc(px, py, 20 * sc, 0, TAU); g.fill();
    g.fillStyle = '#0b1018'; g.font = `900 ${Math.round(18 * sc)}px system-ui`; g.textAlign = 'center'; g.fillText(H.name[0], px, py + 6 * sc);
    const tx = left ? x + 58 * sc : x + w - 58 * sc;
    g.textAlign = left ? 'left' : 'right';
    g.font = `bold ${Math.round(12 * sc)}px system-ui`; g.fillStyle = '#cfd8e6';
    g.fillText((f.slot === o.me ? '★ ' : '') + f.name.slice(0, 14), tx, y + 17 * sc);
    g.font = `900 ${Math.round(26 * sc)}px system-ui`; g.fillStyle = pctColor(f.pc);
    g.fillText(f.dead ? '—' : Math.round(f.pc) + '%', tx, y + 44 * sc);
    // mạng
    for (let i = 0; i < view.stocks; i++) {
      const sx = left ? x + w - 14 * sc - i * 14 * sc : x + 14 * sc + i * 14 * sc;
      g.fillStyle = i < f.sk ? TEAM[f.slot] : 'rgba(255,255,255,0.15)';
      g.beginPath(); g.arc(sx, y + 16 * sc, 5 * sc, 0, TAU); g.fill();
    }
    // nộ
    const rw = w - 70 * sc, rx = left ? x + 58 * sc : x + 12 * sc, ry = y + h - 11 * sc;
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(rx, ry, rw, 5 * sc);
    const ready = f.rg >= 100;
    g.fillStyle = ready ? (Math.floor(view.t * 6) % 2 ? '#ffd24a' : '#ff9a3a') : '#c08a2a';
    g.fillRect(rx, ry, rw * Math.min(1, f.rg / 100), 5 * sc);
  }
  drawSkillBar(f, sc) {
    if (!f) return;
    const g = this.g, H = HEROES[f.hero];
    const labels = { A: 'Q / Chuột T', B: 'E / Chuột P', C: 'Shift / R', D: 'F', U: 'Space' };
    const s = 52 * sc, gap = 8 * sc, n = 5, x0 = this.W / 2 - (n * s + (n - 1) * gap) / 2, y = this.H - s - 22 * sc;
    KEYS.forEach((k, i) => {
      const sk = H.skills[k]; if (!sk) return;
      const x = x0 + i * (s + gap);
      g.fillStyle = 'rgba(8,12,20,0.75)'; roundRect(g, x, y, s, s, 8 * sc); g.fill();
      const ready = k === 'U' ? (f.rg >= 100) : f.cd[k] <= 0;
      g.strokeStyle = ready ? H.color : 'rgba(255,255,255,0.2)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#fff'; g.font = `900 ${Math.round(18 * sc)}px system-ui`; g.textAlign = 'center';
      g.fillText(k === 'U' ? 'Nộ' : k, x + s / 2, y + s * 0.45);
      g.font = `${Math.round(9 * sc)}px system-ui`; g.fillStyle = '#b8c4d6';
      g.fillText(sk.name.length > 12 ? sk.name.slice(0, 11) + '…' : sk.name, x + s / 2, y + s * 0.72);
      g.fillStyle = '#8090a8'; g.fillText(labels[k], x + s / 2, y + s + 12 * sc);
      if (k !== 'U' && f.cd[k] > 0) {
        g.fillStyle = 'rgba(0,0,0,0.55)'; roundRect(g, x, y, s, s, 8 * sc); g.fill();
        g.fillStyle = '#fff'; g.font = `bold ${Math.round(14 * sc)}px system-ui`; g.fillText(f.cd[k].toFixed(1), x + s / 2, y + s * 0.6);
      }
      if (k === 'U' && !ready) { g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(x, y, s, s * (1 - f.rg / 100)); }
    });
  }
}

const CARD = { spade: '♠', club: '♣', diamond: '♦', heart: '♥', joker: '🃏', all: '★' };
function resText(f) {
  const w = f.ws, n = (v) => Math.round(v || 0);
  switch (f.hero) {
    case 'alice': case 'mirage': return 'Náo Nhiệt ' + n(w.hype);
    case 'wukong': return 'Côn Thức ' + n(w.con);
    case 'thanhphong': return (w.wind <= 35 ? '🍃 ' : w.wind >= 65 ? '🌪 ' : '🌀 ') + n(w.wind);
    case 'ariston': case 'olivia': case 'justus': return 'Đức Tin ' + n(w.faith);
    case 'boran': return 'Băng Cổ ' + n(w.ice);
    case 'kip': return 'Hư Không ' + '◆'.repeat(w.vp || 0);
    case 'bachdiep': return 'Kiếm ' + n(w.sw) + ' • ' + ({ luc: 'Lục Tinh', phong: 'Phong Ấn', thang: 'Thăng Hoa' }[w.stance] || '');
    case 'roxie': return '⚙' + n(w.gear) + ' • Mảnh ' + n(w.part) + '/3';
    case 'vector': return 'Đạn ' + n(w.am) + '/8';
    case 'clint': return 'Đạn ' + '●'.repeat(w.sh || 0) + (w.drag ? ' 🐉' + w.drag : '');
    case 'jack': return w.rr ? '🎲 Cò Quay Nga' : 'Ổ ' + n(w.am) + '/6 • ' + ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][w.die || 0];
    case 'songluc': return w.form === 'c' ? 'CHRONO ' + n(w.ac) + '/4' : 'NEO ' + n(w.an) + '/10';
    case 'victoria': return { luc: '🔫 Lục', ar: '🔥 AR', co: '🚩 Cờ' }[w.mode] || '';
    case 'joker': return w.card ? 'Bài ' + CARD[w.card] : 'Tay không';
    case 'raven': return 'Trường ' + n(w.ar) + ' • Tỉa ' + n(w.sn);
    case 'tsukiyo': return { phap: '🔮 Pháp', kiem: '⚔ Kiếm', phong: '🌀 Phong' }[w.sty] || '';
    case 'luca': return w.copy ? '🎭 ' + (HEROES[w.copy] ? HEROES[w.copy].name : '') + (w.copyOn ? ' (đang dùng)' : '') : '';
    case 'percy': return w.stk ? 'Dồn Dập x' + w.stk : '';
    case 'aria': return '♪'.repeat((w.notes || []).length);
    default: return '';
  }
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function easeOut(k) { return 1 - (1 - k) * (1 - k); }
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgb(a) { return `rgb(${a.map((v) => Math.round(clamp(v, 0, 255))).join(',')})`; }
export function lighten(c, k) { return rgb(hex(c).map((v) => v + (255 - v) * k)); }
export function darken(c, k) { return rgb(hex(c).map((v) => v * (1 - k))); }
