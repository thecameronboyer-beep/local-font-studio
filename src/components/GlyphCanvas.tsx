import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import { Application } from "pixi.js";
import type {
  BackgroundStyle,
  BackgroundTexture,
  FontGuideSettings,
  FontRenderProfile,
  Glyph,
  GlyphDecoration,
  GlyphInkEffect,
  GlyphStroke,
} from "../types/fontTypes";
import { hasPixiInkEffect, renderPixiInkLayer } from "../render/pixiInkRenderer";
import { drawGlyphDecoration, drawStrokePath } from "../render/glyphRenderer";
import { defaultFontGuideSettings } from "../storage/fontStorage";
import { clampFontGuideSettings, fontGuideRows } from "../utils/fontGuides";
import type { FontGuideKey } from "../utils/fontGuides";

const CANVAS_SIZE = 720;
const DEFAULT_RENDER_SIZE = {
  height: CANVAS_SIZE,
  scale: CANVAS_SIZE,
  width: CANVAS_SIZE,
};
const INK_POOL_FAST_SPEED = 0.22;
const INK_POOL_DWELL_MS = 135;

export type CanvasViewOffset = {
  x: number;
  y: number;
};

export type DrawingTool = "pen" | "quill" | "line" | "eraser" | "eyes" | "select" | "pan";
export type EraserMode = "stroke" | "point";
export type SelectMode = "moveStroke" | "editPoint" | "smoothCircle" | "spreadCircle";
export type SmoothingMode = "raw" | "gentle" | "strong";
export type StickerDropRequest = {
  clientX: number;
  clientY: number;
  expression: NonNullable<GlyphDecoration["expression"]>;
  id: number;
};

type CanvasRenderSize = typeof DEFAULT_RENDER_SIZE;

type GlyphCanvasProps = {
  strokes: GlyphStroke[];
  decorations: GlyphDecoration[];
  backgroundAccentColor?: string;
  backgroundColor?: string;
  backgroundStyle?: BackgroundStyle;
  backgroundTexture?: BackgroundTexture;
  brushSize: number;
  eyeExpression: NonNullable<GlyphDecoration["expression"]>;
  eraserMode: EraserMode;
  guideEditMode?: boolean;
  guideSettings?: FontGuideSettings;
  inkEffect: GlyphInkEffect;
  inkColor: string;
  highlightColor: string;
  referenceGlyph?: Glyph | null;
  renderProfile?: FontRenderProfile;
  selectMode: SelectMode;
  selectedDecorationId: string | null;
  selectedStrokeId: string | null;
  showGuides: boolean;
  smoothingMode: SmoothingMode;
  stickerDropRequest: StickerDropRequest | null;
  tool: DrawingTool;
  viewOffset: CanvasViewOffset;
  viewScale: number;
  onEditStart: () => void;
  onChangeGuideSettings?: (settings: FontGuideSettings) => void;
  onChangeViewOffset: (offset: CanvasViewOffset) => void;
  onChangeDecorations: (decorations: GlyphDecoration[]) => void;
  onChangeStrokes: (strokes: GlyphStroke[]) => void;
  onSelectDecoration: (decorationId: string | null) => void;
  onSelectStroke: (strokeId: string | null) => void;
  onStickerDropHandled: (requestId: number) => void;
};

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function getCanvasRenderSize(canvas: HTMLCanvasElement): CanvasRenderSize {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width || CANVAS_SIZE));
  const height = Math.max(1, Math.round(rect.height || width || CANVAS_SIZE));

  return {
    height,
    scale: Math.min(width, height),
    width,
  };
}

function makeStrokeId() {
  return `stroke_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function makeDecorationId() {
  return `decoration_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function eraseStrokeNearPoint(strokes: GlyphStroke[], x: number, y: number, radius: number) {
  return strokes.filter((stroke) =>
    stroke.points.every((point) => Math.hypot(point.x - x, point.y - y) > radius),
  );
}

function eraseSegmentsNearPoint(strokes: GlyphStroke[], x: number, y: number, radius: number) {
  const nextStrokes: GlyphStroke[] = [];

  for (const stroke of strokes) {
    const segments: Array<GlyphStroke["points"]> = [];
    let currentSegment: GlyphStroke["points"] = [];

    for (const point of stroke.points) {
      if (Math.hypot(point.x - x, point.y - y) <= radius) {
        if (currentSegment.length > 0) {
          segments.push(currentSegment);
          currentSegment = [];
        }
        continue;
      }

      currentSegment.push(point);
    }

    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }

    if (segments.length === 1 && segments[0].length === stroke.points.length) {
      nextStrokes.push(stroke);
      continue;
    }

    for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
      nextStrokes.push({
        ...stroke,
        id: `${stroke.id}_segment_${segmentIndex}`,
        points: segments[segmentIndex],
      });
    }
  }

  return nextStrokes;
}

function getEyeHitRadius(decoration: GlyphDecoration) {
  return decoration.size * 3.2;
}

function moveDecoration(decoration: GlyphDecoration, x: number, y: number): GlyphDecoration {
  const horizontalInset = getEyeHitRadius(decoration);
  const verticalInset = decoration.size * 0.8;

  return {
    ...decoration,
    x: Math.min(1 - horizontalInset, Math.max(horizontalInset, x)),
    y: Math.min(1 - verticalInset, Math.max(verticalInset, y)),
  };
}

function getDistanceToSegment(
  x: number,
  y: number,
  start: GlyphStroke["points"][number],
  end: GlyphStroke["points"][number],
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const segmentLengthSquared = dx * dx + dy * dy;

  if (segmentLengthSquared === 0) {
    return Math.hypot(x - start.x, y - start.y);
  }

  const t = Math.min(1, Math.max(0, ((x - start.x) * dx + (y - start.y) * dy) / segmentLengthSquared));
  const projectionX = start.x + t * dx;
  const projectionY = start.y + t * dy;

  return Math.hypot(x - projectionX, y - projectionY);
}

function hitTestStroke(strokes: GlyphStroke[], x: number, y: number, radius: number) {
  for (let strokeIndex = strokes.length - 1; strokeIndex >= 0; strokeIndex -= 1) {
    const stroke = strokes[strokeIndex];

    for (let pointIndex = 0; pointIndex < stroke.points.length; pointIndex += 1) {
      const point = stroke.points[pointIndex];

      if (Math.hypot(point.x - x, point.y - y) <= radius) {
        return stroke.id;
      }

      const nextPoint = stroke.points[pointIndex + 1];

      if (nextPoint && getDistanceToSegment(x, y, point, nextPoint) <= radius) {
        return stroke.id;
      }
    }
  }

  return null;
}

