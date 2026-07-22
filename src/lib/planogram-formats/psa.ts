import type { Bin, Product, Rack, Row } from '@/store/planogramStore';
import type { FixtureType } from '@/components/fixtures/types';
import {
  DEFAULT_BIN_DEPTH,
  DEFAULT_BIN_HEIGHT,
  DEFAULT_BIN_WIDTH,
  DEFAULT_PRODUCT_DEPTH,
  DEFAULT_PRODUCT_HEIGHT,
  DEFAULT_PRODUCT_WIDTH,
} from '@/constants/dimensions';
import { safeDim } from '@/utils/safeDimensions';
import type { ImportIssue, PlanogramExportOptions, PsaRecord } from './types';
import { boundsFromRacks, summarizeRacks } from './serialize';
import { cmToMeters, degreesToRadians, metersToCm, radiansToDegrees } from './units';
import {
  binFacingOccupied,
  isFaceFilled,
  minProductFacingWidth,
  suggestedFaceFacings,
} from '@/utils/faceFill';

const PSA_VERSION = '1.0';
const PSA_HEADER = `# Aisleris PSA interchange v${PSA_VERSION} (JDA Space Planning compatible subset)
# SHF fields: fixtureId, seg, shelf, heightCm, depthCm, yStartCm, spanCm, [dividerPosmItemId]`;

const KNOWN_FIXTURE_TYPES = new Set<FixtureType>([
  'GONDOLA',
  'END_CAP',
  'REFRIGERATED',
  'FREEZER',
  'PEGBOARD',
  'PALLET_DISPLAY',
  'PROMOTIONAL',
  'DUMP_BIN',
  'WALL_BAY',
  'CHECKOUT',
  'CUSTOM',
]);

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function esc(value: string | number | null | undefined): string {
  if (value == null) return '';
  return String(value).replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
}

function line(type: string, fields: (string | number | null | undefined)[]): string {
  return [type, ...fields.map(esc)].join('\t');
}

export function parsePsaContent(content: string): PsaRecord[] {
  const records: PsaRecord[] = [];
  for (const rawLine of content.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split('\t');
    if (parts.length < 1) continue;
    records.push({ type: parts[0].toUpperCase(), fields: parts.slice(1) });
  }
  return records;
}

function placeholderProduct(skuId: string, issues: ImportIssue[], path: string): Product {
  issues.push({
    severity: 'warning',
    code: 'UnresolvedProduct',
    message: `Product "${skuId}" was referenced but not defined in PRD records; using placeholder dimensions`,
    path,
  });
  return {
    id: skuId,
    name: skuId,
    color: '#94A3B8',
    width: DEFAULT_PRODUCT_WIDTH,
    height: DEFAULT_PRODUCT_HEIGHT,
    depth: DEFAULT_PRODUCT_DEPTH,
    quantity: 1,
  };
}

function productFromPrd(fields: string[], issues: ImportIssue[], path: string): Product {
  const [skuId, name, widthCm, heightCm, depthCm, imageUrl] = fields;
  if (!skuId?.trim()) {
    issues.push({
      severity: 'error',
      code: 'InvalidProduct',
      message: 'PRD record is missing skuId',
      path,
    });
    return placeholderProduct(generateId(), issues, path);
  }

  const width = safeDim(cmToMeters(Number(widthCm)), DEFAULT_PRODUCT_WIDTH);
  const height = safeDim(cmToMeters(Number(heightCm)), DEFAULT_PRODUCT_HEIGHT);
  const depth = safeDim(cmToMeters(Number(depthCm)), DEFAULT_PRODUCT_DEPTH);

  if (!widthCm || !heightCm || !depthCm) {
    issues.push({
      severity: 'warning',
      code: 'MissingProductDimensions',
      message: `Product "${skuId}" is missing one or more dimensions; defaults applied`,
      path,
    });
  }

  return {
    id: skuId.trim(),
    name: name?.trim() || skuId.trim(),
    color: '#4ECDC4',
    width,
    height,
    depth,
    quantity: 1,
    imageUrl: imageUrl?.trim() || undefined,
  };
}

