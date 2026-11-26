// Emberwing: Ridge Run — tuning constants and the three missions.
// One clear job: every number the world and the renderer share lives here.
export const VIEW = { width: 1280, height: 800 };

/** World units: one course segment is this long, the valley is this wide. */
export const SEGMENT_LENGTH = 200;
export const ROAD_HALF_WIDTH = 2400;
export const CAMERA_HEIGHT = 1100;
export const CAMERA_DEPTH = 0.84;
/** How many segments ahead the renderer draws. */
export const DRAW_DISTANCE = 220;
/** Player physics, in world units and seconds. */
export const PLAYER = {
  maxSpeed: 14500,
  minSpeed: 3200,
  accel: 5200,
  brake: 9000,
  /** Lateral speed across the valley, units per second at full steer. */
  steerSpeed: 2600,
  /** Vertical speed, units per second at full pitch. */
  climbSpeed: 1500,
  /** Highest the aircraft may climb above the valley floor. */
  ceiling: 5200,
  /** Fuel burnt per second at full throttle; rings refund some. */
  fuelBurn: 1.15,
  ringFuel: 7,
  /** Hull lost per obstacle hit and per terrain scrape. */
  hitDamage: 22,
  scrapeDamage: 12,
};
export const RING = { radius: 850, score: 100, nearMiss: 25 };
export const DROP = { score: 250, zoneRadius: 700 };
export const LANDING = { score: 500, maxSpeed: 5200, maxOffset: 520 };

/** The three missions. Same valley, different jobs — that is the depth. */
export const MISSIONS = [
  {
    id: 0,
    name: 'DAWN PATROL',
    subtitle: 'Ring Run over Ember Valley',
    seed: 101,
    segments: 1500,
    rings: 12,
    obstacles: 10,
    baseSpeed: 6200,
    fuel: 100,
    goal: 'Fly through all 12 rings before the fuel runs dry.',
    sky: { top: '#1d3a5f', mid: '#7d90b0', low: '#f2a65a', sun: '#ffd9a0' },
  },
  {
    id: 1,
    name: 'CANYON RUSH',
    subtitle: 'Storm Gap at full throttle',
    seed: 202,
    segments: 1700,
    rings: 16,
    obstacles: 26,
    baseSpeed: 8600,
    fuel: 100,
    goal: 'Thread 16 rings through the storm canyon. Mind the thunderheads.',
    sky: { top: '#141c2e', mid: '#4a5878', low: '#c97e4a', sun: '#ffe9c4' },
  },
  {
    id: 2,
    name: 'RELIEF DROP',
    subtitle: 'Supplies for Merapi Valley, then land it',
    seed: 303,
    segments: 2000,
    rings: 6,
    obstacles: 16,
    baseSpeed: 7000,
    fuel: 100,
    goal: 'Drop a crate on each of the 3 marked zones (SPACE), then land on the runway.',
    sky: { top: '#274b63', mid: '#8fa8a0', low: '#f7c873', sun: '#fff3c9' },
  },
];

/** Ground band colours by elevation, valley floor to snow line. */
export const GROUND_BANDS = [
  { max: 500, light: '#5f9a4e', dark: '#548a45' },
  { max: 1400, light: '#7a9a52', dark: '#6d8a49' },
  { max: 2400, light: '#8a7a4e', dark: '#7d6e46' },
  { max: 3400, light: '#7a6a58', dark: '#6e5f4f' },
  { max: 99999, light: '#cfd6dd', dark: '#bcc4cc' },
];

export const STEP = 1 / 60;
export const FIELD = { width: VIEW.width, height: VIEW.height };
