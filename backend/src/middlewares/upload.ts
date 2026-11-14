import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { env } from '../config/env';
import { BadRequestError } from '../shared/errors';

const UNSUPPORTED = 'Formato não suportado. Use JPG, PNG ou WEBP.';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

// Server-generated file names (never the client's) prevent path traversal.
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const dir = path.join(env.UPLOAD_DIR, req.tenant!.companyId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${ALLOWED_TYPES[file.mimetype]}`),
});

export const imageUpload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) cb(null, true);
    else cb(new BadRequestError(UNSUPPORTED));
  },
});

/** Detects the image type from the file's first bytes (its "magic number"). */
export function sniffImageType(head: Buffer): string | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
  if (head.length >= 8 && head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'image/png';
  }
  if (head.length >= 12 && head.toString('latin1', 0, 4) === 'RIFF' && head.toString('latin1', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  return null;
}

/**
 * Runs after multer: the declared Content-Type is client input, so the saved file's
 * real bytes must match it. Anything else (SVG, HTML, text…) is deleted and rejected.
 */
export const verifyImageContent: RequestHandler = async (req, _res, next) => {
  const file = req.file;
  if (!file) return next();

  const handle = await fs.promises.open(file.path, 'r');
  const head = Buffer.alloc(12);
  try {
    await handle.read(head, 0, head.length, 0);
  } finally {
    await handle.close();
  }

  if (sniffImageType(head) !== file.mimetype) {
    await fs.promises.rm(file.path, { force: true });
    throw new BadRequestError(UNSUPPORTED);
  }
  next();
};
