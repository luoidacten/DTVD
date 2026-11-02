// ===== Đợt 1b: Alice, Wukong, Kazuki, Chrono & Neo, Victoria, Clint, Jack, Joker, Raven, Thanh Phong, Galo =====
import { TAU, clamp, angDiff, deg } from './math.js';
import { edgeDist, clampInside } from './arena.js';
import { arc, line, circle, proj, dash, custom, fx, teleport, behindPos, angOf, outAng, foeOf, gauge, now } from './kit.js';

// =====================================================================
const alice = {
  name: 'Alice', title: 'Ảo Thuật Gia', role: 'Biến Ảo', color: '#d070ff', weapon: 'dagger', weight: 0.92, speed: 1.1, radius: 17,
  passive: { name: 'Màn Ảo Thuật Náo Nhiệt', desc: 'Náo Nhiệt 0–100: +5 mỗi đòn trúng, +1 mỗi 1% điểm văng nhận, +25 khi đối thủ đánh trúng ảo ảnh (ảo ảnh nổ vào kẻ phá, Alice +30% tốc chạy). A/B tốn 20 để cường hóa; C đủ 50 đổi biến thể. Một lần mỗi trận: lẽ ra rơi đài thì dịch chuyển về giữa sân, bất tử + tàng hình 2s.' },
  init(f) { f.ws.hype = f.ws.hype || 0; },
  afterDeal(w, f) { gauge(f, 'hype', 5); },
  onTake(w, f, att, h) { gauge(f, 'hype', (h.dmg || 0) * 0.8); },
  onFall(w, f) {
    if (f.ws.saved) return true;
    f.ws.saved = 1; f.vx = f.vy = 0; teleport(w, f, 0, 0); f.invuln = 2; w.addStatus(f, 'invis', 2); f.percent += 20;
    w.text(f.x, f.y - 60, '🎩 THOÁT HIỂM ẢO ẢNH!', '#e0a0ff', 18);
    return false;
  },
  onStatusEnd(w, f, k) { if (k === 'invis') delete f.st.haste; },
  update(w, f) { if (f.cd.C > 50 && !w.owned(f, 'illu').length) f.cd.C = 8 * 0.85; },
  skills: {
    A: { name: 'Phi Dao Ảo Thuật', cd: 0.5, desc: 'Phi 1 dao tầm trung. Có 20 Náo Nhiệt: phóng 8 phi dao tỏa tròn 360° đẩy lùi.', shape: { type: 'proj', len: 400, w: 10 }, ai: { kind: 'poke', max: 380 },
      cast(w, f, c) {
        f.cd.B = Math.max(f.cd.B, 0.4);
        if (f.ws.hype >= 20) { f.ws.hype -= 20; const ev = []; for (let i = 0; i < 8; i++) ev.push(proj(0.03, { ang: c.ang + (i * TAU) / 8, speed: 800, range: 260, r: 7, kind: 'knife', color: '#e0a0ff', hit: { dmg: 3, kb: 120, kg: 3 } })); w.act(f, 'A', { dur: 0.25, anim: 'spin', ang: c.ang, ev }); return; }
        w.act(f, 'A', { dur: 0.2, move: 0.6, anim: 'shoot', ang: c.ang, ev: [proj(0.04, { speed: 900, range: 400, r: 7, kind: 'knife', color: '#e0a0ff', hit: { dmg: 3.6, kb: 62, kg: 2.6 } })] });
      } },
    B: { name: 'Lướt Đâm Chớp Nhoáng', cd: 0.5, mob: true, desc: 'Kết liễu: lướt 140px đâm mạnh. Có 20 Náo Nhiệt: sau cú đâm tàng hình, dịch chuyển ngẫu nhiên và để lại ảo ảnh.', shape: { type: 'dash', len: 140 }, ai: { kind: 'fin', max: 140 },
      cast(w, f, c) {
        f.cd.A = Math.max(f.cd.A, 0.4); f.cd.B = 1.2;
        const emp = f.ws.hype >= 20; if (emp) f.ws.hype -= 20;
        w.act(f, 'B', { dur: 0.24, anim: 'thrust', ang: c.ang, ev: [dash(0, { dist: 140, dur: 0.14, stopOnHit: true, onEnd: emp ? 'vanish' : null, hit: { dmg: 7, kb: 160, kg: 6.4 } })] });
      } },
    C: { name: 'Ảo Ảnh Độc Lập', cd: 8, manualCd: true, desc: 'Dưới 50 Náo Nhiệt: tạo 1 ảo ảnh tự chạy tới đối thủ, Alice tàng hình 1.5s và lướt đi. Đủ 50: hoán đổi vị trí với đối thủ và vây 5 ảo ảnh quanh nó. Hồi chiêu khi ảo ảnh biến mất.', shape: { type: 'dash', len: 120 }, ai: { kind: 'def' },
      cast(w, f, c) {
        const t = foeOf(w, f);
        f.cd.C = 99;
        if (f.ws.hype >= 50 && t) {
          f.ws.hype -= 50;
          const fx0 = f.x, fy0 = f.y; f.x = t.x; f.y = t.y; t.x = fx0; t.y = fy0;
          for (let i = 0; i < 5; i++) { const a = (i * TAU) / 5; w.ent(f, { kind: 'illu', x: t.x + Math.cos(a) * 75, y: t.y + Math.sin(a) * 75, r: 17, dur: 5, hittable: true, still: 1 }); }
          w.addStatus(f, 'invis', 2); w.text(t.x, t.y - 60, '🎩 HOÁN ĐỔI!', '#e0a0ff', 18);
          return;
        }
        w.ent(f, { kind: 'illu', x: f.x, y: f.y, r: 17, dur: 10, hittable: true });
        w.addStatus(f, 'invis', 1.5); w.addStatus(f, 'haste', 1.5, 0.3);
        w.act(f, 'C', { dur: 0.15, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 120, dur: 0.12 })] });
      } },
    D: { name: 'Tẩu Thoát, Ohh!', cd: 4.5, mob: true, desc: 'Đổi chỗ tức thì với ảo ảnh an toàn nhất (xa đối thủ, xa mép sàn).', shape: { type: 'self' }, ai: { kind: 'mob' },
      can(f, w) { return w.owned(f, 'illu').length > 0; },
      cast(w, f) {
        const t = foeOf(w, f);
        const best = w.owned(f, 'illu').map((e) => ({ e, s: edgeDist(w.A, e.x, e.y) + (t ? Math.hypot(t.x - e.x, t.y - e.y) * 0.5 : 0) })).sort((a, b) => b.s - a.s)[0].e;
        const x = f.x, y = f.y; teleport(w, f, best.x, best.y); best.x = x; best.y = y;
      } },
    U: { name: 'Rực Rỡ, Cùng Vui Nào!', desc: 'Tự chọn theo tình huống — Thoát hiểm (điểm văng >80% hoặc sát mép): 6 ảo ảnh chạy toán loạn, tàng hình 3s về giữa sân • Bị áp sát: Hộp Ảo Thuật 2s phản lại đòn đánh x2 • Còn lại: Náo Nhiệt đầy, làm mới mọi hồi chiêu.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) {
        const t = foeOf(w, f);
        if (f.percent > 80 || edgeDist(w.A, f.x, f.y) < 110) {
          for (let i = 0; i < 6; i++) w.ent(f, { kind: 'illu', x: f.x, y: f.y, r: 17, dur: 6, hittable: true, run: (i * TAU) / 6 });
          w.addStatus(f, 'invis', 3); teleport(w, f, f.x * 0.2, f.y * 0.2); w.text(f.x, f.y - 60, 'THOÁT HIỂM!', '#e0a0ff', 18);
        } else if (t && Math.hypot(t.x - f.x, t.y - f.y) < 150) {
          w.addStatus(f, 'box', 2); w.text(f.x, f.y - 60, '📦 HỘP ẢO THUẬT', '#e0a0ff', 18);
        } else { f.ws.hype = 100; for (const k of ['A', 'B', 'C', 'D']) if (f.cd[k] < 50) f.cd[k] = 0; w.text(f.x, f.y - 60, 'VẠN BIẾN!', '#e0a0ff', 18); }
      } },
  },
  onTakeBox: true,
  ents: {
    illu: {
      update(w, e, dt) {
        const o = w.fighter(e.owner), t = o && foeOf(w, o); if (!t || e.still) return;
        const a = e.run != null ? e.run : angOf(e, t);
        if (e.run != null || Math.hypot(t.x - e.x, t.y - e.y) > 50) { e.x += Math.cos(a) * 170 * dt; e.y += Math.sin(a) * 170 * dt; clampInside(w.A, e, 15); }
        e.fa = a;
      },
      onHit(w, e, att) {
        const o = w.fighter(e.owner); w.killEnt(e, att);
        if (!o) return;
        w.hitCircle(o, e.x, e.y, { r: 75, dmg: 4, kb: 130, kg: 3, fxKind: 'boom', color: '#d070ff' });
        gauge(o, 'hype', 25); w.addStatus(o, 'haste', 2, 0.3);
        w.text(e.x, e.y - 40, 'BỊ LỪA RỒI NHA!', '#e0a0ff', 14);
      },
    },
  },
  ev: {
    vanish(w, f) {
      w.ent(f, { kind: 'illu', x: f.x, y: f.y, r: 17, dur: 8, hittable: true });
      const a = w.rand(0, TAU); teleport(w, f, f.x + Math.cos(a) * 110, f.y + Math.sin(a) * 110); w.addStatus(f, 'invis', 1.2);
    },
  },
};
// Hộp Ảo Thuật: bị đánh thì đổi chỗ và trả lại x2
const _aliceTake = alice.onTake;
alice.onTake = (w, f, att, h, info) => {
  if (f.st.box && att && att !== f) {
    delete f.st.box; info.cancel = true;
    const x = f.x, y = f.y; f.x = att.x; f.y = att.y; att.x = x; att.y = y;
    w.applyHit(f, att, { src: f, dmg: (h.dmg || 4) * 2, kb: (h.kb || 100) * 2, kg: (h.kg || 4) * 2 });
    w.text(f.x, f.y - 60, 'PHẢN ĐÒN x2!', '#e0a0ff', 18);
    return;
  }
  _aliceTake(w, f, att, h, info);
};

