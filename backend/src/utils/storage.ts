import fs from 'fs';
import path from 'path';
import { AppError } from './errors';

export const getUploadDirectory = (): string => {
  const configured = process.env.UPLOAD_DIR || 'uploads';
  const resolved = path.isAbsolute(configured) ? path.normalize(configured) : path.resolve(process.cwd(), configured);
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
};

export const resolveStoredFile = (filename: string): string => {
  if (!filename || path.basename(filename) !== filename) {
    throw new AppError('Invalid stored filename.', 400, 'VALIDATION_ERROR');
  }

  const uploadDirectory = getUploadDirectory();
  const resolved = path.resolve(uploadDirectory, filename);
  if (path.dirname(resolved) !== uploadDirectory) {
    throw new AppError('Invalid stored file path.', 400, 'VALIDATION_ERROR');
  }
  return resolved;
};

export const removeStoredFile = (filename?: string): void => {
  if (!filename) return;
  try {
    const filePath = resolveStoredFile(filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Cleanup must not hide the primary request failure.
  }
};

const startsWith = (buffer: Buffer, signature: number[]): boolean =>
  signature.every((byte, index) => buffer[index] === byte);

export const validateStoredUpload = (file: Express.Multer.File): void => {
  const filePath = resolveStoredFile(file.filename);
  const fd = fs.openSync(filePath, 'r');
  const header = Buffer.alloc(16);
  const bytesRead = fs.readSync(fd, header, 0, header.length, 0);
  fs.closeSync(fd);
  const bytes = header.subarray(0, bytesRead);

  const validByMime: Record<string, boolean> = {
    'image/jpeg': startsWith(bytes, [0xff, 0xd8, 0xff]),
    'image/png': startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    'image/gif': bytes.subarray(0, 6).toString('ascii') === 'GIF87a' || bytes.subarray(0, 6).toString('ascii') === 'GIF89a',
    'image/webp': bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
    'application/pdf': bytes.subarray(0, 5).toString('ascii') === '%PDF-',
    'application/zip': startsWith(bytes, [0x50, 0x4b]),
    'application/x-zip-compressed': startsWith(bytes, [0x50, 0x4b]),
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': startsWith(bytes, [0x50, 0x4b]),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': startsWith(bytes, [0x50, 0x4b]),
    'application/msword': startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]),
    'application/vnd.ms-excel': startsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0]),
    'text/plain': !bytes.includes(0),
  };

  if (!validByMime[file.mimetype]) {
    removeStoredFile(file.filename);
    throw new AppError('File content does not match the declared file type.', 400, 'VALIDATION_ERROR');
  }
};
