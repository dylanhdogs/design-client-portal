import { Request, Response, NextFunction } from 'express';
import { recordOperationalAlert } from '../utils/operations';
import { sanitizeRequestPath } from '../utils/logging';

export { sanitizeRequestPath } from '../utils/logging';

export function structuredRequestLog(req: Request, res: Response, next: NextFunction) {
  const startedAt = Date.now();
  res.on('finish', () => {
    const requestId = (req as any).requestId;
    const status = res.statusCode;
    const safePath = sanitizeRequestPath(req.path);
    const entry = { level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', event: 'http_request', requestId, method: req.method, path: safePath, status, durationMs: Date.now() - startedAt, userId: (req as any).user?.id || null };
    console.log(JSON.stringify(entry));
    const category = status >= 500 ? 'HTTP_5XX' : (status === 401 || status === 403 || (status===429&&req.path.includes('/auth/'))) ? 'AUTH_FAILURE' : status === 409 && String((res.locals as any).errorCode || '').includes('GATE') ? 'GATE_CONFLICT' : status >= 400 && req.path.includes('/documents') && req.method==='POST' ? 'UPLOAD_FAILURE' : status >= 400 && req.path.includes('/automation/deliveries') ? 'NOTIFICATION_FAILURE' : null;
    if (category) void recordOperationalAlert(category, `${req.method} ${safePath} returned ${status}`, { requestId, severity: status >= 500 ? 'CRITICAL' : 'WARNING', metadata: { status, method: req.method, path: safePath } }).catch(() => undefined);
  });
  next();
}
