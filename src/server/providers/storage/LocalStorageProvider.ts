import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider, StoredFile } from "./StorageProvider";

/**
 * Writes files under public/uploads so Next serves them statically.
 * Development only: on Vercel the filesystem is ephemeral, so production must
 * use the S3 provider (Cloudflare R2 is the planned target).
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private readonly dir = path.join(process.cwd(), "public", "uploads");

  async put({ key, body }: { key: string; body: Buffer; contentType: string }): Promise<StoredFile> {
    const safe = key.replace(/[^a-zA-Z0-9._-]/g, "_");
    await mkdir(this.dir, { recursive: true });
    await writeFile(path.join(this.dir, safe), body);
    return { url: `/uploads/${safe}`, key: safe };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(path.join(this.dir, key.replace(/[^a-zA-Z0-9._-]/g, "_")));
    } catch {
      /* already gone */
    }
  }
}
