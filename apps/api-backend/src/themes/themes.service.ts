import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { validateThemeZip } from './theme-zip.util';
import { THEME_LIBRARY_PRESETS } from './theme-presets';
import { THEME_LIBRARY_V1_JSON } from './theme-presets-v1';

const MAX_NAME = 80;
const THEME_VERSION_LABEL_MAX = 120;
const MAX_CONFIG_JSON = 1_000_000; // 1 MB of design JSON is far beyond any real theme

const cleanName = (raw: unknown): string => {
  const name = String(raw ?? '').trim();
  if (name.length < 2 || name.length > MAX_NAME) {
    throw new BadRequestException(`Theme name must be 2–${MAX_NAME} characters`);
  }
  return name;
};

/**
 * Theme Library service.
 * Themes are design-only snapshots of the storefront customization config.
 * They never read or write products, orders, customers, payments, courier or
 * COD data. All queries are tenant-scoped.
 */
@Injectable()
export class ThemesService {
  private readonly logger = new Logger(ThemesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // Lazy seed:
  //  • a store with no themes gets "Current theme" (from the live
  //    StoreSettings config) created as its PUBLISHED theme — once.
  //  • every store gets the bundled Shopify-style theme library
  //    (Dawn, Refresh, Craft, Taste, Sense, Ride) installed once — tracked
  //    by source=SYSTEM_LIBRARY so renames/deletes are respected.
  // ─────────────────────────────────────────────────────────────────────
  private async ensureSeedTheme(tenantId: string) {
    const count = await this.prisma.theme.count({ where: { tenantId } });
    if (count === 0) {
      const settings = await this.prisma.storeSettings.findUnique({ where: { tenantId } });
      const configJson = settings?.configJson ?? '{}';
      const theme = await this.prisma.theme.create({
        data: {
          id: randomUUID(),
          tenantId,
          name: 'Current theme',
          status: 'PUBLISHED',
          source: 'SYSTEM',
          configJson,
        },
      });
      await this.createVersion(tenantId, theme.id, 'Initial theme (auto-created)');
    }
    await this.ensureThemeLibrary(tenantId);
  }

  /** Install the bundled theme library once per tenant (idempotent). */
  private async ensureThemeLibrary(tenantId: string) {
    const installed = await this.prisma.theme.findFirst({
      where: { tenantId, source: 'SYSTEM_LIBRARY' },
      select: { id: true },
    });
    if (!installed) {
      for (const preset of THEME_LIBRARY_PRESETS) {
        const exists = await this.prisma.theme.findFirst({
          where: { tenantId, name: preset.name },
          select: { id: true },
        });
        if (exists) continue; // merchant already has a theme with this name
        const theme = await this.prisma.theme.create({
          data: {
            id: randomUUID(),
            tenantId,
            name: preset.name,
            status: 'UNPUBLISHED',
            source: 'SYSTEM_LIBRARY',
            configJson: JSON.stringify(preset.config),
          },
        });
        await this.createVersion(tenantId, theme.id, `Installed from theme library`);
      }
      this.logger.log(`Theme library installed: tenant=${tenantId} themes=${THEME_LIBRARY_PRESETS.length}`);
    }
    // Refresh designs for stores that shipped the ORIGINAL presets.
    await this.refreshThemeLibrary(tenantId);
  }

  /**
   * Upgrade STILL-UNTOUCHED library themes to the refreshed v2 designs.
   * Non-destructive by construction: a library theme is only replaced when
   * its stored configJson exactly equals the ORIGINAL shipped v1 preset
   * (see theme-presets-v1). Any merchant edit, rename or duplicate means the
   * JSON differs and the theme is left alone. Replacing a matched theme is
   * witnessed by an appended "Design updated" version — history is never
   * rewritten and nothing merchant-authored is ever overwritten.
   */
  private async refreshThemeLibrary(tenantId: string) {
    for (const preset of THEME_LIBRARY_PRESETS) {
      const v1Json = THEME_LIBRARY_V1_JSON[preset.name];
      if (!v1Json) continue;
      const existing = await this.prisma.theme.findFirst({
        where: { tenantId, name: preset.name, source: 'SYSTEM_LIBRARY' },
        select: { id: true, configJson: true },
      });
      if (!existing) continue;
      if (existing.configJson === JSON.stringify(preset.config)) continue; // already refreshed
      if (existing.configJson !== v1Json) continue; // merchant-touched — never modify
      try {
        await this.prisma.$transaction(async (tx) => {
          const v2Json = JSON.stringify(preset.config);
          await tx.theme.update({ where: { id: existing.id }, data: { configJson: v2Json } });
          const latest = await tx.themeVersion.findFirst({
            where: { themeId: existing.id },
            orderBy: { versionNumber: 'desc' },
            select: { versionNumber: true },
          });
          await tx.themeVersion.create({
            data: {
              themeId: existing.id,
              tenantId,
              versionNumber: (latest?.versionNumber ?? 0) + 1,
              configJson: v2Json,
              label: 'Design updated',
            },
          });
        });
        this.logger.log(`Theme library refreshed: tenant=${tenantId} theme="${preset.name}"`);
      } catch (e: any) {
        // Refresh is opportunistic — never block the themes list on it.
        this.logger.warn(`Theme library refresh skipped for "${preset.name}": ${e?.message ?? e}`);
      }
    }
  }

  /** Small design snippet for admin theme cards (Shopify-style thumbnails). */
  private previewOf(configJson: string) {
    const fallback = { primary: '#059669', accent: '#0d9488', heroTitle: '', schemes: [] };
    const mini = (c: any) => {
      const colors = c && typeof c === 'object' ? (c as any).colors ?? {} : {};
      return {
        bg: typeof colors.background === 'string' ? colors.background : '',
        text: typeof colors.text === 'string' ? colors.text : '',
        heading: typeof colors.heading === 'string' ? colors.heading : '',
        button: typeof colors.button === 'string' ? colors.button : '',
        buttonText: typeof colors.buttonText === 'string' ? colors.buttonText : '',
      };
    };
    try {
      const c = JSON.parse(configJson) as any;
      const raw = Array.isArray(c?.colorSchemes?.schemes) ? c.colorSchemes.schemes.slice(0, 5) : [];
      const schemes = Array.from({ length: 5 }, (_, i) => mini(raw[i]));
      const s0 = schemes[0];
      const s2 = schemes[2];
      return {
        primary: typeof c?.theme?.primary === 'string' ? c.theme.primary : s0.button || '#059669',
        accent: typeof c?.theme?.accent === 'string' ? c.theme.accent : s2.button || '#0d9488',
        heroTitle: typeof c?.hero?.title === 'string' ? c.hero.title.slice(0, 120) : '',
        schemes,
      };
    } catch {
      return fallback;
    }
  }

  private async latestVersionNumber(themeId: string) {
    const latest = await this.prisma.themeVersion.findFirst({
      where: { themeId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    return latest?.versionNumber ?? 0;
  }

  private async createVersion(tenantId: string, themeId: string, label?: string) {
    const theme = await this.prisma.theme.findFirst({
      where: { id: themeId, tenantId },
      select: { configJson: true },
    });
    if (!theme) throw new NotFoundException('Theme not found');
    const versionNumber = (await this.latestVersionNumber(themeId)) + 1;
    return this.prisma.themeVersion.create({
      data: {
        themeId,
        tenantId,
        versionNumber,
        configJson: theme.configJson,
        label: label ? String(label).slice(0, THEME_VERSION_LABEL_MAX) : null,
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Reads
  // ─────────────────────────────────────────────────────────────────────
  async list(tenantId: string) {
    await this.ensureSeedTheme(tenantId);
    const themes = await this.prisma.theme.findMany({
      where: { tenantId },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: {
        _count: { select: { versions: true, assets: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { versionNumber: true } },
      },
    });
    return {
      storageEnabled: this.storage.isEnabled(),
      themes: themes.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status,
        source: t.source,
        basedOnThemeId: t.basedOnThemeId,
        versionCount: t._count.versions,
        latestVersion: t.versions[0]?.versionNumber ?? 0,
        assetCount: t._count.assets,
        preview: this.previewOf(t.configJson),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    };
  }

  async getOne(tenantId: string, id: string) {
    await this.ensureSeedTheme(tenantId);
    const theme = await this.prisma.theme.findFirst({
      where: { id, tenantId },
      include: {
        _count: { select: { versions: true, assets: true } },
        versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { versionNumber: true } },
      },
    });
    if (!theme) throw new NotFoundException('Theme not found');
    return {
      id: theme.id,
      name: theme.name,
      status: theme.status,
      source: theme.source,
      basedOnThemeId: theme.basedOnThemeId,
      configJson: theme.configJson,
      versionCount: theme._count.versions,
      latestVersion: theme.versions[0]?.versionNumber ?? 0,
      assetCount: theme._count.assets,
      createdAt: theme.createdAt,
      updatedAt: theme.updatedAt,
    };
  }

  async listVersions(tenantId: string, id: string) {
    const theme = await this.prisma.theme.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!theme) throw new NotFoundException('Theme not found');
    return this.prisma.themeVersion.findMany({
      where: { themeId: id, tenantId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, label: true, createdAt: true },
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // Mutations
  // ─────────────────────────────────────────────────────────────────────
  async duplicate(tenantId: string, id: string) {
    const src = await this.prisma.theme.findFirst({ where: { id, tenantId } });
    if (!src) throw new NotFoundException('Theme not found');
    const name = `${src.name} (copy)`.slice(0, MAX_NAME);
    const theme = await this.prisma.theme.create({
      data: {
        tenantId,
        name,
        status: 'UNPUBLISHED',
        source: 'DUPLICATE',
        configJson: src.configJson,
        basedOnThemeId: src.id,
      },
    });
    await this.createVersion(tenantId, theme.id, `Copied from “${src.name}”`);
    return { id: theme.id, name: theme.name };
  }

  async rename(tenantId: string, id: string, rawName: unknown) {
    const name = cleanName(rawName);
    const result = await this.prisma.theme.updateMany({
      where: { id, tenantId },
      data: { name },
    });
    if (result.count === 0) throw new NotFoundException('Theme not found');
    return { renamed: true, name };
  }

  async remove(tenantId: string, id: string) {
    const theme = await this.prisma.theme.findFirst({ where: { id, tenantId } });
    if (!theme) throw new NotFoundException('Theme not found');
    if (theme.status === 'PUBLISHED') {
      throw new BadRequestException(
        'Cannot delete the published theme. Publish another theme first, then delete this one.',
      );
    }
    // best-effort asset cleanup in R2
    const assets = await this.prisma.themeAsset.findMany({ where: { themeId: id, tenantId } });
    await Promise.all(assets.map((a) => this.storage.deleteObject(a.key)));
    await this.prisma.theme.delete({ where: { id } }); // versions/assets cascade
    return { deleted: true };
  }

  /**
   * Publish steps to run INSIDE an interactive transaction:
   * unpublish all tenant themes → publish this one → sync StoreSettings
   * → append a "Published" version snapshot. All-or-nothing.
   */
  private async publishInTx(tx: any, tenantId: string, theme: { id: string; configJson: string }) {
    await tx.theme.updateMany({ where: { tenantId, status: 'PUBLISHED' }, data: { status: 'UNPUBLISHED' } });
    await tx.theme.update({ where: { id: theme.id }, data: { status: 'PUBLISHED' } });
    await tx.storeSettings.upsert({
      where: { tenantId },
      create: { tenantId, configJson: theme.configJson },
      update: { configJson: theme.configJson },
    });
    const latest = await tx.themeVersion.findFirst({
      where: { themeId: theme.id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    });
    const versionNumber = (latest?.versionNumber ?? 0) + 1;
    await tx.themeVersion.create({
      data: {
        themeId: theme.id,
        tenantId,
        versionNumber,
        configJson: theme.configJson,
        label: 'Published',
      },
    });
  }

  private isUniqueViolation(e: any): boolean {
    const code = e?.code ?? e?.meta?.code;
    const target = JSON.stringify(e?.meta?.target ?? '');
    return code === 'P2002' && /one_published_per_tenant|status/.test(target);
  }

  /** Publish a theme: the storefront's live design switches to it. Business data untouched. */
  async publish(tenantId: string, id: string) {
    const theme = await this.prisma.theme.findFirst({ where: { id, tenantId } });
    if (!theme) throw new NotFoundException('Theme not found');
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.publishInTx(tx, tenantId, theme);
      });
    } catch (e: any) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException(
          'Another theme was published for this store at the same time. Reload and try again.',
        );
      }
      throw e;
    }
    return { published: true, id: theme.id };
  }

  /** Mark a theme unpublished. Storefront keeps the last published design (StoreSettings). */
  async unpublish(tenantId: string, id: string) {
    const result = await this.prisma.theme.updateMany({
      where: { id, tenantId, status: 'PUBLISHED' },
      data: { status: 'UNPUBLISHED' },
    });
    if (result.count === 0) throw new NotFoundException('Theme not found or not published');
    return { unpublished: true };
  }

  /** Manual snapshot of the theme's current config as a new version. */
  async snapshot(tenantId: string, id: string, label?: unknown) {
    const theme = await this.prisma.theme.findFirst({ where: { id, tenantId }, select: { id: true } });
    if (!theme) throw new NotFoundException('Theme not found');
    const v = await this.createVersion(tenantId, id, typeof label === 'string' ? label : undefined);
    return { versionNumber: v.versionNumber };
  }

  /**
   * Save theme-editor changes into a theme (Shopify theme editor → Save).
   * A draft theme saves as a draft only; the published (live) theme also
   * syncs StoreSettings in the same transaction so the storefront updates
   * immediately — exactly like Shopify's live-theme editor.
   */
  async updateConfig(tenantId: string, id: string, rawConfig: unknown) {
    if (!rawConfig || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
      throw new BadRequestException('config must be a JSON object');
    }
    const json = JSON.stringify(rawConfig);
    if (json.length > MAX_CONFIG_JSON) {
      throw new BadRequestException('Theme config too large (max 1 MB)');
    }
    const theme = await this.prisma.theme.findFirst({ where: { id, tenantId } });
    if (!theme) throw new NotFoundException('Theme not found');
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.theme.update({ where: { id: theme.id }, data: { configJson: json } });
        if (theme.status === 'PUBLISHED') {
          await tx.storeSettings.upsert({
            where: { tenantId },
            create: { tenantId, configJson: json },
            update: { configJson: json },
          });
        }
      });
    } catch (e: any) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException(
          'Another theme was published for this store at the same time. Reload and try again.',
        );
      }
      throw e;
    }
    return { saved: true, id: theme.id, live: theme.status === 'PUBLISHED' };
  }

  /** Restore an earlier version — auditable. Fully atomic: config restore,
   *  audit version, publish and StoreSettings sync all commit or all roll back. */
  async restoreVersion(tenantId: string, id: string, versionNumber: number, publish: boolean) {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const theme = await tx.theme.findFirst({ where: { id, tenantId } });
        if (!theme) throw new NotFoundException('Theme not found');
        const version = await tx.themeVersion.findFirst({
          where: { themeId: id, tenantId, versionNumber },
        });
        if (!version) throw new NotFoundException(`Version ${versionNumber} not found`);

        // 1) restore config into the theme
        await tx.theme.update({
          where: { id: theme.id },
          data: { configJson: version.configJson },
        });

        // 2) append the audit snapshot
        const latest = await tx.themeVersion.findFirst({
          where: { themeId: theme.id },
          orderBy: { versionNumber: 'desc' },
          select: { versionNumber: true },
        });
        let n = (latest?.versionNumber ?? 0) + 1;
        await tx.themeVersion.create({
          data: {
            themeId: theme.id,
            tenantId,
            versionNumber: n,
            configJson: version.configJson,
            label: `Restored from v${versionNumber}`,
          },
        });

        // 3) optionally publish the restored theme (unpublish others, sync StoreSettings, snapshot)
        if (publish) {
          await this.publishInTx(tx, tenantId, { id: theme.id, configJson: version.configJson });
        }

        return { restored: true, from: versionNumber, publish };
      });
      return result;
    } catch (e: any) {
      if (this.isUniqueViolation(e)) {
        throw new ConflictException(
          'Another theme was published for this store at the same time. Reload and try again.',
        );
      }
      throw e;
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // ZIP import
  // ─────────────────────────────────────────────────────────────────────
  async importTheme(tenantId: string, buffer: Buffer) {
    if (!buffer || buffer.length === 0) throw new BadRequestException('Empty upload');
    const result = validateThemeZip(buffer);
    if (!result.ok || !result.pkg) {
      throw new BadRequestException({ message: 'Theme validation failed', errors: result.errors, warnings: result.warnings });
    }
    const pkg = result.pkg;

    if (pkg.assets.length > 0 && !this.storage.isEnabled()) {
      throw new BadRequestException({
        message: 'Theme contains assets, but R2 storage is not configured on the server.',
        errors: [
          'Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (and R2_PUBLIC_URL) or import a theme without assets.',
        ],
        warnings: pkg.warnings,
      });
    }

    const themeId = randomUUID();

    // upload assets first (no theme row until every asset is stored)
    const stored: { key: string; filename: string; bytes: number; contentType: string }[] = [];
    for (const asset of pkg.assets) {
      const key = `themes/${tenantId}/${themeId}/assets/${asset.filename}`;
      const saved = await this.storage.putObject(key, asset.buffer, asset.contentType);
      stored.push({ key: saved.key, filename: asset.filename, bytes: saved.bytes, contentType: asset.contentType });
    }

    const theme = await this.prisma.theme.create({
      data: {
        id: themeId,
        tenantId,
        name: pkg.name.slice(0, MAX_NAME),
        status: 'UNPUBLISHED',
        source: 'UPLOAD',
        configJson: JSON.stringify(pkg.config),
      },
    });
    if (stored.length) {
      await this.prisma.themeAsset.createMany({
        data: stored.map((a) => ({
          themeId,
          tenantId,
          kind: 'asset',
          key: a.key,
          filename: a.filename,
          bytes: a.bytes,
        })),
      });
    }
    await this.createVersion(tenantId, theme.id, `Imported “${pkg.name}” v${pkg.version}`);
    this.logger.log(`Theme imported: tenant=${tenantId} name="${pkg.name}" assets=${stored.length}`);
    return {
      installed: true,
      id: theme.id,
      name: theme.name,
      assets: stored.length,
      warnings: pkg.warnings,
    };
  }
}
