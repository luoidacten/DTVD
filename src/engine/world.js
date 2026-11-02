// ===== Engine trận đấu 1v1 =====
// Toàn bộ trạng thái nằm trong `w.s` là dữ liệu thuần (không hàm, không tham chiếu vòng)
// → host gửi nguyên snapshot cho máy kia, renderer vẽ cùng một kiểu dữ liệu cho offline/online.
import { TAU, clamp, angDiff, deg, makeRng } from './math.js';
import { ARENAS, edgeDist, clampInside } from './arena.js';
import { HEROES } from './heroes.js';
import { BAL } from './balance.js';

export const DT = 1 / 60;
export const KB_FRICTION = 2.4;   // tốc độ tắt dần lực văng (1/s)
export const BASE_SPEED = 205;    // tốc chạy cơ bản (px/s)
export const KG_SCALE = 0.64;     // lực văng tăng theo điểm văng %
export const DMG_SCALE = 0.75;    // hệ số điểm văng gây ra
export const CD_SCALE = 0.85;     // hồi chiêu toàn cục
export const LEDGE = 34;          // ra ngoài mép quá khoảng này thì rơi
export const GRAVITY = 1500;
export const KEYS = ['A', 'B', 'C', 'D', 'U'];
const BUFFER_T = 0.18;            // nhớ nút bấm sớm trong 0.18s

export const EMPTY_INPUT = Object.freeze({ mx: 0, my: 0, ax: 0, ay: 0, aim: false, held: {}, pressed: {} });

export class World {
  constructor(opts) {
    const o = Object.assign({ arena: 'go', stocks: 3, timeLimit: 180, seed: (Math.random() * 2 ** 32) >>> 0, heroes: ['valerius', 'gideon'], names: ['P1', 'P2'] }, opts);
    this.rng = makeRng(o.seed);
    this.s = {
      v: 1, tick: 0, t: 0, clock: 0, arena: o.arena, stocks: o.stocks, timeLimit: o.timeLimit,
      phase: 'countdown', cdT: 3, winner: null, endReason: null, nextId: 1,
      fighters: [], projs: [], zones: [], ents: [], evId: 0,
    };
    this.events = []; // sự kiện hình/âm (không ảnh hưởng gameplay)
    for (let i = 0; i < 2; i++) this.s.fighters.push(this.makeFighter(i, o.heroes[i], o.names[i]));
    for (const f of this.s.fighters) this.place(f);
  }
  get A() { return ARENAS[this.s.arena]; }
  id() { return this.s.nextId++; }
  rand(a = 0, b = 1) { return a + this.rng() * (b - a); }
  ev(type, data) { this.events.push(Object.assign({ id: ++this.s.evId, type }, data)); }
  text(x, y, txt, color = '#fff', size = 16) { this.ev('text', { x, y, txt, color, size }); }
  fighter(id) { return this.s.fighters.find((f) => f.id === id) || null; }
  foe(f) { return this.s.fighters.find((g) => g !== f) || null; }

  makeFighter(slot, heroId, name) {
    const H = HEROES[heroId];
    if (!H) throw new Error('Không có tướng ' + heroId);
    const f = {
      id: slot + 1, slot, hero: heroId, name: name || H.name, team: slot,
      x: 0, y: 0, z: 0, vz: 0, vx: 0, vy: 0, mvx: 0, mvy: 0, r: H.radius || 18,
      facing: slot === 0 ? 0 : Math.PI, percent: 0, stocks: this.s.stocks, rage: 0,
      cd: { A: 0, B: 0, C: 0, D: 0, U: 0 }, st: {}, act: null, dash: null, charge: null, buf: null,
      hitstun: 0, invuln: 0, falling: 0, respawn: 0, dead: false, flash: 0,
      ws: {}, lastHitBy: 0, stats: { dealt: 0, taken: 0, kos: 0, hits: 0 },
    };
    if (H.init) H.init(f, this);
    return f;
  }
  place(f) {
    const A = this.A;
    f.x = (f.slot === 0 ? -1 : 1) * Math.min(A.hx * 0.45, 300); f.y = 0;
    f.facing = f.slot === 0 ? 0 : Math.PI;
  }

  // ---------- chỉ số ----------
  H(f) { return HEROES[f.hero]; }
  // bộ chiêu đang dùng (Luca có thể đang dùng A/B/C sao chép)
  skillHero(f, k) { const c = f.ws.copy; return c && f.ws.copyOn && (k === 'A' || k === 'B' || k === 'C') && HEROES[c] ? c : f.hero; }
  skill(f, k) { return HEROES[this.skillHero(f, k)].skills[k]; }
  weight(f) {
    let w = this.H(f).weight * (f.st.heavy ? 1 + f.st.heavy.p : 1) * ((BAL[f.hero] && BAL[f.hero].w) || 1);
    if (f.st.poison) w *= 1 - 0.05 * f.st.poison.n;
    return w;
  }
  speed(f) {
    let s = BASE_SPEED * this.H(f).speed;
    if (f.st.haste) s *= 1 + f.st.haste.p;
    if (f.st.slow) s *= 1 - f.st.slow.p;
    return s;
  }
  alive(f) { return !f.dead && f.falling <= 0 && f.respawn <= 0; }
  superArmor(f) { return !!(f.st.armor || f.st.block || f.st.immortal || (f.act && f.act.armor)); }
  cc(f) { const s = f.st; return !!(s.stun || s.sleep || s.petrify || s.grabbed || s.charm); }
  canAct(f) {
    return this.alive(f) && f.hitstun <= 0 && !this.cc(f) && f.z <= 0 && !f.dash && !(f.act && f.act.lock !== false);
  }
  canMove(f) { return this.alive(f) && f.hitstun <= 0 && !this.cc(f) && !f.st.root; }
  ultReady(f) { const H = this.H(f); return H.ultReady ? H.ultReady(f, this) : f.rage >= 100; }

