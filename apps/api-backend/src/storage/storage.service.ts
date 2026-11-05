import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

/**
 * Storage abstraction for Pak Commerce.
 * Theme ZIP assets (images/fonts) live in Cloudflare R2 when configured.
 * Credentials are read from env vars only — never hardcoded, never committed.
 *
 * Required env for R2:
 *   R2_ENDPOINT        e.g. https://<account-id>.r2.cloudflarestorage.com
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET          e.g. pak-commerce-assets
 *   R2_PUBLIC_URL      public bucket base URL, e.g. https://assets.pakcommerce.pk
 *                      (assets are served to storefront visitors from here)
 */
export interface StoredObject {
  key: string;
  publicUrl: string | null;
  bytes: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null = null;
  private readonly bucket: string | null = null;
  private readonly publicBase: string | null = null;

  constructor() {
    const endpoint = process.env.R2_ENDPOINT;
    const accessKeyId = process.env.R2_ACCESS_KEY_ID;
    const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucket = process.env.R2_BUCKET;
    if (endpoint && accessKeyId && secretAccessKey && bucket) {
      this.client = new S3Client({
        region: 'auto',
        endpoint,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.bucket = bucket;
      this.publicBase = (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, '') || null;
      this.logger.log(`R2 storage enabled (bucket: ${bucket})`);
    } else {
      this.logger.warn(
        'R2 storage NOT configured — theme assets disabled. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET (and R2_PUBLIC_URL).',
      );
    }
  }

  isEnabled(): boolean {
    return this.client !== null;
  }

  async putObject(key: string, body: Buffer, contentType: string): Promise<StoredObject> {
    if (!this.client || !this.bucket) {
      throw new Error('R2 storage is not configured');
    }
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }),
    );
    return {
      key,
      publicUrl: this.publicBase ? `${this.publicBase}/${key}` : null,
      bytes: body.length,
    };
  }

  async deleteObject(key: string): Promise<void> {
    if (!this.client || !this.bucket) return; // nothing stored; nothing to delete
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    } catch (e: any) {
      this.logger.warn(`Failed to delete object ${key}: ${e?.message ?? e}`);
    }
  }
}
