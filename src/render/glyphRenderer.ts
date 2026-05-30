import type {
  FontRenderProfile,
  Glyph,
  GlyphDecoration,
  GlyphInkEffect,
  GlyphStroke,
  GlyphStrokeTool,
} from "../types/fontTypes";

export type GlyphDrawOptions = {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha?: number;
  renderProfile?: FontRenderProfile;
  widthScale?: number;
};

type StrokeDrawOptions = {
  renderProfile?: FontRenderProfile;
  skipInkEffect?: boolean;
};

export function hasDrawnGlyph(glyph: Glyph | undefined) {
  return Boolean(
    glyph?.decorations?.length ||
      glyph?.strokes?.some((stroke) => stroke.points.length > 0),
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

export function getSpacebarAdvance(glyph: Glyph | undefined, fontSize: number) {
  return Math.max(fontSize * 0.18, fontSize * (glyph?.xAdvance ?? 0.36));
}

function getPointPressure(point: GlyphStroke["points"][number]) {
  return Math.min(1.25, Math.max(0.45, point.pressure ?? 0.64));
}

function getLineWidth(baseWidth: number, point: GlyphStroke["points"][number]) {
  const pressure = getPointPressure(point);

  return baseWidth * (0.82 + pressure * 0.34);
}

function getEffectiveStrokeTool(stroke: GlyphStroke, renderProfile: FontRenderProfile = "plain"): GlyphStrokeTool {
  return stroke.strokeTool ?? (renderProfile === "quillParchment" ? "quill" : "pen");
}

function getEffectiveInkEffect(stroke: GlyphStroke): GlyphInkEffect {
  return stroke.inkEffect ?? "none";
}

const QUILL_NIB_ANGLE = (38 * Math.PI) / 180;

function getSeed(value: string, salt: number) {
  let seed = salt;

  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 33 + value.charCodeAt(index)) % 104729;
  }

  return seed / 104729;
}

function getQuillSegmentWidth(
  baseWidth: number,
  strokeId: string,
  start: GlyphStroke["points"][number],
  end: GlyphStroke["points"][number],
  segmentIndex: number,
  segmentCount: number,
  salt: number,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const directionContrast = Math.abs(Math.sin(angle - QUILL_NIB_ANGLE));
  const pressure = (getPointPressure(start) + getPointPressure(end)) / 2;
  const taperProgress = segmentCount <= 1 ? 1 : segmentIndex / (segmentCount - 1);
  const endTaper = Math.min(1, Math.max(0.42, Math.sin(Math.PI * Math.max(0.08, Math.min(0.92, taperProgress))) * 1.18));
  const grain = 0.88 + getSeed(strokeId, segmentIndex + salt) * 0.28;

  return baseWidth * (0.44 + directionContrast * 1.35) * pressure * endTaper * grain;
}

function getCanvasPoint(
  point: GlyphStroke["points"][number],
  x: number,
  y: number,
  sizeX: number,
  sizeY: number,
) {
  return {
    x: x + point.x * sizeX,
    y: y + point.y * sizeY,
  };
}

function getMidpoint(
  first: GlyphStroke["points"][number],
  second: GlyphStroke["points"][number],
) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function drawCurveSegment(
  ctx: CanvasRenderingContext2D,
  start: GlyphStroke["points"][number],
  control: GlyphStroke["points"][number],
  end: GlyphStroke["points"][number],
  x: number,
  y: number,
  sizeX: number,
  sizeY: number,
) {
  const startPoint = getCanvasPoint(start, x, y, sizeX, sizeY);
  const controlPoint = getCanvasPoint(control, x, y, sizeX, sizeY);
  const endPoint = getCanvasPoint(end, x, y, sizeX, sizeY);

  ctx.beginPath();
  ctx.moveTo(startPoint.x, startPoint.y);
  ctx.quadraticCurveTo(controlPoint.x, controlPoint.y, endPoint.x, endPoint.y);
  ctx.stroke();
}

