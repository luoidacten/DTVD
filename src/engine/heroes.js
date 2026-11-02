// ===== 8 tướng (chuyển thể từ bộ chiêu Legacy) =====
// Mỗi chiêu: { name, desc, cd, hold?, chargeMove?, maxRange?, can?, recast?, recastUse?, cast(w,f,ctx), shape (vùng ngắm), ai }
// ctx = { ang, ax, ay, p (0..1 lực tụ) }. Chiêu tạo `act` với danh sách sự kiện dạng dữ liệu → snapshot được.
import { TAU, clamp, angDiff, deg } from './math.js';
import { clampInside, edgeDist, blockedBy } from './arena.js';

const arc = (at, o) => Object.assign({ at, do: 'arc' }, o);
const line = (at, o) => Object.assign({ at, do: 'line' }, o);
const circle = (at, o) => Object.assign({ at, do: 'circle' }, o);
const proj = (at, o) => Object.assign({ at, do: 'proj' }, o);
const dash = (at, o) => Object.assign({ at, do: 'dash' }, o);
const custom = (at, fn, o) => Object.assign({ at, do: 'custom', fn }, o);
const fx = (at, kind, o) => Object.assign({ at, do: 'fx', kind }, o);
const behind = (t, a) => Math.abs(angDiff(t.facing, Math.atan2(a.y - t.y, a.x - t.x))) > deg(110);

function teleport(w, f, x, y) {
  const p = { x, y };
  clampInside(w.A, p, f.r + 4);
  for (const c of w.A.pillars) {
    const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
    if (d < c.r + f.r) { const k = (c.r + f.r + 2) / (d || 1); p.x = c.x + dx * k; p.y = c.y + dy * k; }
  }
  w.ev('fx', { kind: 'blink', x: f.x, y: f.y, r: 30, color: w.H(f).color, life: 0.3 });
  f.x = p.x; f.y = p.y; f.vx = 0; f.vy = 0;
  w.ev('fx', { kind: 'blink', x: f.x, y: f.y, r: 30, color: w.H(f).color, life: 0.3 });
}

// =====================================================================
const valerius = {
  name: 'Valerius', title: 'Hiệp Sĩ Đế Quốc', role: 'Đỡ Đòn', color: '#5aa9ff', weapon: 'swordshield',
  weight: 1.25, speed: 1.02, radius: 20, taken: 0.85,
  passive: { name: 'Công Thủ', desc: 'Nhận ít hơn 15% điểm văng. Mỗi lần bị trúng đòn tích 1 tầng Phản Kích (tối đa 3): đòn kế tiếp gây thêm 12% điểm văng mỗi tầng.' },
  onTake(w, f) { f.ws.stk = Math.min(3, (f.ws.stk || 0) + 1); },
  onDeal(w, f, t, h, info) { if (f.ws.stk) { info.dmgK *= 1 + 0.12 * f.ws.stk; f.ws.stk = 0; } },
  onCancel(w, f, a) { if (a && a.key === 'C') delete f.st.block; },
  skills: {
    A: { name: 'Chém Vòng Cung', cd: 0.5, desc: 'Chém vòng cung phía trước, nhanh — dồn điểm văng.', shape: { type: 'arc', range: 86, arc: 130 }, ai: { kind: 'atk', max: 95 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.3, move: 0.4, ang: c.ang, ev: [arc(0.1, { range: 86, arc: 130, dmg: 6.6, kb: 95, kg: 4.4 })] }); } },
    B: { name: 'Đâm Thẳng', cd: 2.2, desc: 'Kết liễu: dồn lực đâm thẳng 150px, đẩy văng rất mạnh.', shape: { type: 'line', len: 150, w: 36 }, ai: { kind: 'fin', min: 40, max: 150 },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.42, move: 0.15, anim: 'thrust', ang: c.ang, ev: [line(0.17, { len: 145, w: 34, dmg: 9, kb: 176, kg: 6.9 })] }); } },
    C: { name: 'Khiên Chắn', cd: 9, desc: 'Giơ khiên 0.8s chặn 80% điểm văng, không bị đẩy. Kết thúc bằng cú húc khiên: CHOÁNG 0.4s, CÂM LẶNG 1s.', shape: { type: 'line', len: 80, w: 50 }, ai: { kind: 'def' },
      cast(w, f, c) {
        w.addStatus(f, 'block', 0.8);
        w.act(f, 'C', { dur: 0.92, move: 0.35, anim: 'block', ang: c.ang, ev: [custom(0.8, 'bash')] });
      } },
    D: { name: 'Cuồng Phong', cd: 5, desc: 'Tăng 45% tốc chạy 1.5s và chém một vòng quanh người, làm chậm 30%.', shape: { type: 'circle', r: 82, self: true }, ai: { kind: 'atk', max: 90 },
      cast(w, f, c) {
        w.addStatus(f, 'haste', 1.5, 0.45);
        w.act(f, 'D', { dur: 0.28, move: 1, anim: 'spin', ang: c.ang, ev: [circle(0.1, { r: 82, dmg: 4, kb: 115, kg: 3, slow: [0.3, 1.2] })] });
      } },
    U: { name: 'Chiến Thần Bất Tử', desc: 'Bất tử 5s (không nhận điểm văng, không bị đẩy), +40% sát thương, +60% tốc chạy.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f, c) {
        w.addStatus(f, 'immortal', 5); w.addStatus(f, 'empower', 5, 0.4); w.addStatus(f, 'haste', 5, 0.6);
        w.act(f, 'U', { dur: 0.4, anim: 'roar', ang: c.ang, ev: [fx(0, 'halo', { r: 60, color: '#ffd76a' })] });
        w.text(f.x, f.y - 60, 'BẤT TỬ!', '#ffd76a', 22);
      } },
  },
  ev: {
    bash(w, f, a) {
      delete f.st.block;
      w.hitLine(f, a.ang, { len: 80, w: 50, dmg: 4, kb: 230, kg: 3, stun: 0.4, silence: 1 });
      w.ev('fx', { kind: 'slash', x: f.x, y: f.y, a: a.ang, r: 70, color: '#9ec9ff', life: 0.25 });
    },
  },
};

