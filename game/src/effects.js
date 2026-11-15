import * as THREE from 'three';

const DEBRIS_COUNT = 64;
const TRACER_COUNT = 24;
const MUZZLE_COUNT = 16;
const EXPLOSION_COUNT = 8;
const LIGHT_COUNT = 8;
const CASING_COUNT = 24;
const GRAVITY = 9.8;

// RGBA vertex colors allow independent fades with one shared material per category.
function makeSlot(scene, mesh) {
  const vertexCount = mesh.geometry.getAttribute('position').count;
  const colors = new THREE.BufferAttribute(new Float32Array(vertexCount * 4), 4);
  colors.setUsage(THREE.DynamicDrawUsage);
  mesh.geometry.setAttribute('color', colors);
  mesh.visible = false;
  mesh.frustumCulled = false;
  scene.add(mesh);

  return {
    mesh,
    colors,
    life: 0,
    maxLife: 0,
    velocity: new THREE.Vector3(),
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    size: 1,
    radius: 1,
    floor: 0,
    bounced: false
  };
}

function findFree(pool) {
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].life <= 0) return pool[i];
  }
  return null;
}

function paint(slot, color) {
  const array = slot.colors.array;
  for (let i = 0; i < array.length; i += 4) {
    array[i] = color.r;
    array[i + 1] = color.g;
    array[i + 2] = color.b;
    array[i + 3] = 1;
  }
  slot.colors.needsUpdate = true;
}

function fade(slot, alpha) {
  const array = slot.colors.array;
  for (let i = 3; i < array.length; i += 4) {
    array[i] = alpha;
  }
  slot.colors.needsUpdate = true;
}

function activate(slot, point, lifetime) {
  slot.life = lifetime;
  slot.maxLife = lifetime;
  slot.mesh.position.copy(point);
  slot.mesh.visible = true;
}

function retire(slot) {
  slot.life = 0;
  slot.mesh.visible = false;
  slot.velocity.set(0, 0, 0);
}

function clearPool(pool) {
  for (let i = 0; i < pool.length; i++) retire(pool[i]);
}

function countPool(pool) {
  let count = 0;
  for (let i = 0; i < pool.length; i++) {
    if (pool[i].life > 0) count++;
  }
  return count;
}

