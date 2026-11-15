// The objective: one site, a charge that is planted and defused against a clock. It owns the
// timer and the state machine; the world owns where the site is drawn.
export const PLANT_TIME = 3.2;
export const DEFUSE_TIME = 5.0;
export const CHARGE_FUSE = 40;

export function createObjective(siteCenter, radius) {
  const state = {
    phase: 'carried',
    plantProgress: 0,
    defuseProgress: 0,
    fuse: CHARGE_FUSE,
    carrierAlive: true,
  };

  function inSite(position) {
    const dx = position.x - siteCenter.x;
    const dz = position.z - siteCenter.z;
    return Math.hypot(dx, dz) <= radius;
  }

  function reset() {
    state.phase = 'carried';
    state.plantProgress = 0;
    state.defuseProgress = 0;
    state.fuse = CHARGE_FUSE;
  }

  function plant(dt, planterInSite) {
    if (state.phase !== 'carried') return false;
    if (!planterInSite) {
      state.plantProgress = Math.max(0, state.plantProgress - dt * 1.4);
      return false;
    }
    state.plantProgress += dt;
    if (state.plantProgress >= PLANT_TIME) {
      state.phase = 'planted';
      state.fuse = CHARGE_FUSE;
      state.plantProgress = PLANT_TIME;
      return true;
    }
    return false;
  }

  function defuse(dt, defuserInSite) {
    if (state.phase !== 'planted') return false;
    if (!defuserInSite) {
      state.defuseProgress = Math.max(0, state.defuseProgress - dt * 1.4);
      return false;
    }
    state.defuseProgress += dt;
    if (state.defuseProgress >= DEFUSE_TIME) {
      state.phase = 'defused';
      return true;
    }
    return false;
  }

  function tick(dt) {
    if (state.phase !== 'planted') return null;
    state.fuse -= dt;
    if (state.fuse <= 0) {
      state.phase = 'detonated';
      return 'detonated';
    }
    return null;
  }

  return { state, inSite, reset, plant, defuse, tick, siteCenter };
}
