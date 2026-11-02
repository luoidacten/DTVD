// ===== Võ Đài 8 người solo (tham khảo chế độ Võ Đài của Liên Minh) =====
// Mỗi vòng: 4 cặp 1v1 đấu song song, sàn thu hẹp dần. Thua mất Máu Võ Đài; về 0 bị loại.
// Giữa các vòng: chọn Lõi Nâng Cấp (vòng 1, 3, 5, 7…) và mua trang bị. Không phụ thuộc DOM — chạy được trong Node.
import { World } from './world.js';
import { Bot } from './bot.js';
import { makeRng } from './math.js';
import { ARENA_IDS } from './arena.js';
import { HERO_IDS, HEROES } from './heroes.js';
import { ITEMS, AUGS, ITEM_IDS, AUG_IDS, MAX_ITEMS, PERKS } from './loot.js';

export const RULES = {
  hp: 20, stocks: 2, roundTime: 75, ring: { start: 25, end: 65, min: 0.5 },
  augRounds: [1, 3, 5, 7, 9], goldStart: 500, goldWin: 450, goldLose: 380, goldKO: 60, sellBack: 0.7,
};
const AUG_TIER = (round) => (round <= 1 ? 1 : round <= 3 ? 2 : round <= 5 ? 3 : 2 + (round % 2));

// Tính cách bot (lấy từ bản cũ): ảnh hưởng độ hung hăng, sợ mép, cách chọn lõi và đồ
export const PERSONAS = {
  hobao: { name: 'Hổ Báo', icon: '🔥', aggr: 1.25, edge: 0.8, like: { dmg: 3, kb: 3, crit: 2, critD: 2, spd: 1 } },
  li: { name: 'Lì Lợm', icon: '🪨', aggr: 0.85, edge: 1.3, like: { wt: 3, ten: 3, stocks: 4, ccr: 1 } },
  amsat: { name: 'Ám Sát', icon: '🗡', aggr: 1.1, edge: 1, like: { crit: 3, critD: 3, spd: 2, dmg: 1 } },
  conbac: { name: 'Con Bạc', icon: '🎲', aggr: 1.15, edge: 0.9, like: { crit: 2, critD: 2, kb: 2, rage: 2 }, gamble: 1 },
  vosi: { name: 'Võ Sĩ Danh Dự', icon: '⚔', aggr: 1.05, edge: 1.1, like: { dmg: 2, kb: 2, wt: 2, ten: 2, cdr: 1 } },
  chuot: { name: 'Chuột Lũi', icon: '🐀', aggr: 0.75, edge: 1.5, like: { spd: 3, ten: 2, wt: 2, cdr: 2 } },
};
export const PERSONA_IDS = Object.keys(PERSONAS);

export class Tournament {
  // players: [{ name, hero, human, level, persona }] (8 người; thiếu thì tự lấp bot)
  constructor({ players, seed = (Math.random() * 2 ** 32) >>> 0 }) {
    this.rng = makeRng(seed); this.seed = seed;
    const used = new Set(players.map((p) => p.hero).filter(Boolean));
    const ps = players.slice(0, 8);
    while (ps.length < 8) ps.push({ bot: true });
    this.ps = ps.map((p, i) => {
      let hero = p.hero;
      if (!hero) { const free = HERO_IDS.filter((h) => !used.has(h)); hero = free[Math.floor(this.rng() * free.length)] || HERO_IDS[0]; used.add(hero); }
      const persona = p.persona || (p.human ? null : PERSONA_IDS[Math.floor(this.rng() * PERSONA_IDS.length)]);
      return { id: i, name: p.name || (persona ? PERSONAS[persona].icon + ' ' + heroName(hero) : 'Người chơi'), hero, human: !!p.human, level: p.level || 'normal', persona,
        hp: RULES.hp, gold: RULES.goldStart, items: [], augs: [], alive: true, place: 0, offer: null, rerolls: 1, wins: 0, losses: 0, last: -1, ready: false };
    });
    this.round = 0; this.phase = 'prep'; this.duels = []; this.log = []; this.over = false;
    this.prep();
  }
  r(n) { return Math.floor(this.rng() * n); }
  alive() { return this.ps.filter((p) => p.alive); }
  get(id) { return this.ps[id]; }

