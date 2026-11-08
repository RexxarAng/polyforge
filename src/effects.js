import * as THREE from 'three';

const MARK_HALF_WIDTH = 0.12;

// Tyre marks as a ring buffer of quads in one mesh; the oldest marks get overwritten.
export class SkidMarks {
  constructor(scene, max = 4000) {
    this.max = max;
    this.positions = new Float32Array(max * 18);
    this.attr = new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', this.attr);
    this.geo.setDrawRange(0, 0);
    const material = new THREE.MeshBasicMaterial({
      color: 0x0b0b0d,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(this.geo, material);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.clear();
  }

  clear() {
    this.next = 0;
    this.count = 0;
    this.last = [];
    this.geo.setDrawRange(0, 0);
  }

  track(wheel, x, z, active) {
    if (!active) {
      this.last[wheel] = null;
      return;
    }
    const prev = this.last[wheel];
    if (!prev) {
      this.last[wheel] = { x, z };
      return;
    }
    const dx = x - prev.x;
    const dz = z - prev.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.15) return;
    const nx = (-dz / d) * MARK_HALF_WIDTH;
    const nz = (dx / d) * MARK_HALF_WIDTH;
    const y = 0.02;
    const quad = [
      prev.x + nx, y, prev.z + nz, prev.x - nx, y, prev.z - nz, x + nx, y, z + nz,
      x + nx, y, z + nz, prev.x - nx, y, prev.z - nz, x - nx, y, z - nz,
    ];
    this.positions.set(quad, this.next * 18);
    this.next = (this.next + 1) % this.max;
    this.count = Math.min(this.count + 1, this.max);
    this.geo.setDrawRange(0, this.count * 6);
    this.attr.needsUpdate = true;
    this.last[wheel] = { x, z };
  }
}

function puffTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class Smoke {
  constructor(scene, count = 90) {
    const map = puffTexture();
    this.next = 0;
    this.puffs = Array.from({ length: count }, () => {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map, color: 0xdddddd, transparent: true, depthWrite: false, opacity: 0 }),
      );
      sprite.visible = false;
      scene.add(sprite);
      return { sprite, life: 0, max: 1, vx: 0, vy: 0, vz: 0 };
    });
  }

  emit(x, z, carVx, carVz) {
    const p = this.puffs[this.next];
    this.next = (this.next + 1) % this.puffs.length;
    p.life = 0;
    p.max = 0.7 + Math.random() * 0.6;
    p.vx = carVx * 0.15 + (Math.random() - 0.5) * 1.5;
    p.vy = 0.6 + Math.random() * 0.8;
    p.vz = carVz * 0.15 + (Math.random() - 0.5) * 1.5;
    p.sprite.position.set(x, 0.25, z);
    p.sprite.visible = true;
  }

  update(dt) {
    for (const p of this.puffs) {
      if (!p.sprite.visible) continue;
      p.life += dt;
      const t = p.life / p.max;
      if (t >= 1) {
        p.sprite.visible = false;
        continue;
      }
      p.sprite.position.x += p.vx * dt;
      p.sprite.position.y += p.vy * dt;
      p.sprite.position.z += p.vz * dt;
      const damp = Math.exp(-2 * dt);
      p.vx *= damp;
      p.vz *= damp;
      p.sprite.scale.setScalar(0.6 + t * 2.6);
      p.sprite.material.opacity = 0.4 * (1 - t);
    }
  }
}
