// Đo từng tướng: điểm văng gây ra mỗi phút, % trung bình của đối thủ khi bị hạ (thấp = kết liễu sớm), tự rơi.
import { World } from '../src/engine/world.js';
import { Bot } from '../src/engine/bot.js';
import { HERO_IDS } from '../src/engine/heroes.js';
import { ARENA_IDS } from '../src/engine/arena.js';
const N = +process.argv[2] || 2, LV = process.argv[3] || 'normal';
const M = {}; for (const h of HERO_IDS) M[h] = { dealt: 0, time: 0, koPct: [], died: [], wins: 0, games: 0 };
let seed = 1;
for (const a of HERO_IDS) for (const b of HERO_IDS) { if (a === b) continue; for (let i = 0; i < N; i++) {
  const w = new World({ arena: ARENA_IDS[seed % ARENA_IDS.length], heroes: [a, b], seed: seed++ });
  const bots = [new Bot(0, LV, seed), new Bot(1, LV, seed + 77)];
  while (w.s.phase !== 'over' && w.s.tick < 60 * 200) {
    w.step([bots[0].input(w), bots[1].input(w)]);
    for (const e of w.takeEvents()) if (e.type === 'ko') { const f = w.fighter(e.fid), k = w.foe(f); M[k.hero].koPct.push(f.percent); M[f.hero].died.push(f.percent); }
  }
  for (const f of w.s.fighters) { M[f.hero].dealt += f.stats.dealt; M[f.hero].time += w.s.clock; M[f.hero].games++; if (w.s.winner === f.slot) M[f.hero].wins++; }
} }
for (const h of HERO_IDS) { const m = M[h], ko = m.koPct.reduce((x, y) => x + y, 0) / (m.koPct.length || 1), di = m.died.reduce((x, y) => x + y, 0) / (m.died.length || 1);
  console.log(h.padEnd(9), 'thắng', String(Math.round(100 * m.wins / m.games)).padStart(3) + '%', '| %/phút', (m.dealt / m.time * 60).toFixed(0).padStart(4), '| KO đối thủ ở', ko.toFixed(0).padStart(4) + '%', '| bị hạ ở', di.toFixed(0).padStart(4) + '%'); }
