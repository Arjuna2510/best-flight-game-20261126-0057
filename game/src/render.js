// Emberwing: Ridge Run — everything drawn: sky, valley, aircraft, HUD, screens.
// One clear job: turn a world state into a frame. No simulation lives here.
import {
  VIEW, SEGMENT_LENGTH, ROAD_HALF_WIDTH, CAMERA_HEIGHT, CAMERA_DEPTH,
  DRAW_DISTANCE, PLAYER, RING, DROP, GROUND_BANDS, MISSIONS,
} from './config.js';
import { mulberry32 } from './random.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSE = 'pause';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const AMBER = '#ffb347';
const PANEL = 'rgba(10, 16, 28, 0.72)';

function bandColor(elevation, alternate) {
  for (const band of GROUND_BANDS) {
    if (elevation <= band.max) return alternate ? band.dark : band.light;
  }
  return GROUND_BANDS[GROUND_BANDS.length - 1].light;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Deterministic scenery: mountains, clouds and valley pines, seeded from the mission. */
function buildScenery(seed, count) {
  const random = mulberry32(seed * 7 + 5);
  const mountains = [];
  const clouds = [];
  const trees = [];
  for (let index = 0; index < count; index += 1) {
    if (random() < 0.18) {
      mountains.push({
        at: index,
        side: random() < 0.5 ? -1 : 1,
        offset: 2.2 + random() * 1.3,
        height: 1500 + random() * 1700,
        width: 1400 + random() * 1200,
      });
    }
    if (random() < 0.12) {
      clouds.push({
        at: index,
        x: (random() - 0.5) * ROAD_HALF_WIDTH * 3,
        alt: 4200 + random() * 2600,
        size: 150 + random() * 220,
      });
    }
    if (random() < 0.5) {
      const cluster = 1 + Math.floor(random() * 3);
      for (let t = 0; t < cluster; t += 1) {
        trees.push({
          at: index,
          side: random() < 0.5 ? -1 : 1,
          offset: 0.55 + random() * 0.85,
          height: 130 + random() * 160,
        });
      }
    }
  }
  return { mountains, clouds, trees };
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.heading = 270;
    this.scenery = null;
    this.scenerySeed = -1;
  }

  project(wx, wy, wz, camX, camY, camZ) {
    const dz = wz - camZ;
    if (dz <= CAMERA_DEPTH) return null;
    const scale = CAMERA_DEPTH / dz;
    return {
      x: VIEW.width / 2 + scale * (wx - camX) * (VIEW.width / 2),
      y: VIEW.height / 2 - scale * (wy - camY) * (VIEW.height / 2),
      w: scale * ROAD_HALF_WIDTH * (VIEW.width / 2),
      scale,
    };
  }

  drawSky(mission) {
    const { ctx } = this;
    const sky = mission.sky;
    const gradient = ctx.createLinearGradient(0, 0, 0, VIEW.height / 2);
    gradient.addColorStop(0, sky.top);
    gradient.addColorStop(0.6, sky.mid);
    gradient.addColorStop(1, sky.low);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height / 2 + 2);
    // Low sun, warm and big.
    const sunX = VIEW.width * 0.78;
    const sunY = VIEW.height * 0.2;
    const glow = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 190);
    glow.addColorStop(0, sky.sun);
    glow.addColorStop(0.35, 'rgba(255, 190, 110, 0.55)');
    glow.addColorStop(1, 'rgba(255, 190, 110, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 200, sunY - 200, 400, 400);
    ctx.fillStyle = sky.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();
    // Distant ridge line, drawn from a fixed sine sum.
    ctx.fillStyle = 'rgba(38, 52, 84, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, VIEW.height / 2);
    for (let x = 0; x <= VIEW.width; x += 16) {
      const ridge = 46 * Math.sin(x * 0.004 + 1.7) + 30 * Math.sin(x * 0.011 + 4.2) + 18 * Math.sin(x * 0.023);
      ctx.lineTo(x, VIEW.height / 2 - 60 - ridge);
    }
    ctx.lineTo(VIEW.width, VIEW.height / 2);
    ctx.closePath();
    ctx.fill();
  }

  drawCloud(point, size) {
    const { ctx } = this;
    const radius = Math.max(2, point.scale * size * (VIEW.width / 2));
    if (radius < 2 || radius > 120) return;
    ctx.fillStyle = 'rgba(255, 244, 230, 0.85)';
    ctx.beginPath();
    ctx.ellipse(point.x, point.y, radius * 2.2, radius * 0.75, 0, 0, Math.PI * 2);
    ctx.ellipse(point.x - radius, point.y + radius * 0.2, radius * 1.2, radius * 0.55, 0, 0, Math.PI * 2);
    ctx.ellipse(point.x + radius, point.y + radius * 0.2, radius * 1.3, radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMountain(point, mountain) {
    const { ctx } = this;
    // Mountains are a backdrop: skip any close enough to fill the frame.
    if (point.scale > 0.00014) return;
    const half = Math.max(2, point.scale * mountain.width * (VIEW.width / 2));
    const height = Math.max(2, point.scale * mountain.height * (VIEW.height / 2));
    if (half < 3 || point.y + 4 < 0) return;
    const baseY = point.y + 4;
    ctx.fillStyle = '#4a5878';
    ctx.beginPath();
    ctx.moveTo(point.x - half, baseY);
    ctx.lineTo(point.x, point.y - height);
    ctx.lineTo(point.x + half, baseY);
    ctx.closePath();
    ctx.fill();
    // Snow cap.
    ctx.fillStyle = '#e8edf2';
    ctx.beginPath();
    ctx.moveTo(point.x - half * 0.32, baseY - height * 0.68);
    ctx.lineTo(point.x, point.y - height);
    ctx.lineTo(point.x + half * 0.32, baseY - height * 0.68);
    ctx.lineTo(point.x + half * 0.14, baseY - height * 0.55);
    ctx.lineTo(point.x, baseY - height * 0.62);
    ctx.lineTo(point.x - half * 0.14, baseY - height * 0.55);
    ctx.closePath();
    ctx.fill();
  }

  drawTree(point, tree) {
    const { ctx } = this;
    const height = Math.max(2, point.scale * tree.height * (VIEW.height / 2));
    const half = height * 0.42;
    if (height < 3 || height > 300) return;
    const baseY = point.y + 2;
    ctx.fillStyle = '#2e5d33';
    ctx.beginPath();
    ctx.moveTo(point.x - half, baseY);
    ctx.lineTo(point.x, point.y - height);
    ctx.lineTo(point.x + half, baseY);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3a7040';
    ctx.beginPath();
    ctx.moveTo(point.x - half * 0.62, baseY - height * 0.38);
    ctx.lineTo(point.x, point.y - height);
    ctx.lineTo(point.x + half * 0.62, baseY - height * 0.38);
    ctx.closePath();
    ctx.fill();
  }

  drawRing(point, passed) {
    const { ctx } = this;
    const radius = Math.max(3, point.scale * RING.radius * (VIEW.width / 2));
    if (radius < 3 || radius > 900) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(1, 0.62);
    ctx.lineWidth = Math.max(2, radius * 0.09);
    ctx.strokeStyle = passed ? 'rgba(120, 220, 130, 0.9)' : AMBER;
    ctx.shadowColor = passed ? '#78dc82' : AMBER;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = Math.max(1, radius * 0.02);
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.86, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawObstacle(point, sprite, time) {
    const { ctx } = this;
    const radius = Math.max(3, point.scale * sprite.radius * (VIEW.width / 2));
    if (radius < 3 || radius > 800) return;
    if (sprite.kind === 'balloon') {
      const bob = Math.sin(time * 1.4 + point.x) * radius * 0.08;
      ctx.fillStyle = '#d64545';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + bob, radius, radius * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f5ead6';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y + bob, radius * 0.45, radius * 1.15, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#5a3a28';
      ctx.lineWidth = Math.max(1, radius * 0.05);
      ctx.beginPath();
      ctx.moveTo(point.x - radius * 0.5, point.y + bob + radius * 0.9);
      ctx.lineTo(point.x, point.y + bob + radius * 1.5);
      ctx.lineTo(point.x + radius * 0.5, point.y + bob + radius * 0.9);
      ctx.stroke();
    } else if (sprite.kind === 'storm') {
      ctx.fillStyle = 'rgba(52, 56, 72, 0.92)';
      ctx.beginPath();
      ctx.ellipse(point.x, point.y, radius * 1.7, radius * 0.8, 0, 0, Math.PI * 2);
      ctx.ellipse(point.x - radius * 0.8, point.y + radius * 0.25, radius, radius * 0.6, 0, 0, Math.PI * 2);
      ctx.ellipse(point.x + radius * 0.8, point.y + radius * 0.25, radius * 1.1, radius * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      if (Math.sin(time * 7 + point.x * 0.01) > 0.86) {
        ctx.strokeStyle = '#ffe27a';
        ctx.lineWidth = Math.max(1.5, radius * 0.06);
        ctx.beginPath();
        ctx.moveTo(point.x, point.y + radius * 0.5);
        ctx.lineTo(point.x - radius * 0.2, point.y + radius * 1.1);
        ctx.lineTo(point.x + radius * 0.15, point.y + radius * 1.5);
        ctx.stroke();
      }
    } else {
      // Rock spire.
      ctx.fillStyle = '#6e5a44';
      ctx.beginPath();
      ctx.moveTo(point.x - radius * 0.7, point.y + radius);
      ctx.lineTo(point.x, point.y - radius * 1.6);
      ctx.lineTo(point.x + radius * 0.7, point.y + radius);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#e8edf2';
      ctx.beginPath();
      ctx.moveTo(point.x - radius * 0.22, point.y - radius * 1.05);
      ctx.lineTo(point.x, point.y - radius * 1.6);
      ctx.lineTo(point.x + radius * 0.22, point.y - radius * 1.05);
      ctx.closePath();
      ctx.fill();
    }
  }

  drawZone(point) {
    const { ctx } = this;
    const radius = Math.max(3, point.scale * DROP.zoneRadius * (VIEW.width / 2));
    if (radius < 3 || radius > 700) return;
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.scale(1, 0.32);
    ctx.fillStyle = 'rgba(255, 120, 60, 0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff783c';
    ctx.lineWidth = Math.max(2, radius * 0.05);
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  /** The aircraft, chase view: a built-looking jet, banking with the turn. */
  drawAircraft(state, time) {
    const { ctx } = this;
    const cx = VIEW.width / 2 + state.bank * 46;
    const cy = VIEW.height * 0.62 - state.pitch * 26;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(state.bank * 0.42);
    ctx.scale(1.55, 1.55);
    const flame = 0.75 + Math.sin(time * 31) * 0.25;
    // Afterburner glow, tight to the tail.
    const glow = ctx.createRadialGradient(0, 46, 2, 0, 46, 30 * flame);
    glow.addColorStop(0, 'rgba(255, 190, 90, 0.95)');
    glow.addColorStop(0.5, 'rgba(255, 110, 40, 0.55)');
    glow.addColorStop(1, 'rgba(255, 110, 40, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.ellipse(0, 46, 20 * flame, 26 * flame, 0, 0, Math.PI * 2);
    ctx.fill();
    // Swept wings, near-horizontal so the jet reads as flying, not diving.
    ctx.fillStyle = '#5a6a8f';
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-122, 20);
    ctx.lineTo(-114, 34);
    ctx.lineTo(-10, 28);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(122, 20);
    ctx.lineTo(114, 34);
    ctx.lineTo(10, 28);
    ctx.closePath();
    ctx.fill();
    // Sunlit leading edge on each wing.
    ctx.strokeStyle = 'rgba(255, 220, 160, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-12, 4);
    ctx.lineTo(-122, 20);
    ctx.moveTo(12, 4);
    ctx.lineTo(122, 20);
    ctx.stroke();
    // Wing tip lights.
    ctx.fillStyle = '#ff5a4a';
    ctx.beginPath();
    ctx.arc(-118, 26, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7dff8a';
    ctx.beginPath();
    ctx.arc(118, 26, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Tail fins.
    ctx.fillStyle = '#2c3348';
    ctx.beginPath();
    ctx.moveTo(-16, -6);
    ctx.lineTo(-30, -42);
    ctx.lineTo(-18, -40);
    ctx.lineTo(-6, -10);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -6);
    ctx.lineTo(30, -42);
    ctx.lineTo(18, -40);
    ctx.lineTo(6, -10);
    ctx.closePath();
    ctx.fill();
    // Fuselage, sunlit on top so it reads against the ground.
    const body = ctx.createLinearGradient(-17, -60, 17, 44);
    body.addColorStop(0, '#93a5c4');
    body.addColorStop(0.5, '#5f7092');
    body.addColorStop(1, '#39445e');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(0, -66);
    ctx.quadraticCurveTo(17, -30, 15, 30);
    ctx.quadraticCurveTo(14, 44, 0, 46);
    ctx.quadraticCurveTo(-14, 44, -15, 30);
    ctx.quadraticCurveTo(-17, -30, 0, -66);
    ctx.fill();
    // Panel lines.
    ctx.strokeStyle = 'rgba(10, 16, 28, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-8, -50);
    ctx.lineTo(-10, 30);
    ctx.moveTo(8, -50);
    ctx.lineTo(10, 30);
    ctx.stroke();
    // Canopy, lit amber.
    ctx.fillStyle = '#ffcf7d';
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.ellipse(0, -32, 5, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Engine nozzles.
    ctx.fillStyle = '#0f1420';
    ctx.beginPath();
    ctx.arc(-8, 42, 5, 0, Math.PI * 2);
    ctx.arc(8, 42, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.arc(-8, 42, 2.5, 0, Math.PI * 2);
    ctx.arc(8, 42, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  panel(x, y, width, height) {
    const { ctx } = this;
    ctx.fillStyle = PANEL;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  text(str, x, y, size, color, align, bold) {
    const { ctx } = this;
    ctx.font = `${bold ? '700' : '400'} ${size}px ui-monospace, "SF Mono", Menlo, Consolas, monospace`;
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(str, x, y);
  }

  drawHud(world, time) {
    const { ctx } = this;
    const s = world.state;
    const mission = world.mission;
    this.heading += s.bank * 14 * (1 / 60);
    this.heading = ((this.heading % 360) + 360) % 360;
    const knots = Math.round(s.speed * 0.12);
    const groundNow = world.groundAt(s.z);
    const feet = Math.round((s.y - groundNow) * 3.2);
    const heading = Math.round(this.heading);

    // Top-left: mission and objective.
    this.panel(16, 14, 430, 64);
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 8;
    this.text(`EMBERWING — ${mission.name}`, 30, 40, 17, AMBER, 'left', true);
    ctx.shadowBlur = 0;
    const objective = mission.id === 2
      ? `RINGS ${s.rings}/${s.ringsTotal}   DROPS ${s.drops}/${s.dropsTotal}   THEN LAND`
      : `RINGS ${s.rings}/${s.ringsTotal}`;
    this.text(objective, 30, 64, 14, '#e8ecf4');
    this.text(`SCORE ${s.score}`, 330, 40, 15, '#ffffff', 'left', true);

    // Top-right: fuel and hull.
    this.panel(VIEW.width - 246, 14, 230, 64);
    this.text('FUEL', VIEW.width - 232, 38, 12, '#9fb0c8');
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(VIEW.width - 178, 26, 148, 12);
    ctx.fillStyle = s.fuel < 25 ? '#ff5a4a' : '#ffb347';
    ctx.fillRect(VIEW.width - 178, 26, 148 * clamp(s.fuel / 100, 0, 1), 12);
    this.text('HULL', VIEW.width - 232, 64, 12, '#9fb0c8');
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(VIEW.width - 178, 52, 148, 12);
    ctx.fillStyle = s.hull < 30 ? '#ff5a4a' : '#7dff8a';
    ctx.fillRect(VIEW.width - 178, 52, 148 * clamp(s.hull / 100, 0, 1), 12);

    // Bottom-left: altitude. Bottom-right: speed. Bottom-centre: heading + throttle.
    this.panel(16, VIEW.height - 92, 210, 76);
    this.text('ALT', 30, VIEW.height - 66, 12, '#9fb0c8');
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 6;
    this.text(`${feet.toLocaleString('en-US')} FT`, 30, VIEW.height - 34, 22, '#ffffff', 'left', true);
    ctx.shadowBlur = 0;
    this.panel(VIEW.width - 226, VIEW.height - 92, 210, 76);
    this.text('SPD', VIEW.width - 212, VIEW.height - 66, 12, '#9fb0c8');
    ctx.shadowColor = AMBER;
    ctx.shadowBlur = 6;
    this.text(`${knots} KT`, VIEW.width - 212, VIEW.height - 34, 22, '#ffffff', 'left', true);
    ctx.shadowBlur = 0;
    this.panel(VIEW.width / 2 - 190, VIEW.height - 92, 380, 76);
    this.text(`HDG ${String(heading).padStart(3, '0')}°`, VIEW.width / 2 - 176, VIEW.height - 66, 13, '#e8ecf4');
    this.text('THR', VIEW.width / 2 - 176, VIEW.height - 34, 12, '#9fb0c8');
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(VIEW.width / 2 - 128, VIEW.height - 46, 220, 12);
    ctx.fillStyle = AMBER;
    ctx.fillRect(VIEW.width / 2 - 128, VIEW.height - 46, 220 * clamp(s.throttle, 0, 1), 12);
    this.text(`${Math.round(s.throttle * 100)}%`, VIEW.width / 2 + 104, VIEW.height - 34, 12, '#e8ecf4');

    // Next-ring guide: chevrons point at the ring ahead.
    const ring = world.nextRing();
    if (ring && !s.over) {
      const dx = ring.ring.x - s.x;
      const dy = (ring.segment.y + ring.ring.alt) - s.y;
      const cx = VIEW.width / 2;
      const cy = VIEW.height * 0.42;
      ctx.save();
      ctx.translate(cx + clamp(dx / 14, -90, 90), cy + clamp(-dy / 18, -56, 56));
      ctx.strokeStyle = AMBER;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-14, 8);
      ctx.lineTo(0, -10);
      ctx.lineTo(14, 8);
      ctx.stroke();
      ctx.restore();
    }

    // Centre message, fading.
    if (s.message && s.messageTime > 0) {
      ctx.globalAlpha = clamp(s.messageTime, 0, 1);
      ctx.shadowColor = AMBER;
      ctx.shadowBlur = 10;
      this.text(s.message, VIEW.width / 2, 128, 24, '#ffffff', 'center', true);
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Warnings.
    const blink = Math.sin(time * 6) > 0;
    if (s.fuel < 25 && blink) {
      ctx.shadowColor = '#ff5a4a';
      ctx.shadowBlur = 10;
      this.text('LOW FUEL', VIEW.width / 2, 168, 20, '#ff5a4a', 'center', true);
      ctx.shadowBlur = 0;
    }
    if (s.hull < 30 && blink) {
      ctx.shadowColor = '#ff5a4a';
      ctx.shadowBlur = 10;
      this.text('HULL CRITICAL', VIEW.width / 2, 196, 20, '#ff5a4a', 'center', true);
      ctx.shadowBlur = 0;
    }
    const ground = world.groundAt(s.z);
    if (s.y < ground + 420 && !s.over && blink) {
      ctx.shadowColor = '#ff5a4a';
      ctx.shadowBlur = 10;
      this.text('PULL UP', VIEW.width / 2, 224, 22, '#ff5a4a', 'center', true);
      ctx.shadowBlur = 0;
    }
  }

  drawWorld(world, time) {
    const { ctx } = this;
    const s = world.state;
    const mission = world.mission;
    if (this.scenerySeed !== mission.seed) {
      this.scenery = buildScenery(mission.seed, world.course.count);
      this.scenerySeed = mission.seed;
    }
    const baseIndex = Math.floor(s.z / SEGMENT_LENGTH) % world.course.count;
    const basePercent = (s.z % SEGMENT_LENGTH) / SEGMENT_LENGTH;
    const baseSegment = world.course.segments[baseIndex];
    const camX = baseSegment.x + s.x;
    const camY = s.y + CAMERA_HEIGHT;
    const camZ = s.z;

    this.drawSky(mission);

    // Clouds first (behind the terrain), then mountains, then the valley floor.
    const far = [];
    for (const cloud of this.scenery.clouds) {
      const cz = cloud.at * SEGMENT_LENGTH;
      if (cz < s.z - 400 || cz > s.z + DRAW_DISTANCE * SEGMENT_LENGTH) continue;
      const point = this.project(cloud.x, cloud.alt, cz, camX, camY, camZ);
      if (point) far.push({ point, cloud });
    }
    far.sort((a, b) => a.point.scale - b.point.scale);
    for (const item of far) this.drawCloud(item.point, item.cloud.size);

    // Ground strips, painted far to near so near ground covers far ground.
    // No hill clipping: the valley floor is drawn as trapezoids in painter
    // order, which stays correct over crests and dips alike.
    const drawn = [];
    for (let n = 0; n < DRAW_DISTANCE; n += 1) {
      const index = (baseIndex + n) % world.course.count;
      const segment = world.course.segments[index];
      const next = world.course.segments[(index + 1) % world.course.count];
      const looped = index < baseIndex;
      const zOff = looped ? -world.course.totalLength : 0;
      const p1 = this.project(segment.x, segment.y, segment.index * SEGMENT_LENGTH + zOff, camX, camY, camZ);
      const p2 = this.project(next.x, next.y, next.index * SEGMENT_LENGTH + zOff, camX, camY, camZ);
      if (!p1 || !p2) continue;
      drawn.push({ segment, next, p1, p2 });
    }
    // Paint far to near so near strips cover far ones.
    for (let i = drawn.length - 1; i >= 0; i -= 1) {
      const { segment, next, p1, p2 } = drawn[i];
      const top = Math.min(p1.y, p2.y);
      const bottom = Math.max(p1.y, p2.y);
      if (bottom < VIEW.height / 2 || top > VIEW.height) continue;
      const alternate = segment.index % 2 === 0;
      ctx.fillStyle = bandColor(segment.y, alternate);
      ctx.beginPath();
      ctx.moveTo(0, p1.y);
      ctx.lineTo(VIEW.width, p1.y);
      ctx.lineTo(VIEW.width, p2.y);
      ctx.lineTo(0, p2.y);
      ctx.closePath();
      ctx.fill();
      // The flight lane: a lighter valley floor band, with a winding river.
      ctx.fillStyle = alternate ? 'rgba(255, 240, 200, 0.10)' : 'rgba(255, 240, 200, 0.05)';
      ctx.beginPath();
      ctx.moveTo(p1.x - p1.w, p1.y);
      ctx.lineTo(p1.x + p1.w, p1.y);
      ctx.lineTo(p2.x + p2.w, p2.y);
      ctx.lineTo(p2.x - p2.w, p2.y);
      ctx.closePath();
      ctx.fill();
      const river1 = Math.sin(segment.index * 0.045) * p1.w * 0.5;
      const river2 = Math.sin(next.index * 0.045) * p2.w * 0.5;
      const riverW1 = Math.max(1.5, p1.w * 0.09);
      const riverW2 = Math.max(1.5, p2.w * 0.09);
      ctx.fillStyle = 'rgba(74, 127, 181, 0.9)';
      ctx.beginPath();
      ctx.moveTo(p1.x + river1 - riverW1, p1.y);
      ctx.lineTo(p1.x + river1 + riverW1, p1.y);
      ctx.lineTo(p2.x + river2 + riverW2, p2.y);
      ctx.lineTo(p2.x + river2 - riverW2, p2.y);
      ctx.closePath();
      ctx.fill();
      if (segment.runway) {
        ctx.fillStyle = '#3a3f4a';
        ctx.beginPath();
        ctx.moveTo(p1.x - p1.w * 0.32, p1.y);
        ctx.lineTo(p1.x + p1.w * 0.32, p1.y);
        ctx.lineTo(p2.x + p2.w * 0.32, p2.y);
        ctx.lineTo(p2.x - p2.w * 0.32, p2.y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#f5f5f5';
        const dashW = Math.max(1, p1.w * 0.03);
        ctx.fillRect(p1.x - dashW / 2, top, dashW, Math.max(1, bottom - top));
      }
    }

    // Sprites on the course: mountains, rings, obstacles, zones, crates.
    const sprites = [];
    for (let n = 0; n < DRAW_DISTANCE; n += 1) {
      const index = (baseIndex + n) % world.course.count;
      const segment = world.course.segments[index];
      const looped = index < baseIndex;
      const zOff = looped ? -world.course.totalLength : 0;
      const segZ = segment.index * SEGMENT_LENGTH + zOff;
      for (const mountain of this.scenery.mountains) {
        if (mountain.at !== index) continue;
        const point = this.project(
          segment.x + mountain.side * ROAD_HALF_WIDTH * mountain.offset,
          segment.y, segZ, camX, camY, camZ,
        );
        if (point) sprites.push({ point, kind: 'mountain', mountain });
      }
      for (const tree of this.scenery.trees) {
        if (tree.at !== index) continue;
        const point = this.project(
          segment.x + tree.side * ROAD_HALF_WIDTH * tree.offset,
          segment.y, segZ, camX, camY, camZ,
        );
        if (point) sprites.push({ point, kind: 'tree', tree });
      }
      if (segment.ring) {
        const point = this.project(
          segment.x + segment.ring.x, segment.y + segment.ring.alt, segZ, camX, camY, camZ,
        );
        if (point) sprites.push({ point, kind: 'ring', passed: segment.ring.passed });
      }
      for (const sprite of segment.sprites) {
        const point = this.project(
          segment.x + sprite.x, segment.y + sprite.alt, segZ, camX, camY, camZ,
        );
        if (point) sprites.push({ point, kind: 'obstacle', sprite });
      }
      if (segment.zone && !segment.zone.done) {
        const point = this.project(segment.x + segment.zone.x, segment.y + 40, segZ, camX, camY, camZ);
        if (point) sprites.push({ point, kind: 'zone' });
      }
    }
    for (const crate of s.crates) {
      const seg = world.segmentAt(crate.z);
      const point = this.project(seg.x + crate.x, seg.y + Math.max(60, crate.y - crate.t * 500), crate.z, camX, camY, camZ);
      if (point) sprites.push({ point, kind: 'crate' });
    }
    sprites.sort((a, b) => a.point.scale - b.point.scale);
    for (const item of sprites) {
      if (item.kind === 'mountain') this.drawMountain(item.point, item.mountain);
      else if (item.kind === 'tree') this.drawTree(item.point, item.tree);
      else if (item.kind === 'ring') this.drawRing(item.point, item.passed);
      else if (item.kind === 'obstacle') this.drawObstacle(item.point, item.sprite, time);
      else if (item.kind === 'zone') this.drawZone(item.point);
      else if (item.kind === 'crate') {
        const size = Math.max(3, item.point.scale * 260 * (VIEW.width / 2));
        ctx.fillStyle = '#ff783c';
        ctx.fillRect(item.point.x - size / 2, item.point.y - size / 2, size, size);
        // Parachute canopy above the falling crate.
        ctx.fillStyle = '#f5ead6';
        ctx.beginPath();
        ctx.arc(item.point.x, item.point.y - size * 0.9, size * 0.9, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = 'rgba(20, 20, 20, 0.6)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(item.point.x - size * 0.9, item.point.y - size * 0.9);
        ctx.lineTo(item.point.x, item.point.y - size / 2);
        ctx.lineTo(item.point.x + size * 0.9, item.point.y - size * 0.9);
        ctx.stroke();
      }
    }
    void basePercent;
  }

  overlay(title, lines, accent, width) {
    const { ctx } = this;
    ctx.fillStyle = 'rgba(8, 12, 22, 0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    const panelWidth = width || 640;
    const height = 120 + lines.length * 34;
    const x = (VIEW.width - panelWidth) / 2;
    const y = (VIEW.height - height) / 2;
    this.panel(x, y, panelWidth, height);
    ctx.shadowColor = accent || AMBER;
    ctx.shadowBlur = 14;
    this.text(title, VIEW.width / 2, y + 58, 34, '#ffffff', 'center', true);
    ctx.shadowBlur = 0;
    lines.forEach((line, index) => {
      this.text(line.text, VIEW.width / 2, y + 104 + index * 34, line.size || 16, line.color || '#dfe6f2', 'center', line.bold);
    });
  }

  render(world, screen, time, extra) {
    const { ctx } = this;
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    this.drawWorld(world, time);
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSE) {
      this.drawAircraft(world.state, time);
      this.drawHud(world, time);
    }
    if (screen === SCREEN_TITLE) {
      this.drawAircraft(world.state, time);
      const selected = extra && typeof extra.selected === 'number' ? extra.selected : 0;
      const lines = [
        { text: 'RIDGE RUN  —  three sorties over Ember Valley', size: 16, color: AMBER },
        { text: '', size: 12 },
      ];
      MISSIONS.forEach((mission, index) => {
        const mark = index === selected ? '▸ ' : '   ';
        lines.push({
          text: `${mark}${index + 1}. ${mission.name} — ${mission.subtitle}`,
          size: 16,
          color: index === selected ? '#ffffff' : '#b9c4d6',
          bold: index === selected,
        });
        lines.push({ text: `      ${mission.goal}`, size: 12, color: '#8fa0b8' });
      });
      lines.push({ text: '', size: 12 });
      lines.push({ text: 'ENTER fly   ·   1/2/3 choose mission', size: 14, color: '#e8ecf4' });
      lines.push({ text: 'Arrows / WASD fly   ·   Shift throttle   ·   SPACE drop   ·   Mouse steers   ·   M mute', size: 13, color: '#e8ecf4' });
      lines.push({ text: `Best score ${extra && extra.best ? extra.best : 0}`, size: 13, color: '#8fa0b8' });
      this.overlay('EMBERWING', lines, AMBER, 780);
    }
    if (screen === SCREEN_PAUSE) {
      this.overlay('PAUSED', [
        { text: 'Take a breath, pilot.', size: 16 },
        { text: 'P resume   ·   R restart   ·   T title', size: 15, color: AMBER },
      ]);
    }
    if (screen === SCREEN_OVER) {
      const s = world.state;
      this.overlay('MISSION FAILED', [
        { text: s.reason || 'The valley wins this round.', size: 16 },
        { text: `Score ${s.score}   ·   Rings ${s.rings}/${s.ringsTotal}   ·   Time ${s.time.toFixed(1)}s`, size: 15, color: AMBER },
        { text: 'R retry   ·   T title', size: 15 },
      ], '#ff5a4a');
    }
    if (screen === SCREEN_WIN) {
      const s = world.state;
      const next = extra && extra.hasNext ? 'ENTER next mission' : 'You flew all three sorties. Ace.';
      this.overlay('MISSION COMPLETE', [
        { text: `${world.mission.name} — ${world.mission.subtitle}`, size: 16 },
        { text: `Score ${s.score}   ·   Rings ${s.rings}/${s.ringsTotal}   ·   Time ${s.time.toFixed(1)}s`, size: 15, color: AMBER },
        { text: `${next}   ·   R replay   ·   T title`, size: 15 },
      ], '#7dff8a');
    }
  }
}
