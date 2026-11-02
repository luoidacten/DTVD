// ===== Điều khiển: bàn phím/chuột (PC) và cần ảo + nút chiêu (cảm ứng) =====
// Mỗi lần poll trả về khung input thô: { mx, my, ax, ay, aim, held:{A..U}, pc:{A..U: số lần bấm} }.
// Bộ đếm lần bấm (pc) giúp không mất cú bấm khi gửi qua mạng hoặc khi nhiều tick/khung hình.
import { HEROES } from '../engine/heroes.js';
import { clamp } from '../engine/math.js';

const KEYS = ['A', 'B', 'C', 'D', 'U'];
const KEYMAP = { KeyQ: 'A', KeyJ: 'A', KeyE: 'B', KeyK: 'B', ShiftLeft: 'C', ShiftRight: 'C', KeyR: 'C', KeyL: 'C', KeyF: 'D', KeyI: 'D', Space: 'U', KeyO: 'U' };
const LABEL = { A: 'A', B: 'B', C: 'C', D: 'D', U: 'Nộ' };
const DRAG_MIN = 16;   // px kéo tối thiểu để tính là ngắm tay
const DRAG_FULL = 90;  // px kéo = tầm tối đa

export class Input {
  constructor(canvas, renderer) {
    this.cv = canvas; this.R = renderer;
    this.keys = new Set(); this.mouse = { x: 0, y: 0, in: false }; this.mouseBtn = { A: false, B: false };
    this.held = { A: false, B: false, C: false, D: false, U: false };
    this.pc = { A: 0, B: 0, C: 0, D: 0, U: 0 };
    this.touch = false; this.enabled = false;
    this.stick = null; this.btn = {}; this.aiming = null; this.layer = null; this.hero = null;
    this.bind();
  }
  press(k) { this.pc[k]++; }

