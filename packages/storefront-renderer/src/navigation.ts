// ---------------------------------------------------------------------------
// Navigation contract — nested header & footer menus.
// Persisted inside StoreSettings.configJson under `navigation`.
// Both the admin Navigation manager and the storefront resolve hrefs from
// this one implementation.
// ---------------------------------------------------------------------------

export type NavLinkType =
  | 'home'
  | 'products'
  | 'collections'
  | 'blog'
  | 'track'
  | 'product'
  | 'collection'
  | 'page'
  | 'external';

export type NavNode = {
  id: string;
  label: string;
  enabled: boolean;
  type: NavLinkType;
  /** product id, collection handle, or page handle — depends on `type` */
  ref?: string;
  /** external absolute URL — only when type === 'external' */
  url?: string;
  children?: NavNode[];
};

export type ResolvedNavNode = {
  id: string;
  label: string;
  href: string;
  external: boolean;
  children: ResolvedNavNode[];
};

function safeExternalHref(value?: string): string | null {
  if (!value || value.length > 500 || /[<>"'\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname
      ? value
      : null;
  } catch {
    return null;
  }
}

/** Absolute-path or https? URLs only — anything else is dropped. */
export function safeHref(node: Pick<NavNode, 'type' | 'ref' | 'url'>): string | null {
  switch (node.type) {
    case 'home':
      return '/';
    case 'products':
      return '/products';
    case 'collections':
      return '/collections';
    case 'blog':
      return '/blog';
    case 'track':
      return '/track';
    case 'product':
      return node.ref ? `/products/${encodeURIComponent(node.ref)}` : null;
    case 'collection':
      return node.ref ? `/collections/${encodeURIComponent(node.ref)}` : null;
    case 'page':
      return node.ref ? `/p/${encodeURIComponent(node.ref)}` : null;
    case 'external':
      return safeExternalHref(node.url);
    default:
      return null;
  }
}

export function resolveNavNodes(nodes?: NavNode[] | null, depth = 1): ResolvedNavNode[] {
  if (!Array.isArray(nodes) || depth > 3) return [];
  const out: ResolvedNavNode[] = [];
  for (const raw of nodes) {
    if (!raw || raw.enabled === false) continue;
    const href = safeHref(raw);
    if (!href) continue;
    out.push({
      id: raw.id ?? href,
      label: String(raw.label ?? '').trim().slice(0, 80) || 'Link',
      href,
      external: raw.type === 'external',
      children: depth < 3 ? resolveNavNodes(raw.children, depth + 1) : [],
    });
  }
  return out;
}

/** Legacy flat header/footer links (label + href) — always safe to render as-is. */
export type LegacyLink = { label?: string; href?: string };

export function legacyToResolved(rows?: LegacyLink[] | null): ResolvedNavNode[] {
  if (!Array.isArray(rows)) return [];
  const out: ResolvedNavNode[] = [];
  for (const r of rows) {
    const label = String(r?.label ?? '').trim().slice(0, 80);
    const href = String(r?.href ?? '').trim();
    if (!label || !href) continue;
    const externalHref = safeExternalHref(href);
    const internal = href.startsWith('/') && !href.startsWith('//');
    if (!externalHref && !internal) continue;
    if (/[<>"'\\]/.test(href)) continue;
    out.push({
      id: href,
      label,
      href: externalHref ?? href,
      external: !!externalHref,
      children: [],
    });
  }
  return out;
}
