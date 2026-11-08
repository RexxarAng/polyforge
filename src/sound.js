// Synthesised audio: an electric-motor whine and a filtered-noise tyre screech.
// Browsers only allow audio after a user gesture, so call start() from one.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  start() {
    if (this.ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = (this.ctx = new AudioCtx());

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(ctx.destination);

    this.motor = ctx.createOscillator();
    this.motor.type = 'sawtooth';
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 1400;
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(lowpass).connect(this.motorGain).connect(this.master);
    this.motor.start();

    const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 2200;
    band.Q.value = 5;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    src.connect(band).connect(this.skidGain).connect(this.master);
    src.start();
  }

  update(speed, throttle, skidding) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.motor.frequency.setTargetAtTime(90 + speed * 12 + throttle * 30, t, 0.05);
    this.motorGain.gain.setTargetAtTime(0.03 + throttle * 0.05 + speed * 0.0015, t, 0.1);
    this.skidGain.gain.setTargetAtTime(skidding ? Math.min(0.3, speed * 0.015) : 0, t, 0.05);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
