# Frontend Changes: `main` → `main-v2`

**Branch:** `main-v2`  
**Base:** `main`  
**Audience:** Portal / layout editor / catalog / journey planning frontend  
**Units:** all layout dimensions are **meters** (display cm/mm in UI; send meters)  
**Auth:** `layout:view` / `layout:manage`, `catalog:*`, `company-assets:*` as noted  
**Envelope:** all responses are `ApiEnvelope<T>` (`success`, `data`, `message`, `errors`)

After deploy, run `POST /api/v1/permissions/sync` so new action paths are registered.

This is the **master handoff**. Deep contracts live in the linked docs at the end.

---

## Executive summary

`main-v2` retires Catalog Planogram authoring and rebuilds merchandising around **StoreLayout**:

| Theme | Frontend impact |
|-------|-----------------|
| **CatalogPlanogram removed** | Delete all planogram CRUD UI/clients |
| **First-class `Shelf`** | New shelf CRUD + shelf↔rack-side linkage; planogram screen becomes **read-only visualization** |
| **Rack blueprint** | Outer/shell/inner/placement, row `span`, bin slots, `products[]`, 3D blueprint GET |
| **POSM on racks** | Shelf talkers gone; display-program placement replaced by POSM items |
| **Publish & reflow** | Multi-store rack clone + resize with exception tray |
| **Catalog SKU** | Required dimensions; attachments become `{ storageKey, is3D }` |

---

## Priority order for frontend work

1. **P0 — Breaking removals** (app will 404 without these)
2. **P0 — Catalog SKU contract** (create/update payloads break)
3. **P1 — Shelf + planogram visualization** (replaces planogram screens)
4. **P1 — Rack blueprint + layout editor** (structure/blueprint fields)
5. **P1 — POSM placement** (layout signage model)
6. **P2 — Journey / Secondary Display renames**
7. **P2 — Publish & reflow wizards**

---

## 1. Removed APIs (delete all callers)

### 1.1 Catalog Planograms — entire module gone

| Method | Route |
|--------|-------|
| POST | `api/v1/catalog/planograms` |
| PUT | `api/v1/catalog/planograms/{id}` |
| DELETE | `api/v1/catalog/planograms/{id}` |
| POST | `api/v1/catalog/planograms/{id}/deactivate` |
| POST | `api/v1/catalog/planograms/{planogramId}/publish` |
| POST | `api/v1/catalog/planograms/{id}/duplicate` |
| POST | `api/v1/catalog/planograms/.../assign` |
| GET | `api/v1/catalog/planograms/{id}` |
| GET | `api/v1/catalog/planograms` |
| GET | `api/v1/catalog/planograms/statuses` |

Also remove: `CatalogPlanogramStatus` (`Draft` / `Published` / `Archived`), planogram authoring screens (rows/slots/facings), and any “publish planogram → ideal order” flow.

Ideal order is now **server-projected** from rack bins. Ideal reference image is uploaded per shelf (see §3).

### 1.2 Shelf talkers — deleted

| Method | Route |
|--------|-------|
| POST | `api/v1/layout/shelf-talkers` |
| PUT | `api/v1/layout/shelf-talkers/{shelfTalkerId}` |
| DELETE | `api/v1/layout/shelf-talkers/{shelfTalkerId}` |
| GET | `api/v1/layout/shelf-talkers/by-row/{rackRowId}` |

Remove types: `ShelfTalker`, `talkers[]` on rows.

### 1.3 Display-program rack placement — replaced

| Old | New |
|-----|-----|
| `PUT /api/v1/layout/racks/{rackId}/display-programs` | `PUT /api/v1/layout/racks/{rackId}/posm-items` |

Remove all `*DisplayProgramId` / `*Display` fields on rack shell and rows (see §5).

### 1.4 Location-tree shelf creation

