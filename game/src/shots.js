// Emberwing: Ridge Run — the screenshot scenes behind ?shot=.
// One clear job: stage a named scene by playing the real rules forward, so
// every screenshot is a frame a real game produces, never a mockup.
import { World, simulate } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { STEP } from './config.js';

const START_SECONDS = 4;
const PLAY_SECONDS = 24;
const DROP_SECONDS = 42;
const END_SECONDS = 600;

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title screen over the dawn runway. play: mid-flight through the
 * rings. drop: mission 3, low over a drop zone with a crate away.
 * end: mission 1 flown to completion by the autopilot.
 */
export function stageShot(name, world) {
  if (name === 'drop') {
    const dropWorld = new World(2);
    simulate(dropWorld, DROP_SECONDS);
    return { world: dropWorld, screen: SCREEN_PLAY, best: dropWorld.state.score };
  }
  if (name === 'end') {
    const endWorld = new World(0);
    simulate(endWorld, END_SECONDS);
    const screen = endWorld.state.win ? SCREEN_WIN : SCREEN_OVER;
    return { world: endWorld, screen, best: endWorld.state.score };
  }
  if (name === 'play') {
    const playWorld = new World(0);
    simulate(playWorld, PLAY_SECONDS);
    return { world: playWorld, screen: SCREEN_PLAY, best: playWorld.state.score };
  }
  const startWorld = new World(0);
  simulate(startWorld, START_SECONDS);
  return { world: startWorld, screen: SCREEN_TITLE, best: 0 };
}

export function shotSeconds(name) {
  if (name === 'drop') return DROP_SECONDS;
  if (name === 'end') return END_SECONDS;
  if (name === 'play') return PLAY_SECONDS;
  return START_SECONDS;
}

export { STEP };
