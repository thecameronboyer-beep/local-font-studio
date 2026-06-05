export type WaxSealMode = "blank" | "engraved" | "raised";

export type WaxDebugRenderMode =
  | "final"
  | "alpha"
  | "edge"
  | "sdf"
  | "height"
  | "normal"
  | "ao"
  | "roughness";

export type WaxSealPoint = {
  x: number;
  y: number;
};

export type WaxSealStroke = {
  id: string;
  points: WaxSealPoint[];
};

export type WaxSealRenderOptions = {
  sealShape?: Path2D | string | ImageData;
  stampShape?: Path2D | string | ImageData;
  stampText?: string;
  stampFontFamily?: string;
  stampStrokes?: WaxSealStroke[];
  mode?: WaxSealMode;
  waxColor?: string;
  seed?: number;
  renderSize?: number;
  depth?: number;
  stampDepth?: number;
  rimHeight?: number;
  edgeIrregularity?: number;
  textureIntensity?: number;
  roughness?: number;
  specularStrength?: number;
  translucency?: number;
  lightDirection?: [number, number, number];
  debugMode?: WaxDebugRenderMode;
  markScale?: number;
  markWeight?: number;
  normalStrength?: number;
  transparentBackground?: boolean;
  shadow?: boolean;
};

export type ResolvedWaxSealRenderOptions = Required<
  Omit<
    WaxSealRenderOptions,
    "sealShape" | "stampShape" | "stampText" | "stampFontFamily" | "stampStrokes"
  >
> & {
  sealShape?: Path2D | string | ImageData;
  stampShape?: Path2D | string | ImageData;
  stampText: string;
  stampFontFamily: string;
  stampStrokes: WaxSealStroke[];
};

export type WaxMask = {
  alpha: Float32Array;
  size: number;
};

export type WaxDistanceField = {
  distance: Float32Array;
  size: number;
};

export type WaxHeightMap = {
  alpha: Float32Array;
  height: Float32Array;
  sealSdf: WaxDistanceField;
  size: number;
  stampSdf: WaxDistanceField;
};

export type WaxNormalMap = {
  normals: Float32Array;
  size: number;
};

export type WaxScalarMap = {
  data: Float32Array;
  size: number;
};

export type WaxRenderResult = {
  ambientOcclusionMap: WaxScalarMap;
  heightMap: WaxHeightMap;
  normalMap: WaxNormalMap;
  roughnessMap: WaxScalarMap;
  sealMask: WaxMask;
  stampMask: WaxMask;
};

export const defaultWaxSealOptions: ResolvedWaxSealRenderOptions = {
  debugMode: "final",
  depth: 0.78,
  edgeIrregularity: 0.38,
  lightDirection: [-0.45, -0.55, 0.75],
  markScale: 0.92,
  markWeight: 0.48,
  mode: "engraved",
  renderSize: 768,
  rimHeight: 0.68,
  roughness: 0.42,
  seed: 11,
  shadow: false,
  specularStrength: 0.48,
  stampDepth: -0.24,
  stampFontFamily: "Georgia, serif",
  stampStrokes: [],
  stampText: "",
  textureIntensity: 0.22,
  translucency: 0.12,
  normalStrength: 3.9,
  transparentBackground: true,
  waxColor: "#970607",
};

export function resolveWaxSealOptions(options: WaxSealRenderOptions = {}): ResolvedWaxSealRenderOptions {
  const mode = options.mode ?? defaultWaxSealOptions.mode;
  const stampDepth = options.stampDepth ?? (mode === "raised" ? 0.18 : -0.24);

  return {
    ...defaultWaxSealOptions,
    ...options,
    mode,
    renderSize: Math.max(128, Math.round(options.renderSize ?? defaultWaxSealOptions.renderSize)),
    stampDepth,
    stampFontFamily: options.stampFontFamily ?? defaultWaxSealOptions.stampFontFamily,
    stampStrokes: options.stampStrokes ?? defaultWaxSealOptions.stampStrokes,
    stampText: options.stampText ?? defaultWaxSealOptions.stampText,
  };
}
