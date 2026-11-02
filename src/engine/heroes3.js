// ===== Đợt 2: 14 tướng làm lại theo bộ chiêu gốc =====
// Boran, Ariston, Dr. Vector, Lyra, Ratok, Kip, Olivia, Justus, Mirage, Dahlia, Luca, Dr. Caelus, Bạch Diệp, Tsukiyo
import { TAU, clamp, angDiff, deg } from './math.js';
import { edgeDist, clampInside } from './arena.js';
import { arc, line, circle, proj, dash, custom, fx, teleport, behindPos, angOf, outAng, foeOf, gauge, now } from './kit.js';

const CLEAN = ['stun', 'sleep', 'root', 'charm', 'petrify', 'silence', 'slow', 'burn', 'bleed', 'poison', 'blind', 'nodash'];
const cleanse = (f) => { for (const k of CLEAN) delete f.st[k]; f.hitstun = 0; };
const pt = (f, c, max) => { const d = Math.min(max, Math.hypot(c.ax - f.x, c.ay - f.y)); return { x: f.x + Math.cos(c.ang) * d, y: f.y + Math.sin(c.ang) * d }; };

// =====================================================================
const boran = {
  name: 'Boran', title: 'Cuồng Nộ Băng Cổ', role: 'Đấu Sĩ', color: '#93d5ec', weapon: 'axes', weight: 1.35, speed: 0.94, radius: 20,
  passive: { name: 'Huyết Mạch Băng Cổ', desc: 'Băng Cổ 0–100: +8 mỗi đòn trúng, +4 khi bị đánh. Đủ 100 (Thấu Cốt): đòn đánh +15% sát thương. D tiêu Băng Cổ để tạo khiên.' },
  init(f) { f.ws.ice = f.ws.ice || 0; },
  afterDeal(w, f) { gauge(f, 'ice', 8); },
  onTake(w, f) { gauge(f, 'ice', 4); },
  onDeal(w, f, t, h, info) { if (f.ws.ice >= 100) info.dmgK *= 1.15; if (f.st.icebeast) info.kbK *= 1.25; },
  update(w, f, dt) {
    if (f.st.whirl) { f.ws.wt -= dt; if (f.ws.wt <= 0) { f.ws.wt = 0.33; w.hitCircle(f, f.x, f.y, { r: 110, dmg: 2.4, kb: f.st.icebeast ? 120 : 75, kg: 2.4, color: '#bfefff' }); } }
  },
  skills: {
    A: { name: 'Song Rìu Phi Phao', cd: 0.9, desc: 'Ném liên tiếp 2 rìu: rìu 1 làm chậm 40%, rìu 2 trúng cùng mục tiêu thì CHOÁNG 0.8s (mỗi 3s). Trúng: bấm A lần nữa trong 2.5s để giật xích lao tới.', shape: { type: 'proj', len: 420, w: 14 }, ai: { kind: 'poke', max: 400 },
      recast(f, w) { const a = f.ws.axe; return !!(a && a.until > now(w) && w.alive(w.fighter(a.tid) || {})); },
      recastUse(w, f) { const t = w.fighter(f.ws.axe.tid); f.ws.axe = null; const a = angOf(f, t), d = Math.max(0, Math.hypot(t.x - f.x, t.y - f.y) - f.r - t.r - 4); w.act(f, 'A', { dur: 0.2, anim: 'dash', ang: a, ev: [dash(0, { dist: d, dur: 0.15, stopAtEdge: true })] }); },
      cast(w, f, c) { const o = { speed: 850, range: 420, r: 9, kind: 'axe', color: '#bfefff' }; w.act(f, 'A', { dur: 0.3, move: 0.5, anim: 'shoot', ang: c.ang, ev: [proj(0.04, Object.assign({ tag: 'a1', hit: { dmg: 3.4, kb: 50, kg: 2, slow: [0.4, 2] } }, o)), proj(0.16, Object.assign({ tag: 'a2', hit: { dmg: 3.4, kb: 80, kg: 3 } }, o))] }); } },
    B: { name: 'Cuồng Phong Băng Trảm', cd: 4, desc: 'Xoay song rìu 2s vừa xoay vừa chạy (+15% tốc chạy): 6 nhịp chém mọi kẻ địch quanh mình, miễn làm chậm.', shape: { type: 'circle', r: 110, self: true }, ai: { kind: 'fin', max: 110 },
      cast(w, f) { w.addStatus(f, 'whirl', 2); w.addStatus(f, 'haste', 2, 0.15); delete f.st.slow; f.ws.wt = 0; } },
    C: { name: 'Tuyết Lở Áp Sát', cd: 6, mob: true, maxRange: 300, desc: 'Gầm lên nhảy vọt tới điểm ngắm (tối đa 300px): dậm nổ hất tung mọi kẻ quanh điểm đáp.', shape: { type: 'point', range: 300, r: 100 }, ai: { kind: 'atk', max: 300 },
      cast(w, f, c) { const p = pt(f, c, 300); w.ev('fx', { kind: 'ring', x: p.x, y: p.y, r: 100, color: '#ff5050', life: 0.45 }); f.vz = 520; f.z = 1; w.act(f, 'C', { dur: 0.55, anim: 'leap', ang: c.ang, ev: [custom(0.45, 'land', { x: p.x, y: p.y })] }); } },
    D: { name: 'Thể Trọng Băng Hóa', cd: 8, desc: 'Tiêu toàn bộ Băng Cổ tạo khiên (tối đa 14) và Thiết Thân 1s.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'shield', 5, Math.min(14, 4 + f.ws.ice * 0.1)); f.ws.ice = 0; w.addStatus(f, 'armor', 1, 0.6); f.st.armor.unstop = 1; } },
    U: { name: 'Thức Tỉnh Băng Ma', desc: 'Hóa dã thú cổ đại 7s: không thể cản phá, nhận ít 30% điểm văng, nặng hơn 30%, đòn đánh văng mạnh hơn 25%.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { w.addStatus(f, 'icebeast', 7); w.addStatus(f, 'armor', 7, 0.7); f.st.armor.unstop = 1; w.addStatus(f, 'heavy', 7, 0.3); f.ws.ice = 100; w.act(f, 'U', { dur: 0.4, anim: 'roar' }); w.text(f.x, f.y - 60, 'BĂNG MA!', '#bfefff', 22); } },
  },
  onProjHit(w, f, p, t) {
    if (p.tag === 'a1') { f.ws.axe = { tid: t.id, until: now(w) + 2.5 }; t.ws.axeT = now(w) + 0.6; }
    if (p.tag === 'a2') { if (t.ws.axeT > now(w) && !(t.ws.axeCd > now(w))) { t.ws.axeCd = now(w) + 3; w.addStatus(t, 'stun', 0.8); } f.ws.axe = { tid: t.id, until: now(w) + 2.5 }; }
  },
  ev: { land(w, f, a, e) { f.z = 0; f.vz = 0; teleport(w, f, e.x, e.y); w.hitCircle(f, f.x, f.y, { r: 100, dmg: 7, kb: 160, kg: 5, knockup: 350, fxKind: 'quake', color: '#bfefff' }); w.ev('shake', { p: 10 }); } },
};

// =====================================================================
const faithK = (f) => 1 + 0.06 * Math.floor((f.ws.faith || 0) / 20);
const ariston = {
  name: 'Ariston', title: 'Hiệp Sĩ Thánh Quan', role: 'Đỡ Đòn', color: '#e8d5a6', weapon: 'greatsword', weight: 1.4, speed: 0.9, radius: 20,
  passive: { name: 'Đức Tin', desc: 'Bị đánh +4 Đức Tin (+10 nếu đòn nặng), trúng thế thủ +8. Mỗi 20 Đức Tin: +6% sát thương. Lời Nguyện tiêu 20 Đức Tin.' },
  init(f) { f.ws.faith = f.ws.faith || 0; },
  onTake(w, f, att, h, info) {
    gauge(f, 'faith', (h.dmg || 0) > 8 ? 10 : 4);
    if (f.st.pray) { delete f.st.pray; w.text(f.x, f.y - 50, 'BỊ NGẮT!', '#c0c0c0', 13); }
    if (f.st.holy && att && att !== f && !h.proj) { gauge(f, 'faith', 8); w.addStatus(att, 'slow', 1.5, 0.3); att.vx = Math.cos(angOf(f, att)) * 220; att.vy = Math.sin(angOf(f, att)) * 220; }
  },
  onDeal(w, f, t, h, info) { info.dmgK *= faithK(f); },
  update(w, f, dt) { if (f.st.pray) f.percent = Math.max(0, f.percent - 6 * dt); },
  skills: {
    A: { name: 'Thiết Trảm: Liệt Đao', cd: 0.8, desc: 'Quét vòng cung 160° làm chậm 35%. Trong 2s bấm lại: nhảy vọt tới điểm ngắm bổ xuống.', shape: { type: 'arc', range: 110, arc: 160 }, ai: { kind: 'atk', max: 110 },
      recast(f, w) { return f.ws.leapT > now(w); },
      recastUse(w, f, c) { f.ws.leapT = 0; f.vz = 380; f.z = 1; w.act(f, 'A', { dur: 0.38, anim: 'slam', ang: c.ang, ev: [dash(0, { dist: Math.min(220, Math.hypot(c.ax - f.x, c.ay - f.y) || 220), dur: 0.28 }), circle(0.3, { r: 90, dmg: 6, kb: 155, kg: 5.2, fxKind: 'quake', color: '#ffe8a0' })] }); },
      cast(w, f, c) { f.ws.leapT = now(w) + 2; w.act(f, 'A', { dur: 0.42, move: 0.25, anim: 'wide', ang: c.ang, ev: [arc(0.16, { range: 110, arc: 160, dmg: 6.4, kb: 98, kg: 4.3, slow: [0.35, 1.5] })] }); } },
    B: { name: 'Đại Kiếm Trọng Lực', cd: 4, desc: 'Kết liễu: gồng có báo trước 0.5s rồi bổ nặng — tầm ngắn, lực đẩy rất cao.', shape: { type: 'line', len: 125, w: 60 }, ai: { kind: 'fin', max: 120 },
      cast(w, f, c) { w.ev('fx', { kind: 'thrust', x: f.x, y: f.y, a: c.ang, r: 125, w: 60, color: '#ff5050', life: 0.5 }); w.act(f, 'B', { dur: 0.75, move: 0.1, anim: 'slam', ang: c.ang, armor: true, ev: [line(0.52, { len: 125, w: 60, dmg: 12, kb: 225, kg: 8.6 }), fx(0.52, 'crack', { r: 120 })] }); } },
    C: { name: 'Thế Thủ Thánh Quan', cd: 6, desc: 'Cắm kiếm thế thủ 1.75s: nhận ít 60% điểm văng, không bị đẩy/khống chế; kẻ cận chiến đánh vào bị dội lại và làm chậm. Mỗi đòn đỡ +8 Đức Tin.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'holy', 1.75); w.addStatus(f, 'armor', 1.75, 0.4); f.st.armor.unstop = 1; w.act(f, 'C', { dur: 1.75, move: 0, anim: 'block' }); } },
    D: { name: 'Lời Nguyện Bất Diệt', cd: 9, desc: 'Tốn 20 Đức Tin: quỳ cầu nguyện tối đa 2s, giảm 6% điểm văng mỗi giây. Bị đánh trúng thì ngắt.', shape: { type: 'self' }, ai: { kind: 'def' },
      can(f) { return f.ws.faith >= 20; },
      cast(w, f) { f.ws.faith -= 20; w.addStatus(f, 'pray', 2); w.act(f, 'D', { dur: 2, move: 0, anim: 'block', lock: true }); } },
    U: { name: 'Đại Phán Quyết', desc: 'Khóa đối thủ trong 330px, cảnh báo 0.5s rồi chém trảm quyết: đối thủ càng nhiều điểm văng càng văng xa.', shape: { type: 'circle', r: 330, self: true }, ai: { kind: 'ult', max: 320 },
      can(f, w) { const t = foeOf(w, f); return !!t && Math.hypot(t.x - f.x, t.y - f.y) < 330; },
      cast(w, f) { const t = foeOf(w, f); w.ev('fx', { kind: 'ring', x: t.x, y: t.y, r: 60, color: '#ff5050', life: 0.5 }); w.act(f, 'U', { dur: 0.8, anim: 'slam', armor: true, tg: t.id, ev: [custom(0.5, 'verdict')] }); } },
  },
  ev: {
    verdict(w, f, a) {
      const t = w.fighter(a.tg); if (!t || !w.alive(t)) return;
      const R = t.r + f.r + 10, o = outAng(w, t); teleport(w, f, t.x - Math.cos(o) * R, t.y - Math.sin(o) * R);
      w.applyHit(f, t, { src: f, angle: o, dmg: 10, kb: 210, kg: 9.5, unblock: true });
      w.ev('fx', { kind: 'bigslash', x: t.x, y: t.y, a: o, r: 120, color: '#ffe8a0', life: 0.4 }); w.ev('shake', { p: 14 });
    },
  },
};

// =====================================================================
const vector = {
  name: 'Dr. Vector', title: 'Nhà Khoa Học Laser', role: 'Xạ Thủ', color: '#69e3ff', weapon: 'laser', weight: 1.0, speed: 1.0, radius: 17,
  passive: { name: 'Tính Toán Tuyệt Đối', desc: 'Laser bắn tức thời, xuyên mọi mục tiêu thẳng hàng. Ổ 8 viên, cạn đạn nạp 1.8s.' },
  init(f) { f.ws.am = 8; f.ws.rl = 0; f.ws.ov = 0; },
  update(w, f, dt) { if (f.ws.am <= 0) { f.ws.rl += dt; if (f.ws.rl >= 1.8) { f.ws.rl = 0; f.ws.am = 8; } } },
  onDeal(w, f, t, h, info) { if (h.ov) info.dmgK *= 1.35; },
  skills: {
    A: { name: 'Laser Gun', cd: 0.35, desc: 'Tia laser tức thời xuyên thẳng hàng (tốn 1 viên).', shape: { type: 'line', len: 520, w: 10 }, ai: { kind: 'poke', max: 500 },
      can(f) { return f.ws.am > 0; },
      cast(w, f, c) { f.ws.am--; const ov = f.ws.ov > 0 ? (f.ws.ov--, 1) : 0; w.act(f, 'A', { dur: 0.16, move: 0.75, anim: 'shoot', ang: c.ang, ev: [line(0.02, { len: 520, w: 10, dmg: 2.6, kb: 55, kg: 2.1, ov })] }); w.ev('sfx', { name: 'gun' }); } },
    B: { name: 'Tia Khóa Tọa Độ', cd: 4, desc: 'Kết liễu: báo trước 0.35s rồi bắn tia thẳng xuyên cột, đẩy văng mạnh.', shape: { type: 'line', len: 700, w: 24 }, ai: { kind: 'fin', max: 650 },
      cast(w, f, c) { w.ev('fx', { kind: 'thrust', x: f.x, y: f.y, a: c.ang, r: 700, w: 6, color: '#ff4040', life: 0.35 }); w.act(f, 'B', { dur: 0.5, anim: 'shoot', ang: c.ang, ev: [line(0.35, { len: 700, w: 24, dmg: 9, kb: 185, kg: 7.4 })] }); } },
    C: { name: 'Bom Từ Tính', cd: 7, maxRange: 380, desc: 'Ném lựu đạn tới điểm ngắm, nổ CHOÁNG 1s và để lại vùng từ trường cấm lướt 3s.', shape: { type: 'point', range: 380, r: 90 }, ai: { kind: 'atk', max: 360 },
      cast(w, f, c) { const p = pt(f, c, 380); w.zone(f, { x: p.x, y: p.y, r: 90, delay: 0.55, dur: 3, tick: 0.3, kind: 'magnet', color: '#69e3ff', boom: { dmg: 5, kb: 100, kg: 2, stun: 1 }, hit: { dmg: 0, noKnock: true, nodash: 0.5 } }); w.act(f, 'C', { dur: 0.2, anim: 'cast', ang: c.ang }); } },
    D: { name: 'Tái Kích / Radar', cd: 6, desc: 'Thiếu đạn: nạp đầy ngay, 3 phát kế +35% sát thương. Đầy đạn: Radar — lộ đối thủ tàng hình, +30% tốc chạy 2s và khiên 4.', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f) {
        if (f.ws.am < 8) { f.ws.am = 8; f.ws.rl = 0; f.ws.ov = 3; w.text(f.x, f.y - 50, 'TÁI KÍCH!', '#69e3ff', 14); return; }
        const t = foeOf(w, f); if (t && t.st.invis) delete t.st.invis;
        w.addStatus(f, 'haste', 2, 0.3); w.addStatus(f, 'shield', 3, 4); w.ev('fx', { kind: 'ring', x: f.x, y: f.y, r: 350, color: '#69e3ff', life: 0.5 });
      } },
    U: { name: 'Pháo Laser Quét Hư Không', desc: 'Ghim chân tụ lực 0.65s rồi bắn chùm laser khổng lồ xuyên cột, lực đẩy cực lớn.', shape: { type: 'line', len: 1200, w: 60 }, ai: { kind: 'ult' },
      cast(w, f, c) { w.act(f, 'U', { dur: 0.9, anim: 'shoot', ang: c.ang, armor: true, ev: [fx(0, 'halo', { r: 50, color: '#69e3ff', life: 0.65 }), line(0.65, { len: 1200, w: 60, dmg: 15, kb: 260, kg: 9.5 }), custom(0.65, 'beamfx')] }); } },
  },
  ev: { beamfx(w, f, a) { w.ev('fx', { kind: 'thrust', x: f.x, y: f.y, a: a.ang, r: 1200, w: 60, color: '#69e3ff', life: 0.5 }); w.ev('shake', { p: 12 }); } },
};

// =====================================================================
function tide(w, f, t) { if (!t || t.kind) return; const s = t.st.tide; const n = s ? s.n + 1 : 1; t.st.tide = { t: 4, p: 0, n, max: 4 }; if (n >= 3 && !(t.ws.tideCd > now(w))) { t.ws.tideCd = now(w) + 6; delete t.st.tide; w.addStatus(t, 'root', 0.75); w.text(t.x, t.y - 56, '🌊 TRÓI!', '#68bde7', 15); } }
const lyra = {
  name: 'Lyra', title: 'Ca Sĩ Thủy Triều', role: 'Hộ Vệ', color: '#68bde7', weapon: 'orb', weight: 1.0, speed: 1.0, radius: 17,
  passive: { name: 'Thủy Triều', desc: 'Chiêu trúng đối thủ tích 1 tầng Thủy Triều (4s); đủ 3 tầng: TRÓI CHÂN 0.75s (mỗi đối thủ 1 lần / 6s).' },
  afterDeal(w, f, t, h) { if (h.tide) tide(w, f, t); },
  update(w, f) { if (f.st.bubble && !f.st.shield) { delete f.st.bubble; lyra.ev.burst(w, f); } },
  onStatusEnd(w, f, k) { if (k === 'bubble') lyra.ev.burst(w, f); },
  skills: {
    A: { name: 'Bong Bóng Nước', cd: 0.8, desc: 'Bắn bong bóng làm chậm 25%. Đối thủ đã bị làm chậm từ trước: CHOÁNG 0.6s (mỗi 3s).', shape: { type: 'proj', len: 440, w: 20 }, ai: { kind: 'poke', max: 420 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.25, move: 0.6, anim: 'cast', ang: c.ang, ev: [proj(0.05, { speed: 700, range: 440, r: 10, kind: 'bubble', color: '#9ae0ff', tag: 'bub', hit: { dmg: 4, kb: 70, kg: 2.6, tide: 1 } })] }); } },
    B: { name: 'Sóng Dâng', cd: 4, desc: 'Đẩy con sóng rộng xô đối thủ theo hướng sóng; Lyra nhận khiên 6.', shape: { type: 'proj', len: 380, w: 60 }, ai: { kind: 'fin', max: 360 },
      cast(w, f, c) { w.addStatus(f, 'shield', 3, 6); w.act(f, 'B', { dur: 0.3, anim: 'cast', ang: c.ang, ev: [proj(0.05, { speed: 650, range: 380, r: 30, kind: 'wave', color: '#68bde7', pierce: true, hit: { dmg: 5, kb: 205, kg: 5.4, tide: 1 } })] }); } },
    C: { name: 'Dòng Chảy', cd: 7, mob: true, desc: 'Lướt theo hướng ngắm, nhận khiên 8, giảm 6% điểm văng, +30% tốc chạy 2s.', shape: { type: 'dash', len: 160 }, ai: { kind: 'mob' },
      cast(w, f, c) { w.addStatus(f, 'shield', 3, 8); f.percent = Math.max(0, f.percent - 6); w.addStatus(f, 'haste', 2, 0.3); w.act(f, 'C', { dur: 0.2, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 160, dur: 0.18 })] }); } },
    D: { name: 'Giáp Bong Bóng', cd: 8, desc: 'Bọc khiên bong bóng 10 trong 4s; khi vỡ hoặc hết hạn nổ sóng đẩy lùi quanh thân.', shape: { type: 'circle', r: 110, self: true }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'shield', 4, 10); w.addStatus(f, 'bubble', 4); } },
    U: { name: 'Đại Hồng Thủy', maxRange: 650, desc: 'Niệm 0.75s, gọi cột nước vào điểm ngắm: hất tung cực mạnh, để lại xoáy nước hút về tâm 4s.', shape: { type: 'point', range: 650, r: 160 }, ai: { kind: 'ult', max: 600 },
      cast(w, f, c) { const p = pt(f, c, 650); w.zone(f, { x: p.x, y: p.y, r: 160, delay: 0.75, dur: 4, tick: 0.5, kind: 'water', color: '#68bde7', boom: { dmg: 12, kb: 240, kg: 7, knockup: 500, tide: 1 }, hit: { dmg: 0.6, noKnock: true } }); w.ent(f, { kind: 'vortex', x: p.x, y: p.y, r: 160, dur: 4.75, t0: 0.75 }); w.act(f, 'U', { dur: 0.5, anim: 'cast', ang: c.ang }); } },
  },
  onProjHit(w, f, p, t) {
    if (p.tag !== 'bub') return;
    if (t.st.slow && t.st.slow.t < t.st.slow.max - 0.05 && !(t.ws.bubCd > now(w))) { t.ws.bubCd = now(w) + 3; w.addStatus(t, 'stun', 0.6); }
    else w.addStatus(t, 'slow', 1, 0.25);
  },
  ents: { vortex: { update(w, e, dt) { if (e.t < e.t0) return; const o = w.fighter(e.owner); for (const t of w.targets(o)) { const d = Math.hypot(t.x - e.x, t.y - e.y); if (d < e.r && d > 12) { t.x += (e.x - t.x) / d * 60 * dt; t.y += (e.y - t.y) / d * 60 * dt; } } } } },
  ev: { burst(w, f) { w.hitCircle(f, f.x, f.y, { r: 110, dmg: 3, kb: 200, kg: 3, color: '#9ae0ff', fxKind: 'boom' }); } },
};

