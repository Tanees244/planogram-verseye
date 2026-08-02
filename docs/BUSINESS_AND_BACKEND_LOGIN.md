# Planogram — Business Overview, Backend Login & APIs

This document covers **what the product does**, **how login works**, and **how the Store-Layout backend APIs work** — including the data we send and receive. Units are **meters** unless noted.

---

## 1. Business overview

### What Planogram is

Planogram is a **retail store layout and planogram editor**. Teams use it to:

- Select a **store branch**
- Place and arrange **fixtures (racks)** on a 3D floor
- Build the **shelf tree** (sides → rows → bins)
- Attach **SKUs** with facing quantities
- Assign **POSM** (signage) on rack surfaces, shelf lips, and bins
- Save placement and structure to the backend
- Save a shelf face as a named **planogram** (ideal image)
- **Reflow** layout/facings when geometry changes
- **Publish** a rack into other stores

### Domain hierarchy

```
Store (branch / location)
  └── Area (floor width × depth)
        └── Rack (fixture)
              └── Side (S1 / S2 — can link to a portal “Shelf”)
                    └── Row (shelf band)
                          └── Bin (slot)
                                └── Product / SKU (facings = quantity)
```

**Shelf ⟷ Side:** a shelf is the planogram face for one side of a rack (name + ideal image).

### Core business objects

| Concept | Meaning |
|--------|---------|
| **Store / location** | Physical retail branch. Layout is loaded and saved per store. |
| **Area / floor** | Floor rectangle where racks are placed. |
| **Rack** | Fixture on the floor (gondola, freezer, custom, etc.). |
| **Placement** | Floor pose: `position {x,y,z}`, `rotation`, `snapMode`, `quadrant` (`NW` / `NE` / `SW` / `SE`). |
| **Side** | One face of a rack (single- or double-sided). |
| **Row** | Horizontal shelf band with height/span and bins. |
| **Bin** | Slot on a row that holds SKU facings. |
| **SKU / product** | Catalog item with dimensions, image, optional 3D model, quantity. |
| **POSM** | Marketing assets on header/footer/walls, row dividers, or bin tags. |
| **Planogram** | Named shelf face + ideal image. |
| **Fixture type** | e.g. `GONDOLA`, `WALL_BAY`, `END_CAP`, `FREEZER`, `CUSTOM`, … |
| **Soft face-fill** | Underfill OK; overfill clamped (~1 cm) before save. |

### Main user journeys

1. **Sign in** with email/password.
2. **Pick a store** → load racks (`by-store` + per-rack `structure`).
3. **Edit floor** → place, move, rotate racks (saved with PUT).
4. **Edit shelves** → rows/bins, attach SKUs, assign POSM.
5. **Save layout** → push structure/placement.
6. **Save as planogram** → name shelf + ideal image.
7. **Reflow** → reshape this rack, or map onto other racks.
8. **Publish** → clone the rack into other store IDs.

---

## 2. How the backend works

The Store-Layout backend owns:

| Area | Responsibility |
|------|----------------|
| **Auth** | Validate email/password; issue JWT. |
| **Locations** | Branch/store list for the org. |
| **Layout** | Racks, sides, rows, bins, placement, reflow, publish. |
| **Catalog** | SKUs (products) and related media keys. |
| **Company assets** | POSM catalog and assignment. |
| **Files** | Presigned upload/download URLs for object storage. |

### Typical editor session against the backend

```
Login
  → GET locations/branches          (pick store)
  → GET layout/racks/by-store/{id}  (floor poses + list)
  → GET layout/racks/{id}/structure (full shelf tree per rack)
  → PUT layout/racks/{id}           (move / save structure)
  → POST bin-inventory/attach       (put SKU on bin)
  → PUT …/posm-items                (assign POSM)
  → POST files/presigned-download   (load images / GLBs)
```

### Auth on every protected call

After login, clients send:

```http
Authorization: Bearer <jwt>
```

Common response envelope:

```json
{
  "success": true,
  "data": { },
  "message": "...",
  "errors": []
}
```

Some responses use `isRequestSuccess` instead of (or as well as) `success`.

### Load rule (important)

| Source | What we trust |
|--------|----------------|
| **by-store** | Floor placement (`x`, `z`, rotation, quadrant) |
| **structure** | Shelf tree (sides / rows / bins / products / POSM) |

Negative coordinates are valid and must round-trip unchanged.

---

## 3. Backend login

### Flow

```
1. User submits email + password
2. POST /api/v1/auth/login  { email, password }
3. Backend returns JWT (+ optional user / roles)
4. Client stores the token and sends it as Bearer on later calls
5. On 401, session is treated as expired → user must log in again
```

