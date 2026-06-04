import { useEffect, useRef } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { drawConstructionPaths } from "../render/constructionRenderer";
import type {
  BackgroundStyle,
  BackgroundTexture,
  ConstructionAnchorPoint,
  ConstructionPath,
  FontGuideSettings,
  GlyphConstruction,
} from "../types/fontTypes";

export type ConstructionHandleKind = "in" | "out";
export type ConstructionTool = "select" | "point" | "delete";

export type ConstructionSelection = {
  handle?: ConstructionHandleKind | null;
  pathId: string | null;
  pointId?: string | null;
  pendingNewPath?: boolean;
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
      kind: "path";
      originalPath: ConstructionPath;
      pathId: string;
      startPoint: { x: number; y: number };
    }
  | {
      handle: ConstructionHandleKind;
      kind: "handle";
      pathId: string;
      pointId: string;
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
  strokeColor?: string;
  strokeWidth?: number;
  tool: ConstructionTool;
  onChange: (construction: GlyphConstruction) => void;
  onEditStart: () => void;
  onSelectionChange: (selection: ConstructionSelection) => void;
};

const CANVAS_SIZE = 720;
const HANDLE_RADIUS = 8;
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

function makeAnchorPoint(x: number, y: number): ConstructionAnchorPoint {
  return {
    cornerStyle: "sharp",
    id: makeConstructionId("anchor"),
    segmentType: "line",
    type: "corner",
    x,
    y,
  };
}

function makePath(point: ConstructionAnchorPoint, strokeColor: string, strokeWidth: number): ConstructionPath {
  return {
    closed: false,
    filled: false,
    id: makeConstructionId("path"),
    points: [point],
    strokeColor,
    strokeWidth,
  };
}

