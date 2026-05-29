import type { Glyph, GlyphStroke } from "../types/fontTypes";

export type GlyphDrawOptions = {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha?: number;
  widthScale?: number;
};

export function hasDrawnGlyph(glyph: Glyph | undefined) {
  return Boolean(glyph?.strokes?.some((stroke) => stroke.points.length > 1));
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

export function drawStrokePath(
  ctx: CanvasRenderingContext2D,
  stroke: GlyphStroke,
  x: number,
  y: number,
  size: number,
  sizeX = size,
  sizeY = size,
) {
  if (stroke.points.length === 0) {
    return;
  }

  ctx.beginPath();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(1.5, stroke.size * size);

  const [firstPoint, ...rest] = stroke.points;
  ctx.moveTo(x + firstPoint.x * sizeX, y + firstPoint.y * sizeY);

  for (const point of rest) {
    ctx.lineTo(x + point.x * sizeX, y + point.y * sizeY);
  }

  ctx.stroke();
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
    drawStrokePath(ctx, stroke, x, y, size, size * widthScale, size);
  }

  ctx.restore();
}
