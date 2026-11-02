// Kiểm tra trình duyệt: menu → đấu máy (PC) và điện thoại cảm ứng. node tools/smoke.cjs [baseURL] [outDir]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8765/index.html';
const out = process.argv[3] || '.';
(async () => {
  const browser = await chromium.launch();
  const errs = [];
  // ---- PC ----
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  page.on('console', (m) => { if (m.type() === 'error') errs.push('pc: ' + m.text()); });
  page.on('pageerror', (e) => errs.push('pc: ' + e.message));
  await page.goto(base);
  await page.screenshot({ path: out + '/1-home.png' });
  await page.click('#b-off');
  await page.click('.hero[data-h="gideon"]');
  await page.selectOption('#s-foe', 'elara');
  await page.selectOption('#s-ar', 'da');
  await page.screenshot({ path: out + '/2-select.png' });
  await page.click('#go');
  await page.waitForTimeout(3300);
  await page.mouse.move(900, 360);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyD');
  for (const k of ['KeyQ', 'KeyE', 'KeyF', 'ShiftLeft']) { await page.keyboard.down(k); await page.waitForTimeout(250); await page.keyboard.up(k); await page.waitForTimeout(300); }
  await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
  await page.waitForTimeout(1500);
  const st = await page.evaluate(() => { const G = window.__arena.G; return { phase: G.view.phase, f: G.view.f.map((f) => ({ h: f.hero, pc: f.pc, x: f.x, sk: f.sk })) }; });
  console.log('PC state', JSON.stringify(st));
  await page.screenshot({ path: out + '/3-fight.png' });
  // tạm dừng
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.screenshot({ path: out + '/4-pause.png' });
  await page.click('#p-quit');
  // ---- điện thoại ----
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const m = await ctx.newPage();
  m.on('console', (x) => { if (x.type() === 'error') errs.push('mob: ' + x.text()); });
  m.on('pageerror', (e) => errs.push('mob: ' + e.message));
  await m.goto(base);
  await m.tap('#b-off');
  await m.tap('.hero[data-h="zero"]');
  await m.selectOption('#s-lv', 'dummy');
  await m.tap('#go');
  await m.waitForTimeout(3300);
  const cdp = await ctx.newCDPSession(m);
  const touch = async (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  // cần trái + kéo ngắm nút B
  const b = await m.$('.tb-B'); const bb = await b.boundingBox();
  await touch('touchStart', [{ x: 150, y: 250, id: 1 }]);
  await touch('touchMove', [{ x: 210, y: 250, id: 1 }]);
  await m.waitForTimeout(400);
  await touch('touchStart', [{ x: 210, y: 250, id: 1 }, { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2, id: 2 }]);
  await touch('touchMove', [{ x: 210, y: 250, id: 1 }, { x: bb.x + bb.width / 2 - 60, y: bb.y + bb.height / 2 - 20, id: 2 }]);
  await m.waitForTimeout(300);
  await m.screenshot({ path: out + '/5-mobile-aim.png' });
  await touch('touchEnd', [{ x: 210, y: 250, id: 1 }]);
  await touch('touchEnd', []);
  await m.waitForTimeout(500);
  const ms = await m.evaluate(() => { const G = window.__arena.G; return { touch: window.__arena.input.touch, ammo: G.view.f[0].ws.ammo, x: G.view.f[0].x }; });
  console.log('mobile', JSON.stringify(ms));
  if (ms.ammo >= 9) errs.push('mob: nút B (Xả Băng) không bắn khi thả');
  await m.screenshot({ path: out + '/6-mobile.png' });
  await browser.close();
  console.log(errs.length ? 'LỖI:\n' + errs.join('\n') : 'Không có lỗi console.');
  process.exit(errs.length ? 1 : 0);
})();