// =====================================================================
function hooked(w, f) { const h = f.ws.hook; return h && h.until > now(w) && w.alive(w.fighter(h.tid) || {}) ? w.fighter(h.tid) : null; }
const ratok = {
  name: 'Ratok', title: 'Đồ Tể Móc Xích', role: 'Đỡ Đòn', color: '#bc9e88', weapon: 'chain', weight: 1.3, speed: 0.95, radius: 20,
  passive: { name: 'Ràng Buộc Thép', desc: 'Kẻ dính Móc Sắt bị xích giữ 1.5s: không đi xa hơn được. Mỗi 12s đòn đánh kế tiếp được cường hóa đẩy mạnh hơn.' },
  init(f) { f.ws.hook = null; },
  update(w, f, dt) {
    const t = hooked(w, f);
    if (t) { const d = Math.hypot(t.x - f.x, t.y - f.y), L = f.ws.hook.len; if (d > L) { t.x = f.x + (t.x - f.x) / d * L; t.y = f.y + (t.y - f.y) / d * L; } }
  },
  skills: {
    A: { name: 'Móc Sắt Rỉ Sét', cd: 2.5, desc: 'Phóng móc xích: trúng thì móc chặt 1.5s. Bấm A lần nữa: giật mạnh kéo đối thủ bay về sát Ratok (choáng 0.4s).', shape: { type: 'proj', len: 420, w: 16 }, ai: { kind: 'poke', max: 400 },
      recast(f, w) { return !!hooked(w, f); },
      recastUse(w, f) { const t = hooked(w, f); f.ws.hook = null; const a = angOf(f, t), R = f.r + t.r + 6; t.x = f.x + Math.cos(a) * R; t.y = f.y + Math.sin(a) * R; t.vx = t.vy = 0; w.applyHit(f, t, { src: f, dmg: 4, noKnock: true, stun: 0.4 }); w.act(f, 'A', { dur: 0.2, anim: 'punch', ang: a }); },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.28, anim: 'shoot', ang: c.ang, ev: [proj(0.05, { speed: 1000, range: 420, r: 10, kind: 'hook', color: '#bc9e88', hit: { dmg: 4, noKnock: true } })] }); } },
    B: { name: 'Bộc Phá Húc', cd: 5, mob: true, desc: 'Kết liễu: lao húc văng kẻ đầu tiên, choáng 0.75s. Đang móc: co xích lao thẳng tới nạn nhân bất kể khoảng cách.', shape: { type: 'dash', len: 190 }, ai: { kind: 'fin', max: 190 },
      cast(w, f, c) {
        const t = hooked(w, f); let ang = c.ang, dist = 190;
        if (t) { ang = angOf(f, t); dist = Math.hypot(t.x - f.x, t.y - f.y) + 20; f.ws.hook = null; }
        w.act(f, 'B', { dur: 0.3, anim: 'dash', ang, ev: [dash(0, { dist, dur: Math.min(0.3, 0.12 + dist / 1600), stopOnHit: true, hit: { dmg: 7, kb: 175, kg: 6.6, stun: 0.6 } })] });
      } },
    C: { name: 'Tử Xích Toàn Phong', cd: 7, desc: 'Vung xích quay tròn: hút mọi kẻ trúng về sát Ratok và ngắt chiêu.', shape: { type: 'circle', r: 135, self: true }, ai: { kind: 'atk', max: 135 },
      cast(w, f) { w.act(f, 'C', { dur: 0.35, anim: 'spin', ev: [custom(0.12, 'pull')] }); } },
    D: { name: 'Thả Xích / Thiết Phá', cd: 5, desc: 'Thả móc; nhận Thiết Thân 1s và khiên 5.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { f.ws.hook = null; w.addStatus(f, 'armor', 1, 0.6); f.st.armor.unstop = 1; w.addStatus(f, 'shield', 3, 5); } },
    U: { name: 'Tàn Phá Thế Giới', maxRange: 550, desc: 'Cắm móc neo vào điểm ngắm (cảnh báo 0.75s) rồi kéo thân mình bay tới như đạn pháo, dộng sập mặt đất.', shape: { type: 'point', range: 550, r: 140 }, ai: { kind: 'ult', max: 520 },
      cast(w, f, c) { const p = pt(f, c, 550); w.ev('fx', { kind: 'ring', x: p.x, y: p.y, r: 140, color: '#ff5050', life: 0.75 }); w.act(f, 'U', { dur: 1.0, anim: 'spin', armor: true, ev: [custom(0.75, 'crash', { x: p.x, y: p.y })] }); } },
  },
  onProjHit(w, f, p, t) { if (p.kind === 'hook') f.ws.hook = { tid: t.id, until: now(w) + 1.5, len: Math.max(80, Math.hypot(t.x - f.x, t.y - f.y)) }; },
  ev: {
    pull(w, f) { for (const t of w.targets(f)) { const d = Math.hypot(t.x - f.x, t.y - f.y); if (d > 135 + t.r) continue; w.applyHit(f, t, { src: f, dmg: 5, noKnock: true, hitstun: 0.25 }); const a = angOf(t, f); t.vx = Math.cos(a) * Math.min(600, d * 4); t.vy = Math.sin(a) * Math.min(600, d * 4); } w.ev('fx', { kind: 'ring', x: f.x, y: f.y, r: 135, color: '#bc9e88', life: 0.3 }); },
    crash(w, f, a, e) { teleport(w, f, e.x, e.y); w.hitCircle(f, f.x, f.y, { r: 140, dmg: 12, kb: 250, kg: 8, fxKind: 'quake', color: '#bc9e88' }); w.ev('shake', { p: 18 }); w.ev('sfx', { name: 'boom', v: 1 }); },
  },
};

