/**
 * Merge React Three Fiber's ThreeElements (mesh, ambientLight, etc.) into JSX.
 * Required for Next.js/TypeScript to recognize R3F primitive elements.
 */
import type { ThreeElements } from '@react-three/fiber'

declare global {
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}

export {}
