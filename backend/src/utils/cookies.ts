import crypto from 'crypto';
import { Request, Response } from 'express';
import { AppError } from './errors';
import { getSessionDuration } from './session';

export const SESSION_COOKIE = 'portal_session';
export const CSRF_COOKIE = 'portal_csrf';

export const parseCookies = (req: Request): Record<string, string> => {
  const header = req.headers.cookie;
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((cookies, part) => {
    const index = part.indexOf('=');
    if (index < 0) return cookies;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) return cookies;
    try { cookies[key] = decodeURIComponent(value); } catch { cookies[key] = ''; }
    return cookies;
  }, {});
};

const baseCookieOptions = () => ({
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
});

export const issueSessionCookies = (res: Response, token: string): string => {
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  const { milliseconds } = getSessionDuration();
  res.cookie(SESSION_COOKIE, token, {
    ...baseCookieOptions(),
    httpOnly: true,
    maxAge: milliseconds,
  });
  res.cookie(CSRF_COOKIE, csrfToken, {
    ...baseCookieOptions(),
    httpOnly: false,
    maxAge: milliseconds,
  });
  return csrfToken;
};

export const clearSessionCookies = (res: Response): void => {
  res.clearCookie(SESSION_COOKIE, { ...baseCookieOptions(), httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...baseCookieOptions(), httpOnly: false });
};

export const requireCsrfForCookieAuth = (req: Request): void => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
  const cookies = parseCookies(req);
  const cookieToken = cookies[CSRF_COOKIE];
  const headerToken = req.header('x-csrf-token');
  if (!cookieToken || !headerToken) {
    throw new AppError('Invalid CSRF token.', 403, 'FORBIDDEN');
  }
  const left = Buffer.from(cookieToken);
  const right = Buffer.from(headerToken);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    throw new AppError('Invalid CSRF token.', 403, 'FORBIDDEN');
  }
};
