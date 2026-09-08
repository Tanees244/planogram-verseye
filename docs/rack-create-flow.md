# Complete rack create flow (AISLERIS)

How a store fixture is built in this app: **store → rack → side → row (shelf) → bin (slot) → product (SKU)**, plus **POSM**.

All layout sizes in API payloads are **meters**. Auth is `Authorization: Bearer <token>` (planogram cookie, forwarded by the Next.js proxies).

Two URL layers:

| Layer | Base | Used by |
| --- | --- | --- |
| App proxy (browser) | `/api/...` | Editor, this repo |
| Backend | `/api/v1/...` | Layout / catalog service (`API_BASE_URL`) |

Typical envelope: `{ "isRequestSuccess": true, "data": { ... }, "message": "..." }`.

---

## Object model

```
Store (branch / location)
  └── Rack (fixture on the floor)
        ├── Shell POSM (header / footer / left wall / right wall)
        └── Side (S1, optional S2 if double-sided)
              └── Row  = physical shelf board (height, span, depth)
                    ├── Row POSM (shelf talker on the black front lip)
                    └── Bin = one SKU slot on that shelf
                          ├── Bin POSM (item tag)
                          └── Product / SKU (quantity = facings × depth × stack)
```

**Shelf** in the portal catalog is a **planogram view** linked to a rack side (`shelfId`). The 3D editor’s “shelf” is a **row**.

---

## Happy path (editor)

```mermaid
sequenceDiagram
  participant UI as 3D editor
  participant P as Next.js /api
  participant BE as Layout API /api/v1

  UI->>P: GET /api/locations/list
  P->>BE: GET /api/v1/locations/branches
  Note over UI: Select storeId (branch id)

  UI->>P: POST /api/racks/add-by-location
  P->>BE: POST /api/v1/layout/racks
  Note over UI: Returns rackId + sideIds

  UI->>P: POST /api/racks/add-row-by-side
  P->>BE: POST /api/v1/layout/rack-rows
  Note over UI: One row per side (shelf board)

  UI->>P: POST /api/bins/add-by-row
  P->>BE: POST /api/v1/layout/bins
  Note over UI: Empty slot; do not send products: []

  UI->>P: POST /api/bins/attach-product
  P->>BE: POST /api/v1/layout/bin-inventory/attach

  UI->>P: PUT /api/racks/{rackId}/posm-items
  P->>BE: PUT /api/v1/layout/racks/{rackId}/posm-items

  UI->>P: GET /api/racks/{rackId}/structure
  P->>BE: GET /api/v1/layout/racks/{rackId}/structure
```

---

## Step-by-step

### 0. Auth

- Sign in via `POST /api/login`.
- Later calls send the planogram token as `Authorization: Bearer …`.

### 1. Pick a store

Stores are **branches**. The branch `id` is `storeId` on every create call.

```http
GET /api/locations/list?page=1&pageSize=100
```

Backend: `GET /api/v1/locations/branches`

Use `data.locations[].id`.

### 2. (Optional) Create catalog SKU

Needed before attach if the product is not already in catalog.

**Upload image / GLB first** (then pass `imageStorageKey` / `modelStorageKey`):

```http
POST /api/files/presigned-upload
{ "fileName": "milk.png", "contentType": "image/png", "purpose": "GenericFile" }
```

Backend: `POST /api/v1/files/presigned-upload`

1. PUT the file bytes to the returned signed URL.  
2. Complete:

```http
POST /api/files/complete
{ "objectKey": "<key from presign>" }
```

Backend: `POST /api/v1/files/complete`

Create SKU (width / height / depth in **meters**):

```http
POST /api/products/create
```

```json
{
  "name": "Almarai Fresh Milk 2L",
  "code": "ALM-MILK-02",
  "categoryId": "<uuid>",
  "width": 0.08,
  "height": 0.27,
  "depth": 0.08,
  "imageStorageKey": "skus/images/....png",
  "modelStorageKey": "skus/models/....glb",
  "isStackable": false,
  "isHero": false
}
```

Backend: `POST /api/v1/catalog/skus`

List / get:

| App | Backend |
| --- | --- |
| `GET /api/products/list?search=` | `GET /api/v1/catalog/skus` |
| `GET /api/products/{skuId}` | `GET /api/v1/catalog/skus/{skuId}` |
| `GET /api/categories/list` | `GET /api/v1/catalog/categories` |

### 3. (Optional) Create POSM item

