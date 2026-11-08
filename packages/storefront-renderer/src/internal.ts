// ---------------------------------------------------------------------------
// Dependency-free runtime guards shared by the config and section
// normalisers. Shared in one module to avoid a config ↔ sections import cycle.
// These functions never throw and never mutate their input.
// ---------------------------------------------------------------------------

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Best-effort array recovery for stored JSON:
 *  - arrays pass through unchanged,
 *  - plain objects are read as collections (Object.values, insertion order) so
 *    serialised maps like {"0": …, "1": …} are preserved instead of dropped,
 *  - anything else yields [].
 * Never throws; never fabricates values.
 */
export function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isPlainObject(value)) return Object.values(value);
  return [];
}

/** Coerce a scalar to a bounded trimmed string; non-scalars yield ''. */
export function str(value: unknown, max: number): string {
  if (typeof value === 'string') return value.trim().slice(0, max);
  if (typeof value === 'number' && Number.isFinite(value)) return String(value).slice(0, max);
  return '';
}
