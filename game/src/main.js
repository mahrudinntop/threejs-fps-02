// Boot and the one loop: a fixed 60 Hz simulation feeding a render at the display's rate. The
// match runs itself: rounds, teams, the charge, the economy and the score live in the modules
// below and this file is only the wiring. ?shot=start|play|end with &seed=N sets up a
// deterministic frame for a capture, renders it twice, then freezes it, as the kit asks.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createWorld, SITE, ATTACK_SPAWN, DEFEND_SPAWN } from './world.js';
import { createInput } from './input.js';
import { createPlayer } from './player.js';
import { createArsenal } from './weapon.js';
import { createBots } from './bots.js';
import { createHud } from './hud.js';
import { createEconomy, WEAPONS } from './economy.js';
import { createObjective } from './objective.js';

const FIXED_STEP = 1 / 60;
const ROUND_SECONDS = 95;
const BUY_SECONDS = 12;
const ROUNDS_TO_WIN = 5;
const TEAM_SIZE = 3;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number.parseInt(params.get('seed') ?? '1', 10) || 1;

function mulberry32(initial) {
  let a = initial;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(seed);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 22, 54);
const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.05, 150);
scene.add(camera);

const world = createWorld(scene);
const player = createPlayer(world.colliders);
const input = createInput(renderer.domElement, onLockChange);
const arsenal = createArsenal(camera);
const bots = createBots(scene, world.colliders, { seed, teamSize: TEAM_SIZE });
const hud = createHud();
const economy = createEconomy();
const objective = createObjective(SITE.center, SITE.radius);

const raycaster = new THREE.Raycaster();
raycaster.far = 90;
const direction = new THREE.Vector3();
const body = player.state;

// The match state: who is alive, the clock, the score, what has been bought this round.
const match = {
  round: 1,
  playerScore: 0,
  enemyScore: 0,
  phase: 'buy',
  clock: BUY_SECONDS,
  over: false,
  lost: false,
  detonated: false,
  money: economy.state.credits,
  feed: [],
};

let score = 0;
let elapsed = 0;
let frozen = false;
let started = false;
let accumulator = 0;
let lastTime = performance.now();

function lineOfSight(from, to) {
  const ray = to.clone().sub(from);
  const distance = ray.length();
  ray.normalize();
  raycaster.set(from, ray);
  raycaster.far = distance - 0.35;
  const hits = raycaster.intersectObjects(world.shootables, false);
  raycaster.far = 90;
  return hits.length === 0;
}

// A round is scored out of ten: winning the round is worth five, every defender you put down
// adds one, and the buy phase announces what the round is worth before it starts.
function roundValue() {
  const kills = bots.bots.filter((bot) => !bot.alive).length;
  return Math.min(10, 5 + kills);
}

function roundBanner() {
  const lost = match.playerScore < match.enemyScore;
  hud.pushFeed(
    `Round ${match.round} — you ${match.playerScore} : ${match.enemyScore} them${lost ? ' (behind)' : ''}`,
    lost ? 'bad' : 'good',
  );
  hud.pushFeed(`Banked $${economy.state.credits} for the buy phase`, 'neutral');
}

function resetRound(withBuyMenu) {
  match.phase = withBuyMenu ? 'buy' : 'live';
  match.clock = withBuyMenu ? BUY_SECONDS : ROUND_SECONDS;
  match.detonated = false;
  match.lost = false;
  body.health = 100;
  body.position.set(ATTACK_SPAWN.x, 0, ATTACK_SPAWN.z);
  body.velocity.set(0, 0, 0);
  body.pitch = 0;
  body.yaw = Math.PI;
  arsenal.refill();
  arsenal.equip(arsenal.state.id, economy.state.grenades);
  objective.reset();
  bots.reset(TEAM_SIZE - 1);
  hud.setScore(match.playerScore, match.enemyScore);
  hud.setRound(match.round, ROUNDS_TO_WIN * 2 - 1);
  if (withBuyMenu) {
    hud.showBuy(economy.state.credits, economy.state.owned);
    hud.setObjective(`Buy phase: 10 points on the line, press 1-4 to buy`, false);
    roundBanner();
  } else {
    hud.hideBuy();
    hud.setObjective('Plant the charge at the site', false);
  }
  syncHud();
}

