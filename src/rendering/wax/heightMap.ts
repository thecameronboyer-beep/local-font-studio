import { fbm2D, smoothstep, clamp } from "./noise";
import { generateSignedDistanceField } from "./sdf";
import type { ResolvedWaxSealRenderOptions, WaxHeightMap, WaxMask } from "./waxTypes";

function gaussian(distance: number, width: number) {
  const safeWidth = Math.max(0.000001, width);
  return Math.exp(-(distance * distance) / (2 * safeWidth * safeWidth));
}

function smoothHeightField(height: Float32Array, alpha: Float32Array, size: number, iterations: number) {
  let current: Float32Array = new Float32Array(height);
  let next: Float32Array = new Float32Array(height.length);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = y * size + x;

        if (alpha[index] <= 0.001) {
          next[index] = 0;
          continue;
        }

        let total = current[index] * 4;
        let weight = 4;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const sampleY = Math.min(size - 1, Math.max(0, y + offsetY));
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            const sampleX = Math.min(size - 1, Math.max(0, x + offsetX));
            const sampleIndex = sampleY * size + sampleX;
            const sampleAlpha = alpha[sampleIndex];

            if (sampleAlpha <= 0.001) {
              continue;
            }

            const sampleWeight = offsetX === 0 || offsetY === 0 ? 2 : 1;
            total += current[sampleIndex] * sampleWeight * sampleAlpha;
            weight += sampleWeight * sampleAlpha;
          }
        }

        next[index] = total / weight;
      }
    }

    const swap = current;
    current = next;
    next = swap;
  }

  return current;
}

export function generateHeightMap(
  sealMask: WaxMask,
  stampMask: WaxMask,
  options: ResolvedWaxSealRenderOptions,
): WaxHeightMap {
  const size = sealMask.size;
  const center = (size - 1) / 2;
  const sealSdf = generateSignedDistanceField(sealMask);
  const stampSdf = generateSignedDistanceField(stampMask);
  const height = new Float32Array(size * size);
  const alpha = new Float32Array(size * size);
  const depth = clamp(options.depth);
  const rimHeight = clamp(options.rimHeight);
  const textureIntensity = clamp(options.textureIntensity);
  const stampDepthMagnitude = Math.abs(options.stampDepth);

  for (let y = 0; y < size; y += 1) {
    const ny = (y - center) / center;

    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const nx = (x - center) / center;
      const radius = Math.hypot(nx, ny * 1.02);
      const sealDistance = sealSdf.distance[index];
      const sealAlpha = sealMask.alpha[index];

      if (sealAlpha <= 0.001) {
        height[index] = 0;
        alpha[index] = 0;
        continue;
      }

      const bodyMask = smoothstep(-1, size * 0.018, sealDistance);
      const dome = smoothstep(0, 1, clamp(1 - radius * radius * 1.06));
      const edgeBulk = clamp(1 + fbm2D(nx * 2.35 - 0.8, ny * 2.35 + 1.9, options.seed + 431, 4) * 0.28, 0.72, 1.32);
      const outerPool =
        gaussian(sealDistance - size * 0.05, size * 0.045) *
        (0.13 + rimHeight * 0.26) *
        edgeBulk;
      const outerShoulder =
        gaussian(sealDistance - size * 0.11, size * 0.09) *
        (0.025 + rimHeight * 0.045) *
        edgeBulk;
      const outsideTaper = smoothstep(0, size * 0.055, sealDistance);
      const lowerSag =
        smoothstep(0.1, 0.92, ny) *
        gaussian(sealDistance - size * 0.05, size * 0.07) *
        0.035 *
        edgeBulk;
      const innerRingDistance = Math.abs(radius - 0.49) * size;
      const innerRim = gaussian(innerRingDistance, size * 0.018) * (0.07 + rimHeight * 0.145);
      const innerGroove =
        gaussian(Math.abs(radius - 0.535) * size, size * 0.014) * (0.028 + rimHeight * 0.035) +
        gaussian(Math.abs(radius - 0.452) * size, size * 0.018) * 0.022;
      const broadWave = fbm2D(nx * 2.2 + 0.4, ny * 2.2 - 0.7, options.seed + 151, 4) * 0.038;
      const waxRipple = fbm2D(nx * 8.5, ny * 8.5, options.seed + 271, 4) * 0.012;
      const microGrain = fbm2D(nx * 42.0, ny * 42.0, options.seed + 379, 3) * 0.004;
      const texture = (broadWave + waxRipple + microGrain) * textureIntensity;
      const centerField = 0.3 + dome * (0.22 + depth * 0.17);
      let nextHeight =
        (centerField + outerPool + outerShoulder + lowerSag + innerRim - innerGroove + texture) *
        outsideTaper *
        bodyMask;

      if (options.mode !== "blank") {
        const stampDistance = stampSdf.distance[index];
        const stampInside = smoothstep(0, size * 0.011, stampDistance) * bodyMask;
        const stampBoundary = gaussian(stampDistance, size * 0.012) * bodyMask;
        const stampOuterLip = gaussian(stampDistance + size * 0.008, size * 0.012) * bodyMask;
        const stampInnerBevel = gaussian(stampDistance - size * 0.012, size * 0.014) * bodyMask;

        if (options.mode === "raised") {
          const raised = stampInside * (0.045 + stampDepthMagnitude * 0.38);
          const bevel = stampInnerBevel * (0.02 + stampDepthMagnitude * 0.16);
          nextHeight += raised + bevel;
        } else {
          const depression = stampInside * (0.052 + stampDepthMagnitude * 0.42);
          const bevelSlope = stampBoundary * (0.018 + stampDepthMagnitude * 0.08);
          const displacedLip = stampOuterLip * (0.018 + stampDepthMagnitude * 0.08);
          nextHeight += displacedLip + bevelSlope - depression;
        }
      }

      alpha[index] = sealAlpha;
      height[index] = clamp(nextHeight, 0, 1);
    }
  }

  const smoothedHeight = smoothHeightField(height, alpha, size, 2);

  return {
    alpha,
    height: smoothedHeight,
    sealSdf,
    size,
    stampSdf,
  };
}
