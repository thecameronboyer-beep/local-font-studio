import { clamp, smoothstep } from "./noise";
import type { ResolvedWaxSealRenderOptions, WaxHeightMap, WaxScalarMap } from "./waxTypes";

function sampleHeight(heightMap: WaxHeightMap, x: number, y: number) {
  const size = heightMap.size;
  const safeX = Math.min(size - 1, Math.max(0, x));
  const safeY = Math.min(size - 1, Math.max(0, y));
  return heightMap.height[safeY * size + safeX];
}

export function generateAmbientOcclusionMap(
  heightMap: WaxHeightMap,
  options: ResolvedWaxSealRenderOptions,
): WaxScalarMap {
  const size = heightMap.size;
  const data = new Float32Array(size * size);
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;

      if (heightMap.alpha[index] <= 0.001) {
        data[index] = 1;
        continue;
      }

      const sealDistance = heightMap.sealSdf.distance[index];
      const stampDistance = heightMap.stampSdf.distance[index];
      const radius = Math.hypot((x - center) / center, ((y - center) / center) * 1.02);
      const edgeCrease = (1 - smoothstep(0, size * 0.075, sealDistance)) * 0.18;
      const outerRimUndercut = Math.exp(-((sealDistance - size * 0.018) ** 2) / (2 * (size * 0.035) ** 2)) * 0.09;
      const innerGroove =
        Math.exp(-((radius - 0.535) ** 2) / (2 * 0.012 ** 2)) * 0.16 +
        Math.exp(-((radius - 0.452) ** 2) / (2 * 0.014 ** 2)) * 0.08;
      const stampBoundary = Math.exp(-(stampDistance * stampDistance) / (2 * (size * 0.014) ** 2));
      const stampInside = smoothstep(0, size * 0.016, stampDistance);
      const engravedDarkening = options.mode === "engraved" ? stampInside * 0.05 + stampBoundary * 0.045 : 0;
      const raisedContact = options.mode === "raised" ? stampBoundary * 0.12 : 0;
      const height = heightMap.height[index];
      const neighborAverage =
        (
          sampleHeight(heightMap, x - 2, y) +
          sampleHeight(heightMap, x + 2, y) +
          sampleHeight(heightMap, x, y - 2) +
          sampleHeight(heightMap, x, y + 2)
        ) / 4;
      const concavity = clamp((neighborAverage - height) * 4.8, 0, 0.16);

      data[index] = clamp(
        1 -
          edgeCrease -
          outerRimUndercut -
          innerGroove -
          engravedDarkening -
          raisedContact -
          concavity,
        0.52,
        1,
      );
    }
  }

  return {
    data,
    size,
  };
}
