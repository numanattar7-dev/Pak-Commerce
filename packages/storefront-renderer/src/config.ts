// ---------------------------------------------------------------------------
// Pak Commerce — shared theme configuration contract.
// Single source of truth for the customization shape persisted in
// StoreSettings.configJson. The admin editor and the public storefront both
// consume this module — do not duplicate these types or defaults.
// ---------------------------------------------------------------------------

import type { PkSection } from './sections';
import { DEFAULT_HOME_SECTIONS } from './sections';
import type { NavNode } from './navigation';

export type LinkRow = { label: string; href: string };

export type StoreCustomization = {
  branding: { logoUrl?: string; faviconUrl?: string; tagline?: string };
  theme: { primary?: string; accent?: string };
  announcement: { enabled?: boolean; text?: string };
  hero: {
    enabled?: boolean;
    badge?: string;
    title?: string;
    subtitle?: string;
    imageUrl?: string;
    ctaText?: string;
    ctaLink?: string;
  };
  sections: { showFeatures?: boolean; featuredCount?: number; aboutBlurb?: string };
  home: { sections: PkSection[] };
  navigation?: { header?: NavNode[]; footer?: NavNode[] };
  header: { menuLinks?: LinkRow[] };
  footer: {
    aboutText?: string;
    quickLinks?: LinkRow[];
    social?: { whatsapp?: string; instagram?: string; facebook?: string; tiktok?: string };
    copyright?: string;
  };
  payments: { COD?: boolean; IBFT?: boolean; RAAST?: boolean; JAZZCASH?: boolean; EASYPAISA?: boolean };
  checkout: { confirmationMsg?: string; allowNotes?: boolean };
  seo: { metaTitle?: string; metaDescription?: string; blogTitle?: string; blogDescription?: string };
};

export const DEFAULT_CUSTOMIZATION: StoreCustomization = {
  branding: { logoUrl: '', faviconUrl: '', tagline: '' },
  theme: { primary: '#059669', accent: '#0d9488' },
  announcement: {
    enabled: true,
    text: 'Nationwide Delivery to 100+ Cities · Cash on Delivery Available · 7-Day Exchange',
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
  },
  sections: { showFeatures: true, featuredCount: 8, aboutBlurb: '' },
  home: {
    sections: DEFAULT_HOME_SECTIONS.map((s) => ({ ...s, settings: { ...s.settings }, blocks: s.blocks.map((b) => ({ ...b, settings: { ...b.settings } })) })),
  },
  header: { menuLinks: [] },
  footer: {
    aboutText:
      'Premium Pakistani unstitched fabrics — lawn, cotton jacquard and festive silks, delivered nationwide with COD.',
    quickLinks: [],
    social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
    copyright: '',
  },
  payments: { COD: true, IBFT: true, RAAST: true, JAZZCASH: true, EASYPAISA: true },
  checkout: { confirmationMsg: '', allowNotes: true },
  seo: { metaTitle: '', metaDescription: '', blogTitle: '', blogDescription: '' },
};

/** Shallow-merge each top-level section over the defaults. */
export function mergeStoreConfig(
  base: StoreCustomization,
  override?: Record<string, unknown> | null,
): StoreCustomization {
  if (!override) return base;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(base)) {
    const o = override[key];
    if (o === undefined || o === null) {
      out[key] = (base as unknown as Record<string, unknown>)[key];
    } else if (typeof o === 'object' && !Array.isArray(o)) {
      out[key] = {
        ...((base as unknown as Record<string, unknown>)[key] as object),
        ...(o as object),
      };
    } else {
      out[key] = o;
    }
  }
  // `navigation` is optional and intentionally absent from the defaults so
  // legacy flat header/footer links keep rendering until menus are saved.
  if (override.navigation !== undefined) {
    const nav = override.navigation;
    out.navigation =
      nav && typeof nav === 'object' && !Array.isArray(nav) ? nav : undefined;
  }
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