export function importRacksFromPsa(content: string): {
  racks: Rack[];
  issues: ImportIssue[];
  planogramName?: string;
  area?: { width: number; depth: number };
} {
  const issues: ImportIssue[] = [];
  const records = parsePsaContent(content);

  if (records.length === 0) {
    throw new Error('PSA file contains no recognizable records');
  }

  const productCatalog = new Map<string, Product>();
  let planogramName = 'Imported PSA planogram';

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (record.type === 'PGM') {
      planogramName = record.fields[0]?.trim() || planogramName;
      continue;
    }
    if (record.type === 'PRD') {
      const product = productFromPrd(record.fields, issues, `PRD[${i}]`);
      productCatalog.set(product.id, product);
    }
  }

  type FixtureState = {
    rackCode: string;
    fixtureType: FixtureType;
    width: number;
    depth: number;
    height: string;
    position: { x: number; y: number; z: number };
    rotationY: number;
    sides: Map<number, { sideCode: string; rows: Map<number, RowBuilder> }>;
  };

  type RowBuilder = {
    height: number;
    span: number;
    yStart: number;
    dividerPosmItemId?: string | null;
    bins: Map<number, BinBuilder>;
  };

  type BinBuilder = {
    binName?: string;
    width: number;
    depth: number;
    height: number;
    xStart: number;
    products: Product[];
  };

  const fixtures = new Map<string, FixtureState>();

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const path = `${record.type}[${i}]`;

    if (record.type === 'FIX') {
      const [
        fixtureId,
        rackCode,
        fixtureTypeRaw,
        widthCm,
        depthCm,
        heightCm,
        posXCm,
        posYCm,
        posZCm,
        rotYDeg,
      ] = record.fields;

      if (!fixtureId) {
        issues.push({ severity: 'error', code: 'InvalidFixture', message: 'FIX missing fixture id', path });
        continue;
      }

      const fixtureType = (fixtureTypeRaw?.toUpperCase() ?? 'GONDOLA') as FixtureType;
      if (!KNOWN_FIXTURE_TYPES.has(fixtureType)) {
        issues.push({
          severity: 'warning',
          code: 'UnknownFixtureType',
          message: `Fixture type "${fixtureTypeRaw}" is not recognized; using GONDOLA`,
          path,
        });
      }

      fixtures.set(fixtureId, {
        rackCode: rackCode?.trim() || `RACK-${fixtureId}`,
        fixtureType: KNOWN_FIXTURE_TYPES.has(fixtureType) ? fixtureType : 'GONDOLA',
        width: safeDim(cmToMeters(Number(widthCm)), 2.7),
        depth: safeDim(cmToMeters(Number(depthCm)), 1.1),
        height: String(safeDim(cmToMeters(Number(heightCm)), 2)),
        position: {
          x: cmToMeters(Number(posXCm)),
          y: cmToMeters(Number(posYCm)),
          z: cmToMeters(Number(posZCm)),
        },
        rotationY: degreesToRadians(Number(rotYDeg) || 0),
        sides: new Map(),
      });
      continue;
    }

    if (record.type === 'SEG') {
      const [fixtureId, segNumRaw, sideCode] = record.fields;
      const fixture = fixtureId ? fixtures.get(fixtureId) : undefined;
      if (!fixture) {
        issues.push({ severity: 'warning', code: 'OrphanSegment', message: 'SEG references unknown fixture', path });
        continue;
      }
      const segNum = Number(segNumRaw) || 1;
      if (!fixture.sides.has(segNum)) {
        fixture.sides.set(segNum, {
          sideCode: sideCode?.trim() || `S${segNum}`,
          rows: new Map(),
        });
      }
      continue;
    }

    if (record.type === 'SHF') {
      const [
        fixtureId,
        segNumRaw,
        shelfNumRaw,
        heightCm,
        depthCm,
        yStartCm,
        spanCm,
        dividerPosmItemId,
      ] = record.fields;
      const fixture = fixtureId ? fixtures.get(fixtureId) : undefined;
      const segNum = Number(segNumRaw) || 1;
      const shelfNum = Number(shelfNumRaw) || 1;
      if (!fixture) {
        issues.push({ severity: 'warning', code: 'OrphanShelf', message: 'SHF references unknown fixture', path });
        continue;
      }
      if (!fixture.sides.has(segNum)) {
        fixture.sides.set(segNum, { sideCode: `S${segNum}`, rows: new Map() });
      }
      const side = fixture.sides.get(segNum)!;
      side.rows.set(shelfNum, {
        height: safeDim(cmToMeters(Number(heightCm)), 0.4),
        span: safeDim(cmToMeters(Number(spanCm)), fixture.width * 0.85),
        yStart: cmToMeters(Number(yStartCm) || 0),
        dividerPosmItemId: dividerPosmItemId?.trim() || null,
        bins: new Map(),
      });
      continue;
    }

    if (record.type === 'BIN') {
      const [
        fixtureId,
        segNumRaw,
        shelfNumRaw,
        binNumRaw,
        binName,
        widthCm,
        depthCm,
        heightCm,
        xStartCm,
      ] = record.fields;
      const fixture = fixtureId ? fixtures.get(fixtureId) : undefined;
      const segNum = Number(segNumRaw) || 1;
      const shelfNum = Number(shelfNumRaw) || 1;
      const binNum = Number(binNumRaw) || 1;
      if (!fixture) {
        issues.push({ severity: 'warning', code: 'OrphanBin', message: 'BIN references unknown fixture', path });
        continue;
      }
      if (!fixture.sides.has(segNum)) {
        fixture.sides.set(segNum, { sideCode: `S${segNum}`, rows: new Map() });
      }
      const side = fixture.sides.get(segNum)!;
      if (!side.rows.has(shelfNum)) {
        side.rows.set(shelfNum, {
          height: 0.4,
          span: fixture.width * 0.85,
          yStart: 0,
          bins: new Map(),
        });
        issues.push({
          severity: 'warning',
          code: 'ShelfAutoCreated',
          message: `BIN created shelf ${shelfNum} on segment ${segNum} because SHF was missing`,
          path,
        });
      }
      const row = side.rows.get(shelfNum)!;
      row.bins.set(binNum, {
        binName: binName?.trim() || undefined,
        width: safeDim(cmToMeters(Number(widthCm)), DEFAULT_BIN_WIDTH),
        depth: safeDim(cmToMeters(Number(depthCm)), DEFAULT_BIN_DEPTH),
        height: safeDim(cmToMeters(Number(heightCm)), DEFAULT_BIN_HEIGHT),
        xStart: cmToMeters(Number(xStartCm) || 0),
        products: [],
      });
      continue;
    }

    if (record.type === 'POS') {
      const [fixtureId, segNumRaw, shelfNumRaw, binNumRaw, skuId, facingsRaw, xOffsetCm] = record.fields;
      const fixture = fixtureId ? fixtures.get(fixtureId) : undefined;
      const segNum = Number(segNumRaw) || 1;
      const shelfNum = Number(shelfNumRaw) || 1;
      const binNum = Number(binNumRaw) || 1;
      const sku = skuId?.trim();
      if (!fixture || !sku) {
        issues.push({ severity: 'warning', code: 'OrphanPosition', message: 'POS references unknown fixture or sku', path });
        continue;
      }
      if (!fixture.sides.has(segNum)) {
        fixture.sides.set(segNum, { sideCode: `S${segNum}`, rows: new Map() });
      }
      const side = fixture.sides.get(segNum)!;
      if (!side.rows.has(shelfNum)) {
        side.rows.set(shelfNum, {
          height: 0.4,
          span: fixture.width * 0.85,
          yStart: 0,
          bins: new Map(),
        });
      }
      const row = side.rows.get(shelfNum)!;
      if (!row.bins.has(binNum)) {
        row.bins.set(binNum, {
          width: DEFAULT_BIN_WIDTH,
          depth: DEFAULT_BIN_DEPTH,
          height: DEFAULT_BIN_HEIGHT,
          xStart: cmToMeters(Number(xOffsetCm) || 0),
          products: [],
        });
        issues.push({
          severity: 'warning',
          code: 'BinAutoCreated',
          message: `POS created bin ${binNum} on shelf ${shelfNum} because BIN was missing`,
          path,
        });
      }
      const bin = row.bins.get(binNum)!;
      const base = productCatalog.get(sku) ?? placeholderProduct(sku, issues, path);
      const facings = Math.max(1, Math.floor(Number(facingsRaw) || 1));
      bin.products.push({ ...base, quantity: facings });
    }
  }

  const racks: Rack[] = [];

  for (const [fixtureId, fixture] of fixtures) {
    if (fixture.sides.size === 0) {
      fixture.sides.set(1, { sideCode: 'S1', rows: new Map() });
      issues.push({
        severity: 'warning',
        code: 'FixtureWithoutSegments',
        message: `Fixture "${fixtureId}" had no segments; created default side`,
        path: `FIX:${fixtureId}`,
      });
    }

    const sides = [...fixture.sides.entries()]
      .sort(([a], [b]) => a - b)
      .map(([segNum, sideState]) => {
        const rows = [...sideState.rows.entries()]
          .sort(([a], [b]) => a - b)
          .map(([shelfNum, rowState]) => {
            const bins = [...rowState.bins.entries()]
              .sort(([a], [b]) => a - b)
              .map(([binNum, binState]) => {
                const products =
                  binState.products.length > 0
                    ? binState.products
                    : [];
                if (products.length > 0) {
                  const occupied = binFacingOccupied(products);
                  const minW = minProductFacingWidth(products);
                  if (!isFaceFilled(occupied, binState.width, minW)) {
                    const first = products[0];
                    const suggested = suggestedFaceFacings(binState.width, first.width);
                    issues.push({
                      severity: 'warning',
                      code: 'BinFaceUnderfilled',
                      message: `Bin ${binNum} on shelf ${shelfNum} leaves empty front space (has ${occupied.toFixed(3)}m of ${binState.width.toFixed(3)}m). Suggested front facings for “${first.name}”: ${suggested}.`,
                      path: `FIX:${fixtureId}/SEG:${segNum}/SHF:${shelfNum}/BIN:${binNum}`,
                    });
                  }
                }
                return {
                  id: `${fixtureId}-S${segNum}-SH${shelfNum}-B${binNum}`,
                  binName: binState.binName,
                  width: binState.width,
                  depth: binState.depth,
                  height: binState.height,
                  products,
                } satisfies Bin;
              });

            if (bins.length === 0) {
              issues.push({
                severity: 'warning',
                code: 'EmptyShelf',
                message: `Shelf ${shelfNum} on fixture "${fixtureId}" has no bins or products`,
                path: `FIX:${fixtureId}/SEG:${segNum}/SHF:${shelfNum}`,
              });
            }

            return {
              id: `${fixtureId}-S${segNum}-SH${shelfNum}`,
              height: rowState.height,
              span: rowState.span,
              width: rowState.span,
              yStart: rowState.yStart,
              yEnd: rowState.yStart + rowState.height,
              sided: fixture.sides.size > 1 ? 'two' as const : 'one' as const,
              dividerPosmItemId: rowState.dividerPosmItemId ?? null,
              bins,
            } satisfies Row;
          });

        return {
          id: `${fixtureId}-S${segNum}`,
          sideId: `${fixtureId}-S${segNum}`,
          sideCode: sideState.sideCode || `S${segNum}`,
          rows,
        };
      });

    racks.push({
      id: fixtureId,
      rackId: fixtureId,
      rackCode: fixture.rackCode,
      width: fixture.width,
      depth: fixture.depth,
      height: fixture.height,
      fixtureType: fixture.fixtureType,
      isDoubleSided: sides.length > 1,
      position: fixture.position,
      rotation: { x: 0, y: fixture.rotationY, z: 0 },
      sides,
    });
  }

  if (racks.length === 0) {
    throw new Error('PSA file did not contain any FIX records');
  }

  return {
    racks,
    issues,
    planogramName,
    area: boundsFromRacks(racks),
  };
}

