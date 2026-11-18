import { store } from './store.js';
// Boot, renderer, sky/lighting and the tiny state machine: attract (menu) -> run -> result.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { VFX } from './vfx.js';
import { Director } from './director.js';
import { World } from './world.js';
import { makePlan } from './plan.js';
import { drawOutcome } from './outcome.js';
import { UI } from './ui.js';
import { Audio } from './audio.js';
import { MAT } from './kit.js';

const Q = new URLSearchParams(location.search);
const BETS = [0.2, 0.5, 1, 2, 5, 10, 25, 50, 100];
const SUN = new THREE.Vector3(0.55, 0.72, 0.42).normalize();
const SKY = { top: new THREE.Color(0x3d9dff), hor: new THREE.Color(0xd6f1ff), sTop: new THREE.Color(0x2c3644), sHor: new THREE.Color(0x76818f), dark: new THREE.Color(0x07090d) };

class Game {
  constructor() {
    const coarse = matchMedia('(pointer: coarse)').matches;
    this.hi = Q.get('q') ? Q.get('q') === 'high' : !coarse;
    const canvas = document.getElementById('c');
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.hi, powerPreference: 'high-performance' }));
    r.setPixelRatio(Math.min(devicePixelRatio || 1, this.hi ? 2 : 1.6));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xd6f1ff, 320, 1100);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.5, 3200);

    this.hemi = new THREE.HemisphereLight(0xe6f6ff, 0xa5c98a, 2.1);
    this.sun = new THREE.DirectionalLight(0xfff3df, 3.1);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera; sc.left = -130; sc.right = 130; sc.top = 130; sc.bottom = -130; sc.near = 10; sc.far = 700;
    this.sun.shadow.mapSize.setScalar(this.hi ? 2048 : 1024); this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.6;
    this.headlamp = new THREE.SpotLight(0xfff0c8, 0, 190, 0.5, 0.6, 1.1);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.headlamp, this.headlamp.target);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(2600, 24, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: SKY.top.clone() }, hor: { value: SKY.hor.clone() }, sun: { value: SUN }, sunK: { value: 1 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top, hor, sun; uniform float sunK; varying vec3 vD;
        void main(){ vec3 d = normalize(vD); float h = max(d.y, 0.0);
          vec3 c = mix(hor, top, pow(h, 0.5));
          float s = max(dot(d, sun), 0.0);
          c += sunK * (vec3(1.0, 0.95, 0.8) * pow(s, 350.0) * 3.0 + vec3(1.0, 0.9, 0.7) * pow(s, 10.0) * 0.22);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.scene.add(this.sky);

    if (this.hi) {
      const rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.6, 1.5);
      this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    }

    this.vfx = new VFX(this.scene);
    this.dir = new Director(this.camera);
    this.ui = new UI();
    this.audio = new Audio();
    this.balance = Number(store.get('gott.balance') ?? 1000);
    this.betI = Number(store.get('gott.bet') ?? 2);
    this.ui.wallet(this.balance, BETS[this.betI]);
    this.state = 'boot'; this.world = null; this.idle = 0; this.busy = false;

    addEventListener('resize', () => this.resize()); this.resize();
    this.bind();
    this.startAttract(true);
    this.last = performance.now();
    if (!Q.has('manual')) requestAnimationFrame((t) => this.frame(t));
    if (Q.has('auto')) setTimeout(() => this.play(), 400);
  }

  bind() {
    const stop = (e) => e.stopPropagation();
    for (const el of document.querySelectorAll('[data-ui]')) { el.addEventListener('pointerdown', stop); el.addEventListener('click', stop); }
    const bet = (d) => { this.betI = Math.max(0, Math.min(BETS.length - 1, this.betI + d)); store.set('gott.bet', this.betI); this.ui.wallet(this.balance, BETS[this.betI]); this.audio.unlock(); this.audio.tick(); };
    document.getElementById('bet-dn').addEventListener('click', () => bet(-1));
    document.getElementById('bet-up').addEventListener('click', () => bet(1));
    const mute = document.getElementById('mute');
    mute.classList.toggle('off', this.audio.muted);
    mute.addEventListener('click', () => { this.audio.unlock(); this.audio.setMuted(!this.audio.muted); mute.classList.toggle('off', this.audio.muted); });
    addEventListener('pointerdown', () => { this.audio.unlock(); if (this.state === 'menu' || this.state === 'result') this.play(); });
    addEventListener('keydown', (e) => { if ((e.code === 'Space' || e.code === 'Enter') && (this.state === 'menu' || this.state === 'result')) { this.audio.unlock(); this.play(); } });
    document.addEventListener('visibilitychange', () => { this.last = performance.now(); if (document.hidden) this.audio.engine(0, false); });
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(this.renderer.getPixelRatio()); this.composer.setSize(w, h); }
  }

  swap(plan) { if (this.world) this.world.dispose(); this.world = new World(this, plan); }

  startAttract(first) {
    const go = () => {
      this.swap(makePlan({ attract: true, seed: (Math.random() * 1e9) | 0, force: null }));
      this.state = 'menu'; this.ui.setMode('menu'); this.ui.cinematic(false); this.ui.fade(false); this.busy = false;
    };
    this.busy = true;
    if (first) go(); else { this.ui.fade(true); setTimeout(go, 300); }
  }

  play() {
    if (this.busy) return;
    const bet = BETS[this.betI];
    if (this.balance < bet) this.balance = 1000; // demo credits top themselves up
    this.balance = Math.round((this.balance - bet) * 100) / 100;
    this.bet = bet;
    // The result is fixed here, before anything is shown.
    const out = drawOutcome(bet);
    if (Q.has('m')) { out.multiplier = Number(Q.get('m')); out.payout = Math.round(bet * out.multiplier * 100) / 100; }
    if (Q.has('seed')) out.seed = Number(Q.get('seed'));
    this.outcome = out;
    this.busy = true; this.state = 'loading';
    this.ui.fade(true); this.ui.wallet(this.balance, bet);
    setTimeout(() => {
      const plan = makePlan({ multiplier: out.multiplier, payout: out.payout, seed: out.seed, force: Q.get('ev') ? Q.get('ev').split(',') : null });
      this.swap(plan);
      if (Q.has('z')) this.world.train.place(Number(Q.get('z')));
      this.ui.score(0, 0); this.ui.setMode('run'); this.ui.fade(false);
      this.state = 'run'; this.busy = false;
    }, 230);
  }

  roundEnd() {
    const o = this.outcome;
    this.balance = Math.round((this.balance + o.payout) * 100) / 100;
    store.set('gott.balance', this.balance);
    this.ui.wallet(this.balance, this.bet); this.ui.result(o.payout, o.multiplier, this.bet);
    this.ui.setMode('result'); this.ui.cinematic(false);
    this.audio.win(o.payout >= this.bet);
    this.state = 'result'; this.idle = 0;
  }

  env(dt) {
    const w = this.world, s = w.storm, d = w.dark, u = this.sky.material.uniforms;
    u.top.value.copy(SKY.top).lerp(SKY.sTop, s); u.hor.value.copy(SKY.hor).lerp(SKY.sHor, s); u.sunK.value = 1 - s;
    this.scene.fog.color.copy(u.hor.value).lerp(SKY.dark, d);
    this.scene.fog.near = 320 - 170 * s; this.scene.fog.far = 1100 - 380 * s;
    this.sun.intensity = (2.7 - 2.0 * s) * (1 - 0.93 * d); this.hemi.intensity = (1.9 - 0.8 * s) * (1 - 0.82 * d);
    const h = w.train.head, f = w.fwd;
    this.sun.target.position.copy(h); this.sun.position.copy(h).addScaledVector(SUN, 320);
    this.headlamp.intensity = 260 * Math.max(d, s * 0.5);
    this.headlamp.position.copy(h).addScaledVector(f, 1); this.headlamp.position.y += 1.6;
    this.headlamp.target.position.copy(h).addScaledVector(f, 60);
    this.sky.position.copy(this.camera.position);
    MAT.cloud.color.setScalar(1 - 0.55 * s);
  }

  step(dt, render = true) {
    const w = this.world; if (!w) return;
    w.update(dt);
    this.env(dt);
    this.ui.update(dt);
    this.ui.cinematic(this.dir.cinematic && this.state === 'run');
    if (this.state === 'menu' && w.train.z > w.plan.zEnd - 150 && !this.busy) this.startAttract();
    if (this.state === 'result') { this.idle += dt; if (this.idle > 12 && !this.busy) this.startAttract(); }
    if (!render) return;
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
  frame(t) {
    requestAnimationFrame((q) => this.frame(q));
    const dt = Math.min(0.05, (t - this.last) / 1000); this.last = t;
    if (dt > 0) this.step(dt);
  }
}

const game = new Game();
window.__g = game;

if ('serviceWorker' in navigator && location.protocol === 'https:' && !import.meta.env.DEV) {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
