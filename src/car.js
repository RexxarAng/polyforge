import * as THREE from 'three';

// Arcade drift model: the car keeps a world-space velocity that is split each
// step into forward and sideways parts. Grip only pulls the sideways part
// toward zero, so turning faster than the tyres can follow makes the tail
// slide out. Low grip (handbrake, or throttle while sliding) holds the drift.
const P = {
  accel: 26,
  maxSpeed: 30,
  brake: 40,
  reverseAccel: 14,
  maxReverse: 10,
  rolling: 2,
  drag: 0.35,
  handbrakeDrag: 0.9,
  grip: 9,
  slideGrip: 0.6, // grip multiplier once sliding
  powerSlideGrip: 0.28, // ...and while also on the throttle
  handbrakeGrip: 1.3,
  steerRate: 3.2, // max yaw rate (rad/s)
  wheelRadius: 0.28,
};

const WHEELS = ['Wheel_FL', 'Wheel_FR', 'Wheel_RL', 'Wheel_RR'];

export class Car {
  constructor(model) {
    this.root = new THREE.Group();
    this.body = new THREE.Group(); // tilts for body roll / squat
    this.root.add(this.body);
    this.body.add(model);
    this.wheels = WHEELS.map((name) => model.getObjectByName(name)).filter(Boolean);
    // Steer (Y) must be applied outside spin (X).
    for (const w of this.wheels) w.rotation.order = 'YXZ';
    this.frontWheels = this.wheels.filter((w) => w.name.startsWith('Wheel_F'));
    this.radius = 0.9;
    this.reset();
  }

  reset(x = 0, z = 0, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = 0;
    this.vz = 0;
    this.vF = 0;
    this.vR = 0;
    this.yawRate = 0;
    this.steer = 0;
    this.speed = 0;
    this.slip = 0;
    this.throttle = 0;
    this.drifting = false;
    this.skidding = false;
  }

  update(dt, input) {
    const sin = Math.sin(this.heading);
    const cos = Math.cos(this.heading);
    const fx = -sin, fz = -cos; // forward
    const rx = cos, rz = -sin; // right
    let vF = this.vx * fx + this.vz * fz;
    let vR = this.vx * rx + this.vz * rz;
    const speed = Math.hypot(vF, vR);
    this.slip = speed > 1 ? Math.atan2(Math.abs(vR), Math.abs(vF)) : 0;
    const sliding = this.slip > 0.2;

    this.steer += (input.steer - this.steer) * Math.min(1, dt * 8);

    // Forward / back
    if (input.throttle > 0) {
      vF += P.accel * input.throttle * dt * Math.max(0, 1 - vF / P.maxSpeed);
    }
    if (input.brake > 0) {
      if (vF > 0.5) vF = Math.max(0, vF - P.brake * input.brake * dt);
      else vF = Math.max(-P.maxReverse, vF - P.reverseAccel * input.brake * dt);
    }
    if (!input.throttle && !input.brake) {
      vF -= Math.sign(vF) * Math.min(Math.abs(vF), P.rolling * dt);
    }
    vF -= vF * P.drag * dt;
    if (input.handbrake) vF -= vF * P.handbrakeDrag * dt;

    // Sideways grip
    let grip = P.grip;
    if (input.handbrake) grip = P.handbrakeGrip;
    else if (sliding) grip *= input.throttle > 0 ? P.powerSlideGrip : P.slideGrip;
    vR *= Math.exp(-grip * dt);

    // Steering: less authority at very low and very high speed; reversed in reverse.
    const dir = vF < -0.5 ? -1 : 1;
    const speedFactor = Math.min(1, speed / 5) * (1 - 0.3 * Math.min(1, speed / P.maxSpeed));
    let targetYaw = this.steer * P.steerRate * speedFactor * dir;
    if (input.handbrake) targetYaw *= 1.4;
    else if (sliding && input.throttle > 0) targetYaw *= 1.2;
    this.yawRate += (targetYaw - this.yawRate) * Math.min(1, dt * (sliding ? 4 : 10));
    this.heading += this.yawRate * dt;

    // Recombine in the old basis: velocity doesn't turn with the car, which is the slide.
    this.vx = fx * vF + rx * vR;
    this.vz = fz * vF + rz * vR;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    this.vF = vF;
    this.vR = vR;
    this.speed = Math.hypot(this.vx, this.vz);
    this.throttle = input.throttle;
    this.drifting = this.speed > 7 && vF > 2 && this.slip > 0.25 && this.slip < 1.4;
    this.skidding = this.drifting || (input.handbrake && this.speed > 3) || (input.brake > 0 && vF > 8);
  }

  syncVisual(dt) {
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.heading;
    const k = Math.min(1, dt * 8);
    const roll = THREE.MathUtils.clamp(-this.vR * 0.02, -0.12, 0.12);
    this.body.rotation.z += (roll - this.body.rotation.z) * k;
    this.body.rotation.x += (this.throttle * 0.04 - this.body.rotation.x) * k;
    for (const w of this.wheels) w.rotation.x -= (this.vF * dt) / P.wheelRadius;
    for (const w of this.frontWheels) w.rotation.y = this.steer * 0.45;
  }

  // World positions of the rear tyres' contact patches, for skid marks and smoke.
  rearWheels() {
    const sin = Math.sin(this.heading);
    const cos = Math.cos(this.heading);
    return [-0.62, 0.62].map((lx) => [
      this.x + cos * lx + sin * 0.65,
      this.z - sin * lx + cos * 0.65,
    ]);
  }
}