Shelves are **no longer** created via `POST api/v1/locations` (Branch → Shelf hierarchy removed). Use `POST /api/v1/layout/shelves` or auto-create on rack create / link endpoint.

---

## 2. Catalog SKU — breaking contract changes

### 2.1 Dimensions (meters)

| Operation | Rule |
|-----------|------|
| `POST /api/v1/catalog/skus` | `width`, `height`, `depth` **required**, each `> 0` |
| `PUT /api/v1/catalog/skus/{id}` | If any dimension is set, all three must be `> 0`. Clearing to null is blocked if the SKU is on an active bin |
| List / Get | Responses include `width`, `height`, `depth` |

**UI:** require W/H/D on create. On edit, warn before clearing if SKU is placed on a rack. Attach-to-bin fails without dimensions.

### 2.2 Attachments + `is3D`

| Before | After |
|--------|-------|
| `attachmentStorageKeys: string[]` | `attachments: { storageKey: string, is3D: boolean }[]` |

Applies to create, update, get detail responses.

```typescript
interface CatalogSkuAttachmentItem {
  storageKey: string;
  is3D: boolean; // default false — mark GLB/GLTF / 3D assets true
}
```

**UI:** when uploading SKU assets, set `is3D: true` for 3D models so the layout/3D renderer can pick the correct attachment.

---

## 3. Shelf entity + planogram visualization

**Conceptual shift:** planogram screen is **read-only visualization** of one shelf face (rack side). Authoring = layout editor (attach SKUs to bins).

### 3.1 New / extended shelf APIs

| Task | Method | Route | Permission |
|------|--------|-------|------------|
| List shelves | GET | `/api/v1/layout/shelves?storeId=&search=&page=&pageSize=` | `layout:view` |
| Get shelf | GET | `/api/v1/layout/shelves/{shelfId}` | `layout:view` |
| Create shelf | POST | `/api/v1/layout/shelves` | `layout:manage` |
| Update shelf | PUT | `/api/v1/layout/shelves/{shelfId}` | `layout:manage` |
| Planogram canvas | GET | `/api/v1/layout/shelves/{shelfId}/blueprint` | `layout:view` |
| Ideal order / image | GET | `/api/v1/layout/shelves/{shelfId}/planogram` | `layout:view` |
| Presign ideal photo | POST | `/api/v1/layout/shelves/{shelfId}/planogram/presign-upload` | `layout:manage` |
| Save ideal photo | PUT | `/api/v1/layout/shelves/{shelfId}/planogram` | `layout:manage` |
| Link shelf ↔ side | PUT | `/api/v1/layout/rack-sides/{rackSideId}/shelf` | `layout:manage` |

Legacy list still works: `GET /api/v1/locations/branches/{branchId}/shelves` → `{ id, name, sortOrder }` from the `Shelf` table (IDs preserved).

### 3.2 Create / update shelf

```json
// POST /api/v1/layout/shelves
{
  "storeId": "guid",
  "name": "Shelf D1 - Fresh Produce",
  "sortOrder": 0,
  "categoryId": "guid|null",
  "shelfType": 1
}
```

`shelfType`: `1 = BrandDedicated`, `2 = Shared` (optional, default `1`).

### 3.3 List / detail shape

```typescript
interface ShelfListItemDto {
  id: string;
  storeId: string;
  name: string;
  sortOrder: number;
  categoryId: string | null;
  shelfType: 1 | 2;
  isActive: boolean;
  rackSideId: string | null;
  rackId: string | null;
  rackCode: string | null;
  sideCode: string | null;
  hasLayout: boolean;      // linked to a rack side
  hasPlanogram: boolean;   // ShelfPlanogram row exists
}
```

### 3.4 Auto-link on rack create

`POST /api/v1/layout/racks` creates one `Shelf` per rack side and sets `StoreRackSide.shelfId`. Default name: `{rackCode}-{sideCode}` (e.g. `R-01-S1`).

