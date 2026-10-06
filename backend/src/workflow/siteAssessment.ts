export function hasSiteAssessmentRecord(siteAssessment: unknown, structuredAssessment: unknown): boolean {
  if (typeof siteAssessment === 'string' && siteAssessment.trim()) return true;

  let value = structuredAssessment;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return false; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.values(value as Record<string, unknown>).some((item) => typeof item === 'string' && Boolean(item.trim()));
}