export function createEffects(scene, camera) {
  const debrisMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false
  });
  const tracerMaterial = new THREE.LineBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const muzzleMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const explosionMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });

  const debris = new Array(DEBRIS_COUNT);
  const tracers = new Array(TRACER_COUNT);
  const muzzles = new Array(MUZZLE_COUNT);
  const explosions = new Array(EXPLOSION_COUNT);
  const lights = new Array(LIGHT_COUNT);

  const wallColor = new THREE.Color(0xb7aa91);
  const fleshColor = new THREE.Color(0x9d1925);
  const groundColor = new THREE.Color(0x857457);
  const explosionColor = new THREE.Color(0xffad42);
  const scratchColor = new THREE.Color();

  for (let i = 0; i < DEBRIS_COUNT; i++) {
    debris[i] = makeSlot(
      scene,
      new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), debrisMaterial)
    );
  }

  for (let i = 0; i < TRACER_COUNT; i++) {
    const geometry = new THREE.BufferGeometry();
    const positions = new THREE.BufferAttribute(new Float32Array(6), 3);
    positions.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', positions);
    tracers[i] = makeSlot(scene, new THREE.Line(geometry, tracerMaterial));
  }

  for (let i = 0; i < MUZZLE_COUNT; i++) {
    muzzles[i] = makeSlot(
      scene,
      new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.22), muzzleMaterial)
    );
  }

  for (let i = 0; i < EXPLOSION_COUNT; i++) {
    explosions[i] = makeSlot(
      scene,
      new THREE.Mesh(new THREE.RingGeometry(0.83, 1, 40), explosionMaterial)
    );
    explosions[i].mesh.rotation.x = -Math.PI * 0.5;
  }

  for (let i = 0; i < LIGHT_COUNT; i++) {
    const light = new THREE.PointLight(0xffffff, 0, 5, 2);
    light.visible = false;
    light.castShadow = false;
    scene.add(light);
    lights[i] = {
      mesh: light,
      life: 0,
      maxLife: 0,
      velocity: new THREE.Vector3(),
      peakIntensity: 0
    };
  }

  function activateLight(point, color, lifetime, intensity, distance) {
    const slot = findFree(lights);
    if (slot === null) return;

    activate(slot, point, lifetime);
    slot.velocity.set(0, 0, 0);
    slot.mesh.color.copy(color);
    slot.mesh.distance = distance;
    slot.mesh.intensity = intensity;
    slot.peakIntensity = intensity;
  }

  function launchDebris(point, color, vx, vy, vz, lifetime, size) {
    const slot = findFree(debris);
    if (slot === null) return false;

    activate(slot, point, lifetime);
    slot.velocity.set(vx, vy, vz);
    slot.size = size;
    slot.mesh.scale.set(size, size, size);
    slot.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI * 2
    );
    slot.spinX = (Math.random() - 0.5) * 15;
    slot.spinY = (Math.random() - 0.5) * 15;
    slot.spinZ = (Math.random() - 0.5) * 15;
    paint(slot, color);
    return true;
  }

  // Emit a randomized, outward-facing hemisphere of debris.
  function impact(point, normal, kind) {
    let nx = normal.x;
    let ny = normal.y;
    let nz = normal.z;
    const normalLength = Math.sqrt(nx * nx + ny * ny + nz * nz);

    if (normalLength > 0.00001) {
      nx /= normalLength;
      ny /= normalLength;
      nz /= normalLength;
    } else {
      nx = 0;
      ny = 1;
      nz = 0;
    }

    const color = kind === 'flesh'
      ? fleshColor
      : kind === 'ground' ? groundColor : wallColor;
    const count = 6 + Math.floor(Math.random() * 5);

    for (let i = 0; i < count; i++) {
      let x = nx * 1.8 + Math.random() * 2 - 1;
      let y = ny * 1.8 + Math.random() * 2 - 1;
      let z = nz * 1.8 + Math.random() * 2 - 1;
      const speed = 1.1 + Math.random() * 2.1;
      const factor = speed / Math.sqrt(x * x + y * y + z * z);
      x *= factor;
      y *= factor;
      z *= factor;

      if (!launchDebris(
        point, color, x, y, z,
        0.25 + Math.random() * 0.35,
        0.45 + Math.random() * 0.65
      )) break;
    }
  }

  // Update an existing two-vertex line rather than rebuilding its geometry.
  function tracer(from, to, color) {
    const slot = findFree(tracers);
    if (slot === null) return;

    slot.life = 0.08;
    slot.maxLife = 0.08;
    slot.velocity.set(0, 0, 0);
    slot.mesh.visible = true;

    const positions = slot.mesh.geometry.getAttribute('position');
    const array = positions.array;
    array[0] = from.x;
    array[1] = from.y;
    array[2] = from.z;
    array[3] = to.x;
    array[4] = to.y;
    array[5] = to.z;
    positions.needsUpdate = true;

    scratchColor.set(color === undefined ? 0xffe6a0 : color);
    paint(slot, scratchColor);
  }

  // The flash and its light have independent, bounded pool lifetimes.
  function muzzle(point, color) {
    scratchColor.set(color === undefined ? 0xffd080 : color);
    const slot = findFree(muzzles);

    if (slot !== null) {
      activate(slot, point, 0.05);
      slot.velocity.set(0, 0, 0);
      slot.size = 0.85 + Math.random() * 0.45;
      slot.mesh.scale.set(slot.size, slot.size, slot.size);
      slot.mesh.quaternion.copy(camera.quaternion);
      paint(slot, scratchColor);
    }

    activateLight(point, scratchColor, 0.05, 7, 4);
  }

  // A ground-parallel shockwave, sixteen chunks, and a pooled light.
  function explosion(point, radius) {
    radius = Number.isFinite(radius) ? Math.max(0.05, radius) : 1;

    const slot = findFree(explosions);
    if (slot !== null) {
      activate(slot, point, 0.5);
      slot.velocity.set(0, 0, 0);
      slot.radius = radius;
      slot.mesh.position.y += 0.025;
      slot.mesh.scale.set(radius * 0.08, radius * 0.08, radius * 0.08);
      paint(slot, explosionColor);
    }

    for (let i = 0; i < 16; i++) {
      let x = Math.random() * 2 - 1;
      let y = Math.random() * 1.4 + 0.2;
      let z = Math.random() * 2 - 1;
      const speed = (2.5 + Math.random() * 4) * Math.sqrt(radius);
      const factor = speed / Math.sqrt(x * x + y * y + z * z);
      x *= factor;
      y *= factor;
      z *= factor;

      if (!launchDebris(
        point, groundColor, x, y, z,
        0.5 + Math.random() * 0.6,
        1 + Math.random() * 1.6
      )) break;
    }

    activateLight(point, explosionColor, 0.5, 28, radius * 5);
  }

  // Allocation-free simulation; each fade modifies preallocated RGBA buffers.
  function update(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;

    for (let i = 0; i < DEBRIS_COUNT; i++) {
      const slot = debris[i];
      if (slot.life <= 0) continue;

      const step = Math.min(dt, slot.life);
      slot.life -= dt;
      if (slot.life <= 0) {
        retire(slot);
        continue;
      }

      const mesh = slot.mesh;
      mesh.position.x += slot.velocity.x * step;
      mesh.position.y += slot.velocity.y * step - 0.5 * GRAVITY * step * step;
      mesh.position.z += slot.velocity.z * step;
      slot.velocity.y -= GRAVITY * step;
      mesh.rotation.x += slot.spinX * step;
      mesh.rotation.y += slot.spinY * step;
      mesh.rotation.z += slot.spinZ * step;
      fade(slot, slot.life / slot.maxLife);
    }

    for (let i = 0; i < TRACER_COUNT; i++) {
      const slot = tracers[i];
      if (slot.life <= 0) continue;

      slot.life -= dt;
      if (slot.life <= 0) retire(slot);
      else fade(slot, slot.life / slot.maxLife);
    }

    for (let i = 0; i < MUZZLE_COUNT; i++) {
      const slot = muzzles[i];
      if (slot.life <= 0) continue;

      slot.life -= dt;
      if (slot.life <= 0) {
        retire(slot);
        continue;
      }

      const fraction = slot.life / slot.maxLife;
      const size = slot.size * (0.55 + 0.45 * fraction);
      slot.mesh.quaternion.copy(camera.quaternion);
      slot.mesh.scale.set(size, size, size);
      fade(slot, fraction);
    }

    for (let i = 0; i < EXPLOSION_COUNT; i++) {
      const slot = explosions[i];
      if (slot.life <= 0) continue;

      slot.life -= dt;
      if (slot.life <= 0) {
        retire(slot);
        continue;
      }

      const fraction = slot.life / slot.maxLife;
      const size = slot.radius * (0.08 + 0.92 * (1 - fraction * fraction));
      slot.mesh.scale.set(size, size, size);
      fade(slot, fraction * fraction);
    }

    for (let i = 0; i < LIGHT_COUNT; i++) {
      const slot = lights[i];
      if (slot.life <= 0) continue;

      slot.life -= dt;
      if (slot.life <= 0) {
        slot.mesh.intensity = 0;
        retire(slot);
        continue;
      }

      const fraction = slot.life / slot.maxLife;
      slot.mesh.intensity = slot.peakIntensity * fraction * fraction;
    }
  }

  // Keep every object attached to the scene for subsequent rounds.
  function reset() {
    clearPool(debris);
    clearPool(tracers);
    clearPool(muzzles);
    clearPool(explosions);
    clearPool(lights);
    for (let i = 0; i < LIGHT_COUNT; i++) lights[i].mesh.intensity = 0;
  }

  // Count active pooled components, including dynamic lights.
  function activeCount() {
    return countPool(debris) + countPool(tracers) + countPool(muzzles)
      + countPool(explosions) + countPool(lights);
  }

  return { impact, tracer, muzzle, explosion, update, reset, activeCount };
}

