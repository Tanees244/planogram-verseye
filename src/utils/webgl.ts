/** Conservative WebGL flags so Chrome can bind a context on sandboxed / Intel GPUs. */
export const SAFE_GL = {
  antialias: true,
  alpha: false,
  powerPreference: 'default' as const,
  failIfMajorPerformanceCaveat: false,
  preserveDrawingBuffer: false,
  stencil: false,
  depth: true,
}

export const SAFE_GL_ALPHA = {
  ...SAFE_GL,
  alpha: true,
}
