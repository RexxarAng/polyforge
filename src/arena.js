import * as THREE from 'three';

export const ARENA_HALF = 60;
export const START = { x: 0, z: 34, heading: 0 };
export const TIRE_RADIUS = 0.65;

function canvasTexture(w, h, draw, repeatX, repeatY) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

function asphalt() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3b3e44';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) {
      const v = 45 + Math.random() * 30;
      ctx.fillStyle = `rgb(${v},${v},${v + 4})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, 30, 30);
}

function stripes(repeat) {
  return canvasTexture(64, 16, (ctx) => {
    ctx.fillStyle = '#d42020';
    ctx.fillRect(0, 0, 32, 16);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(32, 0, 32, 16);
  }, repeat, 1);
}

function paintRing(scene, x, z, radius, width = 0.3) {
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(radius - width / 2, radius + width / 2, 96),
    new THREE.MeshBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.55 }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(x, 0.01, z);
  scene.add(ring);
}

export function buildArena(scene, assets) {
  const H = ARENA_HALF;

  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshStandardMaterial({ color: 0x5d8a4a, roughness: 1 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.02;
  grass.receiveShadow = true;
  scene.add(grass);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(H * 2 + 2, H * 2 + 2),
    new THREE.MeshStandardMaterial({ map: asphalt(), roughness: 0.95 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Barrier walls
  const wallMat = new THREE.MeshStandardMaterial({ map: stripes(H), roughness: 0.7 });
  const walls = [
    [H * 2 + 2, 1, 0, -(H + 0.5)],
    [H * 2 + 2, 1, 0, H + 0.5],
    [1, H * 2, -(H + 0.5), 0],
    [1, H * 2, H + 0.5, 0],
  ];
  for (const [w, d, x, z] of walls) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8, d), wallMat);
    wall.position.set(x, 0.4, z);
    wall.castShadow = wall.receiveShadow = true;
    scene.add(wall);
  }

  const obstacles = [];
  const placeTires = (x, z) => {
    const t = assets.tires.clone();
    t.position.set(x, 0, z);
    t.rotation.y = Math.random() * Math.PI * 2;
    scene.add(t);
    obstacles.push({ x, z, r: TIRE_RADIUS });
  };

  // Two tyre islands for donuts and figure-eights, with painted drift lines.
  for (const cx of [-22, 22]) {
    placeTires(cx, 0);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      placeTires(cx + Math.cos(a) * 3.5, Math.sin(a) * 3.5);
    }
    paintRing(scene, cx, 0, 10);
  }

  // Corner tyre walls
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 5) * (Math.PI / 2);
        placeTires(sx * (H - 7 + Math.cos(a) * 6), sz * (H - 7 + Math.sin(a) * 6));
      }
    }
  }

  // Start line
  const line = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.7 }),
  );
  line.rotation.x = -Math.PI / 2;
  line.position.set(START.x, 0.01, START.z - 1.5);
  scene.add(line);

  // Cones: a slalom at the far end and a gate down the middle.
  const conePositions = [];
  for (let x = -30; x <= 30; x += 6) conePositions.push({ x, z: -38 });
  for (let z = -18; z <= 18; z += 4) {
    conePositions.push({ x: -3, z }, { x: 3, z });
  }

  return { obstacles, conePositions };
}