// =====================================================================
const gideon = {
  name: 'Gideon', title: 'Kiếm Sĩ Lữ Khách', role: 'Tiên Phong', color: '#ffd24a', weapon: 'greatsword',
  weight: 1.45, speed: 0.96, radius: 21,
  passive: { name: 'Điểm Ngọt', desc: 'Trúng bằng mũi kiếm (25% ngoài cùng tầm đánh): lực văng x1.6 và choáng nhẹ. Trúng bằng phần cán (quá gần): lực văng giảm 40%. Kháng đẩy cao nhất.' },
  onDeal(w, f, t, h, info) {
    if (!h.sweet || h.dist == null) return;
    const rel = h.dist / h.range;
    if (rel > 0.72) {
      info.kbK *= 1.6;
      info.extra = () => { w.addStatus(t, 'stun', 0.2); w.text(t.x, t.y - 52, 'ĐIỂM NGỌT!', '#ffe680', 16); };
    } else if (rel < 0.35) info.kbK *= 0.6;
  },
  skills: {
    A: { name: 'Quét Ngang', cd: 0.95, desc: 'Gồng 0.25s rồi vung kiếm 180° phía trước — tầm xa, kiểm soát hai bên hông.', shape: { type: 'arc', range: 122, arc: 180 }, ai: { kind: 'atk', min: 50, max: 125 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.52, move: 0.3, anim: 'wide', ang: c.ang, ev: [arc(0.25, { range: 122, arc: 180, dmg: 8.4, kb: 112, kg: 5.2, sweet: true })] }); } },
    B: { name: 'Bổ Dọc', cd: 1.6, desc: 'Kết liễu: đập kiếm xuống theo đường thẳng — tầm xa nhất game.', shape: { type: 'line', len: 178, w: 34 }, ai: { kind: 'fin', min: 80, max: 175 },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.62, move: 0.1, anim: 'slam', ang: c.ang, ev: [line(0.36, { len: 178, w: 34, dmg: 12, kb: 200, kg: 8, sweet: true }), fx(0.36, 'crack', { r: 170 })] }); } },
    C: { name: 'Thế Thủ Tụ Lực', cd: 6.5, hold: 2, chargeMove: 0.3, desc: 'Giữ: gồng tối đa 2s với THÂN THÉP — giảm 55% điểm văng & lực đẩy, không bị khống chế. Thả: chém phản đòn, càng gồng lâu càng mạnh.', shape: { type: 'arc', range: 116, arc: 160 }, ai: { kind: 'def' },
      onChargeStart(w, f) { w.addStatus(f, 'armor', 2.6, 0.45); f.st.armor.unstop = 1; },
      cast(w, f, c) {
        delete f.st.armor;
        const p = c.p;
        w.act(f, 'C', { dur: 0.36, move: 0.2, anim: 'wide', ang: c.ang, ev: [arc(0.08, { range: 116, arc: 160, dmg: 6 + 6 * p, kb: 120 + 160 * p, kg: 4 + 4 * p, sweet: true })] });
      } },
    D: { name: 'Cán Kiếm', cd: 3.5, desc: 'Húc cán kiếm tầm cực gần: đẩy địch ra đúng tầm Điểm Ngọt và choáng ngắn.', shape: { type: 'arc', range: 60, arc: 110 }, ai: { kind: 'atk', max: 62 },
      cast(w, f, c) { w.act(f, 'D', { dur: 0.3, move: 0.3, anim: 'thrust', ang: c.ang, ev: [arc(0.08, { range: 60, arc: 110, dmg: 3, fixedKb: 390, stun: 0.25 })] }); } },
    U: { name: 'Khai Thiên Lập Địa', desc: 'Nhảy lên cao rồi cắm kiếm xuống tạo chấn động lớn: càng gần tâm càng văng xa, hất tung.', shape: { type: 'circle', r: 330, self: true }, ai: { kind: 'ult', max: 260 },
      cast(w, f, c) {
        f.vz = 620; f.z = 1; f.invuln = 0.8;
        w.act(f, 'U', { dur: 1.0, anim: 'leap', ang: c.ang, ev: [custom(0.82, 'quake')] });
      } },
  },
  ev: {
    quake(w, f) {
      f.z = 0; f.vz = 0;
      for (const t of w.targets(f)) {
        const d = Math.hypot(t.x - f.x, t.y - f.y);
        if (d > 330 + t.r || t.z > 30) continue;
        const k = 1 - clamp(d / 330, 0, 1);
        w.applyHit(f, t, { src: f, dmg: 7 + 8 * k, kb: 150 + 150 * k, kg: 5 + 5 * k, knockup: 260 + 300 * k });
      }
      w.ev('fx', { kind: 'quake', x: f.x, y: f.y, r: 330, color: '#ffd24a', life: 0.6 });
      w.ev('shake', { p: 20 }); w.ev('sfx', { name: 'boom', v: 1 });
    },
  },
};

