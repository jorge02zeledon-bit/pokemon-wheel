/**
 * Abstraction over where uploaded product photos live.
 * Implementations: LocalStorageProvider (public/uploads, dev only) and
 * S3StorageProvider (AWS S3, Cloudflare R2, MinIO or any S3-compatible API).
 */
export interface StoredFile {
  /** Public URL to render the image from. */
  url: string;
  /** Provider-specific key, kept for later deletion. */
  key: string;
}

export interface StorageProvider {
  readonly name: string;
  put(input: { key: string; body: Buffer; contentType: string }): Promise<StoredFile>;
  delete(key: string): Promise<void>;
}