  canUse(f, k) {
    const sk = this.skill(f, k);
    if (!sk) return false;
    if (sk.recast && sk.recast(f, this)) return this.alive(f) && f.hitstun <= 0 && !this.cc(f) && !(f.act && f.act.lock !== false && !sk.recastBusy);
    if (sk.breakCC && this.alive(f) && f.cd[k] <= 0 && !f.st.grabbed && !(sk.can && !sk.can(f, this))) return true;
    if (!this.canAct(f)) return false;
    if (sk.mob && f.st.nodash) return false;
    if (f.cd[k] > 0) return false;
    if (f.st.silence && k !== 'A') return false;
    if (k === 'U' && !this.ultReady(f)) return false;
    if (sk.can && !sk.can(f, this)) return false;
    return true;
  }

  // ---------- hành động ----------
  // act: { dur, move (hệ số tốc chạy khi đang ra đòn), lock, anim, armor, ev:[{at, do, ...}] }
  act(f, key, o) {
    const evs = (o.ev || []).slice().sort((a, b) => a.at - b.at);
    f.act = { key, t: 0, dur: o.dur, move: o.move ?? 0, lock: o.lock ?? true, anim: o.anim || 'swing', ang: o.ang ?? f.facing,
      armor: o.armor ? 1 : 0, ev: evs, ei: 0, ax: o.ax ?? f.x, ay: o.ay ?? f.y, p: o.p ?? 0, tg: o.tg || 0, hit: [], h: o.h || this.skillHero(f, key) };
    f.facing = f.act.ang;
    this.runEvents(f, 0);
  }
  dash(f, o) {
    const a = o.ang;
    f.dash = { vx: Math.cos(a) * o.dist / o.dur, vy: Math.sin(a) * o.dist / o.dur, t: 0, dur: o.dur, hit: o.hit || null, hitIds: [],
      stopAtEdge: o.stopAtEdge ?? true, through: !!o.through, stopOnHit: !!o.stopOnHit, onEnd: o.onEnd || null, onHit: o.onHit || null, h: (f.act && f.act.h) || f.hero };
    if (o.invuln) f.invuln = Math.max(f.invuln, o.dur + 0.04);
  }
  runEvents(f, t) {
    const a = f.act;
    while (a && f.act === a && a.ei < a.ev.length && a.ev[a.ei].at <= t + 1e-9) {
      const e = a.ev[a.ei++];
      this.exec(f, e, a);
    }
  }
  exec(f, e, a) {
    const ang = e.ang != null ? e.ang : a ? a.ang + (e.rot || 0) : f.facing;
    switch (e.do) {
      case 'arc':
        this.ev('fx', { kind: 'arc', x: e.px ?? f.x, y: e.py ?? f.y, a: ang, r: e.range, arc: e.arc, color: this.H(f).color, life: 0.18, fid: f.id });
        return this.hitArc(f, ang, e);
      case 'line':
        this.ev('fx', { kind: 'thrust', x: e.px ?? f.x, y: e.py ?? f.y, a: ang, r: e.len, w: e.w, color: this.H(f).color, life: 0.18, fid: f.id });
        return this.hitLine(f, ang, e);
      case 'circle': return this.hitCircle(f, e.ox != null ? f.x + Math.cos(ang) * e.ox : (e.x ?? f.x), e.ox != null ? f.y + Math.sin(ang) * e.ox : (e.y ?? f.y), e);
      case 'proj': return this.proj(f, ang, e);
      case 'dash': return this.dash(f, Object.assign({}, e, { ang }));
      case 'status': return this.addStatus(f, e.st, e.dur, e.p);
      case 'fx': return this.ev('fx', { kind: e.kind, x: f.x, y: f.y, a: ang, r: e.r || 40, color: e.color || this.H(f).color, life: e.life || 0.3 });
      case 'custom': { const HH = HEROES[(a && a.h) || f.hero], fn = HH.ev && HH.ev[e.fn]; if (fn) fn(this, f, a, e); return; }
      default: return;
    }
  }

  // ---------- trạng thái ----------
  addStatus(f, type, dur, p = 0) {
    if (!f || f.dead) return;
    const bad = BAD.has(type);
    if (bad && (f.st.immortal || f.invuln > 0)) return;
    if (CC.has(type) && f.st.armor && f.st.armor.unstop) return;
    const s = f.st[type];
    if (type === 'burn' || type === 'bleed' || type === 'poison') {
      const cap = type === 'burn' ? 3 : type === 'bleed' ? 5 : 6;
      if (s) { s.t = Math.max(s.t, dur); s.n = Math.min(cap, s.n + 1); s.max = Math.max(s.max, dur); } else f.st[type] = { t: dur, p, n: 1, max: dur };
      return;
    }
    if (type === 'shield') {
      if (s) { s.p = Math.min(40, s.p + p); s.t = Math.max(s.t, dur); s.max = Math.max(s.max, dur); } else f.st.shield = { t: dur, p, max: dur };
      return;
    }
    if (type === 'petrify') { f.vx = 0; f.vy = 0; }
    if (s) { s.t = Math.max(s.t, dur); s.p = Math.max(s.p, p); s.max = Math.max(s.max, dur); }
    else f.st[type] = { t: dur, p, max: dur };
    if (type === 'stun' || type === 'grabbed' || type === 'sleep' || type === 'petrify' || type === 'charm') { this.cancelAct(f); }
  }
  cancelAct(f) {
    const a = f.act;
    const ch = f.charge;
    f.act = null; f.charge = null;
    if (f.dash) f.dash = null;
    const H = this.H(f);
    if ((a || ch) && H.onCancel) H.onCancel(this, f, a, ch);
  }

