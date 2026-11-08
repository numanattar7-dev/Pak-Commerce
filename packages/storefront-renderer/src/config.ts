// ---------------------------------------------------------------------------
// Pak Commerce — shared theme configuration contract.
// Single source of truth for the customization shape persisted in
// StoreSettings.configJson. The admin editor and the public storefront both
// consume this module — do not duplicate these types or defaults.
//
// Design contract (Shopify-style):
//  • `colorSchemes` — five fully-independent color schemes, every section
//    picks one; the renderer applies scheme colors through scoped CSS vars.
//  • `style` — theme-level design tokens (fonts, radius, button shape,
//    hero/features/header/footer layouts, spacing).
//  • Legacy keys (theme.primary/accent, sections, header.menuLinks…) are
//    kept and honored for every existing store.
// ---------------------------------------------------------------------------

import type { PkSection } from './sections';
import { DEFAULT_HOME_SECTIONS } from './sections';
import type { NavNode } from './navigation';
import type * as React from 'react';
import { asArray, isPlainObject, str } from './internal';

export type LinkRow = { label: string; href: string };

/**
 * Normalise a stored `header.menuLinks` / `footer.quickLinks` value into plain
 * { label, href } rows. Accepts the legacy array format; plain objects are
 * recovered as collections (see asArray) so nothing merchant-authored is lost.
 * Non-scalar labels/hrefs and non-object entries are dropped; everything else
 * is preserved verbatim (trimmed and length-bounded). Never throw.
 *
 * The stored configuration itself is NEVER modified by this — callers get a
 * sanitised view; the saved config is only rewritten when the merchant
 * explicitly saves, and even then only in its canonical shape.
 */
