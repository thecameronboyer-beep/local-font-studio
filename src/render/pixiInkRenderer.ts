import { Container, Graphics } from "pixi.js";
import type { BackgroundTexture, FontRenderProfile, GlyphStroke, GlyphStrokeTool } from "../types/fontTypes";

type PixiInkRenderSize = {
  height: number;
  scale: number;
  width: number;
};

type PixiInkRenderOptions = {
  backgroundTexture?: BackgroundTexture;
  fallbackColor: string;
  renderProfile?: FontRenderProfile;
  renderSize: PixiInkRenderSize;
  selectedStrokeId: string | null;
};

const QUILL_NIB_ANGLE = (38 * Math.PI) / 180;

export function hasPixiInkEffect(stroke: GlyphStroke) {
  return stroke.inkEffect === "subtleSpread" ||
    stroke.inkEffect === "dramaticPooling" ||
    stroke.points.some((point) => (point.spread ?? 0) > 0);
}

export function renderPixiInkLayer(
  container: Container,
  strokes: GlyphStroke[],
  options: PixiInkRenderOptions,
) {
  clearContainer(container);

  const inkStrokes = strokes.filter(hasPixiInkEffect);

  if (inkStrokes.length === 0) {
    return;
  }

  const spreadLayer = new Container();
  const bodyLayer = new Container();
  const selectionLayer = new Container();

  container.addChild(spreadLayer);
  container.addChild(bodyLayer);
  container.addChild(selectionLayer);

  for (const stroke of inkStrokes) {
    drawSpreadMarks(spreadLayer, stroke, options);
  }

  for (const stroke of inkStrokes) {
    drawStrokeBody(bodyLayer, stroke, options);
  }

  if (options.selectedStrokeId) {
    const selectedStroke = inkStrokes.find((stroke) => stroke.id === options.selectedStrokeId);

    if (selectedStroke) {
      drawStrokeSelection(selectionLayer, selectedStroke, options);
    }
  }
}