// =====================================================================
const kip = {
  name: 'Kip', title: 'Lữ Khách Hư Không', role: 'Đấu Sĩ', color: '#936fed', weapon: 'dagger', weight: 1.0, speed: 1.12, radius: 17,
  passive: { name: 'Điểm Hư Không', desc: 'Có tối đa 3 Điểm Hư Không (hồi 1 điểm mỗi 4s). Vết Nứt (C) và Vòm Xoáy (D) tốn 1 điểm. Sau mỗi lần dịch chuyển: +15% tốc chạy 2.5s.' },
  init(f) { f.ws.vp = 3; f.ws.vt = 0; },
  update(w, f, dt) { if (f.ws.vp < 3) { f.ws.vt += dt; if (f.ws.vt >= 4) { f.ws.vt = 0; f.ws.vp++; } } const d = w.owned(f, 'dome')[0]; if (d) { d.x = f.x; d.y = f.y; } },
  onDeal(w, f, t, h, info) { if (f.st.domain && h.vb) info.kbK *= 1.3; },
  skills: {
    A: { name: 'Phi Đao Tọa Độ', cd: 1.4, desc: 'Phi đao: trúng đối thủ thì cắm neo (bấm lại để xuất hiện sau gáy nó); bay hết tầm thì cắm neo xuống sàn (bấm lại để dịch chuyển tới).', shape: { type: 'proj', len: 560, w: 10 }, ai: { kind: 'poke', max: 540 },
      recast(f, w) { const a = f.ws.anc; return !!(a && a.until > now(w)); },
      recastUse(w, f) {
        const a = f.ws.anc; f.ws.anc = null;
        if (a.tid) { const t = w.fighter(a.tid); if (t && w.alive(t)) { const p = behindPos(t, t.r + f.r + 6); teleport(w, f, p.x, p.y); f.facing = angOf(f, t); } }
        else teleport(w, f, a.x, a.y);
        w.addStatus(f, 'haste', 2.5, 0.15);
      },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.22, move: 0.6, anim: 'shoot', ang: c.ang, ev: [proj(0.04, { speed: 1100, range: 560, r: 7, kind: 'knife', color: '#b09aff', hit: { dmg: 3.5, kb: 60, kg: 2.4 } })] }); } },
    B: { name: 'Xuyên Không Trảm', cd: 4, desc: 'Kết liễu: chém cắt không gian phía trước; trong Lãnh Địa lực đẩy +30%.', shape: { type: 'line', len: 130, w: 50 }, ai: { kind: 'fin', max: 130 },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.34, anim: 'wide', ang: c.ang, ev: [line(0.12, { len: 135, w: 54, dmg: 9, kb: 185, kg: 7.3, vb: 1 })] }); } },
    C: { name: 'Vết Nứt Hư Không', cd: 1.2, mob: true, desc: 'Tốn 1 điểm: dịch chuyển 220px theo hướng ngắm, để lại Vết Nứt 3s; bấm lại để giật về Vết Nứt.', shape: { type: 'dash', len: 220 }, ai: { kind: 'mob' },
      recast(f, w) { return w.owned(f, 'rift').length > 0; }, recastBusy: true,
      recastUse(w, f) { const r = w.owned(f, 'rift')[0]; r.dead = true; teleport(w, f, r.x, r.y); w.addStatus(f, 'haste', 2.5, 0.15); },
      can(f) { return f.ws.vp >= 1 || !!f.st.domain; },
      cast(w, f, c) { if (!f.st.domain) f.ws.vp--; else f.cd.C = 0.5; w.ent(f, { kind: 'rift', x: f.x, y: f.y, r: 14, dur: 3 }); teleport(w, f, f.x + Math.cos(c.ang) * 220, f.y + Math.sin(c.ang) * 220); w.addStatus(f, 'haste', 2.5, 0.15); } },
    D: { name: 'Vòm Xoáy Bẻ Cong Đạn Đạo', cd: 8, desc: 'Tốn 1 điểm: lỗ đen quanh thân 1.5s nuốt mọi đạn bay vào; kết thúc đẩy lùi kẻ xung quanh.', shape: { type: 'circle', r: 110, self: true }, ai: { kind: 'def' },
      can(f) { return f.ws.vp >= 1; },
      cast(w, f) { f.ws.vp--; w.ent(f, { kind: 'dome', x: f.x, y: f.y, r: 100, dur: 1.5, hittable: true, eatsProj: true }); } },
    U: { name: 'Lãnh Địa Đa Chiều', desc: 'Lãnh địa 7s: Vết Nứt không tốn điểm và hồi chỉ 0.5s, Xuyên Không Trảm đẩy mạnh hơn 30%.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { w.addStatus(f, 'domain', 7); f.ws.vp = 3; w.zone(f, { x: f.x, y: f.y, r: 300, dur: 7, kind: 'domain', color: '#936fed' }); w.text(f.x, f.y - 60, 'LÃNH ĐỊA!', '#b09aff', 20); } },
  },
  onProjHit(w, f, p, t) { if (p.kind === 'knife') f.ws.anc = { tid: t.id, until: now(w) + 5 }; },
  onProjEnd(w, f, p) { if (p.kind === 'knife') { const q = { x: p.x, y: p.y }; clampInside(w.A, q, 20); f.ws.anc = { x: q.x, y: q.y, until: now(w) + 5 }; w.ent(f, { kind: 'rift', x: q.x, y: q.y, r: 10, dur: 5, mark: 1 }); } },
  ents: {
    rift: {}, dome: {
      onHit() {},
      onEnd(w, e) { const o = w.fighter(e.owner); if (o) w.hitCircle(o, e.x, e.y, { r: 110, dmg: 3, kb: 160, kg: 2, color: '#936fed', fxKind: 'boom' }); },
    },
  },
};

