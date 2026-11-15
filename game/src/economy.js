// The round's economy and the buy menu: credits earned by how the last round went, spent between
// rounds on a rifle, a sidearm or a grenade. Pure state, no DOM, so the HUD can render any of it.
export const WEAPONS = {
  rifle: { name: 'Vector AR', price: 2700, mag: 30, reserve: 90, damage: 33, headDamage: 100, fireGap: 0.096, spreadStill: 0.0022, spreadMoving: 0.028, reload: 1.9, auto: true },
  smg: { name: 'Wasp SMG', price: 1250, mag: 25, reserve: 100, damage: 22, headDamage: 62, fireGap: 0.072, spreadStill: 0.006, spreadMoving: 0.034, reload: 1.6, auto: true },
  pistol: { name: 'Lark P9', price: 0, mag: 12, reserve: 48, damage: 26, headDamage: 78, fireGap: 0.16, spreadStill: 0.004, spreadMoving: 0.03, reload: 1.3, auto: false },
  sniper: { name: 'Longview', price: 4200, mag: 5, reserve: 25, damage: 88, headDamage: 200, fireGap: 1.1, spreadStill: 0.0006, spreadMoving: 0.05, reload: 2.6, auto: false },
};

export const GRENADE = { name: 'Flare', price: 300, damage: 58, radius: 5.2, fuse: 1.6 };

const START_CREDITS = 800;
const WIN_REWARD = 3250;
const LOSS_REWARD = 1900;
const LOSS_BONUS_STEP = 500;

export function createEconomy() {
  const state = {
    credits: START_CREDITS,
    lossStreak: 0,
    owned: ['pistol'],
    grenades: 1,
  };

  function canAfford(price) {
    return state.credits >= price;
  }

  function buy(id) {
    const weapon = WEAPONS[id] ?? null;
    if (!weapon) return false;
    if (!canAfford(weapon.price)) return false;
    state.credits -= weapon.price;
    if (!state.owned.includes(id)) state.owned.push(id);
    return true;
  }

  function buyGrenade() {
    if (!canAfford(GRENADE.price)) return false;
    state.credits -= GRENADE.price;
    state.grenades += 1;
    return true;
  }

  function settleRound(won) {
    if (won) {
      state.credits += WIN_REWARD;
      state.lossStreak = 0;
    } else {
      state.credits += LOSS_REWARD + state.lossStreak * LOSS_BONUS_STEP;
      state.lossStreak = Math.min(state.lossStreak + 1, 3);
    }
    state.credits = Math.min(state.credits, 16000);
    return state.credits;
  }

  function reset() {
    state.credits = START_CREDITS;
    state.lossStreak = 0;
    state.owned = ['pistol'];
    state.grenades = 1;
  }

  return { state, canAfford, buy, buyGrenade, settleRound, reset, WEAPONS, GRENADE };
}
