# Frontend Integration Guide: Rack Blueprint Contract

**Status:** Backend deployed. Migration `AddRackBlueprintContract` applied. Safe to integrate against live API.

Handoff doc for frontend. Backend spec: [RACK_BLUEPRINT_BACKEND.md](./RACK_BLUEPRINT_BACKEND.md).

**Units:** all dimensions are **meters**. Display cm/mm in UI; send/store meters ([LAYOUT_SCALE_SPEC.md](./LAYOUT_SCALE_SPEC.md)).

**Auth:** `layout:view` (GET), `layout:manage` (POST/PUT/DELETE).

**Also read:** shelf talkers + side zones → [FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md](./FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md).

**Response envelope:** all endpoints return `ApiEnvelope<T>` (`success`, `data`, `message`, `errors`).

---

## Quick start

| Task | Call |
|------|------|
| Load store for 2D editor | `GET /api/v1/layout/racks/by-store/{storeId}` |
| Load one rack (full tree) | `GET /api/v1/layout/racks/{rackId}/structure` |
| Load blueprint for 3D view | `GET /api/v1/layout/racks/{rackId}/blueprint` |
| Create custom fixture | `POST /api/v1/layout/racks` with `outer` + `shell` + `placement` |
| Save layout edits | `PUT /api/v1/layout/racks/{rackId}` with nested `sides[].rows[].bins[]` |
| Assign inventory SKU | `POST /api/v1/layout/bin-inventory/attach` |

**First integration step:** extend your rack TypeScript model with `outer`, `shell`, `inner`, `placement` from a structure response, then wire 3D renderer to `GET .../blueprint`.

---

## Summary checklist

- [ ] Extend rack types with `outer`, `shell`, `inner`, `placement`, `fixtureType`, `blueprintName`
- [ ] On store layout load, use `placement` (or legacy `position`) from API — stop client-only position state
- [ ] Render rack shell (walls, header/footer, materials) from `shell` in 3D view
- [ ] Use `inner` for row/bin containment guides, not `outer`
- [ ] Accept **both** `span` and `width` on rows; they are equal on read
- [ ] Show `yStart`/`yEnd` on rows and `xStart`/`xEnd` on bins for stacked layout
- [ ] Use `products[]` for multi-widget blueprint; keep `attach`/`detach` for inventory SKU
- [ ] Add `GET .../blueprint` for 3D serializer/deserializer
- [ ] On create custom rack, send nested `outer` + `shell` + `placement`
- [ ] Validate row span against `inner.width`, not rack `width`
- [ ] Shelf talker + side zone work unchanged (see companion doc)

---

## 1. What changed

| Area | Before | Now |
|------|--------|-----|
| Rack envelope | flat `width` / `depth` / `height` only | + `outer`, `shell`, `inner`, `placement`, `fixtureType`, `blueprintName` on reads |
| Placement | `position: { x, y, z, rotationY }` | + full `placement` with `rotation.x/y/z`, `snapMode`, `quadrant` |
| Row horizontal extent | `span` only | `span` **and** `width` on reads (same value); **both accepted on writes** |
| Row vertical position | not exposed | `yStart`, `yEnd` (computed or persisted) |
| Bin horizontal position | `sequenceNumber` only | + `slotIndex`, `slotCount`, `xStart`, `xEnd` |
| Products in bin | single SKU via `sku` + attach endpoint | + `products[]` array; SKU still authoritative for inventory |
| Full blueprint document | none | `GET /racks/{rackId}/blueprint` |
| Row span validation | vs rack `width` | vs rack **`inner.width`** |

Existing flat create/update payloads still work. New nested blueprint fields are additive.

---

## 2. Two ways to load rack data

### A. Store layout (editor / planogram UI)

```
GET /api/v1/layout/racks/by-store/{storeId}?page=1&pageSize=20
GET /api/v1/layout/racks/{rackId}/structure
```

Returns `StoreRackStructureDto` — same hierarchy (`sides → rows → bins`), enriched with blueprint fields at every level.

### B. Blueprint document (3D renderer / round-trip save)

```
GET /api/v1/layout/racks/{rackId}/blueprint
```

Returns `RackBlueprintDto` — spec envelope:

