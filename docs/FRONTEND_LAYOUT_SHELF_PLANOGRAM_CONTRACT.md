# Layout / Shelf / Planogram FE–BE Contract

Confirmed backend contract for Master Data (Planogram + Racks tabs) and the 3D editor. Align both frontends to this document; do not invent `draft` / `published` shelf enums that do not exist.

Base path prefix: `/api/v1`

---

## 1. Entity hierarchy

```
Store (branch LocationNode)
 └─ StoreRack (1:N)
     └─ StoreRackSide (1 or 2 faces: S1 / S2)
         ├─ Shelf (1:1 per side — first-class entity)
         │   └─ ShelfPlanogram (0..1 — separate table)
         └─ StoreRackRow (1:N)
             └─ StoreBin (1:N)
                 ├─ CatalogSku (optional primary)
                 └─ StoreBinProduct (1:N — face products)
```

| Entity | Table / resource | Notes |
|--------|------------------|--------|
| Shelf | `shelves` | Created automatically with rack sides; can also exist unlinked |
| ShelfPlanogram | `shelf_planograms` | Separate resource: ideal image + server-derived order JSON + optional `planogramName` |
| StoreRack | `store_racks` | Physical fixture in a store |
| StoreRackSide | `store_rack_sides` | Links to `shelfId` |

---

## 2. Core Q&A

### 2.1 Is Shelf always created on `POST /layout/racks`, one per side?

**Yes.** Create rack builds 1 side (`S1`) or 2 (`S1`, `S2`) from `isDoubleSided`, then `ShelfRackSideLinker.EnsureLinkedShelves` creates one Shelf per active side (default name `{rackCode}-{sideCode}`).

Response: `{ rackId, sideIds[] }` — shelf IDs are not returned; resolve from `GET .../structure` or `GET /layout/shelves`.

### 2.2 Is ShelfPlanogram a separate table?

**Yes.** Not flags on Shelf. Fields: `shelfId`, `planogramName`, `idealImageUrl` (object key), `idealImageOrderJson`, `sosTargetBrand`, `isActive`.

List endpoints **derive** booleans from that row:

| Flag | Meaning |
|------|---------|
| `hasPlanogram` | Active `ShelfPlanogram` row exists |
| `hasIdealImage` | Ideal image object key present |
| `isConfigured` | Ideal image **and** non-empty `IdealImageOrderJson` |

### 2.3 Is ideal product order always server-derived?

**Yes. FE must never POST order JSON.**

`StoreLayoutIdealOrderProjector` builds:

```json
{ "rows": { "0": ["SKU A", "SKU A", "..."], "1": [...] } }
```

from linked rack bins (`SkuId` + `bin.Quantity`). Refreshed on layout save, ideal-image upload, attach/detach, reflow, publish, etc.

### 2.4 Structure vs blueprint endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /layout/racks/{id}/structure` | Full operational tree (sides → rows → bins → SKU/products + utilization). Primary editor read model. Includes `sides[].shelfId`. |
| `GET /layout/racks/{id}/blueprint` | Same hierarchy as a blueprint schema (`schemaVersion`, nested `rack.layout…`). Same data, different envelope for 3D. |
| `GET /layout/shelves/{id}/blueprint` | **One face**: shelf detail + that side’s rows/bins. 404 if shelf not linked to an active rack side. |

### 2.5 `GET /layout/shelves` identity fields

| Field | Meaning |
|-------|---------|
| `id` | `shelfId` |
| `rackSideId` | Linked active side, else `null` |
| `rackId` | Parent rack of that side, else `null` |
| `sideCode` | e.g. `S1` / `S2` |
| `rackCode` | Rack code |
| `rackName` | **`rack.BlueprintName`** (not shelf name) |
| `name` | Shelf display name |
| `storeName` | Branch `LocationNode.Name` (authoritative; no `branchName`) |
| `fixtureType` | From linked rack |
| `lastUpdated` | `rack.UpdatedAt` if linked, else `shelf.UpdatedAt` |
| `publishedAt` | From linked rack (publish flow), else `null` |

