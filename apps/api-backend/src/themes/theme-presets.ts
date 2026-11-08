// ---------------------------------------------------------------------------
// Pak Commerce — bundled theme library presets.
//
// Follows Shopify's free theme library (Online Store → Themes → Theme
// library): every store ships with Shopify's well-known free themes so a
// merchant can preview, customize and publish any of them without code.
// Each preset mirrors the documented design language of its Shopify
// counterpart (Theme Store descriptions) inside the pakcommerce-theme@1
// config contract — design only, never products/orders/payments.
//
// | Shopify theme | Design language (per Shopify Theme Store)              |
// |---------------|---------------------------------------------------------|
// | Dawn          | Minimalist — lets product images take center stage       |
// | Refresh       | Clean & bold — headings draw attention, minimal palette  |
// | Craft         | Artisan/handmade — airy layout, storytelling             |
// | Taste         | Specialty food — industrial, high contrast               |
// | Sense         | Beauty & wellness — soft colors, rounded, warm           |
// | Ride          | Sports & outdoor — sporty, active, high contrast         |
//
// Presets are installed once per tenant (source = SYSTEM_LIBRARY).
// ---------------------------------------------------------------------------

export type ThemePreset = {
  name: string;
  description: string;
  /** Partial StoreCustomization — merged over defaults by the renderer. */
  config: Record<string, unknown>;
};

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

const homeSection = (
  id: string,
  type: string,
  settings: Record<string, unknown> = {},
  blocks: Array<Record<string, unknown>> = [],
) => ({ id, type, enabled: true, settings, blocks });

