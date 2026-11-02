// ===== Ứng dụng: menu, chọn tướng, phòng online, vòng lặp trận =====
import { World, DT } from '../engine/world.js';
import { HEROES, HERO_IDS } from '../engine/heroes.js';
import { ARENAS, ARENA_IDS, clampInside } from '../engine/arena.js';
import { Bot, BOT_LEVELS } from '../engine/bot.js';
import { packView, lerpView } from '../engine/view.js';
import { Renderer } from './render.js';
import { Input, toFrame } from './input.js';
import { sfx, unlockAudio, toggleMute, isMuted } from './audio.js';
import { Room, PROTO, validCode } from './net.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SAVE = 'legacy_arena2_prefs';
const prefs = Object.assign({ name: '', hero: 'valerius', foe: 'random', level: 'normal', arena: 'random', stocks: 3, time: 180 }, load());
function load() { try { return JSON.parse(localStorage.getItem(SAVE)) || {}; } catch { return {}; } }
function persist() { try { localStorage.setItem(SAVE, JSON.stringify(prefs)); } catch {} }
const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];
const STOCK_OPTS = [1, 2, 3, 4, 5], TIME_OPTS = [[120, '2 phút'], [180, '3 phút'], [300, '5 phút'], [0, 'Không giới hạn']];

const cv = $('#cv'), ui = $('#ui'), hud = $('#hud');
const R = new Renderer(cv);
const input = new Input(cv, R);
addEventListener('resize', () => R.resize());
addEventListener('pointerdown', unlockAudio, { capture: true });
addEventListener('keydown', unlockAudio, { capture: true });

function toast(msg, ms = 2600) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), ms);
}

// ====================================================================
// Trạng thái phiên chơi
// ====================================================================
let G = null;   // { mode: 'offline'|'host'|'guest', world?, bot?, me, view, ... }
let room = null, lobby = null;

function startOffline() {
  const heroes = [prefs.hero, prefs.foe === 'random' ? pickRandom(HERO_IDS) : prefs.foe];
  const arena = prefs.arena === 'random' ? pickRandom(ARENA_IDS) : prefs.arena;
  const names = [prefs.name || 'Bạn', prefs.level === 'dummy' ? 'Bù nhìn' : 'Máy (' + (BOT_LEVELS[prefs.level] || BOT_LEVELS.normal).name + ')'];
  const world = new World({ arena, heroes, names, stocks: prefs.stocks, timeLimit: prefs.time });
  beginGame({ mode: 'offline', world, bot: new Bot(1, prefs.level, Date.now() & 0xffff), me: 0, cfg: { arena, heroes, names } });
}

function beginGame(g) {
  G = Object.assign({ acc: 0, last: [{}, {}], paused: false, over: false, snaps: [], guestRaw: null, guestPressed: {}, sendT: 0, evBuf: [], resultShown: false }, g);
  if (G.world) G.view = packView(G.world.s);
  R.reset();
  input.enabled = true;
  input.last = {};
  hud.innerHTML = `<div class="hud-btns"><button class="hb" id="hb-pause" title="Tạm dừng / Menu">⏸</button><button class="hb" id="hb-mute" title="Âm thanh">${isMuted() ? '🔇' : '🔊'}</button><button class="hb mob-only" id="hb-full" title="Toàn màn hình">⛶</button></div>`;
  input.mount(hud, G.cfg.heroes[G.me]);
  $('#hb-pause').onclick = () => openPause();
  $('#hb-mute').onclick = (e) => { e.currentTarget.textContent = toggleMute() ? '🔇' : '🔊'; };
  $('#hb-full').onclick = () => goFullscreen();
  hud.classList.remove('hidden');
  showScreen(null);
  if (input.touch) goFullscreen();
}

function endGame() {
  G = null; input.enabled = false; input.releaseTouches();
  hud.classList.add('hidden'); hud.innerHTML = '';
}

function goFullscreen() {
  const el = document.documentElement;
  if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().then(() => {
    try { screen.orientation.lock('landscape').catch(() => {}); } catch {}
  }).catch(() => {});
}

