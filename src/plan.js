// Round planner. Given the pre-drawn payout it lays out the whole run — intro, filler
// smashables, set-piece events, and the final indestructible obstacle — then scales the
// score curve so the running total lands exactly on the payout at the moment of impact.
import * as THREE from 'three';
import { RNG } from './rng.js';
import { Track, BASE_SPEED } from './track.js';
import { EVENTS, intro, smashable, strike } from './events.js';
import { BIOMES } from './props.js';
import { MAT } from './kit.js';
import * as M from './models.js';

const GROWTH = 0.8; // per km: the base score accelerates exponentially with distance
const C = (z) => Math.exp((GROWTH * Math.max(0, z)) / 1000) - 1;

function finale(P, zE) {
  const kind = P.rng.pick(['buffer', 'buffer', 'boulder', 'bolt']);
  P.finale = { z: zE, kind };
  if (kind === 'bolt') P.storms.push({ z0: zE - 560, z1: zE + 500, e: 220 });
  P.track.zones.push({ type: 'flat', z0: zE - 150, z1: zE + 130, edge: 40, width: 46, clear: 42 });
  P.cue(zE - 64, zE + 1e6, { fix: zE - 5, o: [26, 3.2, 4], tfix: zE - 8, t: [0, 3, 0], fov: 52 }, 0);
  P.item(zE - 700, zE + 1e6, (W) => {
    for (const d of [150, 100, 55]) for (const s of [-1, 1]) { const m = new THREE.Mesh(M.warnSign(), MAT.solid); m.castShadow = true; W.place(m, zE - d, s * 7); m.userData.own = true; }
    if (kind === 'buffer') W.place(M.megaBuffer(), zE);
    else if (kind === 'boulder') { const b = M.boulder(W.terrain.biome.rock); W.place(b, zE); b.userData.own = true; }
    else {
      strike(W, zE - 330, 15, 24); strike(W, zE - 210, -13, 24);
      strike(W, zE + 7, 0, 82, true);
      W.on(zE - 75, () => { const c = M.crater(); W.place(c, zE); c.userData.own = true; });
    }
  });
}

export function makePlan({ multiplier = 1, payout = 1, seed = 1, attract = false, force = null }) {
  const rng = new RNG(seed);
  const track = new Track(rng, attract ? -1e9 : 250);
  const P = {
    track, rng, attract, steps: [], cues: [], slows: [], titles: [], items: [], storms: [], finale: null,
    add(z, w, label) { this.steps.push({ z, type: 'add', w, label }); },
    mul(z, m, label) { this.steps.push({ z, type: 'mul', m, label }); },
    cue(z0, z1, rig, blend = 0) { this.cues.push({ z0, z1, rig, blend }); },
    slow(z0, z1, s) { this.slows.push({ z0, z1, s }); },
    title(z, text) { this.titles.push({ z, text }); },
    item(z0, z1, build) { this.items.push({ z0, z1, build, state: 0 }); },
  };
  let z, zEnd, startZ;
  const used = [];
  if (attract) {
    startZ = 40; z = 260;
    for (const k of rng.shuffle(Object.keys(EVENTS))) { EVENTS[k].make(P, z); used.push({ k, z }); z += EVENTS[k].len + rng.range(140, 240); smashable(P, z - 70); }
    zEnd = z;
  } else {
    intro(P); startZ = -300;
    const dur = 4 + 15 * Math.log10(1 + 9 * multiplier);
    zEnd = Math.round(300 + dur * BASE_SPEED);
    z = 250;
    let pool = Object.keys(EVENTS).filter((k) => EVENTS[k].minM <= multiplier);
    const forced = (force || []).filter((k) => EVENTS[k]);
    let sinceEvent = 0;
    for (let guard = 0; guard < 200; guard++) {
      const rem = zEnd - z;
      const cand = pool.filter((k) => EVENTS[k].len + 170 <= rem);
      const f = forced.length ? forced[0] : null;
      if (f && EVENTS[f].len + 170 > rem) zEnd = z + EVENTS[f].len + 260; // debugging aid: make room
      if (f || (cand.length && (sinceEvent >= 2 || rng.chance(0.55)))) {
        let k = f;
        if (f) forced.shift();
        else { const ws = cand.map((c) => EVENTS[c].w + EVENTS[c].minM * 0.6); let r = rng.next() * ws.reduce((a, b) => a + b, 0); k = cand[cand.length - 1]; for (let i = 0; i < cand.length; i++) { r -= ws[i]; if (r <= 0) { k = cand[i]; break; } } }
        pool = pool.filter((c) => c !== k);
        z += rng.range(40, 80);
        EVENTS[k].make(P, z); used.push({ k, z });
        z += EVENTS[k].len + 20; sinceEvent = 0;
      } else if (rem > 270) { z += rng.range(85, 140); smashable(P, z); sinceEvent++; }
      else break;
    }
    finale(P, zEnd);
  }

  // --- score schedule: simulate in raw units, then scale to hit the payout exactly ---
  const steps = P.steps.filter((s) => s.z < zEnd - 3).sort((a, b) => a.z - b.z);
  let raw = 0, zp = 0;
  for (const s of steps) {
    raw += C(s.z) - C(zp); zp = s.z;
    if (s.type === 'add') { s.raw = s.w * (0.25 + 0.12 * raw); raw += s.raw; } else raw *= s.m;
    s.after = raw;
  }
  raw += C(zEnd) - C(zp);
  const k = payout / raw;
  const scoreAt = (q) => {
    if (q >= zEnd) return payout;
    let base = 0, z0 = 0;
    for (const s of steps) { if (s.z > q) break; base = s.after; z0 = s.z; }
    return k * (base + C(q) - C(z0));
  };
  for (const c of P.cues) if (c.z1 - c.z0 < 1e5) track.noPoles.push([c.z0 - 70, c.z1 + 70]);
  P.cues.sort((a, b) => a.z0 - b.z0); P.titles.sort((a, b) => a.z - b.z); P.items.sort((a, b) => a.z0 - b.z0);
  return { ...P, steps, zEnd, startZ, k, scoreAt, payout, multiplier, seed, used, biome: BIOMES[rng.int(0, BIOMES.length - 1)] };
}