POSM is a **company asset**, then assigned onto a rack.

```http
POST /api/company-assets/posm
```

```json
{
  "name": "Almarai header",
  "posmType": "Header",
  "status": "Active",
  "storeIds": ["<storeId>"],
  "conditionStandards": "Standard",
  "imageStorageKey": "posm/....png"
}
```

`posmType` examples: `Header`, `Footer`, `ShelfTalker`, `Wobbler`, `Dangler`.

Backend: `POST /api/v1/company-assets/posm`

List:

```http
GET /api/company-assets/posm/list?storeId=<storeId>&status=Active
```

Backend: `GET /api/v1/company-assets/posm`

### 4. Create the rack

Place the fixture in the store. Returns **`rackId`** and **`sideIds`**.

```http
POST /api/racks/add-by-location
```

Gondola-style:

```json
{
  "storeId": "<uuid>",
  "rackName": "Almarai Rack",
  "fixtureType": "GONDOLA",
  "isDoubleSided": false,
  "width": 2.7,
  "depth": 1.1,
  "height": 2,
  "outer": { "width": 2.7, "depth": 1.1, "height": 2 },
  "placement": {
    "position": { "x": 1.5, "y": 0, "z": 0.5 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "snapMode": "wall",
    "quadrant": "NE"
  }
}
```

Custom fixture (also send `shell`):

```json
{
  "storeId": "<uuid>",
  "rackName": "Custom cooler",
  "fixtureType": "CUSTOM",
  "isDoubleSided": false,
  "outer": { "width": 2.7, "depth": 1.1, "height": 2 },
  "shell": {
    "wallThickness": 0.06,
    "walls": { "back": true, "left": true, "right": true, "frontGlass": false },
    "header": { "enabled": true, "height": 0.35, "color": "#2C5282" },
    "footer": { "enabled": true, "height": 0.12 }
  },
  "placement": { "position": { "x": 0, "y": 0, "z": 0 }, "rotation": { "x": 0, "y": 0, "z": 0 } }
}
```

Backend: `POST /api/v1/layout/racks`

`fixtureType`: `GONDOLA`, `END_CAP`, `REFRIGERATED`, `FREEZER`, `PEGBOARD`, `PALLET_DISPLAY`, `PROMOTIONAL`, `DUMP_BIN`, `WALL_BAY`, `CHECKOUT`, `CUSTOM`.

### 5. Add rows (shelves)

Each **side** needs rows. Height / span / depth in meters. Span should fit **inner width** (outer minus walls).

```http
POST /api/racks/add-row-by-side
```

```json
{
  "rackSideId": "<sideId from create>",
  "height": 0.49,
  "span": 2.58,
  "width": 2.58,
  "depth": 0.98,
  "sided": "one",
  "yStart": 0,
  "yEnd": 0.49
}
```

Backend: `POST /api/v1/layout/rack-rows`

Repeat for each shelf, stacking `yStart` / `yEnd`. On a double-sided rack, add the same row to **each** `sideId`.

Update / delete row:

| App | Backend |
| --- | --- |
| `PUT /api/rack-rows/{rowId}` | `PUT /api/v1/layout/rack-rows/{rowId}` |
| `DELETE /api/rack-rows/{rowId}` | `DELETE /api/v1/layout/rack-rows/{rowId}` |

### 6. Add bins (SKU slots)

A row can have one or more bins. **Do not send `products: []`** — omit `products` and attach SKUs next.

```http
POST /api/bins/add-by-row
```

```json
{
  "rackRowId": "<rowId>",
  "binName": "Almarai Fresh Milk Low Fat 2L",
  "width": 1.84,
  "height": 0.27,
  "depth": 0.08,
  "slotIndex": 0,
  "slotCount": 1,
  "xStart": 0.739,
  "xEnd": 2.579
}
```

Width / height / depth must be **> 0**. `xStart`/`xEnd` are along the shelf (meters).

Backend: `POST /api/v1/layout/bins`

List bins on a row: `GET /api/bins/by-row/{rackRowId}` → `GET /api/v1/layout/bins/by-row/{rackRowId}`

Resize / delete:

| App | Backend |
| --- | --- |
| `PUT /api/bins/{binId}` | `PUT /api/v1/layout/bins/{binId}` |
| `DELETE /api/bins/{binId}` | `DELETE /api/v1/layout/bins/{binId}` |

### 7. Attach product to bin

