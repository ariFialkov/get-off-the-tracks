// Screen-space juice on a 2D canvas above the 3D view: confetti, reward motes that fly into
// the score, radial speed lines, colour pulses and shock rings.
const R = (a, b) => a + Math.random() * (b - a);
export const PARTY = ['#ff5a5f', '#ffd34d', '#1fc8b9', '#3b9dff', '#ff9d3c', '#ffa3c7', '#9478ff', '#ffffff'];

export class FX2D {
  constructor(canvas) {
    this.c = canvas; this.x = canvas.getContext('2d');
    this.parts = []; this.rings = []; this.pulse = null; this.speed = 0; this.t = 0;
    this.lines = Array.from({ length: 46 }, () => ({ a: R(0, 6.283), r: R(0.35, 1), l: R(0.08, 0.3), w: R(1, 3.2), s: R(0.6, 1.6) }));
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() { const d = Math.min(devicePixelRatio || 1, 2); this.d = d; this.w = innerWidth; this.h = innerHeight; this.c.width = this.w * d; this.c.height = this.h * d; }
  clear() { this.parts.length = 0; this.rings.length = 0; this.pulse = null; this.speed = 0; }
  confetti(n = 60, x = this.w / 2, y = this.h * 0.3, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = R(-Math.PI, 0) + R(-0.3, 0.3), sp = R(200, 900) * power;
      this.parts.push({ k: 0, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 150, w: R(6, 13), h: R(3, 8), r: R(0, 6), vr: R(-12, 12), c: PARTY[(Math.random() * PARTY.length) | 0], life: R(1.4, 2.6), age: 0 });
    }
  }
  rain(n = 120) { for (let i = 0; i < n; i++) this.parts.push({ k: 0, x: R(0, this.w), y: R(-this.h * 0.6, -10), vx: R(-60, 60), vy: R(120, 420), w: R(6, 13), h: R(3, 8), r: R(0, 6), vr: R(-10, 10), c: PARTY[(Math.random() * PARTY.length) | 0], life: R(2.5, 4.5), age: 0, soft: true }); }
  // glowing motes that burst out then home in on a target (the score)
  motes(n, x, y, tx, ty, color = '#ffd34d') {
    for (let i = 0; i < n; i++) { const a = R(0, 6.283), sp = R(150, 520); this.parts.push({ k: 1, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, tx, ty, s: R(4, 9), c: color, life: R(0.55, 0.9), age: 0 }); }
  }
  ring(x, y, color = '#ffffff', size = 1) { this.rings.push({ x, y, c: color, age: 0, life: 0.6, size }); }
  flash(color, a = 0.5) { this.pulse = { c: color, a, age: 0, life: 0.55 }; }
  update(dt) {
    const x = this.x, d = this.d, W = this.w, H = this.h;
    this.t += dt;
    x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, W, H);
    // colour pulse from the edges
    if (this.pulse) {
      const p = this.pulse; p.age += dt; const k = 1 - p.age / p.life;
      if (k <= 0) this.pulse = null; else { const g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, p.c); x.globalAlpha = p.a * k; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
    }
    // speed lines
    if (this.speed > 0.02) {
      const cx = W / 2, cy = H * 0.46, R0 = Math.hypot(W, H) / 2;
      x.lineCap = 'round'; x.strokeStyle = '#ffffff';
      for (const l of this.lines) {
        const ph = (this.t * l.s * 1.6 + l.r) % 1, r0 = R0 * (0.42 + 0.6 * ph), r1 = r0 + R0 * l.l * (0.6 + this.speed);
        x.globalAlpha = this.speed * 0.5 * Math.sin(ph * Math.PI); x.lineWidth = l.w;
        x.beginPath(); x.moveTo(cx + Math.cos(l.a) * r0, cy + Math.sin(l.a) * r0); x.lineTo(cx + Math.cos(l.a) * r1, cy + Math.sin(l.a) * r1); x.stroke();
      }
      x.globalAlpha = 1;
    }
    for (let i = 0; i < this.rings.length; i++) {
      const r = this.rings[i]; r.age += dt; const k = r.age / r.life;
      if (k >= 1) { this.rings.splice(i--, 1); continue; }
      x.globalAlpha = 1 - k; x.strokeStyle = r.c; x.lineWidth = 10 * (1 - k) + 1;
      x.beginPath(); x.arc(r.x, r.y, (30 + 420 * (1 - (1 - k) * (1 - k))) * r.size, 0, 6.283); x.stroke(); x.globalAlpha = 1;
    }
    for (let i = 0; i < this.parts.length; i++) {
      const p = this.parts[i]; p.age += dt; const k = p.age / p.life;
      if (k >= 1) { if (p.k === 1 && this.onMote) this.onMote(); this.parts.splice(i--, 1); continue; }
      if (p.k === 0) {
        p.vy += (p.soft ? 160 : 1300) * dt; p.vx *= 1 - 1.2 * dt; if (p.soft) p.vx += Math.sin(this.t * 3 + p.r) * 60 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt;
        x.save(); x.translate(p.x, p.y); x.rotate(p.r); x.scale(1, Math.cos(p.r * 1.7)); x.globalAlpha = Math.min(1, (1 - k) * 3); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); x.restore();
      } else {
        const e = k * k; p.vx *= 1 - 5 * dt; p.vy *= 1 - 5 * dt;
        p.x += p.vx * dt + (p.tx - p.x) * e * 0.35; p.y += p.vy * dt + (p.ty - p.y) * e * 0.35;
        x.globalAlpha = 0.95; x.fillStyle = p.c; x.shadowColor = p.c; x.shadowBlur = 14;
        x.beginPath(); x.arc(p.x, p.y, p.s * (1 - k * 0.5), 0, 6.283); x.fill(); x.shadowBlur = 0;
        x.fillStyle = '#fff'; x.beginPath(); x.arc(p.x, p.y, p.s * 0.4, 0, 6.283); x.fill();
      }
    }
    x.globalAlpha = 1;
  }
}
