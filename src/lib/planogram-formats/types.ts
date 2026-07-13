import type { Area, Rack } from '@/store/planogramStore';

export type PlanogramFileFormat = 'plm' | 'psa' | 'legacy-json' | 'unknown';

export type ImportIssueSeverity = 'warning' | 'error';

export interface ImportIssue {
  severity: ImportIssueSeverity;
  code: string;
  message: string;
  path?: string;
}

export interface ImportReport {
  format: PlanogramFileFormat | 'legacy-json';
  planogramName?: string;
  racksImported: number;
  rowsImported: number;
  binsImported: number;
  productsImported: number;
  facingsImported: number;
  issues: ImportIssue[];
}

export interface PlanogramImportResult {
  success: boolean;
  message?: string;
  report: ImportReport;
  racks: Rack[];
  area?: Pick<Area, 'width' | 'depth'>;
}

export interface PlanogramExportOptions {
  planogramName?: string;
  storeId?: string | null;
  storeName?: string | null;
}

export interface PlmDocument {
  format: 'PLM';
  schemaVersion: '1.0';
  exportedAt: string;
  planogram: {
    name: string;
    storeId?: string | null;
    storeName?: string | null;
    area?: { width: number; depth: number; unit: 'm' };
    racks: Record<string, unknown>[];
  };
}

export interface PsaRecord {
  type: string;
  fields: string[];
}
