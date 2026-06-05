import { clamp, fbm2D, smoothstep } from "./noise";
import type { ResolvedWaxSealRenderOptions, WaxMask, WaxSealPoint, WaxSealStroke } from "./waxTypes";

function createMaskCanvas(size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function readCanvasAlpha(canvas: HTMLCanvasElement): WaxMask {
  const context = canvas.getContext("2d");
  const size = canvas.width;
  const alpha = new Float32Array(size * size);

  if (!context) {
    return { alpha, size };
  }

  const pixels = context.getImageData(0, 0, size, size).data;
  for (let index = 0; index < alpha.length; index += 1) {
    alpha[index] = pixels[index * 4 + 3] / 255;
  }

  return { alpha, size };
}

function drawShapeMask(context: CanvasRenderingContext2D, shape: Path2D | string | ImageData, size: number) {
  context.save();
  context.fillStyle = "#fff";

  if (shape instanceof ImageData) {
    const imageCanvas = createMaskCanvas(shape.width);
    const imageContext = imageCanvas.getContext("2d");
    if (imageContext) {
      imageContext.putImageData(shape, 0, 0);
      context.drawImage(imageCanvas, 0, 0, size, size);
    }
  } else {
    const path = typeof shape === "string" ? new Path2D(shape) : shape;
    context.translate(size / 2, size / 2);
    context.scale(size, size);
    context.fill(path);
  }

  context.restore();
}

export function generateSealMask(options: ResolvedWaxSealRenderOptions): WaxMask {
  const size = options.renderSize;

  if (options.sealShape) {
    const canvas = createMaskCanvas(size);
    const context = canvas.getContext("2d");
    if (!context) {
      return { alpha: new Float32Array(size * size), size };
    }

    drawShapeMask(context, options.sealShape, size);
    return readCanvasAlpha(canvas);
  }

  const alpha = new Float32Array(size * size);
  const center = (size - 1) / 2;
  const irregularity = clamp(options.edgeIrregularity);
  const radiusBase = 0.72;

  for (let y = 0; y < size; y += 1) {
    const ny = (y - center) / center;

    for (let x = 0; x < size; x += 1) {
      const nx = (x - center) / center;
      const angle = Math.atan2(ny * 1.06, nx);
      const unitX = Math.cos(angle);
      const unitY = Math.sin(angle);
      const radial = Math.hypot(nx, ny * 1.06);
      const lowerPool = smoothstep(0.08, 0.95, unitY) * 0.03;
      const angularLobes =
        Math.sin(angle * 3 + options.seed * 0.071) * 0.018 +
        Math.cos(angle * 5 - options.seed * 0.047) * 0.012;
      const lobeNoise =
        angularLobes +
        fbm2D(unitX * 1.25 + 3.1, unitY * 1.25 - 1.7, options.seed + 17, 4) * 0.115 +
        fbm2D(unitX * 3.2 - 0.4, unitY * 3.2 + 2.8, options.seed + 41, 3) * 0.038 +
        fbm2D(unitX * 8.0, unitY * 8.0, options.seed + 89, 2) * 0.006;
      const radius = radiusBase + (lobeNoise + lowerPool) * irregularity;
      const edgeWidth = 0.018 + irregularity * 0.01;
      const mask = 1 - smoothstep(radius - edgeWidth, radius + edgeWidth, radial);
      alpha[y * size + x] = clamp(mask);
    }
  }

  return { alpha, size };
}

function drawSmoothStrokePath(context: CanvasRenderingContext2D, points: WaxSealPoint[], size: number, markScale: number) {
  if (points.length < 2) {
    return;
  }

  const center = size / 2;
  const drawRadius = size * 0.84 * markScale;
  const toCanvasPoint = (point: WaxSealPoint) => ({
    x: center + (point.x - 0.5) * drawRadius,
    y: center + (point.y - 0.5) * drawRadius,
  });
  const first = toCanvasPoint(points[0]);

  context.moveTo(first.x, first.y);

  if (points.length === 2) {
    const second = toCanvasPoint(points[1]);
    context.lineTo(second.x, second.y);
    return;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = toCanvasPoint(points[index]);
    const next = toCanvasPoint(points[index + 1]);
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }

  const last = toCanvasPoint(points[points.length - 1]);
  context.lineTo(last.x, last.y);
}

function drawStrokeMask(
  context: CanvasRenderingContext2D,
  strokes: WaxSealStroke[],
  size: number,
  markScale: number,
  markWeight: number,
) {
  const lineWidth = size * (0.026 + markWeight * 0.038);

  context.save();
  context.strokeStyle = "#fff";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = lineWidth;

  strokes.forEach((stroke) => {
    if (stroke.points.length < 2) {
      return;
    }

    context.beginPath();
    drawSmoothStrokePath(context, stroke.points, size, markScale);
    context.stroke();
  });

  context.restore();
}

function drawTextMask(
  context: CanvasRenderingContext2D,
  text: string,
  size: number,
  markScale: number,
  markWeight: number,
  fontFamily: string,
) {
  const safeText = text.trim().slice(0, 8);

  if (!safeText) {
    return;
  }

  context.save();
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.font = `900 ${Math.round(size * 0.28 * markScale)}px ${fontFamily}`;
  context.translate(size / 2, size / 2 + size * 0.012);
  context.scale(1.1, 0.92);
  context.fillText(safeText, 0, 0, size * 0.58);

  if (markWeight > 0.36) {
    context.strokeStyle = "#fff";
    context.lineWidth = size * 0.006 * markWeight;
    context.strokeText(safeText, 0, 0, size * 0.58);
  }

  context.restore();
}

export function generateStampMask(options: ResolvedWaxSealRenderOptions): WaxMask {
  const size = options.renderSize;
  const canvas = createMaskCanvas(size);
  const context = canvas.getContext("2d");

  if (!context || options.mode === "blank") {
    return { alpha: new Float32Array(size * size), size };
  }

  if (options.stampShape) {
    drawShapeMask(context, options.stampShape, size);
  }

  drawTextMask(context, options.stampText, size, options.markScale, options.markWeight, options.stampFontFamily);
  drawStrokeMask(context, options.stampStrokes, size, options.markScale, options.markWeight);

  const stampMask = readCanvasAlpha(canvas);
  const center = (size - 1) / 2;

  for (let y = 0; y < size; y += 1) {
    const ny = (y - center) / center;
    for (let x = 0; x < size; x += 1) {
      const nx = (x - center) / center;
      const radius = Math.hypot(nx, ny);
      stampMask.alpha[y * size + x] *= 1 - smoothstep(0.54, 0.6, radius);
    }
  }

  return stampMask;
}