In this app the token is also kept in an httpOnly cookie named `planogram_token` (7 days) so page routes can gate access. Logout clears that cookie.

### Login API

**`POST /api/v1/auth/login`**

**Request**

```json
{
  "email": "admin@example.com",
  "password": "••••••••"
}
```

**Response (fields the app reads)**

```json
{
  "message": "Login successful",
  "data": {
    "user": {
      "id": "…",
      "email": "admin@example.com",
      "full_name": "…"
    },
    "token": "<jwt>",
    "refreshToken": "<optional>",
    "roleAndActions": [
      {
        "actions": [
          { "actionName": "layout:view" },
          { "actionName": "layout:manage" }
        ]
      }
    ]
  }
}
```

Token may also appear as `accessToken`, `jwt`, `authToken`, `idToken`, or `bearerToken` at the root, under `data`, or under `data.session` / `result` / `payload` / `auth`.

`roleAndActions[].actions[].actionName` values are stored as `userActions` for UI capability hints. Fine-grained permission enforcement remains on the backend.

---

## 4. APIs — what we call, what we pass, what we get

All layout dimensions and positions are in **meters**. Angles in `rotation.y` / `rotationY` are **radians**.

---

### 4.1 Locations (stores)

**`GET /api/v1/locations/branches`**

**Query**

| Param | Example | Notes |
|-------|---------|--------|
| `page` | `1` | |
| `pageSize` | `50` | |
| `search` | optional | |
| `regionId` | optional | |

