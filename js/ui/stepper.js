// Large − / + stepper. Holding a button repeats the step.

const HOLD_DELAY = 400;
const HOLD_INTERVAL = 90;

/** Time step: 5 s below a minute, 15 s from a minute up. */
export function timeStep(value, direction) {
  if (direction > 0) return value < 60 ? 5 : 15;
  return value <= 60 ? 5 : 15;
}

/**
 * @param {{ label: string, value: number, min: number, max: number,
 *           step?: number | ((value, dir) => number),
 *           format?: (v: number) => string, onChange: (v: number) => void }} opts
 */
export function createStepper({ label, value, min, max, step = 1, format = String, onChange }) {
  const root = document.createElement("div");
  root.className = "stepper";
  root.innerHTML = `
    <span class="stepper-label"></span>
    <div class="stepper-controls">
      <button type="button" class="stepper-btn" data-dir="-1">−</button>
      <output class="stepper-value" aria-live="polite"></output>
      <button type="button" class="stepper-btn" data-dir="1">+</button>
    </div>`;
  root.querySelector(".stepper-label").textContent = label;
  const output = root.querySelector(".stepper-value");
  const [minus, plus] = root.querySelectorAll(".stepper-btn");
  minus.setAttribute("aria-label", `Menos ${label.toLowerCase()}`);
  plus.setAttribute("aria-label", `Más ${label.toLowerCase()}`);

  let current = value;
  const render = () => {
    output.textContent = format(current);
    minus.disabled = current <= min;
    plus.disabled = current >= max;
  };

  const change = (dir) => {
    const size = typeof step === "function" ? step(current, dir) : step;
    const nextValue = Math.min(max, Math.max(min, current + dir * size));
    if (nextValue === current) return false;
    current = nextValue;
    render();
    onChange(current);
    return true;
  };

  for (const btn of [minus, plus]) {
    const dir = Number(btn.dataset.dir);
    let timer = null;
    const stop = () => {
      clearTimeout(timer);
      timer = null;
    };
    const repeat = () => {
      timer = change(dir) ? setTimeout(repeat, HOLD_INTERVAL) : null;
    };
    btn.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // Capture is only a nicety for press-and-hold.
      }
      change(dir);
      timer = setTimeout(repeat, HOLD_DELAY);
    });
    btn.addEventListener("pointerup", stop);
    btn.addEventListener("pointercancel", stop);
    btn.addEventListener("lostpointercapture", stop);
    // Keyboard (Enter/Space) produces a click with detail 0.
    btn.addEventListener("click", (e) => {
      if (e.detail === 0) change(dir);
    });
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  render();
  return root;
}