```json
{
  "schemaVersion": "1.0",
  "storeId": "uuid",
  "blueprintId": "uuid",
  "name": "Back-Wall Cooler Bay A",
  "rack": {}
}
```

| Field | Meaning |
|-------|---------|
| `blueprintId` | Same as `rackId` (per-rack blueprint) |
| `name` | `blueprintName` ?? `rackCode` |

Use **structure** for CRUD editors. Use **blueprint** when you need the exact nested document shape for 3D/traditional view serialization.

> **Not** the same as `GET /api/v1/layout/blueprints/...` — that is the **store defaults template** (`DefaultRackHeight`, `RowsPerSide`, etc.).

---

## 3. Rack-level response shape

Every rack in structure/summary/blueprint includes:

```typescript
interface RackEnvelope {
  rackId: string;
  rackCode: string | null;
  blueprintName: string | null;
  fixtureType: string;          // default "CUSTOM"

  // Legacy flat dims (still present)
  width: number | null;
  depth: number | null;
  height: number | null;
  isDoubleSided: boolean;

  // Legacy placement (still present)
  position: { x, y, z, rotationY } | null;

  // Blueprint placement (superset)
  placement: {
    position: { x, y, z } | null;
    rotation: { x, y, z } | null;
    snapMode: string | null;    // e.g. "wall"
    quadrant: string | null;    // e.g. "NE"
  } | null;

  outer:  { width, depth, height };
  shell:  RackShell;
  inner:  { width, depth, height };  // server-computed + persisted
  sides:  Side[];
}
```

### Shell object

```json
{
  "wallThickness": 0.08,
  "walls": { "back": true, "left": true, "right": true, "frontGlass": false },
  "header": {
    "enabled": true,
    "width": 1.84, "depth": 0.29, "height": 0.35,
    "protrusion": 0.04, "color": "#2C5282", "emissive": "#1A365D"
  },
  "footer": {
    "enabled": true,
    "width": 1.8, "depth": 0.74, "height": 0.18,
    "protrusion": 0.02, "color": "#2C5282", "emissive": "#1A365D"
  },
  "frame": { "cornerPosts": 4, "topRail": true, "innerFloor": true },
  "materials": { "accentColor": "#2C5282", "wallColor": "#e8eaed", "postColor": "#1a1a1a" }
}
```

### Defaults (when not set on rack)

| Field | Default |
|-------|---------|
| `fixtureType` | `"CUSTOM"` |
| `shell.wallThickness` | `0.08` m |
| `shell.walls.back/left/right` | `true` |
| `shell.walls.frontGlass` | `false` |
| `shell.header.enabled` / `footer.enabled` | `true` |

### Inner cavity (server-computed)

```
inner.width  = outer.width  − 2 × wallThickness
inner.depth  = outer.depth  − 2 × wallThickness
inner.height = outer.height − header.height(enabled) − footer.height(enabled) − wallThickness
```

Mirror these in the UI for instant validation feedback.

---

## 4. Side-level shape

Each side has **two parallel dimension models**:

| Object | Purpose |
|--------|---------|
| `dimensions: { usableWidth, usableDepth, usableHeight }` | Blueprint cavity per face (from rack `inner` + side overrides) |
| `inner` / `outer` / `header` / `footer` zones | Merchandising depth slices (existing zone model) |

```json
{
  "sideId": "uuid",
  "sideCode": "CUSTOM-01-S1",
  "depth": 0.56,
  "totalRows": 2,
  "dimensions": {
    "usableWidth": 1.64,
    "usableDepth": 0.56,
    "usableHeight": 5.79
  },
  "inner":  { "width": 1.64, "depth": 0.40 },
  "outer":  { "width": 1.64, "depth": 0.05 },
  "header": { "width": 1.84, "depth": 0.29, "height": 0.35 },
  "footer": { "width": 1.80, "depth": 0.74, "height": 0.18 },
  "rows": []
}
```

Zone nulls still mean "not explicitly set" — display fallbacks unchanged from [FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md](./FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md).

---

## 5. Row shape

