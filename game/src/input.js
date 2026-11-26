// Emberwing: Ridge Run — keyboard and mouse input.
// One clear job: turn keys and the pointer into one {steer, pitch, throttle, drop} frame.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouse = { x: 0.5, y: 0.5, active: false };
    this.dropQueued = false;
    this.anyKey = false;
    this.onKey = null;
    window.addEventListener('keydown', (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
      if (!event.repeat) {
        this.anyKey = true;
        if (this.onKey) this.onKey(event.code);
        if (event.code === 'Space') this.dropQueued = true;
      }
      this.keys.add(event.code);
    });
    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousemove', (event) => {
      const rect = canvas.getBoundingClientRect();
      this.mouse.x = (event.clientX - rect.left) / rect.width;
      this.mouse.y = (event.clientY - rect.top) / rect.height;
      this.mouse.active = true;
    });
    canvas.addEventListener('mousedown', () => {
      this.dropQueued = true;
    });
    canvas.addEventListener('mouseleave', () => {
      this.mouse.active = false;
    });
  }

  /** Read the frame's control input. Mouse steering only when the pointer moved recently. */
  read() {
    const k = this.keys;
    let steer = 0;
    let pitch = 0;
    let throttle = 0;
    if (k.has('ArrowLeft') || k.has('KeyA')) steer -= 1;
    if (k.has('ArrowRight') || k.has('KeyD')) steer += 1;
    if (k.has('ArrowUp') || k.has('KeyW')) pitch += 1;
    if (k.has('ArrowDown') || k.has('KeyS')) pitch -= 1;
    if (k.has('ShiftLeft') || k.has('ShiftRight')) throttle += 1;
    if (k.has('ControlLeft') || k.has('ControlRight')) throttle -= 1;
    // Mouse: pointer left/right of centre banks, above/below centre pitches.
    if (this.mouse.active && steer === 0 && pitch === 0) {
      const mx = (this.mouse.x - 0.5) * 2;
      const my = (this.mouse.y - 0.5) * 2;
      if (Math.abs(mx) > 0.08) steer = Math.max(-1, Math.min(1, mx * 1.4));
      if (Math.abs(my) > 0.08) pitch = Math.max(-1, Math.min(1, -my * 1.2));
    }
    const drop = this.dropQueued;
    this.dropQueued = false;
    return { steer, pitch, throttle, drop };
  }
}
