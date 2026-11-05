// ---------------------------------------------------------------------------
// Live-preview origin validation — shared by storefront, renderer and admin.
// Only same-machine (localhost / 127.0.0.1), Vercel previews and *.pakcommerce.pk
// origins may participate in the editor ↔ preview handshake.
// ---------------------------------------------------------------------------

export function isAllowedPreviewOrigin(origin: string | null | undefined): boolean {
  if (!origin || typeof origin !== 'string') return false;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1') return true;
    if (host === 'vercel.app' || host.endsWith('.vercel.app')) return true;
    if (host === 'pakcommerce.pk' || host.endsWith('.pakcommerce.pk')) return true;
    return false;
  } catch {
    return false;
  }
}

/** Learn the exact preview origin the parent editor used — used to scope replies. */
export function resolvePreviewParentOrigin(origin: string | null | undefined): string | null {
  return isAllowedPreviewOrigin(origin) ? (origin as string) : null;
}

export function isPreviewSelectMessage(
  data: unknown,
): data is { type: 'pk-preview-select'; id: string | null } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (d.type !== 'pk-preview-select') return false;
  if (d.id === null) return true;
  return typeof d.id === 'string' && d.id.length > 0 && d.id.length <= 128;
}

export function isPreviewPickMessage(
  data: unknown,
): data is { type: 'pk-preview-pick'; id: string } {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  return d.type === 'pk-preview-pick' && typeof d.id === 'string' && d.id.length > 0 && d.id.length <= 128;
}
