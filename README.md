# Get Off the Tracks

A cinematic 3D runaway-train betting game for mobile and desktop (installable PWA).
One tap places the bet and launches the train; the round's payout is fixed before anything
is shown (slot-style, 96% RTP) and the map, set-pieces and score curve are generated to land
exactly on it.

Everything — models, terrain, VFX, sound — is procedural (three.js, no asset files).

## Run

```bash
npm install
npm run dev        # dev server (open the printed URL; works on a phone on the same network)
npm run build      # production PWA in dist/  (serve over https to make it installable)
npm run build:single   # one self-contained dist-single/index.html
npm run rtp        # Monte-Carlo check of the payout distribution
```

## How a round works

1. `src/outcome.js` draws the payout multiplier from a fixed paytable whose mean is the RTP.
2. `src/plan.js` turns that into a run: longer/rarer set-pieces for bigger results, filler
   smashables between them, and an indestructible obstacle at the end. Every bonus (`+` sums
   and `×` multipliers) is simulated up front, then the curve is scaled so the running total
   hits the payout exactly at impact. The base total grows exponentially with distance.
3. `src/world.js` plays it: terrain streams in chunks, event props are built lazily, and the
   camera director (`src/director.js`) runs position-synced shots and slow-mo.

The draw is client-side with demo credits. For real-money use, replace `drawOutcome` with a
call to a certified server RNG — the game only needs `{ multiplier, payout, seed }`.

## Tuning

| What | Where |
| --- | --- |
| RTP and paytable | `src/outcome.js` (`RTP`, `TIERS`) |
| Round length vs payout, event selection, score growth | `src/plan.js` |
| Set-pieces (shape, cameras, slow-mo, bonuses, rarity via `minM` / `w`) | `src/events.js` |
| Camera rigs, chase camera | `src/director.js` |
| Scenery modules and biomes | `src/props.js` |
| Train, props, vehicles | `src/train.js`, `src/models.js` |

## Debug URL parameters

`?m=25` force a multiplier · `?seed=7` fix the map · `?ev=canyon,whale` force events ·
`?q=low|high` quality · `?auto` start a round immediately.

Event keys: `wall station building intersection tunnel downhill hill highbridge cliff race
truck moto waterfall canyon storm maze viaduct helicopter whale`.
