// The team, its bots and the round's flow: one side holds the site, the other carries the charge.
// Bots are simple minds on a shared nav graph: a route to the site, a hold post, a reaction to
// what they see and hear. Nothing here touches rendering or the DOM.
import * as THREE from 'three';

const BOT_EYE = 1.62;
const BOT_RADIUS = 0.36;
const BOT_HEIGHT = 1.78;
const VIEW_RANGE = 34;
const FIRE_GAP = 0.34;
const BOT_DAMAGE = 17;

function randomSource(seed) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Routes are lists of world points; each side gets a lane to the site and a hold post on it.
export const ROUTES = {
  attack: [
    [new THREE.Vector3(9.4, 0, 9.6), new THREE.Vector3(9.4, 0, 3.2), new THREE.Vector3(6.2, 0, -1.4), new THREE.Vector3(3.4, 0, -5.6)],
    [new THREE.Vector3(-9.4, 0, 9.6), new THREE.Vector3(-9.4, 0, 3.2), new THREE.Vector3(-6.2, 0, -1.4), new THREE.Vector3(-3.4, 0, -5.6)],
    [new THREE.Vector3(0, 0, 10.2), new THREE.Vector3(0, 0, 4.0), new THREE.Vector3(0.8, 0, -2.0), new THREE.Vector3(0, 0, -6.4)],
  ],
  defend: [
    [new THREE.Vector3(2.6, 0, -6.2), new THREE.Vector3(-2.6, 0, -6.2)],
    [new THREE.Vector3(6.4, 0, -3.4), new THREE.Vector3(-6.4, 0, -3.4)],
    [new THREE.Vector3(0, 0, -8.4), new THREE.Vector3(4.4, 0, -8.0)],
  ],
};

export function createBots(scene, colliders, opts = {}) {
  const random = randomSource(opts.seed ?? 7);
  const homeCount = opts.teamSize ?? 3;
  const bots = [];

  const friendlyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(opts.friendlyColor ?? '#4f7f9e'), roughness: 0.8 });
  const enemyMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(opts.enemyColor ?? '#9e6b4f'), roughness: 0.8 });

  function buildBody(team) {
    const group = new THREE.Group();
    const material = team === 'defend' ? friendlyMaterial : enemyMaterial;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.72, 0.32), material);
    torso.position.y = 1.18;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.27, 0.27), material);
    head.position.y = BOT_EYE + 0.02;
    head.userData.part = 'head';
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.82, 0.3), material);
    legs.position.y = 0.41;
    group.add(torso, head, legs);
    group.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true;
        child.userData.botTeam = team;
      }
    });
    return { group, head, torso, legs };
  }

  function spawn(team, route, index) {
    const path = ROUTES[team][route % ROUTES[team].length];
    const start = path[0].clone();
    const offset = (index - 1) * 0.9;
    start.x += offset + (random() * 2 - 1) * 0.7;
    start.z += offset * 0.4 + (random() * 2 - 1) * 0.7;
    const body = buildBody(team);
    body.group.position.copy(start);
    scene.add(body.group);
    const bot = {
      team,
      route,
      path,
      waypoint: path.length > 1 ? 1 : 0,
      position: start,
      health: 100,
      alive: true,
      target: null,
      cooldown: random() * 0.6,
      body,
      speed: team === 'attack' ? 2.35 : 0.9,
      holdAt: path[path.length - 1].clone(),
      reactionTimer: 0,
    };
    bots.push(bot);
    return bot;
  }

  for (let index = 0; index < homeCount; index += 1) spawn('defend', index, index);

  function clear() {
    for (const bot of bots) {
      bot.alive = false;
      bot.health = 0;
      bot.body.group.visible = false;
    }
  }

  function reset(attackCount) {
    for (const bot of bots) scene.remove(bot.body.group);
    bots.length = 0;
    for (let index = 0; index < homeCount; index += 1) spawn('defend', index, index);
    for (let index = 0; index < attackCount; index += 1) spawn('attack', index, index);
  }

  function blocked(x, z) {
    for (const collider of colliders) {
      if (x > collider.min.x - BOT_RADIUS && x < collider.max.x + BOT_RADIUS && z > collider.min.z - BOT_RADIUS && z < collider.max.z + BOT_RADIUS) return true;
    }
    return false;
  }

  function moveToward(bot, point, dt) {
    const dx = point.x - bot.position.x;
    const dz = point.z - bot.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < 0.5) return true;
    const step = Math.min(bot.speed * dt, distance);
    const nx = bot.position.x + (dx / distance) * step;
    const nz = bot.position.z + (dz / distance) * step;
    if (!blocked(nx, bot.position.z)) bot.position.x = nx;
    if (!blocked(bot.position.x, nz)) bot.position.z = nz;
    bot.body.group.position.set(bot.position.x, 0, bot.position.z);
    const face = Math.atan2(dx, dz);
    bot.body.group.rotation.y = face;
    return false;
  }

  // Bots look for the nearest living opponent in front of them; a sight line through the world is
  // the price of a shot, so cover matters to them the same way it matters to the player.
  function acquire(bot, opponents, raycast) {
    let best = null;
    let bestDistance = VIEW_RANGE;
    for (const other of opponents) {
      if (!other.alive) continue;
      const dx = other.position.x - bot.position.x;
      const dz = other.position.z - bot.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > bestDistance) continue;
      const eye = new THREE.Vector3(bot.position.x, BOT_EYE, bot.position.z);
      const aim = new THREE.Vector3(other.position.x, BOT_EYE - 0.25, other.position.z);
      const clear = raycast(eye, aim);
      if (!clear) continue;
      best = other;
      bestDistance = distance;
    }
    return best;
  }

  function update(dt, opponents, raycast, onHit) {
    for (const bot of bots) {
      if (!bot.alive) continue;
      bot.cooldown -= dt;
      const seen = acquire(bot, opponents, raycast);
      bot.target = seen;
      if (seen) {
        bot.reactionTimer += dt;
        const dx = seen.position.x - bot.position.x;
        const dz = seen.position.z - bot.position.z;
        bot.body.group.rotation.y = Math.atan2(dx, dz);
        if (bot.reactionTimer > 0.24 && bot.cooldown <= 0) {
          bot.cooldown = FIRE_GAP * (0.85 + random() * 0.5);
          const hitChance = 0.42 + random() * 0.3;
          onHit(bot, seen, hitChance, BOT_DAMAGE);
        }
      } else {
        bot.reactionTimer = 0;
        const target = bot.path[Math.min(bot.waypoint, bot.path.length - 1)];
        if (moveToward(bot, target, dt) && bot.waypoint < bot.path.length - 1) bot.waypoint += 1;
      }
    }
  }

  function damage(bot, amount) {
    if (!bot.alive) return false;
    bot.health -= amount;
    if (bot.health <= 0) {
      bot.alive = false;
      bot.body.group.visible = false;
      return true;
    }
    return false;
  }

  function aliveCount(team) {
    let count = 0;
    for (const bot of bots) if (bot.alive && bot.team === team) count += 1;
    return count;
  }

  function hitMeshes() {
    const meshes = [];
    for (const bot of bots) {
      if (!bot.alive) continue;
      bot.body.group.traverse((child) => {
        if (child.isMesh) {
          child.userData.bot = bot;
          meshes.push(child);
        }
      });
    }
    return meshes;
  }

  return { bots, reset, clear, update, damage, aliveCount, hitMeshes, blockCount: () => colliders.length };
}
