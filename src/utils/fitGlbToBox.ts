import { Box3, Object3D, Vector3 } from 'three'

export type FitObjectMode = 'uniform' | 'stretch'

/**
 * Scale and center an object so it fits inside width × height × depth (meters).
 * - `uniform` (default): preserve aspect ratio (may letterbox inside the box)
 * - `stretch`: fill the box on every axis (needed so stacked pack slots touch visually)
 */
export function fitObjectToBox(
  root: Object3D,
  width: number,
  height: number,
  depth: number,
  mode: FitObjectMode = 'uniform',
): void {
  root.updateMatrixWorld(true)
  const box = new Box3().setFromObject(root)
  if (box.isEmpty()) return

  const size = box.getSize(new Vector3())
  const center = box.getCenter(new Vector3())

  // Center at origin first (pre-scale), then scale so it stays centered.
  root.position.sub(center)

  const sx = size.x > 0 ? width / size.x : 1
  const sy = size.y > 0 ? height / size.y : 1
  const sz = size.z > 0 ? depth / size.z : 1

  if (mode === 'stretch') {
    if (![sx, sy, sz].every((v) => v > 0 && Number.isFinite(v))) return
    root.scale.set(sx, sy, sz)
  } else {
    const uniform = Math.min(sx, sy, sz)
    if (!(uniform > 0) || !Number.isFinite(uniform)) return
    root.scale.setScalar(uniform)
  }

  root.updateMatrixWorld(true)

  // Re-center after scale — some GLBs shift when scale is applied from a non-origin pivot.
  const fitted = new Box3().setFromObject(root)
  if (!fitted.isEmpty()) {
    const fittedCenter = fitted.getCenter(new Vector3())
    root.position.sub(fittedCenter)
  }
}
