import type { Glyph, GlyphDecoration, GlyphStroke } from "../types/fontTypes";

export type GlyphDrawOptions = {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha?: number;
  widthScale?: number;
};

export function hasDrawnGlyph(glyph: Glyph | undefined) {
  return Boolean(
    glyph?.decorations?.length ||
      glyph?.strokes?.some(
        (stroke) => stroke.points.length > 1 || stroke.points.some((point) => (point.ink ?? 0) > 0.05),
      ),
  );
}

export function findPreviewGlyph(
  glyphs: Record<string, Glyph>,
  character: string,
): Glyph | undefined {
  const exactGlyph = glyphs[character];

  if (hasDrawnGlyph(exactGlyph)) {
    return exactGlyph;
  }

  const caseFallback = character === character.toLowerCase()
    ? character.toUpperCase()
    : character.toLowerCase();

  if (caseFallback !== character) {
    const fallbackGlyph = glyphs[caseFallback];

    if (hasDrawnGlyph(fallbackGlyph)) {
      return fallbackGlyph;
    }
  }

  return undefined;
}

export function getGlyphAdvance(glyph: Glyph, fontSize: number) {
  const bearingAdvance = glyph.leftBearing + glyph.width + glyph.rightBearing;
  return Math.max(fontSize * 0.18, fontSize * glyph.xAdvance, fontSize * bearingAdvance);
}

