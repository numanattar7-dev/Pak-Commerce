// ---------------------------------------------------------------------------
// Theme package validator — parses & validates an uploaded Pak Commerce theme.
// Pure functions; never executes or evaluates uploaded content.
// Package layout:
//   pakcommerce-theme.json          (required manifest)
//   assets/*.{png,jpg,jpeg,webp,woff2}   (optional, stored in R2 when configured)
//   sections/*.json                 (optional, validated but reserved in v1)
// Manifest:
//   { format?: "pakcommerce-theme@1", name, description?, version, config: {...} }
// ---------------------------------------------------------------------------

import AdmZip = require('adm-zip');

export const MAX_ZIP_BYTES = 5 * 1024 * 1024;      // 5 MB
export const MAX_ENTRIES = 100;
export const MAX_ASSETS = 24;
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;    // 2 MB per asset

const MANIFEST_PATH = 'pakcommerce-theme.json';

const ALLOWED_EXTS = new Set(['.json', '.png', '.jpg', '.jpeg', '.webp', '.woff2']);
const ASSET_EXTS: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const SECTION_TYPES = new Set(['hero', 'features', 'featuredProducts', 'richText', 'imageWithText', 'faq']);

// settings keys allowed per section type (everything else is rejected)
const SECTION_SETTING_KEYS: Record<string, Set<string>> = {
  hero: new Set([]),
  features: new Set([]),
  featuredProducts: new Set([]),
  richText: new Set(['heading', 'body', 'align']),
  imageWithText: new Set(['imageUrl', 'heading', 'body', 'ctaText', 'ctaLink', 'imageSide']),
  faq: new Set(['heading']),
};
const FAQ_BLOCK_KEYS = new Set(['question', 'answer']);

export interface ThemeAssetInput {
  filename: string;
  contentType: string;
  buffer: Buffer;
}

export interface ValidatedThemePackage {
  name: string;
  description?: string;
  version: string;
  config: Record<string, unknown>;
  assets: ThemeAssetInput[];
  warnings: string[];
}

export interface ThemeValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  pkg?: ValidatedThemePackage;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

const str = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length <= max;

const bool = (v: unknown) => typeof v === 'boolean';
const numIn = (v: unknown, min: number, max: number) =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;

/** href/url sanitiser: only absolute-path and http(s) URLs — blocks javascript:/data:/vbscript: */
const isSafeLink = (v: unknown) =>
  typeof v === 'string' && /^(\/|https?:\/\/)/i.test(v) && v.length <= 500;

const isSafeColor = (v: unknown) =>
  typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function fail(errors: string[], warnings: string[]): ThemeValidationResult {
  return { ok: false, errors, warnings };
}