---

## 3. Status matrix (no draft/published shelf enum)

| Flag | Becomes `true` when |
|------|---------------------|
| `hasLayout` | Active rack side linked (`rackSideId != null`) |
| `hasPlanogram` | Active `ShelfPlanogram` row exists |
| `hasIdealImage` | Planogram has object-key ideal image |
| `isConfigured` | Ideal image **and** non-empty order JSON |

Capture / `register-demo` requires **`isConfigured == true`**.

### Recommended Planogram Status UI labels

| UI label | Rule |
|----------|------|
| Not linked | `!hasLayout` |
| Layout only | `hasLayout && !hasIdealImage` |
| Image only | `hasIdealImage && !isConfigured` |
| Configured | `isConfigured` |

Closest “published” signal: rack `publishedAt` (not a shelf status).

---

## 4. Master Data — Planogram tab (`GET /layout/shelves`)

### Column mapping

| UI column | Field / rule |
|-----------|----------------|
| Rack Name | `rackName` (= blueprint name). Fallback: `rackCode`. Do **not** use shelf `name` for this column. |
| Store Name | `storeName` |
| Layout Status | `hasLayout` → Linked / Unlinked |
| Planogram Status | flags in §3 |
| Last Updated | `lastUpdated` |
| Fixture | `fixtureType` |

### List item schema (`ShelfListItemDto`)

| Field | Type | Nullable |
|-------|------|----------|
| `id` | guid | no |
| `storeId` | guid | no |
| `storeName` | string | no (may be empty) |
| `name` | string | no |
| `planogramName` | string | yes |
| `sortOrder` | int | no |
| `categoryId` | guid | yes |
| `shelfType` | enum | no |
| `isActive` | bool | no |
| `rackSideId` | guid | yes |
| `rackId` | guid | yes |
| `rackCode` | string | yes |
| `rackName` | string | yes |
| `sideCode` | string | yes |
| `fixtureType` | string | yes |
| `publishedAt` | datetimeoffset | yes |
| `lastUpdated` | datetimeoffset | no |
| `hasLayout` | bool | no |
| `hasPlanogram` | bool | no |
| `hasIdealImage` | bool | no |
| `isConfigured` | bool | no |
| `idealImageStorageKey` | string | yes |

### Behaviour notes

1. After **Save layout only** (no ideal image): `hasLayout=true`; if SKUs exist, projector may create planogram row → `hasPlanogram=true` + order filled; **`hasIdealImage` / `isConfigured` stay false**.
2. After **Save as planogram** (rename shelf + upload ideal image): `name` updates; `hasIdealImage=true`; if order already projected → `isConfigured=true`.  
   `PUT /layout/shelves/{id}` updates **shelf name**, not `planogramName` (set via AI apply / planogram flows).
3. Shelf **can** exist without `rackId` (orphan / after rack soft-delete). Shelf blueprint / publish / reflow need a linked rack.

---

## 5. Master Data — Racks tab

| Endpoint | Use |
|----------|-----|
| `GET /layout/racks?storeId=` | Summary list (`StoreRackSummaryDto`); `displayName` = blueprintName ?? rackCode ?? fixtureType |
| `GET /layout/racks/by-store/{storeId}` | Full nested structures; derive Rows / Bins / SKUs counts from arrays (**live**, not denormalized) |

### Delete rack

`DELETE /layout/racks/{id}` soft-deletes rack / sides / rows / bins **only**. Shelves stay active. Planogram list row remains with `hasLayout=false`, `rackId=null`.

---

## 6. Cross-portal refresh after 3D actions