// =====================================================================
function conTier(f) { if (f.ws.free > 0 || f.ws.con >= 100) return 2; if (f.ws.con >= 50) return 1; return 0; }
function conSpend(f, tier) { if (f.ws.free > 0 || !tier) return; f.ws.con -= tier === 2 ? 100 : 50; }
function addQi(w, f, t) { if (!t || t.kind) return; const q = t.st.qi; if (q) { q.n = Math.min(2, (q.n || 1) + 1); q.t = 8; } else t.st.qi = { t: 8, p: f.id, n: 1, max: 8 }; if (t.st.qi.n >= 2) w.text(t.x, t.y - 56, '✦ 2 KHÍ ẤN', '#ffd76a', 14); }
const wukong = {
  name: 'Wukong', title: 'Tề Thiên', role: 'Đấu Sĩ', color: '#e0a030', weapon: 'pole', weight: 1.02, speed: 1.08, radius: 18,
  passive: { name: 'Côn Thức Vũ', desc: 'Côn tầm xa. Côn Thức: +6 mỗi đòn trúng, +10 khi bị đánh. Đủ 50: A/B/C kế tiếp cường hóa bậc 1 (tốn 50); đủ 100: bậc tối đa (tốn 100, to gấp đôi). Trúng chiêu cường hóa: đối thủ nhận Khí Ấn — đủ 2 Khí Ấn thì dùng được D.' },
  init(f) { f.ws.con = 0; f.ws.free = 0; },
  afterDeal(w, f, t, h) { gauge(f, 'con', 6); if (h.qi) addQi(w, f, t); },
  onTake(w, f) { gauge(f, 'con', 10); },
  update(w, f, dt) { if (f.ws.free > 0) f.ws.free -= dt; if (f.charge && f.charge.key === 'C') { f.invuln = Math.max(f.invuln, 0.05); f.z = 0; } },
  skills: {
    A: { name: 'Toàn Phong Côn', cd: 1.5, desc: 'Xoay côn 360° hai vòng, gạt đạn và hất lùi kẻ áp sát. Côn Thức: Vòng Xoáy hút đối thủ vào rồi vung hất văng.', shape: { type: 'circle', r: 120, self: true }, ai: { kind: 'atk', max: 120 },
      cast(w, f, c) {
        const tier = conTier(f); conSpend(f, tier);
        if (tier) { const R = tier === 2 ? 240 : 160; w.act(f, 'A', { dur: 0.55, anim: 'spin', ang: c.ang, ev: [custom(0.05, 'vacuum', { R }), circle(0.4, { r: R * 0.75, dmg: 7, kb: 210, kg: 7, qi: 1, fxKind: 'quake', color: '#ffd76a' })] }); return; }
        w.act(f, 'A', { dur: 0.5, move: 0.3, anim: 'spin', ang: c.ang, ev: [custom(0.05, 'parry'), circle(0.15, { r: 120, dmg: 3.6, kb: 70, kg: 2.6 }), circle(0.38, { r: 120, dmg: 3.6, kb: 120, kg: 3.6 })] });
      } },
    B: { name: 'Trực Thích Thấu Kình', cd: 3, desc: 'Kết liễu: thúc côn thẳng về trước. Côn Thức: côn dài gấp đôi, xuyên vật cản, hất văng cực mạnh.', shape: { type: 'line', len: 160, w: 30 }, ai: { kind: 'fin', max: 160 },
      cast(w, f, c) {
        const tier = conTier(f); conSpend(f, tier);
        const len = tier === 2 ? 340 : tier ? 260 : 160;
        w.act(f, 'B', { dur: 0.4, anim: 'thrust', ang: c.ang, ev: [line(0.14, { len, w: 30, dmg: tier ? 10 : 8, kb: tier ? 230 : 178, kg: tier ? 8.5 : 7, qi: tier ? 1 : 0, unblock: !!tier })] });
      } },
    C: { name: 'Kình Thiên Trụ', cd: 7, hold: 3, chargeMove: 0, desc: 'Cắm côn bật lên (né đòn) rồi bổ xuống hất tung. Côn Thức: giữ để đứng trên đỉnh côn tới 3s (không bị đánh trúng), thả ra giáng cú đập khổng lồ CHOÁNG 1.5–2.5s.', shape: { type: 'circle', r: 180, self: true }, ai: { kind: 'def' },
      holdIf(f) { return conTier(f) > 0; },
      cast(w, f, c) {
        const tier = f.charge ? 0 : conTier(f);
        if (c.p > 0 || tier) {
          const t2 = conTier(f); conSpend(f, t2 || 1);
          const R = 140 + 60 * c.p + (t2 === 2 ? 60 : 0);
          f.invuln = 0;
          w.hitCircle(f, f.x, f.y, { r: R, dmg: 7 + 4 * c.p, kb: 200 + 80 * c.p, kg: 7, stun: 1.5 + c.p, qi: 1, fxKind: 'quake', color: '#ffd76a' }); w.ev('shake', { p: 14 });
          w.act(f, 'C', { dur: 0.3, anim: 'slam' }); return;
        }
        f.invuln = 0.8; f.vz = 520; f.z = 1;
        w.act(f, 'C', { dur: 0.8, anim: 'leap', ev: [circle(0.7, { r: 110, dmg: 5, kb: 110, kg: 3, knockup: 300, fxKind: 'quake', color: '#e0a030' })] });
      } },
    D: { name: 'Định Thân Thuật', cd: 10, desc: 'Chỉ dùng được khi đối thủ có đủ 2 Khí Ấn: chỉ tay HÓA ĐÁ 2s, triệt tiêu mọi quán tính.', shape: { type: 'circle', r: 520, self: true }, ai: { kind: 'buff', max: 500 },
      can(f, w) { const t = foeOf(w, f); return !!t && t.st.qi && t.st.qi.n >= 2 && Math.hypot(t.x - f.x, t.y - f.y) < 520; },
      cast(w, f) { const t = foeOf(w, f); delete t.st.qi; w.addStatus(t, 'petrify', 2); w.text(t.x, t.y - 60, '🗿 ĐỊNH!', '#d0c0a0', 22); w.act(f, 'D', { dur: 0.3, anim: 'cast', ang: angOf(f, t) }); } },
    U: { name: 'Đại Thánh Hàng Thế', desc: 'Sóng xung chấn hoàng kim đẩy mọi kẻ địch quanh mình ra xa. 6s: KHÔNG THỂ CẢN PHÁ, +35% tốc chạy, A/B/C được cường hóa miễn phí.', shape: { type: 'circle', r: 220, self: true }, ai: { kind: 'ult', max: 220 },
      cast(w, f) {
        w.hitCircle(f, f.x, f.y, { r: 220, dmg: 6, kb: 260, kg: 6, fxKind: 'quake', color: '#ffd76a' });
        w.addStatus(f, 'armor', 6, 1); f.st.armor.unstop = 1; w.addStatus(f, 'haste', 6, 0.35); w.addStatus(f, 'empower', 6, 0.2); f.ws.free = 6;
        w.act(f, 'U', { dur: 0.4, anim: 'roar' }); w.text(f.x, f.y - 60, 'ĐẠI THÁNH!', '#ffd76a', 22);
      } },
  },
  ev: {
    vacuum(w, f, a, e) { for (const t of w.targets(f)) { const d = Math.hypot(t.x - f.x, t.y - f.y); if (d < e.R && !w.superArmor(t)) { t.vx = (f.x - t.x) / d * 420; t.vy = (f.y - t.y) / d * 420; } } },
    parry(w, f) { for (const p of w.s.projs) if (p.team !== f.team && Math.hypot(p.x - f.x, p.y - f.y) < 130 && p.r < 12) p.gone = true; },
  },
};

// =====================================================================
const KZ = { AA: 'Toàn Phong Trảm', AB: 'Quán Kình Đao', BA: 'Thập Tự Trảm', BB: 'Đột Kích Đoạn Đao' };
function kzSeq(w, f, k) { const s = (now(w) - (f.ws.seqT || -9) < 1.5 ? f.ws.seq || '' : '') + k; f.ws.seq = s.slice(-2); f.ws.seqT = now(w); }
const kazuki = {
  name: 'Kazuki', title: 'Song Kiếm Vô Niệm', role: 'Kiếm Sĩ', color: '#9ad0ff', weapon: 'twin', weight: 1.0, speed: 1.12, radius: 18,
  passive: { name: 'Song Kiếm Vô Niệm', desc: 'A (tay trái, nhanh) và B (tay phải, nặng) luân phiên; 2 đòn gần nhất quyết định Kiếm Thế của C: AA xoay 360° • AB đâm CHOÁNG • BA chém chữ X gây Chảy Máu • BB lướt xuyên rồi kích nổ. Mỗi Kiếm Thế +1 Kiếm Ý, phản đòn +5.' },
  init(f) { f.ws.ki = 0; f.ws.seq = ''; },
  update(w, f, dt) {
    if (f.ws.bomb) { f.ws.bomb.t -= dt; if (f.ws.bomb.t <= 0) { const t = w.fighter(f.ws.bomb.tid); f.ws.bomb = null; if (t && w.alive(t)) { w.applyHit(f, t, { src: f, dmg: 7, kb: 215, kg: 8 }); w.ev('fx', { kind: 'bigslash', x: t.x, y: t.y, a: 0.8, r: 90, color: '#9ad0ff', life: 0.35 }); } } }
  },
  onTake(w, f, att, h, info) {
    if (!f.st.parry || !att || att === f) return;
    info.cancel = true; delete f.st.parry;
    w.addStatus(att, 'stun', 1);
    const R = att.r + f.r + 10, a = angOf(f, att); teleport(w, f, att.x + Math.cos(a) * R, att.y + Math.sin(a) * R);
    f.ws.bomb = { tid: att.id, t: 1 }; f.cd.C = 0; f.ws.ki += 5;
    w.text(f.x, f.y - 60, 'NGHỊCH TRẢM!', '#9ad0ff', 18);
  },
  onStatusEnd(w, f, k) { if (k === 'parry' && !f.ws.bomb) w.addStatus(f, 'stun', 0.3); },
  skills: {
    A: { name: 'Tả Trảm', cd: 0.25, desc: 'Chém nhanh tay trái, mở nhịp combo.', shape: { type: 'arc', range: 80, arc: 100 }, ai: { kind: 'atk', max: 80 },
      cast(w, f, c) { kzSeq(w, f, 'A'); w.act(f, 'A', { dur: 0.2, move: 0.5, ang: c.ang, ev: [arc(0.06, { range: 80, arc: 100, dmg: 2.8, kb: 48, kg: 2.1 })] }); } },
    B: { name: 'Hữu Trảm', cd: 0.5, desc: 'Kết liễu: nhát chém nặng tay phải, tầm rộng hơn và đẩy mạnh hơn A.', shape: { type: 'arc', range: 95, arc: 140 }, ai: { kind: 'fin', max: 95 },
      cast(w, f, c) { kzSeq(w, f, 'B'); w.act(f, 'B', { dur: 0.32, move: 0.3, anim: 'wide', ang: c.ang, ev: [arc(0.12, { range: 95, arc: 140, dmg: 5.2, kb: 118, kg: 4.4 })] }); } },
    C: { name: 'Kiếm Thế Quyết', cd: 5, desc: 'Kết thúc chuỗi theo 2 đòn trước: AA Toàn Phong Trảm • AB Quán Kình Đao (CHOÁNG 1s) • BA Thập Tự Trảm (Chảy Máu) • BB Đột Kích Đoạn Đao (lướt xuyên rồi kích nổ).', shape: { type: 'circle', r: 110, self: true }, ai: { kind: 'atk', max: 110 },
      cast(w, f, c) {
        const s = f.ws.seq.length === 2 ? f.ws.seq : 'AA'; f.ws.seq = ''; f.ws.ki++;
        w.text(f.x, f.y - 56, KZ[s], '#bfe4ff', 14);
        if (s === 'AA') w.act(f, 'C', { dur: 0.35, anim: 'spin', ang: c.ang, ev: [circle(0.12, { r: 110, dmg: 6, kb: 150, kg: 5, color: '#9ad0ff' })] });
        else if (s === 'AB') w.act(f, 'C', { dur: 0.35, anim: 'thrust', ang: c.ang, ev: [line(0.12, { len: 155, w: 30, dmg: 6, kb: 110, kg: 3, stun: 1 })] });
        else if (s === 'BA') w.act(f, 'C', { dur: 0.4, anim: 'wide', ang: c.ang, ev: [line(0.12, { len: 110, w: 60, dmg: 5, kb: 60, kg: 2, bleed: 1, rot: 0.5 }), line(0.22, { len: 110, w: 60, dmg: 5, kb: 165, kg: 6, bleed: 1, rot: -0.5 })] });
        else w.act(f, 'C', { dur: 0.3, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 190, dur: 0.16, through: true, invuln: true, onHit: 'cut', hit: { dmg: 4, noKnock: true, stun: 0.8 } })] });
      } },
    D: { name: 'Vô Tướng Nghịch Trảm', cd: 12, desc: 'Thủ thế 0.6s. Đỡ trúng đòn hoặc đạn: CHOÁNG kẻ tấn công 1s, lướt qua chém — 1s sau vết chém nổ văng; hồi ngay C, +5 Kiếm Ý. Đỡ hụt: khựng 0.3s.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'parry', 0.6); w.act(f, 'D', { dur: 0.3, move: 0, anim: 'block' }); } },
    U: { name: 'Vạn Cảnh Trảm Vực', desc: 'Lướt một dải dài xé toạc không gian, để lại Vùng Loạn Kiếm 5s: kẻ địch bên trong liên tục chịu sát thương, bị hút về tâm và không thể lướt.', shape: { type: 'dash', len: 300 }, ai: { kind: 'ult', max: 300 },
      cast(w, f, c) {
        const mx = f.x + Math.cos(c.ang) * 150, my = f.y + Math.sin(c.ang) * 150;
        w.zone(f, { x: mx, y: my, r: 140, dur: 5, tick: 0.3, kind: 'blades', color: '#9ad0ff', hit: { dmg: 1.4, nodash: 1 } });
        w.ent(f, { kind: 'pull', x: mx, y: my, dur: 5, r: 140 });
        w.act(f, 'U', { dur: 0.3, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 300, dur: 0.2, through: true, invuln: true, hit: { dmg: 5, kb: 60, kg: 2 } })] });
      } },
  },
  ents: { pull: { update(w, e, dt) { const o = w.fighter(e.owner); for (const t of w.targets(o)) { const d = Math.hypot(t.x - e.x, t.y - e.y); if (d < e.r && d > 15) { t.x += (e.x - t.x) / d * 55 * dt; t.y += (e.y - t.y) / d * 55 * dt; } } } } },
  ev: { cut(w, f, a, d, t) { f.ws.bomb = { tid: t.id, t: 0.6 }; } },
};

