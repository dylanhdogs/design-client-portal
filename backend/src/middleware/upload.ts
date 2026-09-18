import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../utils/errors';
import { getUploadDirectory } from '../utils/storage';

const allowedExtensionsByMime: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'application/zip': ['.zip'],
  'application/x-zip-compressed': ['.zip'],
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, getUploadDirectory());
  },
  filename: (req, file, cb) => {
    const uniqueName = `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
    cb(null, uniqueName);
  }
});

export const validateUploadType = (originalName: string, mimetype: string): void => {
  const extension = path.extname(originalName).toLowerCase();
  const allowedExtensions = allowedExtensionsByMime[mimetype];
  const complexDocument = ['.doc', '.docx', '.xls', '.xlsx', '.zip'].includes(extension);

  if (process.env.NODE_ENV === 'production' && complexDocument && process.env.ALLOW_UNSCANNED_COMPLEX_UPLOADS !== 'true') {
    throw new AppError('This file type requires malware scanning and is not enabled.', 400, 'VALIDATION_ERROR');
  }

  if (!allowedExtensions?.includes(extension)) {
    throw new AppError('File type or extension not allowed.', 400, 'VALIDATION_ERROR');
  }
};

const fileFilter = (_req: any, file: any, cb: any) => {
  try {
    validateUploadType(file.originalname, file.mimetype);
    cb(null, true);
  } catch (error) {
    cb(error, false);
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});