// ====================================================================
// Vòng lặp
// ====================================================================
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now;
  if (!G) return;
  try { tickGame(dt, now); } catch (e) { console.error(e); toast('Lỗi: ' + e.message, 5000); }
}
requestAnimationFrame(frame);
// tab ẩn: host vẫn chạy mô phỏng (trình duyệt có thể làm chậm)
setInterval(() => { if (document.hidden && G && G.mode === 'host') { const n = performance.now(); simulate(Math.min(0.25, (n - lastT) / 1000)); lastT = n; } }, 50);

function myFighter(view) { return view ? view.f[G.me] : null; }

function simulate(dt) {
  const w = G.world;
  if (G.paused) return;
  G.acc += dt;
  let steps = 0;
  const me = myFighter(G.view);
  const raw = input.poll(me, G.view && G.view.f[1 - G.me]);
  G.ui = raw.ui;
  while (G.acc >= DT && steps < 8) {
    G.acc -= DT; steps++;
    const f0 = toFrame(raw, G.last[0]);
    let f1;
    if (G.mode === 'offline') f1 = G.bot.input(w);
    else {
      const gr = G.guestRaw || { held: {}, pc: {} };
      f1 = toFrame(gr, G.last[1]);
      Object.assign(f1.pressed, G.guestPressed); G.guestPressed = {};
      if (performance.now() - (G.guestAt || 0) > 400) { f1.mx = f1.my = 0; f1.held = {}; }
    }
    w.step([f0, f1]);
    const evs = w.takeEvents();
    if (evs.length) G.evBuf.push(...evs);
    if (G.mode === 'host' && w.s.tick % 2 === 0) room.sendState({ t: 's', v: packView(w.s) });
  }
  if (G.acc > DT * 8) G.acc = 0;
  G.view = packView(w.s);
}

function tickGame(dt, now) {
  if (G.mode === 'guest') {
    guestFrame(dt, now);
  } else {
    simulate(dt);
    if (G.mode === 'host' && G.evBuf.length) room.send({ t: 'e', e: G.evBuf });
  }
  const view = G.view;
  if (!view) { R.g.setTransform(1, 0, 0, 1, 0, 0); R.g.fillStyle = '#0b1018'; R.g.fillRect(0, 0, R.cv.width, R.cv.height); return; }
  if (G.evBuf.length) { R.events(G.evBuf, view, sfx); G.evBuf = []; }
  const me = myFighter(view);
  let aim = null;
  if (G.ui && me && !me.dead && me.rsp <= 0) {
    const sk = HEROES[me.hero].skills[G.ui.k];
    if (sk && sk.shape) {
      const ang = Math.atan2(G.ui.ay - me.y, G.ui.ax - me.x);
      let px = G.ui.ax, py = G.ui.ay;
      if (sk.shape.type === 'point') { const d = Math.hypot(px - me.x, py - me.y), m = sk.shape.range; if (d > m) { px = me.x + Math.cos(ang) * m; py = me.y + Math.sin(ang) * m; } }
      aim = { shape: sk.shape, x: me.x, y: me.y, ang, px, py, cancel: G.ui.cancel };
    }
  }
  let netInfo = null;
  if (room && G.mode !== 'offline') netInfo = `${G.mode === 'host' ? 'Chủ phòng' : 'Khách'} • ping ${Math.round(room.rtt)}ms`;
  R.draw(view, { dt, me: G.me, aim, netInfo });
  R.g.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  input.drawStick(R.g);
  input.updateButtons(me);
  if (view.phase === 'over' && !G.resultShown) {
    G.resultShown = true;
    setTimeout(() => { if (G && G.view && G.view.phase === 'over') showResult(); }, 1600);
  }
}

