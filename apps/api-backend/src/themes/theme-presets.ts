// ---------------------------------------------------------------------------
// Pak Commerce — bundled theme library presets (v2 — unique designs).
//
// Follows Shopify's free theme library (Online Store → Themes → Theme
// library): every store ships with Shopify's well-known free themes so a
// merchant can preview, customize and publish any of them without code.
//
// v2 contract — what makes each theme GENUINELY unique (not color swaps):
//   • 5 fully-populated color schemes (background/text/heading/accent/button/
//     button-text/secondary-button/secondary-button-text/border)
//   • design tokens: fonts, radius, button shape, card style, hero layout
//     (split/overlay/minimal/banner/editorial), features layout (row/cards/
//     pill), header layout (classic/centered), footer layout (classic/
//     compact), section spacing, heading case
//   • a different SECTION COMPOSITION per theme — order, section types and
//     per-section color-scheme assignments all differ
//   • unique copy per theme
//
// | Shopify theme | Design language (per Shopify Theme Store)              |
// |---------------|---------------------------------------------------------|
// | Dawn          | Minimalist — sharp corners, centered, let products lead |
// | Refresh       | Clean & bold — big headings, pill buttons, blue accent  |
// | Craft         | Artisan/handmade — serif editorial, warm linen tones    |
// | Taste         | Specialty food — industrial slab type, banner + red     |
// | Sense         | Beauty & wellness — soft rose, rounded, overlay hero    |
// | Ride          | Sports & outdoor — dark overlay hero, yellow highlight  |
//
// Scheme assignments per theme:
//   announcement → scheme-4 (popping bar)
//   header & footer → scheme-2 (shared scheme, per merchant request)
//   hero/features/etc → vary per theme
//
// Presets are installed once per tenant (source = SYSTEM_LIBRARY). Themes in
// existing stores whose stored config still matches the ORIGINAL v1 presets
// (../theme-presets-v1) are auto-upgraded to these designs by the service.
// ---------------------------------------------------------------------------

const scheme = (
  id: string,
  name: string,
  background: string,
  text: string,
  heading: string,
  accent: string,
  button: string,
  buttonText: string,
  secondaryButton: string,
  secondaryButtonText: string,
  border: string,
) => ({
  id,
  name,
  colors: { background, text, heading, accent, button, buttonText, secondaryButton, secondaryButtonText, border },
});

const colorSchemes = (list: ReturnType<typeof scheme>[]) => ({ schemes: list });

const homeSection = (
  id: string,
  type: string,
  settings: Record<string, unknown> = {},
  blocks: Array<Record<string, unknown>> = [],
) => ({ id, type, enabled: true, settings, blocks });

const STANDARD_FAQ = {
  id: 'home-faq',
  type: 'faq',
  enabled: true,
  settings: { heading: 'Frequently asked questions' },
  blocks: [
    {
      id: 'faq-cod',
      enabled: true,
      settings: {
        question: 'Do you offer Cash on Delivery?',
        answer: 'Yes — pay in cash at your doorstep anywhere in Pakistan.',
      },
    },
    {
      id: 'faq-delivery',
      enabled: true,
      settings: {
        question: 'How long does delivery take?',
        answer: 'Karachi, Lahore, Islamabad: 1–3 days. Other cities: 3–5 days.',
      },
    },
    {
      id: 'faq-exchange',
      enabled: true,
      settings: {
        question: 'Can I exchange my order?',
        answer: 'Yes — 7-day exchange on unworn items with original packing.',
      },
    },
  ],
};

export type ThemePreset = {
  name: string;
  description: string;
  /** Partial StoreCustomization — merged over defaults by the renderer. */
  config: Record<string, unknown>;
};

