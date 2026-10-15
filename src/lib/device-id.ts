const KEY = "pv.device.v1";
/** Random per-browser id used only for the guest scan quota. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(KEY);
    if (!id || id.length < 16) {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      id = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