```typescript
interface Row {
  rowId: string;
  rowNumber: number;
  note: string | null;

  span: number | null;           // stored field
  width: number | null;          // blueprint alias (= span on read)
  height: number | null;
  depth: number | null;
  dividerThickness: number;      // default 0.025 m

  yStart: number | null;         // computed from stacked heights when null
  yEnd: number | null;
  sided: string | null;          // "one" | "two", default "one"

  talkers: ShelfTalker[];
  bins: Bin[];
}
```

### `span` vs `width`

| | Behavior |
|---|----------|
| **Reads** | Both returned; values identical |
| **Writes** | Send either `span` or `width` (or both); `span ?? width` wins |
| **Validation** | Horizontal extent checked against **`inner.width`**, not `outer.width` |

### Vertical stacking

Rows ordered by `rowNumber`. When `yStart`/`yEnd` are not stored:

```
yStart(row[i]) = sum(height of rows[0..i-1])
yEnd(row[i])   = yStart + row[i].height
```

Persist explicit anchors via PUT when the editor uses custom vertical positioning.

---

## 6. Bin shape

```typescript
interface Bin {
  binId: string;
  binName: string | null;
  width: number | null;
  depth: number | null;
  height: number | null;

  slotIndex: number | null;     // defaults to order index (0-based)
  slotCount: number | null;     // defaults to active bin count in row
  xStart: number | null;         // computed from bin widths when null
  xEnd: number | null;

  sequenceNumber: number | null; // legacy ordering (still present)
  products: Product[];
  sku: Sku | null;               // inventory SKU (single-SKU model)
}

interface Product {
  id: string | null;             // skuId when linked, else product row id
  name: string;
  width: number;
  depth: number;
  height: number;
  weightKg: number | null;
  quantity: number;              // facings count
  imageUrl: string | null;
}
```

### Products vs SKU

| Source | When |
|--------|------|
| `products[]` populated | Explicit products saved via bin create/update |
| `products[]` derived from `sku` | No explicit products, but SKU attached via attach endpoint |
| `sku` | Inventory assignment (max 1 SKU per bin) |

For 3D rendering, prefer `products[]`. For planogram/inventory UI, prefer `sku`.

### Horizontal anchors

Bins ordered by `slotIndex` → `sequenceNumber` → creation time. When `xStart`/`xEnd` are null:

```
xStart(bin[i]) = sum(width of bins[0..i-1])
xEnd(bin[i])   = xStart + bin[i].width
```

---

## 7. Write API reference

### Create rack — `POST /api/v1/layout/racks`

Supports **both** legacy flat and blueprint nested input.

**Blueprint style (recommended for custom fixtures):**

```json
{
  "storeId": "uuid",
  "rackCode": "CUSTOM-01",
  "blueprintName": "Back-Wall Cooler Bay A",
  "fixtureType": "CUSTOM",
  "isDoubleSided": false,
  "outer": { "width": 1.8, "depth": 0.72, "height": 6.4 },
  "shell": {
    "wallThickness": 0.08,
    "walls": { "back": true, "left": true, "right": true, "frontGlass": false },
    "header": {
      "enabled": true,
      "width": 1.84, "depth": 0.29, "height": 0.35,
      "protrusion": 0.04, "color": "#2C5282", "emissive": "#1A365D"
    },
    "footer": {
      "enabled": true,
      "width": 1.8, "depth": 0.74, "height": 0.18,
      "protrusion": 0.02, "color": "#2C5282", "emissive": "#1A365D"
    },
    "frame": { "cornerPosts": 4, "topRail": true, "innerFloor": true },
    "materials": { "accentColor": "#2C5282", "wallColor": "#e8eaed", "postColor": "#1a1a1a" }
  },
  "placement": {
    "position": { "x": 12.2, "y": 0, "z": -6.4 },
    "rotation": { "x": 0, "y": 1.5708, "z": 0 },
    "snapMode": "wall",
    "quadrant": "NE"
  }
}
```

**Legacy flat (still works):**

```json
{
  "storeId": "uuid",
  "rackCode": "R-01",
  "width": 1.2,
  "depth": 0.5,
  "height": 1.8,
  "isDoubleSided": false,
  "positionX": -8.5,
  "positionY": 0,
  "positionZ": 4.2,
  "rotationY": 1.5708
}
```

Response: `{ rackId, sideIds[] }`.

---

### Update rack — `PUT /api/v1/layout/racks/{rackId}`