// =====================================================================
function ryoCombo(w, f, k) {
  const now = w.s.t;
  if (f.ws.chain && f.ws.chain !== k && now - f.ws.chainT < 1.5 && f.ws.hit) {
    f.ws.chain = 0; f.ws.hit = 0; f.ws.ki = 1; f.rage = Math.min(100, f.rage + 5);
    w.text(f.x, f.y - 56, 'COMBO!', '#ff9ab0', 15);
  } else { f.ws.chain = k; f.ws.chainT = now; }
}
const ryoma = {
  name: 'Ryoma', title: 'Kiếm Khách Phương Đông', role: 'Kiếm Sĩ', color: '#ff5a7a', weapon: 'katana',
  weight: 1.0, speed: 1.12, radius: 18,
  passive: { name: 'Liên Hoàn', desc: 'Đánh trúng rồi nối hai chiêu KHÁC NHAU trong A/B/C (trong 1.5s) tạo Combo: nạp Kiếm Khí cho chiêu D (giữ tối đa 1) và +5 Nộ.' },
  init(f) { f.ws.ki = 0; f.ws.hit = 0; },
  afterDeal(w, f) { f.ws.hit = 1; },
  skills: {
    A: { name: 'Nhất Đao', cd: 0.8, desc: 'Chém vòng cung nhanh.', shape: { type: 'arc', range: 92, arc: 120 }, ai: { kind: 'atk', max: 98 },
      cast(w, f, c) { ryoCombo(w, f, 'A'); w.act(f, 'A', { dur: 0.3, move: 0.35, ang: c.ang, ev: [arc(0.1, { range: 88, arc: 115, dmg: 5.4, kb: 86, kg: 3.8 })] }); } },
    B: { name: 'Đột Thích', cd: 2.1, desc: 'Kết liễu: lướt nhẹ và đâm thẳng, đẩy văng mạnh.', shape: { type: 'line', len: 140, w: 34 }, ai: { kind: 'fin', min: 30, max: 160 },
      cast(w, f, c) { ryoCombo(w, f, 'B'); w.act(f, 'B', { dur: 0.36, move: 0, anim: 'thrust', ang: c.ang, ev: [dash(0, { dist: 45, dur: 0.1 }), line(0.14, { len: 135, w: 32, dmg: 7.6, kb: 155, kg: 6.1 })] }); } },
    C: { name: 'Thuấn Bộ', cd: 2.6, desc: 'Lướt nhanh 170px về hướng ngắm, né đòn khi lướt, chém nhẹ kẻ bị lướt qua.', shape: { type: 'dash', len: 170 }, ai: { kind: 'mob' },
      cast(w, f, c) { ryoCombo(w, f, 'C'); w.act(f, 'C', { dur: 0.18, ang: c.ang, anim: 'dash', ev: [dash(0, { dist: 170, dur: 0.14, invuln: true, through: true, hit: { dmg: 2.5, kb: 60, kg: 1.5 } })] }); } },
    D: { name: 'Kiếm Khí', cd: 1.5, desc: 'Cần Kiếm Khí (từ Combo): chém ra luồng kiếm khí xuyên thấu, PHÁ ĐẠN đối thủ.', shape: { type: 'proj', len: 440, w: 28 }, ai: { kind: 'poke', max: 420 },
      can(f) { return f.ws.ki > 0; },
      cast(w, f, c) {
        f.ws.ki--;
        w.act(f, 'D', { dur: 0.25, move: 0.3, ang: c.ang, ev: [proj(0.06, { speed: 780, range: 440, r: 14, kind: 'wave', pierce: true, breaks: true, hit: { dmg: 5, kb: 110, kg: 4 } })] });
      } },
    U: { name: 'Vô Ảnh Trảm', desc: 'Dịch chuyển chém quanh đối thủ (trong 450px) 5 lần rồi tung nhát kết liễu đẩy văng ra phía mép sàn.', shape: { type: 'circle', r: 450, self: true }, ai: { kind: 'ult', max: 420 },
      can(f, w) { const t = w.foe(f); return t && w.alive(t) && Math.hypot(t.x - f.x, t.y - f.y) < 450; },
      cast(w, f, c) {
        const t = w.foe(f);
        f.invuln = 1.15;
        const ev = [];
        for (let i = 0; i < 5; i++) ev.push(custom(0.08 + i * 0.14, 'phantom', { i }));
        ev.push(custom(0.92, 'finish'));
        w.act(f, 'U', { dur: 1.12, anim: 'dash', ang: c.ang, armor: true, tg: t.id, ev });
      } },
  },
  ev: {
    phantom(w, f, a, e) {
      const t = w.fighter(a.tg);
      if (!t || !w.alive(t)) return;
      const ang = e.i * 2.4 + 0.6, R = t.r + f.r + 26;
      f.x = t.x + Math.cos(ang) * R; f.y = t.y + Math.sin(ang) * R;
      a.ang = f.facing = Math.atan2(t.y - f.y, t.x - f.x);
      w.applyHit(f, t, { src: f, dmg: 3, noKnock: true, stun: 0.35, hitstun: 0.2 });
      w.ev('fx', { kind: 'slash', x: t.x, y: t.y, a: a.ang, r: 60, color: '#ff9ab0', life: 0.2 });
    },
    finish(w, f, a) {
      const t = w.fighter(a.tg);
      if (!t || !w.alive(t)) return;
      const out = Math.hypot(t.x, t.y) > 1 ? Math.atan2(t.y, t.x) : a.ang;
      f.x = t.x - Math.cos(out) * (t.r + f.r + 20); f.y = t.y - Math.sin(out) * (t.r + f.r + 20);
      clampInside(w.A, f, f.r);
      a.ang = f.facing = out;
      w.applyHit(f, t, { src: f, angle: out, dmg: 10, kb: 260, kg: 9 });
      w.ev('fx', { kind: 'bigslash', x: t.x, y: t.y, a: out, r: 120, color: '#ff5a7a', life: 0.4 });
      w.ev('shake', { p: 12 });
    },
  },
};

