import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { validateThemeZip } from './theme-zip.util';

const MAX_NAME = 80;
const THEME_VERSION_LABEL_MAX = 120;

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
  // Lazy seed: a store with no themes gets "Current theme" (from the live
  // StoreSettings config) created as its PUBLISHED theme — once.
  // ─────────────────────────────────────────────────────────────────────
  private async ensureSeedTheme(tenantId: string) {
    const count = await this.prisma.theme.count({ where: { tenantId } });
    if (count > 0) return;
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

  /** Publish a theme: the storefront's live design switches to it. Business data untouched. */
  async publish(tenantId: string, id: string) {
    const theme = await this.prisma.theme.findFirst({ where: { id, tenantId } });
    if (!theme) throw new NotFoundException('Theme not found');
    await this.prisma.$transaction(async (tx) => {
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
    });
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

  /** Restore an earlier version — auditable (creates a NEW version, never rewrites history). */
  async restoreVersion(tenantId: string, id: string, versionNumber: number, publish: boolean) {
    const version = await this.prisma.themeVersion.findFirst({
      where: { themeId: id, tenantId, versionNumber },
    });
    if (!version) throw new NotFoundException(`Version ${versionNumber} not found`);
    await this.prisma.theme.update({
      where: { id },
      data: { configJson: version.configJson },
    });
    await this.createVersion(tenantId, id, `Restored from v${versionNumber}`);
    if (publish) {
      await this.publish(tenantId, id);
    }
    return { restored: true, from: versionNumber };
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
