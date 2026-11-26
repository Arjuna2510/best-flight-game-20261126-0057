// Emberwing: Ridge Run — the world: course, aircraft, missions, collisions.
// One clear job: everything about the simulation, nothing about drawing it.
import {
  SEGMENT_LENGTH, ROAD_HALF_WIDTH, CAMERA_HEIGHT, PLAYER, RING, DROP, LANDING,
  MISSIONS, STEP,
} from './config.js';
import { mulberry32, smoothWalk } from './random.js';

export const EVENT_RING = 1;
export const EVENT_HIT = 2;
export const EVENT_DROP = 4;
export const EVENT_OVER = 8;
export const EVENT_WIN = 16;
export const EVENT_LAND = 32;

const KIND_RING = 'ring';
const KIND_BALLOON = 'balloon';
const KIND_STORM = 'storm';
const KIND_SPIRE = 'spire';
const KIND_ZONE = 'zone';

/** A course segment: where the valley bends, how high the floor sits. */
function buildCourse(mission) {
  const random = mulberry32(mission.seed);
  const count = mission.segments;
  const curves = smoothWalk(random, count, 0, 1.6, -3.2, 3.2);
  const heights = smoothWalk(random, count, 600, 130, 0, 3400);
  const segments = [];
  let x = 0;
  let y = heights[0];
  for (let index = 0; index < count; index += 1) {
    const curve = curves[index];
    const nextY = heights[(index + 1) % count];
    segments.push({
      index,
      curve,
      x,
      y,
      dy: nextY - y,
      sprites: [],
      ring: null,
      zone: null,
      runway: false,
    });
    x += curve * SEGMENT_LENGTH * 0.55;
    y = nextY;
  }
  // The last stretch is the runway: flat, straight, marked.
  const runwayStart = count - 26;
  for (let index = runwayStart; index < count; index += 1) {
    segments[index].curve = 0;
    segments[index].y = segments[runwayStart].y;
    segments[index].dy = 0;
    segments[index].runway = true;
  }
  // Rings: evenly spaced along the course with a little jitter, never in
  // the runway stretch — a ring every few seconds of flight, always one
  // in sight ahead.
  const spacing = (runwayStart - 60) / (mission.rings + 1);
  for (let index = 0; index < mission.rings; index += 1) {
    const raw = Math.floor(30 + index * spacing + (random() - 0.5) * spacing * 0.7);
    const at = Math.max(10, Math.min(runwayStart - 30, raw));
    const seg = segments[at];
    seg.ring = {
      x: (random() - 0.5) * ROAD_HALF_WIDTH * 1.1,
      alt: 900 + random() * 2200,
      passed: false,
    };
  }
  // Obstacles: balloons drift low, storm clouds hang high, rock spires hug the floor.
  for (let index = 0; index < mission.obstacles; index += 1) {
    const at = 12 + Math.floor(random() * (runwayStart - 24));
    const roll = random();
    const kind = roll < 0.4 ? KIND_BALLOON : roll < 0.75 ? KIND_STORM : KIND_SPIRE;
    const alt = kind === KIND_SPIRE
      ? 350 + random() * 500
      : kind === KIND_BALLOON
        ? 700 + random() * 1600
        : 2400 + random() * 1600;
    segments[at].sprites.push({
      kind,
      x: (random() - 0.5) * ROAD_HALF_WIDTH * 1.5,
      alt,
      radius: kind === KIND_STORM ? 520 : 300,
      hit: false,
    });
  }
  // Mission 3: three drop zones painted on the valley floor.
  if (mission.id === 2) {
    [0.3, 0.55, 0.8].forEach((fraction) => {
      const at = Math.floor((runwayStart - 30) * fraction) + 15;
      segments[at].zone = {
        x: (random() - 0.5) * ROAD_HALF_WIDTH * 0.9,
        done: false,
      };
    });
  }
  return { segments, count, runwayStart, totalLength: count * SEGMENT_LENGTH };
}

export class World {
  constructor(missionId) {
    this.mission = MISSIONS[missionId];
    this.course = buildCourse(this.mission);
    this.reset();
  }