// =====================================================================
const olivia = {
  name: 'Olivia', title: 'Thánh Nữ', role: 'Hộ Vệ', color: '#f5e4a4', weapon: 'staff', weight: 1.0, speed: 1.0, radius: 17,
  passive: { name: 'Đức Tin', desc: 'Đức Tin tự hồi 3/giây (tối đa 100). Thánh Hộ Thể tiêu 20 Đức Tin. Mỗi 15s nhận khiên 5.' },
  init(f) { f.ws.faith = 50; f.ws.st = 0; },
  update(w, f, dt) {
    gauge(f, 'faith', 3 * dt);
    f.ws.st -= dt; if (f.ws.st <= 0) { f.ws.st = 15; w.addStatus(f, 'shield', 6, 5); }
    if (f.st.pray) f.percent = Math.max(0, f.percent - 8 * dt);
  },
  onTake(w, f) { if (f.st.pray) { delete f.st.pray; w.text(f.x, f.y - 50, 'BỊ NGẮT!', '#c0c0c0', 13); } },
  skills: {
    A: { name: 'Dây Dẫn Thánh Linh', cd: 1.6, desc: 'Xích thánh theo hướng ngắm: TRÓI CHÂN 1.25s.', shape: { type: 'proj', len: 440, w: 14 }, ai: { kind: 'poke', max: 420 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.28, move: 0.5, anim: 'cast', ang: c.ang, ev: [proj(0.05, { speed: 900, range: 440, r: 9, kind: 'holy', color: '#fff0b0', hit: { dmg: 4.5, kb: 50, kg: 2, root: 1.25 } })] }); } },
    B: { name: 'Trận Pháp Cứu Rỗi', cd: 4, maxRange: 420, desc: 'Kết liễu: thánh trận báo trước 0.6s tại điểm ngắm, đẩy văng và làm chậm.', shape: { type: 'point', range: 420, r: 100 }, ai: { kind: 'fin', max: 400 },
      cast(w, f, c) { const p = pt(f, c, 420); w.zone(f, { x: p.x, y: p.y, r: 100, delay: 0.6, dur: 0.05, kind: 'holy', color: '#fff0b0', boom: { dmg: 7, kb: 175, kg: 6.4, slow: [0.4, 2] } }); w.act(f, 'B', { dur: 0.25, anim: 'cast', ang: c.ang }); } },
    C: { name: 'Thánh Hộ Thể', cd: 7, desc: 'Tốn 20 Đức Tin: khiên 12 và thanh tẩy mọi hiệu ứng xấu.', shape: { type: 'self' }, ai: { kind: 'def' },
      can(f) { return f.ws.faith >= 20; },
      cast(w, f) { f.ws.faith -= 20; w.addStatus(f, 'shield', 4, 12); cleanse(f); } },
    D: { name: 'Ý Chí Thần Quan', cd: 8, desc: 'Quỳ cầu nguyện 1.5s: giảm 8% điểm văng mỗi giây. Bị đánh trúng thì ngắt.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'pray', 1.5); w.act(f, 'D', { dur: 1.5, move: 0, anim: 'block' }); } },
    U: { name: 'Thánh Linh Ban Phước', desc: 'Giảm 15% điểm văng, nhận khiên 10; sóng ánh sáng đẩy văng kẻ địch gần.', shape: { type: 'circle', r: 170, self: true }, ai: { kind: 'ult' },
      cast(w, f) { f.percent = Math.max(0, f.percent - 15); w.addStatus(f, 'shield', 5, 10); w.hitCircle(f, f.x, f.y, { r: 170, dmg: 4, kb: 220, kg: 4, fxKind: 'boom', color: '#fff0b0' }); w.act(f, 'U', { dur: 0.4, anim: 'roar' }); } },
  },
};
olivia.onCancel = (w, f, a) => { if (a && a.key === 'D') delete f.st.pray; };
ariston.onCancel = (w, f, a) => { if (a && a.key === 'D') delete f.st.pray; };

