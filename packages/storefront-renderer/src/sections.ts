// ---------------------------------------------------------------------------
// Pak Commerce — section & block registry.
// Declarative definitions for every home section type. The admin editor renders
// its forms from these definitions; the storefront renders content from the
// same definitions. Add a new section type here, and it works in both.
// ---------------------------------------------------------------------------

import { asArray, isPlainObject, str } from './internal';

export type PkSectionType =
  | 'hero'
  | 'features'
  | 'featuredProducts'
  | 'richText'
  | 'imageWithText'
  | 'faq';

export type FieldType = 'text' | 'textarea' | 'number' | 'toggle' | 'select' | 'image';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  rows?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface PkBlock {
  id: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface PkSection {
  id: string;
  type: PkSectionType;
  enabled: boolean;
  settings: Record<string, unknown>;
  blocks: PkBlock[];
}

export interface SectionDef {
  type: PkSectionType;
  label: string;
  description: string;
  /** singular sections can appear at most once on the homepage */
  singular: boolean;
  /** settings fields editable in the editor (empty = configured elsewhere) */
  settings: FieldDef[];
  /** optional repeatable child blocks */
  block?: {
    label: string;
    singularLabel: string;
    /** minimum blocks that make the section meaningful */
    min: number;
    fields: FieldDef[];
  };
  defaultSettings?: Record<string, unknown>;
  defaultBlocks?: Array<Record<string, unknown>>;
}

export const SECTION_REGISTRY: Record<PkSectionType, SectionDef> = {
  hero: {
    type: 'hero',
    label: 'Hero banner',
    description: 'Full-width storefront intro with headline, badge and CTA.',
    singular: true,
    settings: [], // edited via the "Hero" group (legacy cfg.hero keys)
  },
  features: {
    type: 'features',
    label: 'Feature highlights',
    description: 'Four trust badges: delivery, COD, exchange, WhatsApp support.',
    singular: true,
    settings: [], // toggled via the "Home sections" legacy toggle
  },
  featuredProducts: {
    type: 'featuredProducts',
    label: 'Featured products',
    description: 'Grid of products pulled live from your catalog.',
    singular: true,
    settings: [], // count / blurb edited via legacy cfg.sections keys
  },
  richText: {
    type: 'richText',
    label: 'Rich text',
    description: 'A heading and free-form text block — brand story, announcements, notes.',
    singular: false,
    defaultSettings: { heading: 'Our story', body: 'Write something meaningful about your brand…', align: 'center' },
    settings: [
      { key: 'heading', label: 'Heading', type: 'text', placeholder: 'Our story' },
      { key: 'body', label: 'Body', type: 'textarea', rows: 4, placeholder: 'Write something meaningful…' },
      {
        key: 'align',
        label: 'Alignment',
        type: 'select',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'center', label: 'Center' },
        ],
      },
    ],
  },
  imageWithText: {
    type: 'imageWithText',
    label: 'Image with text',
    description: 'Image alongside a heading, copy and optional button.',
    singular: false,
    defaultSettings: {
      imageUrl: '',
      heading: 'Quality you can trust',
      body: 'Locally sourced, hand-checked and delivered nationwide with cash on delivery.',
      ctaText: '',
      ctaLink: '/products',
      imageSide: 'left',
    },
    settings: [
      { key: 'imageUrl', label: 'Image', type: 'image' },
      { key: 'heading', label: 'Heading', type: 'text' },
      { key: 'body', label: 'Body', type: 'textarea', rows: 3 },
      { key: 'ctaText', label: 'Button text (optional)', type: 'text', placeholder: 'Shop now' },
      { key: 'ctaLink', label: 'Button link', type: 'text', placeholder: '/products' },
      {
        key: 'imageSide',
        label: 'Image side',
        type: 'select',
        options: [
          { value: 'left', label: 'Left' },
          { value: 'right', label: 'Right' },
        ],
      },
    ],
  },
  faq: {
    type: 'faq',
    label: 'FAQ',
    description: 'Frequently asked questions as an expandable list.',
    singular: false,
    defaultSettings: { heading: 'Frequently asked questions' },
    defaultBlocks: [
      { question: 'Do you offer Cash on Delivery?', answer: 'Yes — pay in cash at your doorstep nationwide.' },
      { question: 'How long does delivery take?', answer: 'Karachi/Lahore/Islamabad: 1–3 days. Other cities: 3–5 days.' },
    ],
    settings: [{ key: 'heading', label: 'Section heading', type: 'text', placeholder: 'Frequently asked questions' }],
    block: {
      label: 'Question',
      singularLabel: 'question',
      min: 1,
      fields: [
        { key: 'question', label: 'Question', type: 'text', placeholder: 'Do you offer COD?' },
        { key: 'answer', label: 'Answer', type: 'textarea', rows: 3 },
      ],
    },
  },
};

