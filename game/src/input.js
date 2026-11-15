// Keyboard and mouse: pointer lock, WASD, crouch, walk, reload, weapon keys and the buy menu key.
// Look deltas are accumulated here and consumed once a frame by the player.
export function createInput(canvas) {
  const state = {
    keys: new Set(),
    firing: false,
    look: { x: 0, y: 0 },
    buyToggle: false,
    weaponKey: 0,
    grenadeKey: false,
  };
  let locked = false;
  const listeners = { lockChange: [] };

  canvas.addEventListener('click', () => {
    if (!locked) canvas.requestPointerLock();
  });

  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
    if (!locked) {
      state.firing = false;
      state.keys.clear();
    }
    for (const handler of listeners.lockChange) handler(locked);
  });

  document.addEventListener('mousemove', (event) => {
    if (!locked) return;
    state.look.x += event.movementX;
    state.look.y += event.movementY;
  });

  document.addEventListener('mousedown', (event) => {
    if (!locked) return;
    if (event.button === 0) state.firing = true;
    if (event.button === 2) state.grenadeKey = true;
  });

  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.grenadeKey = false;
  });

  document.addEventListener('contextmenu', (event) => event.preventDefault());

  document.addEventListener('keydown', (event) => {
    if (event.code === 'Tab') event.preventDefault();
    state.keys.add(event.code);
    if (event.code === 'KeyB') state.buyToggle = !state.buyToggle;
    if (event.code === 'Digit1') state.weaponKey = 1;
    if (event.code === 'Digit2') state.weaponKey = 2;
    if (event.code === 'Digit3') state.weaponKey = 3;
    if (event.code === 'Digit4') state.weaponKey = 4;
    if (event.code === 'KeyG') state.grenadeKey = true;
  });

  document.addEventListener('keyup', (event) => {
    state.keys.delete(event.code);
   });

   function takeLook() {
     const out = { x: state.look.x, y: state.look.y };
     state.look.x = 0;
     state.look.y = 0;
     return out;
   }

   return {
     state,
     takeLook,
     requestLock: () => canvas.requestPointerLock(),
     onLockChange(handler) { listeners.lockChange.push(handler); },
   };
}