// =====================================================================
const justus = {
  name: 'Justus', title: 'Pháp Sư Thánh Đình', role: 'Pháp Sư', color: '#ead7ff', weapon: 'book', weight: 1.0, speed: 1.0, radius: 17,
  passive: { name: 'Đức Tin Cứu Rỗi', desc: 'Đức Tin 0–100 tự hồi 4/giây. Tia Phán Quyết tốn 20, Thanh Tẩy tốn 25.' },
  init(f) { f.ws.faith = 100; },
  update(w, f, dt) {
    gauge(f, 'faith', 4 * dt);
    if (f.st.beam) {
      if (w.cc(f) || f.hitstun > 0) { delete f.st.beam; delete f.st.channel; return; }
      f.ws.bt -= dt; if (f.ws.bt <= 0) { f.ws.bt = 0.25; w.exec(f, { do: 'line', len: 480, w: 22, dmg: 1.7, kb: 55, kg: 1.6, ang: f.facing }, null); }
    }
  },
  skills: {
    A: { name: 'Tam Kiếm Trừng Phạt', cd: 1.6, desc: 'Ba thanh kiếm thánh cắm xuống 3 điểm theo hướng ngắm sau 0.3s. Vừa chạy vừa dùng.', shape: { type: 'line', len: 330, w: 90 }, ai: { kind: 'poke', max: 330 },
      cast(w, f, c) { for (let i = 0; i < 3; i++) { const d = 110 + i * 105; w.zone(f, { x: f.x + Math.cos(c.ang) * d, y: f.y + Math.sin(c.ang) * d, r: 52, delay: 0.3, dur: 0.05, kind: 'sword', color: '#ead7ff', boom: { dmg: 4, kb: 100, kg: 3.6 } }); } } },
    B: { name: 'Tia Phán Quyết Liên Tục', cd: 6, desc: 'Tốn 20 Đức Tin: chiếu tia thánh 1.5s theo hướng ngắm (vừa chiếu vừa đi chậm). Bị choáng là ngắt.', shape: { type: 'line', len: 480, w: 22 }, ai: { kind: 'fin', max: 460 },
      can(f) { return f.ws.faith >= 20; },
      cast(w, f) { f.ws.faith -= 20; w.addStatus(f, 'beam', 1.5); w.addStatus(f, 'channel', 1.5, 0.35); f.ws.bt = 0; } },
    C: { name: 'Thánh Quang Hộ Thể', cd: 7, desc: 'Khiên thánh 10, giảm 30% điểm văng và lực đẩy nhận vào trong 2s.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'shield', 3, 10); w.addStatus(f, 'armor', 2, 0.7); } },
    D: { name: 'Thanh Tẩy Kiên Định', cd: 10, breakCC: true, desc: 'Tốn 25 Đức Tin: xóa mọi khống chế (dùng được cả khi bị choáng) và +40% tốc chạy 1.5s.', shape: { type: 'self' }, ai: { kind: 'def' },
      can(f) { return f.ws.faith >= 25; },
      cast(w, f) { f.ws.faith -= 25; cleanse(f); w.addStatus(f, 'haste', 1.5, 0.4); w.text(f.x, f.y - 50, 'THANH TẨY!', '#ead7ff', 14); } },
    U: { name: 'Trận Địa Thanh Tẩy', desc: 'Vùng thánh 5s quanh mình: thiêu đối thủ bên trong, Justus đứng trong vùng giảm 2% điểm văng mỗi giây.', shape: { type: 'circle', r: 200, self: true }, ai: { kind: 'ult', max: 200 },
      cast(w, f) { w.zone(f, { x: f.x, y: f.y, r: 200, dur: 5, tick: 0.5, kind: 'holy', color: '#ead7ff', hit: { dmg: 1.5, burn: 2 } }); w.ent(f, { kind: 'sanct', x: f.x, y: f.y, r: 200, dur: 5 }); } },
  },
  ents: { sanct: { update(w, e, dt) { const o = w.fighter(e.owner); if (o && Math.hypot(o.x - e.x, o.y - e.y) < e.r) o.percent = Math.max(0, o.percent - 2 * dt); } } },
};

// =====================================================================
function swapPos(a, b) { const x = a.x, y = a.y; a.x = b.x; a.y = b.y; b.x = x; b.y = y; }
const mirage = {
  name: 'Mirage', title: 'Ảo Thuật Hoán Vị', role: 'Biến Ảo', color: '#c89af0', weapon: 'cards', weight: 1.0, speed: 1.05, radius: 17,
  passive: { name: 'Hoán Vị', desc: 'Ảo ảnh của Mirage bị đánh vỡ sẽ nổ vào kẻ phá. Phi Dao và Biến Ảnh cho phép đổi chỗ tức thì.' },
  skills: {
    A: { name: 'Tàn Ảnh Lướt Xuyên', cd: 1.4, mob: true, desc: 'Lướt xuyên 120px chém kẻ trên đường, để lại ảo ảnh tĩnh 3s ở điểm xuất phát.', shape: { type: 'dash', len: 120 }, ai: { kind: 'atk', max: 120 },
      cast(w, f, c) { w.ent(f, { kind: 'illu', x: f.x, y: f.y, r: 17, dur: 3, hittable: true, still: 1 }); w.act(f, 'A', { dur: 0.2, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 120, dur: 0.14, through: true, hit: { dmg: 5, kb: 110, kg: 4.4 } })] }); } },
    B: { name: 'Phi Dao Hoán Vị', cd: 5, desc: 'Phi dao cắm vào đối thủ 3s. Bấm lại: búng tay hoán đổi vị trí với nó và CHOÁNG 0.8s.', shape: { type: 'proj', len: 450, w: 10 }, ai: { kind: 'poke', max: 430 },
      recast(f, w) { const m = f.ws.swap; return !!(m && m.until > now(w) && w.alive(w.fighter(m.tid) || {})); },
      recastUse(w, f) { const t = w.fighter(f.ws.swap.tid); f.ws.swap = null; swapPos(f, t); w.addStatus(t, 'stun', 0.8); w.ev('fx', { kind: 'blink', x: f.x, y: f.y, r: 30, color: '#c89af0', life: 0.3 }); w.ev('fx', { kind: 'blink', x: t.x, y: t.y, r: 30, color: '#c89af0', life: 0.3 }); },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.22, move: 0.5, anim: 'shoot', ang: c.ang, ev: [proj(0.04, { speed: 950, range: 450, r: 7, kind: 'knife', color: '#c89af0', hit: { dmg: 4, kb: 60, kg: 2.4 } })] }); } },
    C: { name: 'Hộp Tử Thần', cd: 9, maxRange: 380, desc: 'Đặt Hộp Tử Thần tại điểm ngắm (cảnh báo 1.6s) rồi phát nổ cực mạnh, CHOÁNG 1s.', shape: { type: 'point', range: 380, r: 120 }, ai: { kind: 'atk', max: 360 },
      cast(w, f, c) { const p = pt(f, c, 380); w.zone(f, { x: p.x, y: p.y, r: 120, delay: 1.6, dur: 0.05, kind: 'box', color: '#c89af0', boom: { dmg: 12, kb: 245, kg: 8.4, stun: 1 } }); w.act(f, 'C', { dur: 0.2, anim: 'cast', ang: c.ang }); } },
    D: { name: 'Biến Ảnh / Phân Hình', cd: 8, desc: 'Chưa có ảo ảnh: tạo ảo ảnh tĩnh 8s tại chỗ. Đã có: đổi vị trí tức thì với ảo ảnh (ưu tiên phân thân khi có).', shape: { type: 'self' }, ai: { kind: 'mob' },
      cast(w, f) {
        const cl = w.owned(f, 'clone')[0], il = w.owned(f, 'illu').filter((e) => !e.mini).sort((a, b) => edgeDist(w.A, b.x, b.y) - edgeDist(w.A, a.x, a.y))[0], tg = cl || il;
        if (tg) { swapPos(f, tg); w.ev('fx', { kind: 'blink', x: f.x, y: f.y, r: 30, color: '#c89af0', life: 0.3 }); if (cl) f.cd.D = 1.5; return; }
        w.ent(f, { kind: 'illu', x: f.x, y: f.y, r: 17, dur: 8, hittable: true, still: 1 });
      } },
    U: { name: 'Phân Thân Hoàn Hảo', desc: 'Tạo phân thân 10s tự phi dao vào đối thủ; bấm D để đổi chỗ với phân thân (hồi 1.5s).', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f, c) { w.ent(f, { kind: 'clone', x: f.x + Math.cos(c.ang + 1.5) * 60, y: f.y + Math.sin(c.ang + 1.5) * 60, r: 17, dur: 10, hittable: true, hp: 3, cd: 1 }); f.cd.D = 0; w.text(f.x, f.y - 60, 'PHÂN THÂN!', '#c89af0', 18); } },
  },
  onProjHit(w, f, p, t) { if (p.kind === 'knife') f.ws.swap = { tid: t.id, until: now(w) + 3 }; },
  ents: {
    illu: { onHit(w, e, att) { const o = w.fighter(e.owner); w.killEnt(e, att); if (o) w.hitCircle(o, e.x, e.y, { r: 75, dmg: 4, kb: 130, kg: 3, fxKind: 'boom', color: '#c89af0' }); } },
    clone: { update(w, e, dt) {
      const o = w.fighter(e.owner), t = o && foeOf(w, o); if (!t) return;
      e.fa = angOf(e, t); const d = Math.hypot(t.x - e.x, t.y - e.y);
      if (d > 260) { e.x += Math.cos(e.fa) * 150 * dt; e.y += Math.sin(e.fa) * 150 * dt; clampInside(w.A, e, 15); }
      e.cd -= dt; if (e.cd <= 0 && d < 450) { e.cd = 1; w.proj(o, e.fa, { px: e.x, py: e.y, speed: 950, range: 450, r: 7, kind: 'knife', color: '#c89af0', hit: { dmg: 3, kb: 55, kg: 2.2 } }); }
    } },
  },
};

