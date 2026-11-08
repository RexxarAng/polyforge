import * as THREE from 'three';
import { loadAssets } from './assets.js';
import { ARENA_HALF, START, buildArena } from './arena.js';
import { Car } from './car.js';
import { SkidMarks, Smoke } from './effects.js';
import { Sound } from './sound.js';

const STEP = 1 / 120;
const CONE_RADIUS = 0.25;
const BEST_KEY = 'polyforge.bestDrift';

const $ = (id) => document.getElementById(id);
const hud = {
  score: $('score'),
  best: $('best'),
  speed: $('speed'),
  cones: $('cones'),
  drift: $('drift'),
  driftPts: $('driftPts'),
  driftMult: $('driftMult'),
  popup: $('popup'),
  start: $('start'),
  assetNote: $('assetNote'),
};

// --- Renderer, scene, camera, lights -------------------------------------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fb3c9);
scene.fog = new THREE.Fog(0x8fb3c9, 70, 160);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.5, 400);
const CAM_OFFSET = new THREE.Vector3(0, 19, 11);
const camTarget = new THREE.Vector3();

scene.add(new THREE.HemisphereLight(0xdfefff, 0x4a5a3a, 1.2));
const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -35, right: 35, top: 35, bottom: -35, near: 1, far: 120 });
sun.shadow.bias = -0.0005;
scene.add(sun, sun.target);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Input ----------------------------------------------------------------

const keys = new Set();
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

function readInput() {
  const k = (...codes) => codes.some((c) => keys.has(c));
  const input = {
    throttle: k('KeyW', 'ArrowUp') ? 1 : 0,
    brake: k('KeyS', 'ArrowDown') ? 1 : 0,
    steer: (k('KeyA', 'ArrowLeft') ? 1 : 0) - (k('KeyD', 'ArrowRight') ? 1 : 0),
    handbrake: k('Space'),
  };
  // Gamepad: left stick steers, RT throttle, LT brake, A handbrake.
  const pad = navigator.getGamepads?.()[0];
  if (pad) {
    const stick = pad.axes[0] ?? 0;
    if (Math.abs(stick) > 0.15) input.steer = -stick;
    input.throttle = Math.max(input.throttle, pad.buttons[7]?.value ?? 0);
    input.brake = Math.max(input.brake, pad.buttons[6]?.value ?? 0);
    input.handbrake ||= !!pad.buttons[0]?.pressed;
  }
  return input;
}

// --- Game ----------------------------------------------------------------

