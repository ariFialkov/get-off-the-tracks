// The track is a height/lateral profile over z (the train always travels toward +z).
// Events add smooth lateral shifts, height steps, jumps, rail gaps and terrain "zones".
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smoother = (t) => { t = clamp(t); return t * t * t * (t * (6 * t - 15) + 10); };
// Smooth 0..1 window over [z0,z1] with soft edges of length e.
export const win = (z, z0, z1, e) => smooth(z0, z0 + e, z) * (1 - smooth(z1 - e, z1, z));

export const RAIL_H = 0.35;
export const BASE_SPEED = 78;

export class Track {
  constructor(rng, wiggleFrom = 250) {
    this.p = [rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28), rng.range(0, 6.28)];
    this.wig = wiggleFrom;
    this.curves = []; // {z0,z1,a} persistent lateral shifts
    this.steps = [];  // {z0,z1,a} persistent height shifts
    this.weaves = []; // lateral shifts of the main line only (lanes stay put)
    this.jumps = [];  // {z0,z1,h}
    this.gaps = [];   // [z0,z1] main rails not drawn
    this.zones = [];  // terrain modifiers
    this.speeds = []; // {z0,z1,m,e}
    this.lines = [];  // extra rail lines {z0,z1,off(z)}
    this.roads = [];
    this.noPoles = []; // [z0,z1] keep gantries out of cinematic shots  // roads along the track {z0,z1,off(z),w}
  }
  X0(z) {
    const k = smooth(this.wig, this.wig + 400, z);
    let x = k * (16 * Math.sin(z / 230 + this.p[0]) + 9 * Math.sin(z / 103 + this.p[1]));
    for (const c of this.curves) if (z > c.z0) x += c.a * smoother((z - c.z0) / (c.z1 - c.z0));
    return x;
  }
  weave(z) {
    let x = 0;
    for (const c of this.weaves) if (z > c.z0) x += c.a * smoother((z - c.z0) / (c.z1 - c.z0));
    return x;
  }
  X(z) { return this.X0(z) + this.weave(z); }
  Y(z) {
    const k = smooth(this.wig, this.wig + 400, z);
    let y = k * (7 * Math.sin(z / 340 + this.p[2]) + 3 * Math.sin(z / 160 + this.p[3]));
    for (const c of this.steps) if (z > c.z0) y += c.a * smoother((z - c.z0) / (c.z1 - c.z0));
    return y;
  }
  // Train height: follows the rails, or a ballistic arc while jumping.
  TY(z) {
    for (const j of this.jumps)
      if (z > j.z0 && z < j.z1) {
        const u = (z - j.z0) / (j.z1 - j.z0);
        return lerp(this.Y(j.z0), this.Y(j.z1), u) + j.h * 4 * u * (1 - u);
      }
    return this.Y(z);
  }
  airborne(z) { for (const j of this.jumps) if (z > j.z0 && z < j.z1) return true; return false; }
  inGap(z) { for (const g of this.gaps) if (z > g[0] && z < g[1]) return true; return false; }
  speed(z) {
    let m = 1;
    for (const s of this.speeds) if (z > s.z0 && z < s.z1) m *= 1 + (s.m - 1) * win(z, s.z0, s.z1, s.e || 60);
    return BASE_SPEED * m;
  }
  cover(z) {
    let c = 0;
    for (const zn of this.zones) if (zn.type === 'cover' && z > zn.z0 && z < zn.z1) c += zn.amt * win(z, zn.z0, zn.z1, zn.edge);
    return c;
  }
  busy(z) { for (const zn of this.zones) if (z > zn.z0 - 20 && z < zn.z1 + 20) return true; return false; }
  // Yaw-only frame (lat = +x side when heading +z). Position sits on the rail top.
  frame(z, out, arc = true, weave = true) {
    const X = weave ? (q) => this.X(q) : (q) => this.X0(q);
    const dx = X(z + 0.5) - X(z - 0.5);
    const len = Math.hypot(dx, 1);
    out.pos.set(X(z), (arc ? this.TY(z) : this.Y(z)) + RAIL_H, z);
    out.fwd.set(dx / len, 0, 1 / len);
    out.lat.set(1 / len, 0, -dx / len);
    return out;
  }
}

export const makeFrame = () => ({ pos: new THREE.Vector3(), fwd: new THREE.Vector3(), lat: new THREE.Vector3() });