export function validateThemeZip(buffer: Buffer): ThemeValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (buffer.length > MAX_ZIP_BYTES) {
    return fail([`ZIP exceeds the 5 MB limit (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`], warnings);
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    return fail(['File is not a valid ZIP archive'], warnings);
  }

  const entries = zip.getEntries();
  if (entries.length === 0) return fail(['ZIP archive is empty'], warnings);
  if (entries.length > MAX_ENTRIES) {
    return fail([`ZIP contains ${entries.length} entries; maximum is ${MAX_ENTRIES}`], warnings);
  }

  // ── structural validation ───────────────────────────────────────────────
  const files: { path: string; buffer: Buffer }[] = [];
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    let name = entry.entryName.replace(/\\/g, '/'); // normalise separators
    if (name.startsWith('/') || /^[a-zA-Z]:/.test(name) || name.includes('..') || /[\x00-\x1f]/.test(name)) {
      errors.push(`Unsafe path rejected: ${entry.entryName}`);
      continue;
    }
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
    if (!ALLOWED_EXTS.has(ext)) {
      errors.push(`File type not allowed: ${name} (${ext || 'no extension'})`);
      continue;
    }
    let data: Buffer;
    try {
      data = entry.getData();
    } catch {
      errors.push(`Could not read entry: ${name}`);
      continue;
    }
    if (data.length > MAX_ASSET_BYTES) {
      errors.push(`File exceeds 2 MB: ${name}`);
      continue;
    }
    files.push({ path: name, buffer: data });
  }

  if (errors.length) return fail(errors, warnings);

  // ── manifest ────────────────────────────────────────────────────────────
  const manifestFile = files.find((f) => f.path === MANIFEST_PATH);
  if (!manifestFile) {
    return fail([`Missing required manifest: ${MANIFEST_PATH} (at archive root)`], warnings);
  }
  let manifest: Record<string, unknown>;
  try {
    manifest = JSON.parse(manifestFile.buffer.toString('utf8'));
  } catch {
    return fail([`Manifest is not valid JSON: ${MANIFEST_PATH}`], warnings);
  }
  if (!isObject(manifest)) return fail(['Manifest root must be a JSON object'], warnings);
  if (manifest.format !== undefined && manifest.format !== 'pakcommerce-theme@1') {
    errors.push(`Unsupported theme format "${String(manifest.format)}" (expected "pakcommerce-theme@1")`);
  }
  if (!str(manifest.name, 80) || (manifest.name as string).trim().length < 3) {
    errors.push('Manifest "name" is required and must be 3–80 characters');
  }
  if (!str(manifest.version, 32) || !/^\d+\.\d+\.\d+$/.test(manifest.version as string)) {
    errors.push('Manifest "version" is required and must look like 1.0.0');
  }
  if (manifest.description !== undefined && !str(manifest.description, 500)) {
    errors.push('Manifest "description" must be a string of at most 500 characters');
  }
  if (!isObject(manifest.config)) {
    errors.push('Manifest "config" is required and must be an object');
  }
  if (errors.length) return fail(errors, warnings);

  // ── config (design-only) validation ─────────────────────────────────────
  const cfg = manifest.config as Record<string, unknown>;
  const errorsBeforeSectionCheck = errors.length;
  const allowedTop = new Set([
    'branding', 'theme', 'announcement', 'hero', 'sections', 'home',
    'header', 'footer', 'payments', 'checkout', 'seo',
  ]);
  for (const key of Object.keys(cfg)) {
    if (!allowedTop.has(key)) errors.push(`Unknown config section: "${key}"`);
  }

  if (cfg.branding !== undefined) {
    if (!isObject(cfg.branding)) errors.push('branding must be an object');
    else {
      const b = cfg.branding;
      for (const k of ['logoUrl', 'faviconUrl']) {
        if (b[k] !== undefined && b[k] !== '' && !isSafeLink(b[k])) {
          errors.push(`branding.${k} must be an absolute path or http(s) URL`);
        }
      }
      if (b.tagline !== undefined && !str(b.tagline, 200)) errors.push('branding.tagline max 200 chars');
    }
  }

  if (cfg.theme !== undefined) {
    if (!isObject(cfg.theme)) errors.push('theme must be an object');
    else {
      const t = cfg.theme;
      if (t.primary !== undefined && !isSafeColor(t.primary)) errors.push('theme.primary must be #RRGGBB');
      if (t.accent !== undefined && !isSafeColor(t.accent)) errors.push('theme.accent must be #RRGGBB');
    }
  }

  if (cfg.announcement !== undefined) {
    if (!isObject(cfg.announcement)) errors.push('announcement must be an object');
    else {
      const a = cfg.announcement;
      if (a.enabled !== undefined && !bool(a.enabled)) errors.push('announcement.enabled must be boolean');
      if (a.text !== undefined && !str(a.text, 280)) errors.push('announcement.text max 280 chars');
    }
  }

  if (cfg.hero !== undefined) {
    if (!isObject(cfg.hero)) errors.push('hero must be an object');
    else {
      const h = cfg.hero;
      if (h.enabled !== undefined && !bool(h.enabled)) errors.push('hero.enabled must be boolean');
      for (const k of ['badge', 'title', 'subtitle', 'ctaText']) {
        if (h[k] !== undefined && !str(h[k], 500)) errors.push(`hero.${k} max 500 chars`);
      }
      if (h.imageUrl !== undefined && h.imageUrl !== '' && !isSafeLink(h.imageUrl)) {
        errors.push('hero.imageUrl must be an absolute path or http(s) URL');
      }
      if (h.ctaLink !== undefined && !isSafeLink(h.ctaLink)) errors.push('hero.ctaLink must be an absolute path or http(s) URL');
    }
  }

  if (cfg.sections !== undefined) {
    if (!isObject(cfg.sections)) errors.push('sections must be an object');
    else {
      const s = cfg.sections;
      if (s.showFeatures !== undefined && !bool(s.showFeatures)) errors.push('sections.showFeatures must be boolean');
      if (s.featuredCount !== undefined && !numIn(s.featuredCount, 0, 24)) errors.push('sections.featuredCount must be 0–24');
      if (s.aboutBlurb !== undefined && !str(s.aboutBlurb, 500)) errors.push('sections.aboutBlurb max 500 chars');
    }
  }

  for (const key of ['header', 'footer'] as const) {
    if (cfg[key] !== undefined) {
      if (!isObject(cfg[key])) errors.push(`${key} must be an object`);
      else {
        const frag = cfg[key] as Record<string, unknown>;
        for (const listKey of ['menuLinks', 'quickLinks']) {
          if (frag[listKey] !== undefined) {
            if (!Array.isArray(frag[listKey]) || (frag[listKey] as unknown[]).length > 20) {
              errors.push(`${key}.${listKey} must be an array of at most 20 links`);
            } else {
              (frag[listKey] as unknown[]).forEach((l, i) => {
                if (!isObject(l)) errors.push(`${key}.${listKey}[${i}] must be an object`);
                else {
                  if (!str(l.label, 80)) errors.push(`${key}.${listKey}[${i}].label max 80 chars`);
                  if (!isSafeLink(l.href)) errors.push(`${key}.${listKey}[${i}].href must be an absolute path or http(s) URL`);
                }
              });
            }
          }
        }
        if (key === 'footer') {
          if (frag.aboutText !== undefined && !str(frag.aboutText, 2000)) errors.push('footer.aboutText max 2000 chars');
          if (frag.copyright !== undefined && !str(frag.copyright, 200)) errors.push('footer.copyright max 200 chars');
        }
      }
    }
  }

  if (cfg.payments !== undefined) {
    if (!isObject(cfg.payments)) errors.push('payments must be an object');
    else {
      for (const [k, v] of Object.entries(cfg.payments)) {
        if (!['COD', 'IBFT', 'RAAST', 'JAZZCASH', 'EASYPAISA'].includes(k)) {
          errors.push(`payments.${k} is not a known payment method`);
        } else if (!bool(v)) errors.push(`payments.${k} must be boolean`);
      }
    }
  }

  if (cfg.checkout !== undefined) {
    if (!isObject(cfg.checkout)) errors.push('checkout must be an object');
    else {
      const c = cfg.checkout;
      if (c.confirmationMsg !== undefined && !str(c.confirmationMsg, 500)) errors.push('checkout.confirmationMsg max 500 chars');
      if (c.allowNotes !== undefined && !bool(c.allowNotes)) errors.push('checkout.allowNotes must be boolean');
    }
  }

  if (cfg.seo !== undefined) {
    if (!isObject(cfg.seo)) errors.push('seo must be an object');
    else {
      const s = cfg.seo;
      if (s.metaTitle !== undefined && !str(s.metaTitle, 200)) errors.push('seo.metaTitle max 200 chars');
      if (s.metaDescription !== undefined && !str(s.metaDescription, 300)) errors.push('seo.metaDescription max 300 chars');
    }
  }

  if (cfg.home !== undefined) {
    if (!isObject(cfg.home) || !Array.isArray((cfg.home as Record<string, unknown>).sections)) {
      errors.push('home.sections must be an array');
    } else {
      const sections = (cfg.home as Record<string, unknown>).sections as unknown[];
      if (sections.length > 30) errors.push('home.sections allows at most 30 sections');
      const ids = new Set<string>();
      sections.forEach((sec, i) => {
        if (!isObject(sec)) {
          errors.push(`home.sections[${i}] must be an object`);
          return;
        }
        const type = sec.type as string;
        if (!SECTION_TYPES.has(type)) {
          errors.push(`home.sections[${i}] has unsupported type "${String(type)}"`);
          return;
        }
        // settings whitelist for this type
        if (sec.settings !== undefined) {
          if (!isObject(sec.settings)) errors.push(`home.sections[${i}].settings must be an object`);
          else {
            const allowed = SECTION_SETTING_KEYS[type];
            for (const k of Object.keys(sec.settings)) {
              if (!allowed.has(k)) errors.push(`home.sections[${i}].settings.${k} is not supported`);
            }
            if (type === 'richText') {
              const s = sec.settings as Record<string, unknown>;
              if (s.align !== undefined && !['left', 'center'].includes(s.align as string)) {
                errors.push(`home.sections[${i}].settings.align must be "left" or "center"`);
              }
              if (s.heading !== undefined && !str(s.heading, 300)) errors.push(`home.sections[${i}].settings.heading max 300 chars`);
              if (s.body !== undefined && !str(s.body, 4000)) errors.push(`home.sections[${i}].settings.body max 4000 chars`);
            }
            if (type === 'imageWithText') {
              const s = sec.settings as Record<string, unknown>;
              if (s.imageUrl !== undefined && s.imageUrl !== '' && !isSafeLink(s.imageUrl)) {
                errors.push(`home.sections[${i}].settings.imageUrl must be an absolute path or http(s) URL`);
              }
              if (s.ctaLink !== undefined && !isSafeLink(s.ctaLink)) errors.push(`home.sections[${i}].settings.ctaLink must be an absolute path or http(s) URL`);
              if (s.imageSide !== undefined && !['left', 'right'].includes(s.imageSide as string)) {
                errors.push(`home.sections[${i}].settings.imageSide must be "left" or "right"`);
              }
            }
            if (type === 'faq' && s_is(sec.settings, 'heading') !== undefined && !str(sec.settings.heading, 300)) {
              errors.push(`home.sections[${i}].settings.heading max 300 chars`);
            }
          }
        }
        if (type === 'faq') {
          if (sec.blocks !== undefined) {
            if (!Array.isArray(sec.blocks)) errors.push(`home.sections[${i}].blocks must be an array`);
            else if ((sec.blocks as unknown[]).length > 50) errors.push(`home.sections[${i}] has too many blocks (max 50)`);
            else {
              (sec.blocks as unknown[]).forEach((b, j) => {
                if (!isObject(b)) {
                  errors.push(`home.sections[${i}].blocks[${j}] must be an object`);
                  return;
                }
                if (b.settings !== undefined) {
                  if (!isObject(b.settings)) errors.push(`home.sections[${i}].blocks[${j}].settings must be an object`);
                  else {
                    for (const k of Object.keys(b.settings)) {
                      if (!FAQ_BLOCK_KEYS.has(k)) errors.push(`home.sections[${i}].blocks[${j}].settings.${k} unsupported`);
                    }
                    const q = b.settings.question, a = b.settings.answer;
                    if (q !== undefined && !str(q, 500)) errors.push(`home.sections[${i}].blocks[${j}] question max 500 chars`);
                    if (a !== undefined && !str(a, 4000)) errors.push(`home.sections[${i}].blocks[${j}] answer max 4000 chars`);
                  }
                }
              });
            }
          }
        } else if (sec.blocks !== undefined && Array.isArray(sec.blocks) && sec.blocks.length > 0) {
          errors.push(`home.sections[${i}] (${type}) does not support blocks`);
        }
        if (sec.id !== undefined) {
          if (!str(sec.id, 80) || !/^[a-zA-Z0-9-]{2,80}$/.test(sec.id as string)) {
            errors.push(`home.sections[${i}].id must be 2–80 chars of letters/numbers/dashes`);
          } else if (ids.has(sec.id as string)) {
            errors.push(`home.sections[${i}].id "${String(sec.id)}" is duplicated`);
          } else {
            ids.add(sec.id as string);
          }
        }
      });
    }
  }

  if (errorsBeforeSectionCheck === errors.length && files.some((f) => f.path.startsWith('sections/') && f.path.endsWith('.json'))) {
    warnings.push('sections/*.json found — validated as JSON but reserved in v1 and not applied on install');
  }

  // ── assets ───────────────────────────────────────────────────────────────
  const assets: ThemeAssetInput[] = [];
  let totalAssetBytes = 0;
  for (const f of files) {
    if (!f.path.startsWith('assets/')) continue;
    const ext = f.path.slice(f.path.lastIndexOf('.')).toLowerCase();
    const contentType = ASSET_EXTS[ext];
    if (!contentType) {
      errors.push(`Asset type not allowed: ${f.path}`);
      continue;
    }
    totalAssetBytes += f.buffer.length;
    if (assets.length >= MAX_ASSETS) {
      errors.push(`Too many assets (max ${MAX_ASSETS})`);
      break;
    }
    assets.push({ filename: f.path.slice('assets/'.length), contentType, buffer: f.buffer });
  }
  if (totalAssetBytes > 10 * 1024 * 1024) errors.push('Total assets exceed 10 MB');

  if (errors.length) return fail(errors, warnings);

  const config = JSON.parse(JSON.stringify(cfg)) as Record<string, unknown>;
  // ensure stable section ids (config without ids would confuse the editor)
  if (isObject(cfg.home) && Array.isArray((cfg.home as Record<string, unknown>).sections)) {
    const sections = (cfg.home as Record<string, unknown>).sections as Array<Record<string, unknown>>;
    const seen = new Set<string>();
    sections.forEach((s) => {
      if (!str(s.id, 80) || seen.has(String(s.id))) {
        s.id = `sec-${Math.random().toString(36).slice(2, 10)}`;
        warnings.push('Section ids were regenerated (missing or duplicated)');
      }
      seen.add(String(s.id));
    });
  }

  return {
    ok: true,
    errors,
    warnings,
    pkg: {
      name: (manifest.name as string).trim(),
      description: manifest.description as string | undefined,
      version: manifest.version as string,
      config,
      assets,
      warnings,
    },
  };
}

const s_is = (obj: unknown, key: string): unknown =>
  isObject(obj) ? obj[key] : undefined;