export const THEME_LIBRARY_PRESETS: ThemePreset[] = [
  // ── Dawn ────────────────────────────────────────────────────────────────
  {
    name: 'Dawn',
    description: 'Minimalist theme that lets product images take center stage.',
    config: {
      theme: { primary: '#121212', accent: '#5c5c5c' },
      announcement: {
        enabled: true,
        text: 'Free nationwide delivery · Cash on Delivery · 7-day exchange',
      },
      hero: {
        enabled: true,
        badge: 'New season',
        title: 'Simple. Timeless. Yours.',
        subtitle: 'A clean, minimalist storefront that puts your products first.',
        ctaText: 'Shop now',
        ctaLink: '/products',
      },
      sections: { showFeatures: true, featuredCount: 8, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features'),
          homeSection('home-featured', 'featuredProducts'),
        ],
      },
      footer: {
        aboutText: 'Minimal essentials, delivered nationwide with cash on delivery.',
      },
    },
  },

  // ── Refresh ─────────────────────────────────────────────────────────────
  {
    name: 'Refresh',
    description: 'Clean and bold — big headings and a minimal palette that draw attention to your story.',
    config: {
      theme: { primary: '#1d4ed8', accent: '#0f172a' },
      announcement: {
        enabled: true,
        text: 'New drops every week · Free returns within 7 days · COD available',
      },
      hero: {
        enabled: true,
        badge: 'Refresh your routine',
        title: 'Feel the difference from day one.',
        subtitle: 'Bold, honest products backed by thousands of five-star reviews.',
        ctaText: 'Discover',
        ctaLink: '/products',
      },
      sections: { showFeatures: true, featuredCount: 12, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features'),
          homeSection('home-featured', 'featuredProducts'),
          homeSection(
            'home-reviews',
            'richText',
            {
              heading: 'Loved by thousands',
              body: '“Ordered on Monday, delivered Wednesday — the quality exceeded what I expected from an online store.” — one of our many happy customers across Pakistan.',
              align: 'center',
            },
          ),
          { ...STANDARD_FAQ, settings: { heading: 'Good to know' } },
        ],
      },
      footer: {
        aboutText: 'Clean, effective products — delivered nationwide with cash on delivery.',
      },
    },
  },

  // ── Craft ───────────────────────────────────────────────────────────────
  {
    name: 'Craft',
    description: 'Airy, editorial layout built for handmade goods and storytelling.',
    config: {
      theme: { primary: '#92400e', accent: '#b45309' },
      announcement: {
        enabled: true,
        text: 'Handmade in small batches · Ships in 2–4 days · COD available',
      },
      hero: {
        enabled: true,
        badge: 'Made by hand',
        title: 'Made by hand. Meant to last.',
        subtitle: 'Small-batch pieces with generous space for the story behind every item.',
        ctaText: 'Explore the collection',
        ctaLink: '/products',
      },
      sections: { showFeatures: true, featuredCount: 6, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection(
            'home-story',
            'richText',
            {
              heading: 'The hands behind the work',
              body: 'Every piece is made in small batches by skilled artisans, then checked by hand before it is packed for your doorstep.',
              align: 'left',
            },
          ),
          homeSection('home-features', 'features'),
          homeSection('home-featured', 'featuredProducts'),
          { ...STANDARD_FAQ, settings: { heading: 'Questions about your order' } },
        ],
      },
      footer: {
        aboutText: 'Small-batch handmade goods — crafted with care, delivered nationwide.',
      },
    },
  },

  // ── Taste ───────────────────────────────────────────────────────────────
  {
    name: 'Taste',
    description: 'Industrial, high-contrast look made for specialty food and drink brands.',
    config: {
      theme: { primary: '#b91c1c', accent: '#111827' },
      announcement: {
        enabled: true,
        text: 'Freshly packed daily · Nationwide delivery · Cash on Delivery',
      },
      hero: {
        enabled: true,
        badge: 'Fresh batch',
        title: 'Bold flavour. No compromises.',
        subtitle: 'Specialty pantry staples packed fresh and shipped straight to your door.',
        ctaText: 'Order now',
        ctaLink: '/products',
      },
      sections: { showFeatures: true, featuredCount: 10, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features'),
          homeSection('home-featured', 'featuredProducts'),
          homeSection(
            'home-kitchen',
            'richText',
            {
              heading: 'From our kitchen to yours',
              body: 'High-contrast, honest packaging and ingredients you can read — the way good food should be.',
              align: 'center',
            },
          ),
        ],
      },
      footer: {
        aboutText: 'Specialty food and pantry goods — packed fresh, delivered nationwide.',
      },
    },
  },

  // ── Sense ───────────────────────────────────────────────────────────────
  {
    name: 'Sense',
    description: 'Soft colors and rounded, warm styling for beauty and wellness brands.',
    config: {
      theme: { primary: '#be185d', accent: '#9333ea' },
      announcement: {
        enabled: true,
        text: 'Gentle on skin · Dermatologist tested · Free delivery over Rs. 3,000',
      },
      hero: {
        enabled: true,
        badge: 'Everyday care',
        title: 'Soft care for everyday skin.',
        subtitle: 'Gentle formulas and warm, honest routines — for skin that feels looked after.',
        ctaText: 'Shop care',
        ctaLink: '/products',
      },
      sections: { showFeatures: true, featuredCount: 8, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection(
            'home-ritual',
            'richText',
            {
              heading: 'Your daily ritual',
              body: 'Simple steps, soft textures, and scents that make the everyday feel a little kinder.',
              align: 'center',
            },
          ),
          homeSection('home-features', 'features'),
          homeSection('home-featured', 'featuredProducts'),
          { ...STANDARD_FAQ, settings: { heading: 'Care questions' } },
        ],
      },
      footer: {
        aboutText: 'Beauty and wellness essentials — gentle care, delivered nationwide.',
      },
    },
  },

  // ── Ride ────────────────────────────────────────────────────────────────
  {
    name: 'Ride',
    description: 'Sporty, high-contrast theme for active, outdoor and fitness brands.',
    config: {
      theme: { primary: '#111827', accent: '#facc15' },
      announcement: {
        enabled: true,
        text: 'Built for the long run · Fast nationwide shipping · COD available',
      },
      hero: {
        enabled: true,
        badge: 'Gear up',
        title: 'Built for movement.',
        subtitle: 'High-performance gear for the ride, the run and everything in between.',
        ctaText: 'Get geared up',
        ctaLink: '/products',
      },
      sections: { showFeatures: true, featuredCount: 8, aboutBlurb: '' },
      home: {
        sections: [
          homeSection('home-hero', 'hero'),
          homeSection('home-features', 'features'),
          homeSection('home-featured', 'featuredProducts'),
          homeSection(
            'home-move',
            'richText',
            {
              heading: 'Outlast every mile',
              body: 'Sweat-ready, trail-tested, delivery-fast — gear that keeps up with you.',
              align: 'left',
            },
          ),
        ],
      },
      footer: {
        aboutText: 'Sport and outdoor gear — built for movement, delivered nationwide.',
      },
    },
  },
];