// ---------- máy khách online ----------
function guestFrame(dt, now) {
  const snaps = G.snaps;
  const latest = snaps[snaps.length - 1];
  const me = latest ? latest.v.f[G.me] : null;
  const raw = input.poll(G.view ? G.view.f[G.me] : me, G.view ? G.view.f[1 - G.me] : null);
  G.ui = raw.ui;
  // gửi input mỗi khung (rút gọn khi không đổi)
  const pack = { t: 'i', mx: +raw.mx.toFixed(2), my: +raw.my.toFixed(2), ax: Math.round(raw.ax), ay: Math.round(raw.ay), aim: raw.aim ? 1 : 0, held: raw.held, pc: raw.pc };
  const key = JSON.stringify(pack);
  G.sendT -= dt;
  if (key !== G.lastSent || G.sendT <= 0) { room.send(pack); G.lastSent = key; G.sendT = 0.1; }
  if (!latest) return;
  // nội suy: vẽ trễ ~2 snapshot để mượt
  const target = now - 70;
  let a = null, b = null;
  for (let i = snaps.length - 1; i >= 0; i--) { if (snaps[i].at <= target) { a = snaps[i]; b = snaps[i + 1] || null; break; } }
  let view;
  if (a && b) view = lerpView(a.v, b.v, Math.min(1, (target - a.at) / Math.max(1, b.at - a.at)));
  else view = (a || snaps[0]).v;
  // nhân vật của mình: dùng snapshot mới nhất + dự đoán theo hướng đang bấm (bù độ trễ mạng)
  view = Object.assign({}, view, { f: view.f.slice() });
  const own = Object.assign({}, latest.v.f[G.me]);
  view.phase = latest.v.phase; view.winner = latest.v.winner; view.endReason = latest.v.endReason;
  const free = own.rsp <= 0 && !own.dead && own.fall <= 0 && !own.hs && !own.dash && !(own.act && own.act[3] !== 'cast') && !own.st.stun && !own.st.root && !own.st.grabbed && view.phase === 'fight';
  const H = HEROES[own.hero];
  let spd = 205 * H.speed * (own.st.haste ? 1 + own.st.haste[2] : 1) * (own.st.slow ? 1 - own.st.slow[2] : 1) * (own.ch ? H.skills[own.ch[0]].chargeMove ?? 0.4 : 1);
  const lat = Math.min(0.15, (room.rtt / 2 + 20) / 1000 + (now - latest.at) / 1000);
  const tx = free ? raw.mx * spd * lat : 0, ty = free ? raw.my * spd * lat : 0;
  const k = 1 - Math.exp(-dt * 14);
  G.pred = G.pred || { x: 0, y: 0 };
  G.pred.x += (tx - G.pred.x) * k; G.pred.y += (ty - G.pred.y) * k;
  const p = { x: own.x + G.pred.x, y: own.y + G.pred.y };
  clampInside(ARENAS[view.arena], p, 0);
  own.x = p.x; own.y = p.y;
  view.f[G.me] = own;
  G.view = view;
  while (snaps.length > 2 && snaps[1].at < target - 200) snaps.shift();
}

// ====================================================================
// Màn hình
// ====================================================================
function showScreen(html) {
  if (html == null) { ui.innerHTML = ''; ui.classList.add('hidden'); return; }
  ui.innerHTML = html; ui.classList.remove('hidden'); ui.scrollTop = 0;
}

function home() {
  if (room) { room.close(); room = null; }
  lobby = null;
  endGame();
  history.replaceState(null, '', location.pathname);
  showScreen(`
  <div class="screen home">
    <div class="logo"><span>LEGACY</span><b>ĐẤU TRƯỜNG</b><small>Đối kháng 1v1 • điểm văng % • rơi đài</small></div>
    <label class="name-row">Tên của bạn <input id="nm" maxlength="14" placeholder="Đấu sĩ" value="${esc(prefs.name)}"></label>
    <div class="menu">
      <button class="big" id="b-off">🤖 Đấu với máy</button>
      <button class="big" id="b-host">🌐 Tạo phòng online</button>
      <div class="join-row"><input id="code" maxlength="6" placeholder="MÃ PHÒNG" autocomplete="off"><button id="b-join">Vào phòng</button></div>
      <button id="b-help">📖 Cách chơi</button>
    </div>
    <p class="foot">Hai người cùng mở trang này: một người tạo phòng và gửi mã, người kia nhập mã để vào. Máy tạo phòng làm chủ trận đấu.</p>
  </div>`);
  const saveName = () => { prefs.name = $('#nm').value.trim().slice(0, 14); persist(); };
  $('#nm').onchange = saveName;
  $('#b-off').onclick = () => { saveName(); offlineSelect(); };
  $('#b-host').onclick = () => { saveName(); hostRoom(); };
  $('#b-join').onclick = () => { saveName(); joinRoom($('#code').value.trim().toUpperCase()); };
  $('#code').onkeydown = (e) => { if (e.key === 'Enter') $('#b-join').click(); };
  $('#code').oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  $('#b-help').onclick = help;
}

