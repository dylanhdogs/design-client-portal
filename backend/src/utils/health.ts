import crypto from 'node:crypto';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

interface HealthDetailAccessInput {
  production: boolean;
  requestIp: string;
  expectedToken: string;
  suppliedToken: string;
}

export const canViewHealthDetails = ({ production, requestIp, expectedToken, suppliedToken }: HealthDetailAccessInput): boolean => {
  if (!production) return true;
  if (LOOPBACK_ADDRESSES.has(requestIp)) return true;

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);
  return expected.length > 0 && expected.length === supplied.length && crypto.timingSafeEqual(expected, supplied);
};