| 3D action | API | Planogram list | Racks list |
|-----------|-----|----------------|------------|
| Create / place rack | `POST /layout/racks` | **new row(s)** (1–2 shelves), `hasLayout=true`, not configured | **new row** |
| Save layout (full tree) | `PUT /layout/racks/{id}` | updates `lastUpdated`; may set `hasPlanogram` + order; not configured without image | updates dims / structure / counts |
| Save placement only | `PUT /layout/racks/{id}` | `lastUpdated` if rack updates | placement updates — **see §7 warning** |
| Rename shelf + ideal image | `PUT /layout/shelves/{id}` + `PUT .../planogram/ideal-image` | updates `name`; `hasIdealImage` → ideally `isConfigured` | unchanged |
| Attach SKU | `POST /layout/bin-inventory/attach` | may refresh order; may become configured if image exists | SKU count up |
| Publish to stores | `POST .../publish` | may set `publishedAt`; **new shelves** in target stores | **new racks** in targets |
| Reflow | `POST .../reflow` or `.../reflow-to-racks` | order / utilization refresh | structure / SKU counts change |
| Delete rack | `DELETE /layout/racks/{id}` | **row remains**, unlinked | **removes row** |

Legend: **unchanged** / **updates field X** / **new row** / **removes row** as in table.

---

## 7. Face-fill / `PUT /layout/racks/{id}` validation

### Current save rules (soft mode)

| Rule | Behaviour |
|------|-----------|
| Tolerance | **0.01 m (1 cm)** |
| Underfill | Allowed (unused front span / under-filled bins OK) |
| Empty bins | Allowed on save |
| Overfill | **Rejected**: `Σ(product.width × product.quantity) > bin.width + 0.01` |
| Bin widths vs row span | Overfill rejected; underfill allowed |

Example error:

```text
Product facing width (5.04m) exceeds bin width (2.578m).
```

### Quantity meaning

| Field | Meaning |
|-------|---------|
| `products[].quantity` | **Front facings** (linear). Occupied = `Σ(width × quantity)` |
| `bin.quantity` | Inventory units; ideal-order projector expands SKU name × this value |

**Max front facings** = `floor(binWidth / skuWidth)`.

Example: bin `2.578`, SKU width `0.12` → max `21`. `quantity: 42` → `5.04` facing width → **422**.

### FE vs BE

- BE does **not** auto-clamp / stretch on save.
- Reflow packs to whole facings.
- FE should clamp facings before PUT to avoid overfill 422.

### Placement-only PUT warning

- Face-fill still runs if sides/rows/bins are present.
- `Sides` count must match `isDoubleSided` (exactly 1 or 2).
- Omitting `rows` (`null` → `[]`) **soft-deletes all rows**.
- There is **no** safe slim placement-only body: send full side/row/bin tree, or include existing rows when changing placement.

Error envelope codes: typically `business_rule`, `validation`, `not_found`, `conflict`.

---

## 8. Ideal image / “Save as planogram”

### Official paths (both supported)

1. **Multipart (simple):**  
   `PUT /layout/shelves/{shelfId}/planogram/ideal-image`  
   form field: `file` (`image/png|jpeg|jpg|webp`)

2. **Presign:**  
   `POST /layout/shelves/{shelfId}/planogram/presign-upload`  
   → upload to storage  
   → `PUT /layout/shelves/{shelfId}/planogram` with `{ idealImageStorageKey, sosTargetBrand? }`

Both upsert `ShelfPlanogram` and call ideal-order projector.

### Response (`ShelfPlanogramDto`)

| Field | Type |
|-------|------|
| `shelfId` | guid |
| `planogramName` | string? |
| `idealImageUrl` | string? (presigned read URL) |
| `idealImageOrderJson` | string |
| `sosTargetBrand` | string? |
| `isConfigured` | bool |

List flags (`hasIdealImage`, etc.) come from `GET /layout/shelves`, not this DTO.

### Recommended 3D → planogram sequence

1. `POST /layout/racks` → shelves auto-created  
2. Edit in 3D  
3. `PUT /layout/racks/{id}` full tree, facings clamped  
4. Optional `PUT /layout/shelves/{shelfId}` rename  
5. `PUT .../planogram/ideal-image`  
6. Confirm list `isConfigured=true`  
7. Publish if copying to other stores  