function heroGrid(sel, id = 'grid', extra = '') {
  return `<div class="hero-grid" id="${id}">${extra}${HERO_IDS.map((h) => {
    const H = HEROES[h];
    return `<button class="hero ${h === sel ? 'sel' : ''}" data-h="${h}" style="--c:${H.color}"><i>${H.name[0]}</i><b>${H.name}</b><small>${H.role}</small></button>`;
  }).join('')}</div>`;
}
function heroDetail(h) {
  if (h === 'random') return `<div class="detail"><h3>🎲 Ngẫu nhiên</h3><p>Máy chọn ngẫu nhiên một tướng mỗi trận.</p></div>`;
  const H = HEROES[h];
  const row = (k) => { const s = H.skills[k]; return s ? `<li><b class="k">${k === 'U' ? 'Nộ' : k}</b><div><b>${s.name}</b>${s.cd ? ` <small>${s.cd}s</small>` : ''}${s.hold ? ' <small>giữ để tụ lực</small>' : ''}<p>${s.desc}</p></div></li>` : ''; };
  return `<div class="detail" style="--c:${H.color}"><h3>${H.name} <small>${H.title} • ${H.role}</small></h3>
    <p class="stats">Trọng lượng ${H.weight} • Tốc chạy ${H.speed}</p>
    <p class="passive"><b>Nội tại — ${H.passive.name}:</b> ${H.passive.desc}</p>
    <ul class="skills">${['A', 'B', 'C', 'D', 'U'].map(row).join('')}</ul></div>`;
}
function bindGrid(root, cb) { for (const b of root.querySelectorAll('.hero')) b.onclick = () => { for (const x of root.querySelectorAll('.hero')) x.classList.toggle('sel', x === b); sfx('ui'); cb(b.dataset.h); }; }
const opt = (v, label, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
function arenaOpts(cur, withRandom = true) { return (withRandom ? opt('random', '🎲 Ngẫu nhiên', cur) : '') + ARENA_IDS.map((a) => opt(a, ARENAS[a].name, cur)).join(''); }

function offlineSelect() {
  showScreen(`
  <div class="screen select">
    <div class="top"><button class="back" id="back">← Menu</button><h2>Đấu với máy</h2></div>
    <div class="cols">
      <div class="col">
        <h4>Tướng của bạn</h4>${heroGrid(prefs.hero, 'g-me')}
        <div id="d-me">${heroDetail(prefs.hero)}</div>
      </div>
      <div class="col side">
        <h4>Đối thủ</h4>
        <select id="s-foe">${opt('random', '🎲 Ngẫu nhiên', prefs.foe)}${HERO_IDS.map((h) => opt(h, HEROES[h].name, prefs.foe)).join('')}</select>
        <h4>Độ khó</h4>
        <select id="s-lv">${Object.entries(BOT_LEVELS).map(([k, v]) => opt(k, v.name, prefs.level)).join('')}${opt('dummy', 'Bù nhìn (luyện chiêu)', prefs.level)}</select>
        <h4>Sàn đấu</h4><select id="s-ar">${arenaOpts(prefs.arena)}</select>
        <h4>Số mạng</h4><select id="s-st">${STOCK_OPTS.map((n) => opt(n, n + ' mạng', prefs.stocks)).join('')}</select>
        <h4>Thời gian</h4><select id="s-tm">${TIME_OPTS.map(([v, l]) => opt(v, l, prefs.time)).join('')}</select>
        <button class="big go" id="go">⚔ VÀO TRẬN</button>
      </div>
    </div>
  </div>`);
  $('#back').onclick = home;
  bindGrid($('#g-me'), (h) => { prefs.hero = h; persist(); $('#d-me').innerHTML = heroDetail(h); });
  $('#s-foe').onchange = (e) => { prefs.foe = e.target.value; persist(); };
  $('#s-lv').onchange = (e) => { prefs.level = e.target.value; persist(); };
  $('#s-ar').onchange = (e) => { prefs.arena = e.target.value; persist(); };
  $('#s-st').onchange = (e) => { prefs.stocks = +e.target.value; persist(); };
  $('#s-tm').onchange = (e) => { prefs.time = +e.target.value; persist(); };
  $('#go').onclick = () => { sfx('ui'); startOffline(); };
}

function help() {
  showScreen(`
  <div class="screen help">
    <div class="top"><button class="back" id="back">← Menu</button><h2>Cách chơi</h2></div>
    <div class="card">
      <h4>Luật</h4>
      <p>Mỗi đòn đánh trúng cộng <b>điểm văng %</b> cho đối thủ. Điểm càng cao, đối thủ càng bị đánh văng xa. Văng ra ngoài mép sàn là <b>rơi đài</b> và mất 1 mạng. Hết mạng là thua. Hết giờ thì bên còn nhiều mạng hơn (rồi bên ít điểm văng hơn) thắng.</p>
      <p>Tự đi bộ không bị rơi đài; chỉ bị đánh văng mới rơi. Bị văng thì <b>giữ hướng ngược lại</b> để chống lực văng. Bị văng mạnh vào cột sẽ bị choáng.</p>
      <p><b>A</b> đánh thường (dồn điểm), <b>B</b> kết liễu (văng mạnh), <b>C</b> phòng thủ / cơ động, <b>D</b> đặc kỹ, <b>Nộ</b> khi thanh nộ đầy.</p>
      <h4>PC</h4>
      <p>WASD / mũi tên: di chuyển • Chuột: ngắm<br>Chuột trái / Q: A • Chuột phải / E: B • Shift / R: C • F: D • Space: Nộ<br>Giữ A để đánh liên tục. Chiêu "tụ lực" giữ nút rồi thả. Esc: tạm dừng.</p>
      <h4>Điện thoại</h4>
      <p>Chạm vùng trái màn hình để hiện cần di chuyển. Bên phải là các nút chiêu.<br>
      • <b>Chạm nhanh</b> nút: tự ngắm vào đối thủ.<br>
      • <b>Giữ và kéo</b> khỏi tâm nút: ngắm tay theo hướng kéo, thả để tung.<br>
      • Kéo vào ô <b>✕ Hủy</b> rồi thả để bỏ chiêu.<br>
      • Nút A: giữ để đánh liên tục. Nên xoay ngang màn hình.</p>
      <h4>Online</h4>
      <p>Một người bấm <b>Tạo phòng</b> rồi gửi mã (hoặc link) cho bạn. Người kia nhập mã. Cả hai chọn tướng và bấm <b>Sẵn sàng</b>. Máy tạo phòng chạy trận đấu; nên dùng máy mạnh và mạng ổn định để tạo phòng, và giữ tab mở ở phía trước.</p>
    </div>
  </div>`);
  $('#back').onclick = home;
}

function openPause() {
  if (!G) return;
  const off = G.mode === 'offline';
  if (off) G.paused = true;
  const el = document.createElement('div');
  el.className = 'pause';
  el.innerHTML = `<div class="card"><h3>${off ? 'Tạm dừng' : 'Menu'}</h3>
    ${off ? '<button class="big" id="p-res">▶ Tiếp tục</button><button id="p-re">↻ Đấu lại</button>' : '<button class="big" id="p-res">▶ Quay lại trận</button>'}
    <button id="p-quit">${off ? '⏏ Về menu' : '🏳 Rời trận (xử thua)'}</button></div>`;
  hud.appendChild(el);
  const close = () => { el.remove(); if (G) G.paused = false; lastT = performance.now(); };
  $('#p-res', el).onclick = close;
  if (off) $('#p-re', el).onclick = () => { el.remove(); startOffline(); };
  $('#p-quit', el).onclick = () => {
    el.remove();
    if (G && G.mode !== 'offline' && room) room.send({ t: 'quit' });
    home();
  };
}
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && G) { const p = $('.pause', hud); if (p) { p.remove(); G.paused = false; lastT = performance.now(); } else openPause(); }
});

