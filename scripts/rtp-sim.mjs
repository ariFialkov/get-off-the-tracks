// Monte-Carlo check of the outcome distribution:  npm run rtp
import { drawOutcome, RTP, SCALE, paytable, MAX_MULTIPLIER } from '../src/outcome.js';
import { RNG } from '../src/rng.js';

const N = Number(process.argv[2] || 5_000_000);
const rng = new RNG(12345);
const rand = () => rng.next();
const bet = 1;
let paid = 0, wins = 0, max = 0;
const buckets = [0.5, 1, 2, 5, 15, 50, 200, Infinity].map((hi) => ({ hi, n: 0 }));
for (let i = 0; i < N; i++) {
  const o = drawOutcome(bet, rand);
  paid += o.payout;
  if (o.payout >= bet) wins++;
  if (o.multiplier > max) max = o.multiplier;
  buckets.find((b) => o.multiplier / SCALE < b.hi).n++;
}
console.log(`rounds: ${N.toLocaleString()}`);
console.log(`target RTP: ${(RTP * 100).toFixed(2)}%   simulated RTP: ${((paid / N / bet) * 100).toFixed(3)}%`);
console.log(`rounds paying >= bet: ${((wins / N) * 100).toFixed(2)}%   max seen: x${max.toFixed(1)} (cap x${MAX_MULTIPLIER.toFixed(1)})`);
console.log('paytable:');
for (const t of paytable()) console.log(`  p=${(t.p * 100).toFixed(2).padStart(6)}%   x${t.lo.toFixed(2)} – x${t.hi.toFixed(2)}`);
