# Frontend Integration Guide — SKU Stackable + Per-Row Utilization + Remove Row

**Audience:** Portal / layout / catalog frontend  
**Branch context:** `reyan/feature/new-tasks` (Jul 2026)  
**Status:** Backend complete. Wire types and UI against these contracts.

Related docs:

- [FRONTEND_SHELF_UTILIZATION.md](./FRONTEND_SHELF_UTILIZATION.md) — utilization shape and AI planogram flow
- [LAYOUT_SCALE_SPEC.md](./LAYOUT_SCALE_SPEC.md) — meters

---

## Summary checklist

| Change | FE action |
|--------|-----------|
| Catalog SKU `isStackable` | Add to create/edit forms, list/detail types; default `true` |
| Rack row `utilization` | Extend rack-structure types; show per-row bar if desired |
| Apply scored ranking `rowUtilizations` | Extend apply response type; optional per-row UI after apply |
| `DELETE .../rack-rows/{rowId}` | Wire remove-row action; refresh rack structure after success |
| Capacity / max quantity | Expect lower `maxQuantity` when `isStackable: false` (server-driven) |

JSON is **camelCase**. Enums remain **snake_case_lower** where applicable. Standard envelope: `{ success, data, message, errors, meta }`.

---

## 1. Catalog SKU — `isStackable`

New boolean on every catalog SKU.

| Value | Meaning |
|-------|---------|
| `true` (default) | Units may stack vertically in a bin: `facingsHigh = floor(binHeight / skuHeight)` |
| `false` | Vertical layers capped at **1** if the SKU fits once in height; otherwise capacity is 0 |

Existing rows migrate with `is_stackable = true`.

### Endpoints touched

| Method | Route | Request | Response |
|--------|-------|---------|----------|
| `POST` | `/api/v1/catalog/skus` | Optional `isStackable` (default `true`) | Includes `isStackable` |
| `PUT` | `/api/v1/catalog/skus/{skuId}` | Optional `isStackable` (`null`/omit = leave unchanged) | Includes `isStackable` |
| `GET` | `/api/v1/catalog/skus/{skuId}` | — | Includes `isStackable` |
| `GET` | `/api/v1/catalog/skus` | — | Each list item includes `isStackable` |

Permission unchanged: catalog manage/view as today.

### Create body (relevant fields)

```json
{
  "name": "Yogurt 150g",
  "code": "YG-150",
  "isHero": false,
  "isStackable": true
}
```

Omit `isStackable` → server stores `true`.

### Update body

```json
{
  "name": "Yogurt 150g",
  "isStackable": false
}
```

`isStackable` is **nullable** on update (same pattern as `isHero`):

- omit / `null` → do not change
- `true` / `false` → set and, if the SKU is already on bins, **recompute** those bins’ `maxQuantity` / quantity clamps server-side

### Response fragment (create / update / get / list)

```ts
type CatalogSku = {
  // ...existing fields...
  isHero: boolean;
  isStackable: boolean;
};
```

### UI recommendations

1. **SKU create/edit:** toggle labeled e.g. “Stackable” / “Allow vertical stacking”, default on.
2. **SKU detail/list:** show badge or column when `false` (non-stackable is the exception).
3. **Layout editor:** `StoreBinSkuDto` does **not** currently expose `isStackable`. If the layout UI needs it without a second round-trip, either:
   - join from the catalog SKU cache / list by `skuId`, or
   - ask backend later to add it to `StoreBinSkuDto` (not in this release).
4. After toggling stackable on a placed SKU, **refetch rack structure** — `maxQuantity` / quantities may have changed.

---

## 2. Remove rack row (new endpoint)

```http
DELETE /api/v1/layout/rack-rows/{rowId}
Authorization: Bearer {token}
```

| | |
|--|--|
| Permission | `layout:manage` |
| Path | `rowId` = rack row GUID |
| Body | none |

### Success

```json
{
  "success": true,
  "data": null,
  "message": "Rack row removed successfully",
  "errors": [],
  "meta": null
}
```

### Server behavior (what FE should expect after refetch)

1. Soft-deletes the row (`isActive: false`).
2. Soft-deletes all active bins on that row and clears SKU / quantity / maxQuantity.
3. Soft-deletes active bin products.
4. Clears the row’s divider POSM.
5. **Renumbers** remaining active rows on the same side to `1..N` (contiguous).
6. Updates the side’s `totalRows` to the new count.
7. Refreshes the shelf ideal-order projection for that rack side.

### Errors

| Case | Typical result |
|------|----------------|
| Unknown `rowId` | `404` |
| Row in another org | `404` |
| Missing permission | `403` |

### FE integration

```ts
async function removeRackRow(rowId: string) {
  await api.delete(`/api/v1/layout/rack-rows/${rowId}`);
  // Then reload structure — do not locally splice only:
  // rowNumber and totalRows are renumbered server-side.
  await refetchRackStructure(rackId);
}
```

Confirm before delete: products on the row are removed with the row (no orphan bins left active).

Pair with existing:

```http
POST /api/v1/layout/rack-rows
```

---

## 3. Per-row utilization on rack structure

Every row in rack / store layout structure responses now includes a nested utilization object (same shape as shelf utilization).

### Affected reads

- `GET /api/v1/layout/racks/{rackId}/structure` (and equivalent structure mappers)
- `GET` store layout by store (rack structures embedded there)