// =====================================================================
function dimgs(w, f) { return w.owned(f, 'dimg'); }
const dahlia = {
  name: 'Dahlia', title: 'Nữ Hoàng Sân Khấu', role: 'Biến Ảo', color: '#a65bd7', weapon: 'cane', weight: 1.0, speed: 1.05, radius: 17,
  passive: { name: 'Ảo Ảnh Chết Chóc', desc: 'Ảo ảnh của Dahlia tự bắn quấy nhiễu đối thủ (tối đa 3 trên sân). Trong Sân Khấu: Thoát Nguy thành Hư Ảnh Bước (lướt + nổ bóng tối).' },
  onTake(w, f, att, h, info) {
    if (!f.st.hat || !att || att === f) return;
    delete f.st.hat; info.cancel = true;
    w.addStatus(att, 'stun', 1); w.applyHit(f, att, { src: f, dmg: 8, kb: 120, kg: 4 });
    w.text(att.x, att.y - 60, '🎩 MŨ ĐEN!', '#d0a0ff', 18);
    teleport(w, f, f.x + Math.cos(f.facing) * 150, f.y + Math.sin(f.facing) * 150);
  },
  skills: {
    A: { name: 'Đôi Ảnh Quấy Nhiễu', cd: 3.5, desc: 'Tạo 2 ảo ảnh bước tỏa chữ V về phía trước, tự bắn đối thủ trên đường (tối đa 3 ảnh). +25% tốc chạy 2s.', shape: { type: 'cone', len: 300, arc: 50 }, ai: { kind: 'poke', max: 420 },
      cast(w, f, c) {
        const old = dimgs(w, f); for (let i = 0; i < old.length - 1; i++) old[i].dead = true;
        for (const s of [-1, 1]) w.ent(f, { kind: 'dimg', x: f.x, y: f.y, r: 16, dur: 6, hittable: true, cd: 0.6, dir: c.ang + s * 0.45, go: 300 });
        w.addStatus(f, 'haste', 2, 0.25); w.act(f, 'A', { dur: 0.2, anim: 'cast', ang: c.ang });
      } },
    B: { name: 'Mũ Đen Phản Kích', cd: 7, desc: 'Thế phản kích 1.2s: kẻ nào đánh vào bị Mũ Cao chụp xuống (CHOÁNG 1s, sát thương), Dahlia biến mất và thoát theo hướng nhìn.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'hat', 1.2); w.act(f, 'B', { dur: 0.5, move: 0.3, anim: 'block' }); } },
    C: { name: 'Thoát Nguy / Hư Ảnh Bước', cd: 4, mob: true, desc: 'Đổi chỗ với ảo ảnh gần nhất, tàng hình 1.5s. Trong Sân Khấu: lướt theo hướng ngắm và nổ bóng tối tại chỗ cũ.', shape: { type: 'dash', len: 160 }, ai: { kind: 'mob' },
      can(f, w) { return !!f.st.stage || dimgs(w, f).length > 0; },
      cast(w, f, c) {
        if (f.st.stage) { w.hitCircle(f, f.x, f.y, { r: 90, dmg: 5, kb: 150, kg: 4, fxKind: 'boom', color: '#6a2a9a' }); w.addStatus(f, 'invis', 1); w.act(f, 'C', { dur: 0.18, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 160, dur: 0.15, invuln: true })] }); return; }
        const e = dimgs(w, f).sort((a, b) => Math.hypot(a.x - f.x, a.y - f.y) - Math.hypot(b.x - f.x, b.y - f.y))[0];
        swapPos(f, e); w.addStatus(f, 'invis', 1.5);
      } },
    D: { name: 'Điều Lệnh Ảo Ảnh', cd: 5, desc: 'Gọi mọi ảo ảnh về quanh Dahlia; trong Sân Khấu tạo thêm 1 ảo ảnh.', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f) { const L = dimgs(w, f); L.forEach((e, i) => { const a = (i * TAU) / Math.max(1, L.length); e.x = f.x + Math.cos(a) * 60; e.y = f.y + Math.sin(a) * 60; e.go = 0; e.t = 0; }); if (f.st.stage && L.length < 3) w.ent(f, { kind: 'dimg', x: f.x, y: f.y, r: 16, dur: 6, hittable: true, cd: 0.6, go: 0 }); } },
    U: { name: 'Sân Khấu Chết Chóc', desc: 'Mở vũ đài bóng tối 9s quanh mình: +30% sát thương, thêm 2 ảo ảnh, Thoát Nguy thành Hư Ảnh Bước.', shape: { type: 'circle', r: 260, self: true }, ai: { kind: 'ult' },
      cast(w, f) { w.addStatus(f, 'stage', 9); w.addStatus(f, 'empower', 9, 0.3); w.zone(f, { x: f.x, y: f.y, r: 260, dur: 9, kind: 'stage', color: '#a65bd7' }); for (const s of [-1, 1]) w.ent(f, { kind: 'dimg', x: f.x + s * 60, y: f.y, r: 16, dur: 9, hittable: true, cd: 0.6, go: 0 }); w.text(f.x, f.y - 60, '🎭 SÂN KHẤU!', '#d0a0ff', 20); } },
  },
  ents: {
    dimg: {
      update(w, e, dt) {
        const o = w.fighter(e.owner), t = o && foeOf(w, o);
        if (e.go > 0) { const s = Math.min(e.go, 170 * dt); e.go -= s; e.x += Math.cos(e.dir) * s; e.y += Math.sin(e.dir) * s; clampInside(w.A, e, 15); }
        if (!t) return; e.fa = angOf(e, t);
        e.cd -= dt; if (e.cd <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 380) { e.cd = 0.9; w.proj(o, e.fa, { px: e.x, py: e.y, speed: 800, range: 380, r: 6, kind: 'darkorb', color: '#a65bd7', hit: { dmg: 2, kb: 45, kg: 1.6 } }); }
      },
      onHit(w, e, att) { w.killEnt(e, att); },
    },
  },
};

// =====================================================================
const luca = {
  name: 'Luca', title: 'Diễn Viên Cải Trang', role: 'Đấu Sĩ', color: '#e887ba', weapon: 'rapier', weight: 1.0, speed: 1.08, radius: 17,
  passive: { name: 'Cải Trang Tuyệt Đỉnh', desc: 'Lá bài Nộ trúng đối thủ cho phép SAO CHÉP bộ A/B/C của nó trong 12s; D lật qua lại giữa bộ gốc và bộ sao chép (hai bộ hồi chiêu chung).' },
  init(f) { if (!f.ws.copyT) { f.ws.copy = null; f.ws.copyOn = 0; } },
  update(w, f) { if (f.ws.copy && now(w) > f.ws.copyT) { f.ws.copy = null; f.ws.copyOn = 0; w.text(f.x, f.y - 50, 'Hết cải trang', '#e887ba', 13); } },
  onTake(w, f, att, h, info) {
    if (!f.st.spot || !att || att === f) return;
    delete f.st.spot; info.cancel = true;
    const p = behindPos(att, att.r + f.r + 6); teleport(w, f, p.x, p.y); f.facing = angOf(f, att);
    w.addStatus(att, 'silence', 1.25); w.applyHit(f, att, { src: f, dmg: 5, kb: 150, kg: 4 });
    w.text(f.x, f.y - 56, '🌹 TRÒ LỪA BỊP!', '#e887ba', 16);
  },
  skills: {
    A: { name: 'Bước Nhảy Ngàn Hoa', cd: 0.9, desc: 'Lướt ngắn và chém hoa trước mặt.', shape: { type: 'dash', len: 110 }, ai: { kind: 'atk', max: 120 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.25, anim: 'thrust', ang: c.ang, ev: [dash(0, { dist: 110, dur: 0.12, stopOnHit: true }), arc(0.13, { range: 75, arc: 120, dmg: 5.5, kb: 98, kg: 4.2 })] }); } },
    B: { name: 'Ánh Đèn Rọi Vào Tôi Nè!', cd: 6, desc: 'Tạo dáng 1.5s: đòn đầu tiên của đối thủ bị triệt tiêu, Luca hóa hoa ra sau lưng kẻ tấn công, CÂM LẶNG 1.25s và phản đòn.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'spot', 1.5); w.act(f, 'B', { dur: 0.4, move: 0.3, anim: 'block' }); } },
    C: { name: 'Hoán Vị Ảnh Hồng', cd: 6, mob: true, desc: 'Để lại Đóa Hồng (6s) rồi lao 220px: kẻ đầu tiên va phải bị CHOÁNG 0.75s. Bấm lại để dịch chuyển về đóa hồng.', shape: { type: 'dash', len: 220 }, ai: { kind: 'fin', max: 220 },
      recast(f, w) { return w.owned(f, 'rose').length > 0 && !(f.act && f.act.key === 'C'); }, recastBusy: true,
      recastUse(w, f) { const r = w.owned(f, 'rose')[0]; r.dead = true; teleport(w, f, r.x, r.y); },
      cast(w, f, c) { w.ent(f, { kind: 'rose', x: f.x, y: f.y, r: 12, dur: 6 }); w.act(f, 'C', { dur: 0.3, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 220, dur: 0.2, stopOnHit: true, hit: { dmg: 6, kb: 165, kg: 6.4, stun: 0.75 } })] }); } },
    D: { name: 'Hoán Đổi Bộ Chiêu', cd: 1, desc: 'Khi đang cải trang: lật giữa bộ chiêu của Luca và bộ chiêu sao chép.', shape: { type: 'self' }, ai: { kind: 'buff' },
      can(f) { return !!f.ws.copy; },
      cast(w, f) { f.ws.copyOn = f.ws.copyOn ? 0 : 1; w.text(f.x, f.y - 50, f.ws.copyOn ? '🎭 ' + (HEROES_REF.h[f.ws.copy] || {}).name : '🌹 Luca', '#e887ba', 14); } },
    U: { name: 'Cải Trang Tuyệt Đỉnh', desc: 'Phóng lá bài: trúng đối thủ thì sao chép bộ A/B/C của nó 12s và chuyển ngay sang bộ sao chép.', shape: { type: 'proj', len: 600, w: 14 }, ai: { kind: 'ult', max: 560 },
      cast(w, f, c) { w.act(f, 'U', { dur: 0.3, anim: 'shoot', ang: c.ang, h: 'luca', ev: [proj(0.05, { speed: 1000, range: 600, r: 10, kind: 'card', color: '#e887ba', tag: 'copy', hit: { dmg: 4, kb: 60, kg: 2 } })] }); } },
  },
  onProjHit(w, f, p, t) {
    if (p.tag !== 'copy' || t.hero === 'luca') return;
    f.ws.copy = t.hero; f.ws.copyOn = 1; f.ws.copyT = now(w) + 12;
    const H = HEROES_REF.h[t.hero]; if (H && H.init) { const keep = { copy: f.ws.copy, copyOn: 1, copyT: f.ws.copyT }; H.init(f, w); Object.assign(f.ws, keep); }
    w.text(f.x, f.y - 60, '🎭 CẢI TRANG: ' + (H ? H.name : ''), '#e887ba', 16);
  },
  ents: { rose: {} },
};
export const HEROES_REF = { h: null };

