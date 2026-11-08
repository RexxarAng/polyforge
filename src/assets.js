import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Models exported from Blender by scripts/make_assets.py / export_gltf.py.
// Any that are missing fall back to the built-in stand-ins below, which use
// the same dimensions and node names so the game behaves identically.
const loader = new GLTFLoader();

function tryLoad(url) {
  return new Promise((resolve) => {
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, () => resolve(null));
  });
}

export async function loadAssets() {
  const [car, cone, tires] = await Promise.all([
    tryLoad('models/car.glb'),
    tryLoad('models/cone.glb'),
    tryLoad('models/tires.glb'),
  ]);
  const assets = {
    car: car ?? buildCar(),
    cone: cone ?? buildCone(),
    tires: tires ?? buildTires(),
    fromBlender: { car: !!car, cone: !!cone, tires: !!tires },
  };
  for (const key of ['car', 'cone', 'tires']) {
    assets[key].traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
  }
  return assets;
}

const mat = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.6, ...opts });

function part(geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  return mesh;
}

// Forward is -Z, up is +Y, right is +X (matches the Blender export).
function buildCar() {
  const g = new THREE.Group();
  const paint = mat(0xe8501a, { roughness: 0.35, metalness: 0.2 });
  const trim = mat(0x1a1a1f);
  const glass = mat(0x223344, { roughness: 0.15, metalness: 0.6 });
  const rubber = mat(0x111111, { roughness: 0.9 });
  const rim = mat(0xc8c8cc, { roughness: 0.3, metalness: 0.9 });
  const light = mat(0xfff2c0, { emissive: 0xffe9a0, emissiveIntensity: 2 });

  g.add(part(new THREE.BoxGeometry(1.1, 0.35, 2.0), paint, 0, 0.42, 0));
  g.add(part(new THREE.BoxGeometry(0.8, 0.3, 0.9), glass, 0, 0.75, 0.1));
  g.add(part(new THREE.BoxGeometry(1.15, 0.15, 0.15), trim, 0, 0.3, -1.0));
  g.add(part(new THREE.BoxGeometry(1.1, 0.05, 0.25), paint, 0, 0.95, 0.9));
  for (const x of [-0.4, 0.4]) {
    g.add(part(new THREE.BoxGeometry(0.2, 0.08, 0.05), light, x * 0.875, 0.45, -1.01));
    g.add(part(new THREE.BoxGeometry(0.06, 0.3, 0.06), trim, x, 0.78, 0.9));
  }
  g.add(part(new THREE.CylinderGeometry(0.015, 0.015, 0.9, 6), trim, 0.4, 1.0, 0.7));

  const wheels = [
    ['Wheel_FL', -0.62, -0.65],
    ['Wheel_FR', 0.62, -0.65],
    ['Wheel_RL', -0.62, 0.65],
    ['Wheel_RR', 0.62, 0.65],
  ];
  for (const [name, x, z] of wheels) {
    const wheel = new THREE.Group();
    wheel.name = name;
    wheel.position.set(x, 0.28, z);
    const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.25, 20), rubber);
    tire.rotation.z = Math.PI / 2;
    wheel.add(tire, new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.3, 0.08), rim));
    g.add(wheel);
  }
  return g;
}

function buildCone() {
  const g = new THREE.Group();
  const orange = mat(0xff6a10);
  g.add(part(new THREE.BoxGeometry(0.5, 0.05, 0.5), orange, 0, 0.025, 0));
  g.add(part(new THREE.CylinderGeometry(0.03, 0.2, 0.6, 20), orange, 0, 0.33, 0));
  g.add(part(new THREE.CylinderGeometry(0.096, 0.118, 0.08, 20), mat(0xeeeeee), 0, 0.38, 0));
  return g;
}

function buildTires() {
  const g = new THREE.Group();
  const rubber = mat(0x181818, { roughness: 0.95, flatShading: false });
  const red = mat(0xc01818, { roughness: 0.8, flatShading: false });
  [0.17, 0.51, 0.85].forEach((y, i) => {
    const t = part(new THREE.TorusGeometry(0.45, 0.17, 10, 24), i === 1 ? red : rubber, 0, y, 0);
    t.rotation.x = -Math.PI / 2;
    g.add(t);
  });
  return g;
}
