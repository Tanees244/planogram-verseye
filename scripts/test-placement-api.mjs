/**
 * Live API placement round-trip test.
 *
 * Usage (PowerShell):
 *   $env:PLANOGRAM_TOKEN = "<paste bearer token from browser Network tab>"
 *   node scripts/test-placement-api.mjs
 *
 * What it does:
 *  1. GET by-store + structure for one rack and compare placements
 *  2. PUT a temporary position
 *  3. GET again and verify it stuck
 *  4. PUT the original position back
 */

const API = process.env.API_BASE_URL || 'http://163.61.91.183:8081'
const STORE_ID = process.env.STORE_ID || '9dc8c3ab-2a9d-4a1b-8d4b-96745242f473'
const RACK_ID = process.env.RACK_ID || '019faf14-4284-75ec-b7de-95896f3f5a95'
const TOKEN = process.env.PLANOGRAM_TOKEN

if (!TOKEN) {
  console.error(
    'Missing PLANOGRAM_TOKEN.\n' +
      'Open DevTools → Network → any /api/racks request → copy Authorization Bearer value,\n' +
      'then:  $env:PLANOGRAM_TOKEN=\"eyJ...\" ; node scripts/test-placement-api.mjs',
  )
  process.exit(1)
}

const headers = {
  Accept: 'application/json',
  Authorization: `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
}

async function getJson(path) {
  const res = await fetch(`${API}${path}`, { headers, cache: 'no-store' })
  const json = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, json }
}

function poseOf(rack) {
  const p = rack?.placement?.position ?? rack?.position ?? {}
  const r = rack?.placement?.rotation ?? {}
  return {
    x: p.x,
    z: p.z,
    rotY: r.y ?? rack?.position?.rotationY ?? 0,
    quadrant: rack?.placement?.quadrant ?? null,
  }
}

async function main() {
  console.log('API', API)
  console.log('store', STORE_ID)
  console.log('rack', RACK_ID)

  const list = await getJson(
    `/api/v1/layout/racks/by-store/${STORE_ID}?page=1&pageSize=200`,
  )
  if (!list.ok) {
    console.error('by-store failed', list.status, list.json)
    process.exit(1)
  }
  const racks = list.json?.data?.racks ?? list.json?.racks ?? []
  const fromList = racks.find((r) => r.rackId === RACK_ID)
  if (!fromList) {
    console.error('rack not in by-store list')
    process.exit(1)
  }
  console.log('by-store pose', poseOf(fromList))

  const structure = await getJson(`/api/v1/layout/racks/${RACK_ID}/structure`)
  if (!structure.ok) {
    console.error('structure failed', structure.status, structure.json)
    process.exit(1)
  }
  const fromStructure = structure.json?.data ?? structure.json
  console.log('structure pose', poseOf(fromStructure))

  const listPose = poseOf(fromList)
  const structPose = poseOf(fromStructure)
  if (listPose.x !== structPose.x || listPose.z !== structPose.z) {
    console.warn(
      'MISMATCH: by-store and structure disagree. UI must use by-store placement.',
    )
  } else {
    console.log('by-store and structure placements match')
  }

  const original = {
    x: listPose.x,
    y: 0,
    z: listPose.z,
    rotY: listPose.rotY,
    quadrant: listPose.quadrant,
  }

  const testPose = {
    x: Number((original.x + 0.5).toFixed(3)),
    y: 0,
    z: original.z,
    rotY: original.rotY,
    quadrant: original.quadrant,
  }

  const putBody = {
    rackId: RACK_ID,
    rackName: fromList.rackName,
    fixtureType: fromList.fixtureType ?? 'CUSTOM',
    isDoubleSided: Boolean(fromList.isDoubleSided),
    outer: fromList.outer,
    inner: fromList.inner,
    placement: {
      position: { x: testPose.x, y: 0, z: testPose.z },
      rotation: { x: 0, y: testPose.rotY, z: 0 },
      snapMode: 'wall',
      quadrant: testPose.quadrant,
    },
    positionX: testPose.x,
    positionY: 0,
    positionZ: testPose.z,
    rotationY: testPose.rotY,
    width: fromList.width,
    depth: fromList.depth,
    height: fromList.height,
    shell: fromList.shell
      ? {
          ...fromList.shell,
          headerPosm: undefined,
          footerPosm: undefined,
          leftWallPosm: undefined,
          rightWallPosm: undefined,
        }
      : undefined,
    sides: (fromStructure.sides ?? []).map((side) => ({
      id: side.sideId,
      depth: side.depth,
      inner: side.inner,
      outer: side.outer,
      header: side.header,
      footer: side.footer,
      rows: (side.rows ?? []).map((row) => ({
        id: row.rowId,
        rowNumber: row.rowNumber,
        width: row.width,
        span: row.span,
        height: row.height,
        depth: row.depth,
        sided: row.sided,
        dividerThickness: row.dividerThickness,
        yStart: row.yStart,
        yEnd: row.yEnd,
        // omit bins — empty-row racks fail full-tree validation
      })),
    })),
  }

  console.log('PUT test pose', testPose)
  const putRes = await fetch(`${API}/api/v1/layout/racks/${RACK_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  })
  const putJson = await putRes.json().catch(() => ({}))
  console.log('PUT status', putRes.status, putJson?.message || putJson)

  const after = await getJson(
    `/api/v1/layout/racks/by-store/${STORE_ID}?page=1&pageSize=200`,
  )
  const afterRack = (after.json?.data?.racks ?? []).find((r) => r.rackId === RACK_ID)
  console.log('by-store after PUT', poseOf(afterRack))

  const stuck =
    afterRack &&
    Math.abs(poseOf(afterRack).x - testPose.x) < 0.001 &&
    Math.abs(poseOf(afterRack).z - testPose.z) < 0.001

  // Restore original
  putBody.placement.position = { x: original.x, y: 0, z: original.z }
  putBody.placement.rotation = { x: 0, y: original.rotY, z: 0 }
  putBody.placement.quadrant = original.quadrant
  putBody.positionX = original.x
  putBody.positionZ = original.z
  putBody.rotationY = original.rotY
  const restore = await fetch(`${API}/api/v1/layout/racks/${RACK_ID}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(putBody),
  })
  const restoreJson = await restore.json().catch(() => ({}))
  console.log('restore status', restore.status, restoreJson?.message || restoreJson)

  if (!putRes.ok) {
    console.error('FAIL: PUT rejected — move never reaches the database')
    process.exit(2)
  }
  if (!stuck) {
    console.error('FAIL: PUT succeeded but by-store still has old/wrong coords')
    process.exit(3)
  }
  console.log('PASS: placement round-trip works on the API')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