function showResult(reasonText) {
  if (!G) return;
  const v = G.view, me = G.me;
  const won = v.winner === me, draw = v.winner == null;
  const reason = reasonText || { ko: 'Hạ gục', time: 'Hết giờ', forfeit: 'Đối thủ bỏ cuộc' }[v.endReason] || '';
  const st = (f) => `<div class="pl" style="--c:${HEROES[f.hero].color}"><b>${esc(f.name)}</b><small>${HEROES[f.hero].name}</small>
    <span>Gây ra: ${Math.round(f.stats.dealt)}%</span><span>Nhận: ${Math.round(f.stats.taken)}%</span><span>Hạ gục: ${f.stats.kos}</span><span>Mạng còn: ${Math.max(0, f.sk)}</span></div>`;
  const el = document.createElement('div');
  el.className = 'pause result';
  const off = G.mode === 'offline';
  el.innerHTML = `<div class="card"><h2 class="${draw ? '' : won ? 'win' : 'lose'}">${draw ? 'HÒA' : won ? 'CHIẾN THẮNG!' : 'THẤT BẠI'}</h2><p>${reason}</p>
    <div class="pls">${v.f.map(st).join('')}</div>
    ${off ? '<button class="big" id="r-again">↻ Đấu lại</button><button id="r-sel">Đổi tướng</button>' : '<button class="big" id="r-again">↻ Về phòng chờ đấu lại</button>'}
    <button id="r-home">⏏ Về menu</button></div>`;
  hud.appendChild(el);
  $('#r-home', el).onclick = () => { if (room) room.send({ t: 'quit' }); home(); };
  if (off) {
    $('#r-again', el).onclick = () => startOffline();
    $('#r-sel', el).onclick = () => { endGame(); offlineSelect(); };
  } else {
    $('#r-again', el).onclick = () => { backToLobby(); if (room) room.send({ t: 'rematch' }); };
  }
}