  // ---------- đánh trúng ----------
  targets(f) { return this.s.fighters.filter((t) => t.team !== f.team && this.alive(t)); }
  // mục tiêu đánh được: tướng địch + vật triệu hồi/ảo ảnh địch có thể bị đánh
  hitTargets(f) { return this.targets(f).concat(this.s.ents.filter((e) => e.hittable && e.team !== f.team && !e.dead)); }
  hitAny(f, t, h) { return t.kind ? this.hitEnt(f, t, h) : this.applyHit(f, t, h); }
  hitArc(f, ang, e) {
    let n = 0;
    const x0 = e.px ?? f.x, y0 = e.py ?? f.y, src = { x: x0, y: y0 };
    for (const t of this.hitTargets(f)) {
      const dx = t.x - x0, dy = t.y - y0, d = Math.hypot(dx, dy);
      if (d > e.range + t.r) continue;
      if (d > f.r + t.r && Math.abs(angDiff(ang, Math.atan2(dy, dx))) > deg(e.arc) / 2) continue;
      if (this.hitAny(f, t, Object.assign({ src, dist: d, range: e.range }, e))) n++;
    }
    return n;
  }
  hitLine(f, ang, e) {
    let n = 0;
    const c = Math.cos(ang), s = Math.sin(ang), ox = e.ox || 0, x0 = e.px ?? f.x, y0 = e.py ?? f.y;
    for (const t of this.hitTargets(f)) {
      const dx = t.x - x0, dy = t.y - y0;
      const u = dx * c + dy * s, v = -dx * s + dy * c;
      if (u < ox - t.r || u > e.len + t.r || Math.abs(v) > e.w / 2 + t.r) continue;
      if (this.hitAny(f, t, Object.assign({ src: { x: x0, y: y0 }, dist: u, range: e.len, angle: e.push === 'out' ? undefined : ang }, e))) n++;
    }
    return n;
  }
  hitCircle(f, x, y, e) {
    let n = 0;
    for (const t of this.hitTargets(f)) {
      const d = Math.hypot(t.x - x, t.y - y);
      if (d > e.r + t.r) continue;
      if (this.hitAny(f, t, Object.assign({ src: { x, y }, dist: d, range: e.r }, e))) n++;
    }
    if (e.fx !== false) this.ev('fx', { kind: e.fxKind || 'ring', x, y, r: e.r, color: e.color || this.H(f).color, life: 0.35 });
    return n;
  }

  // h: { dmg, kb, kg, angle?, stun, slow:[p,dur], silence, root, burn, knockup, hitstun, noKnock, tag, unblock, src }
  applyHit(att, t, h) {
    if (!this.alive(t) || t.invuln > 0) return false;
    const AH = this.H(att), TH = this.H(t);
    const bal = BAL[att.hero] || {};
    const info = { dmgK: bal.d || 1, kbK: bal.k || 1, extra: null };
    if (AH.onDeal) AH.onDeal(this, att, t, h, info);
    if (TH.onTake) TH.onTake(this, t, att, h, info);
    if (info.cancel) return false;
    if (att.st.invis) { const s = att.st.invis; delete att.st.invis; if (AH.onStatusEnd) AH.onStatusEnd(this, att, 'invis', s); }
    let dmg = (h.dmg || 0) * DMG_SCALE * info.dmgK * (TH.taken || 1);
    if (att.st.empower) dmg *= 1 + att.st.empower.p;
    const block = !h.unblock && t.st.block, armor = t.st.armor, immortal = t.st.immortal;
    if (block) dmg *= 0.2;
    if (armor) dmg *= armor.p || 1;
    if (immortal) dmg = 0;
    const sh = !h.unblock && t.st.shield;
    let shieldFull = false;
    if (sh && dmg > 0) { const ab = Math.min(dmg, sh.p); sh.p -= ab; dmg -= ab; if (sh.p <= 0.01) delete t.st.shield; shieldFull = dmg <= 0.01; }
    if (t.st.sleep) { delete t.st.sleep; info.kbK *= 2; this.text(t.x, t.y - 56, 'TỈNH GIẤC!', '#c0b0ff', 15); }
    t.percent = Math.min(999, t.percent + dmg);
    att.stats.dealt += dmg; t.stats.taken += dmg; att.stats.hits++;
    t.lastHitBy = att.id;
    att.rage = Math.min(100, att.rage + dmg * 0.32);
    t.rage = Math.min(100, t.rage + dmg * 0.26);
    let mag = 0;
    if (!h.noKnock && !immortal) {
      const src = h.src || att;
      const ang = h.angle ?? Math.atan2(t.y - src.y, t.x - src.x);
      mag = ((h.kb || 0) + (h.kg || 0) * KG_SCALE * t.percent) * info.kbK / this.weight(t);
      if (h.fixedKb) mag = h.fixedKb * info.kbK;
      if (block) mag *= 0.08;
      if (armor) mag *= armor.p || 1;
      if (shieldFull) mag *= 0.4;
      if (t.st.petrify) mag = 0;
      if (mag > 1) {
        t.vx = Math.cos(ang) * mag; t.vy = Math.sin(ang) * mag;
        let hs = h.hitstun ?? (0.08 + mag * 0.00042);
        if (this.superArmor(t)) hs = 0;
        else this.cancelAct(t);
        t.hitstun = Math.max(t.hitstun, hs);
      }
      if (h.knockup && !this.superArmor(t)) { t.vz = Math.max(t.vz, h.knockup); t.z = Math.max(t.z, 1); }
    }
    const hard = !(block || immortal);
    if (h.stun && hard) this.addStatus(t, 'stun', h.stun);
    if (h.root && hard) this.addStatus(t, 'root', h.root);
    if (h.silence && hard) this.addStatus(t, 'silence', h.silence);
    if (h.slow) this.addStatus(t, 'slow', h.slow[1], h.slow[0]);
    if (h.burn) this.addStatus(t, 'burn', h.burn, 0.9);
    if (h.bleed) this.addStatus(t, 'bleed', 3, 0.5);
    if (h.poison) this.addStatus(t, 'poison', 5, 0.6);
    if (h.nodash) this.addStatus(t, 'nodash', h.nodash);
    if (h.charm && hard) this.addStatus(t, 'charm', h.charm, att.id);
    if (h.sleep && hard) this.addStatus(t, 'sleep', h.sleep);
    if (h.blind) this.addStatus(t, 'blind', h.blind);
    t.flash = 0.12;
    if (info.extra) info.extra();
    if (AH.afterDeal) AH.afterDeal(this, att, t, h, mag);
    this.ev('hit', { x: t.x, y: t.y, dmg: Math.round(dmg * 10) / 10, mag: Math.round(mag), pct: Math.round(t.percent), color: AH.color, blocked: !!(block || immortal), tid: t.id });
    return true;
  }