No separate “create planogram” API. Naming shelf ≠ `planogramName`.

---

## 9. API catalogue

All paths under `/api/v1` unless noted. Status: **supported** / **retired**.

### 9.1 Shelves — ` /layout/shelves`

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/layout/shelves` | supported | Master Data Planogram list; query: `storeId`, `search`, `page`, `pageSize` |
| POST | `/layout/shelves` | supported | Manual shelf create (rare; racks auto-create) |
| GET | `/layout/shelves/{shelfId}` | supported | Shelf detail |
| PUT | `/layout/shelves/{shelfId}` | supported | Rename / category / type / active |
| DELETE | `/layout/shelves/{shelfId}` | supported | Soft-remove shelf |
| GET | `/layout/shelves/{shelfId}/blueprint` | supported | One-face blueprint |
| GET | `/layout/shelves/{shelfId}/planogram` | supported | Planogram DTO |
| PUT | `/layout/shelves/{shelfId}/planogram` | supported | Set `idealImageStorageKey` / SOS brand |
| PUT | `/layout/shelves/{shelfId}/planogram/ideal-image` | supported | Multipart ideal image |
| POST | `/layout/shelves/{shelfId}/planogram/presign-upload` | supported | Presign upload URL |

### 9.2 Racks — `/layout/racks`

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/layout/racks` | supported | Summary list; query: `storeId`, `rackCode`, `rackName`, page |
| POST | `/layout/racks` | supported | Create rack + sides + auto shelves |
| GET | `/layout/racks/by-store/{storeId}` | supported | Full structures for store |
| GET | `/layout/racks/{rackId}` | supported | Rack summary |
| PUT | `/layout/racks/{rackId}` | supported | Full layout update + soft face-fill |
| DELETE | `/layout/racks/{rackId}` | supported | Soft-delete hierarchy (not shelves) |
| GET | `/layout/racks/{rackId}/structure` | supported | Operational tree |
| GET | `/layout/racks/{rackId}/blueprint` | supported | Blueprint envelope |
| PUT | `/layout/racks/{rackId}/posm-items` | supported | Header/footer/wall/bin POSM |
| POST | `/layout/racks/{rackId}/publish/preview` | supported | Publish dry-run |
| POST | `/layout/racks/{rackId}/publish` | supported | Clone to target stores |
| POST | `/layout/racks/{rackId}/reflow/preview` | supported | Single-rack reflow preview |
| POST | `/layout/racks/{rackId}/reflow` | supported | Single-rack reflow apply |
| POST | `/layout/racks/{rackId}/reflow-to-racks/preview` | supported | Multi-target preview |
| POST | `/layout/racks/{rackId}/reflow-to-racks` | supported | Multi-target apply |

### 9.3 Rack sides — `/layout/rack-sides`

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| PUT | `/layout/rack-sides/{rackSideId}/shelf` | supported | Link / reassign shelf to side |

### 9.4 Rack rows — `/layout/rack-rows`

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/layout/rack-rows` | supported | Add row |
| GET | `/layout/rack-rows/by-side/{rackSideId}` | supported | List rows on side |
| GET | `/layout/rack-rows/{rowId}/inventory` | supported | Row inventory |
| DELETE | `/layout/rack-rows/{rowId}` | supported | Soft-remove row |

### 9.5 Bins — `/layout/bins`

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/layout/bins` | supported | Add bin |
| GET | `/layout/bins/by-row/{rackRowId}` | supported | Bins on row |
| POST | `/layout/bins/merge` | supported | Merge bins |
| DELETE | `/layout/bins/{binId}` | supported | Soft-remove bin |

