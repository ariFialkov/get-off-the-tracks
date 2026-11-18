// Round outcome maths.
//
// Like a slot, every round's result is decided BEFORE the round is shown: we draw a
// payout multiplier from a fixed distribution whose mean equals the target RTP, and the
// map / events / score curve are then generated to land exactly on that payout.
//
// NOTE: this runs client-side for the demo (play credits). For real-money play the draw
// must come from a certified server-side RNG — swap `drawOutcome` for a server call; the
// rest of the game only needs `{ multiplier, payout }`.

export const RTP = 0.96;

// [probability, low multiplier, high multiplier] — log-uniform inside each band.
const TIERS = [
  [0.5, 0.1, 0.5],
  [0.3, 0.5, 1],
  [0.14, 1, 2],
  [0.042, 2, 5],
  [0.013, 5, 15],
  [0.004, 15, 50],
  [0.0009, 50, 200],
  [0.0001, 200, 1000],
];

const bandMean = (lo, hi) => (hi - lo) / Math.log(hi / lo);
const RAW_MEAN = TIERS.reduce((s, [p, lo, hi]) => s + p * bandMean(lo, hi), 0);
// One global scale pins the theoretical mean to exactly RTP.
export const SCALE = RTP / RAW_MEAN;
export const MAX_MULTIPLIER = TIERS[TIERS.length - 1][2] * SCALE;

export function drawMultiplier(rand) {
  let r = rand();
  for (const [p, lo, hi] of TIERS) {
    if (r < p) return lo * Math.exp(rand() * Math.log(hi / lo)) * SCALE;
    r -= p;
  }
  return TIERS[0][1] * SCALE;
}

function cryptoRand() {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] / 4294967296;
}

export function drawOutcome(bet, rand = cryptoRand) {
  const m = drawMultiplier(rand);
  const payout = Math.max(0.01, Math.round(bet * m * 100) / 100);
  return { multiplier: payout / bet, payout, seed: Math.floor(rand() * 4294967296) };
}

export function paytable() {
  return TIERS.map(([p, lo, hi]) => ({ p, lo: lo * SCALE, hi: hi * SCALE }));
}
