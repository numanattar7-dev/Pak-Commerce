import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CSV_COLUMNS = [
  'title',
  'titleUrdu',
  'description',
  'category',
  'tags',
  'images',
  'variantTitle',
  'sku',
  'price',
  'compareAtPrice',
  'stockQuantity',
] as const;

interface CsvRow {
  title: string;
  titleUrdu: string;
  description: string;
  category: string;
  tags: string[];
  images: string[];
  variantTitle: string;
  sku: string;
  price: number | null;
  compareAtPrice: number | null;
  stockQuantity: number;
}

@Injectable()
export class CsvService {
  private readonly logger = new Logger(CsvService.name);

  constructor(private prisma: PrismaService) {}

  // ------------------------------------------------------
  // Export: one row per variant (Shopify-style), UTF-8 BOM for Excel
  // ------------------------------------------------------

  async exportCsv(tenantId: string): Promise<string> {
    const products = await this.prisma.product.findMany({
      where: { tenantId },
      include: { variants: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });

    const lines: string[] = [CSV_COLUMNS.join(',')];
    for (const product of products) {
      const shared = {
        title: product.title,
        titleUrdu: product.titleUrdu || '',
        description: product.description || '',
        category: product.category,
        tags: (product.tags || []).join('|'),
        images: (product.images || []).join('|'),
      };
      // Product with no variants still exports once (with default row)
      const variants =
        product.variants.length > 0
          ? product.variants
          : [{ title: '', sku: '', price: 0, compareAtPrice: null, stockQuantity: 0 }];
      for (const v of variants) {
        lines.push(
          [
            shared.title,
            shared.titleUrdu,
            shared.description,
            shared.category,
            shared.tags,
            shared.images,
            v.title || 'Default',
            v.sku || '',
            String(v.price ?? ''),
            v.compareAtPrice == null ? '' : String(v.compareAtPrice),
            String(v.stockQuantity ?? 0),
          ]
            .map((cell) => this.csvCell(cell))
            .join(','),
        );
      }
    }

    // BOM so Excel opens the file with correct encoding
    return '\uFEFF' + lines.join('\r\n');
  }

  // ------------------------------------------------------
  // Import: upsert products by title, variants by (product, variant title)
  // ------------------------------------------------------

  async importCsv(tenantId: string, buffer: Buffer) {
    const rows = this.parseCsv(buffer);
    if (rows.length < 2) {
      throw new BadRequestException('CSV file is empty or has no data rows');
    }

    const headers = rows[0].map((h) => h.trim().toLowerCase());
    const required = ['title', 'price'];
    for (const col of required) {
      if (!headers.includes(col)) {
        throw new BadRequestException(`CSV is missing required column "${col}"`);
      }
    }

    let productsCreated = 0;
    let productsUpdated = 0;
    let variantsCreated = 0;
    let variantsUpdated = 0;
    const errors: string[] = [];

    const productCache = new Map<string, string>(); // title -> productId

    for (let i = 1; i < rows.length; i++) {
      const cells = rows[i];
      const row: any = {};
      CSV_COLUMNS.forEach((col, idx) => (row[col] = cells[idx] ?? ''));

      const title = (row.title || '').trim();
      if (!title) {
        errors.push(`Row ${i + 1}: missing "title" — skipped`);
        continue;
      }

      const price = this.parseMoney(row.price);
      if (price === null) {
        errors.push(`Row ${i + 1}: invalid price "${row.price}" — skipped`);
        continue;
      }

      try {
        // --- product upsert (by title within tenant) ---
        let productId = productCache.get(title);
        if (!productId) {
          const existing = await this.prisma.product.findFirst({
            where: { tenantId, title },
            select: { id: true },
          });
          if (existing) {
            productId = existing.id;
            productsUpdated++;
            if (row.description && row.description.trim() !== '') {
              await this.prisma.product.update({
                where: { id: productId },
                data: { description: row.description },
              });
            }
          } else {
            const created = await this.prisma.product.create({
              data: {
                tenantId,
                title,
                titleUrdu: row.titleUrdu || null,
                description: row.description || null,
                category: (row.category || 'Uncategorized').trim(),
                tags: this.splitList(row.tags),
                images: this.splitList(row.images),
              },
              select: { id: true },
            });
            productId = created.id;
            productsCreated++;
          }
          productCache.set(title, productId);
        }

        // --- variant upsert (by product + variant title) ---
        const variantTitle = (row.variantTitle || 'Default').trim();
        const stock = Math.max(0, Math.round(this.parseNumber(row.stockQuantity) ?? 0));
        const compare = this.parseMoney(row.compareAtPrice);

        const existingVariant = await this.prisma.productVariant.findFirst({
          where: { productId, title: variantTitle },
          select: { id: true },
        });

        if (existingVariant) {
          await this.prisma.productVariant.update({
            where: { id: existingVariant.id },
            data: {
              price,
              compareAtPrice: compare,
              stockQuantity: stock,
              sku: row.sku || null,
            },
          });
          variantsUpdated++;
        } else {
          await this.prisma.productVariant.create({
            data: {
              productId,
              title: variantTitle,
              sku: row.sku || null,
              price,
              compareAtPrice: compare,
              stockQuantity: stock,
            },
          });
          variantsCreated++;
        }
      } catch (err) {
        errors.push(`Row ${i + 1}: "${title}" — ${(err as Error).message}`);
        this.logger.warn(`CSV import row ${i + 1} failed: ${(err as Error).message}`);
      }
    }

    return {
      rows: rows.length - 1,
      productsCreated,
      productsUpdated,
      variantsCreated,
      variantsUpdated,
      errors: errors.slice(0, 20),
    };
  }

  // ------------------------------------------------------
  // CSV helpers
  // ------------------------------------------------------

  private csvCell(value: string): string {
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  // Quote-aware CSV parser: supports "a,b", escaped quotes, CRLF
  private parseCsv(buffer: Buffer): string[][] {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, '');
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c !== '\r') {
        field += c;
      }
    }
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows.filter((r) => r.some((f) => f.trim() !== ''));
  }

  private splitList(value: string): string[] {
    return (value || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Accepts "5,999", "Rs. 5999", "5999.00" → number | null
  private parseMoney(raw: string): number | null {
    if (raw == null || raw.trim() === '') return null;
    const cleaned = raw.replace(/[,\s]|Rs\.?|PKR/gi, '');
    const n = Number(cleaned);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
  }

  private parseNumber(raw: string): number | null {
    if (raw == null || raw.trim() === '') return null;
    const cleaned = raw.replace(/[,\s]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
}
