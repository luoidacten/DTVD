// ===== Phòng online 2 người qua PeerJS (WebRTC P2P) =====
// Người tạo phòng làm host: chạy mô phỏng, gửi snapshot. Người vào phòng gửi input.
// Kênh 'ctl' tin cậy (lobby, input, sự kiện); kênh 'st' không tin cậy cho snapshot (lỗi thì dùng 'ctl').
export const PROTO = 2;
const PREFIX = 'legacy-arena2-';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const makeCode = () => Array.from({ length: 6 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
export const validCode = (c) => /^[A-Z0-9]{6}$/.test(c);

let loading = null;
function loadPeer() {
  if (window.Peer) return Promise.resolve();
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = new URL('../../vendor/peerjs.min.js', import.meta.url).href;
    s.onload = () => res(); s.onerror = () => { loading = null; rej(new Error('Không tải được thư viện kết nối')); };
    document.head.appendChild(s);
  });
  return loading;
}
function peerOpts() {
  const o = { debug: 0 };
  const cfg = window.ARENA_ONLINE_CONFIG;
  if (cfg && cfg.peerjs) Object.assign(o, cfg.peerjs);
  if (cfg && cfg.iceServers) o.config = { iceServers: cfg.iceServers };
  return o;
}
const ERR = {
  'peer-unavailable': 'Không tìm thấy phòng — kiểm tra lại mã hoặc phòng đã đóng.',
  'unavailable-id': 'Mã phòng đang được dùng.',
  'network': 'Mất kết nối tới máy chủ ghép phòng.',
  'server-error': 'Máy chủ ghép phòng đang lỗi, thử lại sau.',
  'socket-error': 'Không kết nối được máy chủ ghép phòng.',
  'browser-incompatible': 'Trình duyệt không hỗ trợ WebRTC.',
  'webrtc': 'Không thiết lập được kết nối trực tiếp giữa hai máy.',
};

export class Room {
  constructor() {
    this.peer = null; this.ctl = null; this.st = null; this.role = null; this.code = null;
    this.onmsg = () => {}; this.onstatus = () => {}; this.onclose = () => {};
    this.lastRecv = 0; this.rtt = 0; this.closed = false; this.hb = null;
  }
  // ---------- tạo phòng ----------
  async host() {
    await loadPeer();
    this.role = 'host';
    for (let tries = 0; tries < 4; tries++) {
      this.code = makeCode();
      try { await this.openPeer(PREFIX + this.code); break; }
      catch (e) { if (e.type !== 'unavailable-id' || tries === 3) throw e; }
    }
    this.peer.on('connection', (c) => this.accept(c));
    this.peer.on('disconnected', () => { if (!this.closed) try { this.peer.reconnect(); } catch {} });
    return this.code;
  }
  accept(c) {
    if (c.label === 'st') {
      if (this.st) { try { this.st.close(); } catch {} }
      this.st = c; c.on('data', (d) => this.recv(d));
      return;
    }
    if (this.ctl && this.ctl.open) {
      c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 500); });
      return;
    }
    this.ctl = c;
    c.on('open', () => { this.lastRecv = performance.now(); this.startHeartbeat(); this.onstatus('peer-open'); });
    c.on('data', (d) => { if (this.ctl === c) this.recv(d); });
    c.on('close', () => { if (this.ctl === c) this.lost('close'); });
    c.on('error', () => { if (this.ctl === c) this.lost('error'); });
  }
  // ---------- vào phòng ----------
  async join(code) {
    await loadPeer();
    this.role = 'guest'; this.code = code;
    await this.openPeer(undefined);
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(Object.assign(new Error(ERR['peer-unavailable']), { type: 'timeout' })), 15000);
      this.peer.on('error', (e) => { clearTimeout(to); rej(Object.assign(new Error(ERR[e.type] || 'Lỗi kết nối: ' + e.type), { type: e.type })); });
      const c = this.peer.connect(PREFIX + code, { label: 'ctl', reliable: true, serialization: 'json' });
      this.ctl = c;
      c.on('open', () => {
        clearTimeout(to);
        this.lastRecv = performance.now(); this.startHeartbeat();
        // kênh snapshot không tin cậy (tùy chọn)
        try { const s = this.peer.connect(PREFIX + code, { label: 'st', reliable: false, serialization: 'json' }); s.on('open', () => { this.st = s; }); s.on('data', (d) => this.recv(d)); } catch {}
        res();
      });
      c.on('data', (d) => this.recv(d));
      c.on('close', () => this.lost('close'));
      c.on('error', () => this.lost('error'));
    });
  }
  openPeer(id) {
    return new Promise((res, rej) => {
      const p = new window.Peer(id, peerOpts());
      this.peer = p;
      const to = setTimeout(() => { rej(Object.assign(new Error(ERR['socket-error']), { type: 'socket-error' })); }, 15000);
      p.on('open', () => { clearTimeout(to); res(); });
      p.on('error', (e) => {
        clearTimeout(to);
        if (!this.ctl || !this.ctl.open) {
          if (e.type === 'unavailable-id') { try { p.destroy(); } catch {} }
          rej(Object.assign(new Error(ERR[e.type] || 'Lỗi kết nối: ' + e.type), { type: e.type }));
        }
      });
    });
  }
  startHeartbeat() {
    clearInterval(this.hb);
    this.hb = setInterval(() => {
      if (this.closed) return;
      this.send({ t: 'ping', c: performance.now() });
      if (performance.now() - this.lastRecv > 8000) this.lost('timeout');
    }, 1000);
  }
  recv(d) {
    if (!d || typeof d !== 'object') return;
    this.lastRecv = performance.now();
    if (d.t === 'ping') { this.send({ t: 'pong', c: d.c }); return; }
    if (d.t === 'pong') { this.rtt = performance.now() - d.c; return; }
    this.onmsg(d);
  }
  get open() { return !!(this.ctl && this.ctl.open) && !this.closed; }
  send(m) { if (this.ctl && this.ctl.open) try { this.ctl.send(m); } catch {} }
  sendState(m) {
    if (this.st && this.st.open) { try { this.st.send(m); return; } catch {} }
    this.send(m);
  }
  lost(why) {
    if (this.closed) return;
    if (this.role === 'host') {
      // host giữ phòng mở để người khác (hoặc chính người cũ) vào lại
      const c = this.ctl, st = this.st;
      this.ctl = null; this.st = null; clearInterval(this.hb);
      try { c && c.close(); } catch {}
      try { st && st.close(); } catch {}
      this.onclose(why, true);
      return;
    }
    this.close();
    this.onclose(why, false);
  }
  close() {
    if (this.closed) return;
    this.closed = true; clearInterval(this.hb);
    try { this.send({ t: 'bye' }); } catch {}
    setTimeout(() => { try { this.peer && this.peer.destroy(); } catch {} }, 150);
  }
}