### 9.6 Bin inventory — `/layout/bin-inventory`

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/layout/bin-inventory/attach` | supported | Attach SKU to bin |
| POST | `/layout/bin-inventory/detach` | supported | Detach SKU |
| GET | `/layout/bin-inventory/by-bin/{binId}` | supported | Bin inventory |

### 9.7 Store blueprints — `/layout/blueprints`

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/layout/blueprints` | supported | List store blueprints |
| POST | `/layout/blueprints` | supported | Create |
| GET | `/layout/blueprints/{blueprintId}` | supported | Get one |
| PUT | `/layout/blueprints/{blueprintId}` | supported | Update |
| DELETE | `/layout/blueprints/{blueprintId}` | supported | Remove |
| GET | `/layout/blueprints/by-store/{storeId}` | supported | By store |

### 9.8 AI planogram — `/layout/ai-planogram`

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/layout/ai-planogram/resolve-rack-scores` | supported | Score SKUs on a rack |
| POST | `/layout/ai-planogram/generate-scored-ranking` | supported | Generate ranking + suggested facings |
| POST | `/layout/ai-planogram/preview-utilization` | supported | Preview utilization |
| POST | `/layout/ai-planogram/apply-scored-ranking` | supported | Apply ranking + set `planogramName` |
| GET | `/layout/ai-planogram/scoring-configuration` | supported | Org scoring config |
| PUT | `/layout/ai-planogram/scoring-configuration` | supported | Upsert scoring config |
| GET | `/layout/ai-planogram/rack-scoring-configuration` | supported | Rack scoring config |
| PUT | `/layout/ai-planogram/rack-scoring-configuration` | supported | Upsert rack scoring |
| GET | `/layout/ai-planogram/sku-sales` | supported | List SKU sales |
| PUT | `/layout/ai-planogram/sku-sales` | supported | Upsert SKU sales |
| GET | `/layout/ai-planogram/sales-performance` | supported | Store SKU performance |
| PUT | `/layout/ai-planogram/sales-performance` | supported | Upsert performance |
| POST | `/layout/ai-planogram/sales-performance/import` | supported | Import file |
| GET | `/layout/ai-planogram/sales-performance/imports` | supported | Import history |

### 9.9 Related non-layout APIs (commonly used with layout)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET | `/locations/branches` | supported | Store picker |
| GET | `/catalog/skus` | supported | SKU list |
| GET | `/catalog/categories` | supported | Categories |
| GET | `/catalog/categories/with-skus` | supported | Categories with all SKUs |
| GET/POST | `/company-assets/posm` | supported | POSM catalogue |
| GET | `/dashboard/sales/*` | supported | Sales KPIs (see `DASHBOARD_SALES_KPI_APIS.md`) |

### 9.10 Retail execution (capture — needs configured planogram)

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| POST | `/store-visits/{visitId}/shelves/{shelfId}/captures/register` | supported | Real inference |
| POST | `/store-visits/{visitId}/shelves/{shelfId}/captures/register-demo` | supported | Demo stub; requires `isConfigured` |

### 9.11 Retired

| Method | Path | Status | Notes |
|--------|------|--------|-------|
| GET/POST | `/catalog/planograms` | **retired** | Replaced by shelf + layout + `ShelfPlanogram`. FE 410 stub is correct. |

---

## 10. Known gotchas / non-breaking notes

1. Soft face-fill on save: underfill OK; overfill still hard; tolerance **1 cm**.
2. No placement-only skip of hierarchy validation.
3. Delete rack does not remove shelves.
4. `rackName` on shelves list = blueprint name; rack summary `displayName` prefers blueprint name.
5. Do not invent draft/published shelf states — use §3 flags.
6. `PUT /layout/shelves/{id}` does not set `planogramName`.
7. Ideal order is never FE-authored.

---

## 11. Example that caused 422

- Row span ≈ `2.579`, bin width `2.578` → underfill / within 1 cm → **OK** under soft rules.
- Product `quantity: 42` × SKU width `0.12` = facing `5.04` > bin `2.578` → **422 business_rule**.
- Fix on FE: set `quantity` ≤ `floor(2.578 / 0.12) = 21`. BE will not auto-correct on save.
