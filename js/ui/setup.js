// "Configurar" screen: edits a config object and reports every change.

import { createStepper, timeStep } from "./stepper.js";
import { buildTimeline, totalDuration, formatTime } from "../timeline.js";

const MAX_BLOCKS = 6;

export function createSetupScreen({
  root,
  config,
  onStart,
  onChange = () => {},
  onSave,
  onOpenPresets,
  presetExists = () => false,
}) {
  const general = root.querySelector("#general-fields");
  const repeatField = root.querySelector("#repeat-field");
  const blocksList = root.querySelector("#blocks");
  const addBlock = root.querySelector("#add-block");
  const total = root.querySelector("#total");
  const startBtn = root.querySelector("#start");
  const nameInput = root.querySelector("#preset-name");
  const saveBtn = root.querySelector("#save-preset");
  const saveAsNewBtn = root.querySelector("#save-as-new");
  const status = root.querySelector("#setup-status");

  let cfg = structuredClone(config);

  const updateTotal = () => {
    total.textContent = formatTime(totalDuration(buildTimeline(cfg)));
  };

  let statusTimer = null;
  const showStatus = (text) => {
    status.textContent = text;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => (status.textContent = ""), 2500);
  };

  const updateSaveButtons = () => {
    const existing = Boolean(cfg.id) && presetExists(cfg.id);
    saveBtn.textContent = existing ? "Guardar cambios" : "Guardar preset";
    saveAsNewBtn.hidden = !existing;
  };

  // Every edit: refresh the total and let the app remember it.
  const changed = () => {
    updateTotal();
    onChange(structuredClone(cfg));
  };

  const timeStepper = (label, key, min, max) =>
    createStepper({
      label,
      value: cfg[key],
      min,
      max,
      step: timeStep,
      format: formatTime,
      onChange: (v) => {
        cfg[key] = v;
        changed();
      },
    });

  const renderGeneral = () => {
    general.replaceChildren(
      createStepper({
        label: "Rounds",
        value: cfg.rounds,
        min: 1,
        max: 30,
        onChange: (v) => {
          cfg.rounds = v;
          changed();
        },
      }),
      timeStepper("Descanso", "rest", 0, 600),
      timeStepper("Preparación", "prep", 0, 120),
      createStepper({
        label: "Aviso final",
        value: cfg.warning,
        min: 0,
        max: 60,
        step: 5,
        format: (v) => (v === 0 ? "No" : `${v} s`),
        onChange: (v) => {
          cfg.warning = v;
          changed();
        },
      }),
    );
    repeatField.replaceChildren(
      createStepper({
        label: "Repeticiones",
        value: cfg.round.repeat,
        min: 1,
        max: 30,
        format: (v) => `${v}×`,
        onChange: (v) => {
          cfg.round.repeat = v;
          changed();
        },
      }),
    );
  };

  const renderBlocks = () => {
    const { blocks } = cfg.round;
    blocksList.replaceChildren(
      ...blocks.map((block, i) => {
        const li = document.createElement("li");
        li.className = "block";

        const head = document.createElement("div");
        head.className = "block-head";
        const name = document.createElement("input");
        name.type = "text";
        name.className = "block-name";
        name.value = block.label;
        name.maxLength = 24;
        name.placeholder = `Bloque ${i + 1}`;
        name.setAttribute("aria-label", `Nombre del bloque ${i + 1}`);
        name.addEventListener("input", () => {
          block.label = name.value;
          changed();
        });
        head.append(name);

        if (blocks.length > 1) {
          const remove = document.createElement("button");
          remove.type = "button";
          remove.className = "btn btn-icon";
          remove.textContent = "✕";
          remove.setAttribute("aria-label", `Quitar bloque ${block.label || i + 1}`);
          remove.addEventListener("click", () => {
            blocks.splice(i, 1);
            renderBlocks();
            changed();
          });
          head.append(remove);
        }

        li.append(
          head,
          createStepper({
            label: "Duración",
            value: block.duration,
            min: 5,
            max: 1200,
            step: timeStep,
            format: formatTime,
            onChange: (v) => {
              block.duration = v;
              changed();
            },
          }),
        );
        return li;
      }),
    );
    addBlock.hidden = blocks.length >= MAX_BLOCKS;
  };

  addBlock.addEventListener("click", () => {
    cfg.round.blocks.push({ label: `Bloque ${cfg.round.blocks.length + 1}`, duration: 30 });
    renderBlocks();
    changed();
  });

  nameInput.addEventListener("input", () => {
    cfg.name = nameInput.value;
    changed();
  });
  nameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") nameInput.blur();
  });

  const save = (asNew) => {
    const saved = onSave(structuredClone(cfg), { asNew });
    if (!saved) return;
    load(saved);
    showStatus(`Guardado: ${saved.name}`);
  };
  saveBtn.addEventListener("click", () => save(false));
  saveAsNewBtn.addEventListener("click", () => save(true));

  root.querySelector("#open-presets").addEventListener("click", () => onOpenPresets(cfg.id));

  startBtn.addEventListener("click", () => onStart(structuredClone(cfg)));

  function load(next) {
    cfg = structuredClone(next);
    nameInput.value = cfg.name ?? "";
    renderGeneral();
    renderBlocks();
    updateSaveButtons();
    changed();
  }

  load(config);

  return {
    load,
    showStatus,
    refresh: updateSaveButtons,
    get config() {
      return structuredClone(cfg);
    },
  };
}
