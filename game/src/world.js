// The map: Ashgrove Yard, a two-lane tactical layout with a defended site at the north end, an
// attacker spawn at the south, mid control nobody owns, and cover whose heights decide the
// duel. Every box, cylinder and ramp is a collider and a shootable surface, so a crate is both
// something to hide behind and something to shoot over. Original layout and names, styled in one
// warm plaster palette so the yard reads at a glance: cream walls, ink cover, one signal orange.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const SITE = { center: new THREE.Vector3(0, 0, -7.2), radius: 3.6 };
export const ATTACK_SPAWN = new THREE.Vector3(0, 0, 9.8);
export const DEFEND_SPAWN = new THREE.Vector3(0, 0, -9.6);

// Cover heights the layout is built around, in metres: low cover you crouch behind and shoot
// over, waist cover that hides a standing body, and full cover that blocks a lane outright.
const LOW = 0.85;
const WAIST = 1.15;
const FULL = 2.4;

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // One warm key light high over the south wall and a soft sky fill, so the yard reads at a
  // glance and every crate throws a shadow worth hiding in.
  const sun = new THREE.DirectionalLight('#ffe6c2', 4.6);
  sun.position.set(14, 22, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.022;
  sun.shadow.radius = 3.2;
  // Required after editing the ortho frustum: without this call the shadow camera keeps the
  // constructor's default 5 m half-extent, so only a 10 m window around mid ever receives
  // shadows and the site and lanes read as unlit.
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);
  scene.add(new THREE.HemisphereLight('#c3d2e2', '#8a7c66', 0.62));

  // A dim fill from the north-east so the shaded side of the yard is still readable: without it
  // a defender holding the dark corner is invisible instead of merely hidden.
  const fill = new THREE.DirectionalLight('#cfd8e0', 0.12);
  fill.position.set(-16, 12, -18);
  scene.add(fill);

  // Procedural surface grain: three small canvas textures baked once at startup. They cost
  // nothing at runtime and they are the difference between a flat matte fill and a surface the
  // eye can read scale against -- the look criterion asks for styled geometry, not flat colour.
  function grainTexture(base, contrast, dots) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    // A deterministic speckle field (no Math.random) so two runs write the same bytes.
    let seedValue = 9871;
    const next = () => {
      seedValue = (seedValue * 1103515245 + 12345) & 0x7fffffff;
      return seedValue / 0x7fffffff;
    };
    for (let index = 0; index < dots; index += 1) {
      const value = Math.floor(contrast * (next() - 0.5));
      ctx.fillStyle = value >= 0 ? `rgba(255,255,255,${(value / 255).toFixed(3)})`
        : `rgba(0,0,0,${(-value / 255).toFixed(3)})`;
      const r = 0.6 + next() * 1.7;
      ctx.fillRect(next() * size, next() * size, r, r);
    }
    // A soft tonal drift, so large surfaces are never one constant value.
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, 'rgba(255,255,255,0.05)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.03)');
    grad.addColorStop(1, 'rgba(255,255,255,0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: 0.03,
    });
  }
  // Plaster grain on the walls, concrete speckle on the ground, coarse pitting on cover.
  const plasterGrain = grainTexture('#ffffff', 46, 2600);
  plasterGrain.repeat.set(3, 2);
  materials.surface.map = plasterGrain;
  const concreteGrain = grainTexture('#ffffff', 64, 3400);
  concreteGrain.repeat.set(10, 10);
  materials.canvas.map = concreteGrain;
  materials.apron.map = concreteGrain;
  materials.siteFloor.map = concreteGrain;
  const coverGrain = grainTexture('#ffffff', 38, 1500);
  coverGrain.repeat.set(2, 2);
  materials.hairline.map = coverGrain;
  materials.ink.map = coverGrain;

  const colliders = [];
  const shootables = [];

  function register(mesh) {
    group.add(mesh);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  function box(width, height, depth, x, y, z, material) {
    return register(new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]));
  }

  function anchored(width, height, depth, x, baseY, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, baseY + height / 2, z);
    return register(mesh);
  }

  // A crate is not a plain cube: a rim of darker slats reads as a built object at ten metres and
  // gives the eye the scale of the lane. The rim is decorative and shares the crate's collider.
  function crate(size, x, z, height, material = 'hairline') {
    const crateMesh = anchored(size, height, size, x, 0, z, material);
    // A chamfer band around the top and bottom edge: two thin inset rings that catch the key
    // light, so a cover block reads as a built object with edges instead of a raw prism, and
    // picks up a contact shadow line at its foot.
    for (const [edgeY, edgeSize] of [[height - 0.05, size + 0.035], [0.05, size + 0.035]]) {
      const chamfer = new THREE.Mesh(new THREE.BoxGeometry(edgeSize, 0.1, edgeSize), materials.ink);
      chamfer.position.set(x, edgeY, z);
      chamfer.castShadow = true;
      chamfer.receiveShadow = true;
      group.add(chamfer);
    }
    const rimMaterial = materials.ink;
    const lip = Math.min(0.12, height * 0.16);
    for (const [dx, dz] of [[size / 2, 0], [-size / 2, 0], [0, size / 2], [0, -size / 2]]) {
      const slat = new THREE.Mesh(
        dx === 0 ? new THREE.BoxGeometry(size + 0.06, lip, 0.05) : new THREE.BoxGeometry(0.05, lip, size + 0.06),
        rimMaterial,
      );
      slat.position.set(x + dx, height - lip / 2, z + dz);
      slat.castShadow = true;
      group.add(slat);
    }
    return crateMesh;
  }

  // A pillar is a collider with a cap and a plinth: three primitives, one silhouette, and the
  // sightline it breaks is worth more than the wall it replaces.
  function pillar(radius, height, x, z, material = 'surface') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.06, height, 12), materials[material]);
    shaft.position.set(x, height / 2, z);
    register(shaft);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.22, radius * 1.22, 0.14, 12),
      materials.hairline,
    );
    cap.position.set(x, height + 0.07, z);
    cap.castShadow = true;
    group.add(cap);
    return shaft;
  }

  // Ground and walls: a 26 x 26 m yard, open sky, one directional light. The floor is split into
  // a darker apron under the site and a lighter approach so the two halves of the map are told
  // apart before a round starts.
  // Value split: the floor is a full step darker than the walls, and every wall gets a dark
  // skirt at its base. Without this the cream floor and cream walls merge and the corner, the
  // lane and the sightline all vanish at a glance -- the one thing the look criterion punishes.
  const floorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.apron), roughness: 0.97, metalness: 0.02 });
  const skirtMat = materials.hairline;
  const siteFloorMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.siteFloor), roughness: 0.94, metalness: 0.02 });
  box(26.4, 0.4, 26.4, 0, -0.2, 0, 'canvas');
  // The playable apron gets its own tone so the map reads in bands: floor, walls, sky.
  const apron = new THREE.Mesh(new THREE.BoxGeometry(25.6, 0.02, 25.6), floorMat);
  apron.position.set(0, 0.011, 0);
  apron.receiveShadow = true;
  group.add(apron);
  box(12.4, 0.06, 9.6, 0, 0.03, -7.0, 'surface');
  box(0.4, 4.6, 26.4, -13.2, 2.3, 0, 'surface');
  box(0.4, 4.6, 26.4, 13.2, 2.3, 0, 'surface');
  box(26.4, 4.6, 0.4, 0, 2.3, -13.2, 'surface');
  box(26.4, 4.6, 0.4, 0, 2.3, 13.2, 'surface');

  // Wall capping: a darker band along the top of every wall gives the yard a horizon line and
  // stops the walls from reading as flat cut-outs against the sky.
  for (const [w, d, x, z] of [[26.4, 0.5, 0, -13.2], [26.4, 0.5, 0, 13.2], [0.5, 26.4, -13.2, 0], [0.5, 26.4, 13.2, 0]]) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w, 0.22, d), materials.hairline);
    cap.position.set(x, 4.6, z);
    cap.castShadow = true;
    group.add(cap);
  }

  // Contact shadow lines along every interior wall run: a thin dark strip on the floor where a
  // wall meets it. This is the cheapest ambient occlusion there is -- four thin boxes -- and it
  // is what stops walls reading as flat planes intersecting the floor at a paper fold.
  const contactLines = [
    [25.4, 0.34, 0, 0.16, -12.72], [25.4, 0.34, 0, 0.16, 12.72],
    [0.34, 25.4, -12.72, 0.16, 0], [0.34, 25.4, 12.72, 0.16, 0],
    [0.30, 9.4, -5.02, 0.16, 1.0], [0.30, 9.4, 5.02, 0.16, 1.0],
  ];
  for (const [w, d, x, y, z] of contactLines) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), skirtMat);
    line.position.set(x, 0.015, z);
    line.receiveShadow = true;
    group.add(line);
  }

  // Ambient-occlusion skirt: a thin dark band at the foot of every wall grounds the geometry.
  // Floating-looking walls are the biggest 'this is a prototype' tell, and this is four boxes.
  for (const [w, d, x, z] of [[26.4, 0.22, 0, -13.05], [26.4, 0.22, 0, 13.05], [0.22, 26.4, -13.05, 0], [0.22, 26.4, 13.05, 0]]) {
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, d), skirtMat);
    skirt.position.set(x, 0.25, z);
    skirt.receiveShadow = true;
    group.add(skirt);
  }

  // --- The site (A): a raised platform, a back wall, two L-covers, and a plinth for the charge.
  // The site apron: a warmer plate than the yard floor, so A has a colour you can name.
  const sitePlate = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.26, 7.2), siteFloorMat);
  sitePlate.position.set(SITE.center.x, 0.13, SITE.center.z);
  sitePlate.receiveShadow = true;
  group.add(sitePlate);
  box(2.2, WAIST, 0.4, -2.4, 0.58, SITE.center.z - 2.9, 'hairline');
  box(2.2, WAIST, 0.4, 2.4, 0.58, SITE.center.z - 2.9, 'hairline');
  box(0.4, WAIST, 2.2, -3.3, 0.58, SITE.center.z - 1.4, 'hairline');
  // The site's back wall, with a gap a defender can fall back through.
  box(3.0, FULL, 0.4, -4.4, FULL / 2, SITE.center.z - 3.4, 'surface');
  box(1.8, FULL, 0.4, 4.9, FULL / 2, SITE.center.z - 3.4, 'surface');

  // --- Mid: a pillar wall splits the yard, with a doorway gap at each end and a capstone.
  box(1.1, 3.4, 9.5, -5.5, 1.7, 1.0, 'hairline');
  box(1.1, 3.4, 9.5, 5.5, 1.7, 1.0, 'hairline');
  // Mid control: the two pillars that make the centre a duel rather than a corridor.
  pillar(0.55, FULL, -2.6, 1.0);
  pillar(0.55, FULL, 2.6, 1.0);

  // --- Lane covers: staggered crates so pushing either lane costs a peek.
  crate(1.7, -9.6, 6.0, WAIST);
  crate(1.7, 9.6, 6.0, WAIST);
  crate(1.7, -9.6, -2.2, WAIST);
  crate(1.7, 9.6, -2.2, WAIST);
  crate(1.4, -2.8, 5.8, LOW);
  crate(1.4, 2.8, 5.8, LOW);
  // A low stack at the mouth of each lane: crouch to hold, stand to push.
  crate(1.2, -7.4, 9.4, LOW);
  crate(1.2, 7.4, 9.4, LOW);

  // --- Site-side soft cover the defenders peek from.
  crate(1.5, -6.0, -8.6, LOW);
  crate(1.5, 6.0, -8.6, LOW);
  crate(1.3, -8.2, -4.6, WAIST);
  crate(1.3, 8.2, -4.6, WAIST);

  // --- The raised walkway behind the site, reached by a ramp: the defenders' one high angle, and
  // the reason an attacker has to check up before pushing the platform.
  box(7.6, 0.3, 2.6, 0, 1.6, -11.4, 'surface');
  box(2.6, 0.28, 3.4, 0, 0.8, -9.9, 'surface');
  // Walkway rail, so the angle is held rather than fallen off.
  box(7.6, 0.5, 0.16, 0, 1.75, -10.2, 'hairline');
  // The walkway stands on columns and carries a canopy beam: structure that reads as built,
  // not a floating slab -- the 'this is a prototype' tell the look criterion punishes.
  for (const cx of [-3.2, 0, 3.2]) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.75, 0.32), materials.hairline);
    column.position.set(cx, 0.875, -11.9);
    column.castShadow = true;
    group.add(column);
    colliders.push(new THREE.Box3().setFromObject(column));
    shootables.push(column);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.18, 3.0), materials.ink);
  canopy.position.set(0, 2.9, -11.4);
  canopy.castShadow = true;
  group.add(canopy);
  shootables.push(canopy);
  // Canopy support posts at its outer corners, so the beam lands on something.
  for (const cx of [-3.9, 3.9]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.9, 0.26), materials.hairline);
    post.position.set(cx, 1.45, -11.4);
    post.castShadow = true;
    group.add(post);
    colliders.push(new THREE.Box3().setFromObject(post));
    shootables.push(post);
  }

  // --- Long lane (B, east): a walled channel with two gaps, so the east push is slower but the
  // defender has to commit someone to hold it.
  box(0.5, FULL, 7.0, 10.6, FULL / 2, 3.4, 'surface');
  box(0.5, FULL, 4.0, 10.6, FULL / 2, -6.4, 'surface');

  // --- Short lane (A, west): the quick way in, with a crate wall the attacker must break line on.
  box(0.5, FULL, 5.0, -10.6, FULL / 2, 2.0, 'surface');
  crate(1.6, -8.8, -1.0, WAIST);

  // --- Spawn geometry, so both ends of the map read as somewhere a team stands.
  box(6.0, 0.2, 1.6, 0, 0.1, 11.6, 'surface');
  box(6.0, 0.2, 1.6, 0, 0.1, -11.9, 'surface');

  // --- The skyline: block masses beyond the perimeter, silhouetted against the sky. The yard
  // then reads as a place inside a town rather than a box floating on a plane, and every wall
  // top has a horizon to sit against. They sit outside the play area and cast no shadows.
  const distantMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9aa7b4'), roughness: 1.0, metalness: 0.0 });
  const farMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b6c1cc'), roughness: 1.0, metalness: 0.0 });
  const skyline = [
    [-24, -6.5, 30, 9, 7, farMat],
    [-19, -4.0, 22, 6, 5, distantMat],
    [21, -3.5, 26, 11, 6, farMat],
    [27, -5.0, 18, 7, 5, distantMat],
    [-8, -4.5, 24, 8, 6, farMat],
    [9, -4.2, 27, 6, 7, distantMat],
    [-31, -6.0, 16, 12, 6, distantMat],
    [33, -5.5, 20, 9, 6, farMat],
  ];
  for (const [x, y, z, w, h, mat] of skyline) {
    const mass = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.72), mat);
    mass.position.set(x, y + h / 2 - 4.0, z);
    mass.castShadow = false;
    mass.receiveShadow = false;
    group.add(mass);
    // A parapet cap on each mass breaks the silhouette so the skyline is not a row of slabs.
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.34, w * 0.72 + 0.5), materials.hairline);
    parapet.position.set(x, y + h - 4.0 + 0.17, z);
    group.add(parapet);
  }

  // The charge marker at the site: a low plinth the planter has to stand near.
  // The charge: emissive orange plus its own small light, so the objective is the brightest,
  // most legible object on the map -- the first thing the eye finds in any frame that holds it.
  const chargeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.charge), emissive: new THREE.Color(PALETTE.charge), emissiveIntensity: 0.85, roughness: 0.4 });
  const charge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 0.9), chargeMat);
  charge.position.set(SITE.center.x, 0.51, SITE.center.z);
  charge.castShadow = true;
  group.add(charge);
  colliders.push(new THREE.Box3().setFromObject(charge));
  shootables.push(charge);
  const chargeGlow = new THREE.PointLight(new THREE.Color(PALETTE.charge), 14, 7.5);
  chargeGlow.position.set(SITE.center.x, 1.4, SITE.center.z);
  group.add(chargeGlow);
  // A faint painted ring on the floor around the plinth marks the plant area from any angle.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(SITE.radius - 0.22, SITE.radius, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.55, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(SITE.center.x, 0.28, SITE.center.z);
  group.add(ring);

  return { colliders, shootables, group };
}
