// VFX: billboard particles (soft + additive, optional velocity-stretch), instanced debris,
// rigid "bodies" for smashed pieces, lightning bolts and shock rings.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const R = (a, b) => a + Math.random() * (b - a);
const G = 26;

const VERT = `
attribute vec3 iPos; attribute vec4 iCol; attribute float iSize; attribute vec3 iAxis;
varying vec4 vCol; varying vec2 vUv;
void main(){
  vUv = position.xy; vCol = iCol;
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vec3 ax = (viewMatrix * vec4(iAxis, 0.0)).xyz;
  if (dot(ax, ax) > 0.0001) {
    vec3 side = normalize(cross(ax, mv.xyz));
    mv.xyz += ax * position.y + side * position.x * iSize;
  } else mv.xy += position.xy * iSize;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = `
varying vec4 vCol; varying vec2 vUv;
void main(){
  float d = length(vUv) * 2.0;
  float a = smoothstep(1.0, 0.25, d);
  gl_FragColor = vec4(vCol.rgb, vCol.a * a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class Particles {
  constructor(max, additive) {
    this.max = max; this.n = 0;
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aAxis = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    for (const a of [this.aPos, this.aCol, this.aSize, this.aAxis]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iPos', this.aPos); g.setAttribute('iCol', this.aCol);
    g.setAttribute('iSize', this.aSize); g.setAttribute('iAxis', this.aAxis);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 11 : 10;
    // sim state: vel(3) age life s0 s1 a0 grav drag stretch
    this.s = new Float32Array(max * 11);
  }
  spawn(x, y, z, vx, vy, vz, life, s0, s1, r, g, b, a, grav = 0, drag = 0, stretch = 0) {
    let i = this.n;
    if (i >= this.max) i = Math.floor(Math.random() * this.max); else this.n++;
    this.aPos.array.set([x, y, z], i * 3);
    this.aCol.array.set([r, g, b, a], i * 4);
    this.s.set([vx, vy, vz, 0, life, s0, s1, a, grav, drag, stretch], i * 11);
  }
  update(dt) {
    const P = this.aPos.array, Cc = this.aCol.array, S = this.aSize.array, A = this.aAxis.array, s = this.s;
    for (let i = 0; i < this.n; i++) {
      const k = i * 11;
      s[k + 3] += dt;
      if (s[k + 3] >= s[k + 4]) { // swap-remove
        const l = --this.n;
        if (l !== i) {
          P.copyWithin(i * 3, l * 3, l * 3 + 3); Cc.copyWithin(i * 4, l * 4, l * 4 + 4);
          s.copyWithin(k, l * 11, l * 11 + 11);
        }
        i--; continue;
      }
      const t = s[k + 3] / s[k + 4];
      const dr = Math.max(0, 1 - s[k + 9] * dt);
      s[k] *= dr; s[k + 1] = s[k + 1] * dr - s[k + 8] * dt; s[k + 2] *= dr;
      P[i * 3] += s[k] * dt; P[i * 3 + 1] += s[k + 1] * dt; P[i * 3 + 2] += s[k + 2] * dt;
      S[i] = s[k + 5] + (s[k + 6] - s[k + 5]) * t;
      Cc[i * 4 + 3] = s[k + 7] * Math.min(1, t * 10) * (1 - t);
      const st = s[k + 10];
      A[i * 3] = s[k] * st; A[i * 3 + 1] = s[k + 1] * st; A[i * 3 + 2] = s[k + 2] * st;
    }
    this.geo.instanceCount = this.n;
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAxis.needsUpdate = true;
  }
}

const DEBRIS_MAX = 360;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _col = new THREE.Color();
const _ax = new THREE.Vector3();

export class VFX {
  constructor(scene) {
    this.scene = scene;
    this.soft = new Particles(1500, false);
    this.add = new Particles(1500, true);
    scene.add(this.soft.mesh, this.add.mesh);
    this.debrisMesh = new THREE.InstancedMesh(new RoundedBoxGeometry(1, 1, 1, 1, 0.12), new THREE.MeshLambertMaterial(), DEBRIS_MAX);
    this.debrisMesh.frustumCulled = false; this.debrisMesh.castShadow = true;
    this.debrisMesh.count = 0;
    this.debrisMesh.setColorAt(0, _col.set(0xffffff));
    scene.add(this.debrisMesh);
    this.deb = [];
    this.bodies = [];
    this.temps = [];
  }
  clear() {
    this.soft.n = this.add.n = 0; this.deb.length = 0;
    for (const b of this.bodies) b.obj.removeFromParent();
    for (const t of this.temps) { t.obj.removeFromParent(); t.obj.geometry?.dispose(); }
    this.bodies.length = this.temps.length = 0;
  }
  // --- particle recipes -------------------------------------------------------------
  puff(p, n = 8, o = {}) {
    const { size = 3, spread = 2, color = [0.86, 0.84, 0.78], up = 3, life = 1.3, alpha = 0.55, vel = null, drag = 1.5 } = o;
    for (let i = 0; i < n; i++)
      this.soft.spawn(p.x + R(-spread, spread), p.y + R(0, spread * 0.6), p.z + R(-spread, spread),
        (vel ? vel.x : 0) + R(-spread, spread), (vel ? vel.y : 0) + R(0, up), (vel ? vel.z : 0) + R(-spread, spread),
        life * R(0.7, 1.3), size * R(0.5, 1), size * R(1.8, 2.8), color[0], color[1], color[2], alpha, -0.5, drag);
  }
  sparks(p, n = 12, o = {}) {
    const { speed = 28, color = [4, 2.2, 0.6], vel = null, life = 0.6, size = 0.28, up = 0.6 } = o;
    for (let i = 0; i < n; i++) {
      const a = R(0, 6.28), e = R(-0.3, 1) * up + 0.2, sp = speed * R(0.3, 1);
      this.add.spawn(p.x, p.y, p.z, (vel ? vel.x : 0) + Math.cos(a) * sp, (vel ? vel.y : 0) + e * sp, (vel ? vel.z : 0) + Math.sin(a) * sp,
        life * R(0.5, 1.2), size, size * 0.4, color[0], color[1], color[2], 1, G, 0.6, 0.035);
    }
  }
  explosion(p, s = 1, vel = null) {
    for (let i = 0; i < 22 * s; i++) {
      const a = R(0, 6.28), e = R(0, 1.3), sp = R(4, 16) * s;
      this.add.spawn(p.x + R(-1, 1) * s, p.y + R(0, 2) * s, p.z + R(-1, 1) * s,
        (vel ? vel.x : 0) + Math.cos(a) * sp, Math.sin(e) * sp + 3, (vel ? vel.z : 0) + Math.sin(a) * sp,
        R(0.35, 0.8), 3 * s, 9 * s, 3.2, R(1.2, 2), 0.35, 0.9, -2, 2.5);
    }
    this.puff(p, Math.round(14 * s), { size: 5 * s, spread: 4 * s, color: [0.2, 0.2, 0.22], up: 12 * s, life: 2.4, alpha: 0.6, vel });
    this.sparks(p, Math.round(26 * s), { speed: 45 * s, vel });
    this.ring(p, 0xffe0a0, 30 * s);
  }
  splash(p, s = 1, vel = null) {
    for (let i = 0; i < 26 * s; i++) {
      const a = R(0, 6.28), sp = R(3, 14) * s;
      this.soft.spawn(p.x + R(-1, 1) * s, p.y, p.z + R(-1, 1) * s, (vel ? vel.x : 0) + Math.cos(a) * sp, R(8, 26) * s, (vel ? vel.z : 0) + Math.sin(a) * sp,
        R(0.7, 1.5), 1.6 * s, 4 * s, 0.85, 0.96, 1, 0.7, G * 0.8, 0.4);
    }
  }
  debris(p, n, colors, o = {}) {
    const { vel = null, spread = 14, up = 16, size = 0.8, groundY = p.y - 1, life = 3 } = o;
    for (let i = 0; i < n; i++) {
      if (this.deb.length >= DEBRIS_MAX) this.deb.shift();
      this.deb.push({
        x: p.x + R(-2, 2), y: p.y + R(0, 3), z: p.z + R(-1.5, 1.5),
        vx: (vel ? vel.x * R(0.3, 1) : 0) + R(-spread, spread), vy: (vel ? vel.y : 0) + R(2, up), vz: (vel ? vel.z * R(0.3, 1) : 0) + R(-spread, spread),
        ax: R(-1, 1), ay: R(-1, 1), az: R(-1, 1), w: R(3, 12), rot: R(0, 6),
        sx: size * R(0.4, 1.4), sy: size * R(0.3, 1), sz: size * R(0.4, 1.6),
        c: colors[Math.floor(Math.random() * colors.length)], age: 0, life: life * R(0.7, 1.2), gy: groundY,
      });
    }
  }
  ring(p, color = 0xffffff, size = 25, life = 0.5) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), new THREE.MeshBasicMaterial({ color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y += 0.6;
    this.scene.add(m);
    this.temps.push({ obj: m, age: 0, life, tick: (t) => { m.scale.setScalar(1 + size * (1 - (1 - t) * (1 - t))); m.material.opacity = 1 - t; } });
  }
  bolt(to, height = 240) {
    const pts = [];
    const start = new THREE.Vector3(to.x + R(-50, 50), to.y + height, to.z + R(-50, 50));
    const N = 11;
    for (let i = 0; i <= N; i++) {
      const t = i / N, j = (1 - t) * 14 * (i === 0 ? 0 : 1);
      pts.push(new THREE.Vector3().lerpVectors(start, to, t).add(new THREE.Vector3(R(-j, j), 0, R(-j, j))));
    }
    const pos = [];
    const quad = (a, b, w) => {
      const d = _v.subVectors(b, a).normalize();
      for (const base of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 1)]) {
        const s = new THREE.Vector3().crossVectors(d, base).normalize().multiplyScalar(w);
        const p = [a.clone().add(s), a.clone().sub(s), b.clone().add(s), b.clone().sub(s)];
        for (const k of [0, 1, 2, 2, 1, 3]) pos.push(p[k].x, p[k].y, p[k].z);
      }
    };
    for (let i = 0; i < N; i++) quad(pts[i], pts[i + 1], 0.9);
    for (let b = 0; b < 3; b++) { // branches
      let a = pts[2 + b * 3].clone();
      for (let i = 0; i < 3; i++) { const n = a.clone().add(new THREE.Vector3(R(-18, 18), R(-28, -10), R(-18, 18))); quad(a, n, 0.4); a = n; }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 3.6, 5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false, toneMapped: false });
    const m = new THREE.Mesh(g, mat); m.frustumCulled = false;
    this.scene.add(m);
    this.temps.push({ obj: m, age: 0, life: 0.32, tick: (t) => { mat.opacity = t < 0.5 ? (Math.random() > 0.25 ? 1 : 0.3) : 2 * (1 - t); } });
  }
  // --- rigid pieces -----------------------------------------------------------------
  body(obj, vel, groundY, o = {}) {
    this.bodies.push({
      obj, vel, gy: groundY, age: 0, life: o.life ?? 4.5, delay: o.delay ?? 0, r: o.r ?? 0.8,
      axis: new THREE.Vector3(R(-1, 1), R(-1, 1), R(-1, 1)).normalize(), w: o.spin ?? R(1.5, 7), rest: false,
    });
  }
  update(dt) {
    this.soft.update(dt); this.add.update(dt);
    // debris
    const dm = this.debrisMesh; let n = 0;
    for (let i = 0; i < this.deb.length; i++) {
      const d = this.deb[i]; d.age += dt;
      if (d.age > d.life) { this.deb.splice(i--, 1); continue; }
      d.vy -= G * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; d.rot += d.w * dt;
      if (d.y < d.gy + 0.3 && d.vy < 0) { d.y = d.gy + 0.3; d.vy *= -0.35; d.vx *= 0.6; d.vz *= 0.6; d.w *= 0.5; }
      const k = Math.min(1, (d.life - d.age) * 3);
      _q.setFromAxisAngle(_ax.set(d.ax, d.ay, d.az).normalize(), d.rot);
      _m.compose(_v.set(d.x, d.y, d.z), _q, _s.set(d.sx * k, d.sy * k, d.sz * k));
      dm.setMatrixAt(n, _m); dm.setColorAt(n, _col.set(d.c)); n++;
    }
    dm.count = n; dm.instanceMatrix.needsUpdate = true; if (dm.instanceColor) dm.instanceColor.needsUpdate = true;
    // bodies
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.delay > 0) { b.delay -= dt; continue; }
      b.age += dt;
      if (b.age > b.life) { b.obj.removeFromParent(); this.bodies.splice(i--, 1); continue; }
      const p = b.obj.position;
      b.vel.y -= G * dt; p.addScaledVector(b.vel, dt);
      b.obj.rotateOnWorldAxis(b.axis, b.w * dt);
      if (p.y < b.gy + b.r && b.vel.y < 0) { p.y = b.gy + b.r; b.vel.y *= -0.3; b.vel.x *= 0.55; b.vel.z *= 0.55; b.w *= 0.45; }
      const k = Math.min(1, (b.life - b.age) * 2.5);
      if (k < 1) b.obj.scale.multiplyScalar(Math.max(0.01, k) / (b.lastK || 1)), (b.lastK = Math.max(0.01, k));
    }
    for (let i = 0; i < this.temps.length; i++) {
      const t = this.temps[i]; t.age += dt;
      if (t.age >= t.life) { t.obj.removeFromParent(); t.obj.geometry.dispose(); t.obj.material.dispose(); this.temps.splice(i--, 1); continue; }
      t.tick(t.age / t.life);
    }
  }
}