// ====================================================================
// Online
// ====================================================================
function netSetup() {
  room.onclose = (why, hostKeeps) => {
    if (room && room.role === 'host' && hostKeeps) {
      if (G && G.mode === 'host' && G.world && G.world.s.phase !== 'over') { G.world.forfeit(1); toast('Đối thủ đã mất kết nối — bạn thắng.'); }
      else toast('Đối thủ đã rời phòng.');
      if (lobby) { lobby.players[1] = null; lobby.ready = [false, false]; if (!G) renderLobby(); }
      return;
    }
    const inGame = !!G;
    home();
    toast(why === 'bye' ? 'Chủ phòng đã đóng phòng.' : inGame ? 'Mất kết nối với chủ phòng.' : 'Đã ngắt kết nối.', 4000);
  };
  room.onmsg = (m) => (room.role === 'host' ? hostMsg(m) : guestMsg(m));
}

async function hostRoom() {
  showScreen(`<div class="screen center"><div class="spin"></div><p>Đang tạo phòng…</p><button id="cx">Hủy</button></div>`);
  $('#cx').onclick = home;
  room = new Room();
  netSetup();
  try {
    const code = await room.host();
    if (!room) return;
    lobby = { code, players: [{ name: prefs.name || 'Chủ phòng', hero: prefs.hero }, null], ready: [false, false], arena: prefs.arena, stocks: prefs.stocks, time: prefs.time };
    history.replaceState(null, '', '?room=' + code);
    renderLobby();
  } catch (e) {
    if (room) room.close(); room = null;
    showScreen(`<div class="screen center"><p class="err">${esc(e.message)}</p><button id="bk">← Menu</button></div>`); $('#bk').onclick = home;
  }
}

async function joinRoom(code) {
  if (!validCode(code)) { toast('Mã phòng gồm 6 ký tự.'); return; }
  showScreen(`<div class="screen center"><div class="spin"></div><p>Đang vào phòng ${esc(code)}…</p><button id="cx">Hủy</button></div>`);
  $('#cx').onclick = home;
  room = new Room();
  netSetup();
  try {
    await room.join(code);
    if (!room) return;
    lobby = { code, players: [null, { name: prefs.name || 'Khách', hero: prefs.hero }], ready: [false, false], arena: 'random', stocks: 3, time: 180 };
    room.send({ t: 'hi', proto: PROTO, name: prefs.name || 'Khách', hero: prefs.hero });
    renderLobby();
  } catch (e) {
    if (room) room.close(); room = null;
    showScreen(`<div class="screen center"><p class="err">${esc(e.message)}</p><button id="bk">← Menu</button></div>`); $('#bk').onclick = home;
  }
}

function lobbyMsg() { return { t: 'lobby', players: lobby.players, ready: lobby.ready, arena: lobby.arena, stocks: lobby.stocks, time: lobby.time }; }

