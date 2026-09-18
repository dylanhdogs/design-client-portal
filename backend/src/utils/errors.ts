import { ZodError } from 'zod';
import { sanitizeRequestPath } from './logging';

export type AppErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GATE_BLOCKED'
  | 'INVALID_TRANSITION'
  | 'SEPARATION_OF_DUTIES'
  | 'REPORT_INVALID_DATE'
  | 'REPORT_NOT_FOUND'
  | 'REPORT_SOURCE_CONFLICT'
  | 'REPORT_AI_DISABLED'
  | 'INTERNAL_ERROR';

const statusToCode = (statusCode: number): AppErrorCode => {
  if (statusCode === 401) return 'UNAUTHENTICATED';
  if (statusCode === 403) return 'FORBIDDEN';
  if (statusCode === 404) return 'NOT_FOUND';
  if (statusCode === 409) return 'CONFLICT';
  if (statusCode >= 500) return 'INTERNAL_ERROR';
  return 'VALIDATION_ERROR';
};

export class AppError extends Error {
  statusCode: number;
  code: AppErrorCode;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number = 400,
    code: AppErrorCode = statusToCode(statusCode),
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.name = 'AppError';
  }
}

export const errorHandler = (err: any, req: any, res: any, next: any) => {
  const requestId = req.requestId || req.headers?.['x-request-id'];
  const isDev = process.env.NODE_ENV !== 'production';
  const expectedStatus = err instanceof AppError
    ? err.statusCode
    : err instanceof ZodError || err?.name === 'MulterError'
      ? 400
      : 500;
  const logEntry = {
    requestId,
    method: req.method,
    path: sanitizeRequestPath(req.originalUrl || req.path || ''),
    name: err?.name,
    message: err?.message,
    ...(isDev && expectedStatus >= 500 ? { stack: err?.stack } : {}),
  };
  res.locals.errorCode = err instanceof AppError ? err.code : expectedStatus >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
  const serialized = JSON.stringify({ level: expectedStatus >= 500 ? 'error' : 'warn', event: 'request_error', ...logEntry });
  if (expectedStatus >= 500) console.error(serialized);
  else console.warn(serialized);

  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors;
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed.',
        fieldErrors,
      },
    });
  }

  if (err?.name === 'MulterError') {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File exceeds the 10 MB upload limit.'
      : 'File upload failed.';
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message },
    });
  }
  
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details || {}),
      },
    });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'CONFLICT', message: 'A record with this value already exists.' },
      });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Record not found.' },
      });
    }
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Database request failed.' },
    });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'Internal server error.',
    },
  });
};