// =====================================================================
const caelus = {
  name: 'Dr. Caelus', title: 'Nhà Khoa Học Thời Không', role: 'Pháp Sư', color: '#80d4f1', weapon: 'orb', weight: 1.0, speed: 1.0, radius: 17,
  passive: { name: 'Lưu Trữ Thời Gian', desc: 'Ghi lại vị trí và điểm văng của cả hai bên trong 3.5s gần nhất (chỉ trong cùng một mạng) để dùng cho Nghịch Đảo.' },
  init(f) { f.ws.hist = {}; f.ws.ht = 0; f.ws.lock = 0; },
  update(w, f, dt) {
    f.ws.ht -= dt; if (f.ws.ht > 0) return; f.ws.ht = 0.25;
    for (const g of w.s.fighters) {
      const h = f.ws.hist[g.id] || (f.ws.hist[g.id] = []);
      h.push([Math.round(g.x), Math.round(g.y), Math.round(g.percent * 10) / 10, g.stocks]); if (h.length > 15) h.shift();
    }
  },
  onDeal(w, f, t, h, info) { if (h.ray && t.st.root) info.extra = () => w.hitCircle(f, t.x, t.y, { r: 90, dmg: 4, kb: 140, kg: 4, fxKind: 'boom', color: '#80d4f1' }); },
  skills: {
    A: { name: 'Ma Trận Khóa Tọa Độ', cd: 4, maxRange: 450, desc: 'Cắm quả cầu lượng tử: lưới điện cảnh báo 0.6s rồi TRÓI 1.2s và cấm lướt 2s mọi kẻ bên trong.', shape: { type: 'point', range: 450, r: 105 }, ai: { kind: 'poke', max: 430 },
      cast(w, f, c) { const p = pt(f, c, 450); w.zone(f, { x: p.x, y: p.y, r: 105, delay: 0.6, dur: 0.05, kind: 'matrix', color: '#80d4f1', boom: { dmg: 4, kb: 40, kg: 1, root: 1.2, nodash: 2 } }); w.act(f, 'A', { dur: 0.2, move: 0.5, anim: 'cast', ang: c.ang }); } },
    B: { name: 'Tia Laser Phân Rã', cd: 5, hold: 1, chargeMove: 0.3, desc: 'Kết liễu: giữ tích năng lượng (tối đa 1s) rồi bắn tia laser xuyên cột. Trúng đối thủ đang bị trói: nổ diện rộng.', shape: { type: 'line', len: 700, w: 26 }, ai: { kind: 'fin', max: 650 },
      cast(w, f, c) { const p = c.p; w.ev('fx', { kind: 'thrust', x: f.x, y: f.y, a: c.ang, r: 700, w: 20 + 12 * p, color: '#80d4f1', life: 0.3 }); w.act(f, 'B', { dur: 0.25, anim: 'shoot', ang: c.ang, ev: [line(0.02, { len: 700, w: 20 + 12 * p, dmg: 6 + 6 * p, kb: 140 + 90 * p, kg: 5 + 3 * p, ray: 1 })] }); } },
    C: { name: 'Phản Xạ Lượng Tử', cd: 7, desc: 'Khiên năng lượng 1.5s phản lại mọi đạn bay tới. Bấm lại khi khiên còn: xả sóng đẩy lùi quanh người.', shape: { type: 'circle', r: 110, self: true }, ai: { kind: 'def' },
      recast(f) { return !!f.st.reflect; }, recastBusy: true,
      recastUse(w, f) { delete f.st.reflect; w.hitCircle(f, f.x, f.y, { r: 110, dmg: 4, kb: 200, kg: 3, fxKind: 'boom', color: '#80d4f1' }); },
      cast(w, f) { w.addStatus(f, 'reflect', 1.5); } },
    D: { name: 'Chốt Mục Tiêu Nghịch Đảo', cd: 1, desc: 'Ngắm trúng đối thủ (trong 650px) để chọn làm mục tiêu Nghịch Đảo; không có thì chọn chính mình.', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f) { const t = foeOf(w, f); f.ws.lock = t && Math.hypot(t.x - f.x, t.y - f.y) < 650 ? t.id : f.id; w.text(f.x, f.y - 50, f.ws.lock === f.id ? '⟲ Chốt: bản thân' : '⟲ Chốt: đối thủ', '#80d4f1', 13); } },
    U: { name: 'Nghịch Đảo Dữ Liệu Thời Không', desc: 'Sau 0.5s, mục tiêu đã chốt (mặc định: đối thủ) bị tua về đúng vị trí và điểm văng của 3.5s trước — chỉ trong cùng một mạng.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { const id = f.ws.lock || (foeOf(w, f) || f).id; w.act(f, 'U', { dur: 0.55, anim: 'cast', tg: id, ev: [custom(0.5, 'rewind')] }); } },
  },
  ev: {
    rewind(w, f, a) {
      const t = w.fighter(a.tg); if (!t || !w.alive(t)) return;
      const h = f.ws.hist[t.id] || []; const old = h[0];
      if (!old || old[3] !== t.stocks) { w.text(t.x, t.y - 56, 'Không tua được!', '#c0c0c0', 14); return; }
      w.ev('fx', { kind: 'blink', x: t.x, y: t.y, r: 40, color: '#80d4f1', life: 0.4 });
      t.x = old[0]; t.y = old[1]; t.vx = t.vy = 0; t.percent = old[2];
      w.ev('fx', { kind: 'halo', x: t.x, y: t.y, r: 50, color: '#80d4f1', life: 0.5 });
      w.text(t.x, t.y - 60, '⟲ NGHỊCH ĐẢO!', '#80d4f1', 18);
    },
  },
};

// =====================================================================
const STANCE = ['luc', 'phong', 'thang'], SNAME = { luc: 'Lục Tinh', phong: 'Phong Ấn', thang: 'Thăng Hoa' };
const bachdiep = {
  name: 'Bạch Diệp', title: 'Kiếm Tiên Phi Kiếm', role: 'Pháp Sư', color: '#c9edff', weapon: 'swords', weight: 1.0, speed: 1.02, radius: 17,
  passive: { name: 'Vạn Kiếm Triệu', desc: 'Mỗi phi kiếm trúng +1 Kiếm Khí (tối đa 30), mỗi Kiếm Khí +1% sát thương. Kiếm Vũ bấm liên tiếp trong 2s bắn thêm kiếm (1 → 3 → 5 → 7).' },
  init(f) { f.ws.sw = f.ws.sw || 0; f.ws.chain = 0; f.ws.ct = -9; f.ws.stance = f.ws.stance || 'luc'; },
  afterDeal(w, f, t, h) { if (h.proj === 'fsword') gauge(f, 'sw', 1, 30); },
  onDeal(w, f, t, h, info) { info.dmgK *= 1 + 0.01 * f.ws.sw; },
  skills: {
    A: { name: 'Kiếm Vũ: Loạn Trảm', cd: 0.45, desc: 'Phóng chuỗi phi kiếm: bấm liên tiếp trong 2s số kiếm tăng (tối đa 7 một loạt).', shape: { type: 'proj', len: 460, w: 30 }, ai: { kind: 'poke', max: 440 },
      cast(w, f, c) {
        f.ws.chain = now(w) - f.ws.ct < 2 ? Math.min(3, f.ws.chain + 1) : 0; f.ws.ct = now(w);
        const n = 1 + 2 * f.ws.chain, ev = [];
        for (let i = 0; i < n; i++) ev.push(proj(0.02 + i * 0.03, { rot: (i - (n - 1) / 2) * 0.07, speed: 950, range: 460, r: 6, kind: 'fsword', color: '#e0f6ff', hit: { dmg: 1.7, kb: 36, kg: 1.4 } }));
        w.act(f, 'A', { dur: 0.2 + n * 0.02, move: 0.6, anim: 'cast', ang: c.ang, ev });
      } },
    B: { name: 'Kiếm Trận Vạn Cổ', cd: 6, maxRange: 400, desc: 'Kết liễu: trận phi kiếm tại điểm ngắm 4s, kiếm cổ rơi liên tục gây sát thương và làm chậm; nhát cuối nổ lớn.', shape: { type: 'point', range: 400, r: 110 }, ai: { kind: 'fin', max: 380 },
      cast(w, f, c) { const p = pt(f, c, 400); w.zone(f, { x: p.x, y: p.y, r: 110, delay: 0.3, dur: 3.5, tick: 0.35, kind: 'swords', color: '#c9edff', hit: { dmg: 1.3, slow: [0.25, 0.5] } }); w.zone(f, { x: p.x, y: p.y, r: 110, delay: 3.8, dur: 0.05, kind: 'swords', color: '#c9edff', boom: { dmg: 6, kb: 180, kg: 6 } }); w.act(f, 'B', { dur: 0.25, anim: 'cast', ang: c.ang }); } },
    C: { name: 'Kiếm Hộ Pháp', cd: 7, mob: true, desc: 'Lướt lùi né mọi đòn bay tới, nhận khiên theo số Kiếm Khí (4 + 0.4/kiếm, tối đa 16).', shape: { type: 'dash', len: 170, back: true }, ai: { kind: 'mob' },
      cast(w, f, c) { w.addStatus(f, 'shield', 3, Math.min(16, 4 + 0.4 * f.ws.sw)); w.act(f, 'C', { dur: 0.2, anim: 'dash', ang: c.ang, ev: [dash(0, { rot: Math.PI, dist: 170, dur: 0.18, invuln: true })] }); } },
    D: { name: 'Chọn Thế Kiếm', cd: 1, desc: 'Luân phiên thế của Thiên Kiếm Trận (Nộ): Lục Tinh (nổ lớn) → Phong Ấn (giam trong vòng) → Thăng Hoa (cường hóa bản thân).', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f) { f.ws.stance = STANCE[(STANCE.indexOf(f.ws.stance) + 1) % 3]; w.text(f.x, f.y - 50, '⚔ ' + SNAME[f.ws.stance], '#e0f6ff', 14); } },
    U: { name: 'Thiên Kiếm Trận', desc: 'Lục Tinh: trận kiếm nổ lớn tại đối thủ sau 0.8s, choáng • Phong Ấn: giam đối thủ trong vòng kiếm 4s • Thăng Hoa: 8s +40% sát thương, +10 Kiếm Khí, Kiếm Vũ nhanh hơn.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) {
        const t = foeOf(w, f), s = f.ws.stance;
        if (s === 'luc' && t) w.zone(f, { x: t.x, y: t.y, r: 180, delay: 0.8, dur: 0.05, kind: 'swords', color: '#e0f6ff', boom: { dmg: 12, kb: 235, kg: 8, stun: 1 } });
        else if (s === 'phong' && t) w.zone(f, { x: t.x, y: t.y, r: 160, dur: 4, kind: 'cage', color: '#c9edff', inside: [t.id] });
        else { w.addStatus(f, 'empower', 8, 0.4); gauge(f, 'sw', 10, 30); f.cd.A = 0; }
        w.text(f.x, f.y - 60, '⚔ ' + SNAME[s] + '!', '#e0f6ff', 18); w.act(f, 'U', { dur: 0.35, anim: 'cast' });
      } },
  },
};

