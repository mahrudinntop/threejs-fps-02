import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { WEAPONS } from './economy.js';

export function createArsenal(camera) {
  // The gun is seen against the bright tan floor, so its darkest pixels define the map's
  // perceived exposure floor. High metalness with no environment map reflects nothing: the
  // receiver rendered at 3-8 sRGB and read as a cut-out. Values here keep it a dark object
  // (clearly darker than any wall) while its median lands around 28-34 sRGB -- dark but
  // made of surfaces, not of holes.
  const body = new THREE.MeshStandardMaterial({
    color: '#453e34', metalness: 0.38, roughness: 0.52
  });
  const grip = new THREE.MeshStandardMaterial({
    color: '#403a32', metalness: 0.2, roughness: 0.78
  });
  const trim = new THREE.MeshStandardMaterial({
    color: PALETTE.accent, metalness: 0.64, roughness: 0.28,
    emissive: PALETTE.accent, emissiveIntensity: 0.045
  });
  const materials = [body, grip, trim];
  const geometries = new Map();
  const models = new Map();
  const root = new THREE.Group();
  root.name = 'First person arsenal';
  root.position.set(0.24, -0.2, -0.45);
  camera.add(root);
  // A dedicated short-range fill parented to the camera. World lights are tuned for the yard,
  // which leaves the 0.45 m viewmodel in its own shadow; a point light with a 1.6 m range and
  // quadratic decay adds a couple of stops to the gun and is geometrically unable to touch
  // anything in the world.
  const viewFill = new THREE.PointLight('#c8b49a', 1.1, 1.6, 2);
  viewFill.position.set(0.1, 0.2, 0.2);
  camera.add(viewFill);
  // A cool rim from the opposite shoulder. The warm fill gives the gun form; the rim gives it
  // a silhouette edge, which is what separates a dark object from a dark floor when nothing
  // behind it is bright.
  const viewRim = new THREE.PointLight('#d6e2ee', 0.85, 1.6, 2);
  viewRim.position.set(0.55, 0.22, 0.4);
  camera.add(viewRim);

  function geometry(key, make) {
    if (!geometries.has(key)) geometries.set(key, make());
    return geometries.get(key);
  }

  const cube = geometry('box', () => new THREE.BoxGeometry(1, 1, 1));
  const cylinder = geometry('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 12));
  const disc = geometry('disc', () => new THREE.CircleGeometry(1, 20));
  const ring = geometry('ring', () => new THREE.TorusGeometry(1, 0.16, 6, 16));
  const guard = geometry('guard', () =>
    new THREE.TorusGeometry(1, 0.12, 6, 16, Math.PI * 1.65));

  function box(parent, mat, x, y, z, w, h, d, rx = 0, ry = 0, rz = 0) {
    const mesh = new THREE.Mesh(cube, materials[mat]);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.rotation.set(rx, ry, rz);
    parent.add(mesh);
    return mesh;
  }

  function tube(parent, mat, x, y, z, radius, length, axis = 'z') {
    const mesh = new THREE.Mesh(cylinder, materials[mat]);
    mesh.position.set(x, y, z);
    mesh.scale.set(radius, length, radius);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    parent.add(mesh);
    return mesh;
  }

  function hoop(parent, mat, x, y, z, radius) {
    const mesh = new THREE.Mesh(ring, materials[mat]);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(radius);
    parent.add(mesh);
    return mesh;
  }

  function face(parent, mat, x, y, z, radius) {
    const mesh = new THREE.Mesh(disc, materials[mat]);
    mesh.position.set(x, y, z);
    mesh.scale.setScalar(radius);
    parent.add(mesh);
    return mesh;
  }

  function screw(parent, x, y, z) {
    tube(parent, 1, x, y, z, 0.005, 0.004, 'x');
    box(parent, 0, x + 0.0025, y, z, 0.001, 0.0016, 0.006);
  }

  function rail(parent, z, length, y, width, count) {
    box(parent, 1, 0, y, z, width * 0.78, 0.009, length);
    for (let i = 0; i < count; i++) {
      box(parent, 0, 0, y + 0.007, z + length * ((i + 0.5) / count - 0.5),
        width, 0.009, length / count * 0.54);
    }
  }

  function sights(parent, frontZ, rearZ, height, wide) {
    box(parent, 1, 0, height - 0.015, frontZ, 0.029, 0.027, 0.026);
    box(parent, 0, 0, height + 0.006, frontZ, 0.009, 0.027, 0.012);
    box(parent, 2, 0, height + 0.019, frontZ + 0.007, 0.0035, 0.005, 0.002);
    box(parent, 1, 0, height - 0.005, rearZ, wide, 0.012, 0.024);
    box(parent, 0, -wide * 0.35, height + 0.006, rearZ, 0.012, 0.024, 0.022);
    box(parent, 0, wide * 0.35, height + 0.006, rearZ, 0.012, 0.024, 0.022);
  }

  function hand(parent, x, y, z, angle, forward) {
    const glove = new THREE.Group();
    glove.name = forward ? 'Support glove' : 'Trigger glove';
    glove.position.set(x, y, z);
    glove.rotation.set(forward ? -0.16 : -0.25, 0, angle);
    parent.add(glove);
    box(glove, 1, 0, 0, 0, 0.064, 0.069, 0.07);
    box(glove, 1, 0.035, 0.005, -0.009, 0.027, 0.048, 0.036, 0, 0, -0.42);
    box(glove, 1, -0.005, 0.031, -0.017, 0.066, 0.021, 0.023);
    box(glove, 1, -0.005, 0.031, 0.01, 0.066, 0.021, 0.023);
    box(glove, 1, 0.001, -0.049, 0.023, 0.052, 0.04, 0.055, -0.17);
  }

  function model(id) {
    if (models.has(id)) return models.get(id);
    if (!WEAPONS[id]) return null;
    const pistol = id === 'pistol';
    const smg = id === 'smg';
    const sniper = id === 'sniper';
    const gun = new THREE.Group();
    gun.name = WEAPONS[id].name || id;
    gun.visible = false;
    gun.rotation.y = -0.055;
    if (sniper) {
      gun.position.set(-0.055, -0.018, -0.025);
      gun.rotation.y = -0.025;
    }
    root.add(gun);
    models.set(id, gun);

    const width = pistol ? 0.063 : sniper ? 0.082 : 0.079;
    const receiverLength = pistol ? 0.225 : smg ? 0.25 : 0.29;
    const front = -receiverLength + 0.07;
    const handLength = pistol ? 0.085 : smg ? 0.18 : sniper ? 0.27 : 0.25;
    const handZ = front - handLength * 0.47;
    const muzzleZ = pistol ? -0.255 : smg ? -0.46 : sniper ? -0.83 : -0.62;
    gun.userData.muzzleZ = muzzleZ;
    gun.userData.magazine = null;

    // Separate upper, lower, chamber, and inset operating surfaces.
    box(gun, 0, 0, 0.025, -receiverLength * 0.5 + 0.055,
      width, pistol ? 0.065 : 0.079, receiverLength);
    box(gun, 1, 0, -0.026, -0.047, width * 0.88, 0.052, pistol ? 0.17 : 0.205);
    box(gun, 0, 0, 0.066, -0.055, width * 0.76, 0.018, receiverLength * 0.65);
    box(gun, 1, width * 0.509, 0.035, -0.07, 0.003, 0.03, 0.075);
    box(gun, 0, width * 0.535, 0.032, -0.074, 0.003, 0.014, 0.049);
    box(gun, 1, width * 0.56, 0.032, -0.068, 0.002, 0.012, 0.031);
    tube(gun, 0, width * 0.58, 0.028, -0.1, 0.004, 0.018, 'x');
    screw(gun, width * 0.52, -0.012, 0.004);
    screw(gun, width * 0.52, -0.012, -0.125);
    box(gun, 2, width * 0.52, -0.006, -0.018, 0.003, 0.008, 0.021, 0.25);
    box(gun, 0, -width * 0.66, 0.044, -0.02, 0.029, 0.012, 0.027);
    box(gun, 1, -width * 0.89, 0.044, -0.02, 0.012, 0.018, 0.034);

    // Barrel and deeply recessed muzzle.
    const barrelStart = front - (pistol ? 0.005 : handLength * 0.55);
    tube(gun, 1, 0, 0.024, (barrelStart + muzzleZ) * 0.5,
      pistol ? 0.014 : sniper ? 0.017 : 0.013, Math.abs(muzzleZ - barrelStart));
    tube(gun, 0, 0, 0.024, muzzleZ + 0.018, pistol ? 0.019 : 0.023, 0.047);
    hoop(gun, 0, 0, 0.024, muzzleZ - 0.006, pistol ? 0.016 : 0.02);
    tube(gun, 1, 0, 0.024, muzzleZ - 0.002, pistol ? 0.011 : 0.014, 0.012);
    if (!pistol) {
      for (let i = 0; i < 3; i++) {
        box(gun, 1, 0.022, 0.024, muzzleZ + 0.007 + i * 0.011, 0.004, 0.018, 0.005);
      }
      tube(gun, 0, 0, 0.056, front - handLength * 0.72, 0.006, handLength * 0.9);
    }

    box(gun, pistol ? 1 : 0, 0, -0.003, handZ,
      width * 0.94, pistol ? 0.039 : 0.071, handLength);
    const slots = pistol ? 4 : sniper ? 9 : 7;
    for (let i = 0; i < slots; i++) {
      const z = handZ + handLength * ((i + 0.5) / slots - 0.5);
      box(gun, 1, width * 0.477, 0.001, z, 0.003, 0.024, handLength / slots * 0.53);
      box(gun, 1, -width * 0.477, 0.001, z, 0.003, 0.024, handLength / slots * 0.53);
    }
    if (!pistol) {
      rail(gun, handZ, handLength * 0.95, 0.04, width * 0.9, slots);
      rail(gun, -0.059, receiverLength * 0.67, 0.079, width * 0.84, 7);
      box(gun, 1, 0, -0.047, handZ, width * 0.7, 0.015, handLength * 0.8);
    }

    const handle = new THREE.Group();
    handle.position.set(0, -0.062, 0.012);
    handle.rotation.x = -0.24;
    gun.add(handle);
    box(handle, 1, 0, -0.046, 0, width * 0.77, 0.116, 0.058);
    box(handle, 0, 0, -0.105, 0, width * 0.81, 0.012, 0.064);
    for (let i = 0; i < 5; i++) {
      box(handle, 0, width * 0.392, -0.009 - i * 0.017, 0,
        0.002, 0.003, 0.044);
    }

    const trigger = new THREE.Mesh(guard, grip);
    trigger.position.set(0, -0.067, -0.061);
    trigger.rotation.set(0, Math.PI / 2, 0.55);
    trigger.scale.set(0.037, 0.03, 0.037);
    gun.add(trigger);
    box(gun, 0, 0, -0.057, -0.049, 0.009, 0.035, 0.009, -0.35);
    box(gun, 1, 0, -0.091, -0.066, 0.015, 0.008, 0.051);

    const magazine = new THREE.Group();
    magazine.position.set(0, pistol ? -0.09 : -0.059, pistol ? 0.02 : -0.129);
    magazine.rotation.x = pistol ? -0.24 : smg ? 0.16 : -0.17;
    gun.add(magazine);
    gun.userData.magazine = magazine;
    const magH = pistol ? 0.09 : sniper ? 0.085 : smg ? 0.18 : 0.145;
    box(magazine, 1, 0, -magH * 0.45, 0, width * 0.68, magH, sniper ? 0.076 : 0.06);
    box(magazine, 0, 0, -magH * 0.95, 0.003, width * 0.76, 0.014, sniper ? 0.082 : 0.068);
    if (!pistol) {
      for (let i = 0; i < 3; i++) {
        box(magazine, 0, width * 0.35, -magH * 0.47, -0.019 + i * 0.018,
          0.002, magH * 0.72, 0.003);
      }
    }
    gun.userData.magazineHome = magazine.position.clone();

    if (pistol) {
      for (let i = 0; i < 6; i++) {
        box(gun, 1, width * 0.51, 0.038, 0.027 - i * 0.009, 0.003, 0.039, 0.004, -0.18);
        box(gun, 1, -width * 0.51, 0.038, 0.027 - i * 0.009, 0.003, 0.039, 0.004, -0.18);
      }
      sights(gun, -0.165, 0.038, 0.079, 0.049);
      hand(gun, 0.02, -0.115, 0.034, -0.14, false);
      hand(gun, -0.046, -0.09, -0.093, -0.6, true);
    } else {
      const stockEnd = smg ? 0.215 : sniper ? 0.31 : 0.275;
      tube(gun, 0, 0, 0.005, 0.105, 0.018, 0.19);
      box(gun, 1, 0, -0.002, stockEnd - 0.055, width * 0.91, 0.082, 0.13);
      box(gun, 0, 0, 0.035, stockEnd - 0.065, width, 0.026, 0.135);
      box(gun, 1, 0, -0.02, stockEnd + 0.015, width * 1.05, 0.128, 0.025, -0.08);
      for (let i = 0; i < 4; i++) {
        box(gun, 0, 0, -0.064 + i * 0.024, stockEnd + 0.03, width * 0.84, 0.004, 0.003);
      }
      box(gun, 0, 0, -0.048, stockEnd - 0.066, width * 0.65, 0.018, 0.105, 0.16);
      sights(gun, front - handLength * 0.82, 0.04, 0.098, 0.055);
      hand(gun, 0.025, -0.123, 0.03, -0.13, false);
      hand(gun, -0.026, -0.066, handZ + 0.026, -0.55, true);
    }

    if (sniper) {
      // Elevated optic, separate mounting rings, turret, and ocular glass.
      for (const z of [-0.045, -0.19]) {
        box(gun, 0, 0, 0.102, z, 0.056, 0.035, 0.033);
        hoop(gun, 0, 0, 0.153, z, 0.039);
        box(gun, 1, 0.042, 0.12, z, 0.014, 0.013, 0.023);
      }
      tube(gun, 1, 0, 0.153, -0.124, 0.029, 0.24);
      tube(gun, 0, 0, 0.153, 0.013, 0.04, 0.065);
      tube(gun, 1, 0, 0.153, -0.28, 0.047, 0.093);
      hoop(gun, 0, 0, 0.153, 0.048, 0.038);
      face(gun, 2, 0, 0.153, 0.047, 0.031);
      face(gun, 1, 0, 0.153, 0.048, 0.024);
      face(gun, 2, -0.01, 0.164, 0.049, 0.006);
      tube(gun, 0, 0, 0.196, -0.106, 0.019, 0.032, 'y');
      tube(gun, 1, 0.038, 0.153, -0.106, 0.017, 0.027, 'x');
      for (let i = 0; i < 5; i++) {
        hoop(gun, 0, 0, 0.153, -0.011 + i * 0.008, 0.035);
      }
      tube(gun, 0, 0.066, 0.038, 0.006, 0.008, 0.063, 'x');
      tube(gun, 1, 0.097, 0.025, 0.006, 0.015, 0.031, 'y');
    }
    return gun;
  }

  const flashMaterial = new THREE.MeshBasicMaterial({
    color: PALETTE.accent, transparent: true, opacity: 0.9,
    blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    depthWrite: false, toneMapped: false
  });
  const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.15), flashMaterial);
  flash.name = 'Muzzle flash';
  flash.visible = false;
  const flashLight = new THREE.PointLight(PALETTE.accent, 0, 4.5);
  const state = {
    id: 'pistol',
    mag: WEAPONS.pistol.mag,
    reserve: WEAPONS.pistol.reserve,
    reloading: false,
    reloadT: 0,
    cooldown: 0,
    grenades: 3,
    recoil: 0,
    flashT: 0,
    time: 0
  };
  let active = null;
  let reloadDuration = 1.5;
  let lastPitch = camera.rotation.x;
  let lastYaw = camera.rotation.y;
  let swayX = 0;
  let swayY = 0;

  function spec() {
    return WEAPONS[state.id];
  }

  function equip(id, grenades) {
    if (!WEAPONS[id]) return false;
    active = model(id);
    for (const [key, gun] of models) gun.visible = key === id;
    state.id = id;
    state.mag = spec().mag;
    state.reserve = spec().reserve;
    state.reloading = false;
    state.reloadT = 0;
    state.cooldown = 0;
    state.recoil = 0;
    state.flashT = 0;
    if (grenades !== undefined) state.grenades = grenades;
    active.add(flash, flashLight);
    flash.position.set(0, 0.024, active.userData.muzzleZ - 0.027);
    flashLight.position.copy(flash.position);
    flash.visible = false;
    flashLight.intensity = 0;
    for (const gun of models.values()) {
      gun.userData.magazine.position.copy(gun.userData.magazineHome);
    }
    return true;
  }

  function takeRound() {
    if (state.reloading || state.mag <= 0) return false;
    state.mag--;
    return true;
  }

  function reload() {
    if (state.reloading || state.mag >= spec().mag || state.reserve <= 0) return false;
    reloadDuration = spec().reloadTime || spec().reload ||
      (state.id === 'sniper' ? 2.4 : state.id === 'rifle' ? 1.85 : 1.45);
    if (typeof reloadDuration !== 'number') reloadDuration = 1.7;
    state.reloading = true;
    state.reloadT = reloadDuration;
    return true;
  }

  function refill() {
    state.mag = spec().mag;
    state.reserve = spec().reserve;
    state.reloading = false;
    state.reloadT = 0;
    if (active) active.userData.magazine.position.copy(active.userData.magazineHome);
  }

  function spread(speed) {
    return (spec().spread || 0.004) *
      (1 + Math.min(Math.abs(speed || 0), 12) * 0.13 + state.recoil * 0.45);
  }

  function pullTrigger() {
    state.cooldown = spec().rate;
    state.recoil = Math.min(state.recoil + (state.id === 'sniper' ? 1.5 : 1), 2.5);
    state.flashT = 0.055;
    flash.visible = true;
    flash.rotation.z = Math.random() * Math.PI;
    flash.scale.setScalar((state.id === 'sniper' ? 1.5 : 0.8) + Math.random() * 0.5);
    flashLight.intensity = 2.8;
  }

  function blowGrenade() {
    if (state.grenades <= 0) return false;
    state.grenades--;
    return true;
  }

  function ready() {
    return !state.reloading && state.cooldown <= 0 && state.mag > 0;
  }

  function step(dt) {
    dt = Math.max(0, Number.isFinite(dt) ? dt : 0);
    state.time += dt;
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.flashT = Math.max(0, state.flashT - dt);
    state.recoil *= Math.exp(-dt * 12);
    if (state.reloading) {
      state.reloadT = Math.max(0, state.reloadT - dt);
      if (state.reloadT === 0) {
        const rounds = Math.min(spec().mag - state.mag, state.reserve);
        state.mag += rounds;
        state.reserve -= rounds;
        state.reloading = false;
      }
    }

    let dy = camera.rotation.y - lastYaw;
    dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    const dx = camera.rotation.x - lastPitch;
    lastYaw = camera.rotation.y;
    lastPitch = camera.rotation.x;
    const damping = Math.exp(-dt * 10);
    swayX = THREE.MathUtils.clamp(swayX * damping + dy * 0.16, -0.025, 0.025);
    swayY = THREE.MathUtils.clamp(swayY * damping + dx * 0.14, -0.02, 0.02);
    const progress = state.reloading ? 1 - state.reloadT / reloadDuration : 0;
    const dip = Math.sin(Math.PI * progress);
    root.position.set(
      0.24 + Math.sin(state.time * 1.7) * 0.0025 - swayX - dip * 0.035,
      -0.2 + Math.sin(state.time * 3.4) * 0.002 - swayY - dip * 0.17,
      -0.45 + state.recoil * 0.032 + dip * 0.065
    );
    root.rotation.set(
      state.recoil * 0.07 - dip * 0.32 + swayY,
      -swayX * 0.5,
      Math.sin(state.time * 1.7) * 0.003 + dip * 0.26 - swayX
    );
    if (active) {
      const magazine = active.userData.magazine;
      magazine.position.copy(active.userData.magazineHome);
      if (state.reloading) {
        magazine.position.y -= Math.pow(Math.sin(Math.PI * progress), 3) * 0.12;
      }
    }
    flash.visible = state.flashT > 0;
    flashMaterial.opacity = Math.min(0.95, state.flashT * 23);
    flashLight.intensity = state.flashT > 0 ? 2.8 * state.flashT / 0.055 : 0;
  }

  for (const id of ['pistol', 'smg', 'rifle', 'sniper']) model(id);
  equip('pistol', state.grenades);
  return {
    state, model, equip, takeRound, reload, refill, spread,
    pullTrigger, blowGrenade, ready, step, spec
  };
}