### 3.5 Manual link / create for a side

```http
PUT /api/v1/layout/rack-sides/{rackSideId}/shelf
```

```json
{ "shelfId": "guid", "createShelf": false }
// or
{ "createShelf": true, "name": "Dairy Face", "categoryId": null, "shelfType": 1 }
```

1:1 — rejects if side or shelf already linked.

### 3.6 Planogram view data

`GET .../shelves/{shelfId}/blueprint` → `ShelfBlueprintDto`:

- `shelf` — detail DTO
- `side` — full blueprint side (rows → bins → products/SKU + POSM)
- `rackOuter` / `rackInner` — dimensions

Unlinked shelf → business/404: *“No rack layout is linked to this shelf.”*  
UI: empty state + CTA to link or open layout editor.

### 3.7 Ideal image upload (order is server-owned)

```text
1. POST .../shelves/{shelfId}/planogram/presign-upload
   { "fileName": "ideal.png", "contentType": "image/png" }
2. PUT uploadUrl (raw bytes)
3. PUT .../shelves/{shelfId}/planogram
   { "idealImageStorageKey": "<key>", "sosTargetBrand": "Almarai" }
```

Do **not** send `idealImageOrderJson` — server refreshes it from bin layout.

### 3.8 Screen anatomy (planogram)

| Region | Content |
|--------|---------|
| Header | Shelf name, category, rack/side codes, “Edit in layout” |
| Canvas | 2D face: rows by `yStart`/`yEnd`, bins by `xStart`/`xEnd`, facings from `products[]` or SKU×qty |
| Legend | Empty bin, missing dims, OOS |
| Footer | Facing/SKU counts |

Deep-link to editor with `rackId` + `rackSideId` from shelf detail/blueprint.

---

## 4. Rack blueprint & layout editor

### 4.1 New / enriched reads

| Task | Call |
|------|------|
| Store layout | `GET /api/v1/layout/racks/by-store/{storeId}` |
| Full tree | `GET /api/v1/layout/racks/{rackId}/structure` |
| 3D blueprint doc | `GET /api/v1/layout/racks/{rackId}/blueprint` |
| Save nested layout | `PUT /api/v1/layout/racks/{rackId}` |

### 4.2 Field changes (must update types)

| Area | Before | Now |
|------|--------|-----|
| Rack envelope | flat `width`/`depth`/`height` | + `outer`, `shell`, `inner`, `placement`, `fixtureType`, `blueprintName` |
| Placement | `position: { x,y,z,rotationY }` | + `placement` with `rotation.x/y/z`, `snapMode`, `quadrant` (persist — stop client-only Zustand) |
| Row horizontal | `width` | **`span`** (breaking rename); reads may expose both `span` and `width` as equal |
| Row vertical | — | `yStart`, `yEnd`, `dividerThickness` (default 0.025 m) |
| Bin position | `sequenceNumber` | + `slotIndex`, `slotCount`, `xStart`, `xEnd` |
| Bin contents | single `sku` | + `products[]` (`BinProductDto`); inventory SKU still via attach/detach |
| Side zones | — | `inner` / `outer` footprints; `header` / `footer` volumes |
| Side ↔ shelf | — | `shelfId` + nested `shelf` summary on side DTOs |

### 4.3 Bin inventory rules

`POST /api/v1/layout/bin-inventory/attach`:

- One SKU per bin; different SKU requires detach first
- Quantity derived from bin × SKU dimensions (capacity)
- Missing dimensions → business error
- Response includes applied `quantity` and `maxQuantity`

Use `products[]` for multi-widget / blueprint merchandising display; keep attach/detach for authoritative inventory SKU.

### 4.4 Validation notes

- Row span validated against **`inner.width`**, not outer rack width
- Vertical stack: `sum(row.height) ≤ rack.height − header.height − footer.height`

---

## 5. POSM placement on racks (replaces talkers / display programs)

