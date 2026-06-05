import type { WaxHeightMap, WaxNormalMap } from "./waxTypes";

function sampleHeight(heightMap: WaxHeightMap, x: number, y: number) {
  const size = heightMap.size;
  const safeX = Math.min(size - 1, Math.max(0, x));
  const safeY = Math.min(size - 1, Math.max(0, y));
  return heightMap.height[safeY * size + safeX];
}

export function generateNormalMap(heightMap: WaxHeightMap, strength = 7.5): WaxNormalMap {
  const size = heightMap.size;
  const normals = new Float32Array(size * size * 3);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const normalIndex = index * 3;

      if (heightMap.alpha[index] <= 0.001) {
        normals[normalIndex] = 0;
        normals[normalIndex + 1] = 0;
        normals[normalIndex + 2] = 1;
        continue;
      }

      const topLeft = sampleHeight(heightMap, x - 1, y - 1);
      const top = sampleHeight(heightMap, x, y - 1);
      const topRight = sampleHeight(heightMap, x + 1, y - 1);
      const left = sampleHeight(heightMap, x - 1, y);
      const right = sampleHeight(heightMap, x + 1, y);
      const bottomLeft = sampleHeight(heightMap, x - 1, y + 1);
      const bottom = sampleHeight(heightMap, x, y + 1);
      const bottomRight = sampleHeight(heightMap, x + 1, y + 1);
      const dx = -((topRight + right * 2 + bottomRight) - (topLeft + left * 2 + bottomLeft)) * strength;
      const dy = -((bottomLeft + bottom * 2 + bottomRight) - (topLeft + top * 2 + topRight)) * strength;
      const dz = 1;
      const length = Math.hypot(dx, dy, dz) || 1;

      normals[normalIndex] = dx / length;
      normals[normalIndex + 1] = dy / length;
      normals[normalIndex + 2] = dz / length;
    }
  }

  return {
    normals: smoothNormalField(normals, heightMap, 1),
    size,
  };
}

function smoothNormalField(normals: Float32Array, heightMap: WaxHeightMap, iterations: number) {
  const size = heightMap.size;
  let current: Float32Array = new Float32Array(normals);
  let next: Float32Array = new Float32Array(normals.length);

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const index = y * size + x;
        const normalIndex = index * 3;

        if (heightMap.alpha[index] <= 0.001) {
          next[normalIndex] = 0;
          next[normalIndex + 1] = 0;
          next[normalIndex + 2] = 1;
          continue;
        }

        let totalX = current[normalIndex] * 4;
        let totalY = current[normalIndex + 1] * 4;
        let totalZ = current[normalIndex + 2] * 4;
        let weight = 4;

        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const sampleY = Math.min(size - 1, Math.max(0, y + offsetY));
          for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
            if (offsetX === 0 && offsetY === 0) {
              continue;
            }

            const sampleX = Math.min(size - 1, Math.max(0, x + offsetX));
            const sampleIndex = sampleY * size + sampleX;
            const sampleAlpha = heightMap.alpha[sampleIndex];

            if (sampleAlpha <= 0.001) {
              continue;
            }

            const sampleNormalIndex = sampleIndex * 3;
            const sampleWeight = offsetX === 0 || offsetY === 0 ? 1.5 : 0.75;
            totalX += current[sampleNormalIndex] * sampleWeight * sampleAlpha;
            totalY += current[sampleNormalIndex + 1] * sampleWeight * sampleAlpha;
            totalZ += current[sampleNormalIndex + 2] * sampleWeight * sampleAlpha;
            weight += sampleWeight * sampleAlpha;
          }
        }

        const nx = totalX / weight;
        const ny = totalY / weight;
        const nz = totalZ / weight;
        const length = Math.hypot(nx, ny, nz) || 1;
        next[normalIndex] = nx / length;
        next[normalIndex + 1] = ny / length;
        next[normalIndex + 2] = nz / length;
      }
    }

    const swap = current;
    current = next;
    next = swap;
  }

  return current;
}