// =====================================================================
const songluc = {
  name: 'Chrono & Neo', title: 'Hai Thời Đại', role: 'Đổi Dạng', color: '#6ac0ff', weapon: 'pistol', weight: 1.0, speed: 1.05, radius: 17,
  passive: { name: 'Hai Thời Đại', desc: 'Hai thế đánh, mỗi thế một băng đạn. CHRONO: 4 viên đạn nặng, nạp 4s, nặng hơn 20%. NEO: 10 viên nhẹ bay nhanh, nạp 2.5s, chạy nhanh hơn 12%. D đổi thế.' },
  init(f) { f.ws.form = 'c'; f.ws.ac = 4; f.ws.an = 10; f.ws.rc = 0; f.ws.rn = 0; },
  update(w, f, dt) {
    const c = f.ws.form === 'c' || f.st.lotus;
    if (c) f.st.heavy = { t: 0.1, p: 0.2, max: 0.1 }; else delete f.st.heavy;
    if (f.ws.form === 'n' || f.st.lotus) { if (!f.st.haste || f.st.haste.p < 0.12) f.st.haste = { t: 0.1, p: 0.12, max: 0.1 }; }
    for (const [a, r, full, T] of [['ac', 'rc', 4, 4], ['an', 'rn', 10, 2.5]]) {
      if (f.ws[r] > 0) { f.ws[r] -= dt; if (f.ws[r] <= 0) f.ws[a] = full; } else if (f.ws[a] <= 0) f.ws[r] = T;
    }
    if (f.st.volley) { f.ws.vt -= dt; if (f.ws.vt <= 0) { f.ws.vt = 0.18; w.proj(f, f.facing + w.rand(-0.06, 0.06), { speed: 1000, range: 520, r: 6, kind: 'xbullet', color: '#6ac0ff', hit: { dmg: 3, kb: 70, kg: 2.6 } }); } }
    if (f.st.lotus) {
      f.ws.lt -= dt;
      if (f.ws.lt <= 0) { f.ws.lt = 0.5; f.ws.lp = (f.ws.lp || 0) + 0.4; const big = f.ws.big ? 2 : 1; for (let i = 0; i < 8; i++) { const h = i % 2 === 0; w.proj(f, f.ws.lp + (i * TAU) / 8, { speed: h ? 600 : 1000, range: 300 * big, r: (h ? 7 : 4) * big, kind: h ? 'xbullet' : 'bullet', color: h ? '#6ac0ff' : '#c0f0ff', hit: { dmg: h ? 3 : 1.6, kb: (h ? 90 : 40) * (f.ws.big ? 1.3 : 1), kg: h ? 3 : 1.5 } }); } }
    }
  },
  onStatusEnd(w, f, k) { if (k === 'lotus') { const big = f.ws.big ? 2 : 1; for (let i = 0; i < 16; i++) w.proj(f, (i * TAU) / 16, { speed: 800, range: 380 * big, r: 8 * big, kind: 'xbullet', color: '#ffd0ff', hit: { dmg: 3.5, kb: 140, kg: 4.5 } }); f.ws.big = 0; } },
  skills: {
    A: { name: 'Bắn', cd: 0.45, desc: 'Chrono: 1 viên đạn nặng đẩy mạnh. Neo: 2 viên đạn nhẹ bay rất nhanh.', shape: { type: 'proj', len: 560, w: 12 }, ai: { kind: 'poke', max: 540 },
      can(f) { return f.ws.form === 'c' ? f.ws.ac > 0 : f.ws.an > 0; },
      cast(w, f, c) {
        if (f.ws.form === 'c') { f.ws.ac--; w.act(f, 'A', { dur: 0.25, move: 0.5, anim: 'shoot', ang: c.ang, ev: [proj(0.03, { speed: 1000, range: 560, r: 7, kind: 'xbullet', color: '#6ac0ff', hit: { dmg: 5.5, kb: 125, kg: 4.6 } })] }); }
        else { f.ws.an = Math.max(0, f.ws.an - 2); w.act(f, 'A', { dur: 0.16, move: 0.8, anim: 'shoot', ang: c.ang, ev: [proj(0.02, { speed: 1500, range: 560, r: 4, kind: 'bullet', color: '#c0f0ff', hit: { dmg: 2, kb: 40, kg: 1.6 } }), proj(0.08, { speed: 1500, range: 560, r: 4, kind: 'bullet', color: '#c0f0ff', hit: { dmg: 2, kb: 40, kg: 1.6 } })] }); }
      } },
    B: { name: 'Thời Khắc', cd: 9, desc: 'Kết liễu — Chrono: Liên Xạ 3s, vừa đi chậm vừa xả đạn, KHÔNG THỂ CẢN PHÁ. Neo: Mưa Đạn 7 viên tỏa rộng.', shape: { type: 'cone', len: 520, arc: 40 }, ai: { kind: 'fin', max: 420 },
      cast(w, f, c) {
        if (f.ws.form === 'c') { w.addStatus(f, 'volley', 3); w.addStatus(f, 'armor', 3, 0.7); f.st.armor.unstop = 1; w.addStatus(f, 'channel', 3, 0.5); f.ws.vt = 0; return; }
        const ev = []; for (let i = 0; i < 7; i++) ev.push(proj(0.03, { rot: (i - 3) * 0.11, speed: 1300, range: 460, r: 5, kind: 'bullet', color: '#c0f0ff', hit: { dmg: 2.6, kb: 70, kg: 2.4 } }));
        w.act(f, 'B', { dur: 0.25, anim: 'shoot', ang: c.ang, ev });
      } },
    C: { name: 'Bước Thời Gian', cd: 3.5, mob: true, desc: 'Chrono: tiến một bước với Thiết Thân 1s. Neo: lướt đi (né đòn) và tàng hình 0.5s, để lại ảo ảnh 2.5s; bấm C lần nữa để giật ngược về chỗ ảo ảnh.', shape: { type: 'dash', len: 150 }, ai: { kind: 'mob' },
      recast(f, w) { return f.ws.form === 'n' && w.owned(f, 'decoy').length > 0; }, recastBusy: true,
      recastUse(w, f) { const d = w.owned(f, 'decoy')[0]; d.dead = true; teleport(w, f, d.x, d.y); },
      cast(w, f, c) {
        if (f.ws.form === 'c') { w.addStatus(f, 'armor', 1, 0.5); f.st.armor.unstop = 1; w.act(f, 'C', { dur: 0.2, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 90, dur: 0.15 })] }); return; }
        w.ent(f, { kind: 'decoy', x: f.x, y: f.y, r: 17, dur: 2.5, hittable: true });
        w.addStatus(f, 'invis', 0.5);
        w.act(f, 'C', { dur: 0.16, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 150, dur: 0.14, invuln: true })] });
      } },
    D: { name: 'Chuyển Thế', cd: 2, desc: 'Đổi thế. Sang Chrono: sóng chấn đẩy lùi quanh người + Thiết Thân 1s. Sang Neo: +50% tốc chạy 1.5s.', shape: { type: 'circle', r: 90, self: true }, ai: { kind: 'buff' },
      cast(w, f) {
        f.ws.form = f.ws.form === 'c' ? 'n' : 'c'; f.ws.swapT = now(w);
        if (f.ws.form === 'c') { w.hitCircle(f, f.x, f.y, { r: 90, dmg: 3, kb: 180, kg: 2, color: '#6ac0ff' }); w.addStatus(f, 'armor', 1, 0.5); f.st.armor.unstop = 1; w.text(f.x, f.y - 50, 'CHRONO', '#6ac0ff', 15); }
        else { w.addStatus(f, 'haste', 1.5, 0.5); w.text(f.x, f.y - 50, 'NEO', '#c0f0ff', 15); }
      } },
    U: { name: 'Liên Hoa Thời Không', desc: '6s hợp làm một (cả trọng lượng lẫn tốc độ, đầy đạn), xả đạn quanh người thành những vòng hoa sen, kết thúc bằng đóa sen lớn. Tung trong 1.5s sau Chuyển Thế: hoa sen TO GẤP ĐÔI.', shape: { type: 'circle', r: 300, self: true }, ai: { kind: 'ult', max: 280 },
      cast(w, f) { f.ws.big = now(w) - (f.ws.swapT ?? -9) < 1.5 ? 1 : 0; f.ws.ac = 4; f.ws.an = 10; w.addStatus(f, 'lotus', 6); f.ws.lt = 0; w.text(f.x, f.y - 60, f.ws.big ? 'LIÊN HOA x2!' : 'LIÊN HOA!', '#ffd0ff', 20); } },
  },
  ents: { decoy: {} },
};