**Response (app maps branches → locations)**

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "store-uuid",
        "branchId": "store-uuid",
        "name": "Lulu Hypermarket Atyaf Mall",
        "code": "LULU-ATYAF"
      }
    ]
  }
}
```

App normalizes each branch to a location with at least:

```json
{
  "id": "<id | branchId | storeId>",
  "locationCode": "<name | branchName | code | locationCode | storeName>"
}
```

---

### 4.2 List racks for a store (floor poses)

**`GET /api/v1/layout/racks/by-store/{storeId}`**

**Query:** `page=1`, `pageSize=200` (typical).

**Response (abbreviated)**

```json
{
  "success": true,
  "data": {
    "racks": [
      {
        "rackId": "uuid",
        "rackName": "other brands 8",
        "rackCode": "OTHER-BRANDS-8",
        "fixtureType": "CUSTOM",
        "width": 6,
        "depth": 1.21,
        "height": 2.0,
        "isDoubleSided": false,
        "placement": {
          "position": { "x": 11.75, "y": 0, "z": -13.275 },
          "rotation": { "x": 0, "y": 3.141592653589793, "z": 0 },
          "snapMode": "wall",
          "quadrant": "SE"
        },
        "outer": { "width": 6, "depth": 1.21, "height": 2.0 },
        "lastUpdated": "…"
      }
    ]
  }
}
```

Placement may also arrive as flat fields:

```json
{
  "positionX": 11.75,
  "positionY": 0,
  "positionZ": -13.275,
  "rotationY": 3.141592653589793,
  "quadrant": "SE"
}
```

**This list is the source of truth for where racks sit on the floor.**

---

### 4.3 Rack structure (shelf tree)

**`GET /api/v1/layout/racks/{rackId}/structure`**

Returns the same rack identity/placement fields plus the full tree:

```json
{
  "success": true,
  "data": {
    "rackId": "uuid",
    "rackName": "…",
    "fixtureType": "CUSTOM",
    "outer": { "width": 6, "depth": 1.21, "height": 2.0 },
    "inner": { "width": 5.84, "depth": 1.05, "height": 2.0 },
    "shell": {
      "wallThickness": 0.08,
      "headerPosmItemId": "posm-uuid",
      "footerPosmItemId": null,
      "leftWallPosmItemId": null,
      "rightWallPosmItemId": null
    },
    "placement": {
      "position": { "x": 11.75, "y": 0, "z": -13.275 },
      "rotation": { "x": 0, "y": 3.14159, "z": 0 },
      "snapMode": "wall",
      "quadrant": "SE"
    },
    "sides": [
      {
        "sideId": "side-uuid",
        "depth": 1.05,
        "rows": [
          {
            "rowId": "row-uuid",
            "rowNumber": 1,
            "height": 0.4,
            "span": 5.84,
            "width": 5.84,
            "depth": 1.05,
            "yStart": 0,
            "yEnd": 0.4,
            "dividerPosmItemId": null,
            "bins": [
              {
                "binId": "bin-uuid",
                "width": 0.5,
                "depth": 0.5,
                "height": 0.35,
                "itemTagPosmItemId": null,
                "products": [
                  {
                    "skuId": "sku-uuid",
                    "name": "Almarai Milk",
                    "width": 0.12,
                    "height": 0.2,
                    "depth": 0.08,
                    "quantity": 3,
                    "imageStorageKey": "skus/…png",
                    "modelStorageKey": "skus/models/….glb"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

---

### 4.4 Create rack

**`POST /api/v1/layout/racks`**

**Request (typical)**

```json
{
  "storeId": "store-uuid",
  "rackName": "New Gondola",
  "rackCode": "GONDOLA-01",
  "blueprintName": "GONDOLA",
  "fixtureType": "GONDOLA",
  "isDoubleSided": false,
  "width": 1.2,
  "depth": 0.5,
  "height": 1.8,
  "outer": { "width": 1.2, "depth": 0.5, "height": 1.8 },
  "placement": {
    "position": { "x": 0, "y": 0, "z": 0 },
    "rotation": { "x": 0, "y": 0, "z": 0 },
    "snapMode": "wall",
    "quadrant": "NW"
  },
  "positionX": 0,
  "positionY": 0,
  "positionZ": 0,
  "rotationY": 0
}
```

For **CUSTOM** fixtures, also send `shell` (walls, header, footer, materials) and usually `inner`.

**Response (expected):** created `rackId` (and often `sideIds`).

---

### 4.5 Update rack / save placement

**`PUT /api/v1/layout/racks/{rackId}`**

Used for moves, rotates, and full structure saves. Nested `placement` and flat pose fields are both sent.

**Request (full tree)**

```json
{
  "rackId": "uuid",
  "rackName": "other brands 8",
  "fixtureType": "CUSTOM",
  "isDoubleSided": false,
  "outer": { "width": 6, "depth": 1.21, "height": 2.0 },
  "inner": { "width": 5.84, "depth": 1.05, "height": 2.0 },
  "placement": {
    "position": { "x": 11.75, "y": 0, "z": -13.275 },
    "rotation": { "x": 0, "y": 3.141592653589793, "z": 0 },
    "snapMode": "wall",
    "quadrant": "SE"
  },
  "positionX": 11.75,
  "positionY": 0,
  "positionZ": -13.275,
  "rotationY": 3.141592653589793,
  "width": 6,
  "depth": 1.21,
  "height": 2.0,
  "shell": { },
  "sides": [
    {
      "id": "side-uuid",
      "depth": 1.05,
      "rows": [
        {
          "id": "row-uuid",
          "rowNumber": 1,
          "width": 5.84,
          "span": 5.84,
          "height": 0.4,
          "depth": 1.05,
          "sided": "one",
          "dividerThickness": 0.025,
          "yStart": 0,
          "yEnd": 0.4,
          "bins": [
            {
              "id": "bin-uuid",
              "width": 0.5,
              "depth": 0.5,
              "height": 0.35,
              "slotIndex": 0,
              "products": [
                {
                  "id": "sku-uuid",
                  "name": "…",
                  "width": 0.12,
                  "depth": 0.08,
                  "height": 0.2,
                  "quantity": 3,
                  "position": { "x": 0, "y": 0 }
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

**Optional:** `"reflowSkus": true` to ask the backend to redistribute SKUs after a geometry change.

**Notes**

- Omitting rows can soft-delete them on the backend.
- Rows with **no bins** may be rejected (`422`). For placement-only moves, the app may send:
  - **rows without bins** (keep row ids), or
  - **sides only** (no rows), so the move still saves.
- Backend must persist negative `positionX` / `positionZ` exactly.

**Success response (typical)**

```json
{
  "success": true,
  "data": null,
  "message": "Rack updated successfully",
  "errors": []
}
```

---

### 4.6 Attach / detach SKU on a bin

**Attach — `POST /api/v1/layout/bin-inventory/attach`**

```json
{
  "binId": "bin-uuid",
  "skuId": "sku-uuid",
  "quantity": 4
}
```

**Detach — `POST /api/v1/layout/bin-inventory/detach`**

```json
{
  "binId": "bin-uuid"
}
```

---

### 4.7 POSM catalog & assignment

**List — `GET /api/v1/company-assets/posm`**

**Query:** `status=Active`, `page=1`, `pageSize=50`, optional `storeId`, `posmType`.

**Item fields used by the app**

```json
{
  "id": "posm-uuid",
  "name": "Almarai Header",
  "posmType": "Standee",
  "status": "Active",
  "imageStorageKey": "posm/….png",
  "imageUrl": "https://…"
}
```

**Assign on a rack — `PUT /api/v1/layout/racks/{rackId}/posm-items`**

```json
{
  "headerPosmItemId": "posm-uuid",
  "footerPosmItemId": null,
  "leftWallPosmItemId": null,
  "rightWallPosmItemId": null,
  "rowPosmItems": [
    { "rowId": "row-uuid", "dividerPosmItemId": "posm-uuid" }
  ],
  "binPosmItems": [
    { "binId": "bin-uuid", "itemTagPosmItemId": "posm-uuid" }
  ]
}
```

Only the keys present in the request are applied.

**Create POSM — `POST /api/v1/company-assets/posm`**

```json
{
  "name": "…",
  "posmType": "ShelfTalker",
  "status": "Active",
  "storeIds": ["store-uuid"],
  "conditionStandards": "Standard",
  "imageStorageKey": "posm/….png"
}
```

---

### 4.8 Files (images & 3D models)

**Presigned download — `POST /api/v1/files/presigned-download`**

**Request**

```json
{
  "objectKey": "posm/019f7adc…-header.png"
}
```

**Response**

```json
{
  "success": true,
  "data": {
    "bucket": "aisleris-bucket",
    "objectKey": "posm/…-header.png",
    "url": "https://…/aisleris-bucket/posm/…?X-Amz-…",
    "method": "GET",
    "expiresAtUtc": "…"
  },
  "message": "Presigned download URL generated successfully"
}
```

The `url` (also accepted as `presignedUrl` / `downloadUrl` / `signedUrl`) is used to fetch the binary. Catalog products and POSM items usually carry `imageStorageKey` / `modelStorageKey` rather than long-lived public URLs.

---

### 4.9 Reflow

| Kind | Endpoint | Body (keys) |
|------|----------|-------------|
| **A — resize this rack** | `POST …/racks/{id}/reflow/preview` then `…/reflow` | `outer.{width,depth,height}`, `shell.{…}` |
| **B — silent on save** | `PUT …/racks/{id}` | same update payload + `reflowSkus: true` |
| **C — map onto other racks** | `POST …/racks/{id}/reflow-to-racks(/preview)` | `targetRackIds: ["uuid", …]` |

---

### 4.10 Publish (copy rack to other stores)

**`POST /api/v1/layout/racks/{rackId}/publish/preview`** then **`…/publish`**

```json
{
  "storeIds": ["store-uuid-1", "store-uuid-2"],
  "rackCode": "OTHER-BRANDS-8",
  "rackName": "other brands 8"
}
```

Creates rack copies in the selected stores. This is **not** the same as reflow.

---

### 4.11 Catalog SKUs

**`GET /api/v1/catalog/skus`** (paged list)

Used for the product palette. Items include identity, dimensions, and media keys (`imageStorageKey`, `modelStorageKey`, attachments). Exact list query params follow the catalog API; the editor attaches via bin-inventory (section 4.6), not by embedding full catalog rows into every rack PUT when avoidable.

---

## 5. Business / API rules that matter

1. **Placement comes from by-store after reload** — structure is for the shelf tree.
2. **Negative `x` / `z` are valid** — do not coerce them to `0`.
3. **Empty rows** can fail full-tree PUT validation — lighter placement bodies are used for moves.
4. **Publish ≠ reflow** — publish clones into stores; reflow reshapes or remaps facings.
5. **Soft face-fill** — overfilled facings are clamped before save so the backend does not reject the layout.
6. **Omit rows carefully** — missing rows on PUT can soft-delete them.

---

## 6. Related docs

| Doc | Focus |
|-----|--------|
| `docs/PLANOGRAM_EDITOR_TEAM_GUIDE.md` | Editor flows |
| `docs/PLANOGRAM_AND_REFLOW_HANDBOOK.md` | Publish vs reflow |
| `docs/STORE_LAYOUT_STRUCTURE.md` | Hierarchy / shell |
| `docs/FRONTEND_RACK_BLUEPRINT.md` | Rack payload shapes |
| `docs/CUSTOM_RACK_BLUEPRINT.md` | Custom fixture config |

---

## 7. Backend partner checklist

1. `POST /api/v1/auth/login` returns a JWT the client can extract.
2. All layout / catalog / locations / files APIs accept `Authorization: Bearer <jwt>`.
3. by-store and structure agree on placement (or by-store wins for floor pose).
4. PUT placement round-trips `positionX` / `positionZ` / nested `placement` including negatives.
5. Presigned download returns a usable HTTPS URL for object keys.
6. Attach/detach, POSM assign, reflow, and publish match the request keys above.