export function exportRacksToPsa(racks: Rack[], options: PlanogramExportOptions = {}): string {
  const lines: string[] = [PSA_HEADER];
  const name =
    options.planogramName ??
    (racks.length === 1 ? racks[0].blueprintName ?? racks[0].rackCode : 'Store planogram');

  lines.push(
    line('PGM', [name, options.storeId ?? '', options.storeName ?? '', new Date().toISOString()]),
  );

  const productCatalog = new Map<string, Product>();

  for (const rack of racks) {
    const fixtureId = rack.rackId || rack.id;
    const rotY = rack.rotation?.y ?? rack.placement?.rotation?.y ?? 0;
    lines.push(
      line('FIX', [
        fixtureId,
        rack.rackCode,
        rack.fixtureType ?? 'GONDOLA',
        metersToCm(rack.width),
        metersToCm(rack.depth),
        metersToCm(Number(rack.height) || 2),
        metersToCm(rack.position.x),
        metersToCm(rack.position.y),
        metersToCm(rack.position.z),
        Math.round(radiansToDegrees(rotY) * 100) / 100,
      ]),
    );

    rack.sides.forEach((side, sideIndex) => {
      const segNum = sideIndex + 1;
      lines.push(line('SEG', [fixtureId, segNum, side.sideCode || `S${segNum}`]));

      let yCursor = 0;
      side.rows.forEach((row, rowIndex) => {
        const shelfNum = rowIndex + 1;
        const rowSpan = row.span ?? row.width ?? rack.width * 0.85;
        lines.push(
          line('SHF', [
            fixtureId,
            segNum,
            shelfNum,
            metersToCm(row.height),
            metersToCm(rack.depth * 0.9),
            metersToCm(row.yStart ?? yCursor),
            metersToCm(rowSpan),
            row.dividerPosmItemId ?? '',
          ]),
        );
        yCursor += row.height;

        row.bins.forEach((bin, binIndex) => {
          const binNum = binIndex + 1;
          let xCursor = 0;
          lines.push(
            line('BIN', [
              fixtureId,
              segNum,
              shelfNum,
              binNum,
              bin.binName ?? `B${binNum}`,
              metersToCm(bin.width),
              metersToCm(bin.depth),
              metersToCm(bin.height),
              metersToCm(xCursor),
            ]),
          );

          bin.products.forEach((product) => {
            if (!productCatalog.has(product.id)) {
              productCatalog.set(product.id, product);
            }
            const facings = Math.max(1, Math.floor(Number(product.quantity) || 1));
            lines.push(
              line('POS', [
                fixtureId,
                segNum,
                shelfNum,
                binNum,
                product.id,
                facings,
                metersToCm(xCursor),
              ]),
            );
            xCursor += product.width * facings;
          });
        });
      });
    });
  }

  for (const product of productCatalog.values()) {
    lines.push(
      line('PRD', [
        product.id,
        product.name,
        metersToCm(product.width),
        metersToCm(product.height),
        metersToCm(product.depth),
        product.imageUrl ?? '',
        product.brandName ?? '',
        product.categoryName ?? '',
      ]),
    );
  }

  const summary = summarizeRacks(racks);
  lines.push(
    line('SUM', [
      summary.racks,
      summary.rows,
      summary.bins,
      summary.products,
      summary.facings,
    ]),
  );

  return `${lines.join('\n')}\n`;
}
