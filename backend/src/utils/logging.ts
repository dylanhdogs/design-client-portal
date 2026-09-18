export const sanitizeRequestPath = (requestPath: string): string => {
  const queryIndex = requestPath.indexOf('?');
  const pathname = queryIndex >= 0 ? requestPath.slice(0, queryIndex) : requestPath;
  const sanitizedPath = pathname
    .replace(/(\/invite\/)[^/]+/gi, '$1[REDACTED]')
    .replace(/(\/reset-password\/)[^/]+/gi, '$1[REDACTED]');
  return queryIndex >= 0 ? `${sanitizedPath}?[REDACTED]` : sanitizedPath;
};
