// ===== Chỉ số, Trang bị (cửa hàng giữa vòng) và Lõi Nâng Cấp (Võ Đài) =====
// Mỗi "perk" (trang bị hoặc lõi): { id, name, icon, desc, mods?, hook... }
// mods cộng thẳng vào chỉ số tướng. Hook (tùy chọn), f.pw[id] là trạng thái riêng của perk:
//   deal(w, att, t, h, info)  — khi đánh trúng (sửa info.dmgK / info.kbK / info.extra)
//   take(w, t, att, h, info)  — khi bị đánh (info.cancel = true để chặn)
//   tick(w, f, dt, inp)       — mỗi tick
//   fall(w, f) → false        — sắp rơi đài; trả false để cứu
//   kill(w, f, victim)        — vừa đánh rơi đài đối thủ
//   life(w, f)                — đầu mỗi mạng (kể cả hồi sinh)
//   cast(w, f, key)           — vừa dùng chiêu
import { clamp } from './math.js';
import { edgeDist } from './arena.js';

export const STAT_LABEL = {
  dmg: ['Sát thương', '%'], kb: ['Lực văng', '%'], wt: ['Nặng (giảm lực văng nhận)', '%'], ten: ['Kiên Cường (giảm điểm văng nhận)', '%'],
  crit: ['Chí Mạng', '%'], critD: ['Sát thương Chí Mạng', '%'], spd: ['Tốc chạy', '%'], cdr: ['Giảm hồi chiêu', '%'],
  rage: ['Tích nộ', '%'], ccr: ['Kháng khống chế', '%'], taken: ['Điểm văng nhận thêm', '%'], stocks: ['Mạng', ''],
};
export function modText(m) {
  return Object.entries(m || {}).map(([k, v]) => { const L = STAT_LABEL[k]; if (!L) return ''; const n = L[1] === '%' ? Math.round(v * 100) : v; return `${n > 0 ? '+' : ''}${n}${L[1]} ${L[0]}`; }).filter(Boolean).join(' • ');
}
const pw = (f, id) => f.pw[id] || (f.pw[id] = {});
const T = (w) => w.s.t;
const nearEdge = (w, f, d) => edgeDist(w.A, f.x, f.y) < d;
function dashTo(w, f, ang, dist) { f.vx = 0; f.vy = 0; f.hitstun = 0; f.x += Math.cos(ang) * dist; f.y += Math.sin(ang) * dist; w.ev('fx', { kind: 'blink', x: f.x, y: f.y, r: 34, color: '#ffffff', life: 0.3 }); }

