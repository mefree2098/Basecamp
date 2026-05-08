import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.BASECAMP_STORAGE_DIR ?? ".basecamp-data"
);
const GALLERY_UPLOAD_DIR = path.join(STORAGE_DIR, "uploads", "gallery");
const MAX_FILE_SIZE = 6 * 1024 * 1024;
const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

export async function POST(request: Request) {
  const form = await request.formData();
  const files = form.getAll("files").filter(isUploadFile);
  if (!files.length) {
    return NextResponse.json({ error: "At least one image file is required." }, { status: 400 });
  }

  const urls: string[] = [];
  fs.mkdirSync(GALLERY_UPLOAD_DIR, { recursive: true });

  for (const file of files.slice(0, 12)) {
    const extension = IMAGE_EXTENSIONS[file.type];
    if (!extension) {
      return NextResponse.json({ error: `${file.name || "Upload"} is not a supported image type.` }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `${file.name || "Upload"} is larger than 6MB.` }, { status: 400 });
    }

    const filename = `${crypto.randomUUID()}.${extension}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(path.join(GALLERY_UPLOAD_DIR, filename), bytes);
    urls.push(`/api/uploads/gallery/${filename}`);
  }

  return NextResponse.json({ urls });
}

function isUploadFile(value: FormDataEntryValue): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "arrayBuffer" in value &&
    "name" in value &&
    "size" in value &&
    "type" in value
  );
}
