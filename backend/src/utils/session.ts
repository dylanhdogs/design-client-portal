const SESSION_PATTERN = /^([1-9]\d*)(s|m|h|d)$/;
const UNIT_SECONDS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };

export interface SessionDuration {
  jwtValue: string;
  seconds: number;
  milliseconds: number;
}

export const getSessionDuration = (): SessionDuration => {
  const jwtValue = process.env.JWT_EXPIRES_IN?.trim() || '8h';
  const match = SESSION_PATTERN.exec(jwtValue);
  if (!match) throw new Error('JWT_EXPIRES_IN must use a whole-number duration ending in s, m, h, or d.');
  const seconds = Number(match[1]) * UNIT_SECONDS[match[2]];
  if (!Number.isSafeInteger(seconds) || seconds < 300 || seconds > 7 * 86400) {
    throw new Error('JWT_EXPIRES_IN must be between 5 minutes and 7 days.');
  }
  return { jwtValue, seconds, milliseconds: seconds * 1000 };
};
