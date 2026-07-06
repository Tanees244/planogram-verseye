// @ts-nocheck
"use client";

import type { Rack as RackType } from "@/store/planogramStore";
import { FixtureRenderer } from "./fixtures/FixtureRenderer";

/** Renders any rack using the parametric fixture library. */
export function Rack({ rack }: { rack: RackType }) {
  return <FixtureRenderer rack={rack} />;
}
