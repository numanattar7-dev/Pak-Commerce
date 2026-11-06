import { BadRequestException } from '@nestjs/common';

// ---------------------------------------------------------------------------
// Server-side validation for the nested navigation config stored in
// StoreSettings.configJson.navigation. Pure function so it can be unit-tested
// without a database. Rejects unsafe URLs, unknown fields and deep nesting.
// ---------------------------------------------------------------------------

const MENU_KEYS = ['header', 'footer'] as const;
const TYPES = ['home', 'products', 'collections', 'blog', 'track', 'product', 'collection', 'page', 'external'];
const ID_RE = /^[a-zA-Z0-9-]{1,64}$/;
const PRODUCT_REF_RE = /^[a-zA-Z0-9-]{8,64}$/;
const HANDLE_RE = /^[a-z0-9-]{2,60}$/;
const BAD_CHARS = /[<>"'\\]/;
const SCRIPT_SCHEME = /(javascript:|data:|vbscript:)/i;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function isSafeExternalUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500 || BAD_CHARS.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && !!url.hostname;
  } catch {
    return false;
  }
}

export function validateNavigationConfig(config: Record<string, unknown>): void {
  const nav = config.navigation;
  if (nav === undefined) return; // settings saved without touching navigation
  if (!isPlainObject(nav)) {
    throw new BadRequestException('navigation must be an object with header and/or footer menus');
  }

  for (const key of MENU_KEYS) {
    if ((nav as Record<string, unknown>)[key] === undefined) continue;
    const nodes = (nav as Record<string, unknown>)[key];
    if (!Array.isArray(nodes)) {
      throw new BadRequestException(`navigation.${key} must be an array of menu items`);
    }
    if (nodes.length > 24) {
      throw new BadRequestException(`navigation.${key} allows at most 24 top-level items`);
    }

    let count = 0;
    const walk = (list: unknown[], depth: number, path: string) => {
      for (let i = 0; i < list.length; i++) {
        const node = list[i];
        const here = `${path}[${i}]`;
        if (!isPlainObject(node)) {
          throw new BadRequestException(`${here} must be an object`);
        }
        const n = node as Record<string, unknown>;
        for (const k of Object.keys(n)) {
          if (!['id', 'label', 'enabled', 'type', 'ref', 'url', 'children'].includes(k)) {
            throw new BadRequestException(`${here}.${k} is not a supported menu item field`);
          }
        }
        if (typeof n.id !== 'string' || !ID_RE.test(n.id)) {
          throw new BadRequestException(`${here}.id must be 1–64 letters, numbers or dashes`);
        }
        if (typeof n.label !== 'string' || n.label.trim().length === 0 || n.label.length > 80) {
          throw new BadRequestException(`${here}.label must be a non-empty string of at most 80 characters`);
        }
        if (SCRIPT_SCHEME.test(n.label) || BAD_CHARS.test(n.label)) {
          throw new BadRequestException(`${here}.label contains disallowed characters`);
        }
        if (typeof n.enabled !== 'boolean') {
          throw new BadRequestException(`${here}.enabled must be true or false`);
        }
        const type = n.type;
        if (typeof type !== 'string' || !TYPES.includes(type)) {
          throw new BadRequestException(`${here}.type must be one of ${TYPES.join(', ')}`);
        }
        if (type === 'home' || type === 'products' || type === 'collections' || type === 'blog' || type === 'track') {
          if (n.ref !== undefined || n.url !== undefined) {
            throw new BadRequestException(`${here}: ${type} items must not carry ref or url`);
          }
        } else if (type === 'product') {
          if (typeof n.ref !== 'string' || !PRODUCT_REF_RE.test(n.ref)) {
            throw new BadRequestException(`${here}.ref must be a product id (8–64 letters, numbers or dashes)`);
          }
        } else if (type === 'collection' || type === 'page') {
          if (typeof n.ref !== 'string' || !HANDLE_RE.test(n.ref)) {
            throw new BadRequestException(`${here}.ref must be a lowercase handle (2–60, a–z 0–9 -)`);
          }
        } else if (type === 'external') {
          if (!isSafeExternalUrl(n.url)) {
            throw new BadRequestException(
              `${here}.url must be an absolute http(s) URL of at most 500 characters without < > " ' \\`,
            );
          }
          if (n.ref !== undefined) {
            throw new BadRequestException(`${here}: external items must not carry ref`);
          }
        }

        if (depth >= 3) {
          if (n.children !== undefined && (!Array.isArray(n.children) || n.children.length > 0)) {
            throw new BadRequestException(`${here}.children exceeds the maximum menu depth of 3 levels`);
          }
        }
        const children = n.children;
        if (children !== undefined) {
          if (!Array.isArray(children)) {
            throw new BadRequestException(`${here}.children must be an array`);
          }
          if (children.length > 24) {
            throw new BadRequestException(`${here} has too many items (max 24)`);
          }
          walk(children, depth + 1, `${here}.children`);
        }
        count += 1;
        if (count > 120) {
          throw new BadRequestException('navigation is limited to 120 items in total');
        }
      }
    };
    walk(nodes, 1, `navigation.${key}`);
  }
}
