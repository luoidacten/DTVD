// Mô phỏng giải Võ Đài 8 bot: kiểm tra luôn có người thắng, không kẹt, số vòng, tướng / lõi / đồ hay vào top.
// node tools/arena-sim.mjs [số giải=20]
import { Tournament } from '../src/engine/tournament.js';
import { AUGS, ITEMS } from '../src/engine/loot.js';
const N = +process.argv[2] || 20;
let rounds = 0, ticks = 0, bad = 0, nan = 0;
const top = {}, play = {}, augWin = {}, itemWin = {};
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const T = new Tournament({ players: [], seed: 1000 + g });
  let guard = 0;
  while (!T.over && guard++ < 40) {
    T.start();
    let k = 0;
    while (T.phase === 'fight' && k++ < 60 * 200) {
      T.step(null); ticks++;
      if (k % 120 === 0) for (const d of T.duels) for (const f of d.world.s.fighters) if (!Number.isFinite(f.x + f.y + f.percent)) nan++;
    }
    if (T.phase === 'fight') { bad++; break; }
    if (!T.over) T.next();
  }
  if (!T.over) bad++;
  rounds += T.round;
  for (const p of T.ps) { play[p.hero] = (play[p.hero] || 0) + 1; if (p.place <= 3) top[p.hero] = (top[p.hero] || 0) + 1; }
  const w = T.ps.find((p) => p.place === 1);
  if (w) { for (const a of w.augs) augWin[a] = (augWin[a] || 0) + 1; for (const i of w.items) itemWin[i] = (itemWin[i] || 0) + 1; }
}
console.log(`giải: ${N}, lỗi/kẹt: ${bad}, NaN: ${nan}, TB vòng/giải: ${(rounds / N).toFixed(1)}, thời gian mô phỏng: ${((Date.now() - t0) / 1000).toFixed(0)}s, TB phút chơi/giải ≈ ${(ticks / 60 / 60 / N).toFixed(1)}`);
const rate = Object.keys(play).map((h) => [h, (top[h] || 0) / play[h]]).sort((a, b) => b[1] - a[1]);
console.log('top-3 cao:', rate.slice(0, 6).map(([h, r]) => `${h} ${Math.round(r * 100)}%`).join(', '));
console.log('top-3 thấp:', rate.slice(-6).map(([h, r]) => `${h} ${Math.round(r * 100)}%`).join(', '));
console.log('lõi của nhà vô địch:', Object.entries(augWin).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => AUGS[k].name + ' ' + v).join(', '));
console.log('đồ của nhà vô địch:', Object.entries(itemWin).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ITEMS[k].name + ' ' + v).join(', '));
process.exit(bad || nan ? 1 : 0);
