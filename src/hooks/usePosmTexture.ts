'use client'

import { useEffect, useState } from 'react'
import { SRGBColorSpace, TextureLoader, type Texture } from 'three'
import { getPlanogramTokenFromCookie } from '@verseye/utils'

function imageAuthHeaders(): HeadersInit {
  try {
    const t = getPlanogramTokenFromCookie()
    if (t) return { Authorization: `Bearer ${t}` }
  } catch {
    /* ignore */
  }
  return {}
}

/**
 * Loads a POSM/catalog image as a Three texture, returning null while loading
 * and on failure. Unlike drei's `useTexture`, a broken image never throws, so
 * the scene keeps rendering (callers fall back to a colored plaque).
 */
export function usePosmTexture(url: string | null | undefined): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    setTexture(null)
    if (!url) return

    let active = true
    let objectUrl: string | null = null
    let loaded: Texture | null = null

    void (async () => {
      try {
        const res = await fetch(url, {
          credentials: 'include',
          headers: imageAuthHeaders(),
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`POSM image ${res.status}`)
        const blob = await res.blob()
        if (!active) return

        // TextureLoader + Image (not ImageBitmap) — correct flipY for Three.js UVs.
        objectUrl = URL.createObjectURL(blob)
        const loader = new TextureLoader()
        loader.load(
          objectUrl,
          (tex) => {
            if (!active) {
              tex.dispose()
              return
            }
            tex.colorSpace = SRGBColorSpace
            tex.anisotropy = 4
            tex.needsUpdate = true
            loaded = tex
            setTexture(tex)
          },
          undefined,
          () => {
            if (active) setTexture(null)
          },
        )
      } catch {
        if (active) setTexture(null)
      }
    })()

    return () => {
      active = false
      loaded?.dispose()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [url])

  return texture
}
