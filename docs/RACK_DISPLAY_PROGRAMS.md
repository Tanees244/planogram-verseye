# Rack POSM placement

Frontend integration for assigning **Company Assets POSM items** to rack surfaces (replaces legacy shelf talkers and secondary display programs on layout).

## Surfaces

| Surface | Write field | Read field |
|---------|-------------|------------|
| Header fascia | `shell.headerPosmItemId` | `shell.headerPosm` |
| Footer kick plate | `shell.footerPosmItemId` | `shell.footerPosm` |
| Left shell wall | `shell.leftWallPosmItemId` | `shell.leftWallPosm` |
| Right shell wall | `shell.rightWallPosmItemId` | `shell.rightWallPosm` |
| Row divider | `dividerPosmItemId` | `dividerPosm` |

## API proxies

- `PUT /api/racks/{rackId}/posm-items` → `/api/v1/layout/racks/{rackId}/posm-items`
- `GET /api/company-assets/posm/list?storeId=` → `/api/v1/company-assets/posm`

## UI

- **Rack selected:** `RackPosmPanel` — shell POSM pickers
- **Row selected:** `RowDividerPosmPanel` — divider POSM picker
- **3D:** `RowDividerPosmMesh` — colored lip marker by `posmType`

## Full rack save

Include `shell.*PosmItemId` and `rows[].dividerPosmItemId` on `PUT /api/racks/{rackId}` or assignments may be cleared.

## Unchanged

Journey / store-visit POSM tasks still use `displayProgramIds` + `posmItemIds` — do not remove secondary display program CRUD from other modules.
