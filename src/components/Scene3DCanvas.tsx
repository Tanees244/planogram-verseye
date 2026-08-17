// @ts-nocheck
"use client";

import { useRef } from "react";
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

const S = WAREHOUSE_SCALE;

export function Scene3DCanvas() {
  const controlsRef = useRef(null);
  // Night mode removed for performance — always day lighting.
  const sceneTheme = "day" as const;

  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.25]}
      performance={{ min: 0.5 }}
      gl={{ powerPreference: 'high-performance', antialias: true, preserveDrawingBuffer: true }}
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
  );
}