async function init() {
  const assets = await loadAssets();
  const missing = Object.entries(assets.fromBlender).filter(([, ok]) => !ok).map(([k]) => k);
  if (missing.length) {
    hud.assetNote.textContent = `Using built-in stand-ins for: ${missing.join(', ')}. Run "npm run assets" to make them in Blender.`;
  }

  const arena = buildArena(scene, assets);
  const car = new Car(assets.car);
  scene.add(car.root);
  const skids = new SkidMarks(scene);
  const smoke = new Smoke(scene);
  const sound = new Sound();

  const cones = arena.conePositions.map(({ x, z }) => {
    const group = new THREE.Group();
    const mesh = assets.cone.clone();
    group.add(mesh);
    scene.add(group);
    return { group, mesh, homeX: x, homeZ: z };
  });

  let best = 0;
  try {
    best = Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {}

  const state = {
    started: false,
    score: 0,
    conesHit: 0,
    drift: { points: 0, time: 0, grace: 0, active: false },
  };

  function popup(text, kind) {
    hud.popup.textContent = text;
    hud.popup.className = '';
    void hud.popup.offsetWidth; // restart the CSS animation
    hud.popup.className = `show ${kind}`;
  }

  const multiplier = () => Math.min(5, 1 + Math.floor(state.drift.time / 2));

  function endDrift(crashed) {
    const d = state.drift;
    const pts = Math.round(d.points * multiplier());
    if (crashed && pts > 0) {
      popup(`CRASH  −${pts}`, 'bad');
    } else if (pts >= 10) {
      state.score += pts;
      popup(`+${pts}`, 'good');
      if (pts > best) {
        best = pts;
        try {
          localStorage.setItem(BEST_KEY, String(best));
        } catch {}
      }
    }
    Object.assign(d, { points: 0, time: 0, grace: 0, active: false });
  }

  function resetCones() {
    for (const c of cones) {
      Object.assign(c, { x: c.homeX, z: c.homeZ, vx: 0, vz: 0, spin: 0, tip: 0, knocked: false });
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.set(0, 0, 0);
      c.mesh.rotation.set(0, 0, 0);
      c.mesh.position.y = 0;
    }
  }

  function resetRun() {
    if (state.drift.active) endDrift(true);
    car.reset(START.x, START.z, START.heading);
    skids.clear();
    resetCones();
  }

  function collideCar() {
    const R = car.radius;
    const lim = ARENA_HALF - R;
    let impact = 0;
    if (Math.abs(car.x) > lim) {
      impact = Math.max(impact, Math.abs(car.vx));
      car.x = Math.sign(car.x) * lim;
      car.vx *= -0.4;
    }
    if (Math.abs(car.z) > lim) {
      impact = Math.max(impact, Math.abs(car.vz));
      car.z = Math.sign(car.z) * lim;
      car.vz *= -0.4;
    }
    for (const o of arena.obstacles) {
      const dx = car.x - o.x;
      const dz = car.z - o.z;
      const min = R + o.r;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      car.x = o.x + nx * min;
      car.z = o.z + nz * min;
      const vn = car.vx * nx + car.vz * nz;
      if (vn < 0) {
        car.vx -= 1.4 * vn * nx;
        car.vz -= 1.4 * vn * nz;
        impact = Math.max(impact, -vn);
      }
    }
    if (impact > 0) car.yawRate *= 0.6;
    if (impact > 5 && state.drift.active) endDrift(true);
  }

  function updateCones(dt) {
    const reach = car.radius + CONE_RADIUS;
    const lim = ARENA_HALF - CONE_RADIUS;
    for (const c of cones) {
      const dx = c.x - car.x;
      const dz = c.z - car.z;
      const d = Math.hypot(dx, dz);
      if (d < reach && d > 0) {
        const nx = dx / d;
        const nz = dz / d;
        c.x = car.x + nx * reach;
        c.z = car.z + nz * reach;
        c.vx = car.vx * 1.1 + nx * 3;
        c.vz = car.vz * 1.1 + nz * 3;
        c.spin = (Math.random() - 0.5) * 12;
        car.vx *= 0.97;
        car.vz *= 0.97;
        if (!c.knocked) {
          c.knocked = true;
          state.conesHit++;
          // Point the tip direction along the hit.
          c.group.rotation.y = Math.atan2(-c.vx, -c.vz);
        }
      }
      if (!c.knocked) continue;
      c.x += c.vx * dt;
      c.z += c.vz * dt;
      const damp = Math.exp(-2.5 * dt);
      c.vx *= damp;
      c.vz *= damp;
      c.spin *= Math.exp(-2 * dt);
      if (Math.abs(c.x) > lim) (c.x = Math.sign(c.x) * lim), (c.vx *= -0.5);
      if (Math.abs(c.z) > lim) (c.z = Math.sign(c.z) * lim), (c.vz *= -0.5);
      c.tip = Math.min(1, c.tip + dt * 6);
      c.group.position.set(c.x, 0, c.z);
      c.group.rotation.y += c.spin * dt;
      c.mesh.rotation.x = -c.tip * 1.4;
      c.mesh.position.y = c.tip * 0.15;
    }
  }

  function updateDrift(dt) {
    const d = state.drift;
    if (car.drifting) {
      d.active = true;
      d.grace = 0.6;
      d.time += dt;
      d.points += dt * car.speed * Math.min(car.slip, 1.2) * 8;
    } else if (d.active) {
      d.grace -= dt;
      if (d.grace <= 0) endDrift(false);
    }
  }

  function step(dt) {
    car.update(dt, readInput());
    collideCar();
    updateCones(dt);
    updateDrift(dt);
  }

  function updateEffects(dt) {
    const wheels = car.rearWheels();
    wheels.forEach(([x, z], i) => skids.track(i, x, z, car.skidding));
    if (car.skidding) {
      const rate = car.drifting ? 45 : 20;
      for (const [x, z] of wheels) {
        if (Math.random() < rate * dt) smoke.emit(x, z, car.vx, car.vz);
      }
    }
    smoke.update(dt);
  }

  function updateCamera(dt) {
    const lead = 0.35;
    const target = new THREE.Vector3(car.x + car.vx * lead, 0, car.z + car.vz * lead);
    camTarget.lerp(target, 1 - Math.exp(-dt * 5));
    const zoom = 1 + car.speed / 90;
    camera.position.copy(camTarget).addScaledVector(CAM_OFFSET, zoom);
    camera.lookAt(camTarget);
    sun.position.set(camTarget.x + 20, 40, camTarget.z + 12);
    sun.target.position.copy(camTarget);
  }

  function updateHud() {
    hud.score.textContent = state.score.toLocaleString();
    hud.best.textContent = best.toLocaleString();
    hud.speed.textContent = Math.round(car.speed * 3.6);
    hud.cones.textContent = state.conesHit;
    const d = state.drift;
    hud.drift.classList.toggle('on', d.active);
    hud.driftPts.textContent = Math.round(d.points).toLocaleString();
    hud.driftMult.textContent = `×${multiplier()}`;
  }

  function start() {
    if (state.started) return;
    state.started = true;
    hud.start.classList.add('hidden');
    sound.start();
  }

  window.addEventListener('keydown', (e) => {
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    start();
    if (e.code === 'KeyR') resetRun();
    if (e.code === 'KeyM') sound.toggleMute();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  hud.start.addEventListener('pointerdown', start);

  resetRun();
  camTarget.set(car.x, 0, car.z);

  const clock = new THREE.Clock();
  let acc = 0;
  renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 0.1);
    if (!state.started && navigator.getGamepads?.()[0]?.buttons.some((b) => b.pressed)) start();
    if (state.started) {
      acc += dt;
      while (acc >= STEP) {
        step(STEP);
        acc -= STEP;
      }
    }
    car.syncVisual(dt);
    updateEffects(dt);
    updateCamera(dt);
    updateHud();
    sound.update(car.speed, car.throttle, car.skidding);
    renderer.render(scene, camera);
  });
}

init();