// =====================================================================
const vesper = {
  name: 'Vesper', title: 'Sát Thủ Đào Tẩu', role: 'Sát Thủ', color: '#b07aff', weapon: 'dagger',
  weight: 1.0, speed: 1.22, radius: 17,
  passive: { name: 'Đâm Sau Lưng', desc: 'Đòn đánh từ phía sau lưng đối thủ gây gấp đôi điểm văng, +50% lực văng và CÂM LẶNG 1s.' },
  onDeal(w, f, t, h, info) {
    if (h.proj && h.proj !== 'knife') return;
    if (f.ws.assT > w.s.t && !h.proj) { info.dmgK *= 3; f.ws.assT = 0; w.text(t.x, t.y - 64, 'ÁM SÁT!', '#e0b0ff', 20); }
    if (!h.proj && behind(t, f)) {
      info.dmgK *= 2; info.kbK *= 1.5;
      info.extra = () => { w.addStatus(t, 'silence', 1); w.text(t.x, t.y - 50, 'SAU LƯNG!', '#c58bff', 16); };
    }
  },
  onStatusEnd(w, f, k) { if (k === 'invis') { f.cd.C = 6 * 0.85; delete f.st.haste; } },
  onProjHit(w, f, p, t) { if (p.kind === 'knife' || p.kind === 'knifeU') f.ws.mark = { tid: t.id, until: w.s.t + (p.kind === 'knifeU' ? 3 : 2) }; if (p.kind === 'knifeU') f.ws.assT = w.s.t + 4; },
  skills: {
    A: { name: 'Chém Nhanh', cd: 0.45, desc: 'Chém vòng cung ngắn, cực nhanh.', shape: { type: 'arc', range: 72, arc: 110 }, ai: { kind: 'atk', max: 76 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.22, move: 0.5, ang: c.ang, ev: [arc(0.06, { range: 72, arc: 110, dmg: 5, kb: 80, kg: 3.6 })] }); } },
    B: { name: 'Xuyên Tâm', cd: 2, desc: 'Kết liễu: lao xuyên 170px, chém văng cực mạnh kẻ bị lướt qua (từ sau lưng còn mạnh hơn).', shape: { type: 'dash', len: 170 }, ai: { kind: 'fin', max: 150 },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.24, ang: c.ang, anim: 'dash', ev: [dash(0, { dist: 170, dur: 0.16, through: true, hit: { dmg: 9, kb: 190, kg: 7.5 } })] }); } },
    C: { name: 'Ẩn Thân', manualCd: true, cd: 6, desc: 'Tàng hình và +50% tốc chạy trong 2.2s hoặc tới khi đánh trúng. Hồi chiêu khi kết thúc.', shape: { type: 'self' }, ai: { kind: 'mob' },
      can(f) { return !f.st.invis; },
      cast(w, f) { w.addStatus(f, 'invis', 2.2); w.addStatus(f, 'haste', 2.2, 0.5); f.cd.C = 99; w.ev('fx', { kind: 'smoke', x: f.x, y: f.y, r: 50, color: '#6a5a8a', life: 0.5 }); } },
    D: { name: 'Phi Dao Ảnh Bộ', cd: 3, desc: 'Ném dao gây CÂM LẶNG 1s. Trúng thì bấm lại trong 2s để dịch chuyển ra sau lưng đối thủ.', shape: { type: 'proj', len: 480, w: 14 }, ai: { kind: 'poke', max: 460 },
      recast(f, w) { const m = f.ws.mark; return !!(m && m.until > w.s.t && w.alive(w.fighter(m.tid) || {})); },
      recastUse(w, f) {
        const t = w.fighter(f.ws.mark.tid); f.ws.mark = null;
        const R = t.r + f.r + 6;
        teleport(w, f, t.x - Math.cos(t.facing) * R, t.y - Math.sin(t.facing) * R);
        f.facing = Math.atan2(t.y - f.y, t.x - f.x);
        w.act(f, 'D', { dur: 0.1, ang: f.facing, anim: 'none' });
      },
      cast(w, f, c) { w.act(f, 'D', { dur: 0.22, move: 0.4, ang: c.ang, ev: [proj(0.06, { speed: 950, range: 480, r: 7, kind: 'knife', hit: { dmg: 4, kb: 60, kg: 2, silence: 1 } })] }); } },
    U: { name: 'Bão Phi Đao', desc: 'Ném 10 con dao ra xung quanh. Trúng: có thể dịch chuyển ra sau lưng (D), đòn cận chiến kế tiếp trong 4s gây gấp 3 điểm văng.', shape: { type: 'circle', r: 420, self: true }, ai: { kind: 'ult', max: 380 },
      cast(w, f, c) {
        const ev = [];
        for (let i = 0; i < 10; i++) ev.push(proj(0.05, { ang: c.ang + (i * TAU) / 10, speed: 800, range: 420, r: 8, kind: 'knifeU', hit: { dmg: 4, kb: 90, kg: 3 } }));
        w.act(f, 'U', { dur: 0.3, anim: 'spin', ang: c.ang, ev });
      } },
  },
};