### Type updates

```ts
type ShelfFacingUtilization = {
  availableWidthMeters: number | null;
  occupiedWidthMeters: number;
  remainingWidthMeters: number | null;
  utilizationPercent: number;
  fits: boolean;
  isOverCapacity: boolean;
  canCalculate: boolean;
  status: "ok" | "over_capacity" | "dimensions_unavailable";
};

type StoreRackRowStructure = {
  rowId: string;
  rowNumber: number | null;
  rackSideId: string;
  // ...existing geometry / bins / dividerPosm...
  bins: StoreBinStructure[];
  utilization: ShelfFacingUtilization; // NEW — required
};
```

Occupied width is derived from **placed face facings** on the row (active bin products’ `width × quantity`, with a bin-width / SKU-width fallback). Available width is the row span (see layout face-fill rules).

### UI

Optional but useful: a compact bar under each shelf row in the layout editor using `row.utilization`, same status semantics as [FRONTEND_SHELF_UTILIZATION.md](./FRONTEND_SHELF_UTILIZATION.md).

When `canCalculate === false`, do not show `0%` as real utilization.

---

## 4. Apply scored ranking — `rowUtilizations`

```http
POST /api/v1/layout/ai-planogram/apply-scored-ranking
```

Request body unchanged.

### Response additions

```ts
type ShelfRowUtilization = {
  rowId: string;
  rowNumber: number | null;
  utilization: ShelfFacingUtilization;
};

type ApplyScoredPlanogramRankingResult = {
  storeId: string;
  shelfId: string;
  rackId: string;
  rackSideId: string;
  planogramName: string;
  rackCode: string;
  fixtureType: string | null;
  appliedSkuCount: number;
  totalAppliedFacings: number;
  shelfUtilization: ShelfFacingUtilization;
  rowUtilizations: ShelfRowUtilization[]; // NEW
  appliedSkus: { skuId: string; requestedFacings: number; appliedFacings: number }[];
  warnings: string[];
  layoutEditorPath: string;
};
```

### Semantics change (important)

| Field | Meaning now |
|-------|-------------|
| `shelfUtilization` | **Aggregated from packed per-row** utilization after placement (sum of available / occupied across rows on the side) |
| `rowUtilizations` | One entry per active row on the applied side |
| Over-capacity **warning** text | Still based on the **proposed** facing total vs side available width (pre-pack check). Apply can still succeed with warnings |

Placement no longer only clears and fills existing bins: the server **rebuilds / resizes bins** from requested face facings and packs them contiguous (no empty front gaps). After apply, always refetch rack structure — bin IDs / widths / sequences may change.

Empty-rack guard message is now: *"The linked rack has no rows to place SKUs onto."* (was “no bins”).

Non-stackable SKUs participate in placement with vertical layers capped at 1 (affects capacity / quantity, not the facing-width formula).

### Suggested post-apply UI

1. Keep the shelf-level utilization card from `shelfUtilization`.
2. Optionally list `rowUtilizations` when the side has multiple rows.
3. Surface `warnings[]` as today.
4. Navigate via `layoutEditorPath` and reload structure.

Preview / generate ranking endpoints are unchanged for this release; only **apply** gains `rowUtilizations`. Client-side preview math in the utilization doc remains valid for the facing editor.

---

## 5. Behavioral side effects (no new FE fields)

These do not add request/response fields but change numbers the UI already shows:

| Area | Effect |
|------|--------|
| `AttachSkuToBin` / capacity | `maxQuantity` uses `isStackable` |
| AI / reflow placement | Non-stackable → at most one vertical layer |
| SKU dimension or stackable update | Placed bins recomputed |

If the UI displays `maxQuantity` or fill %, treat server values as source of truth after attach, apply, reflow, or SKU update.

---

## 6. Minimal TypeScript delta

```ts
// Catalog
type CatalogSkuDto = ExistingCatalogSku & { isStackable: boolean };

type CreateCatalogSkuBody = ExistingCreateBody & {
  isStackable?: boolean; // default true server-side
};

type UpdateCatalogSkuBody = ExistingUpdateBody & {
  isStackable?: boolean | null; // omit/null = unchanged
};

// Layout structure
type StoreRackRowStructureDto = ExistingRow & {
  utilization: ShelfFacingUtilization;
};

// Apply scored ranking
type ApplyScoredRankingResponse = ExistingApplyResponse & {
  rowUtilizations: {
    rowId: string;
    rowNumber: number | null;
    utilization: ShelfFacingUtilization;
  }[];
};

// Remove row
// DELETE /api/v1/layout/rack-rows/:rowId → envelope with data: null
```

---

## 7. Smoke test for FE

1. Create SKU with `isStackable: false` → GET returns `false`.
2. Create SKU omitting field → GET returns `true`.
3. Toggle stackable on a SKU already on a tall bin → refetch structure; `maxQuantity` should drop if height previously allowed stacking.
4. Load rack structure → every `rows[]` entry has `utilization`.
5. Apply scored ranking → response has `rowUtilizations` and updated `shelfUtilization`; structure refetch shows packed bins.
6. `DELETE /api/v1/layout/rack-rows/{rowId}` → row gone; remaining `rowNumber`s are `1..N`; side `totalRows` matches.
