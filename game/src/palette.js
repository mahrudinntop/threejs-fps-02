// The palette: one chosen set of surfaces, built as three value bands so the yard reads at a
// glance. Three rules hold it together:
//   Value split  -- the floor is the darkest surface, walls sit a clear step above it, and the
//                   sky is brighter than both, so floor, wall and horizon separate in silhouette.
//   Family split -- every surface has a distinct hue temperature (cold concrete, warm plaster,
//                   cool ink metal, one signal orange) so no two play surfaces are ever the same
//                   beige, which is what makes a scene collapse into a flat graphic.
//   Base bands   -- every wall carries a darker skirt at its foot, so geometry never floats.
//
// Albedo note: nothing here is pure black or pure white. The darkest ink sits around 0.08-0.12
// luminance so the sky still rims it, and the brightest plaster stays under the highlight
// ceiling that ACES tone mapping wants, so no surface clips to white under the key light.
export const PALETTE = {
  // Ground: cold, dark, matte concrete. The value anchor the rest is read against.
  // Two tones a clear step apart, so the apron (the playable lane) reads as its own plane.
  canvas: '#5f5a51',
  apron: '#787064',
  // Walls: warm plaster, a clear two steps above the floor.
  surface: '#d3ccbb',
  // Lower wall band: the skirt that grounds every vertical surface.
  skirt: '#a89f8b',
  // The sky band: the brightest thing in the frame, so walls have a horizon to sit against.
  sky: '#cfd9e6',
  // The haze the far lane dissolves into. Matches scene.fog so distance reads as atmosphere,
  // not as a wall of colour.
  haze: '#e6e3d8',
  // Trim, structure and cover: cool dark ink metal, the counterweight to the plaster.
  hairline: '#5a5348',
  ink: '#332e27',
  accent: '#d8642e',
  site: '#4f7f9e',
  // Materials that name a space: the site's apron and the charge itself.
  siteFloor: '#8a7d64',
  charge: '#ff8c3a',
};
