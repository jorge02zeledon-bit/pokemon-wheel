import { config } from "@/server/config";
import type { StorageProvider } from "./StorageProvider";
import { LocalStorageProvider } from "./LocalStorageProvider";
import { S3StorageProvider } from "./S3StorageProvider";

let instance: StorageProvider | null = null;

/** Storage provider selected by STORAGE_PROVIDER ("local" | "s3"). */
export function getStorageProvider(): StorageProvider {
  if (instance) return instance;
  switch (config.storageProvider) {
    case "s3":
      instance = new S3StorageProvider();
      break;
    case "local":
      instance = new LocalStorageProvider();
      break;
    default:
      throw new Error(`Unknown STORAGE_PROVIDER "${config.storageProvider}"`);
  }
  return instance;
}

export type { StorageProvider, StoredFile } from "./StorageProvider";
