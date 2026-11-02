// Chơi thử lần lượt cả 40 tướng trong trình duyệt: bấm mọi chiêu, giữ tụ lực, dùng Nộ; bắt lỗi console.
// node tools/all-heroes.cjs [baseURL] [outDir]
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8765/index.html', out = process.argv[3] || '.';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(base);
  const ids = await page.evaluate(async () => Object.keys((await import('./src/engine/heroes.js')).HEROES));
  let i = 0;
  for (const h of ids) {
    const before = errs.length;
    await page.evaluate(([h, foe]) => { localStorage.setItem('legacy_arena2_prefs', JSON.stringify({ hero: h, foe, level: 'normal', arena: 'go', stocks: 3, time: 180, name: 'T' })); }, [h, ids[(i + 7) % ids.length]]);
    await page.goto(base);
    await page.click('#b-off'); await page.click('#go');
    await page.waitForTimeout(3100);
    await page.evaluate(() => { const G = window.__arena.G; G.world.s.fighters[0].rage = 100; });
    await page.mouse.move(800, 360);
    for (const k of ['KeyQ', 'KeyE', 'ShiftLeft', 'KeyF', 'Space', 'KeyQ', 'KeyF', 'KeyE', 'ShiftLeft']) {
      await page.keyboard.down(k); await page.waitForTimeout(k === 'KeyE' ? 700 : 120); await page.keyboard.up(k); await page.waitForTimeout(260);
    }
    await page.keyboard.down('KeyD'); await page.waitForTimeout(500); await page.keyboard.up('KeyD');
    await page.waitForTimeout(1500);
    if (i % 8 === 0) await page.screenshot({ path: `${out}/hero-${h}.png` });
    const st = await page.evaluate(() => { const v = window.__arena.G.view; return v.f.map((f) => f.hero + ':' + Math.round(f.pc) + '%').join(' ') + ' ents=' + (v.e || []).length; });
    console.log((errs.length > before ? '✗ ' : '✓ ') + h.padEnd(11), st, errs.length > before ? errs.slice(before).join(' | ') : '');
    i++;
  }
  await browser.close();
  console.log(errs.length ? `LỖI: ${errs.length}` : 'Không có lỗi console.');
  process.exit(errs.length ? 1 : 0);
})();