function endRound(won, reason) {
  if (match.phase === 'ended' || match.over) return;
  match.phase = 'ended';
  match.clock = 4;
  const points = won ? roundValue() : Math.min(5, bots.bots.filter((bot) => !bot.alive).length);
  if (won) {
    match.playerScore += 1;
    hud.flash('good');
    hud.pushFeed(`${reason} (+${points} pts)`, 'good');
  } else {
    match.enemyScore += 1;
    hud.flash('bad');
    hud.pushFeed(`${reason} (${points} pts for kills)`, 'bad');
  }
  score += points;
  economy.settleRound(won);
  hud.setScore(match.playerScore, match.enemyScore);
  if (match.playerScore >= ROUNDS_TO_WIN || match.enemyScore >= ROUNDS_TO_WIN) {
    match.over = true;
    hud.setOverlay(
      match.playerScore >= ROUNDS_TO_WIN ? 'Match won' : 'Match lost',
      `${match.playerScore} : ${match.enemyScore} — ${score} points`,
      'Click to play again',
      match.playerScore >= ROUNDS_TO_WIN ? 'tone-good' : 'tone-bad',
    );
    if (document.pointerLockElement) document.exitPointerLock();
  }
}

function buyKey(index) {
  if (match.phase !== 'buy') return;
  if (index === 1) {
    if (economy.buy('rifle')) arsenal.equip('rifle', economy.state.grenades);
  } else if (index === 2) {
    if (economy.buy('smg')) arsenal.equip('smg', economy.state.grenades);
  } else if (index === 3) {
    if (economy.buy('sniper')) arsenal.equip('sniper', economy.state.grenades);
  } else if (index === 4) {
    if (economy.buyGrenade()) arsenal.state.grenades = economy.state.grenades;
  }
  syncHud();
}

function syncHud() {
  hud.setHealth(body.health);
  hud.setAmmo(arsenal.state.mag, arsenal.state.reserve, arsenal.state.reloading);
  hud.setTimer(match.clock);
  hud.setEconomy(economy.state.credits, arsenal.spec().name, arsenal.state.grenades);
}

function onLockChange(locked) {
  if (shot) return;
  if (locked) {
    started = true;
    hud.hideOverlay();
  } else if (!match.over) {
    hud.setOverlay('Paused', 'Pointer unlocked', 'Click to resume');
  }
}

function syncCamera() {
  camera.position.set(body.position.x, body.position.y + body.eye, body.position.z);
  camera.rotation.set(body.pitch, body.yaw, 0, 'YXZ');
}

function aimAt(point) {
  const dx = point.x - body.position.x;
  const dy = point.y - (body.position.y + body.eye);
  const dz = point.z - body.position.z;
  const length = Math.hypot(dx, dy, dz) || 1;
  body.yaw = Math.atan2(-dx, -dz);
  body.pitch = Math.asin(Math.max(-1, Math.min(1, dy / length)));
  syncCamera();
}

