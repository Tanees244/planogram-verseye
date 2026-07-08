import { Box3, Object3D, Vector3 } from 'three'

export function isValidBox3(box: Box3): boolean {
  return (
    Number.isFinite(box.min.x) &&
    Number.isFinite(box.min.y) &&
    Number.isFinite(box.min.z) &&
    Number.isFinite(box.max.x) &&
    Number.isFinite(box.max.y) &&
    Number.isFinite(box.max.z)
  )
}

/** Returns a finite center above the object, or null if the scene graph has invalid geometry. */
export function boundsCenterAboveObject(
  object: Object3D,
  offsetY = 0.5,
): Vector3 | null {
  const box = new Box3().setFromObject(object)
  if (!isValidBox3(box)) return null
  const center = new Vector3()
  box.getCenter(center)
  center.y = box.max.y + offsetY
  return center
}
