// October 2026, Europe/Oslo. The UTC offsets differ because DST ends in October.
export const PINK_RIBBON_START = Date.parse('2026-10-01T00:00:00+02:00');
export const PINK_RIBBON_END = Date.parse('2026-11-01T00:00:00+01:00');

export function isPinkRibbonActive(now = Date.now()) {
  return now >= PINK_RIBBON_START && now < PINK_RIBBON_END;
}