function clearContainer(container: Container) {
  const children = container.removeChildren();

  for (const child of children) {
    child.destroy({ children: true });
  }
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

function getTextureSpreadMultiplier(backgroundTexture: BackgroundTexture | undefined) {
  if (backgroundTexture === "clean") {
    return 0.68;
  }

  if (backgroundTexture === "fiber") {
    return 1.16;
  }

  if (backgroundTexture === "canvas") {
    return 1.28;
  }

  if (backgroundTexture === "woven") {
    return 1.12;
  }

  return 0.96;
}

function getSeed(value: string, salt: number) {
  let seed = salt;

  for (let index = 0; index < value.length; index += 1) {
    seed = (seed * 33 + value.charCodeAt(index)) % 104729;
  }

  return seed / 104729;
}

function getMidpoint(
  first: GlyphStroke["points"][number],
  second: GlyphStroke["points"][number],
) {
  return {
    ...second,
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function getCanvasPoint(
  point: GlyphStroke["points"][number],
  renderSize: PixiInkRenderSize,
) {
  return {
    x: point.x * renderSize.width,
    y: point.y * renderSize.height,
  };
}

function getHexColor(color: string | undefined, fallbackColor: string) {
  const parsed = parseHexColor(color ?? fallbackColor);

  return parsed ?? parseHexColor(fallbackColor) ?? 0x19140f;
}

function parseHexColor(color: string) {
  const hex = color.trim();
  const shortHex = /^#([0-9a-f]{3})$/i.exec(hex);
  const longHex = /^#([0-9a-f]{6})$/i.exec(hex);

  if (!shortHex && !longHex) {
    return null;
  }

  const value = shortHex
    ? shortHex[1].split("").map((character) => `${character}${character}`).join("")
    : longHex?.[1];

  return value ? Number.parseInt(value, 16) : null;
}

function getQuillSegmentWidth(
  baseWidth: number,
  strokeId: string,
  start: GlyphStroke["points"][number],
  end: GlyphStroke["points"][number],
  segmentIndex: number,
  segmentCount: number,
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const angle = Math.atan2(dy, dx);
  const directionContrast = Math.abs(Math.sin(angle - QUILL_NIB_ANGLE));
  const pressure = (getPointPressure(start) + getPointPressure(end)) / 2;
  const taperProgress = segmentCount <= 1 ? 1 : segmentIndex / (segmentCount - 1);
  const endTaper = Math.min(1, Math.max(0.42, Math.sin(Math.PI * Math.max(0.08, Math.min(0.92, taperProgress))) * 1.18));
  const grain = 0.9 + getSeed(strokeId, segmentIndex + 73) * 0.22;

  return baseWidth * (0.44 + directionContrast * 1.35) * pressure * endTaper * grain;
}

function drawCurveSegment(
  graphics: Graphics,
  start: GlyphStroke["points"][number],
  control: GlyphStroke["points"][number],
  end: GlyphStroke["points"][number],
  renderSize: PixiInkRenderSize,
) {
  const startPoint = getCanvasPoint(start, renderSize);
  const controlPoint = getCanvasPoint(control, renderSize);
  const endPoint = getCanvasPoint(end, renderSize);

  graphics.moveTo(startPoint.x, startPoint.y);
  graphics.quadraticCurveTo(controlPoint.x, controlPoint.y, endPoint.x, endPoint.y);
}

function drawSmoothPath(
  graphics: Graphics,
  points: GlyphStroke["points"],
  renderSize: PixiInkRenderSize,
) {
  if (points.length === 0) {
    return;
  }

  const firstPoint = getCanvasPoint(points[0], renderSize);
  graphics.moveTo(firstPoint.x, firstPoint.y);

  if (points.length === 1) {
    graphics.drawCircle(firstPoint.x, firstPoint.y, 1);
    return;
  }

  for (let index = 1; index < points.length; index += 1) {
    const previousPreviousPoint = points[index - 2];
    const previousPoint = points[index - 1];
    const point = points[index];
    const startPoint = previousPreviousPoint ? getMidpoint(previousPreviousPoint, previousPoint) : previousPoint;
    const endPoint = index < points.length - 1 ? getMidpoint(previousPoint, point) : point;

    drawCurveSegment(graphics, startPoint, previousPoint, endPoint, renderSize);
  }
}

function drawStrokeBody(container: Container, stroke: GlyphStroke, options: PixiInkRenderOptions) {
  if (stroke.points.length === 0) {
    return;
  }

  const color = getHexColor(stroke.color, options.fallbackColor);
  const baseWidth = Math.max(1.5, stroke.size * options.renderSize.scale);
  const strokeTool = getEffectiveStrokeTool(stroke, options.renderProfile);
  const graphics = new Graphics();

  if (stroke.points.length === 1) {
    const point = getCanvasPoint(stroke.points[0], options.renderSize);
    const radius = getLineWidth(baseWidth, stroke.points[0]) / 2;

    graphics.beginFill(color, 0.98);
    graphics.drawCircle(point.x, point.y, radius);
    graphics.endFill();
    container.addChild(graphics);
    return;
  }

  if (strokeTool === "quill") {
    const segmentCount = stroke.points.length - 1;

    for (let index = 1; index < stroke.points.length; index += 1) {
      const previousPreviousPoint = stroke.points[index - 2];
      const previousPoint = stroke.points[index - 1];
      const point = stroke.points[index];
      const startPoint = previousPreviousPoint ? getMidpoint(previousPreviousPoint, previousPoint) : previousPoint;
      const endPoint = index < stroke.points.length - 1 ? getMidpoint(previousPoint, point) : point;
      const width = getQuillSegmentWidth(baseWidth, stroke.id, previousPoint, point, index - 1, segmentCount);

      graphics.lineStyle(width, color, 0.98);
      drawCurveSegment(graphics, startPoint, previousPoint, endPoint, options.renderSize);
    }

    drawQuillDryMarks(graphics, stroke, color, options.renderSize, baseWidth);
    container.addChild(graphics);
    return;
  }

  for (let index = 1; index < stroke.points.length; index += 1) {
    const previousPreviousPoint = stroke.points[index - 2];
    const previousPoint = stroke.points[index - 1];
    const point = stroke.points[index];
    const startPoint = previousPreviousPoint ? getMidpoint(previousPreviousPoint, previousPoint) : previousPoint;
    const endPoint = index < stroke.points.length - 1 ? getMidpoint(previousPoint, point) : point;
    const width = (getLineWidth(baseWidth, previousPoint) + getLineWidth(baseWidth, point)) / 2;

    graphics.lineStyle(width, color, 0.98);
    drawCurveSegment(graphics, startPoint, previousPoint, endPoint, options.renderSize);
  }

  container.addChild(graphics);
}

function drawQuillDryMarks(
  graphics: Graphics,
  stroke: GlyphStroke,
  color: number,
  renderSize: PixiInkRenderSize,
  baseWidth: number,
) {
  const step = Math.max(2, Math.floor(stroke.points.length / 32));

  for (let index = step; index < stroke.points.length; index += step) {
    if (getSeed(stroke.id, index + 401) < 0.44) {
      continue;
    }

    const point = getCanvasPoint(stroke.points[index], renderSize);
    const previousPoint = getCanvasPoint(stroke.points[index - step], renderSize);
    const dx = point.x - previousPoint.x;
    const dy = point.y - previousPoint.y;
    const length = Math.hypot(dx, dy);

    if (length < 0.01) {
      continue;
    }

    const seed = getSeed(stroke.id, index + 509);
    const side = seed > 0.5 ? 1 : -1;
    const width = Math.max(0.55, baseWidth * (0.05 + seed * 0.05));
    const offset = side * baseWidth * (0.18 + seed * 0.24);
    const nx = (-dy / length) * offset;
    const ny = (dx / length) * offset;

    graphics.lineStyle(width, color, 0.18);
    graphics.moveTo(previousPoint.x + dx * 0.24 + nx, previousPoint.y + dy * 0.24 + ny);
    graphics.lineTo(point.x - dx * 0.24 + nx, point.y - dy * 0.24 + ny);
  }
}

function drawSpreadMarks(container: Container, stroke: GlyphStroke, options: PixiInkRenderOptions) {
  if (stroke.points.length === 0) {
    return;
  }

  const color = getHexColor(stroke.color, options.fallbackColor);
  const baseWidth = Math.max(1.5, stroke.size * options.renderSize.scale);
  const dramatic = stroke.inkEffect === "dramaticPooling";
  const marks = new Graphics();
  const capillaries = new Graphics();

  drawOrganicBleeds(marks, capillaries, stroke, color, options, baseWidth, dramatic);

  container.addChild(marks);
  container.addChild(capillaries);
}

function getStrokeVector(
  stroke: GlyphStroke,
  pointIndex: number,
  renderSize: PixiInkRenderSize,
  seed: number,
) {
  const previousPoint = stroke.points[Math.max(0, pointIndex - 1)];
  const nextPoint = stroke.points[Math.min(stroke.points.length - 1, pointIndex + 1)];
  const previousCanvasPoint = getCanvasPoint(previousPoint, renderSize);
  const nextCanvasPoint = getCanvasPoint(nextPoint, renderSize);
  const dx = nextCanvasPoint.x - previousCanvasPoint.x;
  const dy = nextCanvasPoint.y - previousCanvasPoint.y;
  const length = Math.hypot(dx, dy);

  if (length < 0.01) {
    const angle = seed * Math.PI * 2;
    const tx = Math.cos(angle);
    const ty = Math.sin(angle);

    return { nx: -ty, ny: tx, tx, ty };
  }

  const tx = dx / length;
  const ty = dy / length;

  return { nx: -ty, ny: tx, tx, ty };
}

function drawOrganicBleeds(
  marks: Graphics,
  capillaries: Graphics,
  stroke: GlyphStroke,
  color: number,
  options: PixiInkRenderOptions,
  baseWidth: number,
  dramatic: boolean,
) {
  const textureMultiplier = getTextureSpreadMultiplier(options.backgroundTexture);
  const markLimit = dramatic ? 68 : 62;
  const step = Math.max(1, Math.floor(stroke.points.length / Math.min(markLimit, stroke.points.length)));

  for (let index = 0; index < stroke.points.length; index += step) {
    const point = stroke.points[index];
    const localSpread = Math.max(
      point.spread ?? 0,
      (point.ink ?? 0) * 0.84,
      dramatic ? getDramaticPointSpread(stroke, index) : 0,
    );

    if (localSpread <= 0) {
      continue;
    }

    const pressure = getPointPressure(point);
    const seed = getSeed(stroke.id, index + 1801);
    const skip = options.backgroundTexture === "clean" ? 0.14 : options.backgroundTexture === "canvas" ? 0.26 : 0.2;

    if (seed < skip) {
      continue;
    }

    const canvasPoint = getCanvasPoint(point, options.renderSize);
    const vector = getStrokeVector(stroke, index, options.renderSize, seed);
    const side = seed > 0.5 ? 1 : -1;
    const strokeWidth = getLineWidth(baseWidth, point);
    const edgeDistance = strokeWidth * (0.48 + seed * 0.12);
    const bleedLength = baseWidth * textureMultiplier * localSpread * (0.28 + pressure * 0.22 + seed * 0.2);
    const edgeX = canvasPoint.x + vector.nx * side * edgeDistance;
    const edgeY = canvasPoint.y + vector.ny * side * edgeDistance;
    const spreadX = vector.nx * side;
    const spreadY = vector.ny * side;
    const angle = Math.atan2(spreadY, spreadX) + (seed - 0.5) * 0.36;
    const alpha = Math.min(dramatic ? 0.76 : 0.62, 0.38 + localSpread * (dramatic ? 0.28 : 0.22));

    if (bleedLength < 0.55) {
      continue;
    }

    marks.lineStyle(Math.max(0.55, strokeWidth * 0.07), color, Math.min(0.56, alpha * 0.78));
    marks.moveTo(edgeX - vector.tx * bleedLength * 0.1, edgeY - vector.ty * bleedLength * 0.1);
    marks.lineTo(edgeX + spreadX * bleedLength * 0.64, edgeY + spreadY * bleedLength * 0.64);

    drawRotatedEllipse(
      marks,
      edgeX + spreadX * bleedLength * (0.32 + seed * 0.18),
      edgeY + spreadY * bleedLength * (0.32 + seed * 0.18),
      bleedLength * (0.38 + seed * (dramatic ? 0.3 : 0.18)),
      Math.max(0.36, strokeWidth * 0.045 + bleedLength * 0.035),
      angle,
      color,
      alpha,
    );

    if (seed > 0.36) {
      const secondarySeed = getSeed(stroke.id, index + 1927);
      const offset = bleedLength * (secondarySeed - 0.5) * 0.34;

      drawRotatedEllipse(
        marks,
        edgeX + spreadX * bleedLength * (0.52 + secondarySeed * 0.2) + vector.tx * offset,
        edgeY + spreadY * bleedLength * (0.52 + secondarySeed * 0.2) + vector.ty * offset,
        bleedLength * (0.16 + secondarySeed * 0.14),
        Math.max(0.28, strokeWidth * 0.028 + bleedLength * 0.025),
        angle + (secondarySeed - 0.5) * 0.64,
        color,
        Math.min(0.48, alpha * 0.7),
      );
    }

    if (dramatic || seed > 0.56) {
      const hairCount = dramatic ? 3 : 2;

      for (let hair = 0; hair < hairCount; hair += 1) {
        const hairSeed = getSeed(stroke.id, index + 2179 + hair * 37);
        const hairAngle = Math.atan2(spreadY, spreadX) + (hairSeed - 0.5) * 0.9;
        const hairLength = bleedLength * (0.68 + hairSeed * (dramatic ? 1.15 : 0.72));
        const tangentOffset = (hairSeed - 0.5) * strokeWidth * 0.34;
        const startX = edgeX + vector.tx * tangentOffset;
        const startY = edgeY + vector.ty * tangentOffset;

        capillaries.lineStyle(Math.max(0.34, strokeWidth * 0.035), color, Math.min(0.58, alpha * 0.82));
        capillaries.moveTo(startX, startY);
        capillaries.lineTo(
          startX + Math.cos(hairAngle) * hairLength,
          startY + Math.sin(hairAngle) * hairLength,
        );
      }
    }
  }
}

function getDramaticPointSpread(stroke: GlyphStroke, index: number) {
  if (index === 0 || index === stroke.points.length - 1) {
    return 0.62;
  }

  const previousPoint = stroke.points[Math.max(0, index - 2)];
  const point = stroke.points[index];
  const nextPoint = stroke.points[Math.min(stroke.points.length - 1, index + 2)];
  const turn = Math.abs(
    Math.atan2(nextPoint.y - point.y, nextPoint.x - point.x) -
      Math.atan2(point.y - previousPoint.y, point.x - previousPoint.x),
  );

  return Math.min(0.8, Math.max(0, Math.min(Math.PI, turn) / Math.PI) * 0.58);
}

function drawRotatedEllipse(
  graphics: Graphics,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  rotation: number,
  color: number,
  alpha: number,
) {
  const points: number[] = [];
  const segmentCount = 18;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  for (let index = 0; index < segmentCount; index += 1) {
    const angle = (Math.PI * 2 * index) / segmentCount;
    const localX = Math.cos(angle) * radiusX;
    const localY = Math.sin(angle) * radiusY;

    points.push(x + localX * cos - localY * sin, y + localX * sin + localY * cos);
  }

  graphics.beginFill(color, alpha);
  graphics.drawPolygon(points);
  graphics.endFill();
}

function drawStrokeSelection(container: Container, stroke: GlyphStroke, options: PixiInkRenderOptions) {
  const baseWidth = Math.max(3, stroke.size * options.renderSize.scale);
  const glow = new Graphics();
  const edge = new Graphics();

  glow.lineStyle(baseWidth + 9, 0x82d0bc, 0.18);
  drawSmoothPath(glow, stroke.points, options.renderSize);
  edge.lineStyle(Math.max(2, baseWidth * 0.32), 0x82d0bc, 0.72);
  drawSmoothPath(edge, stroke.points, options.renderSize);

  container.addChild(glow);
  container.addChild(edge);
}
