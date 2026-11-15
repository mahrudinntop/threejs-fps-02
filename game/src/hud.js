// The heads-up display: health, ammunition, the round clock and the score, the round banner, the
// buy menu and the kill feed. It only ever reads state and writes DOM, never the other way round.
const BUY_ITEMS = [
  { id: 'rifle', label: 'Vector AR', key: '1' },
  { id: 'smg', label: 'Wasp SMG', key: '2' },
  { id: 'sniper', label: 'Longview', key: '3' },
  { id: 'grenade', label: 'Flare x1', key: '4' },
];

export function createHud() {
  const root = document.getElementById('hud');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayBody = document.getElementById('overlay-body');
  const overlayHint = document.getElementById('overlay-hint');
  const healthEl = document.getElementById('hud-health');
  const ammoEl = document.getElementById('hud-ammo');
  const timerEl = document.getElementById('hud-timer');
  const scoreEl = document.getElementById('hud-score');
  const roundEl = document.getElementById('hud-round');
  const creditsEl = document.getElementById('hud-credits');
  const weaponEl = document.getElementById('hud-weapon');
  const grenadeEl = document.getElementById('hud-grenades');
  const objectiveEl = document.getElementById('hud-objective');
  const feedEl = document.getElementById('hud-feed');
  const centerEl = document.getElementById('hud-center');
  const hurtEl = document.getElementById('hud-hurt');
  const buyEl = document.getElementById('buy');
  const bannerEl = document.getElementById('round-banner');

  let onPlay = () => {};
  let feedRows = [];

  function setOverlay(title, body, hint, tone = '') {
    overlayTitle.textContent = title;
    overlayBody.textContent = body;
    overlayHint.textContent = hint;
    overlay.classList.remove('hidden', 'tone-good', 'tone-bad');
    if (tone) overlay.classList.add(tone);
  }

  function hideOverlay() {
    overlay.classList.add('hidden');
  }

  function flash(tone, ms = 900) {
    bannerEl.className = `banner ${tone}`;
    bannerEl.style.opacity = '1';
    window.setTimeout(() => { bannerEl.style.opacity = '0'; }, ms);
  }

  function hurt(ms = 220) {
    hurtEl.style.opacity = '1';
    window.setTimeout(() => { hurtEl.style.opacity = '0'; }, ms);
  }

  function hitMarker(killed, ms = 90) {
    centerEl.className = killed ? 'hitmarker kill' : 'hitmarker';
    centerEl.style.opacity = '1';
    window.setTimeout(() => { centerEl.style.opacity = '0'; }, ms);
  }

  function pushFeed(text, tone) {
    feedRows.unshift({ text, tone, at: performance.now() });
    // Cap at 3 rows: five stacked notifications ran the strip sideways across the whole
    // scoreboard and read as UI clutter in a scored combat frame (audit astra, r7).
    feedRows = feedRows.slice(0, 3);
    feedEl.innerHTML = feedRows.map((row) => `<li class="${row.tone}">${row.text}</li>`).join('');
  }

  function setHealth(value) {
    healthEl.textContent = String(Math.max(0, Math.round(value)));
    healthEl.classList.toggle('low', value <= 35);
  }

  function setAmmo(mag, reserve, reloading) {
    ammoEl.textContent = reloading > 0 ? '-- / --' : `${mag} / ${reserve}`;
    ammoEl.classList.toggle('dry', mag === 0 && reserve === 0);
  }

  function setTimer(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    timerEl.textContent = `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
    timerEl.classList.toggle('urgent', whole <= 10);
  }

  function setScore(team, enemy) {
    scoreEl.textContent = `${team} : ${enemy}`;
    scoreEl.classList.toggle('leading', team > enemy);
  }

  function setRound(index, of) {
    roundEl.textContent = `Round ${index} / ${of}`;
  }

  function setEconomy(credits, weaponName, grenades) {
    creditsEl.textContent = `$${credits}`;
    weaponEl.textContent = weaponName;
    grenadeEl.textContent = `Flare ${grenades}`;
  }

  function setObjective(text, urgent) {
    objectiveEl.textContent = text;
    objectiveEl.classList.toggle('urgent', Boolean(urgent));
  }

  function showBuy(credits, owned) {
    buyEl.classList.remove('hidden');
    buyEl.innerHTML = BUY_ITEMS.map((item) => {
      const held = item.id !== 'grenade' && owned.includes(item.id);
      return `<li class="${held ? 'held' : ''}"><span class="key">${item.key}</span><span class="label">${item.label}</span></li>`;
    }).join('') + `<li class="hint"><span class="key">Esc</span><span class="label">Close and deploy</span></li>`;
    creditsEl.textContent = `$${credits}`;
  }

  function hideBuy() {
    buyEl.classList.add('hidden');
  }

  document.getElementById('play-button').addEventListener('click', () => onPlay());

  return {
    setOverlay, hideOverlay, flash, hurt, hitMarker, pushFeed,
    setHealth, setAmmo, setTimer, setScore, setRound, setEconomy, setObjective,
    showBuy, hideBuy,
    onPlay(handler) { onPlay = handler; },
  };
}
