// Chơi thử Võ Đài trong trình duyệt: chọn lõi, mua đồ, đánh vòng 1, bỏ qua, sang vòng 2.
const { chromium } = require('playwright');
const base = process.argv[2] || 'http://127.0.0.1:8765/index.html', out = process.argv[3] || '.';
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = []; p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base); await p.click('#b-arena'); await p.click('.hero[data-h="zero"]'); await p.click('#go');
  await p.click('.aug >> nth=0');
  await p.click('[data-buy="it_whet"]');
  await p.screenshot({ path: out + '/a1-prep.png', fullPage: true });
  await p.click('#ready'); await p.waitForTimeout(4000);
  for (const k of ['KeyQ', 'KeyE', 'KeyF']) { await p.keyboard.down(k); await p.waitForTimeout(150); await p.keyboard.up(k); }
  await p.screenshot({ path: out + '/a2-fight.png' });
  // dồn nhanh: cho bot đánh thay để kết thúc vòng
  await p.evaluate(() => { const G = window.__arena.G; G.T.duelOf(G.pid).world.forfeit(G.me); });
  await p.waitForTimeout(2500);
  await p.click('#ab-ff').catch(() => {});
  await p.waitForSelector('#next', { timeout: 20000 });
  await p.screenshot({ path: out + '/a3-result.png', fullPage: true });
  const st = await p.evaluate(() => document.querySelector('.card').innerText);
  console.log(st);
  await p.click('#next'); await p.waitForSelector('#ready');
  console.log('vòng 2:', await p.textContent('.top h2'));
  await b.close();
  console.log(errs.length ? 'LỖI:\n' + errs.join('\n') : 'Không có lỗi console.'); process.exit(errs.length ? 1 : 0);
})();
