import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import type { FontRenderProfile, Glyph, GlyphDecoration, GlyphInkEffect, GlyphStroke } from "../types/fontTypes";
import { drawGlyphDecoration, drawStrokePath } from "../render/glyphRenderer";

const CANVAS_SIZE = 720;

export type CanvasViewOffset = {
  x: number;
  y: number;
};

export type DrawingTool = "pen" | "quill" | "eraser" | "eyes" | "select" | "pan";
export type EraserMode = "stroke" | "point";
export type SmoothingMode = "raw" | "gentle" | "strong";

type GlyphCanvasProps = {
  strokes: GlyphStroke[];
  decorations: GlyphDecoration[];
  brushSize: number;
  eyeExpression: NonNullable<GlyphDecoration["expression"]>;
  eraserMode: EraserMode;
  inkEffect: GlyphInkEffect;
  inkColor: string;
  referenceGlyph?: Glyph | null;
  renderProfile?: FontRenderProfile;
  selectedStrokeId: string | null;
  showGuides: boolean;
  smoothingMode: SmoothingMode;
  tool: DrawingTool;
  viewOffset: CanvasViewOffset;
  viewScale: number;
  onEditStart: () => void;
  onChangeViewOffset: (offset: CanvasViewOffset) => void;
  onChangeDecorations: (decorations: GlyphDecoration[]) => void;
  onChangeStrokes: (strokes: GlyphStroke[]) => void;
  onSelectStroke: (strokeId: string | null) => void;
};

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
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
  const safeInset = getEyeHitRadius(decoration);

  return {
    ...decoration,
    x: Math.min(1 - safeInset, Math.max(safeInset, x)),
    y: Math.min(1 - safeInset, Math.max(safeInset, y)),
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
  brushSize,
  eyeExpression,
  eraserMode,
  inkEffect,
  inkColor,
  referenceGlyph,
  renderProfile = "plain",
  selectedStrokeId,
  showGuides,
  smoothingMode,
  tool,
  viewOffset,
  viewScale,
  onEditStart,
  onChangeViewOffset,
  onChangeDecorations,
  onChangeStrokes,
  onSelectStroke,
}: GlyphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef(strokes);
  const decorationsRef = useRef(decorations);
  const selectedStrokeIdRef = useRef(selectedStrokeId);
  const viewOffsetRef = useRef(viewOffset);
  const activeStrokeRef = useRef<GlyphStroke | null>(null);
  const activeDecorationIdRef = useRef<string | null>(null);
  const erasingRef = useRef(false);
  const panStartRef = useRef<{
    clientX: number;
    clientY: number;
    offset: CanvasViewOffset;
  } | null>(null);

  useEffect(() => {
    strokesRef.current = strokes;
    decorationsRef.current = decorations;
    selectedStrokeIdRef.current = selectedStrokeId;
    drawCanvas(strokes, decorations);
  }, [brushSize, decorations, eyeExpression, inkEffect, referenceGlyph, renderProfile, selectedStrokeId, showGuides, strokes, tool]);

  useEffect(() => {
    viewOffsetRef.current = viewOffset;
  }, [viewOffset]);

  function drawCanvas(nextStrokes: GlyphStroke[], nextDecorations: GlyphDecoration[]) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = "#f4ead7";
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (showGuides) {
      drawGuides(ctx);
    }

    if (referenceGlyph) {
      drawReferenceGlyph(ctx, referenceGlyph);
    }

    for (const stroke of nextStrokes) {
      drawStrokePath(
        ctx,
        stroke,
        0,
        0,
        CANVAS_SIZE,
        CANVAS_SIZE,
        CANVAS_SIZE,
        "#19140f",
        { renderProfile, skipInkEffect: activeStrokeRef.current?.id === stroke.id },
      );
    }

    const selectedStroke = nextStrokes.find((stroke) => stroke.id === selectedStrokeId);

    if (selectedStroke) {
      drawStrokeSelection(ctx, selectedStroke);
    }

    for (const decoration of nextDecorations) {
      drawGlyphDecoration(ctx, decoration, 0, 0, CANVAS_SIZE);
    }

    if (tool === "eraser") {
      ctx.strokeStyle = "rgba(133, 58, 57, 0.42)";
      ctx.lineWidth = 3;
      ctx.setLineDash([12, 10]);
      ctx.beginPath();
      ctx.arc(CANVAS_SIZE - 48, 48, Math.max(12, brushSize * 1.4), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (tool === "eyes") {
      ctx.save();
      ctx.strokeStyle = "rgba(25, 20, 15, 0.34)";
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]);
      ctx.beginPath();
      ctx.arc(CANVAS_SIZE - 52, 52, 24, 0, Math.PI * 2);
      ctx.arc(CANVAS_SIZE - 104, 52, 24, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      drawGlyphDecoration(
        ctx,
        {
          expression: eyeExpression,
          id: `eye_preview_${eyeExpression}`,
          kind: "googly-eyes",
          size: 0.034,
          x: 0.89,
          y: 0.072,
        },
        0,
        0,
        CANVAS_SIZE,
      );
    }
  }

  function drawGuides(ctx: CanvasRenderingContext2D) {
    const horizontalGuides = [
      { y: 0.14, color: "rgba(41, 128, 145, 0.55)", label: "ascender" },
      { y: 0.42, color: "rgba(181, 132, 42, 0.58)", label: "x-height" },
      { y: 0.76, color: "rgba(35, 112, 76, 0.7)", label: "baseline" },
      { y: 0.9, color: "rgba(133, 58, 57, 0.58)", label: "descender" },
    ];

    ctx.save();
    ctx.lineWidth = 2;
    ctx.font = "14px Inter, ui-sans-serif, system-ui";
    ctx.textBaseline = "middle";

    for (const guide of horizontalGuides) {
      const y = guide.y * CANVAS_SIZE;
      ctx.strokeStyle = guide.color;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(CANVAS_SIZE, y);
      ctx.stroke();
      ctx.fillStyle = guide.color;
      ctx.fillText(guide.label, 18, y - 12);
    }

    ctx.strokeStyle = "rgba(25, 20, 15, 0.14)";
    ctx.lineWidth = 1;
    for (const x of [0.1, 0.9]) {
      const px = x * CANVAS_SIZE;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, CANVAS_SIZE);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawStrokeSelection(ctx: CanvasRenderingContext2D, stroke: GlyphStroke) {
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
    const padding = Math.max(10, stroke.size * CANVAS_SIZE * 2.6);
    const left = bounds.minX * CANVAS_SIZE - padding;
    const top = bounds.minY * CANVAS_SIZE - padding;
    const width = (bounds.maxX - bounds.minX) * CANVAS_SIZE + padding * 2;
    const height = (bounds.maxY - bounds.minY) * CANVAS_SIZE + padding * 2;

    ctx.save();
    ctx.strokeStyle = "rgba(36, 104, 201, 0.86)";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(left, top, Math.max(12, width), Math.max(12, height));
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(36, 104, 201, 0.92)";
    for (const point of stroke.points) {
      ctx.beginPath();
      ctx.arc(point.x * CANVAS_SIZE, point.y * CANVAS_SIZE, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawReferenceGlyph(ctx: CanvasRenderingContext2D, glyph: Glyph) {
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
        CANVAS_SIZE,
        CANVAS_SIZE,
        CANVAS_SIZE,
        "#2468c9",
        { renderProfile },
      );
    }

    ctx.globalAlpha = 0.24;
    for (const decoration of glyph.decorations ?? []) {
      drawGlyphDecoration(ctx, decoration, 0, 0, CANVAS_SIZE);
    }

    ctx.restore();
  }

  function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();

    return {
      x: clamp((event.clientX - rect.left) / rect.width),
      y: clamp((event.clientY - rect.top) / rect.height),
    };
  }

  function getEventPressure(event: PointerEvent<HTMLCanvasElement>) {
    const eventPressure = event.pressure > 0 ? event.pressure : undefined;

    return Math.min(1, Math.max(0.48, eventPressure ?? (event.pointerType === "mouse" ? 0.58 : 0.66)));
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

  function placeGooglyEyes(x: number, y: number) {
    const decoration: GlyphDecoration = moveDecoration(
      {
        expression: eyeExpression,
        id: makeDecorationId(),
        kind: "googly-eyes",
        size: Math.min(0.075, Math.max(0.032, (brushSize / CANVAS_SIZE) * 3.25)),
        x,
        y,
      },
      x,
      y,
    );
    const nextDecorations = [...decorationsRef.current, decoration];

    decorationsRef.current = nextDecorations;
    activeDecorationIdRef.current = decoration.id;
    onChangeDecorations(nextDecorations);
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    const point = getCanvasPoint(event);
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
      onSelectStroke(hitTestStroke(strokesRef.current, point.x, point.y, Math.max(0.02, brushSize / CANVAS_SIZE)));
      return;
    }

    if (tool === "eraser") {
      onEditStart();
      erasingRef.current = true;
      eraseAtPoint(point.x, point.y);
      return;
    }

    if (tool === "eyes") {
      onEditStart();
      const hitDecoration = hitTestDecoration(point.x, point.y);

      if (hitDecoration) {
        activeDecorationIdRef.current = hitDecoration.id;
        return;
      }

      placeGooglyEyes(point.x, point.y);
      return;
    }

    onEditStart();
    onSelectStroke(null);

    const stroke: GlyphStroke = {
      color: inkColor,
      id: makeStrokeId(),
      inkEffect,
      points: [
        {
          ...point,
          pressure,
          ink: 0,
        },
      ],
      size: brushSize / CANVAS_SIZE,
      strokeTool: tool === "quill" ? "quill" : "pen",
    };

    activeStrokeRef.current = stroke;

    const nextStrokes = [...strokesRef.current, stroke];
    strokesRef.current = nextStrokes;
    onChangeStrokes(nextStrokes);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (tool === "pan" && panStartRef.current) {
      const dx = event.clientX - panStartRef.current.clientX;
      const dy = event.clientY - panStartRef.current.clientY;

      onChangeViewOffset({
        x: panStartRef.current.offset.x + dx,
        y: panStartRef.current.offset.y + dy,
      });
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

    if (distance < 0.0015) {
      return;
    }

    pushInkPoint(point);
  }

  function finishStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activeStrokeRef.current = null;
    activeDecorationIdRef.current = null;
    erasingRef.current = false;
    panStartRef.current = null;
    drawCanvas(strokesRef.current, decorationsRef.current);
  }

  function eraseAtPoint(x: number, y: number) {
    const radius = Math.max(0.018, (brushSize / CANVAS_SIZE) * 2.2);
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
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className={`glyph-canvas ${tool === "eraser" ? "eraser-cursor" : ""} ${tool === "eyes" ? "eyes-cursor" : ""} ${tool === "select" ? "select-cursor" : ""} ${tool === "pan" ? "pan-cursor" : ""}`}
      style={{
        transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${viewScale})`,
      }}
      aria-label="Glyph drawing canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      onPointerLeave={finishStroke}
    />
  );
}