function findStrokeById(strokes: GlyphStroke[], strokeId: string | null) {
  return strokeId ? strokes.find((stroke) => stroke.id === strokeId) : undefined;
}

function hitTestStrokePoint(stroke: GlyphStroke | undefined, x: number, y: number, radius: number) {
  if (!stroke) {
    return null;
  }

  let nearestPoint: { distance: number; pointIndex: number } | null = null;

  for (let pointIndex = 0; pointIndex < stroke.points.length; pointIndex += 1) {
    const point = stroke.points[pointIndex];
    const distance = Math.hypot(point.x - x, point.y - y);

    if (distance <= radius && (!nearestPoint || distance < nearestPoint.distance)) {
      nearestPoint = { distance, pointIndex };
    }
  }

  return nearestPoint?.pointIndex ?? null;
}

function smoothPointBetweenNeighbors(
  point: GlyphStroke["points"][number],
  previousPoint: GlyphStroke["points"][number] | undefined,
  nextPoint: GlyphStroke["points"][number] | undefined,
) {
  if (!previousPoint || !nextPoint) {
    return { ...point };
  }

  return {
    ...point,
    ink: point.ink,
    pressure: ((previousPoint.pressure ?? point.pressure ?? 0.66) + (point.pressure ?? 0.66) * 2 + (nextPoint.pressure ?? point.pressure ?? 0.66)) / 4,
    x: previousPoint.x * 0.25 + point.x * 0.5 + nextPoint.x * 0.25,
    y: previousPoint.y * 0.25 + point.y * 0.5 + nextPoint.y * 0.25,
  };
}

function getStrokePointCount(strokes: GlyphStroke[]) {
  return strokes.reduce((count, stroke) => count + stroke.points.length, 0);
}

function getSmoothedPoint(
  previousPoint: GlyphStroke["points"][number],
  point: GlyphStroke["points"][number],
  smoothingMode: SmoothingMode,
) {
  const followAmount = smoothingMode === "raw" ? 1 : smoothingMode === "gentle" ? 0.72 : 0.48;

  return {
    ...point,
    x: previousPoint.x + (point.x - previousPoint.x) * followAmount,
    y: previousPoint.y + (point.y - previousPoint.y) * followAmount,
  };
}