// =====================================================================
const VMODE = ['luc', 'ar', 'co'], VNAME = { luc: '🔫 Lục — Phòng Thủ', ar: '🔥 AR — Tiến Công', co: '🚩 Cờ — Hỗ Trợ' };
function soldiers(w, f) { return w.owned(f, 'sol'); }
const victoria = {
  name: 'Victoria', title: 'Nữ Thống Soái', role: 'Chỉ Huy', color: '#e04a4a', weapon: 'flag', weight: 1.08, speed: 1.0, radius: 18,
  passive: { name: 'Quân Lệnh & Đội Ngũ', desc: 'Đi cùng 3 Lính Tinh Nhuệ (bị đánh 2 lần thì gục, 15s sau quay lại) tự bắn đối thủ. Quân Lệnh (D xoay vòng): Lục — Phòng Thủ (+trụ vững) • AR — Tiến Công (+sát thương) • Cờ — Hỗ Trợ (+tốc chạy). Mỗi chiêu đổi theo Quân Lệnh.' },
  init(f) { f.ws.mode = 'luc'; f.ws.rsp = [0.01, 0.01, 0.01]; },
  update(w, f, dt) {
    const have = soldiers(w, f).map((s) => s.i);
    for (let i = 0; i < 3; i++) if (!have.includes(i)) { f.ws.rsp[i] -= dt; if (f.ws.rsp[i] <= 0) { w.ent(f, { kind: 'sol', i, r: 11, dur: 0, hittable: true, hp: f.st.iron ? 5 : 2, cd: 0.6 + i * 0.3 }); f.ws.rsp[i] = 15; } }
    const m = f.ws.mode;
    if (m === 'luc') f.st.heavy = { t: 0.1, p: 0.2, max: 0.1 };
    else if (m === 'ar') { if (!f.st.empower || f.st.empower.p < 0.1) f.st.empower = { t: 0.1, p: 0.1, max: 0.1 }; }
    else if (!f.st.haste || f.st.haste.p < 0.25) f.st.haste = { t: 0.1, p: 0.25, max: 0.1 };
    if (f.st.missile) { f.ws.mt -= dt; const t = foeOf(w, f); if (t && f.ws.mt <= 0) { f.ws.mt = 2; w.zone(f, { x: t.x, y: t.y, r: 70, delay: 0.7, dur: 0.05, kind: 'strike', color: '#ff6a4a', boom: { dmg: 5, kb: 150, kg: 4 } }); } }
  },
  skills: {
    A: { name: 'Hỏa Lực Theo Dạng', cd: 0.8, desc: 'Lục: 1 phát đạn đẩy lùi • AR: loạt 3 viên • Cờ: vòng cảnh báo 0.5s rồi quét cờ 360° — kẻ đứng ở RÌA (90–175px) nhận đòn cực mạnh hất ra mép.', shape: { type: 'proj', len: 500, w: 12 }, ai: { kind: 'poke', max: 480 },
      cast(w, f, c) {
        const m = f.ws.mode;
        if (m === 'luc') w.act(f, 'A', { dur: 0.22, move: 0.6, anim: 'shoot', ang: c.ang, ev: [proj(0.03, { speed: 1100, range: 500, r: 6, kind: 'bullet', hit: { dmg: 4, kb: 110, kg: 3.5 } })] });
        else if (m === 'ar') { const o = { speed: 1200, range: 480, r: 4, kind: 'bullet', hit: { dmg: 2.1, kb: 45, kg: 2 } }; w.act(f, 'A', { dur: 0.3, move: 0.6, anim: 'shoot', ang: c.ang, ev: [proj(0.02, o), proj(0.1, o), proj(0.18, o)] }); }
        else { w.ev('fx', { kind: 'ring', x: f.x, y: f.y, r: 175, color: '#ff6a4a', life: 0.5 }); w.act(f, 'A', { dur: 0.7, move: 0.2, anim: 'spin', ang: c.ang, ev: [custom(0.5, 'donut')] }); }
      } },
    B: { name: 'Thiết Lập Thế Trận', cd: 5, desc: 'Lục: lướt tới + khiên • AR: lựu đạn nổ diện rộng hất văng • Cờ: cắm cờ — sóng xung kích đẩy kẻ địch ra đúng rìa vòng cờ + CHOÁNG 0.75s.', shape: { type: 'proj', len: 380, w: 30 }, ai: { kind: 'fin', max: 360 },
      cast(w, f, c) {
        const m = f.ws.mode;
        if (m === 'luc') { w.addStatus(f, 'shield', 2, 6); w.act(f, 'B', { dur: 0.2, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 150, dur: 0.15, stopOnHit: true, hit: { dmg: 6, kb: 175, kg: 6.6 } })] }); }
        else if (m === 'ar') w.act(f, 'B', { dur: 0.3, anim: 'cast', ang: c.ang, ev: [proj(0.05, { speed: 650, range: 380, r: 9, kind: 'grenade', color: '#606a40', endBoom: true, explode: { r: 95, dmg: 7.5, kb: 195, kg: 6.8 } })] });
        else { w.hitCircle(f, f.x, f.y, { r: 135, dmg: 3, fixedKb: 300, stun: 0.75, color: '#ff6a4a' }); w.zone(f, { x: f.x, y: f.y, r: 140, dur: 4, kind: 'flag', color: '#e04a4a' }); w.addStatus(f, 'empower', 4, 0.25); w.act(f, 'B', { dur: 0.25, anim: 'slam' }); }
      } },
    C: { name: 'Tổng Lực Tác Chiến', cd: 8, desc: 'Lục: laser đánh dấu, 1.5s sau 2 quả pháo điện từ giáng xuống gây TÊ LIỆT • AR: cả đội xả đạn bão hòa 1.5s • Cờ: lính hú hét xung phong, lao vào chém hất tung.', shape: { type: 'self' }, ai: { kind: 'atk', max: 450 },
      can(f, w) { return !!foeOf(w, f); },
      cast(w, f) {
        const t = foeOf(w, f), m = f.ws.mode;
        if (m === 'luc') { for (let i = 0; i < 2; i++) w.zone(f, { x: t.x + (i ? 30 : -30), y: t.y, r: 75, delay: 1.5 + i * 0.25, dur: 0.05, kind: 'strike', color: '#80c0ff', boom: { dmg: 6, kb: 130, kg: 3, stun: 1.2 } }); w.text(t.x, t.y - 56, '🎯', '#ff4040', 18); }
        else if (m === 'ar') { w.addStatus(f, 'barrage', 1.5); f.ws.bt = 0; }
        else { for (const s of soldiers(w, f)) s.charge = 1.2; w.text(f.x, f.y - 56, 'XUNG PHONG!', '#ff6a4a', 18); }
        w.act(f, 'C', { dur: 0.25, anim: 'cast', ang: angOf(f, t) });
      } },
    D: { name: 'Chuyển Đổi Quân Lệnh', cd: 2, desc: 'Xoay vòng Lục → AR → Cờ. Sang Lục: khiên chặn 1 đòn • Sang AR: ném Flash làm MÙ kẻ trước mặt rồi nhảy lùi • Sang Cờ: pháo kích 3 điểm quanh đối thủ.', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f, c) {
        const i = (VMODE.indexOf(f.ws.mode) + 1) % 3; f.ws.mode = VMODE[i];
        w.text(f.x, f.y - 56, VNAME[f.ws.mode], '#ffb0a0', 14);
        if (f.ws.mode === 'luc') w.addStatus(f, 'shield', 3, 5);
        else if (f.ws.mode === 'ar') { w.hitLine(f, c.ang, { len: 160, w: 90, dmg: 1, noKnock: true, blind: 1.25 }); w.act(f, 'D', { dur: 0.2, anim: 'dash', ang: c.ang, ev: [dash(0, { rot: Math.PI, dist: 130, dur: 0.15 })] }); }
        else { const t = foeOf(w, f); if (t) for (let k = 0; k < 3; k++) { const a = (k * TAU) / 3; w.zone(f, { x: t.x + Math.cos(a) * 60, y: t.y + Math.sin(a) * 60, r: 60, delay: 1.5, dur: 0.05, kind: 'strike', color: '#ff6a4a', boom: { dmg: 4, kb: 130, kg: 3 } }); } }
      } },
    U: { name: 'Mệnh Lệnh Tuyệt Đối', desc: 'Hồi sinh toàn bộ lính. 10s: lính hóa Thiết Binh (chịu 5 đòn, đánh mạnh hơn), tên lửa nã xuống đối thủ mỗi 2s.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { for (const s of soldiers(w, f)) s.dead = true; f.ws.rsp = [0, 0, 0]; w.addStatus(f, 'iron', 10); w.addStatus(f, 'missile', 10); f.ws.mt = 0.5; w.act(f, 'U', { dur: 0.4, anim: 'roar' }); w.text(f.x, f.y - 60, 'MỆNH LỆNH TUYỆT ĐỐI!', '#ff6a4a', 18); } },
  },
  ents: {
    sol: {
      update(w, e, dt) {
        const o = w.fighter(e.owner), t = o && foeOf(w, o); if (!o) return;
        const iron = !!o.st.iron;
        if (e.charge > 0 && t) {
          e.charge -= dt; const a = angOf(e, t); e.fa = a;
          e.x += Math.cos(a) * 340 * dt; e.y += Math.sin(a) * 340 * dt;
          if (Math.hypot(t.x - e.x, t.y - e.y) < t.r + e.r + 4) { e.charge = 0; w.entHit(e, t, { dmg: 4, kb: 150, kg: 4, knockup: 260 }); }
          return;
        }
        const a0 = (o.facing + Math.PI) + (e.i - 1) * 0.9, tx = o.x + Math.cos(a0) * 50, ty = o.y + Math.sin(a0) * 50;
        const d = Math.hypot(tx - e.x, ty - e.y); if (d > 6) { const sp = Math.min(d, 240 * dt); e.x += (tx - e.x) / d * sp; e.y += (ty - e.y) / d * sp; }
        clampInside(w.A, e, 6);
        e.cd -= dt; if (!t) return; e.fa = angOf(e, t);
        const rate = o.st.barrage ? 0.15 : 1.3;
        if (e.cd <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 420) { e.cd = rate; w.proj(o, e.fa + w.rand(-0.05, 0.05), { px: e.x, py: e.y, speed: 1000, range: 440, r: 4, kind: 'bullet', color: '#ffb0a0', hit: { dmg: iron ? 2.4 : 1.4, kb: iron ? 60 : 35, kg: 1.4 } }); }
      },
      onDeath(w, e) { const o = w.fighter(e.owner); if (o) o.ws.rsp[e.i] = 15; },
    },
  },
  ev: {
    donut(w, f) {
      for (const t of w.targets(f)) {
        const d = Math.hypot(t.x - f.x, t.y - f.y);
        if (d < 90 - t.r || d > 175 + t.r) continue;
        w.applyHit(f, t, { src: f, dmg: 9, kb: 225, kg: 8 });
      }
      w.ev('fx', { kind: 'ring', x: f.x, y: f.y, r: 175, color: '#ffffff', life: 0.3 });
    },
  },
};
// AR: Victoria cũng xả đạn khi Bão Lửa
const _vicUpd = victoria.update;
victoria.update = (w, f, dt, inp) => {
  _vicUpd(w, f, dt, inp);
  if (f.st.barrage) { f.ws.bt -= dt; const t = foeOf(w, f); if (t && f.ws.bt <= 0) { f.ws.bt = 0.1; w.proj(f, angOf(f, t) + w.rand(-0.08, 0.08), { speed: 1200, range: 480, r: 4, kind: 'bullet', hit: { dmg: 1.2, kb: 30, kg: 1.2 } }); } }
};

