// Âm thanh tổng hợp bằng WebAudio — không cần tải file, nhẹ cho điện thoại.
let ctx = null, master = null, noiseBuf = null, muted = false;
try { muted = localStorage.getItem('arena_mute') === '1'; } catch {}

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}
export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('arena_mute', muted ? '1' : '0'); } catch {}
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}
function env(g, t, a, peak, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
function noise(dur, freq, q, vol, type = 'bandpass', sweep) {
  const t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur); f.Q.value = q;
  env(g, t, 0.005, vol, dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.05);
}
function tone(freq, dur, vol, type = 'sine', to) {
  const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  env(g, t, 0.005, vol, dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
let lastHit = 0;
export function sfx(name, a, b) {
  if (!ctx || muted) return;
  try {
    switch (name) {
      case 'hit': {
        const now = ctx.currentTime; if (now - lastHit < 0.03) return; lastHit = now;
        const m = a || 0;
        if (b) { tone(900, 0.08, 0.15, 'triangle', 600); return; }
        noise(0.08 + Math.min(0.2, m / 3000), 1400 - Math.min(900, m), 1.2, 0.5);
        tone(160 - Math.min(90, m / 10), 0.12 + Math.min(0.25, m / 2500), 0.4 + Math.min(0.4, m / 1500), 'sine', 50);
        break;
      }
      case 'cast': if (a === 'A' || a === 'B' || a === 'D') noise(0.09, 2500, 0.8, 0.12, 'bandpass', 900); else if (a === 'C') noise(0.14, 800, 0.6, 0.1, 'bandpass', 3000); break;
      case 'gun': noise(0.05, 3000, 0.7, 0.25, 'highpass'); tone(220, 0.05, 0.15, 'square', 80); break;
      case 'boom': noise(0.4 * (a || 0.6) + 0.15, 500, 0.6, 0.5, 'lowpass', 80); tone(90, 0.35, 0.4, 'sine', 35); break;
      case 'wall': noise(0.12, 300, 1, 0.4, 'lowpass'); break;
      case 'ko': noise(0.7, 900, 0.5, 0.6, 'lowpass', 60); tone(300, 0.6, 0.35, 'sawtooth', 50); break;
      case 'count': tone(a > 0 ? 520 : 880, a > 0 ? 0.12 : 0.35, 0.25, 'square'); break;
      case 'ult': tone(300, 0.5, 0.25, 'sawtooth', 900); noise(0.4, 2000, 0.5, 0.15, 'bandpass', 6000); break;
      case 'end': tone(523, 0.18, 0.2, 'triangle'); setTimeout(() => tone(659, 0.18, 0.2, 'triangle'), 160); setTimeout(() => tone(784, 0.35, 0.2, 'triangle'), 320); break;
      case 'ui': tone(700, 0.05, 0.12, 'triangle'); break;
    }
  } catch {}
}