export default function GlyphCanvas({
  strokes,
  decorations,
  backgroundAccentColor = "#d3bf97",
  backgroundColor = "#f4ead7",
  backgroundStyle = "paper",
  backgroundTexture = "grain",
  brushSize,
  eyeExpression,
  eraserMode,
  guideEditMode = false,
  guideSettings = defaultFontGuideSettings,
  inkEffect,
  inkColor,
  highlightColor,
  referenceGlyph,
  renderProfile = "plain",
  selectMode,
  selectedDecorationId,
  selectedStrokeId,
  showGuides,
  smoothingMode,
  stickerDropRequest,
  tool,
  viewOffset,
  viewScale,
  onEditStart,
  onChangeGuideSettings,
  onChangeViewOffset,
  onChangeDecorations,
  onChangeStrokes,
  onSelectDecoration,
  onSelectStroke,
  onStickerDropHandled,
}: GlyphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pixiHostRef = useRef<HTMLDivElement | null>(null);
  const pixiAppRef = useRef<Application | null>(null);
  const pixiReadyRef = useRef(false);
  const strokesRef = useRef(strokes);
  const decorationsRef = useRef(decorations);
  const selectedDecorationIdRef = useRef(selectedDecorationId);
  const selectedStrokeIdRef = useRef(selectedStrokeId);
  const viewOffsetRef = useRef(viewOffset);
  const renderSizeRef = useRef<CanvasRenderSize>(DEFAULT_RENDER_SIZE);
  const activeStrokeRef = useRef<GlyphStroke | null>(null);
  const activeDecorationIdRef = useRef<string | null>(null);
  const movingStrokeRef = useRef<{
    originalPoints: GlyphStroke["points"];
    startPoint: GlyphStroke["points"][number];
    strokeId: string;
  } | null>(null);
  const movingPointRef = useRef<{
    pointIndex: number;
    strokeId: string;
  } | null>(null);
  const activeStrokeTimeRef = useRef(0);
  const circleToolPointRef = useRef<GlyphStroke["points"][number] | null>(null);
  const circleToolActiveRef = useRef(false);
  const erasingRef = useRef(false);
  const activeGuideRef = useRef<FontGuideKey | null>(null);
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    offset: CanvasViewOffset;
  } | null>(null);

  useEffect(() => {
    strokesRef.current = strokes;
    decorationsRef.current = decorations;
    selectedDecorationIdRef.current = selectedDecorationId;
    selectedStrokeIdRef.current = selectedStrokeId;
    drawCanvas(strokes, decorations);
  }, [backgroundAccentColor, backgroundColor, backgroundStyle, backgroundTexture, brushSize, decorations, eyeExpression, guideEditMode, guideSettings, inkEffect, referenceGlyph, renderProfile, selectMode, selectedDecorationId, selectedStrokeId, showGuides, strokes, tool]);

  useEffect(() => {
    viewOffsetRef.current = viewOffset;
  }, [viewOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = pixiHostRef.current;

    if (!canvas || !host) {
      return undefined;
    }

    const rect = canvas.getBoundingClientRect();
    const app = new Application({
      antialias: true,
      autoDensity: true,
      backgroundAlpha: 0,
      height: Math.max(1, Math.round(rect.height || CANVAS_SIZE)),
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      width: Math.max(1, Math.round(rect.width || CANVAS_SIZE)),
    });
    const view = app.view as HTMLCanvasElement;

    view.className = "glyph-pixi-canvas";
    view.setAttribute("aria-hidden", "true");
    view.style.width = "100%";
    view.style.height = "100%";
    app.stop();
    host.append(view);
    pixiAppRef.current = app;
    pixiReadyRef.current = true;
    drawCanvas(strokesRef.current, decorationsRef.current);

    return () => {
      pixiReadyRef.current = false;
      pixiAppRef.current = null;
      app.destroy(true);
    };
  }, []);

  useEffect(() => {
    if (tool !== "select" || (selectMode !== "smoothCircle" && selectMode !== "spreadCircle")) {
      circleToolPointRef.current = null;
      circleToolActiveRef.current = false;
    }
  }, [selectMode, tool]);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return undefined;
    }

    const handleResize = () => drawCanvas(strokesRef.current, decorationsRef.current);

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }

    const observer = new ResizeObserver(handleResize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [backgroundAccentColor, backgroundColor, backgroundStyle, backgroundTexture, brushSize, decorations, eyeExpression, guideEditMode, guideSettings, inkEffect, referenceGlyph, renderProfile, selectMode, selectedDecorationId, selectedStrokeId, showGuides, strokes, tool]);

  function getCanvasScaleBasis() {
    return renderSizeRef.current.scale || CANVAS_SIZE;
  }

  function renderPixiInk(nextStrokes: GlyphStroke[], renderSize: CanvasRenderSize) {
    const app = pixiAppRef.current;

    if (!app) {
      return;
    }

    app.renderer.resize(renderSize.width, renderSize.height);
    renderPixiInkLayer(app.stage, nextStrokes, {
      backgroundTexture,
      fallbackColor: inkColor,
      renderProfile,
      renderSize,
      selectedStrokeId,
    });
    app.renderer.render(app.stage);
  }

  function drawCanvas(nextStrokes: GlyphStroke[], nextDecorations: GlyphDecoration[]) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const renderSize = getCanvasRenderSize(canvas);
    renderSizeRef.current = renderSize;
    canvas.width = renderSize.width * dpr;
    canvas.height = renderSize.height * dpr;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, renderSize.width, renderSize.height);
    drawCanvasBackground(ctx, renderSize);

    drawBoardEdges(ctx, renderSize);

    if (showGuides) {
      drawGuides(ctx, renderSize);
    }

    if (referenceGlyph) {
      drawReferenceGlyph(ctx, referenceGlyph, renderSize);
    }

    const pixiInkReady = pixiReadyRef.current;
    renderPixiInk(nextStrokes, renderSize);

    for (const stroke of nextStrokes) {
      if (pixiInkReady && hasPixiInkEffect(stroke)) {
        continue;
      }

      drawStrokePath(
        ctx,
        stroke,
        0,
        0,
        renderSize.scale,
        renderSize.width,
        renderSize.height,
        "#19140f",
        { backgroundTexture, renderProfile, skipInkEffect: activeStrokeRef.current?.id === stroke.id },
      );
    }

    const selectedStroke = nextStrokes.find((stroke) => stroke.id === selectedStrokeId);

    if (selectedStroke) {
      drawStrokeSelection(ctx, selectedStroke, renderSize);
    }

    for (const decoration of nextDecorations) {
      drawGlyphDecoration(ctx, decoration, 0, 0, renderSize.scale, renderSize.width, renderSize.height);

      if (decoration.id === selectedDecorationId) {
        drawDecorationSelection(ctx, decoration, renderSize);
      }
    }

    if (tool === "eraser") {
      ctx.strokeStyle = "rgba(133, 58, 57, 0.42)";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(renderSize.width - 48, 48, Math.max(12, brushSize * 1.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (tool === "select" && (selectMode === "smoothCircle" || selectMode === "spreadCircle") && circleToolPointRef.current) {
      drawCircleTool(ctx, circleToolPointRef.current, renderSize, selectMode === "spreadCircle" ? "spread" : "smooth");
    }
  }

  function drawGrainTexture(ctx: CanvasRenderingContext2D, renderSize: CanvasRenderSize, color: string) {
    const speckleCount = Math.max(140, Math.ceil((renderSize.width * renderSize.height) / 2300));

    ctx.save();
    ctx.fillStyle = color;

    for (let index = 0; index < speckleCount; index += 1) {
      const x = (index * 97) % renderSize.width;
      const y = (index * 193) % renderSize.height;
      const radius = 0.8 + (index % 5) * 0.38;
      ctx.globalAlpha = 0.08 + (index % 5) * 0.014;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#fff7e6";
    for (let index = 0; index < speckleCount * 0.34; index += 1) {
      const x = (index * 173) % renderSize.width;
      const y = (index * 89) % renderSize.height;
      ctx.globalAlpha = 0.04 + (index % 3) * 0.012;
      ctx.fillRect(x, y, 1.2 + (index % 2), 1.2 + (index % 2));
    }

    ctx.restore();
  }

  function drawFiberTexture(ctx: CanvasRenderingContext2D, renderSize: CanvasRenderSize) {
    const fiberCount = Math.max(52, Math.ceil(renderSize.height / 9));

    ctx.save();
    ctx.strokeStyle = backgroundAccentColor;
    ctx.lineWidth = Math.max(1, renderSize.scale / 520);

    for (let index = 0; index < fiberCount; index += 1) {
      const y = (index * 37) % renderSize.height;
      const startX = (index * 61) % Math.max(1, renderSize.width * 0.22);
      const length = renderSize.width * (0.48 + ((index * 17) % 39) / 100);
      const wave = 4 + (index % 5);

      ctx.globalAlpha = 0.16 + (index % 4) * 0.034;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.bezierCurveTo(
        startX + length * 0.32,
        y - wave,
        startX + length * 0.66,
        y + wave,
        Math.min(renderSize.width, startX + length),
        y + (index % 2 === 0 ? -1 : 1) * wave * 0.6,
      );
      ctx.stroke();
    }

    ctx.strokeStyle = "#fff7e6";
    ctx.lineWidth = Math.max(0.75, renderSize.scale / 720);
    for (let index = 0; index < fiberCount * 0.45; index += 1) {
      const y = (index * 47) % renderSize.height;
      const startX = (index * 83) % Math.max(1, renderSize.width * 0.38);
      const length = renderSize.width * (0.24 + ((index * 13) % 28) / 100);

      ctx.globalAlpha = 0.08 + (index % 3) * 0.02;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(Math.min(renderSize.width, startX + length), y + ((index % 3) - 1) * 3);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCanvasTexture(ctx: CanvasRenderingContext2D, renderSize: CanvasRenderSize, spacingMultiplier = 1) {
    const spacing = Math.max(8, renderSize.scale * 0.036);

    ctx.save();
    ctx.strokeStyle = backgroundAccentColor;
    ctx.lineWidth = Math.max(1.2, renderSize.scale / 430);

    for (let x = 0; x <= renderSize.width; x += spacing * spacingMultiplier) {
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, renderSize.height);
      ctx.stroke();
    }

    for (let y = 0; y <= renderSize.height; y += spacing * 0.86 * spacingMultiplier) {
      ctx.globalAlpha = 0.13;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(renderSize.width, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#fff7e6";
    ctx.lineWidth = Math.max(0.8, renderSize.scale / 700);
    for (let x = spacing * 0.48; x <= renderSize.width; x += spacing * spacingMultiplier) {
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, renderSize.height);
      ctx.stroke();
    }

    for (let y = spacing * 0.4; y <= renderSize.height; y += spacing * 0.86 * spacingMultiplier) {
      ctx.globalAlpha = 0.064;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(renderSize.width, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSelectedBackgroundTexture(ctx: CanvasRenderingContext2D, renderSize: CanvasRenderSize) {
    if (backgroundTexture === "clean") {
      return;
    }

    if (backgroundTexture === "grain") {
      drawGrainTexture(ctx, renderSize, backgroundAccentColor);
      return;
    }

    if (backgroundTexture === "fiber") {
      drawGrainTexture(ctx, renderSize, backgroundAccentColor);
      drawFiberTexture(ctx, renderSize);
      return;
    }

    if (backgroundTexture === "canvas") {
      drawGrainTexture(ctx, renderSize, backgroundAccentColor);
      drawCanvasTexture(ctx, renderSize, 0.64);
      return;
    }

    drawGrainTexture(ctx, renderSize, backgroundAccentColor);
    drawFiberTexture(ctx, renderSize);
    drawCanvasTexture(ctx, renderSize, 0.82);
  }

  function drawCanvasBackground(ctx: CanvasRenderingContext2D, renderSize: CanvasRenderSize) {
    if (backgroundStyle === "parchment") {
      const gradient = ctx.createLinearGradient(0, 0, renderSize.width, renderSize.height);
      gradient.addColorStop(0, "#f8edcb");
      gradient.addColorStop(0.48, backgroundColor);
      gradient.addColorStop(1, "#c69b5f");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, renderSize.width, renderSize.height);
      drawSelectedBackgroundTexture(ctx, renderSize);
      return;
    }

    if (backgroundStyle === "midnight") {
      const gradient = ctx.createLinearGradient(0, 0, renderSize.width, renderSize.height);
      gradient.addColorStop(0, backgroundColor);
      gradient.addColorStop(1, "#1f3037");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, renderSize.width, renderSize.height);
      drawSelectedBackgroundTexture(ctx, renderSize);
      return;
    }

    if (["blush", "sage", "sky", "lavender"].includes(backgroundStyle)) {
      const gradient = ctx.createLinearGradient(0, 0, renderSize.width, renderSize.height);
      gradient.addColorStop(0, "#fff7e8");
      gradient.addColorStop(0.44, backgroundColor);
      gradient.addColorStop(1, backgroundAccentColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, renderSize.width, renderSize.height);
      drawSelectedBackgroundTexture(ctx, renderSize);
      return;
    }

    if (["strawberryRed", "berryPink", "strawberryCream"].includes(backgroundStyle)) {
      const gradient = ctx.createLinearGradient(0, 0, renderSize.width, renderSize.height);
      gradient.addColorStop(0, "#fffaf5");
      gradient.addColorStop(0.5, backgroundColor);
      gradient.addColorStop(1, backgroundAccentColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, renderSize.width, renderSize.height);
      drawSelectedBackgroundTexture(ctx, renderSize);
      return;
    }

    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, renderSize.width, renderSize.height);

    if (backgroundStyle === "lined") {
      ctx.save();
      ctx.strokeStyle = backgroundAccentColor;
      ctx.globalAlpha = 0.48;
      ctx.lineWidth = 1.4;

      for (let y = renderSize.height * 0.16; y < renderSize.height - 18; y += renderSize.scale * 0.09) {
        ctx.beginPath();
        ctx.moveTo(renderSize.width * 0.08, y);
        ctx.lineTo(renderSize.width * 0.92, y);
        ctx.stroke();
      }

      ctx.restore();
    }

    if (backgroundStyle === "grid") {
      ctx.save();
      ctx.strokeStyle = backgroundAccentColor;
      ctx.globalAlpha = 0.24;
      ctx.lineWidth = 1;

      for (let x = renderSize.width * 0.08; x < renderSize.width; x += renderSize.scale * 0.08) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, renderSize.height);
        ctx.stroke();
      }

      for (let y = renderSize.height * 0.08; y < renderSize.height; y += renderSize.scale * 0.08) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(renderSize.width, y);
        ctx.stroke();
      }

      ctx.restore();
    }

    drawSelectedBackgroundTexture(ctx, renderSize);
  }

  function drawGuides(ctx: CanvasRenderingContext2D, renderSize: CanvasRenderSize) {
    const left = guideSettings.leftBound * renderSize.width;
    const right = guideSettings.rightBound * renderSize.width;
    const center = (left + right) / 2;
    const fullTop = guideSettings.ascender * renderSize.height;
    const fullBottom = guideSettings.descender * renderSize.height;
    const bodyTop = guideSettings.xHeight * renderSize.height;
    const bodyBottom = guideSettings.baseline * renderSize.height;

    ctx.save();
    ctx.fillStyle = "rgba(68, 85, 118, 0.07)";
    ctx.fillRect(left, fullTop, Math.max(1, right - left), Math.max(1, fullBottom - fullTop));
    ctx.fillStyle = "rgba(181, 132, 42, 0.12)";
    ctx.fillRect(left, bodyTop, Math.max(1, right - left), Math.max(1, bodyBottom - bodyTop));

    ctx.strokeStyle = "rgba(68, 85, 118, 0.18)";
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(center, 0);
    ctx.lineTo(center, renderSize.height);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.lineWidth = 2;
    ctx.font = "14px Inter, ui-sans-serif, system-ui";
    ctx.textBaseline = "middle";

    for (const guide of fontGuideRows) {
      const offset = guideSettings[guide.key] * (guide.axis === "x" ? renderSize.width : renderSize.height);
      ctx.strokeStyle = guide.color;
      ctx.beginPath();
      if (guide.axis === "x") {
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, renderSize.height);
      } else {
        ctx.moveTo(0, offset);
        ctx.lineTo(renderSize.width, offset);
      }
      ctx.stroke();
      ctx.fillStyle = guide.color;
      if (guide.axis === "x") {
        ctx.fillText(guide.label.toLowerCase(), Math.max(12, Math.min(renderSize.width - 64, offset - 20)), renderSize.height - 36);
        if (guideEditMode) {
          ctx.beginPath();
          ctx.arc(offset, renderSize.height - 18, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        ctx.fillText(guide.label.toLowerCase(), 18, offset - 12);
        if (guideEditMode) {
          ctx.beginPath();
          ctx.arc(renderSize.width - 18, offset, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }

  function drawCircleTool(
    ctx: CanvasRenderingContext2D,
    point: GlyphStroke["points"][number],
    renderSize: CanvasRenderSize,
    mode: "smooth" | "spread",
  ) {
    const radius = getSmoothingCircleRadius() * renderSize.scale;
    const x = point.x * renderSize.width;
    const y = point.y * renderSize.height;

    ctx.save();
    ctx.fillStyle = mode === "spread" ? "rgba(104, 67, 35, 0.1)" : "rgba(130, 208, 188, 0.1)";
    ctx.strokeStyle = mode === "spread" ? "rgba(180, 130, 74, 0.9)" : "rgba(130, 208, 188, 0.9)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawDecorationSelection(
    ctx: CanvasRenderingContext2D,
    decoration: GlyphDecoration,
    renderSize: CanvasRenderSize,
  ) {
    const radius = getEyeHitRadius(decoration) * renderSize.scale;
    const x = decoration.x * renderSize.width;
    const y = decoration.y * renderSize.height;

    ctx.save();
    ctx.strokeStyle = "rgba(130, 208, 188, 0.92)";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawStrokeSelection(ctx: CanvasRenderingContext2D, stroke: GlyphStroke, renderSize: CanvasRenderSize) {
    if (stroke.points.length === 0) {
      return;
    }

    const bounds = stroke.points.reduce(
      (currentBounds, point) => ({
        maxX: Math.max(currentBounds.maxX, point.x),
        maxY: Math.max(currentBounds.maxY, point.y),
        minX: Math.min(currentBounds.minX, point.x),
        minY: Math.min(currentBounds.minY, point.y),
      }),
      {
        maxX: stroke.points[0].x,
        maxY: stroke.points[0].y,
        minX: stroke.points[0].x,
        minY: stroke.points[0].y,
      },
    );
    const padding = Math.max(10, stroke.size * renderSize.scale * 2.6);
    const left = bounds.minX * renderSize.width - padding;
    const top = bounds.minY * renderSize.height - padding;
    const width = (bounds.maxX - bounds.minX) * renderSize.width + padding * 2;
    const height = (bounds.maxY - bounds.minY) * renderSize.height + padding * 2;

    ctx.save();
    ctx.strokeStyle = "rgba(36, 104, 201, 0.86)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(left, top, Math.max(12, width), Math.max(12, height));
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(36, 104, 201, 0.92)";
    const activePoint = movingPointRef.current?.strokeId === stroke.id ? movingPointRef.current.pointIndex : null;

    for (let pointIndex = 0; pointIndex < stroke.points.length; pointIndex += 1) {
      const point = stroke.points[pointIndex];
      ctx.beginPath();
      ctx.arc(point.x * renderSize.width, point.y * renderSize.height, pointIndex === activePoint ? 7 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawReferenceGlyph(ctx: CanvasRenderingContext2D, glyph: Glyph, renderSize: CanvasRenderSize) {
    ctx.save();
    ctx.globalAlpha = 0.18;

    for (const stroke of glyph.strokes) {
      drawStrokePath(
        ctx,
        {
          ...stroke,
          color: "#2468c9",
        },
        0,
        0,
        renderSize.scale,
        renderSize.width,
        renderSize.height,
        "#2468c9",
        { backgroundTexture, renderProfile },
      );
    }

    ctx.globalAlpha = 0.24;
    for (const decoration of glyph.decorations ?? []) {
      drawGlyphDecoration(ctx, decoration, 0, 0, renderSize.scale, renderSize.width, renderSize.height);
    }

    ctx.restore();
  }

  function drawBoardEdges(ctx: CanvasRenderingContext2D, renderSize: CanvasRenderSize) {
    const railHeight = 10;
    const tickLength = 54;
    const labelInset = 20;
    const rightEdge = renderSize.width;
    const bottomEdge = renderSize.height;

    ctx.save();
    ctx.lineCap = "round";
    ctx.font = "900 14px Inter, ui-sans-serif, system-ui";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(23, 17, 11, 0.12)";
    ctx.fillRect(0, 0, rightEdge, railHeight);
    ctx.fillRect(0, bottomEdge - railHeight, rightEdge, railHeight);

    ctx.strokeStyle = "rgba(23, 17, 11, 0.34)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, railHeight + 8);
    ctx.lineTo(rightEdge, railHeight + 8);
    ctx.moveTo(0, bottomEdge - railHeight - 8);
    ctx.lineTo(rightEdge, bottomEdge - railHeight - 8);
    ctx.stroke();

    ctx.strokeStyle = "rgba(23, 17, 11, 0.48)";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(labelInset, railHeight + 22);
    ctx.lineTo(labelInset + tickLength, railHeight + 22);
    ctx.moveTo(rightEdge - labelInset - tickLength, railHeight + 22);
    ctx.lineTo(rightEdge - labelInset, railHeight + 22);
    ctx.moveTo(labelInset, bottomEdge - railHeight - 22);
    ctx.lineTo(labelInset + tickLength, bottomEdge - railHeight - 22);
    ctx.moveTo(rightEdge - labelInset - tickLength, bottomEdge - railHeight - 22);
    ctx.lineTo(rightEdge - labelInset, bottomEdge - railHeight - 22);
    ctx.stroke();

    ctx.fillStyle = "rgba(23, 17, 11, 0.52)";
    ctx.fillText("top edge", labelInset + tickLength + 10, railHeight + 22);
    ctx.fillText("bottom edge", labelInset + tickLength + 10, bottomEdge - railHeight - 22);

    ctx.restore();
  }

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    return getCanvasPointFromClient(event.clientX, event.clientY);
  }

  function getCanvasPointFromClient(clientX: number, clientY: number) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: clamp((clientX - rect.left) / rect.width),
      y: clamp((clientY - rect.top) / rect.height),
    };
  }

  function findNearestGuide(point: { x: number; y: number }) {
    const hitThreshold = Math.max(0.025, 18 / Math.max(1, renderSizeRef.current.scale));
    const nearest = fontGuideRows.reduce((currentNearest, guide) => {
      const distance = Math.abs(guideSettings[guide.key] - (guide.axis === "x" ? point.x : point.y));
      return distance < currentNearest.distance ? { distance, key: guide.key } : currentNearest;
    }, {
      distance: Number.POSITIVE_INFINITY,
      key: null as FontGuideKey | null,
    });

    return nearest.distance <= hitThreshold ? nearest.key : null;
  }

  function updateGuideFromPoint(key: FontGuideKey, point: { x: number; y: number }) {
    const guide = fontGuideRows.find((item) => item.key === key);
    const value = guide?.axis === "x" ? point.x : point.y;
    onChangeGuideSettings?.(clampFontGuideSettings(guideSettings, key, value));
  }

  function getEventPressure(event: PointerEvent<HTMLCanvasElement>) {
    const eventPressure = event.pressure > 0 ? event.pressure : undefined;

    return Math.min(1, Math.max(0.48, eventPressure ?? (event.pointerType === "mouse" ? 0.58 : 0.66)));
  }

  function getPooledInkPoint(
    previousPoint: GlyphStroke["points"][number] | null,
    point: GlyphStroke["points"][number],
    eventTime: number,
  ) {
    if (inkEffect !== "subtleSpread" || !previousPoint) {
      return {
        ...point,
        ink: 0,
        spread: point.spread,
      };
    }

    const elapsed = Math.max(1, eventTime - activeStrokeTimeRef.current);
    const distance = previousPoint
      ? Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) * getCanvasScaleBasis()
      : 0;
    const speed = distance / elapsed;
    const slowInk = Math.max(0, Math.min(1, (INK_POOL_FAST_SPEED - speed) / INK_POOL_FAST_SPEED));
    const dwellInk = Math.max(0, Math.min(1, (elapsed - 22) / INK_POOL_DWELL_MS));
    const pressure = point.pressure ?? 0.66;
    const pool = Math.max(slowInk * slowInk, dwellInk * 0.72) * pressure;

    if (pool < 0.14) {
      return {
        ...point,
        ink: 0,
        spread: point.spread,
      };
    }

    const spread = Math.min(1, 0.14 + pool * 0.74);

    return {
      ...point,
      ink: Math.max(point.ink ?? 0, pool),
      spread: Math.max(point.spread ?? 0, spread),
    };
  }

  function getSmoothingCircleRadius() {
    return Math.max(0.045, (brushSize / getCanvasScaleBasis()) * 4);
  }

  function getSpreadAmountForStroke(stroke: GlyphStroke, distance: number, radius: number) {
    const falloff = 1 - Math.min(1, distance / radius);
    const strokeWidthPx = stroke.size * getCanvasScaleBasis();
    const thicknessBoost = Math.min(1, Math.max(0.24, strokeWidthPx / 22));

    return Math.min(1, 0.22 + falloff * 0.42 + thicknessBoost * 0.22);
  }

  function pushInkPoint(point: GlyphStroke["points"][number]) {
    const stroke = activeStrokeRef.current;

    if (!stroke) {
      return;
    }

    stroke.points.push(point);

    const nextStrokes = [...strokesRef.current];
    strokesRef.current = nextStrokes;
    onChangeStrokes(nextStrokes);
  }

  function updateActiveLineStroke(point: GlyphStroke["points"][number]) {
    const stroke = activeStrokeRef.current;

    if (!stroke) {
      return;
    }

    const startPoint = stroke.points[0];

    stroke.points = [
      startPoint,
      {
        ...point,
        ink: 0,
      },
    ];

    const nextStrokes = [...strokesRef.current];
    strokesRef.current = nextStrokes;
    onChangeStrokes(nextStrokes);
  }

  function hitTestDecoration(x: number, y: number) {
    for (let index = decorationsRef.current.length - 1; index >= 0; index -= 1) {
      const decoration = decorationsRef.current[index];

      if (Math.hypot(decoration.x - x, decoration.y - y) <= getEyeHitRadius(decoration)) {
        return decoration;
      }
    }

    return undefined;
  }

  function updateDecorationPosition(id: string, x: number, y: number) {
    const nextDecorations = decorationsRef.current.map((decoration) =>
      decoration.id === id ? moveDecoration(decoration, x, y) : decoration,
    );

    decorationsRef.current = nextDecorations;
    onChangeDecorations(nextDecorations);
  }

  function updateStrokePoints(strokeId: string, points: GlyphStroke["points"]) {
    const nextStrokes = strokesRef.current.map((stroke) =>
      stroke.id === strokeId
        ? {
            ...stroke,
            points,
          }
        : stroke,
    );

    strokesRef.current = nextStrokes;
    onChangeStrokes(nextStrokes);
  }

  function moveSelectedStroke(point: GlyphStroke["points"][number]) {
    const movingStroke = movingStrokeRef.current;

    if (!movingStroke) {
      return;
    }

    const dx = point.x - movingStroke.startPoint.x;
    const dy = point.y - movingStroke.startPoint.y;

    updateStrokePoints(
      movingStroke.strokeId,
      movingStroke.originalPoints.map((originalPoint) => ({
        ...originalPoint,
        x: clamp(originalPoint.x + dx),
        y: clamp(originalPoint.y + dy),
      })),
    );
  }

  function moveSelectedPoint(point: GlyphStroke["points"][number]) {
    const movingPoint = movingPointRef.current;
    const stroke = findStrokeById(strokesRef.current, movingPoint?.strokeId ?? null);

    if (!movingPoint || !stroke) {
      return;
    }

    updateStrokePoints(
      movingPoint.strokeId,
      stroke.points.map((strokePoint, pointIndex) =>
        pointIndex === movingPoint.pointIndex
          ? {
              ...strokePoint,
              x: point.x,
              y: point.y,
              pressure: point.pressure,
            }
          : strokePoint,
      ),
    );
  }

  function smoothCircleAtPoint(point: GlyphStroke["points"][number]) {
    const radius = getSmoothingCircleRadius();
    let firstChangedStrokeId: string | null = null;
    let didChange = false;

    const nextStrokes = strokesRef.current.map((stroke) => {
      let strokeChanged = false;
      const originalPoints = stroke.points;
      const smoothedPoints = originalPoints.map((strokePoint, pointIndex) => {
        if (pointIndex === 0 || pointIndex === originalPoints.length - 1) {
          return strokePoint;
        }

        if (Math.hypot(strokePoint.x - point.x, strokePoint.y - point.y) > radius) {
          return strokePoint;
        }

        strokeChanged = true;
        return smoothPointBetweenNeighbors(strokePoint, originalPoints[pointIndex - 1], originalPoints[pointIndex + 1]);
      });

      if (!strokeChanged) {
        return stroke;
      }

      didChange = true;
      firstChangedStrokeId ??= stroke.id;

      return {
        ...stroke,
        points: smoothedPoints,
      };
    });

    if (didChange) {
      strokesRef.current = nextStrokes;
      onChangeStrokes(nextStrokes);
    } else {
      drawCanvas(strokesRef.current, decorationsRef.current);
    }

    return firstChangedStrokeId;
  }

  function spreadCircleAtPoint(point: GlyphStroke["points"][number]) {
    const radius = getSmoothingCircleRadius();
    let firstChangedStrokeId: string | null = null;
    let didChange = false;

    const nextStrokes = strokesRef.current.map((stroke) => {
      let strokeChanged = false;
      const nextPoints = stroke.points.map((strokePoint) => {
        const distance = Math.hypot(strokePoint.x - point.x, strokePoint.y - point.y);

        if (distance > radius) {
          return strokePoint;
        }

        strokeChanged = true;
        return {
          ...strokePoint,
          spread: Math.max(strokePoint.spread ?? 0, getSpreadAmountForStroke(stroke, distance, radius)),
        };
      });

      if (!strokeChanged) {
        return stroke;
      }

      didChange = true;
      firstChangedStrokeId ??= stroke.id;
      const nextInkEffect: GlyphInkEffect = stroke.inkEffect === "dramaticPooling" ? "dramaticPooling" : "subtleSpread";

      return {
        ...stroke,
        inkEffect: nextInkEffect,
        points: nextPoints,
      };
    });

    if (didChange) {
      strokesRef.current = nextStrokes;
      onChangeStrokes(nextStrokes);
    } else {
      drawCanvas(strokesRef.current, decorationsRef.current);
    }

    return firstChangedStrokeId;
  }

  function placeGooglyEyes(x: number, y: number, expression = eyeExpression) {
    const decoration: GlyphDecoration = moveDecoration(
      {
        expression,
        id: makeDecorationId(),
        kind: "googly-eyes",
        size: Math.min(0.075, Math.max(0.032, (brushSize / getCanvasScaleBasis()) * 3.25)),
        x,
        y,
      },
      x,
      y,
    );
    const nextDecorations = [...decorationsRef.current, decoration];

    decorationsRef.current = nextDecorations;
    activeDecorationIdRef.current = decoration.id;
    onSelectDecoration(decoration.id);
    onChangeDecorations(nextDecorations);
  }

  useEffect(() => {
    if (!stickerDropRequest) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      onStickerDropHandled(stickerDropRequest.id);
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const isInsideCanvas =
      stickerDropRequest.clientX >= rect.left &&
      stickerDropRequest.clientX <= rect.right &&
      stickerDropRequest.clientY >= rect.top &&
      stickerDropRequest.clientY <= rect.bottom;

    if (isInsideCanvas) {
      const point = getCanvasPointFromClient(stickerDropRequest.clientX, stickerDropRequest.clientY);
      onEditStart();
      onSelectStroke(null);
      placeGooglyEyes(point.x, point.y, stickerDropRequest.expression);
    }

    onStickerDropHandled(stickerDropRequest.id);
  }, [stickerDropRequest]);

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    const point = getCanvasPoint(event);

    if (guideEditMode && showGuides && onChangeGuideSettings) {
      const guideKey = findNearestGuide(point);

      if (guideKey) {
        activeGuideRef.current = guideKey;
        updateGuideFromPoint(guideKey, point);
      }

      return;
    }

    const pressure = getEventPressure(event);

    if (tool === "pan") {
      panStartRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        offset: viewOffsetRef.current,
      };
      return;
    }

    if (tool === "select") {
      if (selectMode === "smoothCircle" || selectMode === "spreadCircle") {
        onEditStart();
        circleToolActiveRef.current = true;
        circleToolPointRef.current = point;
        movingStrokeRef.current = null;
        movingPointRef.current = null;
        const changedStrokeId = selectMode === "spreadCircle" ? spreadCircleAtPoint(point) : smoothCircleAtPoint(point);
        onSelectStroke(changedStrokeId ?? selectedStrokeIdRef.current);
        return;
      }

      const hitRadius = Math.max(0.02, brushSize / getCanvasScaleBasis());
      const hitStrokeId = hitTestStroke(strokesRef.current, point.x, point.y, hitRadius);
      const hitStroke = findStrokeById(strokesRef.current, hitStrokeId);

      onSelectDecoration(null);
      onSelectStroke(hitStrokeId);

      if (!hitStrokeId || !hitStroke) {
        movingStrokeRef.current = null;
        movingPointRef.current = null;
        return;
      }

      onEditStart();

      if (selectMode === "editPoint") {
        const pointIndex = hitTestStrokePoint(hitStroke, point.x, point.y, Math.max(hitRadius * 1.8, 0.028));
        movingPointRef.current = pointIndex === null ? null : { pointIndex, strokeId: hitStrokeId };
        movingStrokeRef.current = null;
        drawCanvas(strokesRef.current, decorationsRef.current);
        return;
      }

      movingStrokeRef.current = {
        originalPoints: hitStroke.points.map((strokePoint) => ({ ...strokePoint })),
        startPoint: point,
        strokeId: hitStrokeId,
      };
      movingPointRef.current = null;
      return;
    }

    if (tool === "eraser") {
      onSelectDecoration(null);
      onEditStart();
      erasingRef.current = true;
      eraseAtPoint(point.x, point.y);
      return;
    }

    if (tool === "eyes") {
      const hitDecoration = hitTestDecoration(point.x, point.y);

      if (hitDecoration) {
        onEditStart();
        activeDecorationIdRef.current = hitDecoration.id;
        onSelectDecoration(hitDecoration.id);
        return;
      }

      onSelectDecoration(null);
      return;
    }

    onEditStart();
    onSelectStroke(null);
    onSelectDecoration(null);

    const startPoint = {
      ...getPooledInkPoint(null, {
        ...point,
        pressure,
      }, event.timeStamp),
      pressure,
    };
    const stroke: GlyphStroke = {
      color: inkColor,
      ...(inkEffect === "bubbleHighlight" ? { highlightColor } : {}),
      id: makeStrokeId(),
      inkEffect,
      points: tool === "line" ? [startPoint, { ...startPoint }] : [startPoint],
      size: brushSize / getCanvasScaleBasis(),
      strokeTool: tool === "quill" ? "quill" : "pen",
    };

    activeStrokeRef.current = stroke;
    activeStrokeTimeRef.current = event.timeStamp;

    const nextStrokes = [...strokesRef.current, stroke];
    strokesRef.current = nextStrokes;
    onChangeStrokes(nextStrokes);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (activeGuideRef.current) {
      updateGuideFromPoint(activeGuideRef.current, getCanvasPoint(event));
      return;
    }

    if (tool === "pan" && panStartRef.current) {
      const dx = event.clientX - panStartRef.current.clientX;
      const dy = event.clientY - panStartRef.current.clientY;

      onChangeViewOffset({
        x: panStartRef.current.offset.x + dx,
        y: panStartRef.current.offset.y + dy,
      });
      return;
    }

    if (tool === "select") {
      const point = {
        ...getCanvasPoint(event),
        pressure: getEventPressure(event),
        ink: 0,
      };

      if (selectMode === "smoothCircle" || selectMode === "spreadCircle") {
        circleToolPointRef.current = point;

        if (circleToolActiveRef.current) {
          const changedStrokeId = selectMode === "spreadCircle" ? spreadCircleAtPoint(point) : smoothCircleAtPoint(point);
          onSelectStroke(changedStrokeId ?? selectedStrokeIdRef.current);
        } else {
          drawCanvas(strokesRef.current, decorationsRef.current);
        }

        return;
      }

      if (movingStrokeRef.current) {
        moveSelectedStroke(point);
      }

      if (movingPointRef.current) {
        moveSelectedPoint(point);
      }

      return;
    }

    if (tool === "eyes" && activeDecorationIdRef.current) {
      const point = getCanvasPoint(event);
      updateDecorationPosition(activeDecorationIdRef.current, point.x, point.y);
      return;
    }

    if (tool === "eraser" && erasingRef.current) {
      const point = getCanvasPoint(event);
      eraseAtPoint(point.x, point.y);
      return;
    }

    const stroke = activeStrokeRef.current;

    if (!stroke) {
      return;
    }

    if (tool === "line") {
      updateActiveLineStroke({
        ...getCanvasPoint(event),
        pressure: getEventPressure(event),
        ink: 0,
      });
      return;
    }

    const lastPoint = stroke.points[stroke.points.length - 1];
    const pressure = getEventPressure(event);
    const point = getSmoothedPoint(
      lastPoint,
      {
        ...getCanvasPoint(event),
        pressure,
        ink: 0,
      },
      smoothingMode,
    );
    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    const pooledPoint = getPooledInkPoint(lastPoint, point, event.timeStamp);

    if (distance < 0.0015 && (pooledPoint.spread ?? 0) <= 0) {
      return;
    }

    activeStrokeTimeRef.current = event.timeStamp;
    pushInkPoint(pooledPoint);
  }

  function finishStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activeStrokeRef.current = null;
    activeDecorationIdRef.current = null;
    movingStrokeRef.current = null;
    movingPointRef.current = null;
    circleToolActiveRef.current = false;
    erasingRef.current = false;
    activeGuideRef.current = null;
    panStartRef.current = null;
    drawCanvas(strokesRef.current, decorationsRef.current);
  }

  function eraseAtPoint(x: number, y: number) {
    const radius = Math.max(0.018, (brushSize / getCanvasScaleBasis()) * 2.2);
    const nextStrokes = eraserMode === "stroke"
      ? eraseStrokeNearPoint(strokesRef.current, x, y, radius)
      : eraseSegmentsNearPoint(strokesRef.current, x, y, radius);
    const nextDecorations = decorationsRef.current.filter(
      (decoration) => Math.hypot(decoration.x - x, decoration.y - y) > getEyeHitRadius(decoration),
    );

    const strokesChanged = nextStrokes.length !== strokesRef.current.length ||
      getStrokePointCount(nextStrokes) !== getStrokePointCount(strokesRef.current);

    if (strokesChanged) {
      strokesRef.current = nextStrokes;
      onChangeStrokes(nextStrokes);

      if (selectedStrokeIdRef.current && !nextStrokes.some((stroke) => stroke.id === selectedStrokeIdRef.current)) {
        onSelectStroke(null);
      }
    }

    if (nextDecorations.length !== decorationsRef.current.length) {
      decorationsRef.current = nextDecorations;
      onChangeDecorations(nextDecorations);

      if (
        selectedDecorationIdRef.current &&
        !nextDecorations.some((decoration) => decoration.id === selectedDecorationIdRef.current)
      ) {
        onSelectDecoration(null);
      }
    }
  }

  return (
    <div
      className="glyph-canvas-frame"
      style={{
        transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${viewScale})`,
      }}
    >
      <canvas
        ref={canvasRef}
        className={`glyph-canvas ${tool === "eraser" ? "eraser-cursor" : ""} ${tool === "eyes" ? "eyes-cursor" : ""} ${tool === "select" ? "select-cursor" : ""} ${tool === "pan" ? "pan-cursor" : ""} ${guideEditMode ? "guide-cursor" : ""}`}
        aria-label="Glyph drawing canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
        onPointerLeave={finishStroke}
      />
      <div ref={pixiHostRef} className="glyph-pixi-layer" />
    </div>
  );
}