One SKU per bin. `binId` and `skuId` must be server UUIDs. `quantity` is total units (front × depth × stack).

```http
POST /api/bins/attach-product
```

```json
{
  "binId": "<uuid>",
  "skuId": "<uuid>",
  "quantity": 23
}
```

Backend: `POST /api/v1/layout/bin-inventory/attach`

Inventory / detach:

| App | Backend |
| --- | --- |
| `GET /api/bin-inventory/by-bin/{binId}` | `GET /api/v1/layout/bin-inventory/by-bin/{binId}` |
| `POST /api/bin-inventory/detach` `{ "binId" }` | `POST /api/v1/layout/bin-inventory/detach` |
| `GET /api/rack-rows/{rowId}/inventory` | `GET /api/v1/layout/rack-rows/{rowId}/inventory` |

### 8. Assign POSM to the rack

Create the POSM item first (step 3), then patch the rack.

```http
PUT /api/racks/{rackId}/posm-items
```

```json
{
  "headerPosmItemId": "<posm uuid or null>",
  "footerPosmItemId": null,
  "leftWallPosmItemId": null,
  "rightWallPosmItemId": null,
  "rowPosmItems": [
    { "rowId": "<row uuid>", "dividerPosmItemId": "<posm uuid or null>" }
  ],
  "binPosmItems": [
    { "binId": "<bin uuid>", "itemTagPosmItemId": "<posm uuid or null>" }
  ]
}
```

- Header / footer / walls → shell  
- `rowPosmItems` → shelf talker on the row’s front lip  
- `binPosmItems` → item tag on a slot (backend may only accept row POSM)

Backend: `PUT /api/v1/layout/racks/{rackId}/posm-items`

### 9. Reload / save whole tree

After incremental creates, refresh:

```http
GET /api/racks/{rackId}/structure
GET /api/racks/by-store/{storeId}?page=1&pageSize=200
```

Backend:

- `GET /api/v1/layout/racks/{rackId}/structure`
- `GET /api/v1/layout/racks/by-store/{storeId}`

**Save layout** (rows, bins, SKUs, placement, shell) in one shot:

```http
PUT /api/racks/{rackId}
```

Body is the nested tree (`outer`, `inner`, `placement`, `shell`, `sides[].rows[].bins[].products`). Omit nested `id`s to **create** new rows/bins; send UUIDs to **update**. Empty rows (`bins: []`) are often rejected (422).

Backend: `PUT /api/v1/layout/racks/{rackId}`

Delete rack: `DELETE /api/racks/{rackId}` → `DELETE /api/v1/layout/racks/{rackId}`

---

## Alternate path: import PLM / PSA

`Import planogram` parses `.plm` / `.psa`, then for **each** rack:

1. `POST /api/racks/add-by-location` (new `rackId`)
2. `PUT /api/racks/{rackId}` (imported rows / bins / products, new nested ids)
3. `GET /api/racks/by-store/{storeId}` to refresh the scene

A store must be selected first.

---

## Portal “shelf” (planogram catalog)

A **shelf** is the published face of a rack side, not a 3D row.

| App | Backend | Use |
| --- | --- | --- |
| `GET /api/layout/shelves?storeId=` | `GET /api/v1/layout/shelves` | List planograms |
| `GET /api/layout/shelves/{shelfId}` | `GET /api/v1/layout/shelves/{shelfId}` | Detail |
| `PUT /api/layout/shelves/{shelfId}` | `PUT /api/v1/layout/shelves/{shelfId}` | Rename / metadata |
| `GET /api/layout/shelves/{shelfId}/blueprint` | `GET /api/v1/layout/shelves/{shelfId}/blueprint` | Blueprint |
| `GET /api/locations/branches/{branchId}/shelves` | `GET /api/v1/locations/branches/{branchId}/shelves` | Shelves on a store |

Creating shelves is a **side effect of creating rack sides**, not a separate “add shelf” in the 3D editor.

---

## Files (images & GLB)

| App | Backend | Use |
| --- | --- | --- |
| `POST /api/files/presigned-upload` | `POST /api/v1/files/presigned-upload` | Get upload URL + `objectKey` |
| `POST /api/files/complete` | `POST /api/v1/files/complete` | Mark upload done |
| `POST /api/files/presigned-download` | `POST /api/v1/files/presigned-download` `{ "objectKey" }` | Fresh download URL |
| `GET /api/files/image?key=` | presign + proxy | SKU / POSM images |
| `GET /api/files/model?key=` | presign + proxy | GLB models |

