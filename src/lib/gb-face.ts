/** Press the matching on-screen action from the physical A/B face buttons. */
export function pressGbFace(which: "A" | "B") {
  const root = document.querySelector(".gb-screen");
  if (!(root instanceof HTMLElement)) return;
  const buttons = [...root.querySelectorAll("button")] as HTMLButtonElement[];
  const label = (b: HTMLButtonElement) => (b.textContent || "").replace(/\s+/g, " ").trim();
  if (which === "B") {
    buttons.find((b) => !b.disabled && /BACK|MENU|RUN|LEAVE|OK/i.test(label(b)))?.click();
    return;
  }
  buttons.find((b) => !b.disabled && !/BACK|MENU|RUN|LEAVE|RELEASE/i.test(label(b)))?.click();
}