export function sanitizeLinkRows(value: unknown): LinkRow[] {
  const out: LinkRow[] = [];
  for (const raw of asArray(value).slice(0, 50)) {
    if (!isPlainObject(raw)) continue;
    const label = str(raw.label, 80);
    const href = str(raw.href, 500);
    if (!label && !href) continue; // fully-empty junk row carries no data
    out.push({ label, href });
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * Color schemes — Shopify-style. Five schemes; every section may pick its own.
 * ------------------------------------------------------------------------ */

export type ColorSchemeColors = {
  background: string;
  text: string;
  heading: string;
  accent: string;
  button: string;
  buttonText: string;
  secondaryButton: string;
  secondaryButtonText: string;
  border: string;
};

export type ColorScheme = { id: string; name: string; colors: ColorSchemeColors };

/** Editor-facing color field list (Shopify "Colors" rows, in order). */
export const SCHEME_COLOR_FIELDS: Array<{ key: keyof ColorSchemeColors; label: string }> = [
  { key: 'background', label: 'Background' },
  { key: 'text', label: 'Text' },
  { key: 'heading', label: 'Headings' },
  { key: 'accent', label: 'Accent' },
  { key: 'button', label: 'Solid button background' },
  { key: 'buttonText', label: 'Solid button label' },
  { key: 'secondaryButton', label: 'Secondary button background' },
  { key: 'secondaryButtonText', label: 'Secondary button label' },
  { key: 'border', label: 'Borders' },
];

const hex = (value: unknown, fallback: string): string => {
  const s = typeof value === 'string' ? value.trim() : '';
  return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fallback;
};

const normalizeColors = (raw: unknown, fallback: ColorSchemeColors): ColorSchemeColors => {
  const src = isPlainObject(raw) ? raw : {};
  return {
    background: hex(src.background, fallback.background),
    text: hex(src.text, fallback.text),
    heading: hex(src.heading, fallback.heading),
    accent: hex(src.accent, fallback.accent),
    button: hex(src.button, fallback.button),
    buttonText: hex(src.buttonText, fallback.buttonText),
    secondaryButton: hex(src.secondaryButton, fallback.secondaryButton),
    secondaryButtonText: hex(src.secondaryButtonText, fallback.secondaryButtonText),
    border: hex(src.border, fallback.border),
  };
};

/** The five built-in schemes (also used as repair fallbacks for stored data). */
export const DEFAULT_COLOR_SCHEMES: ColorScheme[] = [
  {
    id: 'scheme-1',
    name: 'Scheme 1',
    colors: {
      background: '#ffffff',
      text: '#1a1a1a',
      heading: '#111111',
      accent: '#059669',
      button: '#111111',
      buttonText: '#ffffff',
      secondaryButton: '#ffffff',
      secondaryButtonText: '#111111',
      border: '#e5e7eb',
    },
  },
  {
    id: 'scheme-2',
    name: 'Scheme 2',
    colors: {
      background: '#f6f6f6',
      text: '#334155',
      heading: '#0f172a',
      accent: '#0d9488',
      button: '#1f2937',
      buttonText: '#ffffff',
      secondaryButton: '#ffffff',
      secondaryButtonText: '#1f2937',
      border: '#e2e8f0',
    },
  },
  {
    id: 'scheme-3',
    name: 'Scheme 3',
    colors: {
      background: '#ecfdf5',
      text: '#134e4a',
      heading: '#0f766e',
      accent: '#0d9488',
      button: '#0f766e',
      buttonText: '#ffffff',
      secondaryButton: '#ffffff',
      secondaryButtonText: '#0f766e',
      border: '#a7f3d0',
    },
  },
  {
    id: 'scheme-4',
    name: 'Scheme 4',
    colors: {
      background: '#0f172a',
      text: '#e2e8f0',
      heading: '#ffffff',
      accent: '#38bdf8',
      button: '#ffffff',
      buttonText: '#0f172a',
      secondaryButton: '#1e293b',
      secondaryButtonText: '#e2e8f0',
      border: '#27364b',
    },
  },
  {
    id: 'scheme-5',
    name: 'Scheme 5',
    colors: {
      background: '#101418',
      text: '#c8d2d9',
      heading: '#ffffff',
      accent: '#a3e635',
      button: '#f8fafc',
      buttonText: '#0f172a',
      secondaryButton: '#1c232b',
      secondaryButtonText: '#f8fafc',
      border: '#232b33',
    },
  },
];

const SCHEME_LIMIT = 5;

/**
 * Normalise the stored `colorSchemes` block: always returns up to five fully
 * populated schemes. Missing/partial/corrupt entries are repaired from the
 * built-in defaults so a stored config can never render a broken palette.
 */
export function getSchemes(cfg?: StoreCustomization | null): ColorScheme[] {
  const stored = asArray(cfg?.colorSchemes?.schemes).slice(0, SCHEME_LIMIT);
  const out: ColorScheme[] = [];
  for (let i = 0; i < SCHEME_LIMIT; i++) {
    const raw = isPlainObject(stored[i]) ? (stored[i] as Record<string, unknown>) : {};
    const fallback = DEFAULT_COLOR_SCHEMES[i] ?? DEFAULT_COLOR_SCHEMES[0];
    const id = str(raw.id, 24) || fallback.id;
    out.push({
      id,
      name: str(raw.name, 40) || fallback.name,
      colors: normalizeColors(raw.colors, fallback.colors),
    });
  }
  return out;
}

/** Which scheme each section type falls back to when nothing is configured
 *  (default arrangement: header & footer share one scheme, the announcement
 *  bar pops on its own, and body text uses a separate base scheme). */
export const SCHEME_FALLBACK: Record<string, string> = {
  announcement: 'scheme-4',
  header: 'scheme-2',
  hero: 'scheme-3',
  features: 'scheme-1',
  featuredProducts: 'scheme-3',
  productGrid: 'scheme-3',
  productCards: 'scheme-3',
  richText: 'scheme-1',
  imageWithText: 'scheme-1',
  faq: 'scheme-1',
  footer: 'scheme-2', // same as header — one shared scheme by design
};

/**
 * Resolve the scheme id for a section:
 *   1. the section's own `settings.schemeId`,
 *   2. the chrome preference (cfg.announcement.schemeId, cfg.header.schemeId…),
 *   3. the per-type fallback (announcement→scheme-1, …, footer→scheme-5).
 */
export function resolveSchemeId(
  cfg: StoreCustomization,
  key: string,
  sectionSettings?: Record<string, unknown> | null,
): string {
  const schemes = getSchemes(cfg);
  const ids = new Set(schemes.map((s) => s.id));
  const want = (value: unknown): string | null => {
    const id = str(value, 24);
    return id && ids.has(id) ? id : null;
  };
  const pick =
    want(sectionSettings?.schemeId) ??
    want((cfg as unknown as Record<string, unknown>)?.[key] &&
      isPlainObject((cfg as unknown as Record<string, unknown>)[key])
      ? ((cfg as unknown as Record<string, unknown>)[key] as Record<string, unknown>).schemeId
      : undefined) ??
    want(SCHEME_FALLBACK[key]) ??
    schemes[0].id;
  return pick;
}

/** Resolve the full normalized scheme for a section (never fails). */
export function schemeFor(
  cfg: StoreCustomization,
  key: string,
  sectionSettings?: Record<string, unknown> | null,
): ColorScheme {
  const want = resolveSchemeId(cfg, key, sectionSettings);
  return getSchemes(cfg).find((s) => s.id === want) ?? getSchemes(cfg)[0];
}

/** Style a wrapper element with the full scheme palette as CSS variables. */
export function schemeVars(scheme: ColorScheme): React.CSSProperties {
  return {
    ['--pk-scheme-bg' as string]: scheme.colors.background,
    ['--pk-scheme-text' as string]: scheme.colors.text,
    ['--pk-scheme-heading' as string]: scheme.colors.heading,
    ['--pk-scheme-accent' as string]: scheme.colors.accent,
    ['--pk-scheme-button' as string]: scheme.colors.button,
    ['--pk-scheme-button-text' as string]: scheme.colors.buttonText,
    ['--pk-scheme-secondary-button' as string]: scheme.colors.secondaryButton,
    ['--pk-scheme-secondary-button-text' as string]: scheme.colors.secondaryButtonText,
    ['--pk-scheme-border' as string]: scheme.colors.border,
  } as React.CSSProperties;
}

/* ---------------------------------------------------------------------------
 * Theme-level design tokens (fonts, radius, layouts) — what makes each of the
 * six themes structurally different, not just colored differently.
 * ------------------------------------------------------------------------ */

export type FontChoice = 'system' | 'serif' | 'grotesk' | 'rounded' | 'mono' | 'slab';

export const FONT_CHOICES: Array<{ value: FontChoice; label: string }> = [
  { value: 'system', label: 'System sans' },
  { value: 'grotesk', label: 'Grotesk' },
  { value: 'serif', label: 'Serif' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'slab', label: 'Slab' },
  { value: 'mono', label: 'Monospace' },
];

/** websafe stacks only — themes must not depend on downloaded webfonts. */
export const FONT_STACKS: Record<FontChoice, string> = {
  system: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  grotesk: "'Helvetica Neue', 'Segoe UI', Arial, sans-serif",
  serif: "Georgia, 'Iowan Old Style', 'Times New Roman', Times, serif",
  rounded: "'Trebuchet MS', 'Avenir Next', Avenir, 'Segoe UI', sans-serif",
  mono: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, 'Liberation Mono', monospace",
  slab: "Rockwell, 'Courier Bold', Courier, Georgia, serif",
};

export function fontStack(choice?: string, fallback: FontChoice = 'system'): string {
  const key = (FONT_CHOICES.find((f) => f.value === choice)?.value ?? fallback) as FontChoice;
  return FONT_STACKS[key];
}

export type HeroVariant = 'split' | 'overlay' | 'minimal' | 'banner' | 'editorial';

export type DesignStyle = {
  headingFont?: FontChoice;
  bodyFont?: FontChoice;
  /** base corner radius in px (cards, inputs, buttons without a shape of their own) */
  radius?: number;
  buttonShape?: 'pill' | 'rounded' | 'square';
  cardStyle?: 'shadow' | 'border' | 'flat';
  heroVariant?: HeroVariant;
  featuresVariant?: 'row' | 'cards' | 'pill';
  headerLayout?: 'classic' | 'centered';
  footerLayout?: 'classic' | 'compact';
  spacing?: 'compact' | 'normal' | 'roomy';
  uppercaseHeadings?: boolean;
};

const inSet = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export function resolveDesign(cfg?: StoreCustomization | null): Required<DesignStyle> {
  const s = isPlainObject(cfg?.style) ? (cfg!.style as Record<string, unknown>) : {};
  const radius = typeof s.radius === 'number' && Number.isFinite(s.radius) ? Math.min(40, Math.max(0, Math.round(s.radius))) : 12;
  return {
    headingFont: inSet<FontChoice>(s.headingFont, FONT_CHOICES.map((f) => f.value), 'system'),
    bodyFont: inSet<FontChoice>(s.bodyFont, FONT_CHOICES.map((f) => f.value), 'system'),
    radius,
    buttonShape: inSet(s.buttonShape, ['pill', 'rounded', 'square'] as const, 'rounded'),
    cardStyle: inSet(s.cardStyle, ['shadow', 'border', 'flat'] as const, 'shadow'),
    heroVariant: inSet(s.heroVariant, ['split', 'overlay', 'minimal', 'banner', 'editorial'] as const, 'split'),
    featuresVariant: inSet(s.featuresVariant, ['row', 'cards', 'pill'] as const, 'row'),
    headerLayout: inSet(s.headerLayout, ['classic', 'centered'] as const, 'classic'),
    footerLayout: inSet(s.footerLayout, ['classic', 'compact'] as const, 'classic'),
    spacing: inSet(s.spacing, ['compact', 'normal', 'roomy'] as const, 'normal'),
    uppercaseHeadings: s.uppercaseHeadings === true,
  };
}

const SPACING: Record<'compact' | 'normal' | 'roomy', string> = {
  compact: '2.5rem',
  normal: '3.5rem',
  roomy: '5.5rem',
};

/** Root-level design variables: fonts, radius, page background. */
export function themeVars(cfg?: StoreCustomization | null): React.CSSProperties {
  const design = resolveDesign(cfg);
  const schemes = getSchemes(cfg);
  return {
    ['--pk-font-heading' as string]: fontStack(design.headingFont),
    ['--pk-font-body' as string]: fontStack(design.bodyFont),
    ['--pk-radius' as string]: `${design.radius}px`,
    ['--pk-button-radius' as string]:
      design.buttonShape === 'pill' ? '999px' : design.buttonShape === 'square' ? '0px' : `${design.radius}px`,
    ['--pk-headings-case' as string]: design.uppercaseHeadings ? 'uppercase' : 'none',
    ['--pk-section-y' as string]: SPACING[design.spacing],
    // page background comes from scheme 1 so ordinary pages follow the palette
    ['--pk-page-bg' as string]: schemes[0].colors.background,
    // card tokens — cardStyle controls outline/flat/shadow rendering
    ['--pk-card-border' as string]:
      design.cardStyle === 'flat' ? 'transparent' : schemes[0].colors.border,
    ['--pk-card-shadow' as string]:
      design.cardStyle === 'shadow'
        ? '0 1px 3px rgba(15, 23, 42, 0.08), 0 8px 24px rgba(15, 23, 42, 0.06)'
        : 'none',
    // brand shortcuts for non-home pages (cart, track, order, product detail).
    // Derived purely from the theme's base color scheme — there is no separate
    // legacy Primary/Accent system anymore.
    ['--pk-primary' as string]: schemes[0].colors.button,
    ['--pk-accent' as string]: schemes[0].colors.accent,
  } as React.CSSProperties;
}

/* ---------------------------------------------------------------------------
 * Store customization contract
 * ------------------------------------------------------------------------ */

export type StoreCustomization = {
  branding: { logoUrl?: string; faviconUrl?: string; tagline?: string };
  /* The old `theme.primary/accent` color system has been REMOVED — all store
     colors now come from `colorSchemes`. Stored configs containing a legacy
     `theme` key are preserved but ignored by rendering. */
  colorSchemes?: { schemes: ColorScheme[] };
  style?: DesignStyle;
  announcement: { enabled?: boolean; text?: string; schemeId?: string };
  hero: {
    enabled?: boolean;
    badge?: string;
    title?: string;
    subtitle?: string;
    imageUrl?: string;
    ctaText?: string;
    ctaLink?: string;
    schemeId?: string;
  };
  sections: { showFeatures?: boolean; featuredCount?: number; aboutBlurb?: string };
  home: { sections: PkSection[] };
  navigation?: { header?: NavNode[]; footer?: NavNode[] };
  header: { menuLinks?: LinkRow[]; schemeId?: string; sticky?: boolean };
  footer: {
    aboutText?: string;
    quickLinks?: LinkRow[];
    schemeId?: string;
    social?: { whatsapp?: string; instagram?: string; facebook?: string; tiktok?: string };
    copyright?: string;
  };
  payments: { COD?: boolean; IBFT?: boolean; RAAST?: boolean; JAZZCASH?: boolean; EASYPAISA?: boolean };
  checkout: { confirmationMsg?: string; allowNotes?: boolean };
  seo: { metaTitle?: string; metaDescription?: string; blogTitle?: string; blogDescription?: string };
};

export const DEFAULT_CUSTOMIZATION: StoreCustomization = {
  branding: { logoUrl: '', faviconUrl: '', tagline: '' },
  colorSchemes: { schemes: DEFAULT_COLOR_SCHEMES },
  style: {
    headingFont: 'system',
    bodyFont: 'system',
    radius: 12,
    buttonShape: 'rounded',
    cardStyle: 'shadow',
    heroVariant: 'split',
    featuresVariant: 'row',
    headerLayout: 'classic',
    footerLayout: 'classic',
    spacing: 'normal',
    uppercaseHeadings: false,
  },
  announcement: {
    enabled: true,
    text: 'Nationwide Delivery to 100+ Cities · Cash on Delivery Available · 7-Day Exchange',
    schemeId: 'scheme-4',
  },
  hero: {
    enabled: true,
    badge: 'New Season · Summer Collection 2026',
    title: "Pakistan's Premium Unstitched Collection",
    subtitle:
      'Authentic lawn, cotton jacquard and festive silks with nationwide delivery — pay at your doorstep with Cash on Delivery.',
    imageUrl: '',
    ctaText: 'Shop the Collection',
    ctaLink: '/products',
    schemeId: 'scheme-3',
  },
  sections: { showFeatures: true, featuredCount: 8, aboutBlurb: '' },
  home: {
    sections: DEFAULT_HOME_SECTIONS.map((s) => ({ ...s, settings: { ...s.settings }, blocks: s.blocks.map((b) => ({ ...b, settings: { ...b.settings } })) })),
  },
  header: { menuLinks: [], schemeId: 'scheme-2' },
  footer: {
    aboutText:
      'Premium Pakistani unstitched fabrics — lawn, cotton jacquard and festive silks, delivered nationwide with COD.',
    quickLinks: [],
    schemeId: 'scheme-2',
    social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
    copyright: '',
  },
  payments: { COD: true, IBFT: true, RAAST: true, JAZZCASH: true, EASYPAISA: true },
  checkout: { confirmationMsg: '', allowNotes: true },
  seo: { metaTitle: '', metaDescription: '', blogTitle: '', blogDescription: '' },
};

/**
 * Recursively merge stored JSON over defaults:
 *  - every key present in the stored object is honored — INCLUDING keys the
 *    defaults do not know about (productPage, cart, pages, schemes, …). This
 *    is the root fix for the silent data loss where editor saves erased any
 *    stored block that predates the current feature set;
 *  - plain objects deep-merge; arrays, scalars and other types replace;
 *  - `navigation` keeps its strict server contract: only plain objects pass,
 *    anything else is dropped so legacy flat links keep rendering;
 *  - never mutates its inputs; the base object always wins for missing keys.
 */
function mergeStored(
  baseObj: Record<string, unknown>,
  overrideObj: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...baseObj };
  for (const [key, value] of Object.entries(overrideObj)) {
    if (value === undefined) continue;
    out[key] = isPlainObject(value) && isPlainObject(out[key])
      ? mergeStored(out[key], value)
      : value;
  }
  return out;
}

export function mergeStoreConfig(
  base: StoreCustomization,
  override?: Record<string, unknown> | null,
): StoreCustomization {
  if (!isPlainObject(override)) return base;
  const out = mergeStored(base as unknown as Record<string, unknown>, override);
  if (!isPlainObject(out.navigation)) delete out.navigation;
  return out as unknown as StoreCustomization;
}

/** Parse a raw configJson string safely (backend stores it as JSON text). */
export function parseStoreConfig(json?: string | null): StoreCustomization {
  if (!json) return DEFAULT_CUSTOMIZATION;
  try {
    const parsed = JSON.parse(json);
    return mergeStoreConfig(
      DEFAULT_CUSTOMIZATION,
      parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null,
    );
  } catch {
    return DEFAULT_CUSTOMIZATION;
  }
}

/** Message type the admin editor uses to push the draft into the preview iframe. */
export const PREVIEW_MESSAGE_TYPE = 'pk-preview-config' as const;

export type PreviewMessage = {
  type: typeof PREVIEW_MESSAGE_TYPE;
  config: StoreCustomization;
};
