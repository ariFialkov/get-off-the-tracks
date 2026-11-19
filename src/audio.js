import { store } from './store.js';
// Tiny procedural sound kit (WebAudio, no assets). Created lazily on the first user gesture.
export class Audio {
  constructor() { this.ctx = null; this.muted = store.get('gott.mute') === '1'; }
  unlock() { if (this.dead) return; try { this._unlock(); } catch (e) { this.ctx = null; this.dead = true; } }
  _unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = (this.ctx = new AC());
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(c.destination);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // engine: filtered noise bed + low hum
    const n = c.createBufferSource(); n.buffer = buf; n.loop = true;
    this.engF = c.createBiquadFilter(); this.engF.type = 'lowpass'; this.engF.frequency.value = 300;
    this.engG = c.createGain(); this.engG.gain.value = 0;
    n.connect(this.engF); this.engF.connect(this.engG); this.engG.connect(this.master); n.start();
    this.hum = c.createOscillator(); this.hum.type = 'sawtooth'; this.hum.frequency.value = 55;
    this.humG = c.createGain(); this.humG.gain.value = 0;
    const hf = c.createBiquadFilter(); hf.type = 'lowpass'; hf.frequency.value = 220;
    this.hum.connect(hf); hf.connect(this.humG); this.humG.connect(this.master); this.hum.start();
  }
  setMuted(m) { this.muted = m; store.set('gott.mute', m ? '1' : '0'); if (this.master) this.master.gain.value = m ? 0 : 0.7; }
  engine(speed, on, dark = 0) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, k = on ? Math.min(1.6, speed) : 0;
    this.engG.gain.setTargetAtTime(0.1 * k + dark * 0.06, t, 0.12); this.engF.frequency.setTargetAtTime(160 + 520 * k, t, 0.12);
    this.humG.gain.setTargetAtTime(0.05 * k, t, 0.12); this.hum.frequency.setTargetAtTime(38 + 34 * k, t, 0.12);
  }
  burst(dur, f0, f1, gain, type = 'lowpass', q = 0.7) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime, s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.6 + Math.random() * 0.8;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(f0, f1, dur, gain, type = 'sine', delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  }
  smash(big = 1) { this.burst(0.35 * big, 2600, 300, 0.5 * Math.min(1.5, big)); this.tone(120, 40, 0.25, 0.5); }
  thud(a = 1) { this.tone(90, 30, 0.35, 0.7 * a); this.burst(0.2, 500, 100, 0.3 * a); }
  boom(a = 1) { this.tone(70, 22, 1.1, 0.9 * a); this.burst(1.4, 900, 60, 0.7 * a); }
  whoosh() { this.burst(0.7, 300, 2400, 0.25, 'bandpass', 1.2); }
  splash() { this.burst(0.9, 3800, 700, 0.35, 'highpass'); }
  thunder() { this.burst(2.2, 500, 50, 0.9); this.burst(0.15, 6000, 1500, 0.5, 'highpass'); }
  tick(a = 1) { this.burst(0.05, 3000, 1500, 0.2 * a, 'highpass'); }
  coin(big) { this.tone(big ? 660 : 880, big ? 660 : 880, 0.09, 0.16, 'triangle'); this.tone(big ? 990 : 1320, big ? 990 : 1320, 0.2, 0.16, 'triangle', 0.08); if (big) this.tone(1320, 1320, 0.35, 0.16, 'triangle', 0.17); }
  milestone(t) { const base = 392 * Math.pow(1.122, Math.max(0, t) * 2); [1, 1.26, 1.5, 2].forEach((k, i) => this.tone(base * k, base * k, 0.28, 0.2, 'triangle', i * 0.07)); this.burst(0.5, 2000, 7000, 0.12, 'highpass'); }
  win(good) { (good ? [523, 659, 784, 1047] : [392, 330]).forEach((f, i) => this.tone(f, f, 0.3, 0.2, 'triangle', i * 0.11)); }
}
