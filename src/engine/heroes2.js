// ===== Đợt 1a: Theron, Florian, Aria, Koda, Death, Percy, Roxie, Alice, Wukong =====
import { TAU, clamp, angDiff, deg } from './math.js';
import { edgeDist, clampInside } from './arena.js';
import { arc, line, circle, proj, dash, custom, fx, teleport, behindPos, angOf, outAng, foeOf, gauge, now } from './kit.js';

// =====================================================================
const theron = {
  name: 'Theron', title: 'Thương Binh Đế Quốc', role: 'Đấu Sĩ', color: '#e0c070', weapon: 'spear', weight: 1.1, speed: 1.0, radius: 19,
  passive: { name: 'Xuyên Phá', desc: 'Mũi thương gây sát thương chuẩn: các đòn đâm (A, D) bỏ qua khiên chắn, giáp và giảm sát thương.' },
  update(w, f) {
    const c = f.ws.carry;
    if (c) {
      const t = w.fighter(c);
      if (!t || !w.alive(t) || !f.dash) { f.ws.carry = 0; return; }
      const a = Math.atan2(f.dash.vy, f.dash.vx), R = f.r + t.r + 2;
      t.x = f.x + Math.cos(a) * R; t.y = f.y + Math.sin(a) * R; t.vx = t.vy = 0;
      for (const p of w.A.pillars) if (Math.hypot(t.x - p.x, t.y - p.y) < p.r + t.r + 2) {
        f.ws.carry = 0; f.dash = null;
        w.applyHit(f, t, { dmg: 8, noKnock: true, stun: 1.5, unblock: true });
        w.text(t.x, t.y - 56, '📌 GHIM TƯỜNG!', '#ffe066', 20); w.ev('shake', { p: 14 });
        return;
      }
    }
    if (f.st.vault) { f.z = 70; f.vz = 0; }
  },
  onStatusEnd(w, f, k) { if (k === 'vault') theron.ev.slam(w, f); },
  skills: {
    A: { name: 'Liên Hoàn Đâm', cd: 1, desc: 'Đứng đâm liên tiếp 3 nhát về trước, tầm xa nhưng hẹp, xuyên mọi mục tiêu.', shape: { type: 'line', len: 135, w: 24 }, ai: { kind: 'atk', max: 130 },
      cast(w, f, c) { const o = { len: 135, w: 24, dmg: 2.8, kb: 55, kg: 2.2, unblock: true }; w.act(f, 'A', { dur: 0.46, move: 0.1, anim: 'thrust', ang: c.ang, ev: [line(0.08, o), line(0.2, o), line(0.32, Object.assign({}, o, { dmg: 3.4, kb: 105, kg: 4 }))] }); } },
    B: { name: 'Xung Phong', cd: 5, desc: 'Kết liễu: chạy đà đâm tới, ủi đối thủ theo. Ủi trúng cột: GHIM (choáng 1.5s). Không trúng cột: hất văng cuối đà.', shape: { type: 'dash', len: 280 }, ai: { kind: 'fin', max: 260 },
      cast(w, f, c) { f.ws.carry = 0; w.act(f, 'B', { dur: 0.46, anim: 'thrust', ang: c.ang, ev: [dash(0.04, { dist: 280, dur: 0.38, onHit: 'grab', onEnd: 'chargeEnd', hit: { dmg: 2, noKnock: true } })] }); } },
    C: { name: 'Chống Thương Nhảy', cd: 5, desc: 'Cắm thương bật lên cao 1.5s (né mọi đòn). Bấm C lần nữa (hoặc hết giờ): lao xuống dậm đất, làm chậm.', shape: { type: 'circle', r: 100, self: true }, ai: { kind: 'def' },
      recast(f) { return !!f.st.vault; }, recastBusy: true,
      recastUse(w, f) { delete f.st.vault; theron.ev.slam(w, f); },
      cast(w, f) { w.addStatus(f, 'vault', 1.5); f.invuln = 1.5; f.z = 70; } },
    D: { name: 'Quét Chân', cd: 3, desc: 'Quét thương tầm thấp 360°: kẻ trúng bị NGÃ (choáng 0.5s), ngắt chiêu.', shape: { type: 'circle', r: 100, self: true }, ai: { kind: 'atk', max: 95 },
      cast(w, f, c) { w.act(f, 'D', { dur: 0.3, anim: 'spin', ang: c.ang, ev: [circle(0.1, { r: 100, dmg: 4, kb: 60, kg: 1.5, stun: 0.5, unblock: true })] }); } },
    U: { name: 'Mưa Thương', desc: 'Hàng chục cây thương ánh sáng rơi quanh đối thủ trong 4s. Dính thương bị GHIM tại chỗ (trói chân).', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { w.ent(f, { kind: 'rain', dur: 4, tk: 0 }); w.act(f, 'U', { dur: 0.4, anim: 'roar' }); w.text(f.x, f.y - 60, 'MƯA THƯƠNG!', '#ffe680', 20); } },
  },
  ents: {
    rain: { update(w, e, dt) {
      e.tk -= dt; if (e.tk > 0) return; e.tk = 0.28;
      const o = w.fighter(e.owner), t = o && foeOf(w, o); if (!t) return;
      const a = w.rand(0, TAU), d = w.rand(0, 120);
      w.zone(o, { x: t.x + Math.cos(a) * d + t.mvx * 0.4, y: t.y + Math.sin(a) * d + t.mvy * 0.4, r: 42, delay: 0.5, dur: 0.05, kind: 'spear', boom: { dmg: 3.5, kb: 70, kg: 2, root: 0.8 } });
    } },
  },
  ev: {
    grab(w, f, a, d, t) { if (!f.ws.carry && t) f.ws.carry = t.id; },
    chargeEnd(w, f, a) {
      const t = f.ws.carry && w.fighter(f.ws.carry); f.ws.carry = 0;
      if (t && w.alive(t)) w.applyHit(f, t, { src: f, angle: f.facing, dmg: 8, kb: 205, kg: 7.6, unblock: true });
    },
    slam(w, f) {
      f.z = 0; f.vz = 0; f.invuln = 0;
      w.hitCircle(f, f.x, f.y, { r: 100, dmg: 5, kb: 150, kg: 4, slow: [0.4, 1.5], fxKind: 'quake' });
      w.ev('shake', { p: 6 });
    },
  },
};

