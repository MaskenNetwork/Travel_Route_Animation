export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function smootherStep(progress: number) {
  const t = clamp(progress, 0, 1);

  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function easeOutCubic(progress: number) {
  const t = clamp(progress, 0, 1);

  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBack(progress: number) {
  const t = clamp(progress, 0, 1);
  const c1 = 1.70158;
  const c3 = c1 + 1;

  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
