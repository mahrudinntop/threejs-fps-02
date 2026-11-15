// The map: a two-lane yard with a defended site at the north end, an attacker spawn at the south,
// and cover worth stopping behind. Every box is a collider and a shootable surface. Original
// layout, styled in the house palette.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const SITE = { center: new THREE.Vector3(0, 0, -7.2), radius: 3.6 };
export const ATTACK_SPAWN = new THREE.Vector3(0, 0, 9.8);
export const DEFEND_SPAWN = new THREE.Vector3(0, 0, -9.6);

export function createWorld(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // One warm key light high over the south wall and a soft sky fill, so the yard reads at a
  // glance and every crate throws a shadow worth hiding in.
  const sun = new THREE.DirectionalLight('#fff4e0', 2.6);
  sun.position.set(14, 22, 16);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -20;
  sun.shadow.camera.right = 20;
  sun.shadow.camera.top = 20;
  sun.shadow.camera.bottom = -20;
  sun.shadow.camera.far = 70;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight('#dfe8ef', '#8a7f6d', 1.1));

  const materials = {};
  for (const name of Object.keys(PALETTE)) {
    materials[name] = new THREE.MeshStandardMaterial({
      color: new THREE.Color(PALETTE[name]),
      roughness: name === 'accent' || name === 'ink' ? 0.55 : 0.92,
      metalness: 0.03,
    });
  }

  const colliders = [];
  const shootables = [];

  function box(width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), materials[material]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push(new THREE.Box3().setFromObject(mesh));
    shootables.push(mesh);
    return mesh;
  }

  // Ground and walls: a 26 x 26 m yard, open sky, one directional light.
  box(26.4, 0.4, 26.4, 0, -0.2, 0, 'canvas');
  box(0.4, 4.6, 26.4, -13.2, 2.3, 0, 'surface');
  box(0.4, 4.6, 26.4, 13.2, 2.3, 0, 'surface');
  box(26.4, 4.6, 0.4, 0, 2.3, -13.2, 'surface');
  box(26.4, 4.6, 0.4, 0, 2.3, 13.2, 'surface');

  // The site: a low platform with a back wall and two L-covers, worth holding from the north side.
  box(7.2, 0.24, 7.2, SITE.center.x, 0.12, SITE.center.z, 'surface');
  box(2.2, 1.15, 0.4, -2.4, 0.58, SITE.center.z - 2.9, 'hairline');
  box(2.2, 1.15, 0.4, 2.4, 0.58, SITE.center.z - 2.9, 'hairline');
  box(0.4, 1.15, 2.2, -3.3, 0.58, SITE.center.z - 1.4, 'hairline');

  // Mid lane: a long pillar wall that splits the yard, with a doorway gap at each end.
  box(1.1, 3.4, 9.5, -5.5, 1.7, 1.0, 'hairline');
  box(1.1, 3.4, 9.5, 5.5, 1.7, 1.0, 'hairline');

  // Lane covers: crates staggered so pushing either lane costs a peek.
  box(1.7, 1.15, 1.7, -9.6, 0.58, 6.0, 'hairline');
  box(1.7, 1.15, 1.7, 9.6, 0.58, 6.0, 'hairline');
  box(1.7, 1.15, 1.7, -9.6, 0.58, -2.2, 'hairline');
  box(1.7, 1.15, 1.7, 9.6, 0.58, -2.2, 'hairline');
  box(1.4, 0.85, 1.4, -2.8, 0.43, 5.8, 'hairline');
  box(1.4, 0.85, 1.4, 2.8, 0.43, 5.8, 'hairline');

  // Site-side soft cover the defenders peek from.
  box(1.5, 0.95, 1.5, -6.0, 0.48, -8.6, 'hairline');
  box(1.5, 0.95, 1.5, 6.0, 0.48, -8.6, 'hairline');

  // The raised walkway behind the site, reached by a ramp, gives the defenders one high angle.
  box(7.6, 0.3, 2.6, 0, 1.6, -11.4, 'surface');
  box(2.6, 0.28, 3.4, 0, 0.8, -9.9, 'surface');

  // The charge marker at the site: a low plinth the planter has to stand near.
  box(0.9, 0.5, 0.9, SITE.center.x, 0.25, SITE.center.z, 'accent');

  return { colliders, shootables, group };
}
