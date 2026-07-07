# Rack Blueprint Contract (Backend Ready)

## Purpose
Provide a complete rack blueprint payload for persistence and round-trip rendering in 3D/Traditional views.

This spec covers:
- outer rack dimensions
- inner cavity dimensions
- all wall sections (outer + inner-facing structure)
- header/footer
- row, bin, and product/widget placement

All dimensions are in **meters**.

---

## 1) Top-Level Blueprint Object

```json
{
  "schemaVersion": "1.0",
  "storeId": "uuid",
  "blueprintId": "uuid",
  "name": "Back-Wall Cooler Bay A",
  "rack": {}
}
```

---

## 2) Rack Object (Complete)

```json
{
  "rackId": "uuid",
  "rackCode": "CUSTOM-01",
  "fixtureType": "CUSTOM",
  "placement": {
    "position": { "x": 12.2, "y": 0, "z": -6.4 },
    "rotation": { "x": 0, "y": 1.5708, "z": 0 },
    "snapMode": "wall",
    "quadrant": "NE"
  },
  "outer": {
    "width": 1.8,
    "depth": 0.72,
    "height": 6.4
  },
  "shell": {
    "wallThickness": 0.08,
    "walls": {
      "back": true,
      "left": true,
      "right": true,
      "frontGlass": false
    },
    "header": {
      "enabled": true,
      "width": 1.84,
      "depth": 0.29,
      "height": 0.35,
      "protrusion": 0.04,
      "color": "#2C5282",
      "emissive": "#1A365D"
    },
    "footer": {
      "enabled": true,
      "width": 1.8,
      "depth": 0.74,
      "height": 0.18,
      "protrusion": 0.02,
      "color": "#2C5282",
      "emissive": "#1A365D"
    },
    "frame": {
      "cornerPosts": 4,
      "topRail": true,
      "innerFloor": true
    },
    "materials": {
      "accentColor": "#2C5282",
      "wallColor": "#e8eaed",
      "postColor": "#1a1a1a"
    }
  },
  "inner": {
    "width": 1.64,
    "depth": 0.56,
    "height": 5.87
  },
  "layout": {
    "sides": [
      {
        "sideId": "uuid",
        "sideCode": "CUSTOM-01-S1",
        "rows": []
      }
    ]
  }
}
```

---

## 3) Inner vs Outer Wall Meaning

- **Outer**: physical envelope of rack (`outer.width/depth/height`).
- **Inner**: usable cavity for rows/bins (`inner.width/depth/height`), derived from outer minus wall thickness and header/footer.
- **Walls flags**:
  - `back`: rear panel enabled
  - `left`: left side panel enabled
  - `right`: right side panel enabled
  - `frontGlass`: optional front closure panel

Backend should store all shell flags so UI can reproduce exact structure.

---

## 4) Row Contract (Per-Row Width + Height)

```json
{
  "rowId": "uuid",
  "rowNumber": 1,
  "width": 1.5,
  "height": 0.4,
  "sided": "one",
  "bins": []
}
```

Rules:
- `row.width <= inner.width`
- `row.height > 0`
- rows are stacked bottom-to-top in array order unless explicit anchor is added.

---

## 5) Bin Contract

```json
{
  "binId": "uuid",
  "binName": "Center Bin",
  "width": 0.5,
  "depth": 0.5,
  "height": 0.35,
  "slotIndex": 0,
  "slotCount": 3,
  "products": []
}
```

Optional future placement fields:
- `anchor`: `LEFT | CENTER_LEFT | CENTER | CENTER_RIGHT | RIGHT | CUSTOM`
- `slotPosition`: `0..1`

---

## 6) Product/Widget Contract

```json
{
  "id": "sku-uuid",
  "name": "Product A",
  "width": 0.12,
  "depth": 0.08,
  "height": 0.2,
  "quantity": 4,
  "imageUrl": "https://..."
}
```

`quantity` = facings count.

---

## 7) Validation Rules (Backend)

1. Outer dimensions
- `outer.width > 0`
- `outer.depth > 0`
- `outer.height > 0`

