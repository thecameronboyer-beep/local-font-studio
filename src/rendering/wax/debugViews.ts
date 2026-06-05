import { clamp, smoothstep } from "./noise";
import type {
  WaxDebugRenderMode,
  WaxHeightMap,
  WaxMask,
  WaxNormalMap,
  WaxScalarMap,
} from "./waxTypes";

function drawImageData(canvas: HTMLCanvasElement, pixels: Uint8ClampedArray, size: number) {
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  const image = context.createImageData(size, size);
  image.data.set(pixels);
  context.putImageData(image, 0, 0);
}

function setPixel(
  pixels: Uint8ClampedArray,
  index: number,
  red: number,
  green: number,
  blue: number,
  alpha = 255,
) {
  const pixelIndex = index * 4;
  pixels[pixelIndex] = Math.round(clamp(red, 0, 255));
  pixels[pixelIndex + 1] = Math.round(clamp(green, 0, 255));
  pixels[pixelIndex + 2] = Math.round(clamp(blue, 0, 255));
  pixels[pixelIndex + 3] = Math.round(clamp(alpha, 0, 255));
}

function renderMask(canvas: HTMLCanvasElement, mask: WaxMask) {
  const pixels = new Uint8ClampedArray(mask.size * mask.size * 4);

  for (let index = 0; index < mask.alpha.length; index += 1) {
    const value = mask.alpha[index] * 255;
    setPixel(pixels, index, value, value, value);
  }

  drawImageData(canvas, pixels, mask.size);
}

function renderEdge(canvas: HTMLCanvasElement, heightMap: WaxHeightMap) {
  const size = heightMap.size;
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let index = 0; index < heightMap.alpha.length; index += 1) {
    const distance = Math.abs(heightMap.sealSdf.distance[index]);
    const edge = 1 - smoothstep(0, size * 0.055, distance);
    const body = heightMap.alpha[index] * 0.28;
    const value = Math.max(body, edge) * 255;
    setPixel(pixels, index, value, value, value);
  }

  drawImageData(canvas, pixels, size);
}

function renderSdf(canvas: HTMLCanvasElement, heightMap: WaxHeightMap) {
  const size = heightMap.size;
  const pixels = new Uint8ClampedArray(size * size * 4);
  const range = size * 0.16;

  for (let index = 0; index < heightMap.sealSdf.distance.length; index += 1) {
    const normalized = clamp(heightMap.sealSdf.distance[index] / range, -1, 1);
    const red = normalized < 0 ? Math.abs(normalized) * 130 : 0;
    const blue = normalized > 0 ? normalized * 180 : 0;
    const green = (1 - Math.abs(normalized)) * 210;
    setPixel(pixels, index, red, green, blue);
  }

  drawImageData(canvas, pixels, size);
}

function renderHeight(canvas: HTMLCanvasElement, heightMap: WaxHeightMap) {
  const size = heightMap.size;
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let index = 0; index < heightMap.height.length; index += 1) {
    const value = heightMap.height[index] * heightMap.alpha[index] * 255;
    setPixel(pixels, index, value, value, value);
  }

  drawImageData(canvas, pixels, size);
}

function renderNormals(canvas: HTMLCanvasElement, normalMap: WaxNormalMap, heightMap: WaxHeightMap) {
  const size = normalMap.size;
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let index = 0; index < size * size; index += 1) {
    const normalIndex = index * 3;
    const alpha = heightMap.alpha[index] > 0.001 ? 255 : 0;
    setPixel(
      pixels,
      index,
      (normalMap.normals[normalIndex] * 0.5 + 0.5) * 255,
      (normalMap.normals[normalIndex + 1] * 0.5 + 0.5) * 255,
      (normalMap.normals[normalIndex + 2] * 0.5 + 0.5) * 255,
      alpha,
    );
  }

  drawImageData(canvas, pixels, size);
}

function renderScalar(canvas: HTMLCanvasElement, map: WaxScalarMap, heightMap: WaxHeightMap) {
  const size = map.size;
  const pixels = new Uint8ClampedArray(size * size * 4);

  for (let index = 0; index < map.data.length; index += 1) {
    const value = map.data[index] * heightMap.alpha[index] * 255;
    setPixel(pixels, index, value, value, value);
  }

  drawImageData(canvas, pixels, size);
}

export function renderWaxDebugViewToCanvas({
  ambientOcclusionMap,
  canvas,
  heightMap,
  mode,
  normalMap,
  roughnessMap,
  sealMask,
}: {
  ambientOcclusionMap: WaxScalarMap;
  canvas: HTMLCanvasElement;
  heightMap: WaxHeightMap;
  mode: WaxDebugRenderMode;
  normalMap: WaxNormalMap;
  roughnessMap: WaxScalarMap;
  sealMask: WaxMask;
}) {
  if (mode === "alpha") {
    renderMask(canvas, sealMask);
    return;
  }

  if (mode === "edge") {
    renderEdge(canvas, heightMap);
    return;
  }

  if (mode === "sdf") {
    renderSdf(canvas, heightMap);
    return;
  }

  if (mode === "height") {
    renderHeight(canvas, heightMap);
    return;
  }

  if (mode === "normal") {
    renderNormals(canvas, normalMap, heightMap);
    return;
  }

  if (mode === "ao") {
    renderScalar(canvas, ambientOcclusionMap, heightMap);
    return;
  }

  renderScalar(canvas, roughnessMap, heightMap);
}