  // ---------- đạn ----------
  // e: { speed, range, r, kind, color, hit:{...}, pierce, explode:{r,...}, breaks (phá đạn), ox (lệch ra trước) }
  proj(f, ang, e) {
    const ox = e.ox ?? f.r + 4;
    const p = { id: this.id(), owner: f.id, team: f.team, x: f.x + Math.cos(ang) * ox, y: f.y + Math.sin(ang) * ox,
      vx: Math.cos(ang) * e.speed, vy: Math.sin(ang) * e.speed, r: e.r || 6, range: e.range || 500, trav: 0,
      kind: e.kind || 'bolt', color: e.color || this.H(f).color, hit: e.hit || {}, pierce: !!e.pierce, hitIds: [],
      explode: e.explode || null, endBoom: !!e.endBoom, breaks: !!e.breaks, home: e.home || 0, tg: e.tg || 0, tag: e.tag || '', h: (f.act && f.act.h) || f.hero, wall: !!e.wall };
    if (e.px != null) { p.x = e.px; p.y = e.py; }
    this.s.projs.push(p);
    return p;
  }
  stepProjs(dt) {
    const A = this.A, keep = [];
    for (const p of this.s.projs) {
      const owner = this.fighter(p.owner);
      if (p.home && p.tg) {
        const t = this.fighter(p.tg);
        if (t && this.alive(t)) {
          const sp = Math.hypot(p.vx, p.vy), a0 = Math.atan2(p.vy, p.vx), a1 = Math.atan2(t.y - p.y, t.x - p.x);
          const a = a0 + clamp(angDiff(a0, a1), -p.home * dt, p.home * dt);
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
        }
      }
      const sx = p.vx * dt, sy = p.vy * dt;
      p.x += sx; p.y += sy; p.trav += Math.hypot(sx, sy);
      let dead = false;
      // cột chắn đạn
      if (!p.wall) for (const c of A.pillars) if (Math.hypot(p.x - c.x, p.y - c.y) < c.r + p.r) { dead = true; break; }
      // khiên chặn đạn (status reflect = phản đạn, bwall = chặn)
      if (!dead) for (const t of this.s.fighters) {
        if (t.team === p.team || !(t.st.bwall || t.st.reflect) || Math.hypot(t.x - p.x, t.y - p.y) > t.r + p.r + 22) continue;
        if (t.st.reflect) { p.team = t.team; p.owner = t.id; p.vx = -p.vx; p.vy = -p.vy; p.hitIds = []; p.trav = 0; p.h = t.hero; this.ev('fx', { kind: 'spark', x: p.x, y: p.y, r: 24, color: '#ffffff', life: 0.2 }); }
        else { dead = true; this.ev('fx', { kind: 'spark', x: p.x, y: p.y, r: 20, color: '#9ec9ff', life: 0.2 }); }
        break;
      }
      if (!dead) for (const t of this.s.fighters.concat(this.s.ents)) {
        if (t.team === p.team || p.hitIds.includes(t.id)) continue;
        if (t.kind ? !t.hittable || t.dead : !this.alive(t)) continue;
        if (t.kind && t.eatsProj) { p.hitIds.push(t.id); dead = true; this.ev('fx', { kind: 'spark', x: p.x, y: p.y, r: 18, color: '#c0a0ff', life: 0.2 }); break; }
        if (Math.hypot(t.x - p.x, t.y - p.y) > t.r + p.r) continue;
        p.hitIds.push(t.id);
        if (owner) {
          if (p.explode) { this.boom(owner, p); dead = true; break; }
          const h = Object.assign({ src: { x: p.x - p.vx, y: p.y - p.vy }, angle: Math.atan2(p.vy, p.vx), proj: p.kind, tag: p.tag }, p.hit);
          const ok = this.hitAny(owner, t, h);
          const H = HEROES[p.h || owner.hero]; if (ok && !t.kind && H.onProjHit) H.onProjHit(this, owner, p, t);
        }
        if (!p.pierce) { dead = true; break; }
      }
      // đạn phá đạn (Kiếm Khí)
      if (!dead && p.breaks) for (const q of this.s.projs) {
        if (q.team !== p.team && !q.gone && Math.hypot(q.x - p.x, q.y - p.y) < q.r + p.r + 8) { q.gone = true; this.ev('fx', { kind: 'spark', x: q.x, y: q.y, r: 22, color: '#ffffff', life: 0.25 }); }
      }
      if (!dead && p.trav >= p.range) { dead = true; if (p.endBoom && owner) this.boom(owner, p); if (owner && !p.hitIds.length) { const H = HEROES[p.h || owner.hero]; if (H.onProjEnd) H.onProjEnd(this, owner, p); } }
      if (!dead && edgeDist(A, p.x, p.y) < -400) dead = true;
      if (p.gone) dead = true;
      if (!dead) keep.push(p);
      else if (!p.explode || !p.endBoom) this.ev('fx', { kind: 'puff', x: p.x, y: p.y, r: p.r * 2.4, color: p.color, life: 0.2 });
    }
    this.s.projs = keep.filter((p) => !p.gone);
  }
  boom(owner, p) {
    const e = Object.assign({ fxKind: 'boom', color: p.color }, p.explode);
    this.hitCircle(owner, p.x, p.y, e);
    this.ev('sfx', { name: 'boom', x: p.x, y: p.y, v: Math.min(1, e.r / 120) });
    const H = HEROES[p.h || owner.hero]; if (H.onBoom) H.onBoom(this, owner, p);
  }