// A destructible prop: a group of piece-meshes that turn into flying rigid bodies when smashed.
export class Breakable {
  constructor() { this.group = new THREE.Group(); this.pieces = []; this.smashed = false; this.colors = []; }
  add(geo, x, y, z, mat, o = {}) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rz) m.rotation.z = o.rz; if (o.rx) m.rotation.x = o.rx;
    m.castShadow = true; m.userData.o = o;
    this.group.add(m); this.pieces.push(m);
    if (o.c != null) this.colors.push(o.c);
    return m;
  }
  // dir: unit travel direction, speed: train speed. Pieces fly forward and outward.
  smash(world, dir, speed, o = {}) {
    if (this.smashed) return; this.smashed = true;
    const { power = 0.7, spread = 16, up = 18, collapse = false } = o;
    const root = world.group, vfx = world.vfx;
    for (const m of this.pieces) {
      root.attach(m);
      const po = m.userData.o;
      const gy = world.terrain.h(m.position.x, m.position.z);
      let vel, delay = 0;
      if (collapse && m.position.y - gy > collapse) { // upper parts just fall, delayed by height
        vel = new THREE.Vector3(R(-3, 3), R(-2, 1), R(-3, 3) + speed * 0.05); delay = (m.position.y - gy - collapse) * 0.012 + R(0, 0.12);
      } else {
        const f = speed * power * R(0.45, 1.05) * (po.heavy ? 0.5 : 1);
        vel = new THREE.Vector3(dir.x * f + R(-spread, spread), R(up * 0.2, up), dir.z * f + R(-spread, spread));
      }
      vfx.body(m, vel, gy, { delay, r: po.r ?? 0.7, life: o.life ?? R(3.5, 5) });
    }
    this.pieces.length = 0;
  }
}