2. Shell
- `wallThickness > 0`
- `inner.width = outer.width - 2 * wallThickness` (minimum clamp allowed)
- `inner.depth = outer.depth - 2 * wallThickness` (minimum clamp allowed)
- `inner.height = outer.height - header.height(enabled) - footer.height(enabled) - wallThickness`

3. Rows
- every `row.width <= inner.width`
- total stacked row heights <= `inner.height` (or allow overflow with warning)

4. Bins
- sum of bin widths per row <= row.width (or normalize by slot strategy)
- bin height <= row.height
- bin depth <= inner.depth

5. Products/widgets
- product dims > 0
- total product facing width <= bin.width (soft/hard rule configurable)

---

## 8) Minimal Create Rack Payload (API)

```json
{
  "storeId": "uuid",
  "rackCode": "CUSTOM-01",
  "fixtureType": "CUSTOM",
  "placement": {
    "x": 12.2,
    "y": 0,
    "z": -6.4,
    "rotationY": 1.5708
  },
  "outer": { "width": 1.8, "depth": 0.72, "height": 6.4 },
  "shell": {
    "wallThickness": 0.08,
    "walls": { "back": true, "left": true, "right": true, "frontGlass": false },
    "header": { "enabled": true, "width": 1.84, "depth": 0.29, "height": 0.35, "protrusion": 0.04 },
    "footer": { "enabled": true, "width": 1.8, "depth": 0.74, "height": 0.18, "protrusion": 0.02 }
  }
}
```

---

## 9) Full Blueprint Example (With Rows/Bins/Products)