  // ---------- vùng (lửa, thiên thạch, lồng đấu...) ----------
  zone(f, o) {
    const z = Object.assign({ id: this.id(), owner: f.id, team: f.team, t: 0, delay: 0, dur: 1, tick: 0.5, tickT: 0, r: 80, kind: 'fire', color: this.H(f).color, boomed: false }, o);
    this.s.zones.push(z);
    return z;
  }
  stepZones(dt) {
    const keep = [];
    for (const z of this.s.zones) {
      z.t += dt;
      const owner = this.fighter(z.owner);
      if (!owner) continue;
      if (z.delay && !z.boomed && z.t >= z.delay) {
        z.boomed = true;
        if (z.boom) { this.hitCircle(owner, z.x, z.y, Object.assign({ r: z.r, fxKind: 'boom', color: z.color }, z.boom)); this.ev('sfx', { name: 'boom', v: 1 }); this.ev('shake', { p: 14 }); }
      }
      const live = !z.delay || z.boomed;
      if (live && z.hit) {
        z.tickT -= dt;
        if (z.tickT <= 0) {
          z.tickT = z.tick;
          for (const t of this.targets(owner)) if (Math.hypot(t.x - z.x, t.y - z.y) < z.r + t.r * 0.5) this.applyHit(owner, t, Object.assign({ src: z, noKnock: true }, z.hit));
        }
      }
      if (z.kind === 'cage' && live) {
        for (const t of this.s.fighters) {
          if (t.team === z.team || !this.alive(t) || !z.inside || !z.inside.includes(t.id)) continue;
          const dx = t.x - z.x, dy = t.y - z.y, d = Math.hypot(dx, dy), max = z.r - t.r;
          if (d <= max || d < 0.01) continue;
          const nx = dx / d, ny = dy / d;
          t.x = z.x + nx * max; t.y = z.y + ny * max;
          const vn = t.vx * nx + t.vy * ny;
          if (vn > 0) {
            t.vx -= 2 * vn * nx; t.vy -= 2 * vn * ny;
            if (vn > 250) { t.percent += 2; this.text(t.x, t.y - 40, 'NẢY DÂY!', '#ff9a6a', 14); this.ev('shake', { p: 4 }); }
          }
        }
      }
      if (z.t < (z.delay || 0) + z.dur) keep.push(z);
    }
    this.s.zones = keep;
  }