function getPointHandle(point: ConstructionAnchorPoint, handle: ConstructionHandleKind) {
  return handle === "in" ? point.inHandle : point.outHandle;
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

  if (style === "strawberryRed") {
    return "#f18a96";
  }

  if (style === "berryPink") {
    return "#f7a8c3";
  }

  if (style === "strawberryCream") {
    return "#fff4ee";
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

function getPathBounds(path: ConstructionPath) {
  const points = path.points.flatMap((anchor) => [
    { x: anchor.x, y: anchor.y },
    ...(anchor.inHandle ? [{ x: anchor.inHandle.x, y: anchor.inHandle.y }] : []),
    ...(anchor.outHandle ? [{ x: anchor.outHandle.x, y: anchor.outHandle.y }] : []),
  ]);

  return points.reduce(
    (bounds, point) => ({
      maxX: Math.max(bounds.maxX, point.x),
      maxY: Math.max(bounds.maxY, point.y),
      minX: Math.min(bounds.minX, point.x),
      minY: Math.min(bounds.minY, point.y),
    }),
    { maxX: 0, maxY: 0, minX: 1, minY: 1 },
  );
}

function clampPathDelta(path: ConstructionPath, dx: number, dy: number) {
  const bounds = getPathBounds(path);

  return {
    dx: Math.min(1 - bounds.maxX, Math.max(-bounds.minX, dx)),
    dy: Math.min(1 - bounds.maxY, Math.max(-bounds.minY, dy)),
  };
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
  strokeColor = "#17110b",
  strokeWidth = 0.06,
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
  }, [backgroundAccentColor, backgroundColor, backgroundStyle, backgroundTexture, construction, guideSettings, selection, showGuides, strokeColor, strokeWidth, tool]);

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

  function snapPoint(point: { x: number; y: number }, ignoredPointIds?: string | null | Set<string>) {
    let nextPoint = { ...point };
    const snapDistance = 0.018;
    const ignoredIds =
      ignoredPointIds instanceof Set ? ignoredPointIds : ignoredPointIds ? new Set([ignoredPointIds]) : null;

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
          if (ignoredIds?.has(anchor.id)) {
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

  function getSnappedPathDelta(path: ConstructionPath, rawDx: number, rawDy: number) {
    if (!Object.values(snapSettings).some(Boolean)) {
      return clampPathDelta(path, rawDx, rawDy);
    }

    const ignoredPointIds = new Set(path.points.map((anchor) => anchor.id));
    const bounds = getPathBounds(path);
    const snapTargets = [
      ...path.points.map((anchor) => ({ x: anchor.x, y: anchor.y })),
      {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      },
    ];
    let bestDelta = { dx: rawDx, dy: rawDy };
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const target of snapTargets) {
      const snappedPoint = snapPoint({ x: target.x + rawDx, y: target.y + rawDy }, ignoredPointIds);
      const candidateDelta = {
        dx: snappedPoint.x - target.x,
        dy: snappedPoint.y - target.y,
      };
      const distance = Math.hypot(candidateDelta.dx - rawDx, candidateDelta.dy - rawDy);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestDelta = candidateDelta;
      }
    }

    return clampPathDelta(path, bestDelta.dx, bestDelta.dy);
  }

  function isPathLocked(path: ConstructionPath) {
    return Boolean(selection.pathId && !selection.pendingNewPath && path.id !== selection.pathId);
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

  function hitTestPoint(point: { x: number; y: number }) {
    const pointerCanvasPoint = toCanvasPoint(point);

    for (const path of constructionRef.current?.paths ?? []) {
      if (isPathLocked(path)) {
        continue;
      }

      for (const anchor of path.points) {
        const anchorCanvasPoint = toCanvasPoint(anchor);

        if (Math.hypot(anchorCanvasPoint.x - pointerCanvasPoint.x, anchorCanvasPoint.y - pointerCanvasPoint.y) <= HIT_RADIUS) {
          return { path, point: anchor };
        }
      }
    }

    return null;
  }

  function hitTestHandle(point: { x: number; y: number }) {
    if (!selection.pathId || !selection.pointId) {
      return null;
    }

    const path = constructionRef.current?.paths.find((candidate) => candidate.id === selection.pathId);

    if (!path || isPathLocked(path)) {
      return null;
    }

    const anchor = path.points.find((candidate) => candidate.id === selection.pointId);

    if (!anchor) {
      return null;
    }

    const pointerCanvasPoint = toCanvasPoint(point);
    const handles: ConstructionHandleKind[] = ["in", "out"];

    for (const handle of handles) {
      const handlePoint = getPointHandle(anchor, handle);

      if (!handlePoint) {
        continue;
      }

      const handleCanvasPoint = toCanvasPoint(handlePoint);

      if (Math.hypot(handleCanvasPoint.x - pointerCanvasPoint.x, handleCanvasPoint.y - pointerCanvasPoint.y) <= HIT_RADIUS) {
        return { handle, path, point: anchor };
      }
    }

    return null;
  }

  function hitTestSegment(point: { x: number; y: number }) {
    const pointerCanvasPoint = toCanvasPoint(point);

    for (const path of constructionRef.current?.paths ?? []) {
      if (isPathLocked(path)) {
        continue;
      }

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

  function addAnchor(point: { x: number; y: number }, connectToSelectedPath: boolean) {
    maybeStartEdit();
    const snappedPoint = snapPoint(point);
    const nextAnchor = makeAnchorPoint(snappedPoint.x, snappedPoint.y);
    const nextConstruction = cloneConstruction(constructionRef.current);
    const targetPathId = connectToSelectedPath && !selection.pendingNewPath ? selection.pathId : null;

    if (!targetPathId) {
      const path = makePath(nextAnchor, strokeColor, strokeWidth);
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

    if (tool === "point") {
      addAnchor(point, true);
      return;
    }

    if (tool === "delete") {
      deleteHitTarget(point);
      return;
    }

    const hitHandle = hitTestHandle(point);

    if (hitHandle) {
      dragRef.current = {
        handle: hitHandle.handle,
        kind: "handle",
        pathId: hitHandle.path.id,
        pointId: hitHandle.point.id,
      };
      onSelectionChange({ handle: hitHandle.handle, pathId: hitHandle.path.id, pointId: hitHandle.point.id });
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
      onSelectionChange({ pathId: hitSegment.path.id });
      return;
    }

    onSelectionChange(selection.pathId && !selection.pendingNewPath ? { pathId: selection.pathId } : { pathId: null });
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;

    if (!drag) {
      return;
    }

    const point = getCanvasPoint(event.clientX, event.clientY);
    maybeStartEdit();

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

    if (drag.kind === "handle") {
      const nextPoint = snapPoint(point, drag.pointId);

      updatePoint(drag.pathId, drag.pointId, (anchor) => ({
        ...anchor,
        segmentType: "curve",
        type: anchor.type === "corner" ? "smooth" : anchor.type,
        ...(drag.handle === "in"
          ? { inHandle: { x: nextPoint.x, y: nextPoint.y } }
          : { outHandle: { x: nextPoint.x, y: nextPoint.y } }),
      }));
      return;
    }

    if (drag.kind === "path") {
      const rawDx = point.x - drag.startPoint.x;
      const rawDy = point.y - drag.startPoint.y;
      const { dx, dy } = getSnappedPathDelta(drag.originalPath, rawDx, rawDy);

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
      drawGuideLine(ctx, guideSettings.xHeight, "y", "height", "#9b6f3b");
      drawGuideLine(ctx, guideSettings.ascender, "y", "ascender", "#c4933a");
      drawGuideLine(ctx, guideSettings.descender, "y", "descender", "#8b4bd9");
      drawGuideLine(ctx, guideSettings.leftBound, "x", "left", "#68743c");
      drawGuideLine(ctx, guideSettings.rightBound, "x", "right", "#68743c");
      drawGuideLine(ctx, 0.5, "x", "center", "rgba(23, 17, 11, 0.34)");
    }

    for (const path of constructionRef.current?.paths ?? []) {
      const locked = isPathLocked(path);
      const isSelectedPath = path.id === selection.pathId && !selection.pointId;

      ctx.save();
      ctx.globalAlpha = locked ? 0.22 : 1;
      drawConstructionPaths(ctx, { paths: [path] }, {
        color: "#17110b",
        heightScale: 1,
        size: CANVAS_SIZE,
        widthScale: 1,
        x: 0,
        y: 0,
      });
      ctx.restore();

      if (isSelectedPath) {
        ctx.save();
        ctx.strokeStyle = "#82d0bc";
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        drawConstructionPaths(ctx, { paths: [{ ...path, strokeColor: "#82d0bc" }] }, {
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

        ctx.globalAlpha = locked ? 0.24 : 1;

        if (selected) {
          const handles: ConstructionHandleKind[] = ["in", "out"];

          for (const handle of handles) {
            const handlePoint = getPointHandle(anchor, handle);

            if (!handlePoint) {
              continue;
            }

            const handleCanvasPoint = toCanvasPoint(handlePoint);
            const isActiveHandle = selection.handle === handle;

            ctx.save();
            ctx.strokeStyle = isActiveHandle ? "#f3c766" : "#82d0bc";
            ctx.lineWidth = isActiveHandle ? 2.5 : 1.8;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(point.x, point.y);
            ctx.lineTo(handleCanvasPoint.x, handleCanvasPoint.y);
            ctx.stroke();

            ctx.setLineDash([]);
            ctx.fillStyle = isActiveHandle ? "#f3c766" : "#f8f0df";
            ctx.strokeStyle = "#82d0bc";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(handleCanvasPoint.x, handleCanvasPoint.y, HANDLE_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
          }

          ctx.save();
          ctx.strokeStyle = "#82d0bc";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(point.x, point.y, 13, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        ctx.save();
        ctx.fillStyle = selected ? "#82d0bc" : "#17110b";
        ctx.strokeStyle = selected ? "#f8f0df" : backgroundAccentColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(point.x - 5, point.y - 5, 10, 10);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
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
