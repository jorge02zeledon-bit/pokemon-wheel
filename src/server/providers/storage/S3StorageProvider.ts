import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import type { StorageProvider, StoredFile } from "./StorageProvider";

/**
 * S3-compatible storage (AWS S3, Cloudflare R2, MinIO).
 * Env: S3_ENDPOINT (blank for AWS), S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID,
 * S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL (the public/CDN URL of the bucket).
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor() {
    const required = ["S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY", "S3_PUBLIC_BASE_URL"] as const;
    for (const k of required) if (!process.env[k]) throw new Error(`S3 storage: missing ${k}`);
    this.bucket = process.env.S3_BUCKET!;
    this.publicBase = process.env.S3_PUBLIC_BASE_URL!.replace(/\/$/, "");
    this.client = new S3Client({
      region: process.env.S3_REGION || "auto",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle: !!process.env.S3_ENDPOINT,
      credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
    });
  }

  async put({ key, body, contentType }: { key: string; body: Buffer; contentType: string }): Promise<StoredFile> {
    const fullKey = `products/${key}`;
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: fullKey, Body: body, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }),
    );
    return { url: `${this.publicBase}/${fullKey}`, key: fullKey };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
