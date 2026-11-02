// Rút gọn state trận thành "view" để vẽ và gửi qua mạng.
// Offline và online cùng dùng view này → renderer chỉ có một đường dữ liệu.
const r1 = (v) => Math.round(v * 10) / 10;
const r0 = Math.round;
const r2 = (v) => Math.round(v * 100) / 100;
const WS_KEYS = ['ammo', 'reload', 'exp', 'ki', 'stk', 'emp', 'grab', 'mark', 'lastAtk'];

export function packView(s) {
  return {
    tick: s.tick, t: r2(s.t), clock: r1(s.clock), phase: s.phase, cdT: r2(s.cdT), winner: s.winner, endReason: s.endReason,
    arena: s.arena, stocks: s.stocks, timeLimit: s.timeLimit,
    f: s.fighters.map(packFighter),
    p: s.projs.map((p) => [p.id, p.kind, r0(p.x), r0(p.y), r2(Math.atan2(p.vy, p.vx)), r1(p.r), p.color, p.team]),
    z: s.zones.map((z) => [z.id, z.kind, r0(z.x), r0(z.y), r0(z.r), r2(z.t), z.delay || 0, z.dur, z.team, z.color]),
  };
}

function packFighter(f) {
  const st = {};
  for (const k in f.st) st[k] = [r2(f.st[k].t), r2(f.st[k].max), r2(f.st[k].p || 0), f.st[k].n || 0];
  const ws = {};
  for (const k of WS_KEYS) if (f.ws[k] != null && f.ws[k] !== false) ws[k] = typeof f.ws[k] === 'number' ? r2(f.ws[k]) : f.ws[k];
  const a = f.act;
  return {
    id: f.id, slot: f.slot, hero: f.hero, name: f.name, x: r1(f.x), y: r1(f.y), z: r1(f.z), fa: r2(f.facing), r: f.r,
    pc: r1(f.percent), sk: f.stocks, rg: r1(f.rage), cd: { A: r2(f.cd.A), B: r2(f.cd.B), C: r2(f.cd.C), D: r2(f.cd.D), U: r2(f.cd.U) },
    st, ws, act: a ? [a.key, r2(a.t), r2(a.dur), a.anim, r2(a.ang)] : 0, ch: f.charge ? [f.charge.key, r2(f.charge.t)] : 0,
    mv: f.mvx || f.mvy ? 1 : 0, hs: f.hitstun > 0 ? 1 : 0, inv: f.invuln > 0 ? 1 : 0, fall: r2(f.falling), rsp: r2(f.respawn), dead: f.dead ? 1 : 0,
    fl: f.flash > 0 ? 1 : 0, dash: f.dash ? 1 : 0, stats: { dealt: r1(f.stats.dealt), taken: r1(f.stats.taken), kos: f.stats.kos, hits: f.stats.hits },
  };
}

// Nội suy hai view (vị trí, hướng) cho máy khách online
export function lerpView(a, b, k) {
  if (!a) return b;
  const out = Object.assign({}, b);
  out.f = b.f.map((fb) => {
    const fa = a.f.find((x) => x.id === fb.id);
    if (!fa || Math.hypot(fa.x - fb.x, fa.y - fb.y) > 200) return fb;
    const da = Math.atan2(Math.sin(fb.fa - fa.fa), Math.cos(fb.fa - fa.fa));
    return Object.assign({}, fb, { x: fa.x + (fb.x - fa.x) * k, y: fa.y + (fb.y - fa.y) * k, z: fa.z + (fb.z - fa.z) * k, fa: fa.fa + da * k });
  });
  const pa = new Map(a.p.map((p) => [p[0], p]));
  out.p = b.p.map((pb) => {
    const q = pa.get(pb[0]);
    if (!q) return pb;
    const c = pb.slice(); c[2] = q[2] + (pb[2] - q[2]) * k; c[3] = q[3] + (pb[3] - q[3]) * k;
    return c;
  });
  return out;
}