function hostMsg(m) {
  if (m.t === 'hi') {
    if (m.proto !== PROTO) { room.send({ t: 'err', msg: 'Hai máy đang dùng phiên bản game khác nhau — hãy tải lại trang (Ctrl+F5).' }); return; }
    if (G) endGame();
    lobby.players[1] = { name: String(m.name || 'Khách').slice(0, 14), hero: HEROES[m.hero] ? m.hero : 'valerius' };
    lobby.ready = [false, false];
    room.send(lobbyMsg()); renderLobby(); sfx('ui');
    toast('Đối thủ đã vào phòng!');
  } else if (m.t === 'pick' && lobby.players[1]) {
    if (HEROES[m.hero]) lobby.players[1].hero = m.hero;
    lobby.ready[1] = !!m.ready;
    room.send(lobbyMsg());
    if (!G) { renderLobby(); maybeStart(); }
  } else if (m.t === 'i') {
    if (!G || G.mode !== 'host') return;
    G.guestRaw = m; G.guestAt = performance.now();
    const fr = toFrame(m, G.guestPc || (G.guestPc = {}));
    Object.assign(G.guestPressed, fr.pressed);
  } else if (m.t === 'quit') {
    if (G && G.world && G.world.s.phase !== 'over') { G.world.forfeit(1); toast('Đối thủ đã rời trận — bạn thắng.'); }
  } else if (m.t === 'rematch') {
    lobby.ready[1] = false;
    if (!G) renderLobby();
  } else if (m.t === 'bye') {
    room.onclose('bye', true);
  }
}

function guestMsg(m) {
  if (m.t === 'lobby') {
    const mine = lobby.players[1];
    lobby.players = m.players; lobby.ready = m.ready; lobby.arena = m.arena; lobby.stocks = m.stocks; lobby.time = m.time;
    if (mine && lobby.players[1]) lobby.players[1].hero = mine.hero;
    if (!G) renderLobby();
  } else if (m.t === 'start') {
    beginGame({ mode: 'guest', me: 1, cfg: m.cfg, view: null });
  } else if (m.t === 's') {
    if (!G || G.mode !== 'guest') return;
    const v = m.v, s = G.snaps;
    if (s.length && v.tick <= s[s.length - 1].v.tick) return; // gói cũ
    // thời điểm hiển thị theo tick của host (ổn định hơn giờ nhận gói)
    const at = performance.now();
    const est = s.length ? s[s.length - 1].at + (v.tick - s[s.length - 1].v.tick) * (1000 / 60) : at;
    s.push({ v, at: Math.abs(est - at) > 120 ? at : est * 0.8 + at * 0.2 });
    if (s.length > 40) s.shift();
  } else if (m.t === 'e') {
    if (G) G.evBuf.push(...m.e);
  } else if (m.t === 'err') {
    toast(m.msg, 6000); home();
  } else if (m.t === 'full') {
    toast('Phòng đã đủ 2 người.', 4000); home();
  } else if (m.t === 'bye') {
    room.onclose('bye', false);
  }
}

function backToLobby() {
  endGame();
  const mi = room && room.role === 'host' ? 0 : 1;
  lobby.ready[mi] = false;
  syncPick();
  renderLobby();
}

