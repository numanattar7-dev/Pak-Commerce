// ---------------------------------------------------------------------------
// M6 verification — pages/blog tenant isolation, public visibility,
// navigation nesting/URL validation, and migration SQL shape.
// Runs against compiled backend output + the storefront-renderer source
// (transpiled in-memory). No database, network or production access.
//
//   npm run build --workspace=@pak-commerce/api-backend
//   node scripts/test-m6.js
// ---------------------------------------------------------------------------
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'apps', 'api-backend', 'dist');

let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  PASS  ${name}`);
  } catch (e) {
    failures.push(name);
    console.error(`  FAIL  ${name}`);
    console.error(`        ${e && e.message ? e.message.split('\n')[0] : e}`);
  }
}

function loadTsModule(file, overrides = {}) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  }).outputText;
  const mod = { exports: {} };
  const localRequire = (id) => (id in overrides ? overrides[id] : require(id));
  const fn = new Function('exports', 'require', 'module', '__filename', '__dirname', output);
  fn(mod.exports, localRequire, mod, file, path.dirname(file));
  return mod.exports;
}

function readSql(file) {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => !l.trim().startsWith('--'))
    .join('\n');
}

(async () => {
  // -------------------------------------------------------------------------
  console.log('\nNavigation validator (server-side enforcement)');
  // -------------------------------------------------------------------------
  const { validateNavigationConfig } = require(path.join(
    DIST,
    'store-settings',
    'navigation.validation.js',
  ));

  const validNested = {
    navigation: {
      header: [
        {
          id: 'shop',
          label: 'Shop',
          enabled: true,
          type: 'products',
          children: [
            {
              id: 'lawn',
              label: 'Lawn',
              enabled: true,
              type: 'collection',
              ref: 'lawn',
              children: [
                { id: 'summer', label: 'Summer', enabled: true, type: 'external', url: 'https://example.com/summer' },
              ],
            },
          ],
        },
      ],
      footer: [
        { id: 'about', label: 'About us', enabled: true, type: 'page', ref: 'about-us' },
      ],
    },
  };

  await test('accepts a valid 3-level menu', () => {
    validateNavigationConfig(validNested);
  });

  await test('accepts settings without a navigation key', () => {
    validateNavigationConfig({ branding: { tagline: 'x' } });
  });

  await test('rejects a 4th nesting level', () => {
    const cfg = {
      navigation: {
        header: [
          {
            id: 'l1', label: 'L1', enabled: true, type: 'home',
            children: [
              {
                id: 'l2', label: 'L2', enabled: true, type: 'home',
                children: [
                  {
                    id: 'l3', label: 'L3', enabled: true, type: 'home',
                    children: [{ id: 'l4', label: 'L4', enabled: true, type: 'home' }],
                  },
                ],
              },
            ],
          },
        ],
      },
    };
    assert.throws(() => validateNavigationConfig(cfg), /maximum menu depth/);
  });

  await test('rejects javascript: external URLs', () => {
    const cfg = { navigation: { header: [{ id: 'x', label: 'X', enabled: true, type: 'external', url: 'javascript:alert(1)' }] } };
    assert.throws(() => validateNavigationConfig(cfg), /absolute http\(s\) URL/);
  });

  await test('rejects data: external URLs', () => {
    const cfg = { navigation: { header: [{ id: 'x', label: 'X', enabled: true, type: 'external', url: 'data:text/html,<script>' }] } };
    assert.throws(() => validateNavigationConfig(cfg), /absolute http\(s\) URL/);
  });

  await test('rejects protocol-relative, relative and hostless external URLs', () => {
    for (const url of ['//evil.example', '/track', 'ftp://example.com', 'https://', 'https://exa mple.com']) {
      const cfg = { navigation: { header: [{ id: 'x', label: 'X', enabled: true, type: 'external', url }] } };
      assert.throws(() => validateNavigationConfig(cfg), /absolute http\(s\) URL/, url);
    }
  });

  await test('rejects unsafe characters in URLs and labels', () => {
    const withQuote = { navigation: { header: [{ id: 'x', label: 'X', enabled: true, type: 'external', url: 'https://example.com/?q="x"' }] } };
    assert.throws(() => validateNavigationConfig(withQuote), /absolute http\(s\) URL/);
    const withTag = { navigation: { header: [{ id: 'x', label: '<img src=x>', enabled: true, type: 'home' }] } };
    assert.throws(() => validateNavigationConfig(withTag), /disallowed characters/);
  });

  await test('rejects unsupported fields (no event handlers)', () => {
    const cfg = { navigation: { header: [{ id: 'x', label: 'X', enabled: true, type: 'home', onClick: 'alert(1)' }] } };
    assert.throws(() => validateNavigationConfig(cfg), /not a supported menu item field/);
  });

  await test('rejects malformed refs for products, collections and pages', () => {
    const cases = [
      { type: 'product', ref: 'short' },
      { type: 'product', ref: 'bad id!' },
      { type: 'collection', ref: 'Bad Handle' },
      { type: 'page', ref: 'About' },
      { type: 'page', ref: 'a' },
    ];
    for (const c of cases) {
      const cfg = { navigation: { header: [{ id: 'x', label: 'X', enabled: true, ...c }] } };
      assert.throws(() => validateNavigationConfig(cfg), /\.ref must be/, JSON.stringify(c));
    }
  });

  await test('rejects ref/url on fixed destinations and ref on external links', () => {
    assert.throws(
      () => validateNavigationConfig({ navigation: { header: [{ id: 'x', label: 'X', enabled: true, type: 'home', ref: 'about' }] } }),
      /must not carry ref or url/,
    );
    assert.throws(
      () => validateNavigationConfig({ navigation: { header: [{ id: 'x', label: 'X', enabled: true, type: 'external', url: 'https://e.com', ref: 'p1' }] } }),
      /must not carry ref/,
    );
  });

  await test('accepts a disabled item (hidden storefront link)', () => {
    validateNavigationConfig({ navigation: { footer: [{ id: 'hidden', label: 'Hidden', enabled: false, type: 'home' }] } });
  });

  await test('rejects non-boolean enabled, missing type and malformed containers', () => {
    assert.throws(
      () => validateNavigationConfig({ navigation: { header: [{ id: 'x', label: 'X', enabled: 'yes', type: 'home' }] } }),
      /enabled must be true or false/,
    );
    assert.throws(
      () => validateNavigationConfig({ navigation: { header: [{ id: 'x', label: 'X', enabled: true }] } }),
      /type must be one of/,
    );
    assert.throws(() => validateNavigationConfig({ navigation: { header: 'nope' } }), /must be an array/);
    assert.throws(() => validateNavigationConfig({ navigation: [] }), /must be an object/);
  });

  await test('enforces 24 top-level items and 120 total items', () => {
    const many = { navigation: { header: Array.from({ length: 25 }, (_, i) => ({ id: `n${i}`, label: `N${i}`, enabled: true, type: 'home' })) } };
    assert.throws(() => validateNavigationConfig(many), /at most 24 top-level/);

    const deep = {
      navigation: {
        header: Array.from({ length: 6 }, (_, i) => ({
          id: `p${i}`,
          label: `P${i}`,
          enabled: true,
          type: 'home',
          children: Array.from({ length: 24 }, (_, j) => ({ id: `c${i}-${j}`, label: `C${j}`, enabled: true, type: 'home' })),
        })),
      },
    };
    assert.throws(() => validateNavigationConfig(deep), /limited to 120 items/);
  });

  // -------------------------------------------------------------------------
  console.log('\nStorefront navigation resolver');
  // -------------------------------------------------------------------------
  const { safeHref, resolveNavNodes, legacyToResolved } = loadTsModule(
    path.join(ROOT, 'packages', 'storefront-renderer', 'src', 'navigation.ts'),
  );

  await test('resolves every supported internal link type', () => {
    assert.strictEqual(safeHref({ type: 'home' }), '/');
    assert.strictEqual(safeHref({ type: 'products' }), '/products');
    assert.strictEqual(safeHref({ type: 'collections' }), '/collections');
    assert.strictEqual(safeHref({ type: 'blog' }), '/blog');
    assert.strictEqual(safeHref({ type: 'track' }), '/track');
    assert.strictEqual(safeHref({ type: 'product', ref: 'abc-123' }), '/products/abc-123');
    assert.strictEqual(safeHref({ type: 'collection', ref: 'lawn' }), '/collections/lawn');
    assert.strictEqual(safeHref({ type: 'page', ref: 'about-us' }), '/p/about-us');
    assert.strictEqual(safeHref({ type: 'external', url: 'https://example.com' }), 'https://example.com');
  });

  await test('drops unsafe or incomplete destinations', () => {
    assert.strictEqual(safeHref({ type: 'external', url: 'javascript:alert(1)' }), null);
    assert.strictEqual(safeHref({ type: 'external', url: 'data:text/html,x' }), null);
    assert.strictEqual(safeHref({ type: 'external', url: '/relative' }), null);
    assert.strictEqual(safeHref({ type: 'external', url: 'https://' }), null);
    assert.strictEqual(safeHref({ type: 'external', url: 'https://e.com/"><script>' }), null);
    assert.strictEqual(safeHref({ type: 'product' }), null);
  });

  await test('filters disabled nodes and keeps nested order', () => {
    const resolved = resolveNavNodes([
      { id: 'a', label: 'Shop', enabled: true, type: 'products', children: [
        { id: 'b', label: 'Lawn', enabled: true, type: 'collection', ref: 'lawn' },
        { id: 'c', label: 'Hidden', enabled: false, type: 'page', ref: 'hidden' },
      ] },
      { id: 'd', label: 'Off', enabled: false, type: 'home' },
    ]);
    assert.strictEqual(resolved.length, 1);
    assert.deepStrictEqual(resolved[0].children.map((c) => c.label), ['Lawn']);
    assert.strictEqual(resolved[0].children[0].href, '/collections/lawn');
    assert.strictEqual(resolved[0].external, false);
  });

  await test('never renders more than three navigation levels', () => {
    const resolved = resolveNavNodes([
      { id: 'a', label: 'A', enabled: true, type: 'home', children: [
        { id: 'b', label: 'B', enabled: true, type: 'home', children: [
          { id: 'c', label: 'C', enabled: true, type: 'home', children: [
            { id: 'd', label: 'D', enabled: true, type: 'home' },
          ] },
        ] },
      ] },
    ]);
    assert.strictEqual(resolved[0].children[0].children[0].label, 'C');
    assert.deepStrictEqual(resolved[0].children[0].children[0].children, []);
  });

  await test('marks external links and never emits unsafe hrefs', () => {
    const resolved = resolveNavNodes([
      { id: 'a', label: 'Out', enabled: true, type: 'external', url: 'https://example.com' },
      { id: 'b', label: 'Bad', enabled: true, type: 'external', url: 'javascript:alert(1)' },
    ]);
    assert.strictEqual(resolved.length, 1);
    assert.strictEqual(resolved[0].external, true);
    assert.strictEqual(resolved[0].href, 'https://example.com');
  });

  await test('legacy flat links are sanitised', () => {
    const legacy = legacyToResolved([
      { label: 'Track', href: '/track' },
      { label: 'Out', href: 'https://example.com' },
      { label: 'Evil', href: 'javascript:alert(1)' },
      { label: 'Quote', href: '/x"><script>' },
      { label: 'Protocol', href: '//evil.example' },
      { label: 'Hostless', href: 'https://' },
      { label: '', href: '/empty' },
    ]);
    assert.deepStrictEqual(legacy.map((l) => l.label), ['Track', 'Out']);
    assert.strictEqual(legacy[1].external, true);
  });

  // -------------------------------------------------------------------------
  console.log('\nConfig merge — legacy menus preserved');
  // -------------------------------------------------------------------------
  const sections = loadTsModule(
    path.join(ROOT, 'packages', 'storefront-renderer', 'src', 'sections.ts'),
  );
  const { DEFAULT_CUSTOMIZATION, mergeStoreConfig } = loadTsModule(
    path.join(ROOT, 'packages', 'storefront-renderer', 'src', 'config.ts'),
    { './sections': sections },
  );

  await test('a config without navigation does not invent one (legacy links keep rendering)', () => {
    const merged = mergeStoreConfig(DEFAULT_CUSTOMIZATION, {
      header: { menuLinks: [{ label: 'Track', href: '/track' }] },
    });
    assert.strictEqual(merged.navigation, undefined);
    assert.deepStrictEqual(merged.header.menuLinks, [{ label: 'Track', href: '/track' }]);
  });

  await test('saved navigation survives the merge intact', () => {
    const header = [{ id: 'h1', label: 'Shop', enabled: true, type: 'products' }];
    const merged = mergeStoreConfig(DEFAULT_CUSTOMIZATION, { navigation: { header, footer: [] } });
    assert.deepStrictEqual(merged.navigation.header, header);
    assert.deepStrictEqual(merged.navigation.footer, []);
  });

  await test('invalid navigation values are dropped, never rendered', () => {
    const merged = mergeStoreConfig(DEFAULT_CUSTOMIZATION, { navigation: 'javascript:alert(1)' });
    assert.strictEqual(merged.navigation, undefined);
  });

  // -------------------------------------------------------------------------
  console.log('\nBlog service — public visibility');
  // -------------------------------------------------------------------------
  const { BlogService } = require(path.join(DIST, 'blog', 'blog.service.js'));

  await test('listPublic is tenant-scoped and published-only', async () => {
    const calls = {};
    const prisma = {
      tenant: { findFirst: async (args) => { calls.tenant = args; return { id: 'tenant-a' }; } },
      blogPost: {
        count: async (args) => { calls.count = args; return 2; },
        findMany: async (args) => {
          calls.findMany = args;
          return [{ id: 'p1', title: 'Live post', handle: 'live', excerpt: 'e' }];
        },
      },
    };
    const svc = new BlogService(prisma);
    const result = await svc.listPublic('Khaadi', 1, 12);
    assert.strictEqual(calls.count.where.tenantId, 'tenant-a');
    assert.strictEqual(calls.count.where.isPublished, true);
    assert.strictEqual(calls.findMany.where.isPublished, true);
    assert.strictEqual(calls.findMany.where.tenantId, 'tenant-a');
    assert.strictEqual(result.meta.total, 2);
    assert.strictEqual(result.data.length, 1);
  });

  await test('getPublic throws 404 for drafts and unpublished posts', async () => {
    let query;
    const prisma = {
      tenant: { findFirst: async () => ({ id: 'tenant-a' }) },
      blogPost: { findFirst: async (args) => { query = args; return null; } },
    };
    const svc = new BlogService(prisma);
    await assert.rejects(() => svc.getPublic('khaadi', 'Draft-Post'), /Post not found/);
    assert.strictEqual(query.where.isPublished, true);
    assert.strictEqual(query.where.tenantId, 'tenant-a');
    assert.strictEqual(query.where.handle, 'draft-post');
  });

  await test('getPublic returns a published post for the right store only', async () => {
    let query;
    const row = { id: 'p1', tenantId: 'tenant-a', title: 'Live', handle: 'live', isPublished: true };
    const prisma = {
      tenant: { findFirst: async () => ({ id: 'tenant-a' }) },
      blogPost: { findFirst: async (args) => { query = args; return row; } },
    };
    const svc = new BlogService(prisma);
    const found = await svc.getPublic('khaadi', 'live');
    assert.strictEqual(found.id, 'p1');
    assert.strictEqual(query.where.isPublished, true);
  });

  await test('cross-tenant blog reads are rejected', async () => {
    let query;
    const prisma = { blogPost: { findFirst: async (args) => { query = args; return null; } } };
    const svc = new BlogService(prisma);
    await assert.rejects(() => svc.getOne('tenant-b', 'post-of-tenant-a'), /Post not found/);
    assert.deepStrictEqual(query.where, { id: 'post-of-tenant-a', tenantId: 'tenant-b' });
  });

  await test('cross-tenant blog updates and deletes never run', async () => {
    let updated = null;
    let deleted = null;
    const prisma = {
      blogPost: {
        findFirst: async () => null,
        update: async (args) => { updated = args; return {}; },
        delete: async (args) => { deleted = args; return {}; },
      },
    };
    const svc = new BlogService(prisma);
    await assert.rejects(() => svc.update('tenant-b', 'p1', { title: 'Hijack' }), /Post not found/);
    await assert.rejects(() => svc.remove('tenant-b', 'p1'), /Post not found/);
    assert.strictEqual(updated, null);
    assert.strictEqual(deleted, null);
  });

  await test('publishing a draft stamps publishedAt', async () => {
    let updateArgs;
    const existing = { id: 'p1', tenantId: 'tenant-a', title: 'Draft', handle: 'draft', isPublished: false };
    const prisma = {
      blogPost: {
        findFirst: async () => existing,
        update: async (args) => { updateArgs = args; return { ...existing, ...args.data }; },
      },
    };
    const svc = new BlogService(prisma);
    await svc.update('tenant-a', 'p1', { isPublished: true });
    assert.strictEqual(updateArgs.data.isPublished, true);
    assert.ok(updateArgs.data.publishedAt instanceof Date);
  });

  await test('duplicating a post creates a tenant-owned draft with a unique handle', async () => {
    let created;
    const src = {
      id: 'p1', tenantId: 'tenant-a', title: 'News', handle: 'news', excerpt: 'e',
      content: 'c', author: null, imageUrl: null, seoTitle: 'SEO', seoDescription: 'Desc',
    };
    const prisma = {
      blogPost: {
        findFirst: async (args) => (args.where.id ? src : null),
        create: async (args) => { created = args; return { ...src, ...args.data }; },
      },
    };
    const svc = new BlogService(prisma);
    await svc.duplicate('tenant-a', 'p1');
    assert.strictEqual(created.data.tenantId, 'tenant-a');
    assert.strictEqual(created.data.isPublished, false);
    assert.strictEqual(created.data.publishedAt, null);
    assert.strictEqual(created.data.handle, 'news-copy');
    assert.strictEqual(created.data.seoTitle, 'SEO');
    assert.strictEqual(created.data.seoDescription, 'Desc');
  });

  await test('duplicating a post from another tenant is rejected', async () => {
    let created = null;
    const prisma = {
      blogPost: {
        findFirst: async () => null,
        create: async (args) => { created = args; return {}; },
      },
    };
    const svc = new BlogService(prisma);
    await assert.rejects(() => svc.duplicate('tenant-b', 'p1'), /Post not found/);
    assert.strictEqual(created, null);
  });

  await test('rejects unsafe featured-image references', async () => {
    let created = null;
    const prisma = {
      blogPost: {
        findFirst: async () => null,
        create: async (args) => { created = args; return {}; },
      },
    };
    const svc = new BlogService(prisma);
    for (const imageUrl of [
      'javascript:alert(1)',
      'data:image/svg+xml,x',
      '//evil.example/a.png',
      '/ok" onerror="x',
      '/\\evil.example/a.png',
    ]) {
      await assert.rejects(
        () => svc.create('tenant-a', { title: 'Test post', excerpt: '', content: 'c', imageUrl }),
        /imageUrl must be/,
        imageUrl,
      );
    }
    assert.strictEqual(created, null);
  });

  await test('rejects whitespace-only blog titles', async () => {
    const svc = new BlogService({});
    await assert.rejects(
      () => svc.create('tenant-a', { title: '   ', excerpt: '', content: 'c' }),
      /Title is required/,
    );
  });

  await test('updating with empty author/image clears both fields', async () => {
    let updateArgs;
    const existing = {
      id: 'p1', tenantId: 'tenant-a', title: 'Post', handle: 'post',
      excerpt: '', content: 'c', author: 'Old', imageUrl: '/uploads/old.jpg',
      isPublished: false,
    };
    const prisma = {
      blogPost: {
        findFirst: async () => existing,
        update: async (args) => { updateArgs = args; return { ...existing, ...args.data }; },
      },
    };
    const svc = new BlogService(prisma);
    await svc.update('tenant-a', 'p1', { author: '', imageUrl: '' });
    assert.strictEqual(updateArgs.data.author, null);
    assert.strictEqual(updateArgs.data.imageUrl, null);
  });

  await test('accepts http(s) and root-relative featured images', async () => {
    let created;
    const prisma = {
      blogPost: {
        findFirst: async () => null,
        create: async (args) => { created = args; return { ...args.data }; },
      },
    };
    const svc = new BlogService(prisma);
    await svc.create('tenant-a', { title: 'Test post', excerpt: '', content: 'c', imageUrl: '/uploads/blog/a.jpg' });
    assert.strictEqual(created.data.imageUrl, '/uploads/blog/a.jpg');
    await svc.create('tenant-a', { title: 'Test post', excerpt: '', content: 'c', imageUrl: 'https://cdn.example.com/a.jpg' });
    assert.strictEqual(created.data.imageUrl, 'https://cdn.example.com/a.jpg');
  });

  // -------------------------------------------------------------------------
  console.log('\nPages service — tenant isolation and public visibility');
  // -------------------------------------------------------------------------
  const { StoreSettingsService } = require(path.join(
    DIST,
    'store-settings',
    'store-settings.service.js',
  ));

  await test('public page lookup requires isPublished and the store subdomain', async () => {
    let query;
    const prisma = { storePage: { findFirst: async (args) => { query = args; return null; } } };
    const svc = new StoreSettingsService(prisma);
    await assert.rejects(() => svc.getPublicPage('Khaadi', 'About'), /Page not found/);
    assert.strictEqual(query.where.isPublished, true);
    assert.strictEqual(query.where.slug, 'about');
    assert.ok(Array.isArray(query.where.tenant.OR));
    assert.strictEqual(query.where.tenant.OR[0].subdomain, 'khaadi');
  });

  await test('public page listing is published-only', async () => {
    let query;
    const prisma = { storePage: { findMany: async (args) => { query = args; return []; } } };
    const svc = new StoreSettingsService(prisma);
    await svc.listPublicPages('khaadi');
    assert.strictEqual(query.where.isPublished, true);
    assert.ok(Array.isArray(query.where.tenant.OR));
  });

  await test('rejects whitespace-only page titles', async () => {
    const svc = new StoreSettingsService({});
    await assert.rejects(
      () => svc.createPage('tenant-a', { title: '  ' }),
      /Title is required/,
    );
  });

  await test('cross-tenant page delete never runs', async () => {
    let deleted = null;
    const prisma = {
      storePage: {
        findFirst: async () => null,
        delete: async (args) => { deleted = args; return {}; },
      },
    };
    const svc = new StoreSettingsService(prisma);
    await assert.rejects(() => svc.deletePage('tenant-b', 'page-of-tenant-a'), /Page not found/);
    assert.strictEqual(deleted, null);
  });

  await test('cross-tenant page update never runs', async () => {
    let updated = null;
    const prisma = {
      storePage: {
        findFirst: async () => null,
        update: async (args) => { updated = args; return {}; },
      },
    };
    const svc = new StoreSettingsService(prisma);
    await assert.rejects(() => svc.updatePage('tenant-b', 'p1', { title: 'Hijack' }), /Page not found/);
    assert.strictEqual(updated, null);
  });

  await test('duplicating a page creates a tenant-owned draft', async () => {
    let created;
    const page = {
      id: 'p1', tenantId: 'tenant-a', slug: 'about', title: 'About', content: 'hello',
      isPublished: true, seoTitle: 'About SEO', seoDescription: 'About desc',
    };
    const prisma = {
      storePage: {
        findFirst: async (args) => (args.where.id ? page : null),
        create: async (args) => { created = args; return { ...page, ...args.data }; },
      },
    };
    const svc = new StoreSettingsService(prisma);
    await svc.duplicatePage('tenant-a', 'p1');
    assert.strictEqual(created.data.tenantId, 'tenant-a');
    assert.strictEqual(created.data.isPublished, false);
    assert.strictEqual(created.data.slug, 'about-copy');
    assert.strictEqual(created.data.seoTitle, 'About SEO');
    assert.strictEqual(created.data.seoDescription, 'About desc');
  });

  await test('duplicating a page from another tenant is rejected', async () => {
    let created = null;
    const prisma = {
      storePage: {
        findFirst: async () => null,
        create: async (args) => { created = args; return {}; },
      },
    };
    const svc = new StoreSettingsService(prisma);
    await assert.rejects(() => svc.duplicatePage('tenant-b', 'p1'), /Page not found/);
    assert.strictEqual(created, null);
  });

  // -------------------------------------------------------------------------
  console.log('\nAdditive migration SQL');
  // -------------------------------------------------------------------------
  const migrations = path.join(ROOT, 'packages', 'database', 'prisma', 'migrations');

  await test('0002 adds page SEO columns without destructive SQL', () => {
    const sql = readSql(path.join(migrations, '0002_store_pages_seo.sql'));
    assert.match(sql, /ALTER TABLE "store_pages"/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "seoTitle"/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "seoDescription"/);
    assert.strictEqual((sql.match(/ALTER TABLE/gi) || []).length, 1);
    assert.ok(!/DROP\s+COLUMN|DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|--force-reset|--accept-data-loss/i.test(sql));
  });

  await test('0003 adds blog SEO columns without destructive SQL', () => {
    const sql = readSql(path.join(migrations, '0003_blog_posts_seo.sql'));
    assert.match(sql, /ALTER TABLE "blog_posts"/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "seoTitle"/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS "seoDescription"/);
    assert.strictEqual((sql.match(/ALTER TABLE/gi) || []).length, 1);
    assert.ok(!/DROP\s+COLUMN|DROP\s+TABLE|DELETE\s+FROM|TRUNCATE|--force-reset|--accept-data-loss/i.test(sql));
  });

  // -------------------------------------------------------------------------
  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) process.exit(1);
})().catch((e) => {
  console.error('\nUnexpected test runner failure:', e);
  process.exit(1);
});