One **POSM item** (`Standee` | `ShelfTalker` | `Flyer`) per surface — from Company Assets, not Secondary Display Programs.

| Surface | Write field | Read field |
|---------|-------------|------------|
| Header fascia | `shell.headerPosmItemId` | `shell.headerPosm` |
| Footer kick plate | `shell.footerPosmItemId` | `shell.footerPosm` |
| Left wall | `shell.leftWallPosmItemId` | `shell.leftWallPosm` |
| Right wall | `shell.rightWallPosmItemId` | `shell.rightWallPosm` |
| Row divider | `dividerPosmItemId` | `dividerPosm` |

Hydrated object: `{ id, name, posmType }` — **no** `isWithinDateRange` / `programName`.

**Picker source:** `GET /api/v1/company-assets/posm?storeId=...`  
**Bulk write:** `PUT /api/v1/layout/racks/{rackId}/posm-items`

Journey POSM **tasks** still use `displayProgramIds` + `posmItemIds` — unchanged. Only the **layout editor** placement model changed.

---

## 6. Journey planning & Secondary Display Programs

### 6.1 Shelf Check tasks

| Before | After |
|--------|-------|
| `planogramIds` | `shelfIds` |
| response `planograms: [{id,name}]` | `shelves: [{id,name}]` |

Enabled Shelf Check requires ≥1 active shelf in the stop’s store. “Planogram must be published” rule is gone. Drive picker from shelf list APIs.

### 6.2 Secondary Display Programs

| Before | After |
|--------|-------|
| `catalogPlanogramId` | `shelfId` |
| detail `planogramName` | `shelfName` |
| list `planogramReference` | still named `planogramReference`, but value is **shelf name** |

Relabel UI copy from “Planogram” → “Shelf”.

---

## 7. Rack publish & reflow (new wizards)

### 7.1 Multi-store publish

```
POST /api/v1/layout/racks/{rackId}/publish/preview
POST /api/v1/layout/racks/{rackId}/publish
```

Body: `{ storeIds, rackCode, blueprintName? }`

Per-store status: `ready` / `blocked` (preview) or `created` / `blocked` (publish).  
Copies shell/rows/bins/SKUs/POSM/products + creates shelves. Does **not** copy floor placement.

### 7.2 Reflow on resize

```
POST /api/v1/layout/racks/{rackId}/reflow/preview
POST /api/v1/layout/racks/{rackId}/reflow
```

Or `PUT .../racks/{rackId}` with `"reflowSkus": true`.

Response includes `quantityChanges`, `geometryChanges`, `exceptions[]`.  
**Always show exception tray** — unfit SKUs stay attached with qty 0 (`SkuDoesNotFit`, etc.).

---

## 8. Unchanged (no frontend work)

- Shelf capture / compliance endpoints (`RegisterPresignedShelfCapture`, `ProcessShelfCapture`, review tasks) — still keyed by `shelfId`; shapes unchanged
- Journey POSM task fields (`displayProgramIds`, `posmItemIds`)
- Response envelope / auth middleware pattern

---

## 9. Master frontend checklist

### Removals
- [ ] Delete all `api/v1/catalog/planograms/*` clients, routes, screens, `CatalogPlanogramStatus`
- [ ] Delete shelf-talker clients/types and `talkers[]` rendering
- [ ] Delete `PUT .../display-programs` and all `*DisplayProgramId` / `*Display` fields
- [ ] Remove “add shelf” from location-tree create flow

### Catalog
- [ ] Create SKU: require `width`/`height`/`depth` (meters)
- [ ] Replace `attachmentStorageKeys` with `attachments: { storageKey, is3D }[]`
- [ ] Show dimensions on list/detail; block clear when SKU is on a bin