// =====================================================================
const ignatius = {
  name: 'Ignatius', title: 'Pháp Sư Hỏa Ấn', role: 'Pháp Sư', color: '#ff7a3a', weapon: 'staff',
  weight: 0.97, speed: 1.1, radius: 17,
  passive: { name: 'Hỏa Ấn', desc: 'Mọi đòn đánh gây Thiêu Đốt 3s: tăng điểm văng theo thời gian, cộng dồn 3 lần. Có thể vừa đi vừa ném cầu lửa.' },
  onDeal(w, f, t, h, info) { if (!h.noBurn) info.extra = () => w.addStatus(t, 'burn', 3, 0.9); },
  skills: {
    A: { name: 'Cầu Lửa', cd: 0.95, desc: 'Ném cầu lửa nổ lan — cấu rỉa và đốt điểm văng. Vừa đi vừa ném.', shape: { type: 'proj', len: 520, w: 18 }, ai: { kind: 'poke', min: 90, max: 500 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.3, move: 0.8, lock: false, anim: 'cast', ang: c.ang, ev: [proj(0.08, { speed: 740, range: 560, r: 11, kind: 'fireball', endBoom: true, explode: { r: 50, dmg: 6.4, kb: 95, kg: 3.8 } })] }); } },
    B: { name: 'Đại Hỏa Cầu', cd: 3.4, hold: 1.6, chargeMove: 0.5, desc: 'Kết liễu: giữ để tích quả cầu lửa lớn (tối đa 1.6s), thả ra bay đi và nổ rất to.', shape: { type: 'proj', len: 560, w: 30 }, ai: { kind: 'fin', min: 120, max: 520 },
      cast(w, f, c) {
        const p = c.p;
        w.act(f, 'B', { dur: 0.3, move: 0.3, anim: 'cast', ang: c.ang, ev: [proj(0.05, { speed: 620 + 260 * p, range: 600, r: 12 + 12 * p, kind: 'bigfire', endBoom: true, explode: { r: 60 + 50 * p, dmg: 7 + 8 * p, kb: 135 + 120 * p, kg: 5.5 + 4.5 * p } })] });
      } },
    C: { name: 'Dịch Chuyển', cd: 3.2, maxRange: 210, desc: 'Dịch chuyển tức thời tới điểm ngắm (tối đa 210px); điểm đến nổ đẩy lùi kẻ địch và tăng tốc 1s.', shape: { type: 'point', range: 210, r: 70 }, ai: { kind: 'mob' },
      cast(w, f, c) {
        let d = Math.hypot(c.ax - f.x, c.ay - f.y);
        if (d < 60) d = 210;
        teleport(w, f, f.x + Math.cos(c.ang) * Math.min(210, d), f.y + Math.sin(c.ang) * Math.min(210, d));
        w.addStatus(f, 'haste', 1, 0.3);
        w.act(f, 'C', { dur: 0.15, anim: 'cast', ang: c.ang, ev: [circle(0.02, { r: 70, dmg: 4, kb: 160, kg: 2, fxKind: 'boom' })] });
      } },
    D: { name: 'Vòng Lửa', cd: 3, desc: 'Bùng vòng lửa quanh người, đẩy kẻ áp sát ra xa.', shape: { type: 'circle', r: 95, self: true }, ai: { kind: 'def', max: 100 },
      cast(w, f, c) { w.act(f, 'D', { dur: 0.25, move: 0.2, anim: 'cast', ang: c.ang, ev: [circle(0.05, { r: 95, dmg: 5, kb: 230, kg: 3, fxKind: 'firering' })] }); } },
    U: { name: 'Thiên Thạch', maxRange: 650, desc: 'Gọi thiên thạch rơi vào điểm ngắm sau 0.9s: nổ cực to, hất tung, để lại vùng lửa 4s.', shape: { type: 'point', range: 650, r: 140 }, ai: { kind: 'ult', max: 600 },
      cast(w, f, c) {
        w.zone(f, { x: c.ax, y: c.ay, r: 140, delay: 0.9, dur: 4, kind: 'meteor', tick: 0.5, hit: { dmg: 1.2, noKnock: true }, boom: { dmg: 16, kb: 280, kg: 10, knockup: 450 } });
        w.act(f, 'U', { dur: 0.5, anim: 'cast', ang: c.ang });
      } },
  },
};

