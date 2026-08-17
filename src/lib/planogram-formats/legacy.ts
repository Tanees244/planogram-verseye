import type { PlanogramFileFormat } from './types';

export function isLegacyPlanogramJson(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const root = value as Record<string, unknown>;
  const layout = root.layout;
  if (!layout || typeof layout !== 'object') return false;
  const racks = (layout as Record<string, unknown>).racks;
  return Array.isArray(racks);
}

export function detectPlanogramFormat(content: string, filename?: string): PlanogramFileFormat {
  const ext = filename?.split('.').pop()?.toLowerCase();
  if (ext === 'plm' || ext === 'pla') return 'plm';
  if (ext === 'psa' || ext === 'psm') return 'psa';

  const trimmed = content.trim();
  if (!trimmed) return 'unknown';

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed.format === 'PLM' || parsed.planogram?.racks) return 'plm';
        if (isLegacyPlanogramJson(parsed)) return 'legacy-json';
      }
    } catch {
      return 'unknown';
    }
    return 'unknown';
  }

  if (/^PGM\t/m.test(trimmed) || /^[A-Z]{3}\t/m.test(trimmed)) {
    return 'psa';
  }

  return 'unknown';
}

export function migrateLegacyJsonLabel(): string {
  return 'Legacy JSON planogram (generation blueprint layout)';
}
