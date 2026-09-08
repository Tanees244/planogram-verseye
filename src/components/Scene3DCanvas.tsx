// @ts-nocheck
"use client";

import { useCallback, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import { Area } from "@/components/Area";
import { CameraManager } from "@/components/CameraManager";
import { SelectionPopup } from "@/components/SelectionPopup";
import { SceneAtmosphere, SceneLighting } from "@/components/scene/SceneAtmosphere";
import { SceneCaptureBridge } from "@/components/scene/SceneCaptureBridge";
import { WAREHOUSE_SCALE } from "@/constants/warehouse";
import { FloorDropHandler } from "@/components/scene/FloorDropHandler";
import { ProductDropHandler } from "@/components/scene/ProductDropHandler";
import { PosmDropHandler } from "@/components/scene/PosmDropHandler";
import { WebGLErrorBoundary } from "@/components/WebGLErrorBoundary";
import { SAFE_GL } from "@/utils/webgl";

const S = WAREHOUSE_SCALE;

export function Scene3DCanvas() {
  const controlsRef = useRef(null);
  const sceneTheme = "day" as const;
  const [canvasKey, setCanvasKey] = useState(0);

  const retry = useCallback(() => {
    setCanvasKey((n) => n + 1);
  }, []);

  const fallback = (
    <div className="flex h-full w-full items-center justify-center bg-[#87CEEB] px-6">
      <div className="max-w-md rounded-2xl border border-white/40 bg-white/80 p-5 text-center shadow-lg">
        <p className="text-sm font-semibold text-slate-900">3D view could not start</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-600">
          WebGL is blocked or the GPU ran out of contexts. Close other 3D tabs, turn on
          hardware acceleration in Chrome, then retry.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded-lg bg-[#2C5282] px-4 py-2 text-sm font-medium text-white hover:bg-[#1A365D]"
        >
          Retry 3D view
        </button>
      </div>
    </div>
  );

  return (
    <WebGLErrorBoundary key={canvasKey} fallback={fallback}>
      <Canvas
        shadows={false}
        dpr={[1, 1.25]}
        performance={{ min: 0.5 }}
        gl={SAFE_GL}
      >
        <SceneAtmosphere theme={sceneTheme} />
        <SceneCaptureBridge />
        <PerspectiveCamera makeDefault position={[30 * S, 25 * S, 30 * S]} fov={50} />
        <SceneLighting theme={sceneTheme} />
        <CameraControls
          ref={controlsRef}
          makeDefault
          minDistance={5 * S}
          maxDistance={300 * S}
          dollyToCursor={true}
        />
        <CameraManager controlsRef={controlsRef} />
        <FloorDropHandler />
        <ProductDropHandler />
        <PosmDropHandler />
        <SelectionPopup />
        <Area />
      </Canvas>
    </WebGLErrorBoundary>
  );
}
