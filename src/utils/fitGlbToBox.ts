import { Box3, Object3D, Vector3 } from 'three'

/** Uniformly scale and center an object so it fits inside width × height × depth (meters). */
export function fitObjectToBox(
  root: Object3D,
  width: number,
  height: number,
  depth: number,
): void {
  const box = new Box3().setFromObject(root)
  if (box.isEmpty()) return

  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())

  root.position.sub(center)

  const sx = size.x > 0 ? width / size.x : 1
  const sy = size.y > 0 ? height / size.y : 1
  const sz = size.z > 0 ? depth / size.z : 1
  const uniform = Math.min(sx, sy, sz)

  root.scale.setScalar(uniform)
}