// =====================================================================
const TS = ['phap', 'kiem', 'phong'], TSN = { phap: '🔮 Pháp', kiem: '⚔ Kiếm', phong: '🌀 Phong' };
const tsukiyo = {
  name: 'Tsukiyo', title: 'Nhẫn Giả Tam Thuật', role: 'Sát Thủ', color: '#ad9ae2', weapon: 'twin', weight: 1.0, speed: 1.12, radius: 17,
  passive: { name: 'Tam Đại Nhẫn Thuật', desc: 'Ba hệ nhẫn thuật (D đổi hệ, giữ nguyên hồi chiêu): 🔮 Pháp — cầu lửa, bẫy trói, thế thân • ⚔ Kiếm — phi tiêu, tam trọng trảm, khói ẩn • 🌀 Phong — thuấn trảm, song nhận hất văng, phản đòn.' },
  init(f) { f.ws.sty = f.ws.sty || 'phap'; },
  onTake(w, f, att, h, info) {
    if (!f.st.subst || !att || att === f) return;
    delete f.st.subst; info.cancel = true;
    w.zone(f, { x: f.x, y: f.y, r: 90, dur: 2, tick: 0.5, kind: 'smoke', color: '#7a6a5a', hit: { dmg: 0.5, noKnock: true, blind: 1.5 } });
    const a = angOf(att, f); teleport(w, f, f.x + Math.cos(a) * 200, f.y + Math.sin(a) * 200);
    w.text(f.x, f.y - 50, '🪵 THẾ THÂN!', '#d0c0ff', 15);
  },
  skills: {
    A: { name: 'Nhẫn Thuật Nhất', cd: 1, desc: '🔮 Hỏa Cầu nổ lan, thiêu đốt • ⚔ Loạt 3 phi tiêu tỏa • 🌀 Thuấn Trảm: lướt chém.', shape: { type: 'proj', len: 420, w: 20 }, ai: { kind: 'poke', max: 400 },
      cast(w, f, c) {
        const s = f.ws.sty;
        if (s === 'phap') w.act(f, 'A', { dur: 0.3, move: 0.6, anim: 'cast', ang: c.ang, ev: [proj(0.06, { speed: 650, range: 420, r: 10, kind: 'fireball', color: '#ff8a5a', endBoom: true, explode: { r: 70, dmg: 6, kb: 100, kg: 3.8, burn: 3 } })] });
        else if (s === 'kiem') w.act(f, 'A', { dur: 0.22, move: 0.7, anim: 'shoot', ang: c.ang, ev: [-0.12, 0, 0.12].map((r) => proj(0.03, { rot: r, speed: 1000, range: 400, r: 6, kind: 'shuriken', color: '#e0e0f0', hit: { dmg: 2.4, kb: 50, kg: 2 } })) });
        else w.act(f, 'A', { dur: 0.22, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 130, dur: 0.12, through: true, hit: { dmg: 5.5, kb: 110, kg: 4.4 } })] });
      } },
    B: { name: 'Nhẫn Thuật Nhị', cd: 5, desc: '🔮 Bẫy Trói: lướt lùi, đặt bẫy ở chỗ cũ (trói 1.5s) • ⚔ Tam Trọng Trảm: 3 nhát, nhát cuối văng mạnh • 🌀 Song Nhận: hất văng cực mạnh.', shape: { type: 'line', len: 150, w: 40 }, ai: { kind: 'fin', max: 150 },
      cast(w, f, c) {
        const s = f.ws.sty;
        if (s === 'phap') { w.ent(f, { kind: 'trap', x: f.x, y: f.y, r: 34, dur: 8 }); w.act(f, 'B', { dur: 0.2, anim: 'dash', ang: c.ang, ev: [dash(0, { rot: Math.PI, dist: 160, dur: 0.16 })] }); }
        else if (s === 'kiem') w.act(f, 'B', { dur: 0.5, move: 0.4, anim: 'wide', ang: c.ang, ev: [arc(0.06, { range: 85, arc: 120, dmg: 3, kb: 40, kg: 1.5, slow: [0.4, 1] }), arc(0.2, { range: 85, arc: 120, dmg: 3, kb: 40, kg: 1.5 }), arc(0.36, { range: 90, arc: 120, dmg: 5.5, kb: 175, kg: 6.8 })] });
        else w.act(f, 'B', { dur: 0.4, anim: 'thrust', ang: c.ang, ev: [line(0.15, { len: 150, w: 40, dmg: 8, kb: 195, kg: 7.4 })] });
      } },
    C: { name: 'Nhẫn Thuật Tam', cd: 7, desc: '🔮 Thế Thân 2.5s: bị đánh thì dịch chuyển ra xa, để lại khói làm mù • ⚔ Khói Ẩn: tàng hình 2s, +30% tốc chạy • 🌀 Phản Đòn: phản đạn 1.5s.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) {
        const s = f.ws.sty;
        if (s === 'phap') w.addStatus(f, 'subst', 2.5);
        else if (s === 'kiem') { w.zone(f, { x: f.x, y: f.y, r: 90, dur: 2, tick: 0.5, kind: 'smoke', color: '#7a6a8a', hit: { dmg: 0, noKnock: true, blind: 1 } }); w.addStatus(f, 'invis', 2); w.addStatus(f, 'haste', 2, 0.3); }
        else { w.addStatus(f, 'reflect', 1.5); w.addStatus(f, 'parry', 0.6); }
      } },
    D: { name: 'Chuyển Nhẫn Thuật', cd: 1.5, desc: 'Đổi hệ Pháp → Kiếm → Phong, giữ nguyên hồi chiêu A/B/C.', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f) { f.ws.sty = TS[(TS.indexOf(f.ws.sty) + 1) % 3]; w.text(f.x, f.y - 50, TSN[f.ws.sty], '#d0c0ff', 15); } },
    U: { name: 'Nhẫn Thuật Tối Thượng', desc: '🔮 Hắc Nguyệt: quả cầu bóng tối nổ tại đối thủ sau 1.2s (choáng, mù) • ⚔ Huyền Ảnh: 6s +40% sát thương, +30% tốc chạy • 🌀 Hai phân thân ném phi tiêu 6s.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) {
        const s = f.ws.sty, t = foeOf(w, f);
        if (s === 'phap' && t) w.zone(f, { x: t.x, y: t.y, r: 160, delay: 1.2, dur: 0.05, kind: 'moon', color: '#5a3a8a', boom: { dmg: 13, kb: 240, kg: 8, stun: 1.2, blind: 2 } });
        else if (s === 'kiem') { w.addStatus(f, 'empower', 6, 0.4); w.addStatus(f, 'haste', 6, 0.3); }
        else for (const k of [-1, 1]) w.ent(f, { kind: 'nclone', x: f.x + k * 50, y: f.y, r: 16, dur: 6, hittable: true, cd: 0.5 + (k > 0 ? 0.5 : 0), side: k });
        w.text(f.x, f.y - 60, 'NHẪN THUẬT TỐI THƯỢNG!', '#d0c0ff', 16);
      } },
  },
  onStatusEnd(w, f, k) {},
  ents: {
    trap: { update(w, e) { const o = w.fighter(e.owner); for (const t of w.targets(o)) if (Math.hypot(t.x - e.x, t.y - e.y) < e.r + t.r) { e.dead = true; w.applyHit(o, t, { src: e, dmg: 4, noKnock: true, root: 1.5 }); w.text(t.x, t.y - 50, 'DÍNH BẪY!', '#d0c0ff', 14); break; } } },
    nclone: { update(w, e, dt) {
      const o = w.fighter(e.owner), t = o && foeOf(w, o); if (!o) return;
      const a = o.facing + Math.PI / 2 * e.side; e.x = o.x + Math.cos(a) * 55; e.y = o.y + Math.sin(a) * 55; clampInside(w.A, e, 12);
      if (!t) return; e.fa = angOf(e, t); e.cd -= dt;
      if (e.cd <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 420) { e.cd = 1; w.proj(o, e.fa, { px: e.x, py: e.y, speed: 1000, range: 420, r: 6, kind: 'shuriken', color: '#e0e0f0', hit: { dmg: 2.4, kb: 55, kg: 2 } }); }
    } },
  },
};
// Phong: phản đòn cận chiến trong 0.6s đầu
tsukiyo.onTake = ((orig) => (w, f, att, h, info) => {
  if (f.st.parry && att && att !== f && !h.proj) { delete f.st.parry; info.cancel = true; w.applyHit(f, att, { src: f, dmg: 5, kb: 160, kg: 4, stun: 0.6 }); w.text(f.x, f.y - 50, 'PHẢN!', '#d0c0ff', 15); return; }
  orig(w, f, att, h, info);
})(tsukiyo.onTake);

export const BATCH2 = { boran, ariston, vector, lyra, ratok, kip, olivia, justus, mirage, dahlia, luca, caelus, bachdiep, tsukiyo };