export function createCasingPool(scene) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    depthWrite: false
  });
  const brass = new THREE.Color(0xb89447);
  const casings = new Array(CASING_COUNT);

  for (let i = 0; i < CASING_COUNT; i++) {
    const slot = makeSlot(
      scene,
      new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.011, 0.011), material)
    );
    paint(slot, brass);
    casings[i] = slot;
  }

  // Velocity is world-space; omit it for a default sideways ejection.
  function eject(point, velocity, groundY = 0) {
    const slot = findFree(casings);
    if (slot === null) return;

    activate(slot, point, 3);
    slot.floor = Number.isFinite(groundY) ? groundY : 0;
    slot.bounced = false;
    slot.mesh.position.y = Math.max(slot.floor + 0.016, point.y);
    slot.mesh.scale.set(1, 1, 1);
    slot.mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );
    slot.velocity.set(
      velocity ? velocity.x : 1.5 + Math.random(),
      velocity ? velocity.y : 1.2 + Math.random() * 0.6,
      velocity ? velocity.z : (Math.random() - 0.5) * 0.8
    );
    slot.spinX = (Math.random() - 0.5) * 24;
    slot.spinY = (Math.random() - 0.5) * 24;
    slot.spinZ = (Math.random() - 0.5) * 24;
    fade(slot, 1);
  }

  // One short bounce, then settle and fade during the final half-second.
  function update(dt) {
    if (!(dt > 0) || !Number.isFinite(dt)) return;

    for (let i = 0; i < CASING_COUNT; i++) {
      const slot = casings[i];
      if (slot.life <= 0) continue;

      const step = Math.min(dt, slot.life);
      slot.life -= dt;
      if (slot.life <= 0) {
        retire(slot);
        continue;
      }

      const mesh = slot.mesh;
      const restingHeight = slot.floor + 0.0055;

      if (!slot.bounced || mesh.position.y > restingHeight || slot.velocity.y > 0) {
        mesh.position.x += slot.velocity.x * step;
        mesh.position.y += slot.velocity.y * step - 0.5 * GRAVITY * step * step;
        mesh.position.z += slot.velocity.z * step;
        slot.velocity.y -= GRAVITY * step;
        mesh.rotation.x += slot.spinX * step;
        mesh.rotation.y += slot.spinY * step;
        mesh.rotation.z += slot.spinZ * step;

        if (mesh.position.y <= restingHeight && slot.velocity.y < 0) {
          mesh.position.y = restingHeight;
          if (!slot.bounced) {
            slot.bounced = true;
            slot.velocity.y = Math.min(1.2, -slot.velocity.y * 0.28);
            slot.velocity.x *= 0.45;
            slot.velocity.z *= 0.45;
            slot.spinX *= 0.35;
            slot.spinY *= 0.35;
            slot.spinZ *= 0.35;
          } else {
            slot.velocity.set(0, 0, 0);
            mesh.rotation.set(0, mesh.rotation.y, 0);
          }
        }
      }

      fade(slot, Math.min(1, slot.life * 2));
    }
  }

  function reset() {
    clearPool(casings);
  }

  function activeCount() {
    return countPool(casings);
  }

  return { eject, update, reset, activeCount };
}
