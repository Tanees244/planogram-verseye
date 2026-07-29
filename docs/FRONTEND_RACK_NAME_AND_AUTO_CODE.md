# Frontend Integration Guide — Rack Name & Auto Code

**Audience:** Frontend developers wiring Fixture (rack) create, update, list, and publish/copy flows.

**Status:** Jul 2026 — backend shipped.

**Related:** [FRONTEND_PLANOGRAM_NAME_PUBLISH_FIXTURE.md](./FRONTEND_PLANOGRAM_NAME_PUBLISH_FIXTURE.md), [FRONTEND_RACK_PUBLISH_AND_REFLOW.md](./FRONTEND_RACK_PUBLISH_AND_REFLOW.md)

---

## Summary (breaking)

| Before | After |
|--------|--------|
| FE sent `rackCode` + optional `blueprintName` | FE sends **`rackName` only** |
| Reads exposed `blueprintName` | Reads expose **`rackName`** (same meaning) |
| FE invented / typed rack code | Server **auto-generates** unique `rackCode` |
| Copy/publish kept same display name | Copy name becomes **`{name} (Copy)`** (then `(Copy 2)`, …) |

**One key for the human name:** always `rackName`. Do **not** send or read `blueprintName` anymore.

---

## Domain mapping

| UI term | API field | Notes |
|---------|-----------|--------|
| **Rack name** | `rackName` | Required on create/update; unique per store |
| **Rack code** | `rackCode` | Auto on create; read-only on update; unique per store |
| **Shelf name** | `name` on shelves | Driven from `rackName` automatically |

---

## 1. Create fixture

```http
POST /api/v1/layout/racks
```

Permission: `layout:manage`

```json
{
  "storeId": "guid",
  "rackName": "Dairy Gondola A",
  "fixtureType": "Gondola",
  "height": 2.0,
  "width": 1.2,
  "depth": 0.6,
  "isDoubleSided": true
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `storeId` | yes | Target store |
| `rackName` | **yes** | 1–256 chars; **unique per store** |
| `fixtureType` | no | e.g. `Gondola`, `Pegboard`, `Freezer`, `CUSTOM` |

### Response

```ts
type CreateStoreRackResponse = {
  rackId: string;
  rackCode: string;   // auto, e.g. "DAIRY-GONDOLA-A"
  rackName: string;
  sideIds: string[];
};
```

### Code generation

- `"Dairy Gondola A"` → `"DAIRY-GONDOLA-A"`
- Collision → `"DAIRY-GONDOLA-A-2"`, `-3`, …

### Linked shelves

| Rack | Shelf `name` |
|------|----------------|
| Single-sided | exact `rackName` |
| Double-sided | `{rackName}-S1`, `{rackName}-S2` |

---

## 2. Update fixture

```http
PUT /api/v1/layout/racks/{rackId}
```

```json
{
  "rackName": "Dairy Gondola Renamed",
  "fixtureType": "Gondola",
  "isDoubleSided": true,
  "sides": [ /* … */ ]
}
```

- `rackName` required and unique (excluding this rack)
- Do **not** send `rackCode` — it stays unchanged
- Renaming syncs linked shelf names

---

## 3. Reads

| Endpoint | Name | Code |
|----------|------|------|
| `GET /layout/racks` | `rackName`, `displayName` | `rackCode` |
| Structure / by-store | `rackName` | `rackCode` |
| `GET /layout/shelves` | `rackName` | `rackCode` |

Display: `rackName ?? rackCode` (or `displayName` when present).

---

## 4. Uniqueness errors

| Situation | HTTP | Field |
|-----------|------|-------|
| Empty `rackName` | 400 | `rackName` |
| Duplicate name in store | 409 | `RackName` |

---

## 5. Publish / copy

```http
POST /api/v1/layout/racks/{rackId}/publish/preview
POST /api/v1/layout/racks/{rackId}/publish
```

```json
{
  "storeIds": ["guid"],
  "rackCode": "R-01",
  "rackName": "Optional base name"
}
```

| Field | Notes |
|-------|--------|
| `rackCode` | Still required for target uniqueness |
| `rackName` | Optional base for copy name; else source rack name |

Copy naming:

| # in store | Result |
|------------|--------|
| 1st | `{base} (Copy)` |
| 2nd | `{base} (Copy 2)` |

---

## 6. FE checklist

- [ ] Forms: required **Rack name**; no rack-code input on create/update
- [ ] Payload key: **`rackName` only** (never `blueprintName`)
- [ ] After create, show returned `rackCode` read-only
- [ ] Lists/detail: bind name from `rackName`
- [ ] Publish: expect `(Copy)` / `(Copy N)` on created names
- [ ] Handle 409 on duplicate `RackName`

---

## 7. TypeScript

```ts
type CreateRackRequest = {
  storeId: string;
  rackName: string;
  fixtureType?: string | null;
  isDoubleSided: boolean;
  // … dimensions / shell / placement
};

type CreateRackResponse = {
  rackId: string;
  rackCode: string;
  rackName: string;
  sideIds: string[];
};

type UpdateRackRequest = {
  rackName: string;
  fixtureType?: string | null;
  isDoubleSided: boolean;
  sides: unknown[];
};

type RackSummary = {
  id: string;
  rackCode: string | null;
  rackName: string | null;
  displayName: string;
};

type PublishRackRequest = {
  storeIds: string[];
  rackCode: string;
  rackName?: string | null;
};
```
