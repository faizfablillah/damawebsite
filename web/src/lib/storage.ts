import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR } from "@/db";
import { UPLOAD_MAX_BYTES } from "./config";

// Private file storage for payment proofs, student documents and corporate documents.
// Local disk in development; any S3-compatible bucket (e.g. Supabase Storage) when S3_BUCKET is set.

const ALLOWED: Record<string, { ext: string; magic: (b: Buffer) => boolean }> = {
  "application/pdf": { ext: "pdf", magic: (b) => b.subarray(0, 4).toString() === "%PDF" },
  "image/jpeg": { ext: "jpg", magic: (b) => b[0] === 0xff && b[1] === 0xd8 },
  "image/png": { ext: "png", magic: (b) => b.subarray(1, 4).toString() === "PNG" },
  "image/webp": { ext: "webp", magic: (b) => b.subarray(8, 12).toString() === "WEBP" },
};
export const ACCEPT_ATTR = "application/pdf,image/jpeg,image/png,image/webp";

export class UploadError extends Error {}

export async function validateUpload(file: FormDataEntryValue | null, label: string, required = true) {
  if (!file || typeof file === "string" || file.size === 0) {
    if (required) throw new UploadError(`Please attach ${label}.`);
    return null;
  }
  if (file.size > UPLOAD_MAX_BYTES) throw new UploadError(`${label} must be 4 MB or smaller.`);
  const buf = Buffer.from(await file.arrayBuffer());
  const type = Object.entries(ALLOWED).find(([, t]) => t.magic(buf));
  if (!type) throw new UploadError(`${label} must be a PDF, JPG, PNG or WEBP file.`);
  return { buf, contentType: type[0], ext: type[1].ext, name: file.name.slice(0, 200) };
}

function s3Enabled() {
  return !!process.env.S3_BUCKET;
}

async function s3() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: process.env.S3_REGION || "auto",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  });
}

export async function saveFile(folder: string, upload: { buf: Buffer; contentType: string; ext: string }) {
  const key = `${folder}/${new Date().getFullYear()}/${crypto.randomUUID()}.${upload.ext}`;
  if (s3Enabled()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    await (await s3()).send(
      new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: upload.buf, ContentType: upload.contentType }),
    );
  } else {
    const full = path.join(DATA_DIR, "uploads", key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, upload.buf);
  }
  return key;
}

export async function readFile(key: string): Promise<Buffer> {
  if (key.includes("..")) throw new Error("Invalid key");
  if (s3Enabled()) {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const res = await (await s3()).send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return fs.readFile(path.join(DATA_DIR, "uploads", key));
}

export function contentTypeFor(key: string) {
  const ext = key.split(".").pop();
  return Object.entries(ALLOWED).find(([, t]) => t.ext === ext)?.[0] ?? "application/octet-stream";
}