  reset() {
    const mission = this.mission;
    this.state = {
      z: 0,
      x: 0,
      // s.y is ABSOLUTE altitude (world units); height above the valley
      // floor is s.y minus groundAt(z). Rings and obstacles store their
      // altitude the same absolute way: segment.y + their own alt.
      y: this.groundAt(0) + 1500,
      speed: mission.baseSpeed,
      throttle: 0.62,
      fuel: mission.fuel,
      hull: 100,
      score: 0,
      rings: 0,
      ringsTotal: mission.rings,
      drops: 0,
      dropsTotal: mission.id === 2 ? 3 : 0,
      crates: [],
      time: 0,
      over: false,
      win: false,
      reason: '',
      landed: false,
      bank: 0,
      pitch: 0,
      message: '',
      messageTime: 0,
    };
  }

  groundAt(z) {
    const index = Math.floor(z / SEGMENT_LENGTH) % this.course.count;
    return this.course.segments[index].y;
  }

  segmentAt(z) {
    const index = Math.floor(z / SEGMENT_LENGTH) % this.course.count;
    return this.course.segments[index];
  }

  nextRing() {
    for (const segment of this.course.segments) {
      if (segment.ring && !segment.ring.passed) return { segment, ring: segment.ring };
    }
    return null;
  }

  nextZone() {
    for (const segment of this.course.segments) {
      if (segment.zone && !segment.zone.done) return { segment, zone: segment.zone };
    }
    return null;
  }

  say(text) {
    this.state.message = text;
    this.state.messageTime = 2.6;
  }