function shoot(spread) {
  if (!arsenal.takeRound()) return false;
  const gun = arsenal.spec();
  camera.getWorldDirection(direction);
  direction.x += (random() * 2 - 1) * spread;
  direction.y += (random() * 2 - 1) * spread;
  direction.z += (random() * 2 - 1) * spread;
  direction.normalize();
  scene.updateMatrixWorld(true);
  raycaster.set(camera.position, direction);
  const targets = bots.hitMeshes().concat(world.shootables);
  const hit = raycaster.intersectObjects(targets, false)[0];
  if (hit && hit.object.userData.bot) {
    const bot = hit.object.userData.bot;
    const head = hit.object.userData.part === 'head';
    const dealt = head ? gun.headDamage : gun.damage;
    const killed = bots.damage(bot, dealt);
    score += killed ? 100 : 10;
    hud.hitMarker(killed, 90);
    if (killed) {
      hud.pushFeed(`${head ? 'Headshot' : 'Kill'} on a Defender (${roundValue()}/10 this round)`, 'good');
    } else {
      hud.pushFeed(`Hit a Defender for ${Math.round(dealt)}${head ? ' (head)' : ''}`, 'good');
    }
  }
  arsenal.pullTrigger();
  player.recoil(0.009 + random() * 0.006, (random() * 2 - 1) * 0.005);
  syncHud();
  return true;
}

function throwGrenade() {
  if (!arsenal.blowGrenade()) return;
  const boom = new THREE.PointLight(new THREE.Color(PALETTE.accent), 8, 12);
  boom.position.copy(camera.position);
  camera.getWorldDirection(direction);
  boom.position.addScaledVector(direction, 4.5);
  scene.add(boom);
  hud.pushFeed('Flare thrown', 'neutral');
  let caught = 0;
  for (const bot of bots.bots) {
    if (!bot.alive) continue;
    const distance = bot.position.distanceTo(boom.position);
    if (distance < 5.2) {
      const killed = bots.damage(bot, 58);
      caught += 1;
      if (killed) score += 100;
    }
  }
  if (caught > 0) hud.pushFeed(`Flare caught ${caught} Defender${caught > 1 ? 's' : ''}`, 'good');
  economy.state.grenades = arsenal.state.grenades;
  syncHud();
  window.setTimeout(() => scene.remove(boom), 180);
}

function step(dt) {
  elapsed += dt;
  player.step(dt, input.state.keys);
  arsenal.step(dt);
  match.clock = Math.max(0, match.clock - dt);

  if (input.state.weaponKey) {
    const key = input.state.weaponKey;
    input.state.weaponKey = 0;
    buyKey(key);
  }
  if (input.state.grenadeKey) {
    input.state.grenadeKey = false;
    throwGrenade();
  }

  bots.update(dt, [{ position: body.position, alive: body.health > 0, team: 'attack', isPlayer: true }, ...bots.bots], lineOfSight, (bot, target, chance, damage) => {
    if (target.isPlayer) {
      if (random() < chance) {
        body.health = Math.max(0, body.health - damage);
        hud.hurt();
        syncHud();
        if (body.health <= 0 && match.phase === 'live') endRound(false, 'You were shot');
      }
    } else if (target.team === 'defend') {
      bots.damage(target, damage * 0.5);
    }
  });

  if (match.phase === 'buy' && match.clock <= 0) {
    match.phase = 'live';
    match.clock = ROUND_SECONDS;
    hud.hideBuy();
    hud.setObjective('Plant the charge at the site', false);
    hud.pushFeed('Buy phase over — round is live', 'neutral');
  }

  if (match.phase === 'live') {
    const inSite = objective.inSite(body.position);
    if (objective.state.phase === 'carried' && inSite && input.state.keys.has('KeyE')) {
      if (objective.plant(dt, true)) {
        hud.pushFeed('Charge planted', 'good');
        hud.setObjective('Defend the charge', true);
      } else {
        hud.setObjective(`Planting ${Math.round((objective.state.plantProgress / 3.2) * 100)}%`, false);
      }
    } else if (objective.state.phase === 'planted') {
      const bombEvent = objective.tick(dt);
      hud.setTimer(Math.max(0, objective.state.fuse));
      hud.setObjective('Charge active: keep them off it', true);
      if (bombEvent === 'detonated') endRound(true, 'Charge detonated');
    }
    const aliveDefenders = bots.aliveCount('defend');
    if (aliveDefenders === 0 && objective.state.phase !== 'planted') endRound(true, 'All defenders down');
    if (body.health <= 0 && match.phase === 'live') endRound(false, 'You were shot');
  }

  if (match.phase === 'ended') {
    if (match.clock <= 0) {
      if (!match.over) {
        match.round += 1;
        resetRound(true);
      }
    }
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  if (!frozen) {
    const look = input.takeLook();
    player.look(look.x, look.y);
    if (input.state.firing && arsenal.ready()) shoot(shot ? 0 : arsenal.spread(player.groundSpeed()));
    if (input.state.keys.has('KeyR')) arsenal.reload();
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_STEP && steps < 5) {
      step(FIXED_STEP);
      accumulator -= FIXED_STEP;
      steps += 1;
    }
    if (accumulator > FIXED_STEP * 5) accumulator = 0;
    syncCamera();
    hud.setHealth(body.health);
    hud.setAmmo(arsenal.state.mag, arsenal.state.reserve, arsenal.state.reloading);
  }
  renderer.render(scene, camera);
}

