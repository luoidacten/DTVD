// Mô phỏng hàng loạt bot vs bot: bắt lỗi, NaN, trận không kết thúc, kích thước snapshot, tỉ lệ thắng.
// node tools/sim.mjs [số trận mỗi cặp=2] [level=normal]
import { World } from '../src/engine/world.js';
import { Bot } from '../src/engine/bot.js';
import { HERO_IDS } from '../src/engine/heroes.js';
import { ARENA_IDS } from '../src/engine/arena.js';
import { packView } from '../src/engine/view.js';

const N = +process.argv[2] || 2, LV = process.argv[3] || 'normal';
const win = {}, games = {}, used = {};
let total = 0, errors = 0, timeouts = 0, maxSnap = 0, sumDur = 0, nan = 0;
const pairStats = [];
for (const a of HERO_IDS) { win[a] = 0; games[a] = 0; used[a] = {}; }
let seed = 1;
for (const a of HERO_IDS) for (const b of HERO_IDS) for (let i = 0; i < N; i++) {
  const arena = ARENA_IDS[(seed) % ARENA_IDS.length];
  const w = new World({ arena, heroes: [a, b], seed: seed++, stocks: 3, timeLimit: 180 });
  const bots = [new Bot(0, LV, seed * 7), new Bot(1, LV, seed * 13)];
  try {
    let ticks = 0;
    while (w.s.phase !== 'over' && ticks < 60 * 200) {
      const inp = [bots[0].input(w), bots[1].input(w)];
      for (const k of Object.keys(inp[0].pressed)) used[a][k] = (used[a][k] || 0) + 1;
      for (const k of Object.keys(inp[1].pressed)) used[b][k] = (used[b][k] || 0) + 1;
      w.step(inp); w.takeEvents(); ticks++;
      if (ticks % 30 === 0) {
        const js = JSON.stringify(packView(w.s));
        maxSnap = Math.max(maxSnap, js.length);
        for (const f of w.s.fighters) if (!Number.isFinite(f.x + f.y + f.percent + f.vx + f.vy)) { nan++; throw new Error('NaN ' + f.hero); }
      }
    }
    if (w.s.phase !== 'over') timeouts++;
    total++; sumDur += w.s.clock;
    if (w.s.endReason === 'time') timeouts++;
    games[a]++; games[b]++;
    if (w.s.winner === 0) win[a]++; else if (w.s.winner === 1) win[b]++;
  } catch (e) { errors++; if (errors < 6) console.error(a, 'vs', b, arena, e.stack); }
}
console.log(`trận: ${total}, lỗi: ${errors}, NaN: ${nan}, hết giờ: ${timeouts}, TB thời lượng: ${(sumDur / total).toFixed(1)}s, gói mạng lớn nhất: ${maxSnap} byte`);
for (const h of HERO_IDS) console.log(h.padEnd(9), 'thắng', (100 * win[h] / games[h]).toFixed(0).padStart(3) + '%', ' bấm:', JSON.stringify(used[h]));
process.exit(errors || nan ? 1 : 0);
