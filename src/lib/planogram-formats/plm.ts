import type { Rack } from '@/store/planogramStore';
import { normalizeRack } from '@/utils/storeLayoutLoader';
import type { ImportIssue, PlmDocument, PlanogramExportOptions } from './types';
import { boundsFromRacks, serializeRackForExport } from './serialize';

export function buildPlmDocument(
  racks: Rack[],
  options: PlanogramExportOptions = {},
): PlmDocument {
  const name =
    options.planogramName ??
    (racks.length === 1 ? racks[0].blueprintName ?? racks[0].rackCode : 'Store planogram');

  const area = boundsFromRacks(racks);

  return {
    format: 'PLM',
    schemaVersion: '1.0',
    exportedAt: new Date().toISOString(),
    planogram: {
      name,
      storeId: options.storeId ?? null,
      storeName: options.storeName ?? null,
      area: { ...area, unit: 'm' },
      racks: racks.map(serializeRackForExport),
    },
  };
}

export function exportRacksToPlm(racks: Rack[], options?: PlanogramExportOptions): string {
  return JSON.stringify(buildPlmDocument(racks, options), null, 2);
}

export function parsePlmDocument(content: string): {
  document: PlmDocument;
  issues: ImportIssue[];
} {
  const issues: ImportIssue[] = [];
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid PLM JSON: ${error instanceof Error ? error.message : 'parse error'}`);
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('PLM document must be a JSON object');
  }

  const root = parsed as Record<string, unknown>;
  const planogram = (root.planogram ?? root) as Record<string, unknown>;
  const racksRaw = Array.isArray(planogram.racks)
    ? planogram.racks
    : Array.isArray(root.racks)
      ? root.racks
      : null;

  if (!racksRaw) {
    throw new Error('PLM document is missing planogram.racks[]');
  }

  if (root.format && root.format !== 'PLM') {
    issues.push({
      severity: 'warning',
      code: 'UnexpectedFormatField',
      message: `Expected format "PLM" but found "${String(root.format)}"`,
    });
  }

  const racks = racksRaw.map((rack, index) => {
    try {
      return normalizeRack(rack);
    } catch (error) {
      issues.push({
        severity: 'error',
        code: 'RackNormalizeFailed',
        message: error instanceof Error ? error.message : 'Failed to normalize rack',
        path: `planogram.racks[${index}]`,
      });
      return null;
    }
  }).filter((rack): rack is Rack => rack != null);

  if (racks.length === 0) {
    throw new Error('No racks could be imported from PLM document');
  }

  const document: PlmDocument = {
    format: 'PLM',
    schemaVersion: '1.0',
    exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt : new Date().toISOString(),
    planogram: {
      name: String(planogram.name ?? 'Imported planogram'),
      storeId: (planogram.storeId as string | null | undefined) ?? null,
      storeName: (planogram.storeName as string | null | undefined) ?? null,
      area:
        planogram.area && typeof planogram.area === 'object'
          ? {
              width: Number((planogram.area as { width?: number }).width) || boundsFromRacks(racks).width,
              depth: Number((planogram.area as { depth?: number }).depth) || boundsFromRacks(racks).depth,
              unit: 'm',
            }
          : { ...boundsFromRacks(racks), unit: 'm' },
      racks: racksRaw as Record<string, unknown>[],
    },
  };

  return { document, issues };
}

export function importRacksFromPlm(content: string): {
  racks: Rack[];
  issues: ImportIssue[];
  planogramName?: string;
  area?: { width: number; depth: number };
} {
  const { document, issues } = parsePlmDocument(content);
  const racks = document.planogram.racks
    .map((rack, index) => {
      try {
        return normalizeRack(rack);
      } catch (error) {
        issues.push({
          severity: 'error',
          code: 'RackNormalizeFailed',
          message: error instanceof Error ? error.message : 'Failed to normalize rack',
          path: `planogram.racks[${index}]`,
        });
        return null;
      }
    })
    .filter((rack): rack is Rack => rack != null);

  return {
    racks,
    issues,
    planogramName: document.planogram.name,
    area: document.planogram.area
      ? { width: document.planogram.area.width, depth: document.planogram.area.depth }
      : undefined,
  };
}
