'use client';

// Shared store configuration helpers for the Online Store section.
// The config shape matches what the storefront consumes via
// /store-settings — keep keys stable.

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
  header: { menuLinks?: LinkRow[] };
  footer: {
    aboutText?: string;
    quickLinks?: LinkRow[];
    social?: { whatsapp?: string; instagram?: string; facebook?: string; tiktok?: string };
    copyright?: string;
  };
  payments: { COD?: boolean; IBFT?: boolean; RAAST?: boolean; JAZZCASH?: boolean; EASYPAISA?: boolean };
  checkout: { confirmationMsg?: string; allowNotes?: boolean };
  seo: { metaTitle?: string; metaDescription?: string };
};

export const STORE_CONFIG_DEFAULTS: StoreCustomization = {
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
  seo: { metaTitle: '', metaDescription: '' },
};

export type StorePageRow = {
  id: string;
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  updatedAt: string;
};

/** Merge the stored config over the defaults so missing keys are always present. */
export function mergeStoreConfig(stored?: Record<string, unknown> | null): StoreCustomization {
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(STORE_CONFIG_DEFAULTS)) {
    merged[key] = {
      ...(STORE_CONFIG_DEFAULTS as any)[key],
      ...((stored as any)?.[key] ?? {}),
    };
  }
  return merged as unknown as StoreCustomization;
}

/** Apply a patch to one section, preserving everything else. */
export function patchSection<K extends keyof StoreCustomization>(
  config: StoreCustomization,
  section: K,
  patch: Partial<StoreCustomization[K]>,
): StoreCustomization {
  return {
    ...config,
    [section]: { ...(config[section] as Record<string, unknown>), ...(patch as Record<string, unknown>) },
  };
}
