export const getDocumentRetentionDays = (): number => {
  const days = Number(process.env.DOCUMENT_RETENTION_DAYS || 2555);
  if (!Number.isInteger(days) || days < 1 || days > 36_500) {
    throw new Error('DOCUMENT_RETENTION_DAYS must be an integer from 1 to 36500.');
  }
  return days;
};

