// Emberwing: Ridge Run — synthesized sound, no audio files.
// One clear job: engine hum, ring chimes, drops and crashes from WebAudio alone.
export class Sound {
  constructor() {
    this.context = null;
    this.muted = false;
    this.engine = null;
    this.engineGain = null;
  }

  /** Create the audio context on the first real gesture; browsers demand that. */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return;
    }
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContext) return;
    this.context = new AudioContext();
    const oscillator = this.context.createOscillator();
    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 52;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    this.engineGain = this.context.createGain();
    this.engineGain.gain.value = 0.0;
    oscillator.connect(filter).connect(this.engineGain).connect(this.context.destination);
    oscillator.start();
    this.engine = oscillator;
    this.engineFilter = filter;
  }

  setEngine(throttle, speed01) {
    if (!this.context || !this.engine || this.muted) return;
    const now = this.context.currentTime;
    this.engine.frequency.setTargetAtTime(48 + throttle * 70 + speed01 * 30, now, 0.08);
    this.engineFilter.frequency.setTargetAtTime(240 + throttle * 700, now, 0.08);
    this.engineGain.gain.setTargetAtTime(0.035 + throttle * 0.05, now, 0.1);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.engineGain) this.engineGain.gain.value = 0;
    return this.muted;
  }

  blip(frequency, duration, type, volume) {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    oscillator.type = type || 'sine';
    oscillator.frequency.value = frequency;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume || 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }

  ring() {
    this.blip(880, 0.35, 'sine', 0.14);
    window.setTimeout(() => this.blip(1318, 0.5, 'sine', 0.12), 90);
  }

  drop() {
    this.blip(523, 0.3, 'triangle', 0.14);
    window.setTimeout(() => this.blip(784, 0.4, 'triangle', 0.12), 110);
  }

  hit() {
    this.blip(140, 0.3, 'square', 0.16);
  }

  crash() {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const length = Math.floor(this.context.sampleRate * 0.7);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const gain = this.context.createGain();
    gain.gain.value = 0.25;
    source.connect(gain).connect(this.context.destination);
    source.start(now);
  }

  win() {
    [523, 659, 784, 1046].forEach((frequency, index) => {
      window.setTimeout(() => this.blip(frequency, 0.5, 'triangle', 0.13), index * 130);
    });
  }
}