// =====================================================================
function florianMarkHit(w, f, t) {
  const m = t.st.marks4; if (!m) return;
  const idx = ((Math.round(angOf(t, f) / (Math.PI / 2)) % 4) + 4) % 4;
  if (!(m.p & (1 << idx))) return;
  m.p &= ~(1 << idx); m.n = (m.n || 0) + 1;
  for (const k of ['A', 'B', 'C', 'D']) f.cd[k] = Math.max(0, f.cd[k] - 1.5);
  w.addStatus(t, 'slow', 1.2, 0.5);
  w.ev('fx', { kind: 'spark', x: t.x, y: t.y, r: 30, color: '#ffffff', life: 0.25 });
  if (m.n >= 3) {
    delete t.st.marks4;
    w.addStatus(t, 'stun', 1); f.ws.power = 1; f.percent = Math.max(0, f.percent - 5);
    w.text(t.x, t.y - 60, 'PHÁ ẤN!', '#ffffff', 20);
  }
}
const florian = {
  name: 'Florian', title: 'Kiếm Sĩ Rapier', role: 'Đấu Sư', color: '#e0e0ff', weapon: 'rapier', weight: 0.95, speed: 1.12, radius: 17,
  passive: { name: 'Lướt & Tứ Ấn', desc: 'C là cú lướt ngắn né mọi sát thương. Đòn trúng từ đúng hướng một Ấn (Nộ) sẽ phá ấn: giảm 1.5s mọi hồi chiêu, làm chậm; phá 3/4 ấn: CHOÁNG 1s, đòn kế tiếp văng cực mạnh, Florian hồi 5% điểm văng.' },
  onDeal(w, f, t, h, info) {
    if (f.ws.power) { f.ws.power = 0; info.kbK *= 2.2; w.text(t.x, t.y - 50, 'TRỌNG KÍCH!', '#ffffff', 16); }
    florianMarkHit(w, f, t);
  },
  onTake(w, f, att, h, info) {
    if (!f.st.parry || !att || att === f) return;
    info.cancel = true; delete f.st.parry; f.ws.parried = 1;
    w.applyHit(f, att, { src: f, dmg: 6, kb: 130, kg: 3, stun: 1 });
    w.text(f.x, f.y - 56, 'PHẢN ĐÒN!', '#ffffff', 18);
  },
  onStatusEnd(w, f, k) { if (k === 'parry' && !f.ws.parried) f.cd.D *= 0.75; },
  skills: {
    A: { name: 'Đâm Lao', cd: 0.75, desc: 'Lao thẳng về trước; chạm địch thì dừng lại và đâm.', shape: { type: 'dash', len: 115 }, ai: { kind: 'atk', max: 120 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.22, anim: 'thrust', ang: c.ang, ev: [dash(0, { dist: 115, dur: 0.15, stopOnHit: true, hit: { dmg: 5.5, kb: 92, kg: 4 } })] }); } },
    B: { name: 'Phân Ảnh', cd: 1.6, desc: 'Kết liễu: phân ảnh xuất hiện đối diện, lao ngược về phía bạn — kéo đối thủ về phía bạn và đánh văng mạnh.', shape: { type: 'line', len: 230, w: 30 }, ai: { kind: 'fin', min: 60, max: 230 },
      cast(w, f, c) {
        const px = f.x + Math.cos(c.ang) * 230, py = f.y + Math.sin(c.ang) * 230;
        w.act(f, 'B', { dur: 0.3, anim: 'thrust', ang: c.ang, ev: [proj(0.08, { ang: c.ang + Math.PI, px, py, speed: 1000, range: 230, r: 14, kind: 'phantom', color: '#e0e0ff', wall: true, hit: { dmg: 8, kb: 170, kg: 7 } })] });
        w.ev('fx', { kind: 'blink', x: px, y: py, r: 26, color: '#e0e0ff', life: 0.3 });
      } },
    C: { name: 'Lướt', cd: 1.5, mob: true, desc: 'Lướt ngắn bất kỳ hướng nào, né mọi sát thương khi lướt.', shape: { type: 'dash', len: 120 }, ai: { kind: 'mob' },
      cast(w, f, c) { w.act(f, 'C', { dur: 0.14, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 120, dur: 0.12, invuln: true, through: true })] }); } },
    D: { name: 'Thế Thủ', cd: 6, desc: 'Vào thế thủ 1s, không nhận sát thương. Bị đánh: phản đòn CHOÁNG kẻ tấn công 1s. Không ai đánh: hoàn 25% hồi chiêu.', shape: { type: 'self' }, ai: { kind: 'def' },
      cast(w, f) { f.ws.parried = 0; w.addStatus(f, 'parry', 1); w.act(f, 'D', { dur: 0.5, move: 0.2, anim: 'block' }); } },
    U: { name: 'Kiếm Thế Tứ Ấn', desc: 'Đặt 4 ấn Đông-Tây-Nam-Bắc lên đối thủ 6s. Đánh trúng từ đúng hướng ấn để phá (chỉ cần 3/4).', shape: { type: 'self' }, ai: { kind: 'ult', max: 300 },
      can(f, w) { return !!foeOf(w, f); },
      cast(w, f) { const t = foeOf(w, f); w.addStatus(t, 'marks4', 6, 15); t.st.marks4.p = 15; t.st.marks4.n = 0; w.act(f, 'U', { dur: 0.3, anim: 'roar' }); w.text(t.x, t.y - 60, '✦ TỨ ẤN ✦', '#ffffff', 18); } },
  },
};

