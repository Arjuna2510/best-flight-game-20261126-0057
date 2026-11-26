// Emberwing: Ridge Run — boot, game loop, screen state machine.
// One clear job: wire input, world, renderer and sound into a playable game.
import { World, EVENT_RING, EVENT_HIT, EVENT_DROP, EVENT_WIN } from './world.js';
import { Renderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSE, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { stageShot } from './shots.js';
import { MISSIONS, VIEW, STEP } from './config.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
canvas.width = VIEW.width;
canvas.height = VIEW.height;

const renderer = new Renderer(canvas);
const input = new Input(canvas);
const sound = new Sound();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number(params.get('seed') || '1');

let world = new World(0);
let screen = SCREEN_TITLE;
let selected = 0;
let best = 0;
let time = 0;
let last = performance.now();
let paused = false;

/** Start the selected mission from the title screen. */
function startMission(index) {
  world = new World(index);
  selected = index;
  screen = SCREEN_PLAY;
  paused = false;
  sound.unlock();
  status('Mission started: ' + MISSIONS[index].name);
}

function status(text) {
  statusLine.textContent = text;
}

function nextMission() {
  if (selected + 1 < MISSIONS.length) startMission(selected + 1);
  else {
    world = new World(0);
    screen = SCREEN_TITLE;
  }
}

input.onKey = (code) => {
  sound.unlock();
  if (code === 'KeyM') {
    const muted = sound.toggleMute();
    status(muted ? 'Sound muted' : 'Sound on');
    return;
  }
  if (screen === SCREEN_TITLE) {
    if (code === 'Digit1' || code === 'Digit2' || code === 'Digit3') {
      selected = Number(code.slice(-1)) - 1;
    } else if (code === 'Enter' || code === 'Space') {
      startMission(selected);
    }
    return;
  }
  if (code === 'KeyP' && (screen === SCREEN_PLAY || screen === SCREEN_PAUSE)) {
    paused = !paused;
    screen = paused ? SCREEN_PAUSE : SCREEN_PLAY;
    status(paused ? 'Paused' : 'Resumed');
    return;
  }
  if (code === 'KeyR' && screen !== SCREEN_TITLE) {
    startMission(selected);
    return;
  }
  if (code === 'KeyT') {
    world = new World(selected);
    screen = SCREEN_TITLE;
    paused = false;
    return;
  }
  if (screen === SCREEN_OVER && (code === 'Enter' || code === 'Space')) {
    startMission(selected);
    return;
  }
  if (screen === SCREEN_WIN && code === 'Enter') {
    nextMission();
  }
};

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  if (shotName) {
    // Screenshot mode: the scene was staged synchronously at boot; draw once.
    renderer.render(world, screen, time, { selected, best });
    return;
  }
  if (screen === SCREEN_PLAY && !paused) {
    const controls = input.read();
    let events = 0;
    let remaining = dt;
    while (remaining > 0) {
      const step = Math.min(STEP, remaining);
      events |= world.step(step, controls);
      remaining -= step;
    }
    if (events & EVENT_RING) sound.ring();
    if (events & EVENT_DROP) sound.drop();
    if (events & EVENT_HIT) sound.hit();
    if (events & EVENT_WIN) sound.win();
    sound.setEngine(world.state.throttle, world.state.speed / 14500);
    if (world.state.over) {
      if (world.state.win) {
        screen = SCREEN_WIN;
        best = Math.max(best, world.state.score);
        status('Mission complete: ' + world.mission.name);
      } else {
        screen = SCREEN_OVER;
        sound.crash();
        status('Mission failed: ' + (world.state.reason || 'crashed'));
      }
    }
  }
  renderer.render(world, screen, time, { selected, best, hasNext: selected + 1 < MISSIONS.length });
  window.requestAnimationFrame(frame);
}

if (shotName) {
  // Deterministic screenshot: stage the scene synchronously, then draw it.
  const staged = stageShot(shotName, world);
  world = staged.world;
  screen = staged.screen;
  best = staged.best;
  void seedParam;
  renderer.render(world, screen, 12.5, {
    selected: world.mission.id,
    best,
    hasNext: world.mission.id + 1 < MISSIONS.length,
  });
  status('Screenshot scene: ' + shotName);
} else {
  window.requestAnimationFrame(frame);
}