// =====================================================================
function focusUse(w, f) {
  const on = w.s.t - (f.ws.lastAtk ?? -99) >= 4;
  f.ws.lastAtk = w.s.t;
  return on;
}
const elara = {
  name: 'Elara', title: 'Cung Thủ Rừng Xanh', role: 'Xạ Thủ', color: '#7ad67a', weapon: 'bow',
  weight: 1.05, speed: 1.1, radius: 17,
  passive: { name: 'Tập Trung', desc: 'Sau 4s không bắn, phát bắn A/B/D kế tiếp được Tập Trung: +40% tầm, +25% lực văng, tên bay nhanh hơn.' },
  init(f) { f.ws.lastAtk = -99; },
  skills: {
    A: { name: 'Liên Xạ', cd: 0.9, desc: 'Bắn 3 mũi tên liên tiếp — cấu rỉa tích điểm văng.', shape: { type: 'proj', len: 560, w: 12 }, ai: { kind: 'poke', min: 120, max: 540 },
      cast(w, f, c) {
        const k = focusUse(w, f) ? 1 : 0;
        const o = { speed: 1150 + 300 * k, range: 580 * (1 + 0.4 * k), r: 7, kind: 'arrow', hit: { dmg: 3.2, kb: 62 * (1 + 0.25 * k), kg: 2.3 } };
        w.act(f, 'A', { dur: 0.32, move: 0.6, anim: 'bow', ang: c.ang, ev: [proj(0, o), proj(0.1, o), proj(0.2, o)] });
      } },
    B: { name: 'Kéo Căng Dây', cd: 4.5, hold: 1.5, chargeMove: 0.35, desc: 'Kết liễu: giữ để kéo dây (tối đa 1.5s) — càng lâu tên càng mạnh, nhanh; kéo đủ thì xuyên thấu.', shape: { type: 'proj', len: 800, w: 16 }, ai: { kind: 'fin', min: 100, max: 700 },
      cast(w, f, c) {
        const p = c.p, k = focusUse(w, f) ? 1 : 0;
        w.act(f, 'B', { dur: 0.25, anim: 'bow', ang: c.ang, ev: [proj(0.02, { speed: 1100 + 600 * p, range: (650 + 250 * p) * (1 + 0.4 * k), r: 6 + 4 * p, kind: 'bigarrow', pierce: p >= 1, hit: { dmg: 6 + 8 * p, kb: (150 + 130 * p) * (1 + 0.25 * k), kg: 5.5 + 5 * p } })] });
      } },
    C: { name: 'Sao Băng Lùi', cd: 5, desc: 'Nhảy lùi về sau và bắn 3 sao băng hình nón ra trước, làm chậm 45% trong 1.5s.', shape: { type: 'cone', len: 300, arc: 36 }, ai: { kind: 'mob' },
      cast(w, f, c) {
        f.vz = 330; f.z = 1;
        const o = { speed: 700, range: 300, r: 7, kind: 'star', hit: { dmg: 3, kb: 70, kg: 1, slow: [0.45, 1.5] } };
        w.act(f, 'C', { dur: 0.26, ang: c.ang, anim: 'bow', ev: [dash(0, { rot: Math.PI, dist: 160, dur: 0.22 }), proj(0.05, Object.assign({ rot: -deg(15) }, o)), proj(0.05, o), proj(0.05, Object.assign({ rot: deg(15) }, o))] });
      } },
    D: { name: 'Tên Hình Nón', cd: 4, desc: 'Bắn 3 mũi tên tỏa hình nón đẩy lùi kẻ áp sát.', shape: { type: 'cone', len: 260, arc: 30 }, ai: { kind: 'def', max: 200 },
      cast(w, f, c) {
        const k = focusUse(w, f) ? 1 : 0;
        const o = { speed: 1000, range: 260 * (1 + 0.4 * k), r: 6, kind: 'arrow', hit: { dmg: 4, kb: 170 * (1 + 0.25 * k), kg: 4 } };
        w.act(f, 'D', { dur: 0.25, move: 0.3, anim: 'bow', ang: c.ang, ev: [proj(0.04, Object.assign({ rot: -deg(12) }, o)), proj(0.04, o), proj(0.04, Object.assign({ rot: deg(12) }, o))] });
      } },
    U: { name: 'Thần Tiễn Phá Không', desc: 'Bắn mũi tên khổng lồ bám theo đối thủ, xuyên thấu, choáng 0.4s.', shape: { type: 'proj', len: 1400, w: 40 }, ai: { kind: 'ult' },
      cast(w, f, c) {
        const t = w.foe(f);
        w.act(f, 'U', { dur: 0.6, anim: 'bow', ang: c.ang, ev: [proj(0.35, { speed: 1500, range: 2400, r: 20, kind: 'godarrow', pierce: true, home: 1.6, tg: t ? t.id : 0, hit: { dmg: 15, kb: 260, kg: 9, stun: 0.4 } })] });
      } },
  },
};
// dash/proj dùng `rot` (lệch góc so với hướng chiêu) — xử lý trong World.exec