export const ADDABLE_SECTIONS: PkSectionType[] = ['hero', 'features', 'featuredProducts', 'richText', 'imageWithText', 'faq'];

export function newId(prefix: string) {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function defaultBlock(type: PkSectionType): PkBlock {
  const def = SECTION_REGISTRY[type];
  const settings: Record<string, unknown> = {};
  for (const f of def.block?.fields ?? []) settings[f.key] = f.type === 'toggle' ? true : '';
  return { id: newId('blk'), enabled: true, settings };
}

export function defaultSection(type: PkSectionType): PkSection {
  const def = SECTION_REGISTRY[type];
  const blocks = (def.defaultBlocks ?? []).map((b) => ({
    id: newId('blk'),
    enabled: true,
    settings: { ...b },
  }));
  return {
    id: newId('sec'),
    type,
    enabled: true,
    settings: { ...(def.defaultSettings ?? {}) },
    blocks,
  };
}

export const DEFAULT_HOME_SECTIONS: PkSection[] = [
  { id: 'home-hero', type: 'hero', enabled: true, settings: {}, blocks: [] },
  { id: 'home-features', type: 'features', enabled: true, settings: {}, blocks: [] },
  { id: 'home-featured', type: 'featuredProducts', enabled: true, settings: {}, blocks: [] },
];

const KNOWN_SECTION_TYPES = new Set<string>([
  'hero',
  'features',
  'featuredProducts',
  'richText',
  'imageWithText',
  'faq',
]);

/**
 * Normalise a stored `home.sections` value into renderable {@link PkSection}s.
 *
 * - Arrays pass through; plain objects are recovered as collections so a
 *   serialised map like {"0": …, "1": …} is not lost (see asArray).
 * - Every entry that is a plain object is KEPT — unknown section types are
 *   preserved verbatim so nothing merchant-authored is silently discarded;
 *   the storefront renders them as nothing and the editor shows them as an
 *   "unsupported section" row that can still be reordered, hidden or deleted.
 * - `type` must be a bounded string; `id` is synthesised when missing;
 *   `settings`/`blocks[].settings` are deep-copied plain objects (non-object
 *   junk becomes {}); `enabled` defaults to true except explicit `false`.
 * - Never throws; never mutates the stored configuration.
 */
export function sanitizeHomeSections(value: unknown): PkSection[] {
  const out: PkSection[] = [];
  for (const raw of asArray(value).slice(0, 40)) {
    if (!isPlainObject(raw)) continue;
    const type = str(raw.type, 60);
    if (!type) continue;
    const id = str(raw.id, 80) || `sec-${out.length + 1}`;
    const settings = isPlainObject(raw.settings) ? { ...raw.settings } : {};
    const blocks: PkBlock[] = [];
    for (const b of asArray(raw.blocks).slice(0, 40)) {
      if (!isPlainObject(b)) continue;
      blocks.push({
        id: str(b.id, 80) || `blk-${blocks.length + 1}`,
        enabled: b.enabled !== false,
        settings: isPlainObject(b.settings) ? { ...b.settings } : {},
      });
    }
    out.push({
      id,
      // Unknown types survive verbatim — see doc comment above.
      type: type as PkSectionType,
      enabled: raw.enabled !== false,
      settings,
      blocks,
    });
  }
  return out;
}

export { KNOWN_SECTION_TYPES };
