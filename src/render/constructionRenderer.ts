import type {
  ConstructionAnchorPoint,
  ConstructionPath,
  GlyphConstruction,
} from "../types/fontTypes";

type ConstructionDrawOptions = {
  color: string;
  heightScale: number;
  widthScale: number;
  x: number;
  y: number;
  size: number;
};

type DrawPoint = {
  x: number;
  y: number;
};

export function hasConstructionMarks(construction: GlyphConstruction | undefined) {
  return Boolean(construction?.paths.some((path) => path.points.length > 0));
}

function getCanvasPoint(
  point: ConstructionAnchorPoint | DrawPoint,
  options: ConstructionDrawOptions,
): DrawPoint {
  return {
    x: options.x + point.x * options.size * options.widthScale,
    y: options.y + point.y * options.size * options.heightScale,
  };
}

function distance(first: DrawPoint, second: DrawPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointAlong(from: DrawPoint, to: DrawPoint, amount: number): DrawPoint {
  const length = Math.max(0.0001, distance(from, to));
  const ratio = Math.min(0.48, Math.max(0, amount / length));

  return {
    x: from.x + (to.x - from.x) * ratio,
    y: from.y + (to.y - from.y) * ratio,
  };
}

function getCornerDistance(point: ConstructionAnchorPoint, options: ConstructionDrawOptions) {
  if (point.cornerStyle === "chamfered") {
    return (point.chamferDistance ?? 0.04) * options.size;
  }

  if (point.cornerStyle === "rounded" || point.type === "rounded") {
    return (point.cornerRadius ?? 0.04) * options.size;
  }

  return 0;
}

function getCornerEntry(
  path: ConstructionPath,
  index: number,
  options: ConstructionDrawOptions,
): DrawPoint {
  const point = path.points[index];
  const previous = path.points[index - 1] ?? (path.closed ? path.points[path.points.length - 1] : undefined);

  if (!point || !previous) {
    return getCanvasPoint(point, options);
  }

  const cornerDistance = getCornerDistance(point, options);

  if (cornerDistance <= 0) {
    return getCanvasPoint(point, options);
  }

  return pointAlong(getCanvasPoint(point, options), getCanvasPoint(previous, options), cornerDistance);
}

function getCornerExit(
  path: ConstructionPath,
  index: number,
  options: ConstructionDrawOptions,
): DrawPoint {
  const point = path.points[index];
  const next = path.points[index + 1] ?? (path.closed ? path.points[0] : undefined);

  if (!point || !next) {
    return getCanvasPoint(point, options);
  }

  const cornerDistance = getCornerDistance(point, options);

  if (cornerDistance <= 0) {
    return getCanvasPoint(point, options);
  }

  return pointAlong(getCanvasPoint(point, options), getCanvasPoint(next, options), cornerDistance);
}

function drawSegmentTo(
  ctx: CanvasRenderingContext2D,
  fromPoint: ConstructionAnchorPoint,
  toPoint: ConstructionAnchorPoint,
  toDrawPoint: DrawPoint,
  options: ConstructionDrawOptions,
) {
  const usesCurve = fromPoint.segmentType === "curve" || Boolean(fromPoint.outHandle || toPoint.inHandle);

  if (!usesCurve) {
    ctx.lineTo(toDrawPoint.x, toDrawPoint.y);
    return;
  }

  const fromCanvas = getCanvasPoint(fromPoint, options);
  const toCanvas = getCanvasPoint(toPoint, options);
  const outHandle = fromPoint.outHandle ? getCanvasPoint(fromPoint.outHandle, options) : fromCanvas;
  const inHandle = toPoint.inHandle ? getCanvasPoint(toPoint.inHandle, options) : toCanvas;

  ctx.bezierCurveTo(outHandle.x, outHandle.y, inHandle.x, inHandle.y, toDrawPoint.x, toDrawPoint.y);
}

function drawPathShape(
  ctx: CanvasRenderingContext2D,
  path: ConstructionPath,
  options: ConstructionDrawOptions,
) {
  const points = path.points;

  if (points.length === 0) {
    return;
  }

  const startPoint = path.closed ? getCornerExit(path, 0, options) : getCanvasPoint(points[0], options);

  ctx.beginPath();
  ctx.moveTo(startPoint.x, startPoint.y);

  const segmentCount = path.closed ? points.length : points.length - 1;

  for (let index = 0; index < segmentCount; index += 1) {
    const fromIndex = index;
    const toIndex = (index + 1) % points.length;
    const fromPoint = points[fromIndex];
    const toPoint = points[toIndex];
    const toEntry = path.closed || toIndex < points.length - 1
      ? getCornerEntry(path, toIndex, options)
      : getCanvasPoint(toPoint, options);

    drawSegmentTo(ctx, fromPoint, toPoint, toEntry, options);

    if ((path.closed || toIndex < points.length - 1) && getCornerDistance(toPoint, options) > 0) {
      const corner = getCanvasPoint(toPoint, options);
      const exit = getCornerExit(path, toIndex, options);

      if (toPoint.cornerStyle === "chamfered") {
        ctx.lineTo(exit.x, exit.y);
      } else {
        ctx.quadraticCurveTo(corner.x, corner.y, exit.x, exit.y);
      }
    }
  }

  if (path.closed) {
    ctx.closePath();
  }
}

export function drawConstructionPaths(
  ctx: CanvasRenderingContext2D,
  construction: GlyphConstruction | undefined,
  options: ConstructionDrawOptions,
) {
  if (!construction) {
    return;
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const path of construction.paths) {
    if (path.points.length === 0) {
      continue;
    }

    drawPathShape(ctx, path, options);

    if (path.closed && path.filled) {
      ctx.fillStyle = path.fillColor ?? construction.fillColor ?? options.color;
      ctx.fill();
    }

    ctx.strokeStyle = path.strokeColor ?? construction.strokeColor ?? options.color;
    ctx.lineWidth = Math.max(1, path.strokeWidth * options.size);
    ctx.stroke();
  }

  ctx.restore();
}
