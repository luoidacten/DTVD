// Kiểm tra online thật: 2 trang trình duyệt, PeerServer cục bộ, WebRTC DataChannel.
// node tools/online-smoke.cjs [baseURL] [peerPort] [outDir]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const port = +(process.argv[3] || 9000), out = process.argv[4] || '.';
const cfg = `window.ARENA_ONLINE_CONFIG = { peerjs: { host: '127.0.0.1', port: ${port}, path: '/', secure: false }, iceServers: (window.__ICE || []) };`;
(async () => {
  const browser = await chromium.launch({ args: process.env.ICE ? [] : ['--force-webrtc-ip-handling-policy=default'] });
  const errs = [];
  const mk = async (name, opts) => {
    const ctx = await browser.newContext(opts);
    await ctx.addInitScript((s) => { if (s) window.__ICE = JSON.parse(s); }, process.env.ICE || '');
    await ctx.addInitScript(cfg);
    const p = await ctx.newPage();
    p.on('console', (m) => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
    p.on('pageerror', (e) => errs.push(name + ': ' + e.message));
    await p.goto(base);
    return p;
  };
  const host = await mk('host', { viewport: { width: 1100, height: 650 } });
  const guest = await mk('guest', { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  await host.fill('#nm', 'Chủ');
  await host.click('#b-host');
  await host.waitForSelector('.code', { timeout: 20000 });
  const code = (await host.textContent('.code')).trim();
  console.log('mã phòng', code);
  await guest.fill('#nm', 'Khách');
  await guest.fill('#code', code);
  await guest.tap('#b-join');
  await guest.waitForSelector('.lobby', { timeout: 25000 });
  await host.waitForFunction(() => !document.querySelector('.pl.empty'), null, { timeout: 15000 });
  await guest.tap('.hero[data-h="borg"]');
  await host.click('.hero[data-h="ryoma"]');
  await host.selectOption('#s-ar', 'go');
  await host.waitForTimeout(300);
  await host.screenshot({ path: out + '/o1-lobby-host.png' });
  await guest.tap('#rdy');
  await host.waitForTimeout(300);
  await host.click('#rdy');
  await host.waitForFunction(() => window.__arena.G && window.__arena.G.mode === 'host', null, { timeout: 8000 });
  await guest.waitForFunction(() => window.__arena.G && window.__arena.G.mode === 'guest' && window.__arena.G.view, null, { timeout: 8000 });
  await host.waitForTimeout(3300);
  // khách di chuyển bằng cần ảo, host bấm chiêu
  const cdp = await guest.context().newCDPSession(guest);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 250, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 90, y: 250, id: 1 }] });
  const gx0 = await host.evaluate(() => window.__arena.G.view.f[1].x);
  await host.waitForTimeout(700);
  const gx1 = await host.evaluate(() => window.__arena.G.view.f[1].x);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const a = await guest.$('.tb-A'); const ab = await a.boundingBox();
  await guest.touchscreen.tap(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await host.mouse.move(700, 330);
  for (let i = 0; i < 4; i++) { await host.keyboard.press('KeyQ'); await host.waitForTimeout(250); }
  await host.waitForTimeout(800);
  const hs = await host.evaluate(() => { const v = window.__arena.G.view; return { tick: v.tick, f: v.f.map((f) => [f.hero, f.x, f.pc]) }; });
  const gs = await guest.evaluate(() => { const v = window.__arena.G.view; return { tick: v.tick, f: v.f.map((f) => [f.hero, f.x, f.pc]), rtt: window.__arena.room.rtt, st: !!window.__arena.room.st }; });
  console.log('khách di chuyển trên host:', gx0, '→', gx1);
  console.log('host', JSON.stringify(hs)); console.log('guest', JSON.stringify(gs));
  await host.screenshot({ path: out + '/o2-host.png' });
  await guest.screenshot({ path: out + '/o3-guest.png' });
  // khách rời trận → host thắng
  await guest.evaluate(() => { window.__arena.room.send({ t: 'quit' }); });
  await host.waitForFunction(() => window.__arena.G && window.__arena.G.view.phase === 'over', null, { timeout: 5000 });
  console.log('rời trận → host thắng:', await host.evaluate(() => window.__arena.G.view.winner === 0));
  await browser.close();
  const ok = gx1 < gx0 - 30 && gs.tick > 100;
  console.log(errs.length ? 'LỖI console:\n' + errs.join('\n') : 'Không có lỗi console.');
  console.log(ok ? 'ONLINE OK' : 'ONLINE FAIL');
  process.exit(ok && !errs.length ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
