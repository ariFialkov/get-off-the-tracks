// DOM overlay: menu prompt, bet bar, running total, bonus pop-ups, milestones, title cards, result.
import { FX2D } from './fx2d.js';

const $ = (id) => document.getElementById(id);
// multiplier milestones that get a celebration; colour tier follows the last one passed
export const MILESTONES = [0.5, 1, 2, 5, 10, 25, 50, 100, 250, 500];
const TIER_NAMES = { 0.5: 'HALFWAY BACK', 1: 'IN PROFIT', 2: 'DOUBLED', 5: 'BIG RUN', 10: 'HUGE RUN', 25: 'MASSIVE', 50: 'EPIC', 100: 'LEGENDARY', 250: 'UNREAL', 500: 'MYTHIC' };

export class UI {
  constructor() {
    this.el = { root: $('ui'), score: $('score'), mult: $('mult'), pops: $('pops'), title: $('title'), flash: $('flash'), fade: $('fade'), wet: $('wet'),
      balance: $('balance'), bet: $('bet'), result: $('result'), resWin: $('res-win'), resMult: $('res-mult'), resHead: $('res-head'), prompt: $('prompt'),
      next: $('next'), nextFill: $('next-fill'), nextLbl: $('next-lbl'), speed: $('speed'), dist: $('dist'), banner: $('banner'), stars: $('res-stars') };
    this.fx = new FX2D($('fx'));
    this.fx.onMote = () => this.bump();
    this.flashV = 0; this.mode = ''; this.tier = -1; this.count = null;
    const touch = matchMedia('(pointer: coarse)').matches;
    this.verb = touch ? 'tap' : 'click';
    this.el.prompt.textContent = `${this.verb} anywhere to place bet and play`;
    $('again').textContent = `${this.verb} anywhere to play again`;
  }
  fmt(v) { return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  setMode(m) { if (m !== this.mode) { this.mode = m; this.el.root.dataset.mode = m; } }
  cinematic(on) { if (on !== this._cine) { this._cine = on; this.el.root.classList.toggle('cine', on); } }
  slowmo(on) { if (on !== this._slow) { this._slow = on; this.el.root.classList.toggle('slow', on); } }
  wallet(balance, bet) { this.el.balance.textContent = this.fmt(balance); this.el.bet.textContent = this.fmt(bet); }
  reset() { this.tier = -1; this._s = ''; this.el.root.dataset.tier = 0; this.el.pops.innerHTML = ''; this.fx.clear(); this.count = null; this.score(0, 0); }
  bump() { const s = this.el.score; s.classList.remove('bump'); void s.offsetWidth; s.classList.add('bump'); }
  score(v, mult) {
    const s = this.fmt(Math.floor(v * 100 + 1e-6) / 100);
    if (s === this._s) return;
    this._s = s; this.el.score.textContent = s; this.el.mult.textContent = '×' + mult.toFixed(2);
    // progress toward the next milestone
    let t = -1; while (t + 1 < MILESTONES.length && mult >= MILESTONES[t + 1] - 1e-9) t++;
    const lo = t >= 0 ? MILESTONES[t] : 0, hi = MILESTONES[Math.min(MILESTONES.length - 1, t + 1)];
    this.el.nextFill.style.transform = `scaleX(${Math.max(0, Math.min(1, (mult - lo) / Math.max(1e-6, hi - lo))).toFixed(3)})`;
    this.el.nextLbl.textContent = 'NEXT ×' + hi;
    if (t > this.tier) { const first = this.tier === -1 && t === -1; this.tier = t; if (t >= 0 && !first) this.milestone(MILESTONES[t], t); }
  }
  milestone(m, t) {
    this.el.root.dataset.tier = Math.min(5, t + 1);
    const b = this.el.banner; b.innerHTML = `<i>×${m}</i><span>${TIER_NAMES[m]}</span>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    const big = m >= 1;
    this.fx.confetti(big ? 70 + t * 12 : 30, this.fx.w / 2, this.fx.h * 0.34, big ? 1 : 0.7);
    this.fx.ring(this.fx.w / 2, this.fx.h * 0.2, big ? '#ffd34d' : '#ffffff', 1.2);
    if (big) this.fx.flash(['#1fc8b9', '#3b9dff', '#9478ff', '#ff5a5f', '#ffd34d'][Math.min(4, t - 1)], 0.55);
    this.onMilestone?.(m, t);
  }
  popup(label, value, big) {
    const d = document.createElement('div');
    d.className = 'pop' + (big ? ' big' : '');
    d.innerHTML = `<b>${value}</b><span>${label}</span>`;
    const dx = Math.random() * 60 - 30;
    d.style.setProperty('--dx', dx.toFixed(0) + 'px'); d.style.setProperty('--rot', (Math.random() * 8 - 4).toFixed(1) + 'deg');
    this.el.pops.appendChild(d);
    const fx = this.fx, px = fx.w / 2 + dx, py = Math.max(fx.h * 0.44, 250) + 20, r = this.el.score.getBoundingClientRect();
    fx.motes(big ? 22 : 9, px, py, r.left + r.width / 2, r.top + r.height / 2, big ? '#ff8a7a' : '#ffd34d');
    if (big) { fx.ring(px, py, '#ff7663', 1.5); fx.flash('#ff7663', 0.5); fx.confetti(50, px, py, 0.9); }
    setTimeout(() => d.remove(), 1900);
    while (this.el.pops.children.length > 4) this.el.pops.firstChild.remove();
  }
  title(text) { const t = this.el.title; t.innerHTML = `<small>INCOMING</small>${text}`; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show'); }
  flash(a) { this.flashV = Math.max(this.flashV, a); }
  wet() { const w = this.el.wet; w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); }
  fade(on) { this.el.fade.classList.toggle('on', on); }
  telemetry(kmh, km) { const a = Math.round(kmh / 2) * 2; if (a !== this._kmh) { this._kmh = a; this.el.speed.textContent = a; } const d = km.toFixed(2); if (d !== this._km) { this._km = d; this.el.dist.textContent = d; } }
  result(payout, mult, bet) {
    const win = payout >= bet;
    this.el.resHead.textContent = mult >= 100 ? 'LEGENDARY RUN' : mult >= 10 ? 'HUGE RUN' : mult >= 2 ? 'GREAT RUN' : win ? 'NICE RUN' : 'DERAILED';
    this.el.resMult.textContent = '×' + mult.toFixed(2) + ' of your bet';
    this.el.result.classList.toggle('win', win);
    const n = mult >= 10 ? 3 : mult >= 2 ? 2 : win ? 1 : 0;
    this.el.stars.innerHTML = [0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}" style="animation-delay:${0.25 + i * 0.18}s">★</i>`).join('');
    this.count = { v: 0, to: payout, t: 0 };
    if (win) { this.fx.rain(mult >= 5 ? 220 : 110); this.fx.flash('#ffd34d', 0.45); }
  }
  update(dt) {
    if (this.flashV > 0.001) { this.flashV *= Math.exp(-dt * 5); this.el.flash.style.opacity = this.flashV.toFixed(3); }
    else if (this.el.flash.style.opacity !== '0') this.el.flash.style.opacity = '0';
    if (this.count) { const c = this.count; c.t = Math.min(1, c.t + dt / 1.1); const e = 1 - Math.pow(1 - c.t, 3); this.el.resWin.textContent = this.fmt(c.to * e); if (c.t >= 1) this.count = null; }
    this.fx.update(dt);
  }
}
