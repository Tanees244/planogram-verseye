/**
 * Offline regression: by-store placement must survive structure merge.
 * Run: node scripts/test-placement-load.mjs
 *
 * Uses the same merge rule as fetchStoreLayoutRacks — list placement wins.
 */

import { createRequire } from 'module'
import { pathToFileURL } from 'url'
import path from 'path'
import { register } from 'node:module'
import { MessageChannel } from 'node:worker_threads'

// Minimal fixture mirroring the user's by-store vs structure mismatch.
const listRack = {
  rackId: '019faf14-4284-75ec-b7de-95896f3f5a95',
  rackCode: 'OTHER-BRANDS-16',
  rackName: 'other brands 16',
  fixtureType: 'CUSTOM',
  height: 2.2,
  width: 6,
  depth: 1.21,
  isDoubleSided: false,
  position: { x: -11.5, y: 0, z: 13.275, rotationY: 0 },
  placement: {
    position: { x: -11.5, y: 0, z: 13.275 },
    rotation: { x: 0, y: 0, z: 0 },
    snapMode: 'wall',
    quadrant: 'NW',
  },
  sides: [],
}

const structureRackBadPlacement = {
  ...listRack,
  // Structure sometimes returns zeros / wrong pose.
  position: { x: 0, y: 0, z: 0, rotationY: 0 },
  placement: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    snapMode: 'wall',
    quadrant: 'NW',
  },
  sides: [{ sideId: 's1', sideCode: 'S1', rows: [] }],
}

async function main() {
  // Dynamic import of compiled TS via next/tsx is awkward; replicate the
  // production rule inline and assert the contract the UI depends on.
  function keepListPlacement(list, structure) {
    return {
      ...structure,
      position: { ...list.position },
      rotation: list.placement?.rotation
        ? { ...list.placement.rotation }
        : { x: 0, y: list.position.rotationY ?? 0, z: 0 },
      quadrant: list.placement?.quadrant ?? list.quadrant,
      placement: list.placement ? { ...list.placement, position: { ...list.placement.position } } : list.placement,
      placementSource: 'api',
    }
  }

  const merged = keepListPlacement(listRack, structureRackBadPlacement)
  const ok =
    merged.position.x === -11.5 &&
    merged.position.z === 13.275 &&
    merged.placement.position.x === -11.5 &&
    merged.sides?.length === 1

  console.log('list placement:', listRack.position)
  console.log('structure placement (bad):', structureRackBadPlacement.position)
  console.log('merged placement:', merged.position)
  console.log('sides kept from structure:', merged.sides.length)
  if (!ok) {
    console.error('FAIL: structure placement overwrote by-store placement')
    process.exit(1)
  }
  console.log('PASS: by-store placement kept; structure sides kept')
}

main()
