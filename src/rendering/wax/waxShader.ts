import { clamp, fbm2D, normalize3 } from "./noise";
import type {
  ResolvedWaxSealRenderOptions,
  WaxHeightMap,
  WaxNormalMap,
  WaxScalarMap,
} from "./waxTypes";

type Rgb = {
  b: number;
  g: number;
  r: number;
};

function parseHexColor(hex: string): Rgb {
  const safeHex = hex.replace("#", "").trim();
  const expanded = safeHex.length === 3
    ? safeHex.split("").map((character) => `${character}${character}`).join("")
    : safeHex;
  const value = Number.parseInt(expanded, 16);

  if (!Number.isFinite(value)) {
    return { b: 8, g: 6, r: 159 };
  }

  return {
    b: value & 255,
    g: (value >> 8) & 255,
    r: (value >> 16) & 255,
  };
}

function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function add3(a: [number, number, number], b: [number, number, number]): [number, number, number] {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function createImageCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function drawSoftShadow(
  context: CanvasRenderingContext2D,
  heightMap: WaxHeightMap,
  options: ResolvedWaxSealRenderOptions,
) {
  if (!options.shadow) {
    return;
  }

  const size = heightMap.size;
  const shadowCanvas = createImageCanvas(size);
  const shadowContext = shadowCanvas.getContext("2d");

  if (!shadowContext) {
    return;
  }

  const image = shadowContext.createImageData(size, size);
  const pixels = image.data;

  for (let index = 0; index < heightMap.alpha.length; index += 1) {
    const pixelIndex = index * 4;
    const alpha = heightMap.alpha[index];
    pixels[pixelIndex] = 38;
    pixels[pixelIndex + 1] = 4;
    pixels[pixelIndex + 2] = 5;
    pixels[pixelIndex + 3] = Math.round(alpha * 74);
  }

  shadowContext.putImageData(image, 0, 0);
  context.save();
  context.filter = `blur(${Math.max(18, size * 0.045)}px)`;
  context.globalAlpha = 0.26;
  context.drawImage(shadowCanvas, size * 0.026, size * 0.04);
  context.restore();
}

export function renderShadedWaxSealToCanvas(
  canvas: HTMLCanvasElement,
  heightMap: WaxHeightMap,
  normalMap: WaxNormalMap,
  ambientOcclusionMap: WaxScalarMap,
  roughnessMap: WaxScalarMap,
  options: ResolvedWaxSealRenderOptions,
) {
  const size = heightMap.size;
  const baseColor = parseHexColor(options.waxColor);
  const keyLight = normalize3(options.lightDirection);
  const fillLight = normalize3([0.55, 0.65, 0.45]);
  const rimLight = normalize3([0.35, -0.75, 0.55]);
  const view: [number, number, number] = [0, 0, 1];
  const keyHalf = normalize3(add3(keyLight, view));
  const fillHalf = normalize3(add3(fillLight, view));
  const outputCanvas = createImageCanvas(size);
  const outputContext = outputCanvas.getContext("2d");

  if (!outputContext) {
    return;
  }

  const image = outputContext.createImageData(size, size);
  const pixels = image.data;
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    const ny = (y - center) / center;

    for (let x = 0; x < size; x += 1) {
      const index = y * size + x;
      const alpha = heightMap.alpha[index];
      const pixelIndex = index * 4;

      if (alpha <= 0.001) {
        pixels[pixelIndex] = 0;
        pixels[pixelIndex + 1] = 0;
        pixels[pixelIndex + 2] = 0;
        pixels[pixelIndex + 3] = 0;
        continue;
      }

      const nx = (x - center) / center;
      const normalIndex = index * 3;
      const normal: [number, number, number] = [
        normalMap.normals[normalIndex],
        normalMap.normals[normalIndex + 1],
        normalMap.normals[normalIndex + 2],
      ];
      const height = heightMap.height[index];
      const ao = ambientOcclusionMap.data[index];
      const roughness = roughnessMap.data[index];
      const surfaceNoise = fbm2D(nx * 29, ny * 29, options.seed + 983, 4);
      const fineSparkle = fbm2D(nx * 106, ny * 106, options.seed + 1201, 2);
      const keyDiffuse = Math.max(0, dot3(normal, keyLight));
      const fillDiffuse = Math.max(0, dot3(normal, fillLight));
      const rimDiffuse = Math.max(0, dot3(normal, rimLight));
      const broadSpecularPower = 7 + (1 - roughness) * 36;
      const clearcoatPower = 52 + (1 - roughness) * 160;
      const fillSpecularPower = 8 + (1 - roughness) * 28;
      const specularBreakup = clamp(0.82 + surfaceNoise * 0.12 + fineSparkle * 0.045, 0.58, 1.04);
      const broadSpecular =
        Math.pow(Math.max(0, dot3(normal, keyHalf)), broadSpecularPower) *
        options.specularStrength *
        0.55 *
        specularBreakup;
      const clearcoatSpecular =
        Math.pow(Math.max(0, dot3(normal, keyHalf)), clearcoatPower) *
        options.specularStrength *
        0.24 *
        specularBreakup *
        clamp(0.32 + height * 0.86);
      const fillSpecular =
        Math.pow(Math.max(0, dot3(normal, fillHalf)), fillSpecularPower) *
        options.specularStrength *
        0.12 *
        specularBreakup;
      const fresnel = Math.pow(1 - Math.max(0, dot3(normal, view)), 2.35);
      const sealEdge = 1 - clamp(heightMap.sealSdf.distance[index] / (size * 0.08));
      const translucency = options.translucency * clamp(sealEdge * 0.54 + keyDiffuse * 0.14 + height * 0.14);
      const ambient = 0.08 + 0.38 * ao;
      const direct = (keyDiffuse * 0.64 + fillDiffuse * 0.2 + rimDiffuse * 0.08) * (0.58 + ao * 0.42);
      const lighting = ambient + direct;
      const creaseDarkening = 0.78 + ao * 0.22;
      const heightColoring = 0.82 + height * 0.24 + surfaceNoise * options.textureIntensity * 0.08;
      const warmScatter = translucency * (0.24 + keyDiffuse * 0.2);
      const rimGlow = fresnel * options.specularStrength * 0.08 * (0.35 + rimDiffuse);
      const redWax = baseColor.r * lighting * creaseDarkening * heightColoring;
      const greenWax = baseColor.g * lighting * creaseDarkening * (heightColoring * 0.84);
      const blueWax = baseColor.b * lighting * creaseDarkening * (heightColoring * 0.76);
      const broad = clamp(broadSpecular + fillSpecular + rimGlow, 0, 0.78);
      const clearcoat = clamp(clearcoatSpecular, 0, 0.36);
      const red =
        redWax +
        46 * warmScatter +
        (baseColor.r * 0.48 + 96) * broad +
        190 * clearcoat;
      const green =
        greenWax +
        18 * warmScatter +
        (baseColor.g * 0.45 + 36) * broad +
        150 * clearcoat;
      const blue =
        blueWax +
        8 * warmScatter +
        (baseColor.b * 0.42 + 18) * broad +
        118 * clearcoat;

      pixels[pixelIndex] = Math.round(clamp(red, 0, 255));
      pixels[pixelIndex + 1] = Math.round(clamp(green, 0, 255));
      pixels[pixelIndex + 2] = Math.round(clamp(blue, 0, 255));
      pixels[pixelIndex + 3] = Math.round(clamp(alpha) * 255);
    }
  }

  outputContext.putImageData(image, 0, 0);

  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  context.clearRect(0, 0, size, size);
  if (!options.transparentBackground) {
    context.fillStyle = "#151111";
    context.fillRect(0, 0, size, size);
  }
  drawSoftShadow(context, heightMap, options);
  context.drawImage(outputCanvas, 0, 0);
}
