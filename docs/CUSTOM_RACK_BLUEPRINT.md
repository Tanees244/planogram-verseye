# Custom Rack Blueprint

## Goal
Define a **hollow custom rack** that starts as a 3-wall bay and is populated only by user-added planogram rows and widgets/products.

---

## Default Rack Shape (Base Blueprint)

### Structural Rules
- Rack must be **hollow** (no solid internal block).
- Rack must have **3 walls by default**:
  - Back wall: enabled
  - Left wall: enabled
  - Right wall: enabled
- Front face remains **open** by default.
- Optional front glass can be enabled from builder settings.
- No procedural/internal shelves are auto-generated.

### Frame
- Four vertical corner posts.
- Base plinth (footer) optional but enabled by default.
- Header optional and **disabled by default** for blank rack template.

---

## Row Model Inside Custom Rack

### Row Creation
- Newly created custom rack starts with **0 rows**.
- User adds rows using **Add Row** action.
- Rows are placed inside inner cavity from bottom to top.

### Row Dimensions
Each row supports independent:
- `height` (m)
- `width` (m)

If row width is not set, default to rack inner width.

### Row Constraints
- Row width should not exceed rack inner width.
- Row stack should remain within available body height.
- Bin heights in row should clamp to row height minus clearance.

---

## Widgets / Product Placement

Rows serve as shelf surfaces for planogram content:
- Add bins to row.
- Attach products/widgets into bins.
- Product facings render according to bin dimensions and quantity.

---

## Rack Configuration Parameters

### Outer Shell
- `outerWidth`
- `outerDepth`
- `outerHeight`
- `wallThickness`

### Sections
- `header` (enabled, width, depth, height, color)
- `footer` (enabled, width, height, color)

### Walls
- `walls.back`
- `walls.left`
- `walls.right`
- `walls.frontGlass`

### Appearance
- `accentColor`

---

## Behavioral Blueprint

### Placement
- Rack preview appears hollow in placement mode.
- Placement snaps near walls and rotates inward when snapping.

### Rendering
- Rack shell is rendered first.
- Row slot layer is rendered only when rows exist.
- No procedural shelf meshes are rendered for custom rack.

---

## UX Expectations

1. Place blank custom rack -> see empty hollow bay.
2. Add first row -> row appears inside cavity.
3. Edit row width/height -> row mesh updates immediately.
4. Add bin/products -> content fills row without changing shell geometry.

---

## Acceptance Checklist

- [ ] Blank custom rack has back + side walls and open front.
- [ ] No default rows on new custom rack.
- [ ] Row add flow works for custom rack.
- [ ] Each row supports independent width and height edits.
- [ ] Widgets/products can be added through bins on rows.
- [ ] Builder does not expose procedural shelf count for custom rack behavior.

---

## File Reference (Current Implementation)

- `src/components/fixtures/CustomRackMesh.tsx`
- `src/components/fixtures/CustomRackSlotLayer.tsx`
- `src/components/fixtures/procedural/CustomRackFixture.tsx`
- `src/components/Row.tsx`
- `src/components/RowHeightsEditor.tsx`
- `src/components/CustomRackBuilder.tsx`
- `src/store/planogramStore.ts`

