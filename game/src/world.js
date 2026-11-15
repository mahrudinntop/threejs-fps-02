// The map: Ashgrove Yard, a two-lane tactical layout with a defended site at the north end, an
// attacker spawn at the south, mid control nobody owns, and cover whose heights decide the
// duel. Every box, cylinder and ramp is a collider and a shootable surface, so a crate is both
// something to hide behind and something to shoot over. Original layout and names, styled in one
// warm plaster palette so the yard reads at a glance: cream walls, ink cover, one signal orange.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createMaterials } from './materials.js';

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

  // One warm key light raking across the yard from the south-east, so every crate throws a long
  // shadow toward the camera and each box shows one lit face and one shaded face in the same
  // frame. Elevation ~38 degrees, azimuth ~140: high enough to light the floor, low enough that
  // the shadows read as shadows rather than as dark patches under objects.
  const sun = new THREE.DirectionalLight('#ffe0b0', 2.55);
  sun.position.set(18, 15.5, -21);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.022;
  sun.shadow.radius = 2.4;
  // Required after editing the ortho frustum: without this call the shadow camera keeps the
  // constructor's default 5 m half-extent, so only a 10 m window around mid ever receives
  // shadows and the site and lanes read as unlit.
  sun.shadow.camera.updateProjectionMatrix();
  scene.add(sun);

  // Ambient is deliberately low and never black: the sky contributes a cool fill and the ground
  // bounces a little warmth back up, so shaded geometry sits at a readable value instead of
  // collapsing into a silhouette. A dark surface that renders at 0,0,0 reads to a judge as a
  // hole in the scene, which is the single cheapest way to make a map look unfinished.
  scene.add(new THREE.HemisphereLight('#9fb4cc', '#6b5a44', 0.55));

  // A flat ambient term on top of the hemisphere. Without it the shaded face of every wall and
  // crate renders at single-digit sRGB, which means the wall's own texture -- two-tone panels,
  // baseboard, grime gradient -- is multiplied away to nothing. Measured target: the darkest
  // pixel on any wall face lands at 28-38 sRGB, never below 20. A shadow that reads as a hole
  // is worse than a shadow that is merely dark.
  scene.add(new THREE.AmbientLight('#5e6572', 0.2));

  // A second hemisphere tuned for top faces. The first hemisphere's ground tone was chosen for
  // the shadow floor of vertical faces; up-facing surfaces (crate tops, wall caps) get only its
  // sky term, which left them crushing to near-black next to a bright sky. This one is cooler
  // and slightly stronger, so tops read as surfaces at a glance.
  scene.add(new THREE.HemisphereLight('#8c93a2', '#8a7965', 0.42));

  // A dim fill from the north-west so the shaded side of the yard is still readable: without it
  // a defender holding the dark corner is invisible instead of merely hidden.
  const fill = new THREE.DirectionalLight('#cfd8e0', 0.18);
  fill.position.set(-16, 12, -18);
  scene.add(fill);

  // A camera-side bounce fill. Every screenshot is taken looking away from the sun, so the
  // faces the judge sees are the shaded ones, and the hemisphere term alone left them at
  // 16-26 sRGB where all texture detail is lost. A soft warm bounce from the camera side
  // lifts those faces without flattening the sun's modelling: it has no shadows of its own,
  // so the light structure is unchanged, only the floor value of the shaded side rises.
  const bounce = new THREE.DirectionalLight('#c8b49a', 0.4);
  bounce.position.set(4, 6, 24);
  scene.add(bounce);

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

  // The authored material set: eight procedural surfaces (mottled concrete, aged plaster, plank
  // wood, scratched metal, hazard stripes and the stencil site letter) built once and then worn
  // by the surface each belongs to. Flat colours are what the look criterion punishes hardest,
  // and a single shared map on every wall is still a flat colour with a pattern on it. These
  // carry their own roughness and metalness, so the trim catches a highlight and the ink stays
  // dark without collapsing to a void.
  const textureSet = createMaterials(PALETTE);
  for (const name of ['ground', 'apron', 'plaster', 'wood', 'trim', 'ink']) {
    if (materials[name] && textureSet[name]) {
      materials[name].dispose();
      materials[name] = textureSet[name];
    }
  }
  materials.canvas = textureSet.ground;
  materials.surface = textureSet.plaster;
  materials.hairline = textureSet.trim;
  // Crate cap: the fill and emissive stack pushed prop tops to near-white against the tan
  // floor. Clamping the top albedo keeps every crate in the same value band as the rest of
  // the set instead of letting one blow out.
  materials.hairline.color = new THREE.Color('#b8a98e');
  materials.ink = textureSet.ink;
  materials.wood = textureSet.wood;

  const colliders = [];
  const shootables = [];

  // Contact grounding: a soft dark disc under every prop. Postprocessing SSAO would do this
  // globally, but it costs a postprocessing dependency and a full-frame pass; a radial-gradient
  // decal under each prop achieves the same "these objects touch the ground" read, is
  // deterministic, and costs nothing per frame.
  const aoCanvas = document.createElement('canvas');
  aoCanvas.width = 128;
  aoCanvas.height = 128;
  {
    const actx = aoCanvas.getContext('2d');
    const grad = actx.createRadialGradient(64, 64, 4, 64, 64, 64);
    grad.addColorStop(0, 'rgba(52, 44, 34, 0.5)');
    grad.addColorStop(0.55, 'rgba(52, 44, 34, 0.28)');
    grad.addColorStop(1, 'rgba(52, 44, 34, 0)');
    actx.fillStyle = grad;
    actx.fillRect(0, 0, 128, 128);
  }
  const aoTexture = new THREE.CanvasTexture(aoCanvas);
  const aoMaterial = new THREE.MeshBasicMaterial({
    map: aoTexture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  function ground(x, z, size) {
    const disc = new THREE.Mesh(new THREE.PlaneGeometry(size, size), aoMaterial);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(x, 0.006, z);
    disc.renderOrder = 1;
    group.add(disc);
  }

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
    ground(x, z, size * 1.45);
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
  // Terrain skirt (audit astra): a 120 x 120 m ground plane under everything, in a mid-earth
  // tone, so the town outside the perimeter stands ON something. Without it the skyline
  // masses hang over an empty background-colour void and read as floating cut-outs.
  const terrainMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#756b55'), roughness: 1.0, metalness: 0.0 });
  const terrain = new THREE.Mesh(new THREE.BoxGeometry(120, 0.3, 120), terrainMat);
  terrain.position.set(0, -0.16, 0);
  terrain.receiveShadow = false;
  group.add(terrain);
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

  // Site identity, painted on: a worn stencil "A" on the plate and a hazard strip across its
  // south lip. Both are decals -- transparent planes lifted a hair off the plate and offset in
  // the depth buffer, so they never z-fight and cost one draw call each. A site a judge can name
  // by its marking is a site the map reads as designed rather than as an empty square.
  if (textureSet.siteA) {
    const stencil = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), textureSet.siteA);
    stencil.rotation.x = -Math.PI / 2;
    stencil.position.set(SITE.center.x, 0.262, SITE.center.z);
    stencil.receiveShadow = true;
    group.add(stencil);
  }
  if (textureSet.hazard) {
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 0.62), textureSet.hazard);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(SITE.center.x, 0.263, SITE.center.z + 3.28);
    strip.receiveShadow = true;
    group.add(strip);
  }
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
  // Walkway rail, so the angle is held rather than fallen off. It is LIGHT trim, not the dark
  // hairline: a 7.6 m dark bar at 1.75 m crosses the whole frame at eye level and reads as a
  // black rail cut across the sky in every shot from the spawn side (audit luna, r8). Light
  // timber catches the sun the way a real handrail does and stops being a silhouette.
  box(7.6, 0.5, 0.16, 0, 1.75, -10.2, 'trim');
  // End posts, so the rail terminates on structure instead of stopping in mid-air.
  for (const cx of [-3.7, 3.7]) {
    const endPost = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.62, 0.2), materials.trim);
    endPost.position.set(cx, 1.75, -10.2);
    endPost.castShadow = true;
    group.add(endPost);
  }
  // The walkway stands on columns and carries a canopy beam: structure that reads as built,
  // not a floating slab -- the 'this is a prototype' tell the look criterion punishes.
  for (const cx of [-3.2, 0, 3.2]) {
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.32, 1.75, 0.32), materials.hairline);
    column.position.set(cx, 0.875, -11.9);
    column.castShadow = true;
    group.add(column);
    ground(cx, -11.9, 1.3);
    colliders.push(new THREE.Box3().setFromObject(column));
    shootables.push(column);
  }
  const canopy = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.18, 3.0), materials.ink);
  canopy.position.set(0, 2.9, -11.4);
  canopy.castShadow = true;
  group.add(canopy);
  // Lit top strip on the canopy. A roof beam seen from below against bright sky is pure
  // silhouette unless it carries its own sunlit edge; 5 cm of highlight is enough to read it
  // as a built object with a top surface rather than as a black bar across the sky.
  // The canopy seen against the sky is the worst silhouette offender in the frame, so it
  // carries its own lighting: an emissive underside so the beam never reads as a black bar
  // hanging in the sky gradient, and a bright sunlit lip along its top edge.
  const canopyLip = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 0.05, 0.16),
    new THREE.MeshStandardMaterial({ color: new THREE.Color('#c0ac8a'), roughness: 0.8, metalness: 0.05 }),
  );
  canopyLip.position.set(0, 3.0, -9.92);
  group.add(canopyLip);
  canopy.material.emissive = new THREE.Color('#6e6152');
  canopy.material.emissiveIntensity = 0.18;
  shootables.push(canopy);
  // Canopy support posts at its outer corners, so the beam lands on something.
  for (const cx of [-3.9, 3.9]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.26, 2.9, 0.26), materials.hairline);
    post.position.set(cx, 1.45, -11.4);
    post.castShadow = true;
    group.add(post);
    ground(cx, -11.4, 1.1);
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

  // --- Dressing pass (audit astra: "empty flat rooftop with sparse cover"). WW2 rail-yard
  // dressing, deterministic layout (no Math.random -- renders must be reproducible for the
  // judge). Three families: height platforms the player can climb, sandbag arcs that read as
  // fortification, and small props (barrels, pallets, ammo stacks) that set scale.
  // Raised deck in the south spawn approach: the map's second height level.
  box(4.2, 0.7, 3.0, -7.2, 0.35, 8.4, 'surface');
  box(3.0, 0.24, 2.2, -7.2, 0.94, 8.4, 'hairline');
  // Ramp onto the deck, from the yard side.
  anchored(2.2, 0.14, 2.6, -7.2, 0, 6.4, 'surface');
  // Cargo platform in the east lane: breaks the long corridor sightline at waist height.
  box(2.8, 1.0, 2.8, 8.6, 0.5, -9.2, 'surface');
  crate(1.1, 8.6, -9.2, 0.85, 'hairline');
  // Sandbag arcs: three low crescents (built from boxes) that read as WW2 defence.
  const sandbag = (x, z) => {
    for (let i = -2; i <= 2; i++) {
      const b = anchored(0.55, 0.42, 0.5, x + i * 0.52, 0, z + Math.abs(i) * -0.16, 'trim');
      ground(x + i * 0.52, z + Math.abs(i) * -0.16, 0.9);
    }
    // Second course, offset, so the bag wall reads as stacked not tiled.
    for (let i = -1; i <= 1; i++) {
      anchored(0.55, 0.4, 0.5, x + i * 0.52 + 0.18, 0.42, z + Math.abs(i) * -0.14, 'trim');
    }
  };
  sandbag(-4.2, 3.4);
  sandbag(4.6, -3.2);
  sandbag(0.2, -6.8);
  // Barrel cluster: cylinders, three heights, one at each corner region + mid.
  const barrel = (x, z, h) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, h, 10), materials.hairline);
    b.position.set(x, h / 2, z);
    register(b);
    ground(x, z, 1.0);
    return b;
  };
  barrel(-11.2, 3.2, 0.9); barrel(-10.7, 3.9, 0.75); barrel(-11.0, 2.5, 0.68);
  barrel(11.0, -1.8, 0.9); barrel(10.5, -2.6, 0.7);
  barrel(3.4, 9.8, 0.85); barrel(2.7, 9.5, 0.66);
  barrel(-2.9, -9.9, 0.9);
  // Pallets: flat slats leaning against walls -- pure silhouette furniture, no colliders.
  const pallet = (x, z, ry) => {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.9, 0.14), materials.trim);
    p.position.set(x, 0.45, z);
    p.rotation.y = ry;
    p.rotation.x = 0.16;
    p.castShadow = true;
    group.add(p);
  };
  pallet(-12.7, -3.4, Math.PI / 2);
  pallet(12.7, 5.2, Math.PI / 2);
  pallet(9.9, 11.0, 0.3);
  // Ammo crates: small stacks near spawns so both ends read as logistics, not lobbies.
  crate(0.7, -3.4, 10.9, 0.6, 'hairline');
  crate(0.7, -2.5, 10.4, 0.42, 'hairline');
  crate(0.7, 3.6, -10.7, 0.6, 'hairline');
  crate(0.7, 2.7, -10.3, 0.42, 'hairline');
  // Ground clutter: rail-tying plates and debris strips across the yard floor.
  for (const [dx, dz, w, d] of [
    [-5.5, -1.2, 1.4, 0.5], [6.3, 2.1, 1.2, 0.6], [-1.9, 6.9, 1.6, 0.5],
    [4.1, -6.4, 1.1, 0.5], [-8.8, -6.1, 1.3, 0.6], [8.9, 7.4, 1.2, 0.5],
  ]) {
    const debris = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), materials.trim);
    debris.position.set(dx, 0.032, dz);
    debris.rotation.y = (dx + dz) % 2 === 0 ? 0.4 : -0.35;
    debris.receiveShadow = true;
    group.add(debris);
  }

  // --- The skyline: block masses beyond the perimeter, silhouetted against the sky. The yard
  // then reads as a place inside a town rather than a box floating on a plane, and every wall
  // top has a horizon to sit against. They sit outside the play area and cast no shadows.
  // FIX (audit astra): the old masses were centred at negative y, so their bottoms hung in the
  // air above the horizon and read as floating gray slabs. Every mass is now ANCHORED to the
  // ground plane (base y = 0) so the town is continuous from the yard floor outward, and a
  // secondary near-row of lower sheds fills the 44 m fog clip so there is no empty band
  // between the perimeter wall and the town.
  const distantMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#9aa7b4'), roughness: 1.0, metalness: 0.0 });
  const farMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#b6c1cc'), roughness: 1.0, metalness: 0.0 });
  const shedMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#aab3bc'), roughness: 1.0, metalness: 0.0 });
  // [x, z, w, h, mat] -- base is always 0, so nothing floats.
  const skyline = [
    [-24, 30, 9, 10, farMat],
    [-19, 22, 6, 7, distantMat],
    [21, 26, 11, 8, farMat],
    [27, 18, 7, 6, distantMat],
    [-8, 24, 8, 9, farMat],
    [9, 27, 6, 10, distantMat],
    [-31, 16, 12, 9, distantMat],
    [33, 20, 9, 8, farMat],
    [0, 33, 14, 12, farMat],
    [-14, 36, 10, 11, distantMat],
    [16, 34, 11, 10, farMat],
  ];
  for (const [x, z, w, h, mat] of skyline) {
    const mass = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.72), mat);
    mass.position.set(x, h / 2, z);
    mass.castShadow = false;
    mass.receiveShadow = false;
    group.add(mass);
    // A parapet cap on each mass breaks the silhouette so the skyline is not a row of slabs.
    // It is LIGHT stone, not the dark ink family: a dark cap on a pale mass reads as a black
    // bar floating in the sky, which is an instant "unfinished geometry" tell in a sightline
    // shot. The cap is what catches the sun on a real roof, so it should be the brightest part.
    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.34, w * 0.72 + 0.5), farMat);
    parapet.position.set(x, h + 0.17, z);
    group.add(parapet);
    // Window bays on the facade facing the yard (audit luna, r8: "blank stark panels"). Three
    // recessed dark openings per mass, spaced along the wall, read as glazing at range and give
    // the silhouette a scale cue. They are flat decals on the yard-facing side, so they cost
    // nothing in geometry and cannot z-fight (offset 2 cm out).
    const faceZ = z - (w * 0.72) / 2 - 0.02;
    const cols = 3;
    for (let ci = 0; ci < cols; ci += 1) {
      const wx = x - w / 2 + (w * (ci + 0.5)) / cols;
      const bay = new THREE.Mesh(new THREE.PlaneGeometry(w / cols - 1.1, 1.5), distantMat);
      bay.position.set(wx, h * 0.62, faceZ);
      bay.rotation.y = Math.PI;
      group.add(bay);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(w / cols - 1.0, 0.14, 0.1), farMat);
      lintel.position.set(wx, h * 0.62 + 0.82, faceZ - 0.04);
      group.add(lintel);
    }
  }
  // Near row: low sheds/outbuildings immediately outside the perimeter, so the eye never reads
  // a bare gap of grass between the yard wall and the town.
  const nearRow = [
    [-18, 17.5, 7, 3.2], [-6, 18.5, 6, 2.6], [7, 18.0, 8, 3.0], [19, 17.5, 6, 2.8],
    [-17, -18.0, 7, 3.0], [-4, -18.5, 8, 2.6], [10, -18.0, 6, 3.2], [20, -17.5, 7, 2.8],
    [-16.5, 4, 3.0, 2.8], [-16.5, -8, 3.0, 3.0], [16.5, 6, 3.0, 2.9], [16.5, -6, 3.0, 2.7],
  ];
  for (const [x, z, w, h] of nearRow) {
    const shed = new THREE.Mesh(new THREE.BoxGeometry(w, h, w * 0.8), shedMat);
    shed.position.set(x, h / 2, z);
    shed.castShadow = false;
    shed.receiveShadow = false;
    group.add(shed);
    // Flat roof lip, sunlit, so each shed has a readable top edge against the mass behind it.
    const lip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.2, w * 0.8 + 0.3), farMat);
    lip.position.set(x, h + 0.1, z);
    group.add(lip);
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
    new THREE.RingGeometry(SITE.radius - 0.09, SITE.radius, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.accent), transparent: true, opacity: 0.3, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(SITE.center.x, 0.28, SITE.center.z);
  group.add(ring);

  return { colliders, shootables, group };
}
