import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);
const GALLERY_UPLOAD_DIR = path.join(STORAGE_DIR, "uploads", "gallery");
const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

export async function GET(_request: Request, context: { params: Promise<{ filename: string }> }) {
  const { filename } = await context.params;
  const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, "");
  if (!safeFilename || safeFilename !== filename) {
    return NextResponse.json({ error: "Invalid gallery image." }, { status: 400 });
  }

  const filePath = path.join(GALLERY_UPLOAD_DIR, safeFilename);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Gallery image not found." }, { status: 404 });
  }

  const extension = path.extname(safeFilename).toLowerCase();
  return new Response(new Uint8Array(fs.readFileSync(filePath)), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream"
    }
  });
}
