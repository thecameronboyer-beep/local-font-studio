import { generateAmbientOcclusionMap } from "./ambientOcclusion";
import { renderWaxDebugViewToCanvas } from "./debugViews";
import { generateHeightMap } from "./heightMap";
import { generateSealMask, generateStampMask } from "./masks";
import { generateNormalMap } from "./normalMap";
import { generateRoughnessMap } from "./roughnessMap";
import { renderShadedWaxSealToCanvas } from "./waxShader";
import { resolveWaxSealOptions } from "./waxTypes";
import type { WaxRenderResult, WaxSealRenderOptions } from "./waxTypes";

export function renderWaxSeal(canvas: HTMLCanvasElement, options: WaxSealRenderOptions = {}): WaxRenderResult {
  const resolvedOptions = resolveWaxSealOptions(options);
  const sealMask = generateSealMask(resolvedOptions);
  const stampMask = generateStampMask(resolvedOptions);
  const heightMap = generateHeightMap(sealMask, stampMask, resolvedOptions);
  const normalMap = generateNormalMap(heightMap, resolvedOptions.normalStrength);
  const ambientOcclusionMap = generateAmbientOcclusionMap(heightMap, resolvedOptions);
  const roughnessMap = generateRoughnessMap(heightMap, resolvedOptions);

  if (resolvedOptions.debugMode === "final") {
    renderShadedWaxSealToCanvas(
      canvas,
      heightMap,
      normalMap,
      ambientOcclusionMap,
      roughnessMap,
      resolvedOptions,
    );
  } else {
    renderWaxDebugViewToCanvas({
      ambientOcclusionMap,
      canvas,
      heightMap,
      mode: resolvedOptions.debugMode,
      normalMap,
      roughnessMap,
      sealMask,
    });
  }

  return {
    ambientOcclusionMap,
    heightMap,
    normalMap,
    roughnessMap,
    sealMask,
    stampMask,
  };
}

export type { WaxDebugRenderMode, WaxSealRenderOptions, WaxSealStroke } from "./waxTypes";
