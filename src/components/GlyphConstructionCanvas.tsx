import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { drawConstructionPaths } from "../render/constructionRenderer";
import type {
  BackgroundStyle,
  BackgroundTexture,
  ConstructionAnchorPoint,
  ConstructionHandle,
  ConstructionPath,
  ConstructionPointType,
  FontGuideSettings,
  GlyphConstruction,
} from "../types/fontTypes";

export type ConstructionTool = "select" | "addPoint" | "penPath" | "handle" | "round" | "delete";

export type ConstructionSelection = {
  handle?: "in" | "out";
  pathId: string | null;
  pointId?: string | null;
  pendingNewPath?: boolean;
  segmentIndex?: number | null;
};

export type ConstructionSnapSettings = {
  anchors: boolean;
  centerline: boolean;
  grid: boolean;
  guides: boolean;
};

type DragState =
  | {
      kind: "point";
      pathId: string;
      pointId: string;
      startPoint: { x: number; y: number };
    }
  | {
      handle: "in" | "out";
      kind: "handle";
      pathId: string;
      pointId: string;
    }
  | {
      kind: "path";
      originalPath: ConstructionPath;
      pathId: string;
      startPoint: { x: number; y: number };
    };

type ConstructionCanvasProps = {
  backgroundAccentColor?: string;
  backgroundColor?: string;
  backgroundStyle?: BackgroundStyle;
  backgroundTexture?: BackgroundTexture;
  construction?: GlyphConstruction;
  guideSettings: FontGuideSettings;
  selection: ConstructionSelection;
  showGuides: boolean;
  snapSettings: ConstructionSnapSettings;
  tool: ConstructionTool;
  onChange: (construction: GlyphConstruction) => void;
  onEditStart: () => void;
  onSelectionChange: (selection: ConstructionSelection) => void;
};

const CANVAS_SIZE = 720;
const HIT_RADIUS = 14;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function makeConstructionId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clonePoint(point: ConstructionAnchorPoint): ConstructionAnchorPoint {
  return {
    ...point,
    ...(point.inHandle ? { inHandle: { ...point.inHandle } } : {}),
    ...(point.outHandle ? { outHandle: { ...point.outHandle } } : {}),
  };
}

function clonePath(path: ConstructionPath): ConstructionPath {
  return {
    ...path,
    points: path.points.map(clonePoint),
  };
}

function cloneConstruction(construction?: GlyphConstruction): GlyphConstruction {
  return {
    fillColor: construction?.fillColor,
    paths: construction?.paths.map(clonePath) ?? [],
    strokeColor: construction?.strokeColor,
  };
}

function makeAnchorPoint(x: number, y: number, type: ConstructionPointType = "corner"): ConstructionAnchorPoint {
  return {
    cornerStyle: type === "rounded" ? "rounded" : "sharp",
    id: makeConstructionId("anchor"),
    segmentType: "line",
    type,
    x,
    y,
  };
}

function makePath(point: ConstructionAnchorPoint): ConstructionPath {
  return {
    closed: false,
    filled: false,
    id: makeConstructionId("path"),
    points: [point],
    strokeWidth: 0.06,
  };
}

function getPointBySelection(construction: GlyphConstruction | undefined, selection: ConstructionSelection) {
  const path = construction?.paths.find((item) => item.id === selection.pathId);
  const point = path?.points.find((item) => item.id === selection.pointId);

  return { path, point };
}

function getThemeBackground(style: BackgroundStyle | undefined, color: string) {
  if (style === "midnight") {
    return "#101820";
  }

  if (style === "blush") {
    return "#ffe1df";
  }

  if (style === "sage") {
    return "#dfead6";
  }

  if (style === "sky") {
    return "#dcecff";
  }

  if (style === "lavender") {
    return "#eadfff";
  }

  return color;
}

function distanceToSegment(point: { x: number; y: number }, start: { x: number; y: number }, end: { x: number; y: number }) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq));
  const projection = {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };

  return Math.hypot(point.x - projection.x, point.y - projection.y);
}