// =====================================================================
function ariaNote(w, f, k) {
  const n = f.ws.notes || (f.ws.notes = []);
  n.push(k);
  for (const x of ['A', 'B', 'C']) f.cd[x] = Math.max(f.cd[x], 2.1 * 0.85);
  if (n.length < 3) return false;
  const cnt = { A: 0, B: 0, C: 0 }; for (const x of n) cnt[x]++;
  f.ws.notes = []; f.ws.songs = (f.ws.songs || 0) + 1;
  w.text(f.x, f.y - 60, '♫ HÒA ÂM!', '#9affc0', 18);
  return cnt[k] >= 2 || (cnt.A === 1 && cnt.B === 1 && cnt.C === 1);
}
function okt(w, f) { return w.owned(f, 'okt')[0] || null; }
const aria = {
  name: 'Aria & Oktava', title: 'Ca Sĩ & Người Bảo Hộ', role: 'Hộ Vệ', color: '#7ae0a0', weapon: 'voice', weight: 0.88, speed: 1.0, radius: 17,
  passive: { name: 'Bóng Hình Âm Vang', desc: 'Đi cùng Người Bảo Hộ Oktava (bị đánh 6 lần thì gục, 15s sau quay lại). A, B, C dùng chung hồi chiêu; 3 nốt liên tiếp tạo Hòa Âm: nốt thứ ba được cường hóa.' },
  init(f) { f.ws.notes = []; f.ws.songs = 0; f.ws.oktT = 0.01; },
  update(w, f, dt) {
    if (!okt(w, f)) { f.ws.oktT -= dt; if (f.ws.oktT <= 0) { w.ent(f, { kind: 'okt', r: 26, dur: 0, hittable: true, hp: 6, x: f.x - 40, y: f.y, cd: 1, leap: 0 }); f.ws.oktT = 15; } }
    if (f.st.ride) { const o = okt(w, f); if (o) { o.x = f.x; o.y = f.y + 4; } else delete f.st.ride; }
  },
  onTake(w, f, att, h, info) {
    const o = okt(w, f);
    if (f.st.ride && o) { info.cancel = true; w.hitEnt(att, o, h); }
  },
  onKO(w, f) { delete f.st.ride; },
  skills: {
    A: { name: 'Nốt Đỏ — Tấn Công', cd: 2.1, manualCd: true, desc: 'Oktava nhảy dậm vào chỗ đối thủ; Aria tỏa sóng âm quanh mình. Hòa Âm: dậm to hơn, CHOÁNG.', shape: { type: 'circle', r: 80, self: true }, ai: { kind: 'atk', max: 300 },
      cast(w, f, c) {
        const big = ariaNote(w, f, 'A'), o = okt(w, f), t = foeOf(w, f);
        if (o && t) { o.leap = 0.35; o.tx = t.x; o.ty = t.y; o.big = big ? 1 : 0; }
        w.act(f, 'A', { dur: 0.3, move: 0.4, anim: 'cast', ang: c.ang, ev: [circle(0.08, { r: 80, dmg: 4, kb: 100, kg: 3, color: '#ff8a8a' })] });
      } },
    B: { name: 'Nốt Xanh — Linh Hoạt', cd: 2.1, manualCd: true, mob: true, desc: 'Tăng tốc, Aria né đòn 0.5s và giải hiệu ứng xấu. Hòa Âm: sóng âm MÊ HOẶC đối thủ 1.2s.', shape: { type: 'proj', len: 420, w: 40 }, ai: { kind: 'mob' },
      cast(w, f, c) {
        const big = ariaNote(w, f, 'B');
        w.addStatus(f, 'haste', 1.5, 0.35); f.invuln = Math.max(f.invuln, 0.5);
        for (const k of ['stun', 'slow', 'root', 'silence', 'burn', 'bleed', 'poison']) delete f.st[k];
        const ev = [];
        if (big) ev.push(proj(0.05, { speed: 650, range: 420, r: 20, kind: 'note', color: '#7ad6ff', pierce: true, hit: { dmg: 3, noKnock: true, charm: 1.2 } }));
        w.act(f, 'B', { dur: 0.2, move: 1, anim: 'cast', ang: c.ang, ev });
      } },
    C: { name: 'Nốt Vàng — Phòng Thủ', cd: 2.1, manualCd: true, desc: 'Oktava lao về phía Aria, choáng kẻ trên đường; Aria nhận khiên 8. Hòa Âm: Oktava dậm xuống chỗ Aria, đẩy lùi cực mạnh.', shape: { type: 'circle', r: 100, self: true }, ai: { kind: 'def' },
      cast(w, f) {
        const big = ariaNote(w, f, 'C'), o = okt(w, f);
        w.addStatus(f, 'shield', 4, big ? 14 : 8);
        if (o) {
          const ang = angOf(o, f), len = Math.hypot(f.x - o.x, f.y - o.y);
          w.hitLine(f, ang, { px: o.x, py: o.y, len, w: 50, dmg: 3, kb: 80, kg: 2, stun: 0.6 });
          o.x = f.x + 30; o.y = f.y;
          if (big) w.hitCircle(f, f.x, f.y, { r: 110, dmg: 6, kb: 260, kg: 6, fxKind: 'quake', color: '#ffe066' });
        }
        w.act(f, 'C', { dur: 0.25, anim: 'cast' });
      } },
    D: { name: 'Gắn Kết', cd: 12, desc: 'Cưỡi lên Oktava 5s: mọi đòn đánh vào Aria đều do Oktava gánh.', shape: { type: 'self' }, ai: { kind: 'def' },
      can(f, w) { return !!okt(w, f); },
      cast(w, f) { w.addStatus(f, 'ride', 5); w.act(f, 'D', { dur: 0.2, anim: 'roar' }); } },
    U: { name: 'Bản Giao Hưởng Tử Thần', desc: 'Sóng âm khổng lồ MÊ HOẶC 2s mọi kẻ trên đường. Chạm Oktava: Oktava Bất Tử và đòn dậm cường hóa 6s.', shape: { type: 'proj', len: 700, w: 60 }, ai: { kind: 'ult', max: 600 },
      cast(w, f, c) { const o = okt(w, f); if (o) o.rage = 6; w.act(f, 'U', { dur: 0.4, anim: 'cast', ang: c.ang, ev: [proj(0.1, { speed: 700, range: 700, r: 32, kind: 'note', color: '#ffd24a', pierce: true, hit: { dmg: 6, noKnock: true, charm: 2 } })] }); } },
  },
  ents: {
    okt: {
      update(w, e, dt) {
        const o = w.fighter(e.owner); if (!o) return;
        const t = foeOf(w, o);
        if (e.rage > 0) e.rage -= dt;
        if (e.leap > 0) {
          e.leap -= dt;
          if (e.leap <= 0) {
            e.x = e.tx; e.y = e.ty; clampInside(w.A, e, 10);
            const big = e.big || e.rage > 0;
            w.hitCircle(o, e.x, e.y, { r: big ? 115 : 80, dmg: big ? 7 : 5, kb: big ? 180 : 140, kg: 4.5, stun: big ? 0.6 : 0, fxKind: 'quake', color: '#7ae0a0' });
          }
          return;
        }
        // đi theo Aria, áp sát đối thủ khi gần
        let tx = o.x - 40, ty = o.y;
        if (t && Math.hypot(t.x - o.x, t.y - o.y) < 260) { tx = t.x; ty = t.y; }
        const d = Math.hypot(tx - e.x, ty - e.y);
        if (d > 50) { const sp = 160 * dt; e.x += (tx - e.x) / d * sp; e.y += (ty - e.y) / d * sp; e.fa = Math.atan2(ty - e.y, tx - e.x); }
        clampInside(w.A, e, 10);
        e.cd -= dt;
        if (t && e.cd <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 90) {
          e.cd = e.rage > 0 ? 0.8 : 1.6;
          w.hitCircle(o, e.x, e.y, { r: 80, dmg: e.rage > 0 ? 7 : 4.5, kb: e.rage > 0 ? 200 : 130, kg: 4, fxKind: 'quake', color: '#7ae0a0' });
        }
      },
      onHit(w, e, att, h) {
        if (e.rage > 0) return;
        e.hp -= 1; w.ev('hit', { x: e.x, y: e.y, dmg: 0, mag: 150, pct: 0, color: '#ffffff', blocked: false, tid: 0 });
        if (e.hp <= 0) { w.killEnt(e, att); w.text(e.x, e.y - 40, 'Oktava gục!', '#9affc0', 15); }
      },
    },
  },
};

