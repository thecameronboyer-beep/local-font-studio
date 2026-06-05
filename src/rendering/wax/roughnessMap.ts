import { clamp, fbm2D } from "./noise";
import type { ResolvedWaxSealRenderOptions, WaxHeightMap, WaxScalarMap } from "./waxTypes";

export function generateRoughnessMap(
  heightMap: WaxHeightMap,
  options: ResolvedWaxSealRenderOptions,
): WaxScalarMap {
  const size = heightMap.size;
  const data = new Float32Array(size * size);
  const baseRoughness = clamp(options.roughness, 0.08, 0.92);

  for (let y = 0; y < size; y += 1) {
    const ny = y / size - 0.5;
    for (let x = 0; x < size; x += 1) {
      const nx = x / size - 0.5;
      const index = y * size + x;
      const waxVariation =
        fbm2D(nx * 14, ny * 14, options.seed + 601, 4) * 0.055 +
        fbm2D(nx * 54, ny * 54, options.seed + 727, 2) * 0.018;
      const highSpotPolish = heightMap.height[index] * 0.055;

      data[index] = clamp(baseRoughness + waxVariation - highSpotPolish, 0.08, 0.95);
    }
  }

  return {
    data,
    size,
  };
}