// =====================================================================
function shotgun(w, f, ang, o) {
  for (const t of w.targets(f)) {
    const d = Math.hypot(t.x - f.x, t.y - f.y);
    if (d > o.len + t.r || Math.abs(angDiff(ang, angOf(f, t))) > deg(o.arc) / 2 + Math.atan2(t.r, Math.max(d, 1))) continue;
    const k = clamp(1 - d / (o.len * 1.1), 0.08, 1);
    w.applyHit(f, t, { src: f, angle: ang, dmg: o.dmg * k, kb: o.kb * k, kg: o.kg * k, burn: o.burn });
  }
  for (let i = 0; i < 7; i++) w.ev('fx', { kind: 'thrust', x: f.x, y: f.y, a: ang + (i - 3) * deg(o.arc) / 7, r: o.len, w: 3, color: o.burn ? '#ff8a3a' : '#fff0c0', life: 0.12 });
  w.ev('sfx', { name: 'gun' }); w.ev('shake', { p: 4 });
}
const clint = {
  name: 'Clint', title: 'Cao Bồi Phương Nam', role: 'Xạ Thủ Cận Chiến', color: '#d0a060', weapon: 'shotgun', weight: 1.05, speed: 1.05, radius: 18,
  passive: { name: '2 Viên Đạn', desc: 'Chỉ có 2 viên, tự nạp 1.9s/viên. Đạn tỏa nón: cực gần thì sát thương & lực đẩy cực mạnh, ở xa gần như vô dụng.' },
  init(f) { f.ws.sh = 2; f.ws.rl = 0; f.ws.drag = 0; },
  update(w, f, dt) { if (f.ws.sh < 2) { f.ws.rl += dt; if (f.ws.rl >= 1.9) { f.ws.rl = 0; f.ws.sh++; } } else f.ws.rl = 0; },
  onDeal(w, f, t, h, info) { if (f.ws.crit && h.tagB) { f.ws.crit = 0; info.kbK *= 1.5; w.text(t.x, t.y - 60, 'CHÍ MẠNG!', '#ffd24a', 16); } },
  skills: {
    A: { name: 'Báng Súng', cd: 1.1, desc: 'Đập báng súng vào mặt đối thủ. Trúng: lập tức nạp 1 viên.', shape: { type: 'arc', range: 62, arc: 100 }, ai: { kind: 'atk', max: 62 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.3, move: 0.4, anim: 'punch', ang: c.ang, ev: [custom(0.1, 'butt')] }); } },
    B: { name: 'Bắn', cd: 0.55, desc: 'Kết liễu: bắn 1 viên tỏa nón (300px). Cực gần văng cực mạnh. Đạn Rồng (Nộ): phun lửa xa 450px, thiêu đốt.', shape: { type: 'cone', len: 300, arc: 36 }, ai: { kind: 'fin', max: 160 },
      can(f) { return f.ws.sh > 0 || f.ws.drag > 0; },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.3, anim: 'shoot', ang: c.ang, ev: [custom(0.03, 'blast')] }); } },
    C: { name: 'Bắn Nhảy', cd: 5.5, mob: true, desc: 'Bắn xuống đất: phản chấn hất bạn bay cao và lùi xa (né đòn); kẻ dưới chân dính đạn và bị cháy. Tốn 1 viên.', shape: { type: 'dash', len: 220, back: true }, ai: { kind: 'mob' },
      can(f) { return f.ws.sh > 0; },
      cast(w, f, c) { f.ws.sh--; w.hitCircle(f, f.x, f.y, { r: 75, dmg: 4, kb: 120, kg: 2, burn: 3, fxKind: 'boom', color: '#ff8a3a' }); f.vz = 480; f.z = 1; w.act(f, 'C', { dur: 0.3, anim: 'dash', ang: c.ang, ev: [dash(0, { rot: Math.PI, dist: 220, dur: 0.28, invuln: true })] }); } },
    D: { name: 'Nạp Đạn Khẩn Cấp', cd: 9, desc: 'Ném vỏ đạn vào mặt đối thủ (choáng nhẹ) và nạp đầy 2 viên ngay. Phát Bắn kế tiếp chắc chắn Chí Mạng (đẩy xa x1.5).', shape: { type: 'proj', len: 260, w: 10 }, ai: { kind: 'buff', max: 250 },
      cast(w, f, c) { f.ws.sh = 2; f.ws.crit = 1; w.act(f, 'D', { dur: 0.2, anim: 'cast', ang: c.ang, ev: [proj(0.03, { speed: 900, range: 260, r: 5, kind: 'shell', color: '#d0a060', hit: { dmg: 1, kb: 30, stun: 0.35 } })] }); } },
    U: { name: "Dragon's Breath", desc: 'Nạp 2 viên Đạn Rồng: mỗi phát Bắn (B) phun luồng lửa cực xa, thiêu đốt và đẩy lùi như vòi rồng.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { f.ws.drag = 2; w.text(f.x, f.y - 56, '🐉 ĐẠN RỒNG!', '#ff8a3a', 18); } },
  },
  ev: {
    butt(w, f, a) { if (w.hitArc(f, a.ang, { range: 62, arc: 100, dmg: 4, kb: 110, kg: 3 })) f.ws.sh = Math.min(2, f.ws.sh + 1); w.ev('fx', { kind: 'arc', x: f.x, y: f.y, a: a.ang, r: 62, arc: 100, color: '#d0a060', life: 0.15 }); },
    blast(w, f, a) {
      if (f.ws.drag > 0) { f.ws.drag--; f.cd.B = 0.9; shotgun(w, f, a.ang, { len: 450, arc: 30, dmg: 10, kb: 260, kg: 8, burn: 4, tagB: 1 }); w.zone(f, { x: f.x + Math.cos(a.ang) * 200, y: f.y + Math.sin(a.ang) * 200, r: 110, dur: 2, tick: 0.4, kind: 'fire', color: '#ff7a3a', hit: { dmg: 1, burn: 3 } }); return; }
      f.ws.sh--; shotgun(w, f, a.ang, { len: 300, arc: 36, dmg: 11, kb: 290, kg: 9.5 });
      if (f.ws.crit) { /* xử lý trong onDeal */ }
    },
  },
};
clint.onDeal = (w, f, t, h, info) => { if (f.ws.crit && h.angle != null && !h.proj) { f.ws.crit = 0; info.kbK *= 1.5; w.text(t.x, t.y - 60, 'CHÍ MẠNG!', '#ffd24a', 16); } };

// =====================================================================
const DICE = [8, 17, 17, 17, 17, 24];
function rollDie(w, f) {
  let r = w.rand(0, 100), d = 1; for (let i = 0; i < 6; i++) { r -= DICE[i]; if (r <= 0) { d = i + 1; break; } }
  f.ws.die = d;
  if (d === 1) { f.percent += 6; w.text(f.x, f.y - 60, '⚀ THUA BẠC!', '#ff8a8a', 16); }
  else if (d === 6) w.text(f.x, f.y - 60, '⚅ ĐỘC ĐẮC!', '#ffd24a', 20);
  else w.text(f.x, f.y - 60, ['', '', '⚁', '⚂', '⚃', '⚄'][d] + ` +${(d - 1) * 10}%`, '#ffe680', 15);
}
function jackShot(w, f, ang, extra = {}) {
  const d = f.ws.die || 2, jp = d === 6;
  const m = (jp ? 2.2 : 1 + (d - 1) * 0.1) * (1 + 0.12 * (f.ws.bonus || 0));
  w.proj(f, ang, Object.assign({ speed: 1350, range: 580, r: jp ? 6 : 4, kind: jp ? 'xbullet' : 'bullet', color: jp ? '#ffd24a' : '#fff0c0', hit: { dmg: 3.6 * m, kb: 75 * m * (1 + 0.08 * (f.ws.bonus || 0)), kg: 2.8 * (jp ? 1.6 : 1), stun: jp ? 0.4 : 0 } }, extra));
  w.ev('sfx', { name: 'gun' });
}
const jack = {
  name: 'Jack "Sáu Lỗ"', title: 'Con Bạc Khát Máu', role: 'May Rủi', color: '#c0a080', weapon: 'revolver', weight: 1.0, speed: 1.0, radius: 17,
  passive: { name: 'Gieo Xúc Xắc', desc: 'Ổ xoay 6 viên, hết đạn nạp lại 2.2s. Mỗi lần nạp gieo 1 xúc xắc (⚀ 8% … ⚅ 24%): ⚀ tự nhận +6% điểm văng; ⚁–⚄ cả ổ +10–40% sát thương; ⚅ cả ổ là Viên Định Mệnh (x2.2 sát thương & lực văng, choáng).' },
  init(f, w) { f.ws.am = 6; f.ws.rl = 0; f.ws.die = 3; f.ws.bonus = f.ws.bonus || 0; },
  update(w, f, dt) { if (f.ws.rr) return; if (f.ws.am <= 0) { f.ws.rl += dt; if (f.ws.rl >= 2.2) { f.ws.rl = 0; f.ws.am = 6; rollDie(w, f); } } },
  skills: {
    A: { name: 'Bắn / Bóp Cò', cd: 0.6, desc: 'Bắn 1 viên. Đang chơi Cò Quay Nga: bóp cò — ổ trống chỉ nghe "cạch", trúng viên đạn thì phát súng tử thần nổ ra.', shape: { type: 'proj', len: 580, w: 10 }, ai: { kind: 'poke', max: 560 },
      can(f) { return f.ws.rr || f.ws.am > 0; },
      cast(w, f, c) {
        if (f.ws.rr) {
          const rr = f.ws.rr; rr.pos++;
          if (rr.pos === rr.ch) { f.ws.rr = null; f.ws.am = 0; w.proj(f, c.ang, { speed: 1800, range: 900, r: 10, kind: 'xbullet', color: '#ff3030', pierce: true, hit: { dmg: 22, kb: 320, kg: 10, unblock: true } }); w.text(f.x, f.y - 60, '💀 ĐOÀNG!', '#ff3030', 24); w.ev('shake', { p: 14 }); }
          else w.text(f.x, f.y - 50, `cạch… (${rr.pos}/6)`, '#c0c0c0', 13);
          w.act(f, 'A', { dur: 0.25, anim: 'shoot', ang: c.ang }); return;
        }
        f.ws.am--; w.act(f, 'A', { dur: 0.2, move: 0.7, anim: 'shoot', ang: c.ang, ev: [custom(0.02, 'shot')] });
      } },
    B: { name: 'Quạt Cò', cd: 3, desc: 'Xả toàn bộ đạn còn lại trong ổ thành hình nón. Bị khóa khi chơi Cò Quay Nga.', shape: { type: 'cone', len: 520, arc: 30 }, ai: { kind: 'fin', max: 300 },
      can(f) { return !f.ws.rr && f.ws.am > 0; },
      cast(w, f, c) { const n = f.ws.am, ev = []; for (let i = 0; i < n; i++) ev.push(custom(0.02 + i * 0.05, 'shot', { s: (i - (n - 1) / 2) * 0.1 })); f.ws.am = 0; w.act(f, 'B', { dur: 0.08 + n * 0.05, move: 0.3, anim: 'shoot', ang: c.ang, ev }); } },
    C: { name: 'Lăn Né', cd: 4, mob: true, desc: 'Lăn tránh (né mọi đòn) và nhét thêm 2 viên vào ổ. Bị khóa khi chơi Cò Quay Nga.', shape: { type: 'dash', len: 150 }, ai: { kind: 'mob' },
      can(f) { return !f.ws.rr; },
      cast(w, f, c) { f.ws.am = Math.min(6, f.ws.am + 2); f.ws.rl = 0; w.act(f, 'C', { dur: 0.22, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 150, dur: 0.2, invuln: true })] }); } },
    D: { name: 'Cò Quay Nga', cd: 12, desc: 'Tháo hết đạn, nạp ĐÚNG 1 viên rồi xoay ổ. Khóa B và C. Mỗi lần bóp cò (A) có thể là ổ trống… cho tới khi viên tử thần nổ: sát thương cực lớn, xuyên mọi khiên, văng cực mạnh.', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f) { f.ws.rr = { ch: 1 + Math.floor(w.rand(0, 6)), pos: 0 }; f.ws.am = 0; w.text(f.x, f.y - 60, '🎲 CÒ QUAY NGA', '#ff6060', 18); } },
    U: { name: 'Nhà Cái Trả Thưởng', desc: 'Cộng VĨNH VIỄN tới hết trận +12% sát thương và +8% lực văng (cộng dồn). Nạp đầy ổ và gieo ngay một con ⚅.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { f.ws.bonus = (f.ws.bonus || 0) + 1; f.ws.am = 6; f.ws.rl = 0; f.ws.die = 6; f.ws.rr = null; w.text(f.x, f.y - 60, '💰 NHÀ CÁI TRẢ THƯỞNG!', '#ffd24a', 18); } },
  },
  ev: { shot(w, f, a, e) { jackShot(w, f, a.ang + (e.s || 0)); } },
};
jack.onRespawn = (w, f) => {};