function drawPointDot(
  ctx: CanvasRenderingContext2D,
  point: GlyphStroke["points"][number],
  x: number,
  y: number,
  baseWidth: number,
  sizeX: number,
  sizeY: number,
) {
  const px = x + point.x * sizeX;
  const py = y + point.y * sizeY;
  const radius = getLineWidth(baseWidth, point) / 2;
  const stretchX = sizeX / Math.max(1, sizeY);

  ctx.save();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.ellipse(px, py, radius * stretchX, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawQuillPointMark(
  ctx: CanvasRenderingContext2D,
  stroke: GlyphStroke,
  point: GlyphStroke["points"][number],
  x: number,
  y: number,
  baseWidth: number,
  sizeX: number,
  sizeY: number,
) {
  const { x: px, y: py } = getCanvasPoint(point, x, y, sizeX, sizeY);
  const grain = 0.92 + getSeed(stroke.id, 17) * 0.22;
  const radius = getLineWidth(baseWidth, point) * grain;

  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(QUILL_NIB_ANGLE);
  ctx.fillStyle = ctx.strokeStyle;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius * 0.66, radius * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawQuillTexture(
  ctx: CanvasRenderingContext2D,
  strokeId: string,
  start: GlyphStroke["points"][number],
  end: GlyphStroke["points"][number],
  x: number,
  y: number,
  sizeX: number,
  sizeY: number,
  width: number,
  segmentIndex: number,
) {
  const drawMark = getSeed(strokeId, segmentIndex + 401) > 0.36;

  if (!drawMark) {
    return;
  }

  const startPoint = getCanvasPoint(start, x, y, sizeX, sizeY);
  const endPoint = getCanvasPoint(end, x, y, sizeX, sizeY);
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const length = Math.hypot(dx, dy);

  if (length < 0.01) {
    return;
  }

  const side = getSeed(strokeId, segmentIndex + 509) > 0.5 ? 1 : -1;
  const offset = side * width * (0.28 + getSeed(strokeId, segmentIndex + 613) * 0.24);
  const nx = (-dy / length) * offset;
  const ny = (dx / length) * offset;
  const inset = 0.16 + getSeed(strokeId, segmentIndex + 727) * 0.22;

  ctx.save();
  ctx.globalAlpha *= 0.3;
  ctx.lineWidth = Math.max(0.6, width * 0.16);
  ctx.beginPath();
  ctx.moveTo(startPoint.x + dx * inset + nx, startPoint.y + dy * inset + ny);
  ctx.lineTo(endPoint.x - dx * inset + nx, endPoint.y - dy * inset + ny);
  ctx.stroke();
  ctx.restore();
}

function drawQuillStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: GlyphStroke,
  x: number,
  y: number,
  size: number,
  sizeX = size,
  sizeY = size,
) {
  const baseWidth = Math.max(1.2, stroke.size * size * 0.95);
  const [firstPoint, ...rest] = stroke.points;

  if (rest.length === 0) {
    drawQuillPointMark(ctx, stroke, firstPoint, x, y, baseWidth, sizeX, sizeY);
    return;
  }

  const points = stroke.points;
  const segmentCount = points.length - 1;

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (let index = 1; index < points.length; index += 1) {
    const previousPreviousPoint = points[index - 2];
    const previousPoint = points[index - 1];
    const point = points[index];
    const startPoint = previousPreviousPoint ? getMidpoint(previousPreviousPoint, previousPoint) : previousPoint;
    const endPoint = index < points.length - 1 ? getMidpoint(previousPoint, point) : point;
    const segmentWidth = getQuillSegmentWidth(baseWidth, stroke.id, previousPoint, point, index - 1, segmentCount, 73);

    ctx.lineWidth = segmentWidth;
    drawCurveSegment(ctx, startPoint, previousPoint, endPoint, x, y, sizeX, sizeY);
    drawQuillTexture(ctx, stroke.id, startPoint, endPoint, x, y, sizeX, sizeY, segmentWidth, index);
  }
}

function getDarkerInkColor(color: string) {
  const hex = color.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(hex);
  const longHex = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!shortHex && !longHex) {
    return "rgba(24, 11, 4, 0.72)";
  }

  const value = shortHex
    ? shortHex[1].split("").map((character) => `${character}${character}`).join("")
    : longHex?.[1] ?? "180b04";
  const red = Math.max(0, Math.round(Number.parseInt(value.slice(0, 2), 16) * 0.42));
  const green = Math.max(0, Math.round(Number.parseInt(value.slice(2, 4), 16) * 0.36));
  const blue = Math.max(0, Math.round(Number.parseInt(value.slice(4, 6), 16) * 0.3));

  return `rgb(${red}, ${green}, ${blue})`;
}

function drawDramaticInkEffect(
  ctx: CanvasRenderingContext2D,
  stroke: GlyphStroke,
  strokeColor: string,
  x: number,
  y: number,
  size: number,
  sizeX = size,
  sizeY = size,
) {
  const points = stroke.points;

  if (points.length === 0) {
    return;
  }

  const baseWidth = Math.max(1.2, stroke.size * size);
  const darkColor = getDarkerInkColor(strokeColor);
  const markCount = Math.min(28, points.length);
  const step = Math.max(1, Math.floor(points.length / markCount));

  ctx.save();
  ctx.fillStyle = darkColor;
  ctx.strokeStyle = darkColor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const pointIndex of [0, points.length - 1]) {
    const point = points[pointIndex];
    const canvasPoint = getCanvasPoint(point, x, y, sizeX, sizeY);
    const seed = getSeed(stroke.id, pointIndex + 1201);
    const radius = baseWidth * (0.46 + seed * 0.36);

    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.ellipse(canvasPoint.x, canvasPoint.y, radius * 0.92, radius * 0.42, QUILL_NIB_ANGLE, 0, Math.PI * 2);
    ctx.fill();
  }

  for (let index = step; index < points.length - step; index += step) {
    const previousPoint = points[index - step];
    const point = points[index];
    const nextPoint = points[Math.min(points.length - 1, index + step)];
    const turn = Math.abs(
      Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) -
        Math.atan2(point.y - previousPoint.y, point.x - previousPoint.x),
    );
    const seed = getSeed(stroke.id, index + 1409);
    const pressure = getPointPressure(point);
    const radius = baseWidth * (0.24 + Math.min(Math.PI, turn) * 0.1 + seed * 0.22) * pressure;
    const canvasPoint = getCanvasPoint(point, x, y, sizeX, sizeY);

    if (radius < 0.8) {
      continue;
    }

    ctx.globalAlpha = 0.08 + Math.min(0.2, turn * 0.08);
    ctx.beginPath();
    ctx.ellipse(
      canvasPoint.x,
      canvasPoint.y,
      radius * (0.82 + seed * 0.56),
      radius * (0.28 + seed * 0.18),
      QUILL_NIB_ANGLE + seed * 0.5,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    if (seed > 0.5) {
      const featherLength = radius * (1.8 + seed * 1.2);
      const angle = QUILL_NIB_ANGLE + (seed - 0.5) * 1.1;

      ctx.globalAlpha = 0.12;
      ctx.lineWidth = Math.max(0.55, radius * 0.16);
      ctx.beginPath();
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
      ctx.lineTo(canvasPoint.x + Math.cos(angle) * featherLength, canvasPoint.y + Math.sin(angle) * featherLength);
      ctx.stroke();
    }
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
  options: StrokeDrawOptions = {},
) {
  if (stroke.points.length === 0) {
    return;
  }

  ctx.save();
  const strokeColor = String(stroke.color ?? fallbackColor ?? ctx.strokeStyle);
  const strokeTool = getEffectiveStrokeTool(stroke, options.renderProfile);
  const inkEffect = getEffectiveInkEffect(stroke);
  ctx.strokeStyle = strokeColor;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const baseWidth = Math.max(1.5, stroke.size * size);

  if (strokeTool === "quill") {
    drawQuillStrokePath(ctx, stroke, x, y, size, sizeX, sizeY);
    if (!options.skipInkEffect && inkEffect === "dramaticPooling") {
      drawDramaticInkEffect(ctx, stroke, strokeColor, x, y, size, sizeX, sizeY);
    }
    ctx.restore();
    return;
  }

  const [firstPoint, ...rest] = stroke.points;

  if (rest.length === 0) {
    drawPointDot(ctx, firstPoint, x, y, baseWidth, sizeX, sizeY);
    if (!options.skipInkEffect && inkEffect === "dramaticPooling") {
      drawDramaticInkEffect(ctx, stroke, strokeColor, x, y, size, sizeX, sizeY);
    }
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

  if (!options.skipInkEffect && inkEffect === "dramaticPooling") {
    drawDramaticInkEffect(ctx, stroke, strokeColor, x, y, size, sizeX, sizeY);
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
  { x, y, size, color, alpha = 1, renderProfile = "plain", widthScale = glyph.width }: GlyphDrawOptions,
) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;

  for (const stroke of glyph.strokes) {
    drawStrokePath(ctx, stroke, x, y, size, size * widthScale, size, color, { renderProfile });
  }

  for (const decoration of glyph.decorations ?? []) {
    drawGlyphDecoration(ctx, decoration, x, y, size, size * widthScale, size);
  }

  ctx.restore();
}