export const THEME_LIBRARY_PRESETS: ThemePreset[] = [
  // ── Dawn — minimalist, sharp, centered, lets products lead ──────────────
  {
    name: 'Dawn',
    description: 'Minimalist theme that lets product images take center stage.',
    config: {
      colorSchemes: colorSchemes([
        scheme('scheme-1', 'Base', '#ffffff', '#121212', '#111111', '#121212', '#121212', '#ffffff', '#ffffff', '#121212', '#e5e5e5'),
        scheme('scheme-2', 'Light gray', '#f7f7f7', '#3f3f46', '#111111', '#52525b', '#27272a', '#ffffff', '#f7f7f7', '#27272a', '#e4e4e7'),
        scheme('scheme-3', 'White', '#ffffff', '#27272a', '#111111', '#121212', '#18181b', '#ffffff', '#fafafa', '#18181b', '#f0f0f0'),
        scheme('scheme-4', 'Inverse', '#121212', '#f5f5f5', '#ffffff', '#a1a1aa', '#ffffff', '#121212', '#262626', '#f5f5f5', '#404040'),
        scheme('scheme-5', 'Silver', '#e5e7eb', '#3f3f46', '#18181b', '#121212', '#18181b', '#ffffff', '#e5e7eb', '#18181b', '#d4d4d8'),
      ]),
      style: {
        headingFont: 'system',
        bodyFont: 'system',
        radius: 0,
        buttonShape: 'square',
        cardStyle: 'border',
        heroVariant: 'minimal',
        featuresVariant: 'row',
        headerLayout: 'centered',
        footerLayout: 'compact',
        spacing: 'normal',
        uppercaseHeadings: false,
      },
      announcement: {
        enabled: true,
        text: 'Free nationwide delivery · Cash on Delivery · 7-day exchange',
        schemeId: 'scheme-4',
      },
      hero: {
        enabled: true,
        badge: 'New season',
        title: 'Simple. Timeless. Yours.',
        subtitle: 'A clean, minimalist storefront that puts your products first.',
        imageUrl: '',
        ctaText: 'Shop now',
        ctaLink: '/products',
        schemeId: 'scheme-1',
      },
      sections: { showFeatures: true, featuredCount: 8, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features', { schemeId: 'scheme-2' }),
          homeSection('home-featured', 'featuredProducts', { schemeId: 'scheme-3' }),
          homeSection('home-detail', 'imageWithText', {
            imageUrl: '',
            heading: 'Nothing extra. Everything essential.',
            body: 'Clean silhouettes, honest fabrics and a storefront with no clutter — the product speaks for itself.',
            ctaText: '',
            ctaLink: '/products',
            imageSide: 'right',
            schemeId: 'scheme-3',
          }),
          { ...STANDARD_FAQ, settings: { heading: 'Frequently asked questions', schemeId: 'scheme-1' } },
        ],
      },
      header: { menuLinks: [], schemeId: 'scheme-2' },
      footer: {
        aboutText: 'Minimal essentials, delivered nationwide with cash on delivery.',
        quickLinks: [],
        schemeId: 'scheme-2',
        social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
      },
    },
  },

  // ── Refresh — clean and bold, blue statement, pill buttons ──────────────
  {
    name: 'Refresh',
    description: 'Clean and bold — big headings and a minimal palette that draw attention to your story.',
    config: {
      colorSchemes: colorSchemes([
        scheme('scheme-1', 'Base', '#ffffff', '#1e293b', '#0f172a', '#1d4ed8', '#1d4ed8', '#ffffff', '#ffffff', '#1e40af', '#dbeafe'),
        scheme('scheme-2', 'Cool', '#eff6ff', '#1e3a8a', '#0f172a', '#2563eb', '#1e40af', '#ffffff', '#ffffff', '#1e40af', '#bfdbfe'),
        scheme('scheme-3', 'Statement', '#1d4ed8', '#eff6ff', '#ffffff', '#93c5fd', '#ffffff', '#1d4ed8', '#1e40af', '#eff6ff', '#91b4f4'),
        scheme('scheme-4', 'Navy', '#0f172a', '#e2e8f0', '#ffffff', '#60a5fa', '#eff6ff', '#1e3a8a', '#1e293b', '#e2e8f0', '#27364b'),
        scheme('scheme-5', 'Slate', '#e2e8f0', '#2f3e53', '#0f172a', '#2563eb', '#1e40af', '#ffffff', '#e2e8f0', '#1e40af', '#cbd5e1'),
      ]),
      style: {
        headingFont: 'grotesk',
        bodyFont: 'system',
        radius: 8,
        buttonShape: 'pill',
        cardStyle: 'shadow',
        heroVariant: 'split',
        featuresVariant: 'cards',
        headerLayout: 'classic',
        footerLayout: 'classic',
        spacing: 'roomy',
        uppercaseHeadings: true,
      },
      announcement: {
        enabled: true,
        text: 'New drops every week · Free returns within 7 days · COD available',
        schemeId: 'scheme-4',
      },
      hero: {
        enabled: true,
        badge: 'Refresh your routine',
        title: 'Feel the difference from day one.',
        subtitle: 'Bold, honest products backed by thousands of five-star reviews.',
        imageUrl: '',
        ctaText: 'Discover',
        ctaLink: '/products',
        schemeId: 'scheme-2',
      },
      sections: { showFeatures: true, featuredCount: 12, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features', { schemeId: 'scheme-1' }),
          homeSection('home-featured', 'featuredProducts', { schemeId: 'scheme-1' }),
          homeSection('home-hot', 'productCards', {
            limit: 4,
            scroll: 'horizontal',
            viewAll: true,
            schemeId: 'scheme-4',
          }),
          homeSection('home-reviews', 'richText', {
            heading: 'Loved by thousands',
            body: '“Ordered on Monday, delivered Wednesday — the quality exceeded what I expected from an online store.” — one of our many happy customers across Pakistan.',
            align: 'center',
            schemeId: 'scheme-3',
          }),
          { ...STANDARD_FAQ, settings: { heading: 'Good to know', schemeId: 'scheme-5' } },
        ],
      },
      header: { menuLinks: [], schemeId: 'scheme-2' },
      footer: {
        aboutText: 'Clean, effective products — delivered nationwide with cash on delivery.',
        quickLinks: [],
        schemeId: 'scheme-2',
        social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
      },
    },
  },

  // ── Craft — artisan serif editorial, warm linen tones ───────────────────
  {
    name: 'Craft',
    description: 'Airy, editorial layout built for handmade goods and storytelling.',
    config: {
      colorSchemes: colorSchemes([
        scheme('scheme-1', 'Linen', '#faf6f0', '#44403c', '#292524', '#b45309', '#92400e', '#ffffff', '#ffffff', '#92400e', '#e7ddcf'),
        scheme('scheme-2', 'Sand', '#f3ebe1', '#57534e', '#292524', '#d97706', '#92400e', '#ffffff', '#faf6f0', '#92400e', '#ddcdba'),
        scheme('scheme-3', 'Clay', '#f0e4d3', '#57534e', '#431407', '#c2410c', '#7c2d12', '#fdf8f1', '#fdf8f1', '#7c2d12', '#d6bfa4'),
        scheme('scheme-4', 'Chestnut', '#3b2314', '#f5ead9', '#ffffff', '#d97706', '#faf5ea', '#3b2314', '#5b3a24', '#f5ead9', '#6b4a2f'),
        scheme('scheme-5', 'Ivory', '#fbf8f3', '#57534e', '#292524', '#b45309', '#a1521d', '#ffffff', '#fbf8f3', '#a1521d', '#e8dfd2'),
      ]),
      style: {
        headingFont: 'serif',
        bodyFont: 'system',
        radius: 4,
        buttonShape: 'rounded',
        cardStyle: 'flat',
        heroVariant: 'editorial',
        featuresVariant: 'pill',
        headerLayout: 'classic',
        footerLayout: 'classic',
        spacing: 'roomy',
        uppercaseHeadings: false,
      },
      announcement: {
        enabled: true,
        text: 'Handmade in small batches · Ships in 2–4 days · COD available',
        schemeId: 'scheme-4',
      },
      hero: {
        enabled: true,
        badge: 'Made by hand',
        title: 'Made by hand. Meant to last.',
        subtitle: 'Small-batch pieces with generous space for the story behind every item.',
        imageUrl: '',
        ctaText: 'Explore the collection',
        ctaLink: '/products',
        schemeId: 'scheme-3',
      },
      sections: { showFeatures: true, featuredCount: 6, aboutBlurb: 'Made in small batches — checked by hand' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-story', 'richText', {
            heading: 'The hands behind the work',
            body: 'Every piece is made in small batches by skilled artisans, then checked by hand before it is packed for your doorstep.',
            align: 'left',
            schemeId: 'scheme-1',
          }),
          homeSection('home-features', 'features', { schemeId: 'scheme-5' }),
          homeSection('home-featured', 'featuredProducts', { schemeId: 'scheme-1' }),
          homeSection('home-collection', 'productGrid', {
            heading: 'The collection',
            subheading: 'Each piece is photographed the way it ships — natural light, no filters.',
            limit: 8,
            columns: '3',
            viewAll: true,
            schemeId: 'scheme-2',
          }),
          { ...STANDARD_FAQ, settings: { heading: 'Questions about your order', schemeId: 'scheme-3' } },
        ],
      },
      header: { menuLinks: [], schemeId: 'scheme-2' },
      footer: {
        aboutText: 'Small-batch handmade goods — crafted with care, delivered nationwide.',
        quickLinks: [],
        schemeId: 'scheme-2',
        social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
      },
    },
  },

  // ── Taste — industrial high-contrast food, banner hero, red ─────────────
  {
    name: 'Taste',
    description: 'Industrial, high-contrast look made for specialty food and drink brands.',
    config: {
      colorSchemes: colorSchemes([
        scheme('scheme-1', 'Base', '#fffaf3', '#1c1917', '#111827', '#b91c1c', '#111827', '#ffffff', '#ffffff', '#111827', '#e7e5e4'),
        scheme('scheme-2', 'Paper', '#f5f5f4', '#292524', '#111827', '#b91c1c', '#1c1917', '#ffffff', '#f5f5f4', '#1c1917', '#e0dcd8'),
        scheme('scheme-3', 'Tomato', '#b91c1c', '#fff7f1', '#ffffff', '#fca5a5', '#ffffff', '#b91c1c', '#7f1d1d', '#fff7f1', '#dc6f6f'),
        scheme('scheme-4', 'Charcoal', '#1c1917', '#e7e5e4', '#ffffff', '#f87171', '#f5f5f4', '#1c1917', '#292524', '#e7e5e4', '#3f3a36'),
        scheme('scheme-5', 'Stamp', '#292524', '#fafaf9', '#ffffff', '#f87171', '#fafaf9', '#292524', '#3a3532', '#fafaf9', '#453f3b'),
      ]),
      style: {
        headingFont: 'slab',
        bodyFont: 'system',
        radius: 0,
        buttonShape: 'square',
        cardStyle: 'border',
        heroVariant: 'banner',
        featuresVariant: 'pill',
        headerLayout: 'classic',
        footerLayout: 'classic',
        spacing: 'compact',
        uppercaseHeadings: true,
      },
      announcement: {
        enabled: true,
        text: 'Freshly packed daily · Nationwide delivery · Cash on Delivery',
        schemeId: 'scheme-4',
      },
      hero: {
        enabled: true,
        badge: 'Fresh batch',
        title: 'Bold flavour. No compromises.',
        subtitle: 'Specialty pantry staples packed fresh and shipped straight to your door.',
        imageUrl: '',
        ctaText: 'Order now',
        ctaLink: '/products',
        schemeId: 'scheme-3',
      },
      sections: { showFeatures: true, featuredCount: 10, aboutBlurb: 'Bestsellers of the week' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features', { schemeId: 'scheme-2' }),
          homeSection('home-featured', 'featuredProducts', { schemeId: 'scheme-1' }),
          homeSection('home-pantry', 'productGrid', {
            heading: 'Pantry favourites',
            subheading: '',
            limit: 8,
            columns: '4',
            viewAll: true,
            schemeId: 'scheme-2',
          }),
          homeSection('home-kitchen', 'richText', {
            heading: 'From our kitchen to yours',
            body: 'High-contrast, honest packaging and ingredients you can read — the way good food should be.',
            align: 'center',
            schemeId: 'scheme-4',
          }),
          homeSection('home-fresh', 'productCards', {
            limit: 4,
            scroll: 'horizontal',
            viewAll: true,
            schemeId: 'scheme-1',
          }),
        ],
      },
      header: { menuLinks: [], schemeId: 'scheme-2' },
      footer: {
        aboutText: 'Specialty food and pantry goods — packed fresh, delivered nationwide.',
        quickLinks: [],
        schemeId: 'scheme-2',
        social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
      },
    },
  },

  // ── Sense — soft rounded beauty, rose tones, overlay hero ───────────────
  {
    name: 'Sense',
    description: 'Soft colors and rounded, warm styling for beauty and wellness brands.',
    config: {
      colorSchemes: colorSchemes([
        scheme('scheme-1', 'Base', '#fffafb', '#3f3f46', '#831843', '#be185d', '#be185d', '#ffffff', '#ffffff', '#831843', '#f3d7e3'),
        scheme('scheme-2', 'Blush', '#fdf2f7', '#6b4553', '#500724', '#ec4899', '#be185d', '#ffffff', '#fffafb', '#be185d', '#f0d3e0'),
        scheme('scheme-3', 'Rose', '#fce7ef', '#6d1f33', '#be185d', '#ec4899', '#be185d', '#ffffff', '#fff5f9', '#9d174d', '#eec5d7'),
        scheme('scheme-4', 'Plum', '#3f1339', '#f6e7ef', '#ffffff', '#f9a8d4', '#fde8ef', '#581c87', '#581952', '#f6e7ef', '#5d2a56'),
        scheme('scheme-5', 'Lilac', '#f7f3fb', '#533f66', '#3b0764', '#c026d3', '#a21caf', '#ffffff', '#f7f3fb', '#a21caf', '#e4d6ef'),
      ]),
      style: {
        headingFont: 'rounded',
        bodyFont: 'system',
        radius: 24,
        buttonShape: 'pill',
        cardStyle: 'shadow',
        heroVariant: 'overlay',
        featuresVariant: 'pill',
        headerLayout: 'centered',
        footerLayout: 'classic',
        spacing: 'roomy',
        uppercaseHeadings: false,
      },
      announcement: {
        enabled: true,
        text: 'Gentle on skin · Dermatologist tested · Free delivery over Rs. 3,000',
        schemeId: 'scheme-4',
      },
      hero: {
        enabled: true,
        badge: 'Everyday care',
        title: 'Soft care for everyday skin.',
        subtitle: 'Gentle formulas and warm, honest routines — for skin that feels looked after.',
        imageUrl: '',
        ctaText: 'Shop care',
        ctaLink: '/products',
        schemeId: 'scheme-3',
      },
      sections: { showFeatures: true, featuredCount: 8, aboutBlurb: 'Everyday care, hand-picked' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features', { schemeId: 'scheme-1' }),
          homeSection('home-featured', 'featuredProducts', { schemeId: 'scheme-4' }),
          homeSection('home-ritual', 'richText', {
            heading: 'Your daily ritual',
            body: 'Simple steps, soft textures, and scents that make the everyday feel a little kinder.',
            align: 'center',
            schemeId: 'scheme-1',
          }),
          homeSection('home-new', 'productCards', {
            limit: 4,
            scroll: 'grid',
            viewAll: false,
            schemeId: 'scheme-2',
          }),
          { ...STANDARD_FAQ, settings: { heading: 'Care questions', schemeId: 'scheme-1' } },
        ],
      },
      header: { menuLinks: [], schemeId: 'scheme-2' },
      footer: {
        aboutText: 'Beauty and wellness essentials — gentle care, delivered nationwide.',
        quickLinks: [],
        schemeId: 'scheme-2',
        social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
      },
    },
  },

  // ── Ride — sporty dark overlay hero, yellow highlight ───────────────────
  {
    name: 'Ride',
    description: 'Sporty, high-contrast theme for active, outdoor and fitness brands.',
    config: {
      colorSchemes: colorSchemes([
        scheme('scheme-1', 'Base', '#ffffff', '#1f2937', '#111827', '#eab308', '#111827', '#ffffff', '#ffffff', '#111827', '#e5e7eb'),
        scheme('scheme-2', 'Steel', '#f1f5f9', '#334155', '#0b1220', '#eab308', '#1f2937', '#ffffff', '#f1f5f9', '#1f2937', '#d8dee7'),
        scheme('scheme-3', 'Midnight', '#111827', '#f9fafb', '#ffffff', '#facc15', '#facc15', '#111827', '#1f2937', '#f9fafb', '#2c3a4f'),
        scheme('scheme-4', 'Highlight', '#facc15', '#111827', '#111827', '#111827', '#111827', '#facc15', '#fef3c7', '#111827', '#d9b412'),
        scheme('scheme-5', 'Carbon', '#0b0f17', '#e5e7eb', '#ffffff', '#facc15', '#facc15', '#0b0f17', '#161d29', '#e5e7eb', '#232c3b'),
      ]),
      style: {
        headingFont: 'grotesk',
        bodyFont: 'system',
        radius: 4,
        buttonShape: 'rounded',
        cardStyle: 'shadow',
        heroVariant: 'overlay',
        featuresVariant: 'row',
        headerLayout: 'classic',
        footerLayout: 'classic',
        spacing: 'compact',
        uppercaseHeadings: true,
      },
      announcement: {
        enabled: true,
        text: 'Built for the long run · Fast nationwide shipping · COD available',
        schemeId: 'scheme-4',
      },
      hero: {
        enabled: true,
        badge: 'Gear up',
        title: 'Built for movement.',
        subtitle: 'High-performance gear for the ride, the run and everything in between.',
        imageUrl: '',
        ctaText: 'Get geared up',
        ctaLink: '/products',
        schemeId: 'scheme-3',
      },
      sections: { showFeatures: true, featuredCount: 8, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features', { schemeId: 'scheme-2' }),
          homeSection('home-featured', 'featuredProducts', { schemeId: 'scheme-1' }),
          homeSection('home-kit', 'productGrid', {
            heading: 'Kit essentials',
            subheading: 'Trail-tested layers and carry — picked for the season.',
            limit: 6,
            columns: '3',
            viewAll: true,
            schemeId: 'scheme-2',
          }),
          homeSection('home-move', 'richText', {
            heading: 'Outlast every mile',
            body: 'Sweat-ready, trail-tested, delivery-fast — gear that keeps up with you.',
            align: 'left',
            schemeId: 'scheme-5',
          }),
          { ...STANDARD_FAQ, settings: { heading: 'Frequently asked questions', schemeId: 'scheme-2' } },
        ],
      },
      header: { menuLinks: [], schemeId: 'scheme-2' },
      footer: {
        aboutText: 'Sport and outdoor gear — built for movement, delivered nationwide.',
        quickLinks: [],
        schemeId: 'scheme-2',
        social: { whatsapp: '', instagram: '', facebook: '', tiktok: '' },
      },
    },
  },
];