// =====================================================================
const SUITS = { spade: '♠', club: '♣', diamond: '♦', heart: '♥', joker: '🃏', all: '★' };
function drawCard(w, f, noMiss) {
  const r = w.rand(0, 100);
  let c;
  if (!noMiss && r < 25) c = null; else {
    const q = noMiss ? r : r - 25, tot = noMiss ? 100 : 75, k = q / tot;
    c = k < 0.24 ? 'spade' : k < 0.48 ? 'club' : k < 0.71 ? 'diamond' : k < 0.93 ? 'heart' : 'joker';
  }
  f.ws.card = c;
  w.text(f.x, f.y - 56, c ? 'Rút: ' + SUITS[c] : 'RÚT HỤT!', c ? '#ffe680' : '#b0b0b0', 15);
}
const joker = {
  name: 'Joker', title: 'Nữ Quái Bạc Bịp', role: 'May Rủi', color: '#ffd24a', weapon: 'cards', weight: 0.92, speed: 1.1, radius: 17,
  passive: { name: 'Bịp Bợm', desc: 'Ném bài theo chất đang giữ: ♠ lực đẩy cực đại • ♣ khống chế ngẫu nhiên • ♦ nổ diện rộng • ♥ hồi 15% điểm văng • 🃏 đổi chỗ với đối thủ. A có 25% búng thêm 1 lá. Bị đánh có 10% né hoàn toàn (Giả Ngây Ngô).' },
  init(f) { f.ws.card = null; },
  onTake(w, f, att, h, info) { const p = f.st.bluff ? 0.5 : 0.1; if (att && att !== f && w.rng() < p) { info.cancel = true; w.text(f.x, f.y - 50, 'Hụt rồi~', '#ffe680', 14); } },
  skills: {
    A: { name: 'Phi Bài Sắc Cạnh', cd: 0.6, desc: 'Ném lá bài đang giữ theo đường thẳng, áp hiệu ứng chất bài rồi tiêu hao. Tay không: lá bài trắng cấu rỉa. 25%: búng thêm 1 lá y hệt.', shape: { type: 'proj', len: 520, w: 12 }, ai: { kind: 'poke', max: 500 },
      cast(w, f, c) {
        const card = f.ws.card; f.ws.card = null;
        const dbl = w.rng() < 0.25;
        const ev = [custom(0.03, 'throw', { card })]; if (dbl) ev.push(custom(0.12, 'throw', { card }));
        w.act(f, 'A', { dur: 0.22, move: 0.7, anim: 'shoot', ang: c.ang, ev });
      } },
    B: { name: 'Rút Bài May Rủi', cd: 2, desc: 'Rút ngẫu nhiên: 25% rút hụt • ♠ Bích • ♣ Tép • ♦ Rô • ♥ Cơ • 🃏 Joker hiếm.', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f) { drawCard(w, f, false); w.act(f, 'B', { dur: 0.15, anim: 'cast' }); } },
    C: { name: 'Tráo Bài Dưới Tay Áo', cd: 3, mob: true, desc: 'Lướt né đòn và tráo bài: 75% rút lá mới (không rút hụt), 25% kẹt tay áo.', shape: { type: 'dash', len: 100 }, ai: { kind: 'mob' },
      cast(w, f, c) { if (w.rng() < 0.75) drawCard(w, f, true); else w.text(f.x, f.y - 56, 'KẸT TAY ÁO!', '#b0b0b0', 14); w.act(f, 'C', { dur: 0.14, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 100, dur: 0.12, invuln: true })] }); } },
    D: { name: 'Giả Ngây Ngô', cd: 10, desc: '3s: đòn đánh của đối thủ có 50% trượt hoàn toàn. Rút ngay 1 lá (không rút hụt).', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { w.addStatus(f, 'bluff', 3); drawCard(w, f, true); } },
    U: { name: 'Ván Cờ Đổi Chiều', desc: 'Tung hộp bài: 25% hoán đổi điểm văng với đối thủ • 50% Lá Toàn Năng (♠+♣+♦+♥) • 20% Đại Bác Bài quét ngang sàn • 5% Cơn Ác Mộng: đối thủ CHOÁNG 3s.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f, c) {
        const t = foeOf(w, f), r = w.rng();
        if (r < 0.25 && t) { const p = f.percent; f.percent = t.percent; t.percent = p; w.text(f.x, f.y - 60, '🔄 TRÁO ĐỔI SINH MỆNH!', '#ffd24a', 18); }
        else if (r < 0.75) { f.ws.card = 'all'; w.text(f.x, f.y - 60, '★ LÁ TOÀN NĂNG!', '#ffd24a', 18); }
        else if (r < 0.95) { w.act(f, 'U', { dur: 0.4, anim: 'shoot', ang: c.ang, ev: [proj(0.1, { speed: 900, range: 1200, r: 30, kind: 'card', color: '#ffd24a', pierce: true, wall: true, hit: { dmg: 12, kb: 240, kg: 8 } })] }); w.text(f.x, f.y - 60, 'ĐẠI BÁC BÀI!', '#ffd24a', 18); }
        else if (t) { w.addStatus(t, 'stun', 3); w.text(t.x, t.y - 60, '😱 ÁC MỘNG!', '#c060ff', 20); }
      } },
  },
  ev: {
    throw(w, f, a, e) {
      const c = e.card, base = { speed: 950, range: 520, r: 8, kind: 'card', color: '#ffffff', hit: { dmg: 2.6, kb: 50, kg: 2 } };
      if (c === 'spade' || c === 'all') base.hit = { dmg: 5, kb: 230, kg: 7.5 };
      if (c === 'club' || c === 'all') { const k = Math.floor(w.rand(0, 4)); Object.assign(base.hit, [{ stun: 0.8 }, { slow: [0.5, 2] }, { silence: 1.5 }, { burn: 3 }][k]); base.hit.dmg = Math.max(base.hit.dmg, 4); }
      if (c === 'diamond' || c === 'all') { base.endBoom = true; base.explode = { r: 85, dmg: 6, kb: 150, kg: 5 }; }
      if (c === 'heart' || c === 'all') f.percent = Math.max(0, f.percent - 15);
      if (c) base.color = c === 'heart' || c === 'diamond' ? '#ff6060' : c === 'joker' || c === 'all' ? '#ffd24a' : '#202020';
      base.tag = c === 'joker' || c === 'all' ? 'swap' : '';
      w.proj(f, a.ang, base);
    },
  },
  onProjHit(w, f, p, t) { if (p.tag === 'swap') { const x = f.x, y = f.y; f.x = t.x; f.y = t.y; t.x = x; t.y = y; w.text(t.x, t.y - 56, '🃏 ĐỔI CHỖ!', '#ffd24a', 15); } },
};