Top-level shell/placement fields are partial-update safe. Nested `sides[]` still required with correct count (1 or 2 for single/double-sided).

```json
{
  "rackId": "uuid",
  "blueprintName": "Wall Bay Blueprint",
  "fixtureType": "CUSTOM",
  "outer": { "width": 1.8, "depth": 0.72, "height": 6.4 },
  "shell": { "wallThickness": 0.08, "header": { "enabled": true, "height": 0.35 } },
  "placement": { "position": { "x": 12.2, "y": 0, "z": -6.4 } },
  "isDoubleSided": false,
  "sides": [
    {
      "id": "side-guid",
      "inner":  { "width": 1.64, "depth": 0.40 },
      "outer":  { "width": 1.64, "depth": 0.05 },
      "header": { "width": 1.64, "depth": 0.50, "height": 0.15 },
      "footer": { "width": 1.64, "depth": 0.50, "height": 0.10 },
      "rows": [
        {
          "id": "row-guid",
          "rowNumber": 1,
          "width": 1.5,
          "height": 0.4,
          "depth": 0.53,
          "sided": "one",
          "dividerThickness": 0.025,
          "bins": [
            {
              "id": "bin-guid",
              "binName": "Left Bin",
              "width": 0.5,
              "depth": 0.5,
              "height": 0.35,
              "slotIndex": 0,
              "slotCount": 3,
              "products": [
                {
                  "id": "sku-uuid",
                  "name": "Widget A",
                  "width": 0.12,
                  "depth": 0.08,
                  "height": 0.2,
                  "weightKg": 0.45,
                  "quantity": 3
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Rows/bins without `id` are created. Rows/bins omitted from the payload are soft-deleted.

---

### Add row — `POST /api/v1/layout/rack-rows`

```json
{
  "rackSideId": "uuid",
  "height": 0.4,
  "span": 1.5,
  "width": 1.5,
  "dividerThickness": 0.025,
  "depth": 0.53,
  "sided": "one",
  "yStart": 0.0,
  "yEnd": 0.4
}
```

`span` and `width` are interchangeable on input.

---

### Add bin — `POST /api/v1/layout/bins`

```json
{
  "rackRowId": "uuid",
  "binName": "Center Bin",
  "width": 0.5,
  "height": 0.35,
  "depth": 0.5,
  "slotIndex": 1,
  "slotCount": 3,
  "xStart": 0.5,
  "xEnd": 1.0,
  "products": []
}
```

---

### Inventory SKU (unchanged)

```json
POST /api/v1/layout/bin-inventory/attach
{ "binId": "uuid", "skuId": "uuid", "quantity": 4 }

POST /api/v1/layout/bin-inventory/detach
{ "binId": "uuid" }
```

Attach assigns inventory SKU; does **not** write `products[]`. On read, `products[]` is derived from `sku` when no explicit products exist. Detach clears SKU and deactivates explicit products.

---

## 8. Client-side validation

Mirror these for instant UI feedback; server enforces on write.

### Rack / shell

- `outer.width/depth/height > 0` when provided
- `shell.wallThickness > 0`
- `header.height + footer.height ≤ outer.height`

### Rows

- `row.span` (or `width`) `≤ inner.width`
- `sum(active row heights) ≤ inner.height`
- `row.depth ≤ side effective depth`

### Bins

- `sum(bin.width) ≤ row.span`
- `bin.height ≤ row.height`
- `bin.depth ≤ row.depth`
- `sum(product.width × product.quantity) ≤ bin.width` (product facing width)

### Shelf talkers

Unchanged — see [FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md](./FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md).

---

## 9. Endpoint matrix

| Method | Path | Returns / action |
|--------|------|------------------|
| `GET` | `/api/v1/layout/racks/by-store/{storeId}` | Paginated store layout with blueprint fields |
| `GET` | `/api/v1/layout/racks/{rackId}/structure` | Single rack structure |
| `GET` | `/api/v1/layout/racks/{rackId}/blueprint` | **Full blueprint document** |
| `GET` | `/api/v1/layout/racks/{rackId}` | Rack summary (no rows) |
| `POST` | `/api/v1/layout/racks` | Create rack |
| `PUT` | `/api/v1/layout/racks/{rackId}` | Update rack + nested sides/rows/bins/products |
| `GET` | `/api/v1/layout/rack-rows/by-side/{sideId}` | Rows with `span`, `width`, anchors |
| `POST` | `/api/v1/layout/rack-rows` | Add row |
| `POST` | `/api/v1/layout/bins` | Add bin (+ optional products) |
| `POST` | `/api/v1/layout/bin-inventory/attach` | Assign SKU |
| `POST` | `/api/v1/layout/bin-inventory/detach` | Clear SKU + products |
| `POST` / `PUT` / `DELETE` | `/api/v1/layout/shelf-talkers/...` | Talker CRUD |

---

## 10. Recommended data flow

```
Store layout page load
  → GET /racks/by-store/{storeId}
  → 2D editor uses structure DTO
  → 3D view uses same data OR GET /racks/{rackId}/blueprint