### Shelves & planogram viz
- [ ] Shelf CRUD + list from `/api/v1/layout/shelves`
- [ ] Planogram canvas from `GET .../shelves/{shelfId}/blueprint`
- [ ] Deep-link to rack editor via `rackId` / `rackSideId`
- [ ] Ideal image: presign → upload → `PUT .../planogram`
- [ ] Empty states for `hasLayout: false` / unlinked blueprint
- [ ] Link UI: `PUT .../rack-sides/{id}/shelf`
- [ ] Expect auto-created shelves on rack create

### Layout editor / 3D
- [ ] Types: `outer`, `shell`, `inner`, `placement`, `fixtureType`, `blueprintName`
- [ ] Persist `placement`/`position` from API (no client-only floor coords)
- [ ] Row `width` → `span`; add `dividerThickness`, `yStart`/`yEnd`
- [ ] Bin `slotIndex`/`slotCount`/`xStart`/`xEnd`; render `products[]`
- [ ] Wire `GET .../racks/{id}/blueprint` for 3D
- [ ] Side zones + shelf summary on sides
- [ ] Attach/detach with capacity errors; require SKU dims

### POSM
- [ ] Shell/row POSM fields + `PUT .../posm-items`
- [ ] Picker from POSM catalog filtered by store
- [ ] Do not use Secondary Display Programs for rack surfaces

### Journey / SDP
- [ ] `planogramIds` → `shelfIds`; `planograms` → `shelves`
- [ ] SDP: `catalogPlanogramId` → `shelfId`; treat list `planogramReference` as shelf name

### Publish / reflow
- [ ] Publish wizard: preview → publish; surface per-store errors
- [ ] Resize: reflow preview → exception tray → apply / `reflowSkus: true`

### Ops
- [ ] Permissions sync after deploy; ensure roles have `layout:view` / `layout:manage`

---

## 10. Detailed companion docs

| Doc | Covers |
|-----|--------|
| [FRONTEND_SHELF_MIGRATION.md](./FRONTEND_SHELF_MIGRATION.md) | Planogram retirement, Shelf CRUD, journey/SDP renames |
| [FRONTEND_PLANOGRAM_VISUALIZATION.md](./FRONTEND_PLANOGRAM_VISUALIZATION.md) | Planogram screen as shelf-face viz + shelf APIs |
| [FRONTEND_RACK_BLUEPRINT.md](./FRONTEND_RACK_BLUEPRINT.md) | Blueprint contract, structure DTOs, 3D |
| [FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md](./FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md) | Zones, floor placement, row `span` |
| [FRONTEND_RACK_POSM_MIGRATION.md](./FRONTEND_RACK_POSM_MIGRATION.md) | Talkers → POSM field rename map |
| [FRONTEND_RACK_DISPLAY_PROGRAMS.md](./FRONTEND_RACK_DISPLAY_PROGRAMS.md) | Why POSM (not display programs) on racks |
| [FRONTEND_RACK_PUBLISH_AND_REFLOW.md](./FRONTEND_RACK_PUBLISH_AND_REFLOW.md) | Multi-store publish + resize reflow |
| [LAYOUT_SCALE_SPEC.md](./LAYOUT_SCALE_SPEC.md) | Coordinate system and units |
| [store-layout-api.md](./store-layout-api.md) | Broader store-layout API reference |

---

## 11. Commits on this branch (for context)

| Commit | Theme |
|--------|-------|
| `caf9cb1` | First-class `Shelf`; retire `CatalogPlanogram` |
| `d091c8e` | ShelfTalker + StoreBinProduct (later superseded for talkers) |
| `b1c0d4b` | `Is3D` on catalog SKU attachments |
| `a9f73a3` | Shelf talkers → rack display-program placement |
| `d6d54be` | Display programs → POSM on rack surfaces |
| `116bc85` | Rack publish & reflow |

Plus uncommitted/staged work on this working tree: shelf list/detail/blueprint/planogram endpoints, rack-side shelf linking, create-rack auto-shelf, and SKU dimension required-on-create validation.