// =====================================================================
// TRANG BỊ — bậc 1 (~150 vàng), bậc 2 (~400), bậc 3 (~1000). Tối đa 6 món.
// =====================================================================
const ITEM_LIST = [
  // ---- Bậc 1 (từ Legacy) ----
  { id: 'it_spikes', tier: 1, price: 150, name: 'Giày Đinh Gỉ', icon: '👢', mods: { spd: 0.12 }, desc: 'Đứng gần mép sàn: giảm 15% lực văng nhận vào.',
    take(w, t, a, h, info) { if (nearEdge(w, t, 110)) info.kbK *= 0.85; } },
  { id: 'it_pine', tier: 1, price: 150, name: 'Vòng Cổ Gỗ Tùng', icon: '📿', mods: { cdr: 0.1 }, desc: 'Giảm 10% hồi chiêu.' },
  { id: 'it_thorn', tier: 1, price: 150, name: 'Găng Quấn Gai', icon: '🥊', mods: { kb: 0.12 }, desc: '+12% lực văng.' },
  { id: 'it_lead', tier: 1, price: 140, name: 'Tạ Chân Chì', icon: '⚓', mods: { wt: 0.3, spd: -0.12 }, desc: 'Rất nặng, khó bị đánh văng. Cái giá: chạy chậm hơn.' },
  { id: 'it_blood', tier: 1, price: 160, name: 'Nhẫn Huyết Thệ', icon: '💍', mods: { dmg: 0.2, kb: 0.2, taken: 0.1 }, desc: 'Đánh đau hơn. Cái giá: nhận thêm 10% điểm văng.' },
  { id: 'it_oil', tier: 1, price: 140, name: 'Giáp Vải Tẩm Dầu', icon: '🧥', mods: { ccr: 0.3 }, desc: 'Giảm 30% thời gian bị khống chế (choáng, trói, làm chậm…).' },
  // ---- Bậc 1 (mới — chỉ số mới) ----
  { id: 'it_whet', tier: 1, price: 150, name: 'Đá Mài Lưỡi', icon: '🪨', mods: { crit: 0.12 }, desc: '+12% Chí Mạng.' },
  { id: 'it_redglove', tier: 1, price: 150, name: 'Găng Đỏ Thợ Săn', icon: '🧤', mods: { critD: 0.35 }, desc: '+35% Sát thương Chí Mạng.' },
  { id: 'it_leather', tier: 1, price: 150, name: 'Áo Da Lì', icon: '🦺', mods: { ten: 0.1 }, desc: '+10% Kiên Cường: nhận ít điểm văng hơn.' },
  { id: 'it_belt', tier: 1, price: 140, name: 'Đai Sắt', icon: '🎗️', mods: { wt: 0.15 }, desc: '+15% Nặng.' },
  { id: 'it_horn', tier: 1, price: 130, name: 'Tù Và Chiến', icon: '📯', mods: { rage: 0.3 }, desc: '+30% tốc độ tích nộ.' },
  // ---- Bậc 2 ----
  { id: 'it_tendon', tier: 2, price: 400, name: 'Dao Cắt Gân', icon: '🔪', mods: { dmg: 0.08 }, desc: 'Đánh trúng từ sau lưng: làm chậm 45% trong 1.5s.',
    deal(w, a, t, h, info) { const ang = Math.atan2(a.y - t.y, a.x - t.x); if (Math.abs(Math.atan2(Math.sin(ang - t.facing), Math.cos(ang - t.facing))) > 1.9) info.extra = chain(info.extra, () => w.addStatus(t, 'slow', 1.5, 0.45)); } },
  { id: 'it_fury', tier: 2, price: 400, name: 'Áo Choàng Cuồng Nộ', icon: '🧣', desc: 'Điểm văng bản thân trên 80%: +35% lực văng. Cái giá: bị khống chế lâu hơn 25%.', mods: { ccr: -0.25 },
    deal(w, a, t, h, info) { if (a.percent > 80) info.kbK *= 1.35; } },
  { id: 'it_overboots', tier: 2, price: 380, name: 'Bốt Quá Tải', icon: '👟', desc: '3s không giao tranh: +35% tốc chạy. Trúng đòn thì mất buff.',
    tick(w, f) { const p = pw(f, 'it_overboots'); if (T(w) - (f.lastHurtT || 0) > 3 && (!f.st.haste || f.st.haste.p < 0.35)) f.st.haste = { t: 0.1, p: 0.35, max: 0.1 }; } },
  { id: 'it_ash', tier: 2, price: 420, name: 'Bùa Tro Tàn', icon: '🏺', desc: 'Đòn đánh gây Tro Tàn: đối thủ tự tăng điểm văng 3s (mỗi 4s một lần).',
    deal(w, a, t, h, info) { const p = pw(a, 'it_ash'); if (T(w) > (p.t || 0)) { p.t = T(w) + 4; info.extra = chain(info.extra, () => w.addStatus(t, 'burn', 3, 1.3)); } } },
  { id: 'it_anchor', tier: 2, price: 450, name: 'Mỏ Neo Hãm Phanh', icon: '🪝', desc: 'Tự kích hoạt (40s): bị đánh bay mạnh về phía mép thì đứng hình, triệt tiêu 70% lực văng còn lại.',
    tick(w, f) { const p = pw(f, 'it_anchor'); const sp = Math.hypot(f.vx, f.vy); if (sp > 650 && T(w) > (p.t || 0) && nearEdge(w, f, 170)) { p.t = T(w) + 40; f.vx *= 0.3; f.vy *= 0.3; w.text(f.x, f.y - 50, '🪝 HÃM PHANH', '#c0d0ff', 15); } } },
  { id: 'it_heart', tier: 2, price: 380, name: 'Trái Tim Cự Thạch', icon: '🗿', mods: { spd: -0.1 }, desc: 'Đứng yên quá 1s: Trụ Vững — Nặng thêm 50%.',
    tick(w, f) { const p = pw(f, 'it_heart'); p.s = (f.mvx || f.mvy) ? 0 : (p.s || 0) + 1 / 60; if (p.s > 1) f.st.heavy = { t: 0.1, p: Math.max(0.5, f.st.heavy ? f.st.heavy.p : 0), max: 0.1 }; } },
  { id: 'it_bell', tier: 2, price: 400, name: 'Chuông Hỗn Loạn', icon: '🔔', desc: 'Dùng 3 chiêu trong 4s: đòn trúng kế tiếp gây Câm Lặng 1.25s.',
    cast(w, f) { const p = pw(f, 'it_bell'); p.c = (p.c || []).filter((x) => T(w) - x < 4).concat(T(w)); if (p.c.length >= 3) { p.c = []; p.on = 1; } },
    deal(w, a, t, h, info) { const p = pw(a, 'it_bell'); if (p.on) { p.on = 0; info.extra = chain(info.extra, () => w.addStatus(t, 'silence', 1.25)); } } },
  { id: 'it_jet', tier: 2, price: 400, name: 'Bình Phản Lực', icon: '🧯', desc: 'Tự kích hoạt (25s): sắp rơi khỏi sàn thì phụt lùi 90px về phía tâm sàn.',
    fall(w, f) { const p = pw(f, 'it_jet'); if (T(w) < (p.t || 0)) return true; p.t = T(w) + 25; dashTo(w, f, Math.atan2(-f.y, -f.x), 90 + Math.max(0, -edgeDist(w.A, f.x, f.y))); w.text(f.x, f.y - 50, '🧯 PHẢN LỰC!', '#ffe0a0', 16); return false; } },
  { id: 'it_flyer', tier: 2, price: 420, name: 'Thiết Bị Bay', icon: '🛩️', mods: { spd: 0.1, cdr: 0.1 }, desc: '+10% tốc chạy, +10% giảm hồi chiêu.' },
  // ---- Bậc 2 (mới) ----
  { id: 'it_critblade', tier: 2, price: 420, name: 'Kiếm Hiệp Khách', icon: '🗡️', mods: { crit: 0.18, critD: 0.2 }, desc: '+18% Chí Mạng, +20% Sát thương Chí Mạng.' },
  { id: 'it_tenshield', tier: 2, price: 420, name: 'Khiên Kiên Cường', icon: '🛡️', mods: { ten: 0.15, wt: 0.1 }, desc: '+15% Kiên Cường, +10% Nặng.' },
  { id: 'it_thunder', tier: 2, price: 450, name: 'Dây Chuyền Sấm', icon: '⚡', mods: { crit: 0.1 }, desc: 'Đòn Chí Mạng gây choáng 0.35s.', critStun: 0.35 },
  { id: 'it_iron', tier: 2, price: 380, name: 'Giáp Lưới Sắt', icon: '🧱', mods: { wt: 0.22, ten: 0.06 }, desc: '+22% Nặng, +6% Kiên Cường.' },
  // ---- Bậc 3 ----
  { id: 'it_bloodsword', tier: 3, price: 950, name: 'Huyết Kiếm Đoạt Mệnh', icon: '🩸', mods: { dmg: 0.3, kb: 0.3 }, desc: 'Mọi chiêu cực mạnh. Cái giá: mỗi lần dùng A hoặc B tự nhận 4% điểm văng.',
    cast(w, f, k) { if (k === 'A' || k === 'B') f.percent += 4; } },
  { id: 'it_crown', tier: 3, price: 1100, name: 'Vương Miện Bất Khả Xâm Phạm', icon: '👑', desc: 'Tự kích hoạt (60s): sắp rơi đài thì vương miện nổ, đưa bạn về trong sàn và hất kẻ địch quanh đó.',
    fall(w, f) { const p = pw(f, 'it_crown'); if (T(w) < (p.t || 0)) return true; p.t = T(w) + 60; dashTo(w, f, Math.atan2(-f.y, -f.x), 70 + Math.max(0, -edgeDist(w.A, f.x, f.y))); w.hitCircle(f, f.x, f.y, { r: 120, dmg: 3, kb: 260, kg: 3, fxKind: 'boom', color: '#ffd24a' }); w.text(f.x, f.y - 56, '👑 BẤT KHẢ XÂM PHẠM!', '#ffd24a', 18); return false; } },
  { id: 'it_titan', tier: 3, price: 1050, name: 'Bộ Xương Titan', icon: '🦴', mods: { wt: 0.5, ten: 0.1, spd: -0.2 }, desc: 'Cực nặng, miễn choáng ngắn (≤0.5s). Cái giá: chậm 20%.',
    take(w, t, a, h) { if (h.stun && h.stun <= 0.5) h.stun = 0; } },
  { id: 'it_hourglass', tier: 3, price: 1100, name: 'Đồng Hồ Cát Nghịch Đảo', icon: '⌛', desc: 'Tự kích hoạt (60s): sắp rơi đài thì tua về vị trí và điểm văng của 2.5s trước.',
    tick(w, f) { const p = pw(f, 'it_hourglass'); p.k = (p.k || 0) + 1; if (p.k % 15 === 0) { (p.h = p.h || []).push([f.x, f.y, f.percent]); if (p.h.length > 10) p.h.shift(); } },
    fall(w, f) { const p = pw(f, 'it_hourglass'); if (T(w) < (p.t || 0) || !p.h || !p.h.length) return true; p.t = T(w) + 60; const o = p.h[0]; f.x = o[0]; f.y = o[1]; f.percent = o[2]; f.vx = f.vy = 0; f.hitstun = 0; p.h = []; w.text(f.x, f.y - 56, '⌛ NGHỊCH ĐẢO!', '#80d4f1', 18); return false; } },
  { id: 'it_abyss', tier: 3, price: 1000, name: 'Kẹp Vực Thẳm', icon: '🗜️', desc: 'Đánh trúng đối thủ đứng sát mép sàn (120px): lực văng x1.7.',
    deal(w, a, t, h, info) { if (nearEdge(w, t, 120)) info.kbK *= 1.7; } },
  { id: 'it_gem', tier: 3, price: 1000, name: 'Ngọc Tinh Linh', icon: '💠', desc: 'Mỗi lần đánh rơi đài đối thủ: giảm 25% điểm văng hiện tại của bạn và +8% tốc chạy tới hết vòng (tối đa 3 lần).',
    kill(w, f) { const p = pw(f, 'it_gem'); if ((p.n || 0) >= 3) return; p.n = (p.n || 0) + 1; f.percent *= 0.75; f.m.spd = (f.m.spd || 0) + 0.08; } },
  { id: 'it_life', tier: 3, price: 1200, name: 'Thủy Tinh Sinh Mệnh', icon: '💎', mods: { stocks: 1 }, desc: '+1 mạng mỗi vòng.' },
  // ---- Bậc 3 (mới) ----
  { id: 'it_infinity', tier: 3, price: 1050, name: 'Vô Cực Kiếm', icon: '⚔️', mods: { crit: 0.2, critD: 0.4 }, desc: '+20% Chí Mạng, +40% Sát thương Chí Mạng.' },
  { id: 'it_bulwark', tier: 3, price: 1000, name: 'Giáp Kiên Cường Tuyệt Đối', icon: '🏰', mods: { ten: 0.28 }, desc: '+28% Kiên Cường: nhận ít điểm văng hơn hẳn.' },
  { id: 'it_mountain', tier: 3, price: 1000, name: 'Ấn Núi Thái Sơn', icon: '⛰️', mods: { wt: 0.4, ten: 0.1, spd: -0.05 }, desc: '+40% Nặng, +10% Kiên Cường.' },
  { id: 'it_reaper', tier: 3, price: 1050, name: 'Lưỡi Hái Kết Liễu', icon: '🌙', mods: { kb: 0.15 }, desc: 'Đối thủ trên 100% điểm văng: Chí Mạng chắc chắn.', forceCrit: (t) => t.percent > 100 },
];

