import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { INTEGRATION_PROVIDERS, UpsertIntegrationDto } from './dto';

/**
 * Per-tenant integration credentials (gateways, couriers, SMS, FBR, IBFT/RAAST details).
 * Secrets are WRITE-ONLY: reads return provider status + field NAMES, never values.
 */
@Injectable()
export class IntegrationsService {
  constructor(private prisma: PrismaService) {}

  async list(tenantId: string) {
    const rows = await this.prisma.integrationSetting.findMany({
      where: { tenantId },
    });
    const byProvider = new Map(rows.map((r) => [r.provider, r]));

    return INTEGRATION_PROVIDERS.map((provider) => {
      const row = byProvider.get(provider);
      if (!row) {
        return { provider, configured: false, sandbox: true, fields: [] as string[], updatedAt: null };
      }
      const config = this.parseConfig(row.configJson);
      return {
        provider,
        configured: Object.keys(config).length > 0,
        sandbox: row.sandbox,
        fields: Object.keys(config),
        updatedAt: row.updatedAt,
      };
    });
  }

  async upsert(tenantId: string, provider: string, dto: UpsertIntegrationDto) {
    const normalized = provider.trim().toUpperCase();
    if (!(INTEGRATION_PROVIDERS as readonly string[]).includes(normalized)) {
      throw new BadRequestException(`Unknown integration provider: ${normalized}`);
    }

    const existing = await this.prisma.integrationSetting.findUnique({
      where: { tenantId_provider: { tenantId, provider: normalized } },
    });
    const oldConfig = existing ? this.parseConfig(existing.configJson) : {};

    // Blank values keep the previously stored secret (values are write-only)
    const merged: Record<string, string> = { ...oldConfig };
    for (const [key, value] of Object.entries(dto.config ?? {})) {
      if (value === undefined || value === null) continue;
      const str = String(value).trim();
      if (str === '__CLEAR__') {
        delete merged[key];
        continue;
      }
      if (str === '') continue; // keep stored value
      merged[key] = str;
    }
    for (const key of Object.keys(merged)) {
      if (String(merged[key] ?? '').trim() === '') delete merged[key];
    }

    const sandbox = dto.sandbox ?? existing?.sandbox ?? true;
    const data = JSON.stringify(merged);
    if (data.length > 8000) {
      throw new BadRequestException('Integration configuration payload too large');
    }

    const saved = await this.prisma.integrationSetting.upsert({
      where: { tenantId_provider: { tenantId, provider: normalized } },
      create: { tenantId, provider: normalized, configJson: data, sandbox },
      update: { configJson: data, sandbox },
    });

    console.log(
      `[Integrations] ${normalized} saved — keys: ${Object.keys(merged).join(', ') || '(none)'} · sandbox=${sandbox}`,
    );
    return {
      provider: normalized,
      configured: Object.keys(merged).length > 0,
      sandbox: saved.sandbox,
      fields: Object.keys(merged),
      updatedAt: saved.updatedAt,
    };
  }

  private parseConfig(json: string): Record<string, string> {
    try {
      const parsed = JSON.parse(json);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      return {};
    }
  }
}
