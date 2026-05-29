import { useEffect, useRef } from "react";
import type { PointerEvent } from "react";
import type { GlyphStroke } from "../types/fontTypes";
import { drawStrokePath } from "../render/glyphRenderer";

const CANVAS_SIZE = 720;

type GlyphCanvasProps = {
  strokes: GlyphStroke[];
  brushSize: number;
  tool: "pen" | "eraser";
  onEditStart: () => void;
  onChangeStrokes: (strokes: GlyphStroke[]) => void;
};

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function clampInk(value: number) {
  return Math.min(1, Math.max(0, value));
}

function makeStrokeId() {
  return `stroke_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function eraseNearPoint(strokes: GlyphStroke[], x: number, y: number, radius: number) {
  return strokes.filter((stroke) =>
    stroke.points.every((point) => Math.hypot(point.x - x, point.y - y) > radius),
  );
}

export default function GlyphCanvas({
  strokes,
  brushSize,
  tool,
  onEditStart,
  onChangeStrokes,
}: GlyphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef(strokes);
  const activeStrokeRef = useRef<GlyphStroke | null>(null);
  const activePointerRef = useRef<{
    lastBloomAt: number;
    lastSampleAt: number;
    x: number;
    y: number;
  } | null>(null);
  const inkPoolTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(null);
  const erasingRef = useRef(false);

  useEffect(() => {
    strokesRef.current = strokes;
    drawCanvas(strokes);
  }, [brushSize, strokes, tool]);

  useEffect(() => () => stopInkPooling(), []);

  function drawCanvas(nextStrokes: GlyphStroke[]) {
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

    drawGuides(ctx);

    ctx.strokeStyle = "#19140f";
    for (const stroke of nextStrokes) {
      drawStrokePath(ctx, stroke, 0, 0, CANVAS_SIZE);
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

  function getMotionInk(distance: number, elapsed: number, pressure: number) {
    const speed = elapsed > 0 ? distance / elapsed : 0;
    const slowInk = clampInk((0.0042 - speed) / 0.0042);
    const dwellInk = elapsed > 70 ? clampInk((elapsed - 70) / 360) : 0;
    const pressureInk = clampInk((pressure - 0.5) / 0.5);

    return clampInk(0.04 + slowInk * 0.42 + dwellInk * 0.34 + pressureInk * 0.2);
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

  function startInkPooling() {
    stopInkPooling();

    inkPoolTimerRef.current = window.setInterval(() => {
      const stroke = activeStrokeRef.current;
      const activePointer = activePointerRef.current;

      if (!stroke || !activePointer) {
        return;
      }

      const now = performance.now();
      const dwell = now - activePointer.lastSampleAt;

      if (dwell < 150 || now - activePointer.lastBloomAt < 155) {
        return;
      }

      activePointer.lastBloomAt = now;
      const lastPoint = stroke.points[stroke.points.length - 1];
      const bloom = clampInk((dwell - 90) / 820);

      pushInkPoint({
        x: activePointer.x,
        y: activePointer.y,
        pressure: Math.min(1, (lastPoint?.pressure ?? 0.62) + bloom * 0.18),
        ink: Math.max(lastPoint?.ink ?? 0, 0.3 + bloom * 0.7),
      });
    }, 155);
  }

  function stopInkPooling() {
    if (inkPoolTimerRef.current !== null) {
      window.clearInterval(inkPoolTimerRef.current);
      inkPoolTimerRef.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);

    const point = getCanvasPoint(event);
    const now = performance.now();
    const pressure = getEventPressure(event);

    onEditStart();

    if (tool === "eraser") {
      erasingRef.current = true;
      eraseAtPoint(point.x, point.y);
      return;
    }

    const stroke: GlyphStroke = {
      id: makeStrokeId(),
      points: [
        {
          ...point,
          pressure,
          ink: 0.16 + pressure * 0.18,
        },
      ],
      size: brushSize / CANVAS_SIZE,
    };

    activeStrokeRef.current = stroke;
    activePointerRef.current = {
      lastBloomAt: now,
      lastSampleAt: now,
      x: point.x,
      y: point.y,
    };
    startInkPooling();

    const nextStrokes = [...strokesRef.current, stroke];
    strokesRef.current = nextStrokes;
    onChangeStrokes(nextStrokes);
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (tool === "eraser" && erasingRef.current) {
      const point = getCanvasPoint(event);
      eraseAtPoint(point.x, point.y);
      return;
    }

    const stroke = activeStrokeRef.current;

    if (!stroke) {
      return;
    }

    const point = getCanvasPoint(event);
    const lastPoint = stroke.points[stroke.points.length - 1];
    const distance = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
    const now = performance.now();
    const activePointer = activePointerRef.current;
    const elapsed = activePointer ? now - activePointer.lastSampleAt : 0;

    if (distance < 0.0015 && elapsed < 80) {
      return;
    }

    const pressure = getEventPressure(event);
    const ink = getMotionInk(distance, elapsed, pressure);

    if (activePointer) {
      activePointer.lastSampleAt = now;
      activePointer.x = point.x;
      activePointer.y = point.y;
    }

    pushInkPoint({
      ...point,
      pressure,
      ink,
    });
  }

  function finishStroke(event: PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    activeStrokeRef.current = null;
    activePointerRef.current = null;
    erasingRef.current = false;
    stopInkPooling();
  }

  function eraseAtPoint(x: number, y: number) {
    const radius = Math.max(0.018, (brushSize / CANVAS_SIZE) * 2.2);
    const nextStrokes = eraseNearPoint(strokesRef.current, x, y, radius);

    if (nextStrokes.length !== strokesRef.current.length) {
      strokesRef.current = nextStrokes;
      onChangeStrokes(nextStrokes);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className={`glyph-canvas ${tool === "eraser" ? "eraser-cursor" : ""}`}
      aria-label="Glyph drawing canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishStroke}
      onPointerCancel={finishStroke}
      onPointerLeave={finishStroke}
    />
  );
}