function clampInk(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getPointPressure(point: GlyphStroke["points"][number]) {
  return Math.min(1.25, Math.max(0.45, point.pressure ?? 0.64));
}

function getLineWidth(baseWidth: number, point: GlyphStroke["points"][number]) {
  const pressure = getPointPressure(point);
  const ink = clampInk(point.ink ?? 0);

  return baseWidth * (0.78 + pressure * 0.34 + ink * 0.16);
}

function drawInkPool(
  ctx: CanvasRenderingContext2D,
  point: GlyphStroke["points"][number],
  x: number,
  y: number,
  baseWidth: number,
  sizeX: number,
  sizeY: number,
  minimumInk = 0,
) {
  const ink = Math.max(minimumInk, clampInk(point.ink ?? 0));

  if (ink <= 0.04) {
    return;
  }

  const px = x + point.x * sizeX;
  const py = y + point.y * sizeY;
  const radius = baseWidth * (0.82 + ink * 2.55);
  const stretchX = sizeX / Math.max(1, sizeY);
  const previousAlpha = ctx.globalAlpha;

  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.globalAlpha = previousAlpha * Math.min(0.72, 0.18 + ink * 0.5);
  ctx.beginPath();
  ctx.ellipse(px, py, radius * stretchX, radius, 0, 0, Math.PI * 2);
  ctx.fill();

  if (ink > 0.34) {
    const wobble = Math.sin((point.x * 127.1 + point.y * 311.7) * Math.PI) * radius * 0.18;

    ctx.globalAlpha = previousAlpha * Math.min(0.48, 0.1 + ink * 0.28);
    ctx.beginPath();
    ctx.ellipse(
      px + wobble * stretchX,
      py - wobble,
      radius * 0.58 * stretchX,
      radius * 0.42,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  ctx.restore();
}

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: GlyphStroke,
  x: number,
  y: number,
  size: number,
  sizeX = size,
  sizeY = size,
  fallbackColor?: string,
) {
  if (stroke.points.length === 0) {
    return;
  }

  ctx.save();
  ctx.strokeStyle = stroke.color ?? fallbackColor ?? ctx.strokeStyle;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const baseWidth = Math.max(1.5, stroke.size * size);

  const [firstPoint, ...rest] = stroke.points;

  if (rest.length === 0) {
    drawInkPool(ctx, firstPoint, x, y, baseWidth, sizeX, sizeY, 0.22);
    ctx.restore();
    return;
  }

  let previousPoint = firstPoint;

  for (const point of rest) {
    ctx.beginPath();
    ctx.lineWidth = (getLineWidth(baseWidth, previousPoint) + getLineWidth(baseWidth, point)) / 2;
    ctx.moveTo(x + previousPoint.x * sizeX, y + previousPoint.y * sizeY);
    ctx.lineTo(x + point.x * sizeX, y + point.y * sizeY);
    ctx.stroke();
    previousPoint = point;
  }

  for (const point of stroke.points) {
    drawInkPool(ctx, point, x, y, baseWidth, sizeX, sizeY);
  }

  ctx.restore();
}

function getStickerSeed(id: string, salt: number) {
  let seed = salt;

  for (let index = 0; index < id.length; index += 1) {
    seed = (seed * 31 + id.charCodeAt(index)) % 997;
  }

  return seed / 997;
}

export function drawGlyphDecoration(
  ctx: CanvasRenderingContext2D,
  decoration: GlyphDecoration,
  x: number,
  y: number,
  size: number,
  sizeX = size,
  sizeY = size,
) {
  if (decoration.kind !== "googly-eyes") {
    return;
  }

  const centerX = x + decoration.x * sizeX;
  const centerY = y + decoration.y * sizeY;
  const expression = decoration.expression ?? "googly";
  const radius = Math.max(1.6, decoration.size * sizeY);
  const eyeOffset = radius * 1.18;
  const outlineWidth = Math.max(0.9, radius * 0.13);
  const lidColor = expression === "stoned" ? "rgba(210, 77, 66, 0.22)" : "rgba(239, 216, 180, 0.72)";

  ctx.save();
  ctx.lineWidth = outlineWidth;
  ctx.strokeStyle = expression === "stoned" ? "#5d1d20" : "#17110b";
  ctx.fillStyle = expression === "stoned" ? "#fff2e9" : "#fffdf4";
  ctx.lineJoin = "round";

  for (const eyeIndex of [0, 1]) {
    const eyeX = centerX + (eyeIndex === 0 ? -eyeOffset : eyeOffset);
    const randomX = (getStickerSeed(decoration.id, eyeIndex + 3) - 0.5) * radius * 0.48;
    const randomY = (getStickerSeed(decoration.id, eyeIndex + 11) - 0.5) * radius * 0.48;
    const inwardLook = eyeIndex === 0 ? radius * 0.2 : -radius * 0.2;
    const pupilX = expression === "googly" || expression === "stoned"
      ? randomX
      : expression === "angry"
        ? inwardLook
        : 0;
    const pupilY = expression === "happy"
      ? -radius * 0.08
      : expression === "tired" || expression === "stoned"
        ? radius * 0.22
        : expression === "angry"
          ? -radius * 0.03
          : randomY;

    ctx.beginPath();
    ctx.arc(eyeX, centerY, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (expression === "stoned") {
      ctx.save();
      ctx.strokeStyle = "rgba(203, 50, 43, 0.62)";
      ctx.lineWidth = Math.max(0.7, radius * 0.08);
      for (const veinIndex of [0, 1, 2]) {
        const side = veinIndex % 2 === 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(eyeX + side * radius * 0.78, centerY - radius * (0.28 - veinIndex * 0.14));
        ctx.quadraticCurveTo(
          eyeX + side * radius * 0.28,
          centerY - radius * (0.16 - veinIndex * 0.08),
          eyeX + side * radius * 0.06,
          centerY - radius * (0.02 - veinIndex * 0.06),
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    ctx.fillStyle = expression === "stoned" ? "#241816" : "#17110b";
    ctx.beginPath();
    ctx.arc(eyeX + pupilX, centerY + pupilY, radius * (expression === "stoned" ? 0.46 : 0.38), 0, Math.PI * 2);
    ctx.fill();

    if (expression === "tired" || expression === "stoned") {
      ctx.fillStyle = lidColor;
      ctx.beginPath();
      ctx.arc(eyeX, centerY, radius * 0.98, Math.PI, 0);
      ctx.lineTo(eyeX + radius, centerY - radius * (expression === "stoned" ? 0.02 : 0.16));
      ctx.quadraticCurveTo(eyeX, centerY + radius * 0.16, eyeX - radius, centerY - radius * 0.08);
      ctx.closePath();
      ctx.fill();

      ctx.strokeStyle = expression === "stoned" ? "#7d272a" : "#17110b";
      ctx.lineWidth = Math.max(0.8, outlineWidth * 0.72);
      ctx.beginPath();
      ctx.moveTo(eyeX - radius * 0.78, centerY - radius * 0.02);
      ctx.quadraticCurveTo(eyeX, centerY + radius * 0.18, eyeX + radius * 0.78, centerY - radius * 0.02);
      ctx.stroke();
    }

    if (expression === "happy") {
      ctx.strokeStyle = "#17110b";
      ctx.lineWidth = Math.max(0.9, outlineWidth * 0.82);
      ctx.beginPath();
      ctx.arc(eyeX, centerY + radius * 0.16, radius * 0.62, 0.18 * Math.PI, 0.82 * Math.PI);
      ctx.stroke();
    }

    ctx.fillStyle = expression === "stoned" ? "#fff2e9" : "#fffdf4";
  }

  if (expression === "angry") {
    ctx.strokeStyle = "#17110b";
    ctx.lineWidth = Math.max(1.2, radius * 0.18);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(centerX - eyeOffset - radius * 0.84, centerY - radius * 1.42);
    ctx.lineTo(centerX - eyeOffset + radius * 0.82, centerY - radius * 0.88);
    ctx.moveTo(centerX + eyeOffset - radius * 0.82, centerY - radius * 0.88);
    ctx.lineTo(centerX + eyeOffset + radius * 0.84, centerY - radius * 1.42);
    ctx.stroke();
  }

  if (expression === "happy") {
    ctx.strokeStyle = "#17110b";
    ctx.lineWidth = Math.max(0.9, radius * 0.1);
    ctx.beginPath();
    ctx.arc(centerX, centerY + radius * 1.44, radius * 0.92, 0.12 * Math.PI, 0.88 * Math.PI);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawGlyph(
  ctx: CanvasRenderingContext2D,
  glyph: Glyph,
  { x, y, size, color, alpha = 1, widthScale = glyph.width }: GlyphDrawOptions,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;

  for (const stroke of glyph.strokes) {
    drawStrokePath(ctx, stroke, x, y, size, size * widthScale, size, color);
  }

  for (const decoration of glyph.decorations ?? []) {
    drawGlyphDecoration(ctx, decoration, x, y, size, size * widthScale, size);
  }

  ctx.restore();
}