  // ---------- vật triệu hồi / ảo ảnh / ụ súng ----------
  // e: { kind, x, y, r, dur, hittable, hp, eatsProj, ... } — hành vi ở HEROES[h].ents[kind]
  ent(f, o) {
    const e = Object.assign({ id: this.id(), h: (f.act && f.act.h) || f.hero, owner: f.id, team: f.team, t: 0, dur: 5, r: 16, hp: 1, hittable: false, x: f.x, y: f.y, fa: f.facing }, o);
    this.s.ents.push(e);
    return e;
  }
  entDef(e) { const H = HEROES[e.h]; return (H && H.ents && H.ents[e.kind]) || {}; }
  owned(f, kind) { return this.s.ents.filter((e) => e.owner === f.id && e.kind === kind && !e.dead); }
  hitEnt(att, e, h) {
    if (e.dead) return false;
    const D = this.entDef(e);
    if (D.onHit) { D.onHit(this, e, att, h); return true; }
    e.hp -= Math.max(1, (h.dmg || 0) / 6);
    this.ev('hit', { x: e.x, y: e.y, dmg: 0, mag: 120, pct: 0, color: this.H(att).color, blocked: false, tid: 0 });
    if (e.hp <= 0) this.killEnt(e, att);
    return true;
  }
  killEnt(e, by) {
    if (e.dead) return;
    e.dead = true;
    const D = this.entDef(e);
    this.ev('fx', { kind: 'puff', x: e.x, y: e.y, r: e.r * 2, color: '#ffffff', life: 0.35 });
    if (D.onDeath) D.onDeath(this, e, by);
  }
  stepEnts(dt) {
    for (const e of this.s.ents) {
      if (e.dead) continue;
      e.t += dt;
      const D = this.entDef(e);
      if (!this.fighter(e.owner)) { e.dead = true; continue; }
      if (D.update) D.update(this, e, dt);
      if (!e.dead && e.dur && e.t >= e.dur) { e.dead = true; if (D.onEnd) D.onEnd(this, e); }
    }
    this.s.ents = this.s.ents.filter((e) => !e.dead);
  }
  // đòn đánh của vật triệu hồi (dùng owner để tính nội tại/thống kê)
  entHit(e, t, h) { const o = this.fighter(e.owner); return o ? this.hitAny(o, t, Object.assign({ src: e }, h)) : false; }

  // ---------- vòng lặp ----------
  step(inputs) {
    const s = this.s, dt = DT;
    s.tick++; s.t += dt;
    if (s.phase === 'countdown') {
      const before = Math.ceil(s.cdT);
      s.cdT -= dt;
      if (Math.ceil(s.cdT) !== before && s.cdT > 0) this.ev('count', { n: Math.ceil(s.cdT) });
      if (s.cdT <= 0) { s.phase = 'fight'; this.ev('count', { n: 0 }); }
      for (const f of s.fighters) this.idleFace(f, inputs[f.slot] || EMPTY_INPUT);
      return;
    }
    if (s.phase === 'over') {
      for (const f of s.fighters) this.physics(f, dt, EMPTY_INPUT);
      this.stepProjs(dt);
      return;
    }
    s.clock += dt;
    for (const f of s.fighters) this.stepFighter(f, dt, inputs[f.slot] || EMPTY_INPUT);
    this.stepProjs(dt);
    this.stepZones(dt);
    this.stepEnts(dt);
    this.collideFighters();
    if (s.timeLimit && s.clock >= s.timeLimit) this.end(null, 'time');
  }

  idleFace(f, inp) {
    if (inp.aim) f.facing = Math.atan2(inp.ay - f.y, inp.ax - f.x);
  }

  stepFighter(f, dt, inp) {
    const H = this.H(f);
    // --- đồng hồ ---
    for (const k of KEYS) if (f.cd[k] > 0) f.cd[k] = Math.max(0, f.cd[k] - dt);
    for (const k in f.st) {
      const s = f.st[k];
      if (k === 'burn' || k === 'bleed' || k === 'poison') f.percent += s.p * s.n * dt;
      s.t -= dt;
      if (s.t <= 0) { delete f.st[k]; if (H.onStatusEnd) H.onStatusEnd(this, f, k, s); }
    }
    if (f.invuln > 0) f.invuln -= dt;
    if (f.hitstun > 0) f.hitstun -= dt;
    if (f.flash > 0) f.flash -= dt;
    if (f.dead) return;
    if (f.falling > 0) {
      f.falling -= dt;
      f.x += f.vx * dt; f.y += f.vy * dt; f.z -= 500 * dt;
      if (f.falling <= 0) this.onKO(f);
      return;
    }
    if (f.respawn > 0) {
      f.respawn -= dt;
      if (f.respawn <= 0) this.doRespawn(f);
      return;
    }
    if (this.s.phase === 'fight') f.rage = Math.min(100, f.rage + 0.35 * dt);
    if (H.update) H.update(this, f, dt, inp);

    // --- hành động đang diễn ra ---
    if (f.act) {
      const a = f.act;
      a.t += dt;
      this.runEvents(f, a.t);
      if (f.act === a && a.t >= a.dur) { f.act = null; if (H.onActEnd) H.onActEnd(this, f, a); }
    }

    // --- nút bấm ---
    if (this.s.phase === 'fight') this.handleInput(f, dt, inp);

    // --- hướng nhìn ---
    if (!f.act && !f.dash && this.canMove(f)) {
      if (inp.aim) f.facing = Math.atan2(inp.ay - f.y, inp.ax - f.x);
      else if (inp.mx || inp.my) f.facing = Math.atan2(inp.my, inp.mx);
    } else if (f.charge && inp.aim) f.facing = Math.atan2(inp.ay - f.y, inp.ax - f.x);

    this.physics(f, dt, inp);
  }

  aimCtx(f, inp, sk) {
    let ang = f.facing, ax = f.x + Math.cos(f.facing) * 200, ay = f.y + Math.sin(f.facing) * 200;
    if (inp.aim) { ang = Math.atan2(inp.ay - f.y, inp.ax - f.x); ax = inp.ax; ay = inp.ay; }
    else if (inp.mx || inp.my) { ang = Math.atan2(inp.my, inp.mx); ax = f.x + Math.cos(ang) * 200; ay = f.y + Math.sin(ang) * 200; }
    else {
      // không ngắm và đứng yên: hướng về đối thủ gần nhất
      const t = this.targets(f)[0];
      if (t) { ang = Math.atan2(t.y - f.y, t.x - f.x); ax = t.x; ay = t.y; }
    }
    if (sk && sk.maxRange) {
      const d = Math.hypot(ax - f.x, ay - f.y);
      if (d > sk.maxRange) { ax = f.x + Math.cos(ang) * sk.maxRange; ay = f.y + Math.sin(ang) * sk.maxRange; }
    }
    return { ang, ax, ay, p: 0 };
  }