---

## API cheat sheet

### Layout — create / mutate

| Step | Method | App proxy | Backend |
| --- | --- | --- | --- |
| Create rack | POST | `/api/racks/add-by-location` | `/api/v1/layout/racks` |
| Add row | POST | `/api/racks/add-row-by-side` | `/api/v1/layout/rack-rows` |
| Add bin | POST | `/api/bins/add-by-row` | `/api/v1/layout/bins` |
| Attach SKU | POST | `/api/bins/attach-product` | `/api/v1/layout/bin-inventory/attach` |
| Detach SKU | POST | `/api/bin-inventory/detach` | `/api/v1/layout/bin-inventory/detach` |
| Assign POSM | PUT | `/api/racks/{rackId}/posm-items` | `/api/v1/layout/racks/{rackId}/posm-items` |
| Save full rack | PUT | `/api/racks/{rackId}` | `/api/v1/layout/racks/{rackId}` |
| Update row | PUT | `/api/rack-rows/{rowId}` | `/api/v1/layout/rack-rows/{rowId}` |
| Update bin | PUT | `/api/bins/{binId}` | `/api/v1/layout/bins/{binId}` |
| Delete row | DELETE | `/api/rack-rows/{rowId}` | `/api/v1/layout/rack-rows/{rowId}` |
| Delete bin | DELETE | `/api/bins/{binId}` | `/api/v1/layout/bins/{binId}` |
| Delete rack | DELETE | `/api/racks/{rackId}` | `/api/v1/layout/racks/{rackId}` |

### Layout — read

| Method | App proxy | Backend |
| --- | --- | --- |
| GET | `/api/racks/by-store/{storeId}` | `/api/v1/layout/racks/by-store/{storeId}` |
| GET | `/api/racks/{rackId}` | `/api/v1/layout/racks/{rackId}` |
| GET | `/api/racks/{rackId}/structure` | `/api/v1/layout/racks/{rackId}/structure` |
| GET | `/api/racks/{rackId}/blueprint` | `/api/v1/layout/racks/{rackId}/blueprint` |
| GET | `/api/bins/by-row/{rackRowId}` | `/api/v1/layout/bins/by-row/{rackRowId}` |
| GET | `/api/bin-inventory/by-bin/{binId}` | `/api/v1/layout/bin-inventory/by-bin/{binId}` |
| GET | `/api/planogram/rows/{sideId}` | `/api/v1/layout/rack-rows/by-side/{sideId}` |

### Catalog / POSM / files

| Method | App proxy | Backend |
| --- | --- | --- |
| GET | `/api/locations/list` | `/api/v1/locations/branches` |
| POST | `/api/products/create` | `/api/v1/catalog/skus` |
| GET | `/api/products/list` | `/api/v1/catalog/skus` |
| POST | `/api/company-assets/posm` | `/api/v1/company-assets/posm` |
| GET | `/api/company-assets/posm/list` | `/api/v1/company-assets/posm` |
| POST | `/api/files/presigned-upload` | `/api/v1/files/presigned-upload` |
| POST | `/api/files/complete` | `/api/v1/files/complete` |
| POST | `/api/files/presigned-download` | `/api/v1/files/presigned-download` |

### Publish / copy (after the rack exists)

| Method | App proxy | Backend |
| --- | --- | --- |
| POST | `/api/racks/{rackId}/publish/preview` | `/api/v1/layout/racks/{rackId}/publish/preview` |
| POST | `/api/racks/{rackId}/publish` | `/api/v1/layout/racks/{rackId}/publish` |
| POST | `/api/racks/{rackId}/reflow` | `/api/v1/layout/racks/{rackId}/reflow` |
| POST | `/api/racks/{rackId}/reflow-to-racks` | `/api/v1/layout/racks/{rackId}/reflow-to-racks` |

---

## Rules that often fail creates

1. **`storeId` required** before creating a rack.  
2. **UUIDs only** for attach / detach / POSM row-bin ids (not local `abc12xy` ids).  
3. Bin **width, height, depth > 0**.  
4. Do **not** POST a bin with `products: []`.  
5. Row **span** must fit inner width.  
6. **One SKU per bin**.  
7. Full-tree PUT rejects **empty rows** (a row with no bins).  
8. SKU **image/model** should be storage **keys**, loaded later via `/api/files/image?key=` and `/api/files/model?key=`.