// =====================================================================
function nearPillar(w, f, gap) { for (const p of w.A.pillars) if (Math.hypot(f.x - p.x, f.y - p.y) < p.r + f.r + gap) return p; return null; }
const koda = {
  name: 'Koda', title: 'Thú Vuốt Hoang Dã', role: 'Sát Thủ', color: '#c0563a', weapon: 'claws', weight: 0.88, speed: 1.22, radius: 16,
  passive: { name: 'Vết Thương Sâu', desc: 'Mỗi cú cào gây 1 tầng Chảy Máu (tự tăng điểm văng trong 3s), cộng dồn tối đa 5 tầng.' },
  update(w, f, dt) {
    if (f.st.cling) { f.invuln = Math.max(f.invuln, 0.05); const p = w.A.pillars[f.ws.pil]; if (p) { const a = f.ws.pa; f.x = p.x + Math.cos(a) * (p.r + f.r); f.y = p.y + Math.sin(a) * (p.r + f.r); } }
    if (f.st.feral) {
      f.ws.ft -= dt;
      const t = foeOf(w, f);
      if (t && f.ws.ft <= 0 && Math.hypot(t.x - f.x, t.y - f.y) < f.r + t.r + 6) { f.ws.ft = 0.35; w.applyHit(f, t, { dmg: 2, noKnock: true, bleed: 1 }); }
    }
  },
  onDeal(w, f, t, h, info) { if (f.ws.dive) { f.ws.dive = 0; info.dmgK *= 1.5; info.kbK *= 1.5; } },
  skills: {
    A: { name: 'Cào Loạn Xạ', cd: 0.8, desc: 'Cào liên tiếp 2 cái, mỗi cái 1 tầng Chảy Máu. Đang bám cột: lao xuống tấn công (x1.5).', shape: { type: 'arc', range: 66, arc: 120 }, ai: { kind: 'atk', max: 70 },
      cast(w, f, c) {
        if (f.st.cling) { koda.ev.drop(w, f); f.ws.dive = 1; w.act(f, 'A', { dur: 0.3, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 220, dur: 0.18, stopOnHit: true, hit: { dmg: 5, kb: 120, kg: 4, bleed: 1 } })] }); return; }
        w.act(f, 'A', { dur: 0.3, move: 0.5, anim: 'punch', ang: c.ang, ev: [arc(0.06, { range: 66, arc: 120, dmg: 3, kb: 45, kg: 2, bleed: 1 }), arc(0.18, { range: 70, arc: 120, dmg: 3.2, kb: 80, kg: 3, bleed: 1 })] });
      } },
    B: { name: 'Xé Toạc', cd: 3.5, desc: 'Kết liễu: kích nổ mọi tầng Chảy Máu trên đối thủ gần thành sát thương & lực văng lớn. Đủ 5 tầng: làm chậm 80% 2s.', shape: { type: 'arc', range: 80, arc: 120 }, ai: { kind: 'fin', max: 80 },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.32, anim: 'punch', ang: c.ang, ev: [custom(0.1, 'rip')] }); } },
    C: { name: 'Bám Cột', cd: 2, desc: 'Đứng sát cột: bám lên đó tối đa 3s (không bị đánh trúng). Từ trên cột dùng A/D lao xuống x1.5. Bấm C lần nữa để nhảy xuống.', shape: { type: 'self' }, ai: { kind: 'def' },
      recast(f) { return !!f.st.cling; }, recastBusy: true,
      recastUse(w, f) { koda.ev.drop(w, f); },
      can(f, w) { return !!nearPillar(w, f, 50); },
      cast(w, f) { const p = nearPillar(w, f, 50); f.ws.pil = w.A.pillars.indexOf(p); f.ws.pa = angOf(p, f); w.addStatus(f, 'cling', 3); } },
    D: { name: 'Vồ Mồi', cd: 2.5, mob: true, desc: 'Nhảy vồ tới trước: chạm địch thì đè xuống (trói chân 0.5s) và cào vào mặt. Chạm cột: bám luôn vào cột.', shape: { type: 'dash', len: 210 }, ai: { kind: 'atk', max: 200 },
      cast(w, f, c) {
        if (f.st.cling) { koda.ev.drop(w, f); f.ws.dive = 1; }
        w.act(f, 'D', { dur: 0.3, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 210, dur: 0.2, stopOnHit: true, onEnd: 'pounceEnd', hit: { dmg: 5, kb: 40, kg: 1, root: 0.5, bleed: 1 } })] });
      } },
    U: { name: 'Thú Tính', desc: 'Hóa bóng đen 5s: tốc chạy x2, đi xuyên đối thủ, mỗi lần chạm tự gây 1 tầng Chảy Máu.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { w.addStatus(f, 'feral', 5); w.addStatus(f, 'haste', 5, 1); f.ws.ft = 0; w.act(f, 'U', { dur: 0.3, anim: 'roar' }); } },
  },
  ev: {
    rip(w, f, a) {
      for (const t of w.targets(f)) {
        if (Math.hypot(t.x - f.x, t.y - f.y) > 80 + t.r || Math.abs(angDiff(a.ang, angOf(f, t))) > 1.1) continue;
        const n = t.st.bleed ? t.st.bleed.n : 0;
        delete t.st.bleed;
        w.applyHit(f, t, { src: f, dmg: 3 + 3 * n, kb: 110 + 24 * n, kg: 4 + 0.7 * n });
        if (n >= 5) { w.addStatus(t, 'slow', 2, 0.8); w.text(t.x, t.y - 56, 'ĐỨT GÂN!', '#ff6a5a', 18); }
      }
      w.ev('fx', { kind: 'slash', x: f.x + Math.cos(a.ang) * 40, y: f.y + Math.sin(a.ang) * 40, a: a.ang, r: 70, color: '#ff6a5a', life: 0.25 });
    },
    pounceEnd(w, f) { const p = nearPillar(w, f, 8); if (p && !f.st.cling) { f.ws.pil = w.A.pillars.indexOf(p); f.ws.pa = angOf(p, f); w.addStatus(f, 'cling', 3); } },
    drop(w, f) { delete f.st.cling; f.z = 0; f.invuln = 0; },
  },
};

