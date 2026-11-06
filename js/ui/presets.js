// "Presets" screen: list saved workouts, load one, delete one.

import { buildTimeline, totalDuration, formatTime } from "../timeline.js";

/** Short description, e.g. "3 × 2:00 · descanso 1:00" or "3 × (5× 30 s + 30 s)". */
export function describe(config) {
  const { blocks, repeat } = config.round;
  const blockText =
    blocks.length === 1 && repeat === 1
      ? formatTime(blocks[0].duration)
      : `${repeat > 1 ? `${repeat}× ` : ""}${blocks.map((b) => b.label).join(" + ")}`;
  const parts = [`${config.rounds} × ${blockText}`];
  if (config.rest > 0 && config.rounds > 1) parts.push(`descanso ${formatTime(config.rest)}`);
  return parts.join(" · ");
}

export function createPresetsScreen({ root, store, onSelect, onClose }) {
  const list = root.querySelector("#preset-list");
  const empty = root.querySelector("#presets-empty");

  root.querySelector("#close-presets").addEventListener("click", onClose);
  root.querySelector("#restore-presets").addEventListener("click", () => {
    store.restoreDefaults();
    render();
  });

  let activeId = null;

  function render() {
    const presets = store.listPresets();
    empty.hidden = presets.length > 0;
    list.replaceChildren(
      ...presets.map((preset) => {
        const li = document.createElement("li");
        li.className = "preset-item";
        if (preset.id === activeId) li.classList.add("is-active");

        const open = document.createElement("button");
        open.type = "button";
        open.className = "preset-open";
        const name = document.createElement("span");
        name.className = "preset-title";
        name.textContent = preset.name;
        const meta = document.createElement("span");
        meta.className = "preset-meta";
        meta.textContent = describe(preset);
        const total = document.createElement("span");
        total.className = "preset-total";
        total.textContent = formatTime(totalDuration(buildTimeline(preset)));
        open.append(name, meta, total);
        open.setAttribute("aria-label", `Cargar ${preset.name}, ${describe(preset)}`);
        open.addEventListener("click", () => onSelect(structuredClone(preset)));

        const del = document.createElement("button");
        del.type = "button";
        del.className = "btn btn-icon preset-delete";
        del.textContent = "✕";
        del.setAttribute("aria-label", `Borrar ${preset.name}`);
        del.addEventListener("click", () => {
          if (!confirm(`¿Borrar "${preset.name}"?`)) return;
          store.deletePreset(preset.id);
          render();
        });

        li.append(open, del);
        return li;
      }),
    );
  }

  return {
    show(currentId) {
      activeId = currentId ?? null;
      render();
    },
  };
}
