import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { requireAdmin } from "@/server/guards";
import { getStorageProvider } from "@/server/providers/storage";
import { setProductImage } from "@/server/admin/products";
import { apiError } from "@/server/api";
import { ValidationError } from "@/server/engine/errors";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/**
 * POST /api/admin/uploads  multipart: file, productId
 * Stores a product photo through the StorageProvider and attaches it.
 * Only admin-uploaded photos are ever shown; nothing is fetched from the web.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const form = await req.formData();
    const file = form.get("file");
    const productId = form.get("productId");
    if (!(file instanceof File)) throw new ValidationError("Choose an image file");
    if (typeof productId !== "string" || !productId) throw new ValidationError("Missing product");
    const ext = TYPES[file.type];
    if (!ext) throw new ValidationError("Use a JPEG, PNG or WebP image");
    if (file.size > MAX_BYTES) throw new ValidationError("Image must be 5 MB or smaller");
    const body = Buffer.from(await file.arrayBuffer());
    // Sniff magic bytes so a renamed file cannot slip through as an image.
    const ok =
      (ext === "jpg" && body[0] === 0xff && body[1] === 0xd8) ||
      (ext === "png" && body.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) ||
      (ext === "webp" && body.subarray(0, 4).toString() === "RIFF" && body.subarray(8, 12).toString() === "WEBP");
    if (!ok) throw new ValidationError("File content does not match its image type");

    const stored = await getStorageProvider().put({ key: `${productId}-${randomBytes(6).toString("hex")}.${ext}`, body, contentType: file.type });
    await setProductImage(admin.id, productId, stored.url);
    return NextResponse.json({ url: stored.url });
  } catch (e) {
    return apiError(e);
  }
}