// =====================================================================
function bladeHit(f, t, h) { return h.dist == null || !h.range || h.dist / h.range > 0.3; }
const death = {
  name: 'Death', title: 'Thần Chết Lữ Khách', role: 'Sát Thủ', color: '#8a7aa8', weapon: 'scythe', weight: 1.3, speed: 1.06, radius: 19,
  passive: { name: 'Lưỡi Hái Tử Thần', desc: 'Trúng bằng lưỡi (70% ngoài) mới đẩy mạnh; trúng bằng cán chỉ gây sát thương nhẹ. Mỗi đòn lưỡi trúng hồi 1% điểm văng.' },
  onDeal(w, f, t, h, info) {
    if (h.scythe) { if (bladeHit(f, t, h)) f.percent = Math.max(0, f.percent - 1); else { info.kbK *= 0.35; info.dmgK *= 0.6; } }
    if (h.judge) {
      if (t.percent > 100) { info.kbK *= edgeDist(w.A, t.x, t.y) < 130 ? 2.4 : 1.6; w.text(t.x, t.y - 60, '☠ PHÁN QUYẾT', '#c0a0ff', 18); }
    }
    if (h.reap && t.ws.pulledT > now(w)) info.extra = () => { if (!w.superArmor(t)) { t.vz = 420; t.z = Math.max(t.z, 1); } };
  },
  skills: {
    A: { name: 'Gặt', cd: 0.9, desc: 'Chém quét ngang diện rộng. Địch vừa bị kéo (D): hất tung lên trời.', shape: { type: 'arc', range: 118, arc: 150 }, ai: { kind: 'atk', max: 115 },
      cast(w, f, c) { w.act(f, 'A', { dur: 0.38, move: 0.3, anim: 'wide', ang: c.ang, ev: [arc(0.14, { range: 118, arc: 150, dmg: 6.4, kb: 100, kg: 4.4, scythe: true, reap: true }), custom(0.14, 'shades', { k: 'A' })] }); } },
    B: { name: 'Phán Quyết', cd: 4.5, desc: 'Kết liễu: bổ liềm thẳng xuống và phóng Cầu Hắc Ám. Đối thủ trên 100%: lực văng x1.6, gần mép sàn x2.4.', shape: { type: 'line', len: 135, w: 34 }, ai: { kind: 'fin', max: 380 },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.45, anim: 'slam', ang: c.ang, ev: [line(0.18, { len: 135, w: 34, dmg: 9, kb: 170, kg: 7, scythe: true, judge: true }), proj(0.2, { speed: 620, range: 420, r: 14, kind: 'darkorb', color: '#8a5ad0', hit: { dmg: 5, kb: 140, kg: 5.5, judge: true } }), custom(0.18, 'shades', { k: 'B' })] }); } },
    C: { name: 'Xoay Liềm', cd: 4.5, maxRange: 320, desc: 'Ném liềm xoay tại điểm ngắm 2s, hút kẻ địch quanh đó vào tâm. Bấm C lần nữa: dịch chuyển tới liềm và chém một vòng.', shape: { type: 'point', range: 320, r: 140 }, ai: { kind: 'atk', max: 300 },
      recast(f, w) { return w.owned(f, 'spin').length > 0; }, recastBusy: true,
      recastUse(w, f) { const e = w.owned(f, 'spin')[0]; teleport(w, f, e.x, e.y); e.dead = true; w.hitCircle(f, f.x, f.y, { r: 115, dmg: 6, kb: 160, kg: 5, fxKind: 'boom', color: '#8a7aa8' }); w.act(f, 'C', { dur: 0.2, anim: 'spin' }); },
      cast(w, f, c) { w.ent(f, { kind: 'spin', x: c.ax, y: c.ay, r: 24, dur: 2, tk: 0 }); w.act(f, 'C', { dur: 0.25, anim: 'cast', ang: c.ang }); } },
    D: { name: 'Lưỡi Hái Đoạt Mệnh', cd: 3, desc: 'Quăng liềm ra xa rồi giật về: kéo đối thủ theo vòng cung ra sau lưng / bên cạnh bạn.', shape: { type: 'proj', len: 320, w: 30 }, ai: { kind: 'atk', min: 90, max: 310 },
      cast(w, f, c) { w.act(f, 'D', { dur: 0.3, anim: 'cast', ang: c.ang, ev: [proj(0.06, { speed: 900, range: 320, r: 16, kind: 'scythe', color: '#b0a0d8', hit: { dmg: 4, noKnock: true } })] }); } },
    U: { name: 'Gọi Hồn', desc: 'Triệu hồi 2 cái bóng cầm liềm đứng đối xứng quanh đối thủ 6s, bắt chước mọi đòn A/B của bạn.', shape: { type: 'self' }, ai: { kind: 'ult', max: 400 },
      cast(w, f) {
        for (let i = 0; i < 2; i++) w.ent(f, { kind: 'shade', dur: 6, r: 18, i });
        w.act(f, 'U', { dur: 0.4, anim: 'roar' }); w.text(f.x, f.y - 60, 'GỌI HỒN!', '#c0a0ff', 20);
      } },
  },
  onProjHit(w, f, p, t) {
    if (p.kind !== 'scythe') return;
    const a = angOf(f, t) + Math.PI * 0.75, R = f.r + t.r + 12;
    t.x = f.x + Math.cos(a) * R; t.y = f.y + Math.sin(a) * R; clampInside(w.A, t, t.r);
    t.vx = t.vy = 0; w.addStatus(t, 'stun', 0.3); t.ws.pulledT = now(w) + 1.2;
    w.ev('fx', { kind: 'arc', x: f.x, y: f.y, a: angOf(f, t), r: 70, arc: 200, color: '#8a7aa8', life: 0.25 });
  },
  ents: {
    spin: { update(w, e, dt) {
      const o = w.fighter(e.owner);
      for (const t of w.targets(o)) { const d = Math.hypot(t.x - e.x, t.y - e.y); if (d < 140 && d > 10 && !w.superArmor(t)) { t.x += (e.x - t.x) / d * 70 * dt; t.y += (e.y - t.y) / d * 70 * dt; } }
      e.tk -= dt; if (e.tk <= 0) { e.tk = 0.4; for (const t of w.targets(o)) if (Math.hypot(t.x - e.x, t.y - e.y) < 70 + t.r) w.applyHit(o, t, { src: e, dmg: 1.4, noKnock: true }); }
    } },
    shade: { update(w, e) {
      const o = w.fighter(e.owner), t = o && foeOf(w, o); if (!t) return;
      const side = angOf(o, t) + (e.i ? 1.9 : -1.9);
      e.x = t.x + Math.cos(side) * 105; e.y = t.y + Math.sin(side) * 105; e.fa = angOf(e, t);
    } },
  },
  ev: {
    shades(w, f, a, e) {
      for (const s of w.owned(f, 'shade')) {
        const ang = s.fa;
        if (e.k === 'A') w.exec(f, { do: 'arc', px: s.x, py: s.y, range: 110, arc: 150, dmg: 3.5, kb: 80, kg: 3, ang }, a);
        else w.exec(f, { do: 'line', px: s.x, py: s.y, len: 130, w: 34, dmg: 5, kb: 130, kg: 5, ang }, a);
      }
    },
  },
};