  // ---------- giữa vòng ----------
  prep() {
    this.round++; this.phase = 'prep';
    const aug = RULES.augRounds.includes(this.round);
    for (const p of this.alive()) {
      p.ready = false; p.offer = aug ? this.rollAugs(p) : null;
      if (!p.human) this.botPrep(p);
    }
  }
  rollAugs(p) {
    const tier = AUG_TIER(this.round), pool = AUG_IDS.filter((id) => AUGS[id].tier === tier && !p.augs.includes(id));
    const out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(this.r(pool.length), 1)[0]);
    return out;
  }
  reroll(p) { if (!p.offer || p.rerolls <= 0) return false; p.rerolls--; p.offer = this.rollAugs(p); return true; }
  pickAug(p, id) { if (!p.offer || !p.offer.includes(id)) return false; p.augs.push(id); p.offer = null; return true; }
  buy(p, id) {
    const it = ITEMS[id];
    if (!it || p.gold < it.price || p.items.length >= MAX_ITEMS || p.items.includes(id)) return false;
    p.gold -= it.price; p.items.push(id); return true;
  }
  sell(p, id) { const i = p.items.indexOf(id); if (i < 0) return false; p.items.splice(i, 1); p.gold += Math.floor(ITEMS[id].price * RULES.sellBack); return true; }
  setReady(p, v = true) { if (p.offer && v) return false; p.ready = v; return true; }
  allReady() { return this.alive().every((p) => p.ready); }

  // Bot: chọn lõi + mua đồ theo tính cách
  score(p, perk) {
    const P = PERSONAS[p.persona] || PERSONAS.vosi;
    let s = 1 + this.rng() * (P.gamble ? 2 : 0.8);
    for (const [k, v] of Object.entries(perk.mods || {})) s += (P.like[k] || 0.5) * v * (k === 'stocks' ? 1 : 4);
    if (!perk.mods || Object.keys(perk.mods).length === 0) s += 1.2;
    return s;
  }
  botPrep(p) {
    if (p.offer) { if (p.rerolls > 0 && this.rng() < 0.15) this.reroll(p); const best = p.offer.slice().sort((a, b) => this.score(p, AUGS[b]) - this.score(p, AUGS[a]))[0]; this.pickAug(p, best); }
    for (let guard = 0; guard < 8; guard++) {
      const can = ITEM_IDS.filter((id) => !p.items.includes(id) && ITEMS[id].price <= p.gold);
      if (!can.length) break;
      if (p.items.length >= MAX_ITEMS) {
        // đổi món bậc thấp lấy món bậc cao khi đủ tiền
        const low = p.items.slice().sort((a, b) => ITEMS[a].tier - ITEMS[b].tier)[0];
        const hi = can.filter((id) => ITEMS[id].tier > ITEMS[low].tier && ITEMS[id].price <= p.gold + ITEMS[low].price * RULES.sellBack);
        if (!hi.length) break;
        this.sell(p, low);
        continue;
      }
      const top = Math.max(...can.map((id) => ITEMS[id].tier));
      if (top < 3 && p.gold < 1000 && this.round >= 3 && p.items.length >= 3 && this.rng() < 0.6) break; // để dành mua đồ bậc 3
      const pick = can.filter((id) => ITEMS[id].tier === top).sort((a, b) => this.score(p, ITEMS[b]) - this.score(p, ITEMS[a]))[0];
      this.buy(p, pick);
    }
    p.ready = true;
  }

  // ---------- ghép cặp & bắt đầu vòng ----------
  start() {
    const al = this.alive().slice().sort((a, b) => b.hp - a.hp || this.rng() - 0.5);
    const pairs = [], left = al.slice();
    while (left.length > 1) {
      const a = left.shift();
      let j = left.findIndex((b) => b.id !== a.last);
      if (j < 0) j = 0;
      pairs.push([a, left.splice(j, 1)[0]]);
    }
    if (left.length) {
      // số người lẻ: đấu với bóng ma (bản sao một người đã bị loại)
      const dead = this.ps.filter((p) => !p.alive);
      const src = dead.length ? dead[this.r(dead.length)] : al[this.r(al.length)];
      pairs.push([left[0], { id: -1, ghost: true, name: '👻 ' + src.name, hero: src.hero, items: src.items.slice(), augs: src.augs.slice(), level: 'normal', persona: src.persona || 'vosi', human: false }]);
    }
    const arena = ARENA_IDS.filter((a) => a !== 'troi')[this.r(ARENA_IDS.length - 1)];
    this.duels = pairs.map(([a, b], i) => this.makeDuel(a, b, arena, i));
    this.phase = 'fight';
    this.log.push({ round: this.round, pairs: pairs.map(([a, b]) => [a.id, b.id]) });
  }
  makeDuel(a, b, arena, i) {
    const w = new World({
      arena, heroes: [a.hero, b.hero], names: [a.name, b.name], stocks: RULES.stocks, timeLimit: RULES.roundTime,
      perks: [a.items.concat(a.augs), b.items.concat(b.augs)], ring: RULES.ring, flowers: true, seed: (this.seed + this.round * 977 + i * 131) >>> 0,
    });
    const mk = (p, slot) => (p.human ? null : new Bot(slot, p.level, (this.seed + this.round * 31 + slot + i * 7) >>> 0, PERSONAS[p.persona]));
    return { i, a: a.id, b: b.id, ghost: b.ghost ? b : null, world: w, bots: [mk(a, 0), mk(b, 1)], done: false, res: null };
  }
  duelOf(pid) { return this.duels.find((d) => d.a === pid || d.b === pid) || null; }

  // humanInput(pid, slot, world) → khung input cho người thật (null = đứng yên)
  step(humanInput) {
    for (const d of this.duels) {
      if (d.done) continue;
      const w = d.world;
      const inp = [0, 1].map((slot) => d.bots[slot] ? d.bots[slot].input(w) : (humanInput && humanInput(slot ? d.b : d.a, slot, w)) || undefined);
      w.step(inp);
      if (w.s.phase === 'over' && !d.endT) d.endT = w.s.t;
      if (d.endT && w.s.t - d.endT > 1.2) this.finishDuel(d);
    }
    if (this.phase === 'fight' && this.duels.every((d) => d.done)) this.endRound();
  }
  finishDuel(d) {
    if (d.done) return;
    d.done = true;
    const w = d.world, [fa, fb] = w.s.fighters;
    let win = w.s.winner;
    if (win == null) win = fa.percent <= fb.percent ? 0 : 1;
    const W = win === 0 ? this.get(d.a) : d.ghost || this.get(d.b), L = win === 0 ? (d.ghost || this.get(d.b)) : this.get(d.a);
    const wf = w.s.fighters[win];
    const loss = 2 + Math.floor(this.round / 2) + Math.max(0, wf.stocks);
    if (!L.ghost) { L.hp = Math.max(0, L.hp - loss); L.losses++; L.gold += RULES.goldLose; L.last = W.ghost ? -1 : W.id; }
    if (!W.ghost) { W.wins++; W.gold += RULES.goldWin; W.last = L.ghost ? -1 : L.id; }
    for (const [p, f] of [[this.get(d.a), fa], [d.ghost ? null : this.get(d.b), fb]]) if (p) p.gold += RULES.goldKO * f.stats.kos;
    d.res = { winner: W.id, loser: L.id, loss: L.ghost ? 0 : loss, reason: w.s.endReason };
  }
  // bỏ qua phần còn lại của các trận bot (khi người chơi xong trước)
  fastForward(maxTicks = 60 * 120) {
    for (let k = 0; k < maxTicks && this.phase === 'fight'; k++) this.step(null);
  }
  endRound() {
    const dying = this.alive().filter((p) => p.hp <= 0).sort((a, b) => a.hp - b.hp);
    let rank = this.alive().length;
    for (const p of dying) { p.alive = false; p.place = rank--; }
    this.phase = 'result';
    if (this.alive().length <= 1) {
      const w = this.alive()[0]; if (w) w.place = 1;
      this.phase = 'over'; this.over = true;
    }
  }
  next() { if (this.phase === 'result') this.prep(); }
  standings() { return this.ps.slice().sort((a, b) => (b.alive - a.alive) || (a.alive ? b.hp - a.hp : a.place - b.place)); }
}
function heroName(h) { return HEROES[h] ? HEROES[h].name : h; }
export { PERKS };
