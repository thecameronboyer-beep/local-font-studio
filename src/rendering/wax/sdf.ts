import type { WaxDistanceField, WaxMask } from "./waxTypes";

const diagonalCost = Math.SQRT2;
const orthogonalCost = 1;

function runDistanceTransform(source: Uint8Array, size: number) {
  const distance = new Float32Array(size * size);
  const far = size * 4;

  for (let index = 0; index < distance.length; index += 1) {
    distance[index] = source[index] ? 0 : far;
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      let best = distance[index];

      if (x > 0) {
        best = Math.min(best, distance[index - 1] + orthogonalCost);
      }
      if (y > 0) {
        best = Math.min(best, distance[index - size] + orthogonalCost);
      }
      if (x > 0 && y > 0) {
        best = Math.min(best, distance[index - size - 1] + diagonalCost);
      }
      if (x < size - 1 && y > 0) {
        best = Math.min(best, distance[index - size + 1] + diagonalCost);
      }

      distance[index] = best;
    }
  }

  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = size - 1; x >= 0; x -= 1) {
      const index = y * size + x;
      let best = distance[index];

      if (x < size - 1) {
        best = Math.min(best, distance[index + 1] + orthogonalCost);
      }
      if (y < size - 1) {
        best = Math.min(best, distance[index + size] + orthogonalCost);
      }
      if (x < size - 1 && y < size - 1) {
        best = Math.min(best, distance[index + size + 1] + diagonalCost);
      }
      if (x > 0 && y < size - 1) {
        best = Math.min(best, distance[index + size - 1] + diagonalCost);
      }

      distance[index] = best;
    }
  }

  return distance;
}

export function generateSignedDistanceField(mask: WaxMask): WaxDistanceField {
  const inside = new Uint8Array(mask.alpha.length);
  const outside = new Uint8Array(mask.alpha.length);

  for (let index = 0; index < mask.alpha.length; index += 1) {
    const isInside = mask.alpha[index] >= 0.5;
    inside[index] = isInside ? 0 : 1;
    outside[index] = isInside ? 1 : 0;
  }

  const insideDistance = runDistanceTransform(inside, mask.size);
  const outsideDistance = runDistanceTransform(outside, mask.size);
  const distance = new Float32Array(mask.alpha.length);

  for (let index = 0; index < distance.length; index += 1) {
    distance[index] = insideDistance[index] - outsideDistance[index];
  }

  return {
    distance,
    size: mask.size,
  };
}