  bind() {
    addEventListener('keydown', (e) => {
      if (!this.enabled || e.target.tagName === 'INPUT') return;
      const k = KEYMAP[e.code];
      if (k || ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      if (k) this.press(k);
    });
    addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    addEventListener('blur', () => { this.keys.clear(); this.mouseBtn.A = this.mouseBtn.B = false; this.releaseTouches(); });
    this.cv.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.in = true; } });
    this.cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || !this.enabled) return;
      this.useTouch(false);
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.in = true;
      if (e.button === 0) { this.mouseBtn.A = true; this.press('A'); }
      if (e.button === 2) { this.mouseBtn.B = true; this.press('B'); }
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') { if (e.button === 0) this.mouseBtn.A = false; if (e.button === 2) this.mouseBtn.B = false; } });
    this.cv.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('touchstart', () => this.useTouch(true), { passive: true });
  }

  useTouch(on) {
    if (this.touch === on) return;
    this.touch = on;
    this.R.mobile = on;
    if (this.layer) this.layer.classList.toggle('hidden', !on);
    document.body.classList.toggle('touch', on);
  }

  // ---------- giao diện cảm ứng ----------
  mount(root, heroId) {
    this.hero = heroId;
    if (this.layer) this.layer.remove();
    const L = document.createElement('div');
    L.className = 'touch-layer' + (this.touch ? '' : ' hidden');
    L.innerHTML = `<div class="stick-zone"></div><div class="cancel-zone">✕<small>Hủy</small></div>` +
      KEYS.map((k) => `<div class="tbtn tb-${k}" data-k="${k}"><span class="tb-l">${LABEL[k]}</span><span class="tb-n"></span><span class="tb-cd"></span></div>`).join('');
    root.appendChild(L);
    this.layer = L; this.btn = {};
    const H = HEROES[heroId];
    for (const el of L.querySelectorAll('.tbtn')) {
      const k = el.dataset.k;
      this.btn[k] = el;
      el.querySelector('.tb-n').textContent = H.skills[k] ? H.skills[k].name : '';
      el.addEventListener('pointerdown', (e) => this.btnDown(e, k, el));
    }
    const zone = L.querySelector('.stick-zone');
    zone.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (this.stick) return;
      zone.setPointerCapture(e.pointerId);
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    });
    zone.addEventListener('pointermove', (e) => { if (this.stick && this.stick.id === e.pointerId) { this.stick.x = e.clientX; this.stick.y = e.clientY; } });
    const up = (e) => { if (this.stick && this.stick.id === e.pointerId) this.stick = null; };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
    this.cancelEl = L.querySelector('.cancel-zone');
  }
  btnDown(e, k, el) {
    e.preventDefault();
    if (!this.enabled) return;
    el.setPointerCapture(e.pointerId);
    const sk = HEROES[this.hero].skills[k];
    const r = el.getBoundingClientRect();
    const a = { k, id: e.pointerId, el, cx: r.left + r.width / 2, cy: r.top + r.height / 2, x: e.clientX, y: e.clientY, drag: false, cancel: false, sk, hold: !!sk.hold, t0: performance.now() };
    if (k === 'A' || a.hold) { this.press(k); }
    this.held[k] = true;
    // chỉ một nút ngắm cùng lúc; A được bấm song song
    if (k !== 'A' || !this.aiming) this.aiming = a;
    el.classList.add('down');
    if (k !== 'A') this.cancelEl.classList.add('show');
    const move = (ev) => {
      if (ev.pointerId !== a.id) return;
      a.x = ev.clientX; a.y = ev.clientY;
      if (Math.hypot(a.x - a.cx, a.y - a.cy) > DRAG_MIN) a.drag = true;
      const c = this.cancelEl.getBoundingClientRect();
      a.cancel = k !== 'A' && !a.hold && a.x > c.left && a.x < c.right && a.y > c.top && a.y < c.bottom;
      this.cancelEl.classList.toggle('hot', a.cancel);
    };
    const end = (ev) => {
      if (ev.pointerId !== a.id) return;
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', end); el.removeEventListener('pointercancel', end);
      el.classList.remove('down');
      this.cancelEl.classList.remove('show', 'hot');
      if (ev.type === 'pointercancel') a.cancel = true;
      // chiêu thường: tung khi thả (trừ khi kéo vào Hủy)
      if (k !== 'A' && !a.hold && !a.cancel) { a.release = true; this.press(k); }
      this.held[k] = false;
      if (a.release) { a.until = performance.now() + 120; this.lastAim = a; }
      if (this.aiming === a) this.aiming = null;
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  releaseTouches() { this.stick = null; this.aiming = null; for (const k of KEYS) this.held[k] = false; }

  // cập nhật hồi chiêu trên nút cảm ứng
  updateButtons(f) {
    if (!this.layer || !this.touch || !f) return;
    for (const k of KEYS) {
      const el = this.btn[k]; if (!el) continue;
      const cd = k === 'U' ? 0 : f.cd[k];
      const ready = k === 'U' ? (f.rg >= 100) : cd <= 0;
      el.classList.toggle('cool', !ready);
      const t = el.querySelector('.tb-cd');
      t.textContent = k === 'U' ? (ready ? '' : Math.floor(f.rg) + '%') : cd > 0 ? cd.toFixed(1) : '';
    }
  }

  // ---------- đọc input ----------
  // me: fighter của mình trong view; foe: đối thủ (để tự ngắm trên cảm ứng)
  poll(me, foe) {
    const out = { mx: 0, my: 0, ax: 0, ay: 0, aim: false, held: Object.assign({}, this.held), pc: Object.assign({}, this.pc), ui: null };
    if (!me) return out;
    if (!this.touch) {
      let x = 0, y = 0;
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
      const n = Math.hypot(x, y) || 1;
      out.mx = x / n; out.my = y / n;
      for (const [code, k] of Object.entries(KEYMAP)) if (this.keys.has(code)) out.held[k] = true;
      if (this.mouseBtn.A) out.held.A = true;
      if (this.mouseBtn.B) out.held.B = true;
      if (this.mouse.in) { const [wx, wy] = this.R.s2w(this.mouse.x, this.mouse.y); out.ax = wx; out.ay = wy; out.aim = true; }
      // vùng ngắm khi đang giữ chiêu tụ lực
      if (me.ch) out.ui = { k: me.ch[0], ax: out.ax, ay: out.ay };
      return out;
    }
    // --- cảm ứng ---
    if (this.stick) {
      const dx = this.stick.x - this.stick.ox, dy = this.stick.y - this.stick.oy, L = Math.hypot(dx, dy), R = 60;
      if (L > 8) { const k = Math.min(1, L / R); out.mx = (dx / L) * k; out.my = (dy / L) * k; }
    }
    const a = this.aiming || (this.lastAim && this.lastAim.until > performance.now() ? this.lastAim : null);
    if (a) {
      const sk = a.sk, sh = sk.shape || {};
      const range = sh.range || sh.len || sk.maxRange || 300;
      if (a.drag) {
        // ngắm tay: hướng kéo từ tâm nút; khoảng kéo = khoảng cách (chiêu chọn điểm)
        const dx = a.x - a.cx, dy = a.y - a.cy, L = Math.hypot(dx, dy) || 1;
        const k = sh.type === 'point' ? clamp((L - DRAG_MIN) / (DRAG_FULL - DRAG_MIN), 0.05, 1) : 1;
        out.ax = me.x + (dx / L) * range * k; out.ay = me.y + (dy / L) * range * k;
      } else if (foe && !foe.dead && foe.rsp <= 0 && !(foe.st.invis)) {
        // tự ngắm: hướng về đối thủ (chiêu chọn điểm: đúng vị trí đối thủ, giới hạn tầm)
        out.ax = foe.x; out.ay = foe.y;
      } else {
        out.ax = me.x + Math.cos(me.fa) * range; out.ay = me.y + Math.sin(me.fa) * range;
      }
      out.aim = true;
      if (this.aiming === a && a.k !== 'A') out.ui = { k: a.k, ax: out.ax, ay: out.ay, cancel: a.cancel };
    } else if (this.held.A && foe && !foe.dead && foe.rsp <= 0 && !foe.st.invis) {
      out.ax = foe.x; out.ay = foe.y; out.aim = true;
    }
    return out;
  }

  // vẽ cần ảo (lớp phủ màn hình)
  drawStick(g) {
    if (!this.touch || !this.stick) return;
    const s = this.stick, dx = s.x - s.ox, dy = s.y - s.oy, L = Math.hypot(dx, dy), R = 60, k = L > R ? R / L : 1;
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.strokeStyle = 'rgba(255,255,255,0.3)'; g.lineWidth = 2;
    g.beginPath(); g.arc(s.ox, s.oy, R, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.arc(s.ox + dx * k, s.oy + dy * k, 26, 0, Math.PI * 2); g.fill();
  }
}

// Biến input thô thành khung cho engine: so bộ đếm để biết nút nào vừa được bấm
export function toFrame(raw, last) {
  const pressed = {};
  for (const k of KEYS) {
    const n = (raw.pc && raw.pc[k]) || 0;
    if (n > (last[k] || 0)) pressed[k] = true;
    last[k] = Math.max(last[k] || 0, n);
  }
  const ok = (v) => (Number.isFinite(v) ? v : 0);
  const mx = clamp(ok(raw.mx), -1, 1), my = clamp(ok(raw.my), -1, 1);
  const held = {};
  for (const k of KEYS) held[k] = !!(raw.held && raw.held[k]);
  return { mx, my, ax: clamp(ok(raw.ax), -5000, 5000), ay: clamp(ok(raw.ay), -5000, 5000), aim: !!raw.aim, held, pressed };
}
