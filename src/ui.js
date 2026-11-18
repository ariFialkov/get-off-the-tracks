// DOM overlay: menu prompt, bet bar, running total, bonus pop-ups, title cards, result.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = { root: $('ui'), score: $('score'), mult: $('mult'), pops: $('pops'), title: $('title'), flash: $('flash'), fade: $('fade'), wet: $('wet'),
      balance: $('balance'), bet: $('bet'), result: $('result'), resWin: $('res-win'), resMult: $('res-mult'), resHead: $('res-head'), prompt: $('prompt') };
    this.flashV = 0; this.mode = '';
    const touch = matchMedia('(pointer: coarse)').matches;
    this.verb = touch ? 'tap' : 'click';
    this.el.prompt.textContent = `${this.verb} anywhere to place bet and play`;
    $('again').textContent = `${this.verb} anywhere to play again`;
  }
  fmt(v) { return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  setMode(m) { if (m !== this.mode) { this.mode = m; this.el.root.dataset.mode = m; } }
  cinematic(on) { if (on !== this._cine) { this._cine = on; this.el.root.classList.toggle('cine', on); } }
  wallet(balance, bet) { this.el.balance.textContent = this.fmt(balance); this.el.bet.textContent = this.fmt(bet); }
  score(v, mult) {
    const s = this.fmt(Math.floor(v * 100 + 1e-6) / 100);
    if (s !== this._s) { this._s = s; this.el.score.textContent = s; this.el.mult.textContent = '×' + mult.toFixed(2); }
  }
  popup(label, value, big) {
    const d = document.createElement('div');
    d.className = 'pop' + (big ? ' big' : '');
    d.innerHTML = `<b>${value}</b><span>${label}</span>`;
    d.style.setProperty('--dx', (Math.random() * 30 - 15).toFixed(0) + 'px');
    this.el.pops.appendChild(d);
    this.el.score.classList.remove('bump'); void this.el.score.offsetWidth; this.el.score.classList.add('bump');
    setTimeout(() => d.remove(), 1700);
    while (this.el.pops.children.length > 5) this.el.pops.firstChild.remove();
  }
  title(text) {
    const t = this.el.title; t.textContent = text; t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  }
  flash(a) { this.flashV = Math.max(this.flashV, a); }
  wet() { const w = this.el.wet; w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); }
  fade(on) { this.el.fade.classList.toggle('on', on); }
  result(payout, mult, bet) {
    const win = payout >= bet;
    this.el.resHead.textContent = mult >= 20 ? 'LEGENDARY RUN' : mult >= 5 ? 'HUGE RUN' : win ? 'NICE RUN' : 'DERAILED';
    this.el.resWin.textContent = this.fmt(payout); this.el.resMult.textContent = '×' + mult.toFixed(2) + ' of your bet';
    this.el.result.classList.toggle('win', win);
  }
  update(dt) {
    if (this.flashV > 0.001) { this.flashV *= Math.exp(-dt * 5); this.el.flash.style.opacity = this.flashV.toFixed(3); }
    else if (this.el.flash.style.opacity !== '0') this.el.flash.style.opacity = '0';
  }
}
