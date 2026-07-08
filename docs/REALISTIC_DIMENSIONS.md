# Realistic Dimensions Reference

Starting sizes for warehouse / planogram / 3D inventory scenes. All values are **meters** in the app.

## Warehouse


| Type     | Typical size       |
| -------- | ------------------ |
| Small    | 500–2,000 m²       |
| Medium   | 2,000–10,000 m²    |
| Large DC | 10,000–100,000+ m² |


Ceiling heights: small 5–8 m · medium 8–12 m · large 12–18 m.

**App default floor / shell:** **30 × 20 × 8 m**

## Racks

### Standard pallet bay


| Dimension    | Typical   | App default |
| ------------ | --------- | ----------- |
| Height       | 2–12 m    | 6 m         |
| Width (bay)  | 2.4–3.6 m | **2.7 m**   |
| Depth        | 0.9–1.2 m | **1.1 m**   |
| Shelf levels | 3–7       | 5           |


### Retail grocery shelf


| Type          | Width     | Depth     | Height    |
| ------------- | --------- | --------- | --------- |
| Grocery shelf | 0.9–1.2 m | 0.4–0.6 m | 1.8–2.2 m |
| End cap       | 0.6–1.2 m | 0.4–0.6 m | 1.5–2.0 m |


Shelf spacing: **0.30–0.50 m**

## Aisles


| Type          | Width     |
| ------------- | --------- |
| Walking       | 1.0–1.5 m |
| Shopping cart | 2.0–2.5 m |
| Forklift      | 3.0–4.5 m |


## Products (presets in Create SKU)


| Product            | W × D × H            |
| ------------------ | -------------------- |
| Milk 1 L           | 0.08 × 0.08 × 0.27   |
| Milk 2 L           | 0.11 × 0.11 × 0.31   |
| Water 500 mL       | 0.065 × 0.065 × 0.22 |
| Water 1.5 L        | 0.09 × 0.09 × 0.33   |
| Can 330 mL         | 0.066 × 0.066 × 0.12 |
| Soft drink 1.5 L   | 0.095 × 0.095 × 0.33 |
| Cereal box         | 0.20 × 0.065 × 0.30  |
| Chips packet       | 0.18 × 0.06 × 0.30   |
| Bread loaf         | 0.24 × 0.12 × 0.12   |
| Eggs 12-pack       | 0.31 × 0.11 × 0.07   |
| Cooking oil 1 L    | 0.09 × 0.09 × 0.27   |
| Carton 12×1 L milk | 0.40 × 0.30 × 0.28   |


**Fallback SKU / product dims** (when catalog is empty): **Milk 1 L**.

## Euro pallet

- 1.20 × 0.80 × 0.144 m  
- Loaded height typically 1.20–1.80 m

## Source constants

- `src/constants/dimensions.ts` — floor, rack, bin, product defaults + presets  
- `src/constants/warehouse.ts` — scene scale / building shell tied to the 30 × 20 × 8 start