// =====================================================================
const zero = {
  name: 'Zero', title: 'Tay Súng Thành Phố', role: 'Xạ Thủ', color: '#9aa0a8', weapon: 'pistol',
  weight: 1.0, speed: 1.0, radius: 17,
  passive: { name: 'Băng Đạn', desc: 'Băng đạn 9 viên; hết đạn tự nạp 2.2s. Bắn trúng mục tiêu bị Khóa: +20% lực văng; 5 lần trúng cường hóa chiêu C.' },
  init(f) { f.ws.ammo = 9; f.ws.reload = 0; f.ws.exp = 0; f.ws.mh = 0; f.ws.emp = false; },
  update(w, f, dt) {
    if (f.ws.reload > 0) { f.ws.reload -= dt; if (f.ws.reload <= 0) { f.ws.reload = 0; f.ws.ammo = 9; } }
    else if (f.ws.ammo <= 0 && !(f.act && f.act.key === 'B')) f.ws.reload = 2.2;
  },
  onDeal(w, f, t, h, info) {
    if (h.proj !== 'bullet' && h.proj !== 'xbullet') return;
    if (t.st.marked && t.st.marked.p === f.id) {
      info.kbK *= 1.2;
      if (++f.ws.mh >= 5 && !f.ws.emp) { f.ws.emp = true; w.text(f.x, f.y - 56, 'C CƯỜNG HÓA!', '#d0d8e0', 14); }
    }
  },
  skills: {
    A: { name: 'Phát Bắn', cd: 0.28, desc: 'Bắn 1 viên đạn nhanh (giữ để bắn liên tục). Tốn 1 đạn.', shape: { type: 'proj', len: 620, w: 10 }, ai: { kind: 'poke', min: 60, max: 600 },
      can(f) { return f.ws.ammo > 0 && f.ws.reload <= 0; },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.18, move: 0.75, anim: 'shoot', ang: c.ang, ev: [custom(0.02, 'shot', { dmg: 3.6, kb: 70, kg: 2.6 })] }); } },
    B: { name: 'Xả Băng', cd: 1, desc: 'Kết liễu: xả toàn bộ đạn còn lại cực nhanh.', shape: { type: 'cone', len: 600, arc: 10 }, ai: { kind: 'fin', min: 60, max: 420 },
      can(f) { return f.ws.ammo > 0 && f.ws.reload <= 0; },
      cast(w, f, c) {
        const n = f.ws.ammo, ev = [];
        for (let i = 0; i < n; i++) ev.push(custom(0.02 + i * 0.06, 'shot', { dmg: 2.8, kb: 60, kg: 2.4, spread: ((i % 3) - 1) * 0.05 }));
        w.act(f, 'B', { dur: 0.08 + n * 0.06, move: 0.3, anim: 'shoot', ang: c.ang, ev });
      } },
    C: { name: 'Nhảy Lùi', cd: 4, desc: 'Nhảy lùi, Thiết Thân 1s (giảm 50% lực đẩy, không bị khống chế). Cường hóa: lướt xa tức thì và nạp đầy đạn.', shape: { type: 'dash', len: 150, back: true }, ai: { kind: 'mob' },
      cast(w, f, c) {
        if (f.ws.emp) {
          f.ws.emp = false; f.ws.mh = 0; f.ws.ammo = 9; f.ws.reload = 0;
          w.act(f, 'C', { dur: 0.16, ang: c.ang, anim: 'dash', ev: [dash(0, { rot: Math.PI, dist: 260, dur: 0.12, invuln: true })] });
          w.text(f.x, f.y - 50, 'NẠP ĐẦY!', '#d0d8e0', 14);
        } else {
          w.addStatus(f, 'armor', 1, 0.5); f.st.armor.unstop = 1; w.addStatus(f, 'haste', 1, 0.3);
          w.act(f, 'C', { dur: 0.22, ang: c.ang, anim: 'dash', ev: [dash(0, { rot: Math.PI, dist: 150, dur: 0.2 })] });
        }
      } },
    D: { name: 'Khóa Mục Tiêu', cd: 6, desc: 'Đánh dấu đối thủ trong 750px (không bị cột che) 6s: đạn trúng +20% lực văng, 5 lần trúng cường hóa C.', shape: { type: 'circle', r: 750, self: true }, ai: { kind: 'buff', max: 700 },
      can(f, w) { const t = w.foe(f); return !!t && w.alive(t) && Math.hypot(t.x - f.x, t.y - f.y) < 750 && !blockedBy(w.A, f.x, f.y, t.x, t.y, 2); },
      cast(w, f) {
        const t = w.foe(f);
        w.addStatus(t, 'marked', 6, f.id); f.ws.mh = 0;
        w.text(t.x, t.y - 56, '🎯 KHÓA!', '#ff6a6a', 16);
        w.act(f, 'D', { dur: 0.15, anim: 'shoot', ang: Math.atan2(t.y - f.y, t.x - f.x) });
      } },
    U: { name: 'Băng Đạn Nổ', desc: 'Nạp ngay 9 viên đạn nổ: mỗi viên mạnh hơn và phát nổ khi trúng.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { f.ws.ammo = 9; f.ws.reload = 0; f.ws.exp = 9; w.text(f.x, f.y - 56, 'ĐẠN NỔ!', '#ffb060', 18); w.act(f, 'U', { dur: 0.3, anim: 'roar' }); } },
  },
  ev: {
    shot(w, f, a, e) {
      if (f.ws.ammo <= 0) return;
      f.ws.ammo--;
      const ang = a.ang + (e.spread || 0);
      if (f.ws.exp > 0) {
        f.ws.exp--;
        w.proj(f, ang, { speed: 1200, range: 620, r: 6, kind: 'xbullet', color: '#ffb060', endBoom: false, explode: { r: 42, dmg: 5, kb: 120, kg: 4 } });
      } else w.proj(f, ang, { speed: 1400, range: 640, r: 5, kind: 'bullet', color: '#e8eef4', hit: { dmg: e.dmg, kb: e.kb, kg: e.kg } });
      w.ev('sfx', { name: 'gun' });
    },
  },
};

