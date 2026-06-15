export const getJwtSecret = () => {
  return process.env.JWT_SECRET || 'construction-portal-jwt-secret-key-2026';
};
