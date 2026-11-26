// Emberwing: Ridge Run — a tiny seeded random number generator.
// One clear job: deterministic worlds, so the same seed always flies the same valley.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth random walk that never jumps: used for curves and elevation. */
export function smoothWalk(random, count, start, step, min, max) {
  const out = new Array(count);
  let value = start;
  for (let index = 0; index < count; index += 1) {
    value += (random() - 0.5) * 2 * step;
    if (value < min) value = min + (min - value) * 0.5;
    if (value > max) value = max - (value - max) * 0.5;
    out[index] = value;
  }
  return out;
}