export default function GlyphConstructionCanvas({
  backgroundAccentColor = "#d3bf97",
  backgroundColor = "#f4ead7",
  backgroundStyle = "paper",
  backgroundTexture = "grain",
  construction,
  guideSettings,
  selection,
  showGuides,
  snapSettings,
  tool,
  onChange,
  onEditStart,
  onSelectionChange,
}: ConstructionCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const constructionRef = useRef<GlyphConstruction | undefined>(construction);
  const dragRef = useRef<DragState | null>(null);
  const editStartedRef = useRef(false);

  useEffect(() => {
    constructionRef.current = construction;
    drawCanvas();
  }, [backgroundAccentColor, backgroundColor, backgroundStyle, backgroundTexture, construction, guideSettings, selection, showGuides, tool]);

  function getCanvasPoint(clientX: number, clientY: number) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width, rect.height));
    const left = rect.left + (rect.width - size) / 2;
    const top = rect.top + (rect.height - size) / 2;

    return {
      x: clamp((clientX - left) / size),
      y: clamp((clientY - top) / size),
    };
  }

  function toCanvasPoint(point: { x: number; y: number }, size = CANVAS_SIZE) {
    return {
      x: point.x * size,
      y: point.y * size,
    };
  }

  function snapPoint(point: { x: number; y: number }, ignoredPointId?: string | null) {
    let nextPoint = { ...point };
    const snapDistance = 0.018;

    if (snapSettings.grid) {
      nextPoint = {
        x: Math.round(nextPoint.x / 0.05) * 0.05,
        y: Math.round(nextPoint.y / 0.05) * 0.05,
      };
    }

    if (snapSettings.guides) {
      const guideValues = [
        guideSettings.ascender,
        guideSettings.xHeight,
        guideSettings.baseline,
        guideSettings.descender,
        guideSettings.leftBound,
        guideSettings.rightBound,
      ];

      for (const value of guideValues) {
        if (Math.abs(nextPoint.x - value) < snapDistance) {
          nextPoint.x = value;
        }
        if (Math.abs(nextPoint.y - value) < snapDistance) {
          nextPoint.y = value;
        }
      }
    }

    if (snapSettings.centerline) {
      if (Math.abs(nextPoint.x - 0.5) < snapDistance) {
        nextPoint.x = 0.5;
      }
      if (Math.abs(nextPoint.y - 0.5) < snapDistance) {
        nextPoint.y = 0.5;
      }
    }

    if (snapSettings.anchors) {
      for (const path of constructionRef.current?.paths ?? []) {
        for (const anchor of path.points) {
          if (anchor.id === ignoredPointId) {
            continue;
          }

          if (Math.hypot(anchor.x - nextPoint.x, anchor.y - nextPoint.y) < snapDistance) {
            nextPoint = { x: anchor.x, y: anchor.y };
          }
        }
      }
    }

    return {
      x: clamp(nextPoint.x),
      y: clamp(nextPoint.y),
    };
  }

  function updateConstruction(nextConstruction: GlyphConstruction) {
    constructionRef.current = nextConstruction;
    onChange(nextConstruction);
  }

  function updatePath(pathId: string, updater: (path: ConstructionPath) => ConstructionPath) {
    const nextConstruction = cloneConstruction(constructionRef.current);

    updateConstruction({
      ...nextConstruction,
      paths: nextConstruction.paths.map((path) => (path.id === pathId ? updater(path) : path)),
    });
  }

  function updatePoint(pathId: string, pointId: string, updater: (point: ConstructionAnchorPoint) => ConstructionAnchorPoint) {
    updatePath(pathId, (path) => ({
      ...path,
      points: path.points.map((point) => (point.id === pointId ? updater(point) : point)),
    }));
  }

  function maybeStartEdit() {
    if (editStartedRef.current) {
      return;
    }

    editStartedRef.current = true;
    onEditStart();
  }

  function hitTestHandle(point: { x: number; y: number }) {
    const { point: selectedPoint, path } = getPointBySelection(constructionRef.current, selection);

    if (!selectedPoint || !path) {
      return null;
    }

    for (const handleName of ["in", "out"] as const) {
      const handle = selectedPoint[`${handleName}Handle`];

      if (!handle) {
        continue;
      }

      const handleCanvasPoint = toCanvasPoint(handle);
      const pointerCanvasPoint = toCanvasPoint(point);

      if (Math.hypot(handleCanvasPoint.x - pointerCanvasPoint.x, handleCanvasPoint.y - pointerCanvasPoint.y) <= HIT_RADIUS) {
        return {
          handle: handleName,
          pathId: path.id,
          pointId: selectedPoint.id,
        };
      }
    }

    return null;
  }

  function hitTestPoint(point: { x: number; y: number }) {
    const pointerCanvasPoint = toCanvasPoint(point);

    for (const path of constructionRef.current?.paths ?? []) {
      for (const anchor of path.points) {
        const anchorCanvasPoint = toCanvasPoint(anchor);

        if (Math.hypot(anchorCanvasPoint.x - pointerCanvasPoint.x, anchorCanvasPoint.y - pointerCanvasPoint.y) <= HIT_RADIUS) {
          return { path, point: anchor };
        }
      }
    }

    return null;
  }

  function hitTestSegment(point: { x: number; y: number }) {
    const pointerCanvasPoint = toCanvasPoint(point);

    for (const path of constructionRef.current?.paths ?? []) {
      const limit = path.closed ? path.points.length : path.points.length - 1;

      for (let index = 0; index < limit; index += 1) {
        const start = path.points[index];
        const end = path.points[(index + 1) % path.points.length];

        if (!start || !end) {
          continue;
        }

        const distance = distanceToSegment(pointerCanvasPoint, toCanvasPoint(start), toCanvasPoint(end));

        if (distance <= HIT_RADIUS) {
          return { path, segmentIndex: index };
        }
      }
    }

    return null;
  }

  function addPoint(point: { x: number; y: number }, type: ConstructionPointType = "corner") {
    maybeStartEdit();
    const snappedPoint = snapPoint(point);
    const nextAnchor = makeAnchorPoint(snappedPoint.x, snappedPoint.y, type);
    const nextConstruction = cloneConstruction(constructionRef.current);
    const targetPathId = selection.pendingNewPath ? null : selection.pathId;

    if (!targetPathId) {
      const path = makePath(nextAnchor);
      updateConstruction({
        ...nextConstruction,
        paths: [...nextConstruction.paths, path],
      });
      onSelectionChange({ pathId: path.id, pointId: nextAnchor.id });
      return;
    }

    updateConstruction({
      ...nextConstruction,
      paths: nextConstruction.paths.map((path) =>
        path.id === targetPathId
          ? {
              ...path,
              points: [...path.points, nextAnchor],
            }
          : path,
      ),
    });
    onSelectionChange({ pathId: targetPathId, pointId: nextAnchor.id });
  }

  function deleteHitTarget(point: { x: number; y: number }) {
    const hitPoint = hitTestPoint(point);

    if (hitPoint) {
      maybeStartEdit();
      const nextConstruction = cloneConstruction(constructionRef.current);
      updateConstruction({
        ...nextConstruction,
        paths: nextConstruction.paths
          .map((path) =>
            path.id === hitPoint.path.id
              ? { ...path, points: path.points.filter((anchor) => anchor.id !== hitPoint.point.id) }
              : path,
          )
          .filter((path) => path.points.length > 0),
      });
      onSelectionChange({ pathId: null });
      return;
    }

    const hitSegment = hitTestSegment(point);

    if (hitSegment) {
      maybeStartEdit();
      const nextConstruction = cloneConstruction(constructionRef.current);
      updateConstruction({
        ...nextConstruction,
        paths: nextConstruction.paths.filter((path) => path.id !== hitSegment.path.id),
      });
      onSelectionChange({ pathId: null });
    }
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = getCanvasPoint(event.clientX, event.clientY);

    event.currentTarget.setPointerCapture(event.pointerId);

    if (tool === "addPoint" || tool === "penPath") {
      addPoint(point, tool === "penPath" ? "smooth" : "corner");
      return;
    }

    if (tool === "delete") {
      deleteHitTarget(point);
      return;
    }

    const hitHandle = hitTestHandle(point);

    if (hitHandle && (tool === "handle" || tool === "select")) {
      dragRef.current = {
        handle: hitHandle.handle,
        kind: "handle",
        pathId: hitHandle.pathId,
        pointId: hitHandle.pointId,
      };
      onSelectionChange({ handle: hitHandle.handle, pathId: hitHandle.pathId, pointId: hitHandle.pointId });
      return;
    }

    const hitPoint = hitTestPoint(point);

    if (hitPoint) {
      dragRef.current = {
        kind: "point",
        pathId: hitPoint.path.id,
        pointId: hitPoint.point.id,
        startPoint: point,
      };
      onSelectionChange({ pathId: hitPoint.path.id, pointId: hitPoint.point.id });
      return;
    }

    const hitSegment = hitTestSegment(point);

    if (hitSegment) {
      dragRef.current = {
        kind: "path",
        originalPath: clonePath(hitSegment.path),
        pathId: hitSegment.path.id,
        startPoint: point,
      };
      onSelectionChange({ pathId: hitSegment.path.id, segmentIndex: hitSegment.segmentIndex });
      return;
    }

    onSelectionChange({ pathId: null });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const point = getCanvasPoint(event.clientX, event.clientY);
    maybeStartEdit();

    if (drag.kind === "handle") {
      updatePoint(drag.pathId, drag.pointId, (anchor) => {
        const handle = snapPoint(point);
        const siblingHandle = drag.handle === "in" ? anchor.outHandle : anchor.inHandle;
        const nextPoint = {
          ...anchor,
          [`${drag.handle}Handle`]: handle,
          segmentType: "curve" as const,
          type: anchor.type === "corner" ? "smooth" as const : anchor.type,
        };

        if (anchor.type === "symmetric" && siblingHandle) {
          const mirrorHandle: ConstructionHandle = {
            x: clamp(anchor.x * 2 - handle.x),
            y: clamp(anchor.y * 2 - handle.y),
          };

          return {
            ...nextPoint,
            ...(drag.handle === "in" ? { outHandle: mirrorHandle } : { inHandle: mirrorHandle }),
          };
        }

        return nextPoint;
      });
      return;
    }

    if (drag.kind === "point") {
      updatePoint(drag.pathId, drag.pointId, (anchor) => {
        const nextPoint = snapPoint(point, anchor.id);
        const dx = nextPoint.x - anchor.x;
        const dy = nextPoint.y - anchor.y;

        return {
          ...anchor,
          ...(anchor.inHandle ? { inHandle: { x: clamp(anchor.inHandle.x + dx), y: clamp(anchor.inHandle.y + dy) } } : {}),
          ...(anchor.outHandle ? { outHandle: { x: clamp(anchor.outHandle.x + dx), y: clamp(anchor.outHandle.y + dy) } } : {}),
          x: nextPoint.x,
          y: nextPoint.y,
        };
      });
      return;
    }

    if (drag.kind === "path") {
      const dx = point.x - drag.startPoint.x;
      const dy = point.y - drag.startPoint.y;

      updatePath(drag.pathId, () => ({
        ...drag.originalPath,
        points: drag.originalPath.points.map((anchor) => ({
          ...anchor,
          ...(anchor.inHandle ? { inHandle: { x: clamp(anchor.inHandle.x + dx), y: clamp(anchor.inHandle.y + dy) } } : {}),
          ...(anchor.outHandle ? { outHandle: { x: clamp(anchor.outHandle.x + dx), y: clamp(anchor.outHandle.y + dy) } } : {}),
          x: clamp(anchor.x + dx),
          y: clamp(anchor.y + dy),
        })),
      }));
    }
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    editStartedRef.current = false;
  }

  function drawGuideLine(ctx: CanvasRenderingContext2D, value: number, axis: "x" | "y", label: string, color: string) {
    const position = value * CANVAS_SIZE;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    if (axis === "x") {
      ctx.moveTo(position, 0);
      ctx.lineTo(position, CANVAS_SIZE);
      ctx.fillStyle = color;
      ctx.fillText(label, position + 4, 14);
    } else {
      ctx.moveTo(0, position);
      ctx.lineTo(CANVAS_SIZE, position);
      ctx.fillStyle = color;
      ctx.fillText(label, 8, position - 5);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawCanvas() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");

    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";

    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    ctx.fillStyle = getThemeBackground(backgroundStyle, backgroundColor);
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    if (backgroundTexture !== "clean") {
      ctx.fillStyle = "rgba(70, 48, 25, 0.055)";
      for (let index = 0; index < 140; index += 1) {
        const x = (index * 97) % CANVAS_SIZE;
        const y = (index * 53) % CANVAS_SIZE;
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }

    ctx.strokeStyle = "rgba(23, 17, 11, 0.075)";
    ctx.lineWidth = 1;
    for (let index = 0; index <= 20; index += 1) {
      const position = index * (CANVAS_SIZE / 20);
      ctx.beginPath();
      ctx.moveTo(position, 0);
      ctx.lineTo(position, CANVAS_SIZE);
      ctx.moveTo(0, position);
      ctx.lineTo(CANVAS_SIZE, position);
      ctx.stroke();
    }

    if (showGuides) {
      ctx.font = "700 12px system-ui, sans-serif";
      drawGuideLine(ctx, guideSettings.baseline, "y", "baseline", "#2b8a99");
      drawGuideLine(ctx, guideSettings.xHeight, "y", "x-height", "#9b6f3b");
      drawGuideLine(ctx, guideSettings.ascender, "y", "ascender", "#c4933a");
      drawGuideLine(ctx, guideSettings.ascender + (guideSettings.xHeight - guideSettings.ascender) * 0.36, "y", "cap", "#d93434");
      drawGuideLine(ctx, guideSettings.descender, "y", "descender", "#8b4bd9");
      drawGuideLine(ctx, guideSettings.leftBound, "x", "left", "#68743c");
      drawGuideLine(ctx, guideSettings.rightBound, "x", "right", "#68743c");
      drawGuideLine(ctx, 0.5, "x", "center", "rgba(23, 17, 11, 0.34)");
    }

    drawConstructionPaths(ctx, constructionRef.current, {
      color: "#17110b",
      heightScale: 1,
      size: CANVAS_SIZE,
      widthScale: 1,
      x: 0,
      y: 0,
    });

    for (const path of constructionRef.current?.paths ?? []) {
      const isSelectedPath = path.id === selection.pathId && !selection.pointId;

      if (isSelectedPath) {
        ctx.save();
        ctx.strokeStyle = "#82d0bc";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        drawConstructionPaths(ctx, { paths: [path] }, {
          color: "#82d0bc",
          heightScale: 1,
          size: CANVAS_SIZE,
          widthScale: 1,
          x: 0,
          y: 0,
        });
        ctx.restore();
      }

      for (const anchor of path.points) {
        const point = toCanvasPoint(anchor);
        const selected = path.id === selection.pathId && anchor.id === selection.pointId;

        if (selected) {
          ctx.save();
          ctx.strokeStyle = "#82d0bc";
          ctx.lineWidth = 1.5;
          ctx.fillStyle = "#f8f0df";

          for (const handleName of ["in", "out"] as const) {
            const handle = anchor[`${handleName}Handle`];

            if (!handle) {
              continue;
            }

            const handlePoint = toCanvasPoint(handle);
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(handlePoint.x, handlePoint.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(handlePoint.x, handlePoint.y, 5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = selected ? "#82d0bc" : "#17110b";
        ctx.strokeStyle = selected ? "#f8f0df" : backgroundAccentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (anchor.type === "corner") {
          ctx.rect(point.x - 5, point.y - 5, 10, 10);
        } else {
          ctx.arc(point.x, point.y, anchor.type === "rounded" ? 7 : 6, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  return (
    <div className="construction-canvas-shell">
      <canvas
        ref={canvasRef}
        className="construction-canvas"
        aria-label="Letter construction canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </div>
  );
}
