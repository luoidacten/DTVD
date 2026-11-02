// Tự chỉnh hệ số cân bằng: chạy bot vs bot mọi cặp, kéo tỉ lệ thắng mỗi tướng về 50%.
// node tools/autobal.mjs [vòng=4] [trận mỗi cặp=1]
import { writeFileSync } from 'node:fs';
import { World } from '../src/engine/world.js';
import { Bot } from '../src/engine/bot.js';
import { HERO_IDS } from '../src/engine/heroes.js';
import { ARENA_IDS } from '../src/engine/arena.js';
import { BAL } from '../src/engine/balance.js';
const ROUNDS = +process.argv[2] || 4, N = +process.argv[3] || 1;
const r2 = (v) => Math.round(v * 100) / 100;
for (const h of HERO_IDS) BAL[h] = Object.assign({ d: 1, k: 1, w: 1 }, BAL[h]);
let seed = 1;
for (let r = 0; r < ROUNDS; r++) {
  const win = {}, games = {};
  for (const h of HERO_IDS) { win[h] = 0; games[h] = 0; }
  for (const a of HERO_IDS) for (const b of HERO_IDS) { if (a === b) continue; for (let i = 0; i < N; i++) {
    const w = new World({ arena: ARENA_IDS[seed % ARENA_IDS.length], heroes: [a, b], seed: seed++ });
    const bots = [new Bot(0, 'normal', seed), new Bot(1, 'normal', seed + 5)];
    while (w.s.phase !== 'over' && w.s.tick < 60 * 200) { w.step([bots[0].input(w), bots[1].input(w)]); w.takeEvents(); }
    games[a]++; games[b]++;
    if (w.s.winner === 0) win[a]++; else if (w.s.winner === 1) win[b]++; else { win[a] += 0.5; win[b] += 0.5; }
  } }
  let spread = 0;
  for (const h of HERO_IDS) {
    const wr = win[h] / games[h]; spread = Math.max(spread, Math.abs(wr - 0.5));
    const k = 1 + (0.5 - wr) * 0.5;
    const B = BAL[h];
    B.d = r2(Math.min(1.6, Math.max(0.6, B.d * k))); B.k = r2(Math.min(1.6, Math.max(0.6, B.k * k))); B.w = r2(Math.min(1.4, Math.max(0.75, B.w * (1 + (0.5 - wr) * 0.2))));
  }
  console.log(`vòng ${r + 1}: lệch lớn nhất ${(spread * 100).toFixed(0)}% — ` + HERO_IDS.map((h) => `${h} ${Math.round(100 * win[h] / games[h])}`).join(', '));
}
const body = Object.entries(BAL).filter(([, v]) => v.d !== 1 || v.k !== 1 || v.w !== 1).map(([h, v]) => `  ${h}: { d: ${v.d}, k: ${v.k}, w: ${v.w} },`).join('\n');
writeFileSync(new URL('../src/engine/balance.js', import.meta.url), `// Hệ số cân bằng theo tướng (sinh bởi tools/autobal.mjs, có thể chỉnh tay).\n// d = sát thương gây ra, k = lực văng gây ra, w = trọng lượng (trụ vững)\nexport const BAL = {\n${body}\n};\n`);
console.log('đã ghi src/engine/balance.js');
