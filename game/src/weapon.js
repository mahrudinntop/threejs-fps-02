// A weapon that fires, reloads, runs dry and is swapped: one view model per gun, its numbers read
// from the bought weapon, and the spread that makes stopping to aim pay. main.js owns the ray.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS } from './economy.js';

export function createArsenal(camera) {
  const grip = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.hairline), roughness: 0.7, metalness: 0.2 });
  const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.ink), roughness: 0.5, metalness: 0.35 });

  const models = new Map();
  function model(id) {
    if (models.has(id)) return models.get(id);
    const group = new THREE.Group();
    const spec = WEAPONS[id];
    const barrelLength = id === 'sniper' ? 0.62 : id === 'smg' ? 0.3 : 0.4;
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.1, 0.42), body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, barrelLength), grip);
    barrel.position.set(0, 0.025, -0.28 - barrelLength / 2);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.08, 0.22), grip);
    stock.position.set(0, -0.02, 0.3);
    group.add(receiver, barrel, stock);
    if (id === 'sniper') {
      const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.24, 10), grip);
      scope.rotation.z = Math.PI / 2;
      scope.position.set(0, 0.1, -0.05);
      group.add(scope);
    }
    group.position.set(0.24, -0.2, -0.42);
    group.visible = false;
    camera.add(group);
    models.set(id, group);
    return group;
  }

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.24, 0.24),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.24, -0.18, -0.95);
  flash.visible = false;
  camera.add(flash);

  const flashLight = new THREE.PointLight(new THREE.Color(PALETTE.accent), 0, 4.5);
  flashLight.position.set(0.24, -0.15, -0.9);
  camera.add(flashLight);

  const state = {
    id: 'pistol',
    mag: WEAPONS.pistol.mag,
    reserve: WEAPONS.pistol.reserve,
    reloading: 0,
    flashTime: 0,
    kick: 0,
    grenades: 1,
    readyAt: 0,
  };

  function spec() {
    return WEAPONS[state.id];
  }

  function equip(id, grenades) {
    if (!WEAPONS[id]) return false;
    for (const [, group] of models) group.visible = false;
    state.id = id;
    state.mag = WEAPONS[id].mag;
    state.reserve = WEAPONS[id].reserve;
    state.reloading = 0;
    if (typeof grenades === 'number') state.grenades = grenades;
    model(id).visible = true;
    return true;
  }

  function takeRound() {
    if (state.reloading > 0) return false;
    if (state.mag <= 0) return false;
    state.mag -= 1;
    return true;
  }

  function reload() {
    if (state.reloading > 0) return false;
    if (state.mag >= spec().mag) return false;
    if (state.reserve <= 0) return false;
    state.reloading = spec().reload;
    return true;
  }

  function refill() {
    state.mag = spec().mag;
    state.reserve = spec().reserve;
    state.reloading = 0;
  }

  function spread(speed) {
    const gun = spec();
    const moving = Math.min(1, speed / 5.2);
    return gun.spreadStill + (gun.spreadMoving - gun.spreadStill) * moving;
  }

  function pullTrigger() {
    state.flashTime = 0.055;
    state.kick = Math.min(1, state.kick + 0.35);
  }

  function blowGrenade() {
    if (state.grenades <= 0) return false;
    state.grenades -= 1;
    return true;
  }

  function ready() {
    return state.reloading <= 0 && state.mag > 0;
  }

  function step(dt) {
    if (state.reloading > 0) {
      state.reloading = Math.max(0, state.reloading - dt);
      if (state.reloading === 0) {
        const gun = spec();
        const need = Math.min(gun.mag - state.mag, state.reserve);
        state.mag += need;
        state.reserve -= need;
      }
    }
    state.flashTime = Math.max(0, state.flashTime - dt);
    state.kick = Math.max(0, state.kick - dt * 3.2);
    flash.visible = state.flashTime > 0;
    flashLight.intensity = state.flashTime > 0 ? 6 : 0;
    const current = models.get(state.id);
    if (current) {
      // a small idle bob and recoil kick keep the gun feeling held, not glued to the camera
      current.position.y = -0.2 - state.kick * 0.03;
      current.position.z = -0.42 + state.kick * 0.05;
    }
  }

  equip('pistol', 1);
  return { state, equip, takeRound, reload, refill, spread, pullTrigger, blowGrenade, ready, step, spec };
}