// =====================================================================
const percy = {
  name: 'Percy', title: 'Thợ Săn Nỏ', role: 'Xạ Thủ', color: '#4ae0d0', weapon: 'crossbow', weight: 0.9, speed: 1.21, radius: 17,
  passive: { name: 'Dồn Dập', desc: 'Sát thương cơ bản yếu nhưng chạy nhanh. Mỗi lần trúng liên tiếp +20% sát thương (tối đa 8 tầng); mất hết nếu 2s không trúng.' },
  init(f) { f.ws.stk = 0; f.ws.lastHit = -9; },
  onDeal(w, f, t, h, info) { if (now(w) - f.ws.lastHit > 2) f.ws.stk = 0; info.dmgK *= 1 + 0.2 * f.ws.stk; f.ws.stk = Math.min(8, f.ws.stk + 1); f.ws.lastHit = now(w); },
  update(w, f, dt, inp) {
    if (now(w) - f.ws.lastHit > 2) f.ws.stk = 0;
    if (f.ws.kick) {
      f.ws.kick.t -= dt;
      if (f.ws.kick.t <= 0) { const t = w.fighter(f.ws.kick.tid); f.ws.kick = null; if (t && w.alive(t)) { w.applyHit(f, t, { src: f, angle: angOf(f, t), dmg: 7, kb: 235, kg: 8.6 }); w.ev('shake', { p: 8 }); } }
    }
    if (f.st.nest) {
      if (Math.hypot(inp.mx, inp.my) > 0.2 && f.st.nest.t < f.st.nest.max - 0.3) { delete f.st.nest; percy.onStatusEnd(w, f, 'nest'); return; }
      f.ws.nt -= dt;
      const t = foeOf(w, f);
      if (t && f.ws.nt <= 0 && Math.hypot(t.x - f.x, t.y - f.y) < 360) {
        f.ws.nt = 0.125;
        const a = angOf(f, t), n = f.st.multi ? 3 : 1;
        for (let i = 0; i < n; i++) w.proj(f, a + (i - (n - 1) / 2) * 0.12, { speed: 1000, range: 380, r: 4, kind: 'bolt', color: '#4ae0d0', hit: { dmg: 0.9, kb: 22, kg: 0.8 } });
      }
    }
  },
  onStatusEnd(w, f, k) { if (k === 'nest') f.cd.D = 3 * 0.85; },
  skills: {
    A: { name: 'Tên Nỏ', cd: 0.5, desc: 'Bắn 1 mũi tên nỏ nhanh, dồn tầng Dồn Dập.', shape: { type: 'proj', len: 520, w: 10 }, ai: { kind: 'poke', max: 500 },
      cast(w, f, c) {
        const n = f.st.multi ? 3 : 1, ev = [];
        for (let i = 0; i < n; i++) ev.push(proj(0.03, { rot: (i - (n - 1) / 2) * 0.12, speed: 1050, range: 520, r: 5, kind: 'bolt', color: '#4ae0d0', hit: { dmg: 2, kb: 42, kg: 1.6 } }));
        w.act(f, 'A', { dur: 0.16, move: 0.8, anim: 'shoot', ang: c.ang, ev });
      } },
    B: { name: 'Móc & Đạp', cd: 6.5, desc: 'Kết liễu: bắn dây móc kéo đối thủ về sát người (CHOÁNG 0.75s) rồi đạp một cú văng cực mạnh. Dùng được cả khi mở Trận Địa.', shape: { type: 'proj', len: 380, w: 16 }, ai: { kind: 'fin', max: 360 },
      cast(w, f, c) { w.act(f, 'B', { dur: 0.25, anim: 'shoot', ang: c.ang, ev: [proj(0.05, { speed: 1100, range: 380, r: 9, kind: 'hook', color: '#c0c0c0', hit: { dmg: 3, noKnock: true } })] }); } },
    C: { name: 'Lướt Chiến Thuật', cd: 5, mob: true, desc: 'Lướt theo hướng chỉ định (dời được cả Trận Địa).', shape: { type: 'dash', len: 180 }, ai: { kind: 'mob' },
      cast(w, f, c) { const keep = f.st.nest; w.act(f, 'C', { dur: 0.18, anim: 'dash', ang: c.ang, ev: [dash(0, { dist: 180, dur: 0.15, invuln: true })] }); if (keep) keep.t += 0.3; } },
    D: { name: 'Trận Địa Nỏ', cd: 3, manualCd: true, desc: 'Đứng yên mở trận địa: tự bắn đối thủ trong 360px mỗi 0.125s (tối đa 5s). Di chuyển để kết thúc.', shape: { type: 'circle', r: 360, self: true }, ai: { kind: 'buff', max: 340 },
      can(f) { return !f.st.nest; },
      cast(w, f) { w.addStatus(f, 'nest', 5); f.ws.nt = 0; f.cd.D = 99; } },
    U: { name: 'Liên Châu', desc: 'Trong 4s mỗi lần bắn A và Trận Địa Nỏ bắn ra 3 mũi tên.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { w.addStatus(f, 'multi', 4); w.text(f.x, f.y - 56, 'LIÊN CHÂU!', '#4ae0d0', 18); } },
  },
  onProjHit(w, f, p, t) {
    if (p.kind !== 'hook') return;
    const a = angOf(f, t), R = f.r + t.r + 6;
    t.x = f.x + Math.cos(a) * R; t.y = f.y + Math.sin(a) * R; t.vx = t.vy = 0; clampInside(w.A, t, t.r);
    w.addStatus(t, 'stun', 0.75); f.ws.kick = { tid: t.id, t: 0.35 };
    w.ev('fx', { kind: 'thrust', x: f.x, y: f.y, a, r: R, w: 6, color: '#c0c0c0', life: 0.25 });
  },
};

// =====================================================================
function roxieTurret(w, f) { return w.owned(f, 'turret')[0] || null; }
const roxie = {
  name: 'Roxie & T-Zero', title: 'Thợ Máy Cống Ngầm', role: 'Đấu Sĩ', color: '#ffb030', weapon: 'wrench', weight: 0.92, speed: 1.05, radius: 17,
  passive: { name: 'Bánh Răng & Sáng Tạo', desc: 'Bánh răng rơi trên sàn; chạm để nhặt (tối đa 9): mỗi cái +3% tốc chạy. D ghép 3 bánh răng thành 1 Mảnh cơ giới. Nộ thay bằng T-Zero: cần 3 Mảnh.' },
  init(f) { f.ws.gear = 2; f.ws.part = 0; f.ws.gt = 2; },
  ultReady(f) { return f.ws.part >= 3; },
  update(w, f, dt) {
    f.ws.gt -= dt;
    if (f.ws.gt <= 0) {
      f.ws.gt = 2.6;
      if (w.owned(f, 'gear').length < 4) { const a = w.rand(0, TAU), d = w.rand(40, Math.min(w.A.hx, w.A.hy) * 0.8); const p = { x: Math.cos(a) * d, y: Math.sin(a) * d }; clampInside(w.A, p, 30); w.ent(f, { kind: 'gear', x: p.x, y: p.y, r: 10, dur: 14 }); }
    }
    for (const g of w.owned(f, 'gear')) if (Math.hypot(g.x - f.x, g.y - f.y) < f.r + 16 && f.ws.gear < 9) { g.dead = true; f.ws.gear++; }
    if (f.ws.gear > 0) { f.st.haste = f.st.haste && f.st.haste.p > 0.03 * f.ws.gear ? f.st.haste : { t: 0.2, p: 0.03 * f.ws.gear, max: 0.2 }; }
  },
  skills: {
    A: { name: 'Khai Hỏa / Ụ Pháo', cd: 0.45, hold: 0.5, chargeMove: 0.5, desc: 'Bấm: bắn 1 viên cấu rỉa. Giữ đủ 0.5s (cần 2 bánh răng): dựng Ụ Pháo tự bắn đối thủ 12s.', shape: { type: 'proj', len: 460, w: 10 }, ai: { kind: 'poke', max: 440 },
      holdIf(f) { return f.ws.gear >= 2; },
      cast(w, f, c) {
        if (c.p >= 1 && f.ws.gear >= 2) {
          f.ws.gear -= 2; for (const t of w.owned(f, 'turret')) t.dead = true;
          const p = { x: f.x + Math.cos(c.ang) * 40, y: f.y + Math.sin(c.ang) * 40 }; clampInside(w.A, p, 20);
          w.ent(f, { kind: 'turret', x: p.x, y: p.y, r: 16, dur: 12, hittable: true, hp: 3, cd: 0.5 });
          w.act(f, 'A', { dur: 0.25, anim: 'cast' }); return;
        }
        w.act(f, 'A', { dur: 0.16, move: 0.8, anim: 'shoot', ang: c.ang, ev: [proj(0.02, { speed: 1000, range: 460, r: 5, kind: 'bullet', color: '#ffd080', hit: { dmg: 2.6, kb: 50, kg: 2 } })] });
      } },
    B: { name: 'Khai Tâm', cd: 2, desc: 'Kích nổ Ụ Pháo: nổ lớn quanh ụ, nhận lại 2 bánh răng, +30% sát thương và tốc chạy 4s.', shape: { type: 'self' }, ai: { kind: 'fin' },
      can(f, w) { return !!roxieTurret(w, f); },
      cast(w, f) {
        const t = roxieTurret(w, f); t.dead = true;
        w.hitCircle(f, t.x, t.y, { r: 115, dmg: 7.5, kb: 195, kg: 6.5, fxKind: 'boom', color: '#ffb030' }); w.ev('sfx', { name: 'boom', v: 0.8 });
        f.ws.gear = Math.min(9, f.ws.gear + 2); w.addStatus(f, 'empower', 4, 0.3);
        w.act(f, 'B', { dur: 0.2, anim: 'cast' });
      } },
    C: { name: 'Bất Ngờ Chưa', cd: 6, breakCC: true, mob: true, desc: 'Nhảy lộn ra sau, nổ CHOÁNG 1s ở chỗ cũ. Dùng được cả khi đang bị choáng / khống chế.', shape: { type: 'dash', len: 140, back: true }, ai: { kind: 'def' },
      cast(w, f, c) {
        for (const k of ['stun', 'sleep', 'root', 'charm', 'petrify', 'silence', 'slow']) delete f.st[k];
        f.hitstun = 0;
        w.hitCircle(f, f.x, f.y, { r: 75, dmg: 5, kb: 90, kg: 2, stun: 1, fxKind: 'boom', color: '#ffb030' });
        w.act(f, 'C', { dur: 0.24, anim: 'dash', ang: c.ang, ev: [dash(0, { rot: Math.PI, dist: 140, dur: 0.2, invuln: true })] });
      } },
    D: { name: 'Gia Công', cd: 1, desc: 'Dùng 3 bánh răng ghép 1 Mảnh cơ giới (tối đa 3 Mảnh). Đủ 3 Mảnh thì gọi được T-Zero (Nộ).', shape: { type: 'self' }, ai: { kind: 'buff' },
      can(f) { return f.ws.gear >= 3 && f.ws.part < 3; },
      cast(w, f) { f.ws.gear -= 3; f.ws.part++; w.text(f.x, f.y - 50, `⚙ Mảnh ${f.ws.part}/3`, '#ffd080', 14); } },
    U: { name: 'Thiết Vệ T-Zero', desc: 'Cần 3 Mảnh: gọi cỗ máy T-Zero tự hành chiến đấu 12s: đấm văng, phun lửa, chịu được 10 đòn.', shape: { type: 'self' }, ai: { kind: 'ult' },
      cast(w, f) { f.ws.part = 0; w.ent(f, { kind: 'tzero', x: f.x + 40, y: f.y, r: 30, dur: 12, hittable: true, hp: 10, cd: 1, fl: 3 }); w.act(f, 'U', { dur: 0.4, anim: 'roar' }); w.text(f.x, f.y - 60, 'T-ZERO!', '#ffb030', 22); } },
  },
  ents: {
    gear: {},
    turret: { update(w, e, dt) {
      const o = w.fighter(e.owner), t = o && foeOf(w, o);
      e.cd -= dt; if (!t) return;
      e.fa = angOf(e, t);
      if (e.cd <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 400) { e.cd = 0.5; w.proj(o, e.fa, { px: e.x, py: e.y, speed: 900, range: 420, r: 5, kind: 'bullet', color: '#ffd080', hit: { dmg: 1.8, kb: 40, kg: 1.5 } }); }
    } },
    tzero: { update(w, e, dt) {
      const o = w.fighter(e.owner), t = o && foeOf(w, o); if (!t) return;
      const d = Math.hypot(t.x - e.x, t.y - e.y); e.fa = angOf(e, t);
      if (d > 70) { e.x += Math.cos(e.fa) * 150 * dt; e.y += Math.sin(e.fa) * 150 * dt; clampInside(w.A, e, 20); }
      e.cd -= dt; e.fl -= dt;
      if (e.cd <= 0 && d < 95) { e.cd = 1.1; w.exec(o, { do: 'arc', px: e.x, py: e.y, range: 90, arc: 120, dmg: 7, kb: 185, kg: 6.5, ang: e.fa }, null); }
      if (e.fl <= 0 && d < 220) { e.fl = 3.5; w.zone(o, { x: e.x + Math.cos(e.fa) * 110, y: e.y + Math.sin(e.fa) * 110, r: 90, dur: 1.2, tick: 0.3, kind: 'fire', color: '#ff7a3a', hit: { dmg: 1.5, burn: 3 } }); }
    } },
  },
};

export const BATCH1A = { theron, florian, aria, koda, death, percy, roxie };