function settle(steps) {
  for (let index = 0; index < steps; index += 1) step(FIXED_STEP);
}

function runShot(name) {
  hud.hideOverlay();
  body.pitch = 0;
  body.yaw = 0;
  match.phase = 'buy';
  match.clock = BUY_SECONDS;
  if (name === 'play' || name === 'end') {
    economy.buy('rifle');
    arsenal.equip('rifle', 2);
    match.phase = 'live';
    match.clock = ROUND_SECONDS - 28;
    body.position.set(1.4, 0, 4.2);
    settle(30);
    for (let index = 0; index < bots.bots.length; index += 1) {
      const bot = bots.bots[index];
      if (bot.alive) aimAt(new THREE.Vector3(bot.position.x, 1.4, bot.position.z));
      settle(2);
      shoot(0);
      settle(9);
    }
    if (name === 'end') {
      match.playerScore = 4;
      match.enemyScore = 2;
      hud.setScore(4, 2);
      hud.setOverlay('Round won', 'Charge detonated', 'Click to play again', 'tone-good');
      settle(40);
    } else {
      body.position.set(-2.0, 0, -1.2);
      settle(14);
      aimAt(new THREE.Vector3(SITE.center.x, 1.2, SITE.center.z));
      hud.setObjective('Charge active: keep them off it', true);
      hud.setScore(3, 2);
      settle(2);
    }
  } else {
    body.position.set(0, 0, 9.2);
    settle(24);
    aimAt(new THREE.Vector3(SITE.center.x, 1.4, SITE.center.z));
    hud.setScore(0, 0);
    hud.setRound(1, 9);
    hud.showBuy(economy.state.credits, economy.state.owned);
    hud.setObjective('Buy phase: 10 points on the line, press 1-4 to buy', false);
    hud.setOverlay('Ashgrove Yard', 'Round 1 of 9: plant the charge or stop them', 'Click to play');
  }
  syncHud();
  paintTwiceThenReady();
}

function paintTwiceThenReady() {
  let painted = 0;
  function paint() {
    requestAnimationFrame(paint);
    syncCamera();
    renderer.render(scene, camera);
    painted += 1;
    if (painted === 2) {
      window.__shotReady = true;
      frozen = true;
    }
  }
  requestAnimationFrame(paint);
}

hud.setAmmo(arsenal.state.mag, arsenal.state.reserve);
hud.setScore(0, 0);
hud.setRound(1, ROUNDS_TO_WIN * 2 - 1);
hud.setHealth(100);
hud.setTimer(BUY_SECONDS);
hud.onPlay(() => {
  if (shot) return;
  if (match.over) {
    match.over = false;
    match.round = 1;
    match.playerScore = 0;
    match.enemyScore = 0;
    score = 0;
    economy.reset();
    resetRound(true);
  }
  input.requestLock();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

resetRound(true);
body.position.set(ATTACK_SPAWN.x, 0, ATTACK_SPAWN.z);
body.yaw = 0;
syncCamera();
if (shot) runShot(shot);
else requestAnimationFrame(frame);