User creates custom rack
  → POST /racks with outer + shell + placement
  → Save returned rackId + sideIds

User edits rows/bins/products
  → PUT /racks/{rackId} with nested sides
  → Replace temp IDs with server IDs on next load

Assign inventory SKU
  → POST /bin-inventory/attach
  → products[] auto-derived on read from sku
```

---

## 11. TypeScript types (starter)

```typescript
type Meters = number;

interface RackBlueprint {
  schemaVersion: '1.0';
  storeId: string;
  blueprintId: string;
  name: string | null;
  rack: {
    rackId: string;
    rackCode: string | null;
    fixtureType: string;
    placement: RackPlacement | null;
    outer: Dimensions3;
    shell: RackShell;
    inner: Dimensions3;
    layout: { sides: BlueprintSide[] };
  };
}

interface Dimensions3 {
  width: Meters | null;
  depth: Meters | null;
  height: Meters | null;
}

interface RackPlacement {
  position: { x: number; y: number; z: number } | null;
  rotation: { x: number; y: number; z: number } | null;
  snapMode: string | null;
  quadrant: string | null;
}

interface RackShell {
  wallThickness: Meters;
  walls: { back: boolean; left: boolean; right: boolean; frontGlass: boolean };
  header: HeaderFooterBand;
  footer: HeaderFooterBand;
  frame: { cornerPosts: number | null; topRail: boolean | null; innerFloor: boolean | null };
  materials: { accentColor: string | null; wallColor: string | null; postColor: string | null };
}

interface HeaderFooterBand {
  enabled: boolean | null;
  width: Meters | null;
  depth: Meters | null;
  height: Meters | null;
  protrusion: Meters | null;
  color: string | null;
  emissive: string | null;
}

interface BlueprintSide {
  sideId: string;
  sideCode: string | null;
  dimensions: { usableWidth: Meters | null; usableDepth: Meters | null; usableHeight: Meters | null } | null;
  rows: BlueprintRow[];
}

interface BlueprintRow {
  rowId: string;
  rowNumber: number | null;
  width: Meters | null;
  depth: Meters | null;
  height: Meters | null;
  yStart: Meters | null;
  yEnd: Meters | null;
  sided: string | null;
  span: Meters | null;
  dividerThickness: Meters;
  talkers: ShelfTalker[];
  bins: BlueprintBin[];
}

interface BlueprintBin {
  binId: string;
  binName: string | null;
  width: Meters | null;
  depth: Meters | null;
  height: Meters | null;
  xStart: Meters | null;
  xEnd: Meters | null;
  slotIndex: number | null;
  slotCount: number | null;
  products: BinProduct[];
}

interface BinProduct {
  id: string | null;
  name: string;
  width: Meters;
  depth: Meters;
  height: Meters;
  weightKg: Meters | null;
  quantity: number;
  imageUrl: string | null;
}
```

---

## 12. Related docs

| Doc | Contents |
|-----|----------|
| [RACK_BLUEPRINT_BACKEND.md](./RACK_BLUEPRINT_BACKEND.md) | Canonical blueprint spec (backend contract) |
| [FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md](./FRONTEND_SHELF_TALKER_AND_RACK_ZONES.md) | Shelf talkers, side zones, row `span` rename |
| [LAYOUT_SCALE_SPEC.md](./LAYOUT_SCALE_SPEC.md) | Coordinate system and scale |