  /** One physics step. `input` is {steer, pitch, throttle, drop}. Returns an event mask. */
  step(dt, input) {
    const s = this.state;
    if (s.over) return 0;
    let events = 0;
    s.time += dt;
    if (s.messageTime > 0) s.messageTime -= dt;

    // Throttle: 0..1, speed chases its target; climbing bleeds speed.
    s.throttle = Math.max(0, Math.min(1, s.throttle + input.throttle * dt * 0.9));
    const targetSpeed = PLAYER.minSpeed + s.throttle * (PLAYER.maxSpeed - PLAYER.minSpeed);
    const climbPenalty = Math.max(0, input.pitch) * 900;
    s.speed += (targetSpeed - climbPenalty - s.speed) * Math.min(1, dt * 0.7);
    s.speed = Math.max(PLAYER.minSpeed * 0.5, s.speed);

    // Steering banks the aircraft and slides it across the valley.
    s.bank += (input.steer - s.bank) * Math.min(1, dt * 6);
    s.x += input.steer * PLAYER.steerSpeed * dt * (0.55 + s.speed / PLAYER.maxSpeed);
    s.x = Math.max(-ROAD_HALF_WIDTH * 1.6, Math.min(ROAD_HALF_WIDTH * 1.6, s.x));
    // Pitch climbs and dives; gravity pulls back toward level flight.
    // Altitude is absolute: the ground rises and falls beneath the aircraft,
    // so the floor check happens after z advances, against the new ground.
    s.pitch += (input.pitch - s.pitch) * Math.min(1, dt * 5);
    s.y += input.pitch * PLAYER.climbSpeed * dt - 90 * dt;

    const previousZ = s.z;
    s.z += s.speed * dt;
    const ground = this.groundAt(s.z);
    s.y = Math.max(ground + 120, Math.min(ground + PLAYER.ceiling, s.y));
    s.fuel -= PLAYER.fuelBurn * (0.35 + s.throttle) * dt;

    // Rings: crossed their plane this step — inside the hoop scores.
    for (const segment of this.course.segments) {
      if (!segment.ring || segment.ring.passed) continue;
      const ringZ = segment.index * SEGMENT_LENGTH;
      if (previousZ < ringZ && s.z >= ringZ) {
        segment.ring.passed = true;
        const dx = s.x - segment.ring.x;
        const dy = s.y - (segment.y + segment.ring.alt);
        const dist = Math.hypot(dx, dy);
        if (dist < RING.radius) {
          s.rings += 1;
          s.score += RING.score;
          s.fuel = Math.min(100, s.fuel + PLAYER.ringFuel);
          this.say(`RING ${s.rings}/${s.ringsTotal}  +${RING.score}`);
          events |= EVENT_RING;
        } else if (dist < RING.radius * 1.9) {
          s.score += RING.nearMiss;
          this.say(`Near miss  +${RING.nearMiss}`);
        }
      }
    }

    // Obstacles: a hit costs hull and speed; a storm also throws the aircraft.
    for (const segment of this.course.segments) {
      for (const sprite of segment.sprites) {
        if (sprite.hit) continue;
        const spriteZ = segment.index * SEGMENT_LENGTH;
        if (Math.abs(s.z - spriteZ) > 260) continue;
        const dy = s.y - (segment.y + sprite.alt);
        const dist = Math.hypot(s.x - sprite.x, dy);
        if (dist < sprite.radius) {
          sprite.hit = true;
          s.hull -= PLAYER.hitDamage;
          s.speed *= 0.72;
          if (sprite.kind === KIND_STORM) s.x += (s.x > sprite.x ? 500 : -500);
          this.say(sprite.kind === KIND_STORM ? 'THUNDERHEAD HIT!' : 'HIT! Hull damaged');
          events |= EVENT_HIT;
        }
      }
    }

    // Terrain scrape: flying into the valley floor.
    if (s.y <= ground + 130) {
      s.hull -= PLAYER.scrapeDamage * dt * 2;
      s.y = ground + 130;
      if (s.hull > 0) this.say('PULL UP — terrain!');
    }

    // Supply drop (mission 3): SPACE over a zone paints a crate on it.
    if (input.drop) {
      const found = this.nextZone();
      if (found) {
        const zoneZ = found.segment.index * SEGMENT_LENGTH;
        if (Math.abs(s.z - zoneZ) < DROP.zoneRadius * 1.6) {
          const dx = s.x - found.zone.x;
          if (Math.abs(dx) < DROP.zoneRadius) {
            found.zone.done = true;
            s.drops += 1;
            s.score += DROP.score;
            s.crates.push({ z: s.z, x: s.x, y: s.y, t: 0 });
            this.say(`SUPPLIES DELIVERED ${s.drops}/3  +${DROP.score}`);
            events |= EVENT_DROP;
          } else {
            this.say('Crate missed the zone — line up over the marker');
          }
        }
      }
    }
    for (const crate of s.crates) crate.t += dt;

    // The runway: land it, or overshoot it.
    const runwayZ = this.course.runwayStart * SEGMENT_LENGTH;
    if (this.mission.id === 2 && s.z >= runwayZ && !s.landed) {
      const runwayGround = this.course.segments[this.course.runwayStart].y;
      const low = s.y - runwayGround < 420;
      const slow = s.speed < LANDING.maxSpeed;
      const centred = Math.abs(s.x) < LANDING.maxOffset;
      if (low && slow && centred && s.z < runwayZ + 4200) {
        s.landed = true;
        s.win = true;
        s.over = true;
        s.score += LANDING.score;
        this.say(`TOUCHDOWN  +${LANDING.score}`);
        events |= EVENT_LAND | EVENT_WIN | EVENT_OVER;
      } else if (s.z >= runwayZ + 4200) {
        s.over = true;
        s.reason = 'Overshot the runway — come in slower and lower.';
        events |= EVENT_OVER;
      }
    }

    // Mission complete: every ring, and every drop for mission 3.
    const ringsDone = s.rings >= s.ringsTotal;
    const dropsDone = s.drops >= s.dropsTotal;
    if (ringsDone && dropsDone && this.mission.id !== 2 && !s.over) {
      s.win = true;
      s.over = true;
      s.score += 200;
      this.say('MISSION COMPLETE  +200');
      events |= EVENT_WIN | EVENT_OVER;
    }

    // Failure: out of fuel, hull gone, or course finished without the goal.
    if (s.fuel <= 0 && !s.over) {
      s.fuel = 0;
      s.over = true;
      s.reason = 'Out of fuel — rings refund fuel, mind the throttle.';
      events |= EVENT_OVER;
    }
    if (s.hull <= 0 && !s.over) {
      s.hull = 0;
      s.over = true;
      s.reason = 'Hull destroyed — the valley wins this round.';
      events |= EVENT_OVER;
    }
    if (s.z >= this.course.totalLength && !s.over) {
      s.over = true;
      s.reason = s.rings >= s.ringsTotal ? '' : 'Course finished with rings unflown.';
      if (!s.reason) {
        s.win = true;
        s.score += 200;
        events |= EVENT_WIN;
      }
      events |= EVENT_OVER;
    }
    return events;
  }
}