// =====================================================================
const borg = {
  name: 'Borg', title: 'Đấu Sĩ Cống Ngầm', role: 'Đấu Sĩ', color: '#ff7a4a', weapon: 'fists',
  weight: 1.4, speed: 1.07, radius: 21, taken: 0.9,
  passive: { name: 'Hăng Máu', desc: 'Da dày: nhận ít hơn 10% điểm văng. Điểm văng của bản thân càng cao đánh càng đau: +0.3% sát thương mỗi 1% điểm văng (tối đa +45%).' },
  onDeal(w, f, t, h, info) { info.dmgK *= 1 + Math.min(0.45, f.percent * 0.003); },
  onTake(w, f, att, h) { if (f.act && f.act.key === 'C' && f.st.armor) f.ws.abs = (f.ws.abs || 0) + (h.dmg || 0) * 0.75 * 0.7; },
  onCancel(w, f, a) { if (a && a.key === 'D') borg.ev.release(w, f); },
  update(w, f, dt, inp) {
    const g = f.ws.grab;
    if (!g) return;
    const t = w.fighter(g.tid);
    if (!t || !w.alive(t) || !f.act || f.act.key !== 'D') { borg.ev.release(w, f); return; }
    if (inp.aim) f.act.ang = Math.atan2(inp.ay - f.y, inp.ax - f.x);
    else if (inp.mx || inp.my) f.act.ang = Math.atan2(inp.my, inp.mx);
    f.facing = f.act.ang;
    const R = f.r + t.r - 4;
    t.x = f.x + Math.cos(f.act.ang) * R; t.y = f.y + Math.sin(f.act.ang) * R; t.vx = t.vy = 0;
  },
  skills: {
    A: { name: 'Đấm Liên Hoàn', cd: 0.5, desc: 'Hai cú đấm liên tiếp, cú thứ hai đẩy mạnh hơn.', shape: { type: 'arc', range: 74, arc: 110 }, ai: { kind: 'atk', max: 74 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.42, move: 0.4, anim: 'punch', ang: c.ang, ev: [arc(0.08, { range: 72, arc: 110, dmg: 5.6, kb: 85, kg: 3.4 }), arc(0.24, { range: 76, arc: 110, dmg: 6.2, kb: 145, kg: 5.2 })] }); } },
    B: { name: 'Đấm Móc', cd: 2.4, hold: 0.8, chargeMove: 0.5, desc: 'Kết liễu / áp sát: giữ để tụ lực (tối đa 0.8s), thả ra lao tới 90–240px và móc hàm hất tung.', shape: { type: 'dash', len: 240 }, ai: { kind: 'fin', max: 230 },
      cast(w, f, c) {
        const p = c.p;
        w.act(f, 'B', { dur: 0.3, anim: 'uppercut', ang: c.ang, ev: [dash(0, { dist: 90 + 150 * p, dur: 0.16, stopOnHit: true, hit: { dmg: 9 + 7 * p, kb: 175 + 110 * p, kg: 7 + 3 * p, knockup: 300 + 250 * p } })] });
      } },
    C: { name: 'Gồng', cd: 7, desc: 'Gồng 1.2s: nhận ít 70% điểm văng, không bị đẩy/khống chế, tích lực từ đòn nhận vào. Kết thúc bằng cú Trả Đòn quanh người.', shape: { type: 'circle', r: 85, self: true }, ai: { kind: 'def' },
      cast(w, f, c) {
        f.ws.abs = 0;
        w.addStatus(f, 'armor', 1.2, 0.3); f.st.armor.unstop = 1;
        w.act(f, 'C', { dur: 1.3, move: 0.35, anim: 'guard', ang: c.ang, ev: [custom(1.2, 'payback')] });
      } },
    D: { name: 'Túm Ném', cd: 5, desc: 'Túm đối thủ phía trước; hướng ngắm/di chuyển để chọn hướng ném, ném văng mạnh sau 0.5s.', shape: { type: 'arc', range: 80, arc: 140 }, ai: { kind: 'atk', max: 70 },
      cast(w, f, c) { w.act(f, 'D', { dur: 0.3, move: 0.2, anim: 'grab', ang: c.ang, ev: [custom(0.1, 'grab')] }); } },
    U: { name: 'Lồng Đấu', desc: 'Dựng lồng dây bán kính 230 quanh mình 6s: đối thủ bên trong không thoát ra được (nảy dây +2%). Borg +30% sát thương.', shape: { type: 'circle', r: 230, self: true }, ai: { kind: 'ult', max: 200 },
      cast(w, f) {
        const ins = w.targets(f).filter((t) => Math.hypot(t.x - f.x, t.y - f.y) < 230 - t.r).map((t) => t.id);
        w.zone(f, { x: f.x, y: f.y, r: 230, dur: 6, kind: 'cage', inside: ins });
        w.addStatus(f, 'empower', 6, 0.3);
        w.act(f, 'U', { dur: 0.4, anim: 'roar' });
        w.text(f.x, f.y - 60, 'LỒNG ĐẤU!', '#ff9a6a', 22);
      } },
  },
  ev: {
    payback(w, f, a) {
      delete f.st.armor;
      const s = f.ws.abs || 0; f.ws.abs = 0;
      w.hitCircle(f, f.x, f.y, { r: 85, dmg: 4 + s * 0.8, kb: 140 + s * 14, kg: 4, fxKind: 'boom' });
      if (s > 2) w.text(f.x, f.y - 56, 'TRẢ ĐÒN!', '#ffb08a', 16);
    },
    grab(w, f, a) {
      for (const t of w.targets(f)) {
        const d = Math.hypot(t.x - f.x, t.y - f.y);
        if (d > f.r + t.r + 50 || Math.abs(angDiff(a.ang, Math.atan2(t.y - f.y, t.x - f.x))) > deg(70)) continue;
        if (t.invuln > 0 || t.st.immortal || t.st.block) continue;
        w.addStatus(t, 'grabbed', 0.75);
        if (!t.st.grabbed) continue;
        f.ws.grab = { tid: t.id };
        a.dur = 0.62; a.ev.push(custom(0.58, 'throw')); a.armor = 1;
        w.text(t.x, t.y - 50, 'TÚM!', '#ffb08a', 16);
        return;
      }
    },
    throw(w, f, a) {
      const g = f.ws.grab; if (!g) return;
      const t = w.fighter(g.tid);
      borg.ev.release(w, f);
      if (t) w.applyHit(f, t, { src: f, angle: a.ang, dmg: 6, kb: 260, kg: 7.5, unblock: true });
      w.ev('shake', { p: 8 });
    },
    release(w, f) {
      const g = f.ws.grab; f.ws.grab = null;
      if (!g) return;
      const t = w.fighter(g.tid);
      if (t) delete t.st.grabbed;
    },
  },
};

import { BATCH1A } from './heroes2.js';
import { BATCH1B } from './heroes2b.js';
import { BATCH2, HEROES_REF } from './heroes3.js';
export const HEROES = { valerius, gideon, ryoma, vesper, ignatius, elara, zero, borg, ...BATCH1A, ...BATCH1B, ...BATCH2 };
HEROES_REF.h = HEROES;
export const HERO_IDS = Object.keys(HEROES);
for (const id of HERO_IDS) HEROES[id].id = id;
