// The palette: one chosen set of surfaces, built as THREE value bands so the yard reads at a
// glance. Three rules hold it together:
//   Value split  -- the floor is the darkest surface, walls sit a clear step above it, and the
//                   sky is brighter than both, so floor, wall and horizon separate in silhouette.
//   Family split -- every surface has a distinct hue temperature (cold concrete, warm plaster,
//                   cool ink metal, one signal orange) so no two play surfaces are ever the same
//                   beige, which is what makes a scene collapse into a flat graphic.
//   Base bands   -- every wall carries a darker skirt at its foot, so geometry never floats.
export const PALETTE = {
  // Ground: cold, dark, matte concrete. The value anchor the rest is read against.
  canvas: '#6f695e',
  apron: '#7b7466',
  // Walls: warm plaster, a clear two steps above the floor.
  surface: '#d3ccbb',
  // The sky band: the brightest thing in the frame, so walls have a horizon to sit against.
  sky: '#cfd9e6',
  // Trim, structure and cover: cool dark ink metal, the counterweight to the plaster.
  hairline: '#5a5348',
  ink: '#39332b',
  accent: '#d8642e',
  site: '#4f7f9e',
  // Materials that name a space: the site's apron and the charge itself.
  siteFloor: '#8a7d64',
  charge: '#ff8c3a',
};