```json
{
  "schemaVersion": "1.0",
  "storeId": "store-1",
  "blueprintId": "bp-123",
  "name": "Wall Bay Blueprint",
  "rack": {
    "rackId": "rack-1",
    "rackCode": "CUSTOM-01",
    "fixtureType": "CUSTOM",
    "placement": {
      "position": { "x": 12.2, "y": 0, "z": -6.4 },
      "rotation": { "x": 0, "y": 1.5708, "z": 0 },
      "snapMode": "wall",
      "quadrant": "NE"
    },
    "outer": { "width": 1.8, "depth": 0.72, "height": 6.4 },
    "shell": {
      "wallThickness": 0.08,
      "walls": { "back": true, "left": true, "right": true, "frontGlass": false },
      "header": { "enabled": true, "width": 1.84, "depth": 0.29, "height": 0.35, "protrusion": 0.04, "color": "#2C5282" },
      "footer": { "enabled": true, "width": 1.8, "depth": 0.74, "height": 0.18, "protrusion": 0.02, "color": "#2C5282" },
      "frame": { "cornerPosts": 4, "topRail": true, "innerFloor": true },
      "materials": { "accentColor": "#2C5282" }
    },
    "inner": { "width": 1.64, "depth": 0.56, "height": 5.87 },
    "layout": {
      "sides": [
        {
          "sideId": "side-1",
          "sideCode": "CUSTOM-01-S1",
          "dimensions": {
            "usableWidth": 1.64,
            "usableDepth": 0.56,
            "usableHeight": 5.87
          },
          "rows": [
            {
              "rowId": "row-1",
              "rowNumber": 1,
              "width": 1.5,
              "depth": 0.53,
              "height": 0.4,
              "yStart": 0.0,
              "yEnd": 0.4,
              "sided": "one",
              "bins": [
                {
                  "binId": "bin-1",
                  "binName": "Left Bin",
                  "width": 0.5,
                  "depth": 0.5,
                  "height": 0.35,
                  "xStart": 0.0,
                  "xEnd": 0.5,
                  "slotIndex": 0,
                  "slotCount": 3,
                  "products": [
                    {
                      "id": "sku-1",
                      "name": "Widget A",
                      "width": 0.12,
                      "depth": 0.08,
                      "height": 0.2,
                      "weightKg": 0.45,
                      "quantity": 3
                    },
                    {
                      "id": "sku-2",
                      "name": "Widget B",
                      "width": 0.1,
                      "depth": 0.07,
                      "height": 0.18,
                      "weightKg": 0.35,
                      "quantity": 2
                    }
                  ]
                },
                {
                  "binId": "bin-2",
                  "binName": "Center Bin",
                  "width": 0.5,
                  "depth": 0.5,
                  "height": 0.35,
                  "xStart": 0.5,
                  "xEnd": 1.0,
                  "slotIndex": 1,
                  "slotCount": 3,
                  "products": [
                    {
                      "id": "sku-3",
                      "name": "Widget C",
                      "width": 0.11,
                      "depth": 0.09,
                      "height": 0.22,
                      "weightKg": 0.52,
                      "quantity": 4
                    }
                  ]
                },
                {
                  "binId": "bin-3",
                  "binName": "Right Bin",
                  "width": 0.5,
                  "depth": 0.5,
                  "height": 0.35,
                  "xStart": 1.0,
                  "xEnd": 1.5,
                  "slotIndex": 2,
                  "slotCount": 3,
                  "products": [
                    {
                      "id": "sku-4",
                      "name": "Widget D",
                      "width": 0.13,
                      "depth": 0.08,
                      "height": 0.19,
                      "weightKg": 0.4,
                      "quantity": 2
                    }
                  ]
                }
              ]
            },
            {
              "rowId": "row-2",
              "rowNumber": 2,
              "width": 1.6,
              "depth": 0.53,
              "height": 0.45,
              "yStart": 0.4,
              "yEnd": 0.85,
              "sided": "one",
              "bins": [
                {
                  "binId": "bin-4",
                  "binName": "Full Width Upper",
                  "width": 1.6,
                  "depth": 0.5,
                  "height": 0.4,
                  "xStart": 0.0,
                  "xEnd": 1.6,
                  "slotIndex": 0,
                  "slotCount": 1,
                  "products": [
                    {
                      "id": "sku-5",
                      "name": "Widget E",
                      "width": 0.16,
                      "depth": 0.09,
                      "height": 0.24,
                      "weightKg": 0.62,
                      "quantity": 5
                    }
                  ]
                }
              ]
            }
          ]
        },
        {
          "sideId": "side-2",
          "sideCode": "CUSTOM-01-S2",
          "dimensions": {
            "usableWidth": 1.64,
            "usableDepth": 0.56,
            "usableHeight": 5.87
          },
          "rows": [
            {
              "rowId": "row-3",
              "rowNumber": 1,
              "width": 1.2,
              "depth": 0.53,
              "height": 0.35,
              "yStart": 0.0,
              "yEnd": 0.35,
              "sided": "one",
              "bins": [
                {
                  "binId": "bin-5",
                  "binName": "Back Side Bin",
                  "width": 1.2,
                  "depth": 0.5,
                  "height": 0.3,
                  "xStart": 0.0,
                  "xEnd": 1.2,
                  "slotIndex": 0,
                  "slotCount": 1,
                  "products": [
                    {
                      "id": "sku-6",
                      "name": "Widget F",
                      "width": 0.14,
                      "depth": 0.1,
                      "height": 0.2,
                      "weightKg": 0.5,
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
  }
}
```

---

## 9.1) Dimension Fields by Level (Required)

### Rack-level dimensions
- `outer.width`, `outer.depth`, `outer.height`
- `shell.wallThickness`
- `inner.width`, `inner.depth`, `inner.height`

### Side-level dimensions
- `dimensions.usableWidth`
- `dimensions.usableDepth`
- `dimensions.usableHeight`

### Row-level dimensions
- `width`
- `depth`
- `height`
- `yStart`, `yEnd` (stacked vertical range inside side cavity)

### Bin-level dimensions
- `width`
- `depth`
- `height`
- `xStart`, `xEnd` (horizontal occupancy in row-local coordinates)

### Product/widget dimensions
- `width`
- `depth`
- `height`
- `weightKg` (optional but recommended for capacity/physics rules)
- `quantity` (facing count)

---

## 10) Notes for Backend Team

- Keep unknown fields forward-compatible.
- Persist both **input shell config** and **computed inner dimensions**.
- Return canonical IDs for rack/side/row/bin so frontend can map local temp IDs.
- Include row `width` in row endpoints (`GET/PUT`) for custom rack support.

