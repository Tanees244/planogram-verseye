// @ts-nocheck
"use client";

import dynamic from "next/dynamic";

// Load React Three Fiber in a separate chunk so it runs in correct React context (avoids ReactCurrentOwner error)
const Scene3DCanvas = dynamic(
  () =>
    import("@/components/Scene3DCanvas").then((m) => ({
      default: m.Scene3DCanvas,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#1e1e1e]">
        <div className="text-center text-white/80">Loading 3D view…</div>
      </div>
    ),
  }
);

export function Scene3D() {
  return <Scene3DCanvas />;
}
