// Keyboard + mouse input. Holds the live key state and turns presses into
// one-shot action flags the game loop consumes once per step, so a tap of E
// enters a car exactly once even if the key is held for several frames.

export function createInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    // Mouse position in canvas pixels (converted to world aim by main.js).
    mouseX: 0,
    mouseY: 0,
    mouseDown: false,
    // One-shot flags, set on keydown / mousedown, cleared by consumeActions.
    enterPressed: false,
    meleePressed: false,
    pausePressed: false,
    mutePressed: false,
    restartPressed: false,
    confirmPressed: false,
    shootPressed: false,
    anyGesture: false,
  };
}

const KEY_MAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export function attachInput(input, canvas) {
  function onKeyDown(event) {
    const mapped = KEY_MAP[event.code];
    if (mapped) {
      input[mapped] = true;
      event.preventDefault();
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') input.enterPressed = true;
    if (event.code === 'KeyF') input.meleePressed = true;
    if (event.code === 'KeyP' || event.code === 'Escape') input.pausePressed = true;
    if (event.code === 'KeyM') input.mutePressed = true;
    if (event.code === 'KeyR') input.restartPressed = true;
    if (event.code === 'Enter' || event.code === 'Space') input.confirmPressed = true;
    input.anyGesture = true;
  }
  function onKeyUp(event) {
    const mapped = KEY_MAP[event.code];
    if (mapped) input[mapped] = false;
  }
  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = event.clientX - rect.left;
    input.mouseY = event.clientY - rect.top;
  }
  function onMouseDown(event) {
    onMouseMove(event);
    input.mouseDown = true;
    input.shootPressed = true;
    input.anyGesture = true;
  }
  function onMouseUp() {
    input.mouseDown = false;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  return function detachInput() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mouseup', onMouseUp);
  };
}

// Copy the held keys into a plain step input, converting the mouse position
// into a world-space aim point with the camera supplied by the caller.
export function readStepInput(input, camera, scale) {
  const aimWorldX = camera.x + input.mouseX / scale;
  const aimWorldY = camera.y + input.mouseY / scale;
  return {
    up: input.up,
    down: input.down,
    left: input.left,
    right: input.right,
    mouseDown: input.mouseDown,
    aimX: aimWorldX,
    aimY: aimWorldY,
    enter: input.enterPressed,
    melee: input.meleePressed,
    shoot: input.shootPressed,
  };
}

// Clear every one-shot flag after the step has consumed them.
export function consumeActions(input) {
  input.enterPressed = false;
  input.meleePressed = false;
  input.pausePressed = false;
  input.mutePressed = false;
  input.restartPressed = false;
  input.confirmPressed = false;
  input.shootPressed = false;
}