function renderLobby() {
  if (!lobby || G) return;
  const host = room.role === 'host', mi = host ? 0 : 1;
  const me = lobby.players[mi], other = lobby.players[1 - mi];
  const link = location.origin + location.pathname + '?room=' + lobby.code;
  const pl = (p, i) => p ? `<div class="pl ${lobby.ready[i] ? 'ready' : ''}" style="--c:${HEROES[p.hero].color}"><b>${esc(p.name)}${i === mi ? ' (bạn)' : ''}</b><small>${HEROES[p.hero].name}</small><em>${lobby.ready[i] ? '✔ Sẵn sàng' : 'Đang chọn…'}</em></div>`
    : `<div class="pl empty"><b>Đang chờ đối thủ…</b><small>Gửi mã phòng cho bạn bè</small></div>`;
  const tl = (TIME_OPTS.find(([v]) => v === lobby.time) || [0, ''])[1];
  showScreen(`
  <div class="screen select lobby">
    <div class="top"><button class="back" id="back">← Rời phòng</button><h2>Phòng <span class="code">${lobby.code}</span></h2>
      <button id="copy">📋 Sao chép link</button></div>
    <div class="vs">${pl(lobby.players[0], 0)}<span>VS</span>${pl(lobby.players[1], 1)}</div>
    <div class="cols">
      <div class="col">
        <h4>Chọn tướng</h4>${heroGrid(me.hero, 'g-me')}
        <div id="d-me">${heroDetail(me.hero)}</div>
      </div>
      <div class="col side">
        <h4>Sàn đấu</h4>${host ? `<select id="s-ar">${arenaOpts(lobby.arena)}</select>` : `<p class="ro">${lobby.arena === 'random' ? '🎲 Ngẫu nhiên' : ARENAS[lobby.arena].name}</p>`}
        <h4>Số mạng</h4>${host ? `<select id="s-st">${STOCK_OPTS.map((n) => opt(n, n + ' mạng', lobby.stocks)).join('')}</select>` : `<p class="ro">${lobby.stocks} mạng</p>`}
        <h4>Thời gian</h4>${host ? `<select id="s-tm">${TIME_OPTS.map(([v, l]) => opt(v, l, lobby.time)).join('')}</select>` : `<p class="ro">${tl}</p>`}
        <button class="big go ${lobby.ready[mi] ? 'on' : ''}" id="rdy" ${other ? '' : 'disabled'}>${lobby.ready[mi] ? '✔ Đã sẵn sàng (bấm để hủy)' : '⚔ SẴN SÀNG'}</button>
        <p class="hint">${!other ? 'Chưa có đối thủ.' : lobby.ready[1 - mi] ? 'Đối thủ đã sẵn sàng!' : 'Chờ đối thủ sẵn sàng.'}</p>
      </div>
    </div>
  </div>`);
  $('#back').onclick = () => home();
  $('#copy').onclick = () => { navigator.clipboard?.writeText(link).then(() => toast('Đã sao chép link phòng!'), () => toast(link, 6000)); };
  bindGrid($('#g-me'), (h) => {
    me.hero = h; prefs.hero = h; persist(); lobby.ready[mi] = false;
    $('#d-me').innerHTML = heroDetail(h);
    syncPick(); renderLobby();
  });
  if (host) {
    $('#s-ar').onchange = (e) => { lobby.arena = e.target.value; prefs.arena = lobby.arena; persist(); lobby.ready = [false, false]; syncPick(); renderLobby(); };
    $('#s-st').onchange = (e) => { lobby.stocks = +e.target.value; prefs.stocks = lobby.stocks; persist(); lobby.ready = [false, false]; syncPick(); renderLobby(); };
    $('#s-tm').onchange = (e) => { lobby.time = +e.target.value; prefs.time = lobby.time; persist(); lobby.ready = [false, false]; syncPick(); renderLobby(); };
  }
  $('#rdy').onclick = () => { lobby.ready[mi] = !lobby.ready[mi]; sfx('ui'); syncPick(); renderLobby(); maybeStart(); };
}
function syncPick() {
  if (!room) return;
  if (room.role === 'host') room.send(lobbyMsg());
  else room.send({ t: 'pick', hero: lobby.players[1].hero, ready: lobby.ready[1] });
}
function maybeStart() {
  if (!room || room.role !== 'host' || !lobby.players[1] || !lobby.ready[0] || !lobby.ready[1] || G) return;
  const arena = lobby.arena === 'random' ? pickRandom(ARENA_IDS) : lobby.arena;
  const heroes = [lobby.players[0].hero, lobby.players[1].hero], names = [lobby.players[0].name, lobby.players[1].name];
  const cfg = { arena, heroes, names, stocks: lobby.stocks, timeLimit: lobby.time, seed: (Math.random() * 2 ** 32) >>> 0 };
  room.send({ t: 'start', cfg });
  lobby.ready = [false, false];
  const world = new World(cfg);
  beginGame({ mode: 'host', world, me: 0, cfg });
}

// ====================================================================
// Khởi động
// ====================================================================
const qp = new URLSearchParams(location.search).get('room');
home();
if (qp && validCode(qp.toUpperCase())) {
  // vào bằng link: điền mã sẵn, người chơi bấm để có cử chỉ người dùng (âm thanh/toàn màn hình)
  $('#code').value = qp.toUpperCase();
  toast('Đã điền mã phòng — bấm "Vào phòng" để tham gia.', 5000);
}
window.__arena = { get G() { return G; }, get room() { return room; }, R, input };