// =====================================================================
const raven = {
  name: 'Raven', title: 'Sát Thủ Bắn Tỉa', role: 'Xạ Thủ', color: '#6a7a9a', weapon: 'rifle', weight: 0.95, speed: 1.06, radius: 17,
  passive: { name: 'Sát Thủ Chuyên Nghiệp', desc: 'Súng trường (A) 30 viên, súng tỉa (B) 5 viên; bắn cạn băng mới nạp lại (6s). Đối thủ càng xa, đạn đẩy văng càng mạnh (tối đa +35%).' },
  init(f) { f.ws.ar = 30; f.ws.sn = 5; f.ws.rr = 0; f.ws.rs = 0; },
  update(w, f, dt) {
    if (f.ws.ar <= 0) { f.ws.rr += dt; if (f.ws.rr >= 6) { f.ws.ar = 30; f.ws.rr = 0; } }
    if (f.ws.sn <= 0) { f.ws.rs += dt; if (f.ws.rs >= 6) { f.ws.sn = 5; f.ws.rs = 0; } }
    const sm = w.owned(f, 'smoke')[0];
    if (sm && Math.hypot(f.x - sm.x, f.y - sm.y) < sm.r) { if (!f.st.invis || f.st.invis.t < 0.3) w.addStatus(f, 'invis', 1); }
  },
  onDeal(w, f, t, h, info) {
    const d = Math.hypot(t.x - f.x, t.y - f.y); info.kbK *= 1 + 0.35 * clamp((d - 150) / 450, 0, 1);
    if (f.st.night) info.kbK *= 1.4;
  },
  skills: {
    A: { name: 'Bắn 3 Viên', cd: 1, desc: 'Nã loạt 3 viên (tốn 3 đạn). Đối thủ bị Oca đánh dấu: đạn tự đuổi theo.', shape: { type: 'proj', len: 560, w: 10 }, ai: { kind: 'poke', min: 120, max: 540 },
      can(f) { return f.ws.ar > 0; },
      cast(w, f, c) {
        f.ws.ar = Math.max(0, f.ws.ar - 3);
        const t = foeOf(w, f), mk = t && t.st.marked && t.st.marked.p === f.id;
        const o = { speed: 1300, range: 560, r: 4, kind: 'bullet', color: '#d0e0ff', home: mk ? 4 : 0, tg: t ? t.id : 0, hit: { dmg: 2, kb: 45, kg: 1.8 } };
        w.act(f, 'A', { dur: 0.3, move: 0.6, anim: 'shoot', ang: c.ang, ev: [proj(0.02, o), proj(0.09, o), proj(0.16, o)] });
      } },
    B: { name: 'Bắn Tỉa Xuyên Phá', cd: 2, desc: 'Kết liễu: phát bắn siêu thanh tầm cực xa (tốn 1 đạn tỉa). Bị áp sát thì lăn lùi rồi mới bóp cò. Đối thủ bị đánh dấu: xuyên cột, bỏ qua khiên.', shape: { type: 'proj', len: 1200, w: 12 }, ai: { kind: 'fin', min: 100, max: 1100 },
      can(f) { return f.ws.sn > 0; },
      cast(w, f, c) {
        f.ws.sn--;
        const t = foeOf(w, f), mk = t && t.st.marked && t.st.marked.p === f.id, close = t && Math.hypot(t.x - f.x, t.y - f.y) < 110;
        const ev = []; let at = 0.3;
        if (close) { ev.push(dash(0, { rot: Math.PI, dist: 150, dur: 0.18, invuln: true })); at = 0.42; }
        ev.push(proj(at, { speed: 2400, range: 1300, r: 6, kind: 'sniper', color: '#ffffff', wall: !!mk, hit: { dmg: 10, kb: 200, kg: 7.6, unblock: !!mk } }));
        w.act(f, 'B', { dur: at + 0.12, anim: 'shoot', ang: c.ang, ev });
      } },
    C: { name: 'Kỹ Thuật Ẩn Nấp', cd: 9, desc: 'Ném bom khói dưới chân 3.5s: Raven trong khói TÀNG HÌNH; đối thủ trong khói bị MÙ.', shape: { type: 'circle', r: 110, self: true }, ai: { kind: 'def' },
      cast(w, f) { w.ent(f, { kind: 'smoke', x: f.x, y: f.y, r: 110, dur: 3.5 }); w.zone(f, { x: f.x, y: f.y, r: 110, dur: 3.5, tick: 0.5, kind: 'smoke', color: '#606878', hit: { dmg: 0, noKnock: true, blind: 1 } }); w.addStatus(f, 'haste', 2, 0.25); } },
    D: { name: 'Quạ Cơ Giới Oca', cd: 15, manualCd: true, desc: 'Thả quạ máy Oca bay trên sàn 10s: liên tục thả bom mini làm chậm và ĐÁNH DẤU đối thủ (lộ cả khi tàng hình). Hồi chiêu khi Oca rời sàn.', shape: { type: 'self' }, ai: { kind: 'buff' },
      cast(w, f) { f.cd.D = 99; w.ent(f, { kind: 'oca', x: f.x, y: f.y, r: 12, dur: 10, cd: 0.8 }); } },
    U: { name: 'Màn Đêm Vĩnh Cửu', desc: 'Toàn sàn tối sầm 5s với đối thủ (mất tầm nhìn). Raven tàng hình hoàn toàn, mọi phát bắn đẩy văng mạnh hơn 40%.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { const t = foeOf(w, f); if (t) w.addStatus(t, 'dark', 5); w.addStatus(f, 'night', 5); w.addStatus(f, 'invis', 5); w.text(f.x, f.y - 60, '🌑 MÀN ĐÊM', '#a0b0d0', 20); } },
  },
  onStatusEnd(w, f, k) { if (k === 'invis' && f.st.night) w.addStatus(f, 'invis', f.st.night.t); },
  ents: {
    smoke: {},
    oca: {
      update(w, e, dt) {
        const o = w.fighter(e.owner), t = o && foeOf(w, o); if (!t) return;
        const a = angOf(e, t), d = Math.hypot(t.x - e.x, t.y - e.y);
        if (d > 40) { e.x += Math.cos(a) * 230 * dt; e.y += Math.sin(a) * 230 * dt; } e.fa = a;
        e.cd -= dt;
        if (e.cd <= 0 && d < 80) { e.cd = 1.2; w.zone(o, { x: t.x, y: t.y, r: 55, delay: 0.35, dur: 0.05, kind: 'strike', color: '#a0b0d0', boom: { dmg: 2, kb: 40, kg: 1, slow: [0.3, 1.5] } }); w.addStatus(t, 'marked', 5, o.id); }
      },
      onEnd(w, e) { const o = w.fighter(e.owner); if (o) o.cd.D = 15 * 0.85; },
    },
  },
};

// =====================================================================
function windMode(f) { const v = f.ws.wind; return v <= 35 ? 'thuan' : v >= 65 ? 'nghich' : 'bao'; }
const thanhphong = {
  name: 'Diệp Thanh Phong', title: 'Lời Ru Tử Thần', role: 'Khống Chế', color: '#7ad0b0', weapon: 'fan', weight: 0.98, speed: 1.12, radius: 17,
  passive: { name: 'Khí Áp Phong Vũ', desc: 'Thước gió 0–100 (A kéo -15, B đẩy +15). 🍃 Thuận (≤35): +30% tốc chạy, Giáp Phong Hộ chặn 1 đòn (hồi 10s) • 🌀 Bão Hòa (36–64): +15% tốc chạy & sát thương, A gây Gió Mê (3 tầng → NGỦ GẬT 1s) • 🌪️ Nghịch (≥65): +25% sát thương, +35% lực văng.' },
  init(f) { f.ws.wind = 50; f.ws.guardT = 0; },
  update(w, f, dt) {
    const m = windMode(f);
    const hs = m === 'thuan' ? 0.3 : m === 'bao' ? 0.15 : 0;
    if (hs && (!f.st.haste || f.st.haste.p < hs)) f.st.haste = { t: 0.1, p: hs, max: 0.1 };
    f.ws.guardT -= dt;
    if (f.st.sleepZone) { /* quản lý trong ent */ }
  },
  onDeal(w, f, t, h, info) {
    const m = windMode(f);
    if (m === 'bao') info.dmgK *= 1.15; if (m === 'nghich') { info.dmgK *= 1.25; info.kbK *= 1.35; }
    if (h.drowsy && m === 'bao' && !t.kind) { const d = (t.ws.drowsy || 0) + 1; t.ws.drowsy = d; if (d >= 3) { t.ws.drowsy = 0; info.extra = () => w.addStatus(t, 'sleep', 1); } }
  },
  onTake(w, f, att, h, info) { if (windMode(f) === 'thuan' && f.ws.guardT <= 0 && att && att !== f) { f.ws.guardT = 10; info.cancel = true; w.text(f.x, f.y - 50, '🍃 PHONG HỘ', '#a0ffd0', 14); } },
  skills: {
    A: { name: 'Toàn Phong Quy', cd: 2, desc: 'Phóng lốc xoáy hất tung kẻ trên đường. Thuận: lốc dừng ở đối thủ thành Vực Xoáy hút & xé 2.5s • Nghịch: hóa luồng ám phong lướt theo lốc, xuất hiện sau lưng đối thủ. Gió -15.', shape: { type: 'proj', len: 420, w: 36 }, ai: { kind: 'poke', max: 400 },
      cast(w, f, c) {
        const m = windMode(f); gauge(f, 'wind', -15);
        w.act(f, 'A', { dur: 0.3, move: 0.5, anim: 'cast', ang: c.ang, ev: [proj(0.05, { speed: 620, range: 420, r: 18, kind: 'tornado', color: '#a0ffd0', pierce: m !== 'thuan', tag: m, hit: { dmg: 4, kb: 70, kg: 2, knockup: 260, drowsy: 1, slow: m === 'bao' ? [0.2, 1.5] : null } })] });
        if (m === 'nghich') f.invuln = Math.max(f.invuln, 0.6);
      } },
    B: { name: 'Bát Diện Phong Trận', cd: 5, desc: 'Bung quạt 360° đẩy dạt kẻ địch. Thuận: Màng Chắn Gió 5s chặn mọi đạn • Nghịch: phóng lưỡi dao gió; trúng thì dịch chuyển ra SAU LƯNG đối thủ và đâm quạt chí mạng. Gió +15.', shape: { type: 'circle', r: 110, self: true }, ai: { kind: 'fin', max: 110 },
      cast(w, f, c) {
        const m = windMode(f); gauge(f, 'wind', 15);
        w.hitCircle(f, f.x, f.y, { r: 110, dmg: 3, fixedKb: 240, color: '#a0ffd0' });
        if (m === 'thuan') w.addStatus(f, 'bwall', 5);
        if (m === 'nghich') w.act(f, 'B', { dur: 0.3, anim: 'cast', ang: c.ang, ev: [proj(0.05, { speed: 1000, range: 420, r: 14, kind: 'crescent', color: '#d0fff0', tag: 'crescent', hit: { dmg: 2, noKnock: true } })] });
      } },
    C: { name: 'Mê Tung Phong Vực', cd: 7, mob: true, maxRange: 190, desc: 'Để lại luồng gió độc 3s: kẻ địch bên trong bị MÙ và CÂM LẶNG. Bản thân dịch chuyển tức thời 190px.', shape: { type: 'point', range: 190, r: 30 }, ai: { kind: 'mob' },
      cast(w, f, c) {
        w.zone(f, { x: f.x, y: f.y, r: 100, dur: 3, tick: 0.5, kind: 'smoke', color: '#7ad0b0', hit: { dmg: 0.5, noKnock: true, blind: 1.5, silence: 1.5 } });
        teleport(w, f, f.x + Math.cos(c.ang) * 190, f.y + Math.sin(c.ang) * 190);
      } },
    D: { name: 'Nghịch Chuyển Canh Khí', cd: 4, breakCC: true, desc: 'Thuận: +30 gió • Nghịch: -30 gió • Bão Hòa: kích nổ khí áp (50% về 15, 50% lên 85) và THANH TẨY mọi khống chế (dùng được cả khi bị choáng).', shape: { type: 'self' }, ai: { kind: 'buff' },
      can(f, w) { return w.canAct(f) || windMode(f) === 'bao'; },
      cast(w, f) {
        const m = windMode(f);
        if (m === 'thuan') gauge(f, 'wind', 30); else if (m === 'nghich') gauge(f, 'wind', -30);
        else { f.ws.wind = w.rng() < 0.5 ? 15 : 85; for (const k of ['stun', 'sleep', 'root', 'charm', 'silence', 'slow', 'petrify']) delete f.st[k]; f.hitstun = 0; w.text(f.x, f.y - 56, 'THANH TẨY!', '#a0ffd0', 15); }
      } },
    U: { name: 'Cơn Gió Đưa Giấc', maxRange: 450, desc: 'Cắm quạt mở Vùng Bão Tố 6s: kẻ địch bên trong chịu lưỡi gió và chậm 60%; đứng trong vùng quá 2.5s → NGỦ SAY 2s. Đòn đầu tiên đánh thức: x2 lực văng.', shape: { type: 'point', range: 450, r: 170 }, ai: { kind: 'ult', max: 420 },
      cast(w, f, c) { w.zone(f, { x: c.ax, y: c.ay, r: 170, dur: 6, tick: 0.4, kind: 'storm', color: '#7ad0b0', hit: { dmg: 0.8, slow: [0.6, 0.6] } }); w.ent(f, { kind: 'lull', x: c.ax, y: c.ay, r: 170, dur: 6, in: 0 }); w.act(f, 'U', { dur: 0.3, anim: 'cast' }); } },
  },
  ents: { lull: { update(w, e, dt) { const o = w.fighter(e.owner); const t = o && foeOf(w, o); if (!t) return; if (Math.hypot(t.x - e.x, t.y - e.y) < e.r) { e.in += dt; if (e.in >= 2.5) { e.in = -3; w.addStatus(t, 'sleep', 2); w.text(t.x, t.y - 56, '💤 NGỦ SAY', '#c0b0ff', 16); } } else e.in = Math.max(0, e.in); } } },
  onProjHit(w, f, p, t) {
    if (p.tag === 'thuan') w.zone(f, { x: t.x, y: t.y, r: 80, dur: 2.5, tick: 0.35, kind: 'storm', color: '#a0ffd0', hit: { dmg: 1, slow: [0.3, 0.5] } });
    if (p.tag === 'nghich' || p.tag === 'crescent') {
      const R = t.r + f.r + 6; teleport(w, f, t.x - Math.cos(t.facing) * R, t.y - Math.sin(t.facing) * R);
      f.facing = angOf(f, t);
      if (p.tag === 'crescent') { w.applyHit(f, t, { src: f, dmg: 9, kb: 255, kg: 9 }); w.text(t.x, t.y - 60, 'ĐOẠT MỆNH!', '#d0fff0', 18); }
    }
  },
};

// =====================================================================
const galo = {
  name: 'Galo', title: 'Bình Độc Hóa Thú', role: 'Đổi Dạng', color: '#7ae04a', weapon: 'flask', weight: 0.94, speed: 1.06, radius: 17,
  passive: { name: 'Độc Tiêu Xương & Cơn Nghiện', desc: 'Đòn độc găm Tiêu Xương (tối đa 6 tầng): rút điểm văng mỗi giây, mỗi tầng giảm 5% trọng lượng nạn nhân. D hóa Quái Thú 15s: +15% điểm văng bản thân nhưng có khiên, Siêu Giáp, nặng hơn 40%. Hết dạng: Vã Thuốc 3s (chậm, cấm lướt).' },
  init(f) { f.ws.beast = 0; },
  update(w, f, dt) { if (f.st.beast) { f.st.heavy = { t: 0.1, p: 0.4, max: 0.1 }; } },
  onStatusEnd(w, f, k) {
    if (k === 'beast') { delete f.st.heavy; delete f.st.armor; w.addStatus(f, 'slow', 3, 0.3); w.addStatus(f, 'nodash', 3); f.cd.D = 20; f.cd.A = f.cd.B = f.cd.C = 0; w.text(f.x, f.y - 56, 'VÃ THUỐC…', '#a0c080', 14); }
  },
  onDeal(w, f, t, h, info) { if (h.bite && t.st.poison && t.st.poison.n >= 6) info.kbK *= 1.4; if (f.st.hunt && h.bite && t.percent > 60) info.kbK *= 1.5; if (f.st.hunt && h.claw) f.percent = Math.max(0, f.percent - 1); },
  skills: {
    A: { name: 'Lọ Độc / Song Trảo', cd: 1, desc: 'Người: ném lọ hóa chất vỡ ra, găm Tiêu Xương • Thú: cào 2 nhát chữ X cực nhanh.', shape: { type: 'proj', len: 380, w: 20 }, ai: { kind: 'poke', max: 360 },
      cast(w, f, c) {
        if (f.st.beast) { f.cd.A = 0.5; w.act(f, 'A', { dur: 0.3, move: 0.5, anim: 'punch', ang: c.ang, ev: [arc(0.06, { range: 78, arc: 120, dmg: 4, kb: 70, kg: 3, poison: 1, claw: 1 }), arc(0.18, { range: 78, arc: 120, dmg: 4.2, kb: 110, kg: 4, claw: 1 })] }); return; }
        w.act(f, 'A', { dur: 0.3, move: 0.6, anim: 'cast', ang: c.ang, ev: [proj(0.06, { speed: 620, range: 380, r: 8, kind: 'flask', color: '#7ae04a', endBoom: true, explode: { r: 60, dmg: 4, kb: 80, kg: 3, poison: 1 } })] });
      } },
    B: { name: 'Bom Khí Ngạt / Ngoạm Cắn', cd: 4.5, desc: 'Người: lựu đạn khí độc tạo vũng 3.5s (chậm 40%, MÙ, độc) • Thú: lao tới ngoạm cổ rồi hất ra phía mép sàn (+40% nếu đủ 6 tầng độc).', shape: { type: 'proj', len: 360, w: 24 }, ai: { kind: 'fin', max: 340 },
      cast(w, f, c) {
        if (f.st.beast) { f.cd.B = 3.5 * 0.85; w.act(f, 'B', { dur: 0.3, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 170, dur: 0.15, stopOnHit: true, onHit: 'bite' })] }); return; }
        w.act(f, 'B', { dur: 0.3, anim: 'cast', ang: c.ang, ev: [proj(0.05, { speed: 600, range: Math.min(360, Math.hypot(c.ax - f.x, c.ay - f.y) || 360), r: 9, kind: 'flask', color: '#a0c040', tag: 'gas', endBoom: true, explode: { r: 50, dmg: 2, noKnock: true } })] });
      } },
    C: { name: 'Nhảy Lùi / Hống Xung Phong', cd: 6, mob: true, desc: 'Người: bật nhảy lùi, xả khói độc và +25% tốc chạy 2s • Thú: gầm CHOÁNG 0.5s kẻ trước mặt rồi phi thân vồ tới.', shape: { type: 'dash', len: 180, back: true }, ai: { kind: 'mob' },
      cast(w, f, c) {
        if (f.st.beast) { f.cd.C = 5 * 0.85; w.act(f, 'C', { dur: 0.35, anim: 'roar', ang: c.ang, ev: [arc(0.02, { range: 150, arc: 70, dmg: 2, noKnock: true, stun: 0.5 }), dash(0.12, { dist: 200, dur: 0.16, stopOnHit: true, hit: { dmg: 5, kb: 120, kg: 4 } })] }); return; }
        w.zone(f, { x: f.x, y: f.y, r: 80, dur: 2, tick: 0.5, kind: 'smoke', color: '#7ae04a', hit: { dmg: 0.6, noKnock: true, poison: 1 } });
        w.addStatus(f, 'haste', 2, 0.25);
        w.act(f, 'C', { dur: 0.24, anim: 'dash', ang: c.ang, ev: [dash(0, { rot: Math.PI, dist: 180, dur: 0.2 })] });
      } },
    D: { name: '"Quá Liều!" / Tiếng Hú', cd: 6, desc: 'Người: uống cạn bình độc hóa Quái Thú 15s (khiên, Siêu Giáp, nặng hơn) • Thú: Tiếng Hú Tử Thần — sóng âm CHOÁNG diện rộng 1.25s.', shape: { type: 'circle', r: 160, self: true }, ai: { kind: 'buff' },
      cast(w, f) {
        if (f.st.beast) { f.cd.D = 6 * 0.85; w.hitCircle(f, f.x, f.y, { r: 160, dmg: 3, noKnock: true, stun: 1.25, color: '#7ae04a' }); w.act(f, 'D', { dur: 0.3, anim: 'roar' }); return; }
        w.addStatus(f, 'beast', 15); w.addStatus(f, 'shield', 15, 10); w.addStatus(f, 'armor', 15, 0.85); f.percent += 15; f.cd.D = 1;
        w.text(f.x, f.y - 60, 'QUÁ LIỀU!', '#7ae04a', 20); w.act(f, 'D', { dur: 0.4, anim: 'roar' });
      } },
    U: { name: 'Đại Dịch / Thợ Săn Tối Thượng', desc: 'Người: sương độc phủ vùng rộng 8s — đối thủ bên trong MÙ, liên tục trúng độc và lập tức đủ 6 tầng • Thú: Săn Mồi 10s — +50% tốc chạy, cào hồi điểm văng, cú ngoạm văng cực mạnh khi đối thủ trên 60%.', shape: { type: 'circle', r: 300, self: true }, ai: { kind: 'ult' },
      cast(w, f) {
        if (f.st.beast) { w.addStatus(f, 'hunt', 10); w.addStatus(f, 'haste', 10, 0.5); w.text(f.x, f.y - 60, 'SĂN MỒI!', '#7ae04a', 20); return; }
        const t = foeOf(w, f); if (t) { for (let i = 0; i < 6; i++) w.addStatus(t, 'poison', 6, 0.6); }
        w.zone(f, { x: f.x, y: f.y, r: 300, dur: 8, tick: 0.6, kind: 'smoke', color: '#5a8a3a', hit: { dmg: 0.6, noKnock: true, poison: 1, blind: 1 } });
        w.text(f.x, f.y - 60, 'ĐẠI DỊCH!', '#7ae04a', 20);
      } },
  },
  onProjHit(w, f, p, t) {},
  ev: { bite(w, f, a, d, t) { const o = outAng(w, t); w.applyHit(f, t, { src: f, angle: o, dmg: 8, kb: 205, kg: 7.6, bite: 1 }); } },
};
// khí ga: nổ ra tạo vũng
galo.onBoom = (w, f, p) => { if (p.tag === 'gas') w.zone(f, { x: p.x, y: p.y, r: 105, dur: 3.5, tick: 0.5, kind: 'smoke', color: '#a0c040', hit: { dmg: 0.8, noKnock: true, poison: 1, blind: 1, slow: [0.4, 0.6] } }); };

export const BATCH1B = { alice, wukong, kazuki, songluc, victoria, clint, jack, joker, raven, thanhphong, galo };
export { windMode };