/**
 * The screenshot autopilot: steer toward the next ring (or the valley centre),
 * hold a steady throttle, and sidestep any obstacle straight ahead.
 * It plays the real rules, so a staged frame is a real game frame.
 */
export function autopilot(world) {
  const s = world.state;
  const input = { steer: 0, pitch: 0, throttle: 0, drop: false };
  const ring = world.nextRing();
  const ground = world.groundAt(s.z);
  let targetX = 0;
  // Targets are absolute altitudes: ring centre is segment ground + ring alt.
  let targetAlt = ground + 1500;
  // Mission 3: a drop zone close ahead outranks a ring — line up early.
  const nearZone = world.nextZone();
  let zoneAhead = null;
  if (nearZone) {
    const zoneZ = nearZone.segment.index * SEGMENT_LENGTH;
    if (zoneZ - s.z > 0 && zoneZ - s.z < 4000) zoneAhead = nearZone;
  }
  if (zoneAhead) {
    targetX = zoneAhead.zone.x;
    targetAlt = zoneAhead.segment.y + 900;
  } else if (ring) {
    targetX = ring.ring.x;
    targetAlt = ring.segment.y + ring.ring.alt;
  } else if (world.mission.id === 2 && nearZone) {
    targetX = nearZone.zone.x;
    targetAlt = nearZone.segment.y + 900;
  }
  // Final approach (mission 3): slow down, descend, centre on the runway.
  if (world.mission.id === 2) {
    const runwayZ = world.course.runwayStart * SEGMENT_LENGTH;
    if (s.z > runwayZ - 20000) {
      targetX = 0;
      targetAlt = world.course.segments[world.course.runwayStart].y + 220;
    }
  }
  const dx = targetX - s.x;
  input.steer = Math.max(-1, Math.min(1, dx / 600));
  const dy = targetAlt - s.y;
  input.pitch = Math.max(-1, Math.min(1, dy / 700));
  // Sidestep anything dead ahead within 900 units.
  for (let ahead = 0; ahead < 1200; ahead += SEGMENT_LENGTH) {
    const segment = world.segmentAt(s.z + ahead);
    for (const sprite of segment.sprites) {
      if (sprite.hit) continue;
      if (Math.abs(s.x - sprite.x) < 700 && Math.abs(s.y - (segment.y + sprite.alt)) < 700) {
        input.steer = sprite.x > s.x ? -1 : 1;
        input.pitch = (segment.y + sprite.alt) > s.y ? -0.6 : 0.6;
      }
    }
  }
  // Mission 3: drop when over a zone.
  if (world.mission.id === 2) {
    const zone = world.nextZone();
    if (zone) {
      const zoneZ = zone.segment.index * SEGMENT_LENGTH;
      if (Math.abs(s.z - zoneZ) < 500 && Math.abs(s.x - zone.zone.x) < 600) {
        input.drop = true;
      }
    }
  }
  input.throttle = s.speed < world.mission.baseSpeed ? 0.25 : -0.1;
  // Mission 3 final approach: throttle right down for the landing.
  if (world.mission.id === 2) {
    const runwayZ = world.course.runwayStart * SEGMENT_LENGTH;
    if (s.z > runwayZ - 20000) input.throttle = -1;
  }
  return input;
}

/** Step the world with the autopilot for `seconds`, in fixed steps. */
export function simulate(world, seconds) {
  const steps = Math.floor(seconds / STEP);
  let events = 0;
  for (let index = 0; index < steps; index += 1) {
    events |= world.step(STEP, autopilot(world));
    if (world.state.over) break;
  }
  return events;
}
