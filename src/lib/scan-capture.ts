/**
 * Grab the current video frame as a small JPEG for the vision model.
 * Crops the centre card-shaped region (63:88, where the on-screen guide sits) so
 * the card fills the image and the collector number stays legible, then caps the
 * long side at 768px (~half the Groq input tokens of a full 1280x720 frame).
 */
export function frameToDataUrl(v: HTMLVideoElement, c: HTMLCanvasElement, maxSide = 768): string {
  const vw = v.videoWidth || 720;
  const vh = v.videoHeight || 1280;
  const ASPECT = 63 / 88;
  let ch = Math.round(vh * 0.95);
  let cw = Math.round(ch * ASPECT);
  if (cw > vw * 0.95) {
    cw = Math.round(vw * 0.95);
    ch = Math.round(cw / ASPECT);
  }
  const sx = Math.round((vw - cw) / 2);
  const sy = Math.round((vh - ch) / 2);
  const scale = Math.min(1, maxSide / Math.max(cw, ch));
  c.width = Math.round(cw * scale);
  c.height = Math.round(ch * scale);
  c.getContext("2d")?.drawImage(v, sx, sy, cw, ch, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}