// =====================================================================
// LÕI NÂNG CẤP — chọn 1 trong 3 trước vòng 1, 3, 5, 7. Bậc: 1 Bạc, 2 Vàng, 3 Lăng Kính.
// =====================================================================
const AUG_LIST = [
  // ---- Bạc ----
  { id: 'a_steel', tier: 1, name: 'Thân Thép', icon: '🔩', mods: { wt: 0.15 }, desc: '+15% Nặng.' },
  { id: 'a_wind', tier: 1, name: 'Bước Gió', icon: '🍃', mods: { spd: 0.15 }, desc: '+15% tốc chạy.' },
  { id: 'a_sharp', tier: 1, name: 'Lưỡi Sắc', icon: '🔪', mods: { dmg: 0.12 }, desc: '+12% sát thương.' },
  { id: 'a_heavyhand', tier: 1, name: 'Tay Nặng', icon: '✊', mods: { kb: 0.12 }, desc: '+12% lực văng.' },
  { id: 'a_eagle', tier: 1, name: 'Mắt Ưng', icon: '🦅', mods: { crit: 0.15 }, desc: '+15% Chí Mạng.' },
  { id: 'a_deep', tier: 1, name: 'Đâm Hiểm', icon: '🎯', mods: { critD: 0.4 }, desc: '+40% Sát thương Chí Mạng.' },
  { id: 'a_thick', tier: 1, name: 'Da Dày', icon: '🐘', mods: { ten: 0.12 }, desc: '+12% Kiên Cường.' },
  { id: 'a_quick', tier: 1, name: 'Nhanh Tay', icon: '⏱️', mods: { cdr: 0.12 }, desc: '+12% giảm hồi chiêu.' },
  { id: 'a_furyfuel', tier: 1, name: 'Nộ Bùng', icon: '🔥', mods: { rage: 0.5 }, desc: '+50% tích nộ.' },
  { id: 'a_opener', tier: 1, name: 'Khiên Khởi Đầu', icon: '🔰', desc: 'Mỗi mạng bắt đầu với khiên 8.', life(w, f) { w.addStatus(f, 'shield', 8, 8); } },
  { id: 'a_grip', tier: 1, name: 'Bám Mép', icon: '🧗', desc: 'Đứng trong 110px sát mép: giảm 20% lực văng nhận vào.', take(w, t, a, h, info) { if (nearEdge(w, t, 110)) info.kbK *= 0.8; } },
  { id: 'a_regen', tier: 1, name: 'Hồi Sức', icon: '🌿', desc: '3s không bị đánh: giảm 1.5% điểm văng mỗi giây.', tick(w, f, dt) { if (T(w) - (f.lastHurtT || 0) > 3) f.percent = Math.max(0, f.percent - 1.5 * dt); } },
  // ---- Vàng ----
  { id: 'a_execute', tier: 2, name: 'Đòn Kết Liễu', icon: '💀', desc: 'Đối thủ trên 100% điểm văng: +30% lực văng.', deal(w, a, t, h, info) { if (t.percent > 100) info.kbK *= 1.3; } },
  { id: 'a_leech', tier: 2, name: 'Hút Điểm', icon: '🩸', desc: 'Mỗi đòn trúng giảm 1% điểm văng bản thân.', deal(w, a) { a.percent = Math.max(0, a.percent - 1); } },
  { id: 'a_counter', tier: 2, name: 'Phản Kích', icon: '🔄', desc: 'Sau khi bị đánh trúng, đòn kế tiếp trong 2s gây +30% sát thương và lực văng.',
    take(w, t) { pw(t, 'a_counter').t = T(w) + 2; }, deal(w, a, t, h, info) { const p = pw(a, 'a_counter'); if (T(w) < (p.t || 0)) { p.t = 0; info.dmgK *= 1.3; info.kbK *= 1.3; } } },
  { id: 'a_edgehunt', tier: 2, name: 'Thợ Săn Mép Vực', icon: '🌊', desc: 'Đối thủ trong 150px sát mép: +25% lực văng.', deal(w, a, t, h, info) { if (nearEdge(w, t, 150)) info.kbK *= 1.25; } },
  { id: 'a_critstun', tier: 2, name: 'Đòn Sấm', icon: '⚡', mods: { crit: 0.1 }, desc: '+10% Chí Mạng. Đòn Chí Mạng choáng 0.4s.', critStun: 0.4 },
  { id: 'a_blink', tier: 2, name: 'Tốc Biến Phản Xạ', icon: '✨', desc: 'Tự kích hoạt (18s): sắp rơi đài thì dịch chuyển 110px về phía tâm sàn.',
    fall(w, f) { const p = pw(f, 'a_blink'); if (T(w) < (p.t || 0)) return true; p.t = T(w) + 18; dashTo(w, f, Math.atan2(-f.y, -f.x), 110 + Math.max(0, -edgeDist(w.A, f.x, f.y))); w.text(f.x, f.y - 50, '✨ TỐC BIẾN', '#ffffff', 15); return false; } },
  { id: 'a_frost', tier: 2, name: 'Lõi Băng', icon: '❄️', desc: 'Đòn trúng làm chậm 20% trong 1s.', deal(w, a, t, h, info) { info.extra = chain(info.extra, () => w.addStatus(t, 'slow', 1, 0.2)); } },
  { id: 'a_ember', tier: 2, name: 'Hỏa Thiêu', icon: '♨️', desc: 'Đòn trúng gây thiêu đốt 2s (cộng dồn).', deal(w, a, t, h, info) { info.extra = chain(info.extra, () => w.addStatus(t, 'burn', 2, 0.9)); } },
  { id: 'a_coldsteel', tier: 2, name: 'Thép Nguội', icon: '🧊', desc: 'Điểm văng bản thân trên 100%: Nặng thêm 30%.', tick(w, f) { if (f.percent > 100) f.st.heavy = { t: 0.1, p: Math.max(0.3, f.st.heavy ? f.st.heavy.p : 0), max: 0.1 }; } },
  { id: 'a_berserk', tier: 2, name: 'Cuồng Chiến', icon: '😤', desc: '+1% sát thương và lực văng mỗi 5% điểm văng bản thân (tối đa +30%).', deal(w, a, t, h, info) { const k = 1 + Math.min(0.3, a.percent / 500); info.dmgK *= k; info.kbK *= k; } },
  { id: 'a_firststrike', tier: 2, name: 'Mở Màn', icon: '🎬', desc: 'Đòn trúng đầu tiên mỗi mạng gây gấp đôi sát thương và lực văng.',
    life(w, f) { pw(f, 'a_firststrike').on = 1; }, deal(w, a, t, h, info) { const p = pw(a, 'a_firststrike'); if (p.on) { p.on = 0; info.dmgK *= 2; info.kbK *= 2; } } },
  { id: 'a_tenacious', tier: 2, name: 'Ý Chí Sắt Đá', icon: '🪨', mods: { ten: 0.15, ccr: 0.25 }, desc: '+15% Kiên Cường, giảm 25% thời gian bị khống chế.' },
  // ---- Lăng Kính ----
  { id: 'a_thirdlife', tier: 3, name: 'Mạng Thứ Ba', icon: '❤️', mods: { stocks: 1 }, desc: '+1 mạng mỗi vòng.' },
  { id: 'a_doubleult', tier: 3, name: 'Song Nộ', icon: '♊', desc: 'Dùng Nộ xong lập tức có lại 60 nộ.', cast(w, f, k) { if (k === 'U') f.rage = Math.max(f.rage, 60); } },
  { id: 'a_reflect', tier: 3, name: 'Phản Văng', icon: '🪞', desc: 'Bị đánh văng rất mạnh: kẻ tấn công cũng bị đẩy lùi 40% lực đó.',
    take(w, t, a, h, info) { if (!a || a === t) return; info.extra = chain(info.extra, () => { const sp = Math.hypot(t.vx, t.vy); if (sp > 550 && w.alive(a) && !w.superArmor(a)) { const ang = Math.atan2(a.y - t.y, a.x - t.x); a.vx = Math.cos(ang) * sp * 0.4; a.vy = Math.sin(ang) * sp * 0.4; a.hitstun = Math.max(a.hitstun, 0.2); } }); } },
  { id: 'a_undying', tier: 3, name: 'Bất Khuất', icon: '🔱', desc: 'Một lần mỗi vòng: sắp rơi đài thì trở về giữa sân, bất tử 1.5s.',
    fall(w, f) { const p = pw(f, 'a_undying'); if (p.used) return true; p.used = 1; f.x = f.y = 0; f.vx = f.vy = 0; f.hitstun = 0; f.invuln = 1.5; w.text(f.x, f.y - 60, '🔱 BẤT KHUẤT!', '#ffd24a', 20); return false; } },
  { id: 'a_peerless', tier: 3, name: 'Thiên Hạ Vô Song', icon: '🌟', mods: { crit: 0.25, critD: 0.4 }, desc: '+25% Chí Mạng, +40% Sát thương Chí Mạng.' },
  { id: 'a_taishan', tier: 3, name: 'Thái Sơn', icon: '🏔️', mods: { wt: 0.35, ten: 0.2 }, desc: '+35% Nặng, +20% Kiên Cường.' },
  { id: 'a_butcher', tier: 3, name: 'Đồ Tể', icon: '🪓', mods: { dmg: 0.2, kb: 0.3 }, desc: '+20% sát thương, +30% lực văng.' },
  { id: 'a_timestop', tier: 3, name: 'Thời Gian Ngưng Đọng', icon: '⏳', mods: { cdr: 0.3 }, desc: '+30% giảm hồi chiêu.' },
  { id: 'a_phoenix', tier: 3, name: 'Phượng Hoàng', icon: '🐦‍🔥', desc: 'Mỗi lần hồi sinh: khiên 12, bất tử 3s, nộ đầy.', life(w, f) { const p = pw(f, 'a_phoenix'); if ((p.n = (p.n || 0) + 1) > 1) { w.addStatus(f, 'shield', 8, 12); f.invuln = 3; f.rage = 100; } } },
  { id: 'a_wrath', tier: 3, name: 'Cơn Thịnh Nộ', icon: '🌋', desc: 'Mỗi mạng bắt đầu với thanh nộ đầy.', life(w, f) { f.rage = 100; } },
  { id: 'a_vampire', tier: 3, name: 'Ma Cà Rồng', icon: '🧛', desc: 'Mỗi đòn trúng giảm 2.5% điểm văng bản thân.', deal(w, a) { a.percent = Math.max(0, a.percent - 2.5); } },
  { id: 'a_bastion', tier: 3, name: 'Tường Đồng Vách Sắt', icon: '🏯', mods: { ten: 0.25 }, desc: '+25% Kiên Cường, miễn choáng ngắn (≤0.6s).', take(w, t, a, h) { if (h.stun && h.stun <= 0.6) h.stun = 0; } },
];

function chain(a, b) { return a ? () => { a(); b(); } : b; }
export const ITEMS = Object.fromEntries(ITEM_LIST.map((x) => [x.id, x]));
export const AUGS = Object.fromEntries(AUG_LIST.map((x) => [x.id, x]));
export const PERKS = Object.assign({}, ITEMS, AUGS);
export const ITEM_IDS = ITEM_LIST.map((x) => x.id);
export const AUG_IDS = AUG_LIST.map((x) => x.id);
export const MAX_ITEMS = 6;

// Gộp chỉ số từ danh sách perk
export function sumMods(ids, extra) {
  const m = {};
  for (const id of ids) { const P = PERKS[id]; if (P && P.mods) for (const k in P.mods) m[k] = (m[k] || 0) + P.mods[k]; }
  if (extra) for (const k in extra) m[k] = (m[k] || 0) + extra[k];
  if (m.ten) m.ten = clamp(m.ten, -0.5, 0.6);
  if (m.cdr) m.cdr = clamp(m.cdr, -0.5, 0.5);
  if (m.crit) m.crit = clamp(m.crit, 0, 0.8);
  return m;
}