  handleInput(f, dt, inp) {
    const H = this.H(f);
    // tụ lực: giữ nút → tăng; thả → tung
    if (f.charge) {
      const c = f.charge, sk = this.skill(f, c.key);
      c.t += dt;
      if (sk.onCharge) sk.onCharge(this, f, c, dt);
      if (!inp.held[c.key] || c.t >= sk.hold + (sk.autoRelease ?? 0.35)) {
        f.charge = null;
        const ctx = this.aimCtx(f, inp, sk);
        ctx.p = clamp(c.t / sk.hold, 0, 1);
        f.facing = ctx.ang;
        sk.cast(this, f, ctx);
        if (!sk.manualCd) f.cd[c.key] = (sk.cd || 0) * CD_SCALE;
        this.ev('cast', { fid: f.id, key: c.key });
      }
      return;
    }
    if (f.buf) { f.buf.t -= dt; if (f.buf.t <= 0) f.buf = null; }
    for (const k of KEYS) if (inp.pressed[k]) f.buf = { k, t: BUFFER_T };
    let k = f.buf && f.buf.k;
    // giữ A = đánh liên tục
    if (!k && inp.held.A && this.skill(f, 'A') && !this.skill(f, 'A').hold && !this.skill(f, 'A').noRepeat) k = 'A';
    if (!k) return;
    if (!this.canUse(f, k)) return;
    f.buf = null;
    const sk = this.skill(f, k);
    if (sk.recast && sk.recast(f, this)) {
      const ctx = this.aimCtx(f, inp, sk);
      sk.recastUse(this, f, ctx);
      this.ev('cast', { fid: f.id, key: k });
      return;
    }
    if (sk.hold && !(sk.holdIf && !sk.holdIf(f, this))) {
      f.charge = { key: k, t: 0 };
      if (sk.onChargeStart) sk.onChargeStart(this, f);
      return;
    }
    const ctx = this.aimCtx(f, inp, sk);
    f.facing = ctx.ang;
    if (k === 'U') { f.rage = 0; this.ev('ult', { fid: f.id, name: sk.name }); }
    sk.cast(this, f, ctx);
    if (!sk.manualCd) f.cd[k] = Math.max(f.cd[k], (sk.cd || 0) * CD_SCALE);
    this.ev('cast', { fid: f.id, key: k });
  }

  physics(f, dt, inp) {
    const A = this.A, H = this.H(f);
    let mx = 0, my = 0;
    if (this.canMove(f) && !f.dash && this.s.phase === 'fight') {
      const L = Math.hypot(inp.mx, inp.my);
      if (L > 0.05) {
        let k = 1;
        if (f.act) k = f.act.move;
        if (f.charge) k = this.skill(f, f.charge.key).chargeMove ?? 0.4;
        if (f.st.channel) k = Math.min(k, f.st.channel.p);
        const sp = this.speed(f) * k * Math.min(1, L);
        mx = (inp.mx / L) * sp; my = (inp.my / L) * sp;
      }
    }
    // mê hoặc: tự bước về phía kẻ mê hoặc
    if (f.st.charm && this.alive(f)) {
      const c = this.fighter(f.st.charm.p);
      if (c) { const a = Math.atan2(c.y - f.y, c.x - f.x), sp = this.speed(f) * 0.55; mx = Math.cos(a) * sp; my = Math.sin(a) * sp; f.facing = a; }
    }
    if (f.st.petrify) { mx = my = 0; f.vx = f.vy = 0; }
    f.mvx = mx; f.mvy = my;
    if (f.dash) {
      const d = f.dash;
      d.t += dt;
      const nx = f.x + d.vx * dt, ny = f.y + d.vy * dt;
      if (d.stopAtEdge && edgeDist(A, nx, ny) < 6) { this.endDash(f); }
      else { f.x = nx; f.y = ny; }
      if (f.dash && d.hit) {
        for (const t of this.targets(f)) {
          if (d.hitIds.includes(t.id) || Math.hypot(t.x - f.x, t.y - f.y) > f.r + t.r + 6) continue;
          d.hitIds.push(t.id);
          this.applyHit(f, t, Object.assign({ src: f, angle: Math.atan2(d.vy, d.vx) }, d.hit));
          if (d.onHit) { const HH = HEROES[d.h || f.hero], fn = HH.ev && HH.ev[d.onHit]; if (fn) fn(this, f, f.act, d, t); }
          if (d.stopOnHit) { this.endDash(f); break; }
        }
      }
      if (f.dash && d.t >= d.dur) this.endDash(f);
    } else {
      f.x += (mx + f.vx) * dt; f.y += (my + f.vy) * dt;
    }
    const fr = Math.exp(-KB_FRICTION * A.fric * dt);
    f.vx *= fr; f.vy *= fr;
    if (Math.abs(f.vx) < 1) f.vx = 0;
    if (Math.abs(f.vy) < 1) f.vy = 0;
    // trục z (hất tung / nhảy)
    if (f.z > 0 || f.vz > 0) {
      f.vz -= GRAVITY * dt; f.z += f.vz * dt;
      if (f.z <= 0) { f.z = 0; f.vz = 0; }
    }
    this.collidePillars(f);
    // mép sàn: đi bộ không thể tự rơi; chỉ lực văng mới hất ra ngoài
    const kbSp = Math.hypot(f.vx, f.vy);
    const ed = edgeDist(A, f.x, f.y);
    if (f.z <= 0 && ed < -LEDGE && this.alive(f)) { this.startFall(f); return; }
    if (ed < 0 && kbSp < 150 && f.hitstun <= 0) clampInside(A, f, 0);
  }
  endDash(f) { const d = f.dash; f.dash = null; if (d && d.onEnd) { const HH = HEROES[d.h || f.hero], fn = HH.ev && HH.ev[d.onEnd]; if (fn) fn(this, f, f.act, d); } }

