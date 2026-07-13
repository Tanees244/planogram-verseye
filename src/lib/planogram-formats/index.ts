import type { Rack } from '@/store/planogramStore';
import { detectPlanogramFormat, isLegacyPlanogramJson } from './legacy';
import { importRacksFromPlm, exportRacksToPlm } from './plm';
import { importRacksFromPsa, exportRacksToPsa } from './psa';
import { boundsFromRacks, summarizeRacks } from './serialize';
import type {
  ImportReport,
  PlanogramExportOptions,
  PlanogramFileFormat,
  PlanogramImportResult,
} from './types';

export * from './types';
export * from './download';
export { exportRacksToPlm, importRacksFromPlm } from './plm';
export { exportRacksToPsa, importRacksFromPsa, parsePsaContent } from './psa';
export { detectPlanogramFormat, isLegacyPlanogramJson, migrateLegacyJsonLabel } from './legacy';

export function importPlanogramContent(
  content: string,
  filename?: string,
): PlanogramImportResult {
  const format = detectPlanogramFormat(content, filename);
  const report: ImportReport = {
    format,
    racksImported: 0,
    rowsImported: 0,
    binsImported: 0,
    productsImported: 0,
    facingsImported: 0,
    issues: [],
  };

  if (format === 'legacy-json') {
    return {
      success: false,
      message: 'Legacy JSON must be imported through the migration loader',
      report: {
        ...report,
        format: 'legacy-json',
        issues: [
          {
            severity: 'warning',
            code: 'LegacyFormatDetected',
            message: 'Use the legacy JSON migration path (loadFromJSON) for this file',
          },
        ],
      },
      racks: [],
    };
  }

  try {
    if (format === 'plm') {
      const { racks, issues, planogramName, area } = importRacksFromPlm(content);
      const summary = summarizeRacks(racks);
      return {
        success: true,
        report: {
          ...report,
          planogramName,
          racksImported: summary.racks,
          rowsImported: summary.rows,
          binsImported: summary.bins,
          productsImported: summary.products,
          facingsImported: summary.facings,
          issues,
        },
        racks,
        area: area ?? boundsFromRacks(racks),
      };
    }

    if (format === 'psa') {
      const { racks, issues, planogramName, area } = importRacksFromPsa(content);
      const summary = summarizeRacks(racks);
      return {
        success: true,
        report: {
          ...report,
          planogramName,
          racksImported: summary.racks,
          rowsImported: summary.rows,
          binsImported: summary.bins,
          productsImported: summary.products,
          facingsImported: summary.facings,
          issues,
        },
        racks,
        area,
      };
    }

    return {
      success: false,
      message: 'Unrecognized planogram file format. Expected .psa, .plm, or legacy JSON.',
      report: {
        ...report,
        issues: [
          {
            severity: 'error',
            code: 'UnknownFormat',
            message: 'Could not detect .psa, .plm, or legacy JSON structure',
          },
        ],
      },
      racks: [],
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Import failed',
      report: {
        ...report,
        issues: [
          {
            severity: 'error',
            code: 'ImportFailed',
            message: error instanceof Error ? error.message : 'Import failed',
          },
        ],
      },
      racks: [],
    };
  }
}

export function exportPlanogramContent(
  racks: Rack[],
  format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>,
  options?: PlanogramExportOptions,
): string {
  if (format === 'psa') return exportRacksToPsa(racks, options);
  return exportRacksToPlm(racks, options);
}

export function extensionForFormat(format: Exclude<PlanogramFileFormat, 'legacy-json' | 'unknown'>): string {
  return format;
}
