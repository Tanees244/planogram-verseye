// @ts-nocheck
"use client";

import { useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { CameraControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { Area } from "@/components/Area";
import { CameraManager } from "@/components/CameraManager";
import { SelectionPopup } from "@/components/SelectionPopup";

export function Scene3DCanvas() {
  const controlsRef = useRef(null);
  return (
    <Canvas
      shadows
      onCreated={({ scene }) => {
        scene.background = new THREE.Color("#1e1e1e");
        scene.fog = new THREE.Fog("#1e1e1e", 80, 250);
      }}
    >
      <PerspectiveCamera makeDefault position={[30, 25, 30]} fov={50} />
      <ambientLight intensity={0.7} />
      <directionalLight
        position={[15, 20, 10]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-80}
        shadow-camera-right={80}
        shadow-camera-top={80}
        shadow-camera-bottom={-80}
      />
      <directionalLight position={[-15, 12, -8]} intensity={0.5} />
      <pointLight position={[0, 15, 0]} intensity={0.3} />
      <CameraControls
        ref={controlsRef}
        makeDefault
        minDistance={5}
        maxDistance={300}
        dollyToCursor={true}
      />
      <CameraManager controlsRef={controlsRef} />
      <SelectionPopup />
      <Area />
    </Canvas>
  );
}
