/** Press the matching on-screen action from the physical A/B/D-pad face buttons. */

function screenRoot(): HTMLElement | null {
  const el = document.querySelector(".gb-screen");
  return el instanceof HTMLElement ? el : null;
}

function labelOf(b: HTMLButtonElement) {
  return (b.textContent || "").replace(/\s+/g, " ").trim();
}

function actionButtons(root: HTMLElement) {
  return [...root.querySelectorAll("button")] as HTMLButtonElement[];
}

export function pressGbFace(which: "A" | "B") {
  const root = screenRoot();
  if (!root) return;
  const buttons = actionButtons(root).filter((b) => !b.disabled);
  if (which === "B") {
    const back = buttons.find((b) => /^(BACK|RUN|LEAVE|CANCEL|OK)\b/i.test(labelOf(b)))
      || buttons.find((b) => /BACK|RUN|LEAVE|CANCEL/i.test(labelOf(b)));
    back?.click();
    return;
  }
  const focused = buttons.find((b) => b.dataset.gbFocus === "1") || buttons.find((b) => b === document.activeElement);
  if (focused && !/BACK|RUN|LEAVE|RELEASE/i.test(labelOf(focused))) {
    focused.click();
    return;
  }
  const fight = buttons.find((b) => /^FIGHT$/i.test(labelOf(b)));
  if (fight) {
    fight.click();
    return;
  }
  const cont = buttons.find((b) => /CONTINUE|YES|CATCH/i.test(labelOf(b)));
  if (cont) {
    cont.click();
    return;
  }
  buttons.find((b) => !/BACK|MENU|RUN|LEAVE|RELEASE/i.test(labelOf(b)))?.click();
}

export function pressGbDpad(dir: "up" | "down" | "left" | "right") {
  const root = screenRoot();
  if (!root) return;
  const buttons = actionButtons(root).filter((b) => !b.disabled && b.offsetParent !== null);
  if (!buttons.length) return;
  let idx = buttons.findIndex((b) => b.dataset.gbFocus === "1" || b === document.activeElement);
  if (idx < 0) idx = 0;
  const cols = root.querySelector(".gb-moves-4") ? 2 : 2;
  if (dir === "right") idx = (idx + 1) % buttons.length;
  else if (dir === "left") idx = (idx - 1 + buttons.length) % buttons.length;
  else if (dir === "down") idx = (idx + cols) % buttons.length;
  else idx = (idx - cols + buttons.length) % buttons.length;
  buttons.forEach((b) => {
    b.dataset.gbFocus = "";
    b.classList.remove("gb-focus");
  });
  const next = buttons[idx];
  next.dataset.gbFocus = "1";
  next.classList.add("gb-focus");
  next.focus();
}
