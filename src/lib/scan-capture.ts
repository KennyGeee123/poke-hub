/**
 * Grab the current video frame as a small JPEG for the vision model.
 * 1280x720 frames cost ~2.2k input tokens on Groq; capping the long side at
 * 768px roughly halves that, which keeps us under the free-tier per-minute cap.
 */
export function frameToDataUrl(v: HTMLVideoElement, c: HTMLCanvasElement, maxSide = 768): string {
  const vw = v.videoWidth || 720;
  const vh = v.videoHeight || 1280;
  const scale = Math.min(1, maxSide / Math.max(vw, vh));
  c.width = Math.round(vw * scale);
  c.height = Math.round(vh * scale);
  c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.8);
}