  collidePillars(f) {
    if (f.z > 40) return;
    for (const p of this.A.pillars) {
      const dx = f.x - p.x, dy = f.y - p.y, d = Math.hypot(dx, dy), min = p.r + f.r;
      if (d >= min) continue;
      const nx = d > 0.01 ? dx / d : 1, ny = d > 0.01 ? dy / d : 0;
      f.x = p.x + nx * min; f.y = p.y + ny * min;
      if (f.dash) this.endDash(f);
      const vn = f.vx * nx + f.vy * ny;
      if (vn < 0) {
        const sp = Math.hypot(f.vx, f.vy);
        f.vx -= 1.6 * vn * nx; f.vy -= 1.6 * vn * ny;
        f.vx *= 0.55; f.vy *= 0.55;
        if (sp > 380) {
          this.addStatus(f, 'stun', 0.3); f.percent += 1.5;
          this.text(f.x, f.y - 40, 'ĐẬP TƯỜNG!', '#dddddd', 14);
          this.ev('shake', { p: 5 }); this.ev('sfx', { name: 'wall' });
          this.ev('fx', { kind: 'dust', x: f.x - nx * f.r, y: f.y - ny * f.r, r: 30, color: '#bbbbbb', life: 0.4 });
        }
      }
    }
  }
  collideFighters() {
    const [a, b] = this.s.fighters;
    if (!this.alive(a) || !this.alive(b) || a.z > 30 || b.z > 30) return;
    if (a.dash && a.dash.through || b.dash && b.dash.through) return;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
    if (d >= min || d < 0.01) return;
    const push = (min - d) / 2, nx = dx / d, ny = dy / d;
    a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
  }

  // ---------- rơi đài / KO ----------
  startFall(f) {
    const H = this.H(f);
    if (H.onFall && H.onFall(this, f) === false) return;
    f.falling = 0.8; f.act = null; f.charge = null; f.dash = null;
    const sp = Math.hypot(f.vx, f.vy);
    if (sp < 120) { const a = Math.atan2(f.y, f.x); f.vx = Math.cos(a) * 120; f.vy = Math.sin(a) * 120; }
    const killer = this.fighter(f.lastHitBy);
    if (killer && killer !== f) killer.stats.kos++;
    this.ev('ko', { fid: f.id, x: f.x, y: f.y, a: Math.atan2(f.vy, f.vx), color: f.slot === 0 ? '#5aa9ff' : '#ff5a5a' });
    this.ev('shake', { p: 18 });
  }
  onKO(f) {
    f.falling = 0;
    f.stocks--;
    for (const z of this.s.zones) if (z.owner === f.id && z.kind === 'cage') z.dur = 0;
    const H = this.H(f); if (H.onKO) H.onKO(this, f);
    if (f.stocks <= 0) {
      f.dead = true;
      const other = this.foe(f);
      this.end(other ? other.slot : null, 'ko');
      return;
    }
    f.respawn = 1.3;
  }
  doRespawn(f) {
    const H = this.H(f);
    const keep = { stats: f.stats, rage: f.rage, stocks: f.stocks, name: f.name };
    const nf = this.makeFighter(f.slot, f.hero, f.name);
    Object.assign(f, nf, keep);
    // vào lại từ trên cao ở phía mình
    f.x = (f.slot === 0 ? -1 : 1) * Math.min(this.A.hx * 0.3, 200); f.y = 0;
    f.z = 160; f.vz = 0; f.invuln = 2;
    clampInside(this.A, f, 40);
    this.ev('respawn', { fid: f.id, x: f.x, y: f.y });
    if (H.onRespawn) H.onRespawn(this, f);
  }
  end(winnerSlot, reason) {
    const s = this.s;
    if (s.phase === 'over') return;
    if (winnerSlot == null && reason === 'time') {
      const [a, b] = s.fighters;
      if (a.stocks !== b.stocks) winnerSlot = a.stocks > b.stocks ? 0 : 1;
      else if (Math.abs(a.percent - b.percent) >= 1) winnerSlot = a.percent < b.percent ? 0 : 1;
    }
    s.phase = 'over'; s.winner = winnerSlot; s.endReason = reason;
    this.ev('end', { winner: winnerSlot, reason });
  }
  forfeit(slot) { this.end(slot === 0 ? 1 : 0, 'forfeit'); }

  // ---------- snapshot ----------
  snapshot() { return this.s; }
  takeEvents() { const e = this.events; this.events = []; return e; }
}

const BAD = new Set(['stun', 'slow', 'silence', 'root', 'burn', 'grabbed', 'marked', 'bleed', 'poison', 'charm', 'sleep', 'petrify', 'nodash', 'blind', 'dark']);
const CC = new Set(['stun', 'slow', 'silence', 'root', 'charm', 'sleep', 'blind']);
export const CC_ALL = CC;
