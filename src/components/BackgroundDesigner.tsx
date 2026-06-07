import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Brush,
  Copy,
  Droplets,
  Eraser,
  Eye,
  EyeOff,
  Layers,
  Menu,
  MoveDown,
  MoveUp,
  PaintBucket,
  Pipette,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  createCustomBackgroundId,
  createCustomBackgroundLayer,
  deleteCustomBackgroundImages,
  getCustomBackgroundLayerBlob,
  putCustomBackgroundFlatBlob,
  putCustomBackgroundLayerBlob,
  saveCustomBackgrounds,
  upsertCustomBackground,
  type CustomBackground,
  type CustomBackgroundFormatId,
  type CustomBackgroundLayer,
} from "../storage/customBackgroundStorage";

type PaintTool = "watercolor" | "eraser" | "smudge" | "fill";
type ActivePanel = "paint" | "layers" | "format" | "saved" | "settings";

type PaintLayer = CustomBackgroundLayer & {
  canvas: HTMLCanvasElement;
};

type HistorySnapshot = {
  dataUrl: string;
  layerId: string;
};

type PaintPointer = {
  id: number;
  lastX: number;
  lastY: number;
  tool: PaintTool;
};

type BackgroundDesignerProps = {
  backgrounds: CustomBackground[];
  onBackgroundsChange: (backgrounds: CustomBackground[]) => void;
  onOpenAppMenu?: () => void;
};

const backgroundFormats: Array<{
  height: number;
  id: CustomBackgroundFormatId;
  label: string;
  width: number;
}> = [
  { id: "phone", label: "Phone", width: 1080, height: 1920 },
  { id: "square", label: "Square", width: 1080, height: 1080 },
  { id: "portrait", label: "Portrait", width: 2550, height: 3300 },
  { id: "landscape", label: "Landscape", width: 3300, height: 2550 },
  { id: "custom", label: "Custom", width: 1080, height: 1920 },
];

const paintSwatches = ["#F48FB1", "#E96A7A", "#8BCF8A", "#F2C66D", "#7FB5E8", "#5A4035", "#FFFFFF", "#111111"];

export function BackgroundDesigner({
  backgrounds,
  onBackgroundsChange,
  onOpenAppMenu,
}: BackgroundDesignerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const scratchCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activePaintRef = useRef<PaintPointer | null>(null);
  const [activeBackgroundId, setActiveBackgroundId] = useState(() => backgrounds[0]?.id ?? "");
  const [activeLayerId, setActiveLayerId] = useState("");
  const [activePanel, setActivePanel] = useState<ActivePanel>("paint");
  const [baseColor, setBaseColor] = useState("#fff7ef");
  const [brushColor, setBrushColor] = useState("#F48FB1");
  const [brushFlow, setBrushFlow] = useState(0.58);
  const [brushSize, setBrushSize] = useState(86);
  const [brushSoftness, setBrushSoftness] = useState(0.72);
  const [canvasHeight, setCanvasHeight] = useState(1920);
  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [format, setFormat] = useState<CustomBackgroundFormatId>("phone");
  const [history, setHistory] = useState<HistorySnapshot[]>([]);
  const [layers, setLayers] = useState<PaintLayer[]>(() => [createPaintLayer(createCustomBackgroundLayer(), 1080, 1920)]);
  const [name, setName] = useState("Watercolor background");
  const [paintRevision, setPaintRevision] = useState(0);
  const [paintTool, setPaintTool] = useState<PaintTool>("watercolor");
  const [redoStack, setRedoStack] = useState<HistorySnapshot[]>([]);
  const [status, setStatus] = useState("Watercolor brush ready.");

  const activeBackground = useMemo(
    () => backgrounds.find((background) => background.id === activeBackgroundId) ?? null,
    [activeBackgroundId, backgrounds],
  );
  const activeLayer = useMemo(
    () => layers.find((layer) => layer.id === activeLayerId) ?? layers[0] ?? null,
    [activeLayerId, layers],
  );
  const orderedLayers = useMemo(
    () => [...layers].sort((left, right) => left.order - right.order),
    [layers],
  );

  useEffect(() => {
    if (!activeLayerId && layers[0]) {
      setActiveLayerId(layers[0].id);
    }
  }, [activeLayerId, layers]);

  useEffect(() => {
    if (!activeBackgroundId && backgrounds[0]) {
      setActiveBackgroundId(backgrounds[0].id);
    }
  }, [activeBackgroundId, backgrounds]);

  useEffect(() => {
    if (!activeBackground) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const nextLayers = await Promise.all(
        activeBackground.layers.map(async (layer) => {
          const paintLayer = createPaintLayer(layer, activeBackground.width, activeBackground.height);
          const blob = await getCustomBackgroundLayerBlob(activeBackground.id, layer.id);

          if (blob) {
            await drawBlobToCanvas(blob, paintLayer.canvas);
          }

          return paintLayer;
        }),
      );

      if (cancelled) {
        return;
      }

      setBaseColor(activeBackground.baseColor);
      setCanvasHeight(activeBackground.height);
      setCanvasWidth(activeBackground.width);
      setFormat(activeBackground.format);
      setLayers(nextLayers.length ? nextLayers : [createPaintLayer(createCustomBackgroundLayer(), activeBackground.width, activeBackground.height)]);
      setName(activeBackground.name);
      setActiveLayerId(nextLayers[0]?.id ?? "");
      setHistory([]);
      setRedoStack([]);
      setPaintRevision((revision) => revision + 1);
      setStatus(`Loaded "${activeBackground.name}".`);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeBackground]);

  useEffect(() => {
    drawEditorCanvas();
  }, [baseColor, canvasHeight, canvasWidth, orderedLayers, paintRevision]);

  function drawEditorCanvas() {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    orderedLayers.forEach((layer) => {
      if (!layer.visible) {
        return;
      }

      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.drawImage(layer.canvas, 0, 0);
      ctx.restore();
    });
  }

  function bumpPaintRevision() {
    setPaintRevision((revision) => revision + 1);
  }

  function getPointerCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;

    if (!canvas) {
      return { x: 0, y: 0 };
    }

    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvasWidth;
    const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvasHeight;

    return {
      x: Math.min(canvasWidth, Math.max(0, x)),
      y: Math.min(canvasHeight, Math.max(0, y)),
    };
  }

  function pushUndoSnapshot(layerId = activeLayer?.id) {
    const layer = layers.find((item) => item.id === layerId);

    if (!layer) {
      return;
    }

    setHistory((current) => [...current.slice(-23), { layerId: layer.id, dataUrl: layer.canvas.toDataURL("image/png") }]);
    setRedoStack([]);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const layer = activeLayer;

    if (!layer) {
      return;
    }

    const point = getPointerCanvasPoint(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    pushUndoSnapshot(layer.id);

    if (activePanel !== "paint") {
      setActivePanel("paint");
    }

    if (paintTool === "fill") {
      paintWashFill(layer);
      bumpPaintRevision();
      return;
    }

    activePaintRef.current = {
      id: event.pointerId,
      lastX: point.x,
      lastY: point.y,
      tool: paintTool,
    };
    paintSegment(layer, point.x, point.y, point.x, point.y, paintTool);
    bumpPaintRevision();
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    const paint = activePaintRef.current;
    const layer = activeLayer;

    if (!paint || paint.id !== event.pointerId || !layer) {
      return;
    }

    const point = getPointerCanvasPoint(event);
    paintSegment(layer, paint.lastX, paint.lastY, point.x, point.y, paint.tool);
    activePaintRef.current = {
      ...paint,
      lastX: point.x,
      lastY: point.y,
    };
    bumpPaintRevision();
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (activePaintRef.current?.id === event.pointerId) {
      activePaintRef.current = null;
    }
  }

  function selectTool(tool: PaintTool) {
    setActivePanel("paint");
    setPaintTool(tool);
  }

  function paintSegment(layer: PaintLayer, startX: number, startY: number, endX: number, endY: number, tool: PaintTool) {
    const ctx = layer.canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    if (tool === "eraser") {
      paintEraserSegment(ctx, startX, startY, endX, endY);
      return;
    }

    if (tool === "smudge") {
      paintSmudgeSegment(layer.canvas, ctx, startX, startY, endX, endY);
      return;
    }

    paintWatercolorSegment(ctx, startX, startY, endX, endY);
  }

  function paintWatercolorSegment(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) {
    const distance = Math.hypot(endX - startX, endY - startY);
    const steps = Math.max(1, Math.ceil(distance / Math.max(3, brushSize * 0.16)));

    ctx.save();
    ctx.globalCompositeOperation = "source-over";

    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      const jitter = brushSize * 0.22 * brushSoftness;
      const x = startX + (endX - startX) * ratio + (Math.random() - 0.5) * jitter;
      const y = startY + (endY - startY) * ratio + (Math.random() - 0.5) * jitter;
      const radius = brushSize * (0.36 + Math.random() * 0.28);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      const alpha = brushFlow * (0.045 + brushSoftness * 0.035);

      gradient.addColorStop(0, hexToRgba(brushColor, alpha));
      gradient.addColorStop(0.58, hexToRgba(brushColor, alpha * 0.55));
      gradient.addColorStop(1, hexToRgba(brushColor, 0));
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function paintEraserSegment(
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) {
    const distance = Math.hypot(endX - startX, endY - startY);
    const steps = Math.max(1, Math.ceil(distance / Math.max(4, brushSize * 0.18)));

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";
    ctx.globalAlpha = 0.75;

    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      const x = startX + (endX - startX) * ratio;
      const y = startY + (endY - startY) * ratio;
      ctx.beginPath();
      ctx.arc(x, y, brushSize * 0.42, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function paintSmudgeSegment(
    sourceCanvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ) {
    const radius = Math.max(8, Math.round(brushSize * 0.5));
    const scratch = scratchCanvasRef.current ?? document.createElement("canvas");
    scratchCanvasRef.current = scratch;
    scratch.width = radius * 2;
    scratch.height = radius * 2;
    const scratchCtx = scratch.getContext("2d");

    if (!scratchCtx) {
      return;
    }

    scratchCtx.clearRect(0, 0, scratch.width, scratch.height);
    scratchCtx.drawImage(sourceCanvas, startX - radius, startY - radius, radius * 2, radius * 2, 0, 0, radius * 2, radius * 2);
    ctx.save();
    ctx.globalAlpha = Math.min(0.72, brushFlow);
    ctx.filter = `blur(${Math.round(brushSoftness * 5)}px)`;
    ctx.drawImage(scratch, endX - radius, endY - radius);
    ctx.restore();
  }

  function paintWashFill(layer: PaintLayer) {
    const ctx = layer.canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    ctx.save();
    ctx.fillStyle = hexToRgba(brushColor, Math.min(0.56, brushFlow * 0.42));
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.restore();
    setStatus("Added a watercolor wash.");
  }

  async function undo() {
    const snapshot = history[history.length - 1];

    if (!snapshot) {
      return;
    }

    const layer = layers.find((item) => item.id === snapshot.layerId);

    if (!layer) {
      return;
    }

    setRedoStack((current) => [...current.slice(-23), { layerId: layer.id, dataUrl: layer.canvas.toDataURL("image/png") }]);
    setHistory((current) => current.slice(0, -1));
    await restoreLayerFromDataUrl(layer.canvas, snapshot.dataUrl);
    bumpPaintRevision();
    setStatus("Undid paint stroke.");
  }

  async function redo() {
    const snapshot = redoStack[redoStack.length - 1];

    if (!snapshot) {
      return;
    }

    const layer = layers.find((item) => item.id === snapshot.layerId);

    if (!layer) {
      return;
    }

    setHistory((current) => [...current.slice(-23), { layerId: layer.id, dataUrl: layer.canvas.toDataURL("image/png") }]);
    setRedoStack((current) => current.slice(0, -1));
    await restoreLayerFromDataUrl(layer.canvas, snapshot.dataUrl);
    bumpPaintRevision();
    setStatus("Redid paint stroke.");
  }

  function clearActiveLayer() {
    const layer = activeLayer;

    if (!layer) {
      return;
    }

    pushUndoSnapshot(layer.id);
    layer.canvas.getContext("2d")?.clearRect(0, 0, canvasWidth, canvasHeight);
    bumpPaintRevision();
    setStatus("Cleared active layer.");
  }

  function addLayer() {
    const nextLayer = createPaintLayer(
      {
        ...createCustomBackgroundLayer(`Layer ${layers.length + 1}`),
        order: layers.length,
      },
      canvasWidth,
      canvasHeight,
    );

    setLayers((current) => [...current, nextLayer]);
    setActiveLayerId(nextLayer.id);
    setStatus(`Added ${nextLayer.name}.`);
  }

  function duplicateLayer() {
    const layer = activeLayer;

    if (!layer) {
      return;
    }

    const nextLayer = createPaintLayer(
      {
        ...createCustomBackgroundLayer(`${layer.name} copy`),
        opacity: layer.opacity,
        order: layers.length,
        visible: layer.visible,
      },
      canvasWidth,
      canvasHeight,
    );
    nextLayer.canvas.getContext("2d")?.drawImage(layer.canvas, 0, 0);
    setLayers((current) => [...current, nextLayer]);
    setActiveLayerId(nextLayer.id);
    setStatus(`Duplicated ${layer.name}.`);
  }

  function deleteLayer(layerId: string) {
    if (layers.length <= 1) {
      clearActiveLayer();
      return;
    }

    setLayers((current) => reorderLayers(current.filter((layer) => layer.id !== layerId)));
    setActiveLayerId((current) => {
      if (current !== layerId) {
        return current;
      }

      return layers.find((layer) => layer.id !== layerId)?.id ?? "";
    });
    setStatus("Deleted layer.");
  }

  function updateLayer(layerId: string, updates: Partial<CustomBackgroundLayer>) {
    setLayers((current) => current.map((layer) => (layer.id === layerId ? { ...layer, ...updates } : layer)));
    bumpPaintRevision();
  }

  function moveLayer(layerId: string, direction: -1 | 1) {
    setLayers((current) => {
      const sorted = [...current].sort((left, right) => left.order - right.order);
      const index = sorted.findIndex((layer) => layer.id === layerId);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) {
        return current;
      }

      const next = [...sorted];
      const [layer] = next.splice(index, 1);
      next.splice(targetIndex, 0, layer);
      return reorderLayers(next);
    });
    bumpPaintRevision();
  }

  function createNewBackground() {
    const nextLayer = createPaintLayer(createCustomBackgroundLayer(), 1080, 1920);
    setActiveBackgroundId("");
    setBaseColor("#fff7ef");
    setCanvasHeight(1920);
    setCanvasWidth(1080);
    setFormat("phone");
    setLayers([nextLayer]);
    setActiveLayerId(nextLayer.id);
    setName("Watercolor background");
    setHistory([]);
    setRedoStack([]);
    setPaintRevision((revision) => revision + 1);
    setStatus("Started a new phone background.");
  }

  function resizeProject(nextWidth: number, nextHeight: number, nextFormat: CustomBackgroundFormatId) {
    const safeWidth = clampInteger(nextWidth, 120, 6000);
    const safeHeight = clampInteger(nextHeight, 120, 6000);

    setLayers((current) =>
      current.map((layer) => {
        const nextCanvas = createCanvas(safeWidth, safeHeight);
        nextCanvas.getContext("2d")?.drawImage(layer.canvas, 0, 0, safeWidth, safeHeight);
        return {
          ...layer,
          canvas: nextCanvas,
        };
      }),
    );
    setCanvasWidth(safeWidth);
    setCanvasHeight(safeHeight);
    setFormat(nextFormat);
    setHistory([]);
    setRedoStack([]);
    setPaintRevision((revision) => revision + 1);
  }

  async function saveBackground() {
    const backgroundId = activeBackgroundId || createCustomBackgroundId();
    const now = new Date().toISOString();
    const flattened = createFlattenedCanvas(baseColor, orderedLayers, canvasWidth, canvasHeight);
    const flatBlob = await canvasToBlob(flattened);
    const thumbnailDataUrl = createThumbnailDataUrl(flattened);
    const nextLayers = orderedLayers.map(({ canvas: _canvas, ...layer }, index) => ({
      ...layer,
      order: index,
    }));
    const nextBackground: CustomBackground = {
      baseColor,
      createdAt: activeBackground?.createdAt ?? now,
      format,
      height: canvasHeight,
      id: backgroundId,
      layers: nextLayers,
      name: name.trim() || "Watercolor background",
      thumbnailDataUrl,
      updatedAt: now,
      width: canvasWidth,
    };

    await putCustomBackgroundFlatBlob(backgroundId, flatBlob);
    await Promise.all(
      orderedLayers.map(async (layer) => {
        await putCustomBackgroundLayerBlob(backgroundId, layer.id, await canvasToBlob(layer.canvas));
      }),
    );

    const nextBackgrounds = upsertCustomBackground(backgrounds, nextBackground);
    saveCustomBackgrounds(nextBackgrounds);
    onBackgroundsChange(nextBackgrounds);
    setActiveBackgroundId(backgroundId);
    setStatus(`Saved "${nextBackground.name}".`);
  }

  async function deleteBackground(background: CustomBackground) {
    const nextBackgrounds = backgrounds.filter((item) => item.id !== background.id);
    saveCustomBackgrounds(nextBackgrounds);
    onBackgroundsChange(nextBackgrounds);
    await deleteCustomBackgroundImages(background);

    if (activeBackgroundId === background.id) {
      const nextBackground = nextBackgrounds[0];
      if (nextBackground) {
        setActiveBackgroundId(nextBackground.id);
      } else {
        createNewBackground();
      }
    }
  }

  function selectSavedBackground(backgroundId: string) {
    setActiveBackgroundId(backgroundId);
    setActivePanel("paint");
  }

  function renderPaintPanel() {
    return (
      <div className="background-designer-action-panel paint-panel" aria-label="Paint tools">
        <div className="background-designer-tool-row">
          {([
            { icon: Brush, id: "watercolor", label: "Brush" },
            { icon: Eraser, id: "eraser", label: "Erase" },
            { icon: Droplets, id: "smudge", label: "Smudge" },
            { icon: PaintBucket, id: "fill", label: "Fill" },
          ] as const).map((tool) => {
            const Icon = tool.icon;

            return (
              <button
                key={tool.id}
                className={`secondary-button compact-button background-tool-button ${paintTool === tool.id ? "active-tool" : ""}`}
                data-tool={tool.id}
                type="button"
                onClick={() => selectTool(tool.id)}
              >
                <Icon aria-hidden="true" />
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>
        <label className="background-designer-range">
          <span>Size</span>
          <input type="range" min="8" max="220" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
          <output>{brushSize}</output>
        </label>
        <label className="background-designer-range">
          <span>Flow</span>
          <input
            type="range"
            min="0.08"
            max="1"
            step="0.01"
            value={brushFlow}
            onChange={(event) => setBrushFlow(Number(event.target.value))}
          />
          <output>{brushFlow.toFixed(2)}</output>
        </label>
        <label className="background-designer-range">
          <span>Soft</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={brushSoftness}
            onChange={(event) => setBrushSoftness(Number(event.target.value))}
          />
          <output>{brushSoftness.toFixed(2)}</output>
        </label>
      </div>
    );
  }

  function renderLayerPanel() {
    return (
      <div className="background-designer-action-panel layer-panel" aria-label="Layers">
        <div className="background-designer-tool-row">
          <button className="secondary-button compact-button" type="button" onClick={addLayer}>
            <Plus aria-hidden="true" />
            <span>Layer</span>
          </button>
          <button className="secondary-button compact-button" type="button" onClick={duplicateLayer} disabled={!activeLayer}>
            <Copy aria-hidden="true" />
            <span>Copy</span>
          </button>
          <button className="secondary-button compact-button" type="button" onClick={clearActiveLayer} disabled={!activeLayer}>
            <RotateCcw aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
        <div className="background-layer-list">
          {[...orderedLayers].reverse().map((layer) => (
            <div key={layer.id} className={`background-layer-row ${activeLayerId === layer.id ? "selected" : ""}`}>
              <button className="background-layer-select" type="button" onClick={() => setActiveLayerId(layer.id)}>
                <strong>{layer.name}</strong>
                <span>{Math.round(layer.opacity * 100)}%</span>
              </button>
              <button
                className="secondary-button compact-button icon-only-button"
                type="button"
                aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
              >
                {layer.visible ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
              </button>
              <button className="secondary-button compact-button icon-only-button" type="button" aria-label="Move layer up" onClick={() => moveLayer(layer.id, 1)}>
                <MoveUp aria-hidden="true" />
              </button>
              <button className="secondary-button compact-button icon-only-button" type="button" aria-label="Move layer down" onClick={() => moveLayer(layer.id, -1)}>
                <MoveDown aria-hidden="true" />
              </button>
              <button className="secondary-button compact-button icon-only-button" type="button" aria-label={`Delete ${layer.name}`} onClick={() => deleteLayer(layer.id)}>
                <Trash2 aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
        {activeLayer ? (
          <label className="background-designer-range">
            <span>Opacity</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={activeLayer.opacity}
              onChange={(event) => updateLayer(activeLayer.id, { opacity: Number(event.target.value) })}
            />
            <output>{activeLayer.opacity.toFixed(2)}</output>
          </label>
        ) : null}
      </div>
    );
  }

  function renderFormatPanel() {
    return (
      <div className="background-designer-action-panel format-panel" aria-label="Background size">
        <div className="background-format-row">
          {backgroundFormats.map((preset) => (
            <button
              key={preset.id}
              className={`secondary-button compact-button ${format === preset.id ? "active-tool" : ""}`}
              type="button"
              onClick={() => resizeProject(preset.width, preset.height, preset.id)}
            >
              {preset.label}
            </button>
          ))}
        </div>
        <div className="background-custom-size-row">
          <label>
            <span>Width</span>
            <input
              type="number"
              min="120"
              max="6000"
              value={canvasWidth}
              onChange={(event) => resizeProject(Number(event.target.value), canvasHeight, "custom")}
            />
          </label>
          <label>
            <span>Height</span>
            <input
              type="number"
              min="120"
              max="6000"
              value={canvasHeight}
              onChange={(event) => resizeProject(canvasWidth, Number(event.target.value), "custom")}
            />
          </label>
        </div>
      </div>
    );
  }

  function renderSavedPanel() {
    return (
      <div className="background-designer-action-panel saved-panel" aria-label="Saved backgrounds">
        {backgrounds.length ? (
          <div className="background-saved-grid">
            {backgrounds.map((background) => (
              <div key={background.id} className={`background-saved-card ${activeBackgroundId === background.id ? "selected" : ""}`}>
                <button type="button" onClick={() => selectSavedBackground(background.id)}>
                  {background.thumbnailDataUrl ? <img src={background.thumbnailDataUrl} alt="" /> : <span />}
                  <strong>{background.name}</strong>
                </button>
                <button className="secondary-button compact-button icon-only-button" type="button" aria-label={`Delete ${background.name}`} onClick={() => void deleteBackground(background)}>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="background-empty-message">No saved backgrounds yet.</p>
        )}
      </div>
    );
  }

  function renderSettingsPanel() {
    return (
      <div className="background-designer-action-panel settings-panel" aria-label="Background settings">
        <label className="background-name-field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="background-name-field">
          <span>Paper</span>
          <input type="color" value={baseColor} onChange={(event) => setBaseColor(event.target.value)} />
        </label>
        <div className="background-color-swatches" aria-label="Paint swatches">
          {paintSwatches.map((swatch) => (
            <button
              key={swatch}
              className={`draw-ink-swatch ${brushColor.toLowerCase() === swatch.toLowerCase() ? "selected" : ""}`}
              type="button"
              onClick={() => setBrushColor(swatch)}
              aria-label={`Use ${swatch}`}
            >
              <span style={{ backgroundColor: swatch }} />
            </button>
          ))}
          <label className="background-custom-color">
            <Pipette aria-hidden="true" />
            <input aria-label="Custom paint color" type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} />
          </label>
        </div>
      </div>
    );
  }

  function renderActivePanel() {
    if (activePanel === "layers") {
      return renderLayerPanel();
    }

    if (activePanel === "format") {
      return renderFormatPanel();
    }

    if (activePanel === "saved") {
      return renderSavedPanel();
    }

    if (activePanel === "settings") {
      return renderSettingsPanel();
    }

    return renderPaintPanel();
  }

  return (
    <section className="phone-image-fullscreen background-designer-fullscreen" aria-label="Background designer">
      <div className="phone-image-fullscreen-heading background-designer-heading">
        <button className="secondary-button compact-button phone-image-menu-button" type="button" onClick={onOpenAppMenu} aria-label="Open menu">
          <Menu aria-hidden="true" />
        </button>
        <div className="phone-image-active-settings">Backgrounds</div>
        <div className="phone-image-header-actions">
          <button
            className={`secondary-button compact-button ${activePanel === "settings" ? "active-tool" : ""}`}
            type="button"
            aria-label="Background settings"
            aria-pressed={activePanel === "settings"}
            onClick={() => setActivePanel("settings")}
          >
            <Settings2 aria-hidden="true" />
          </button>
          <button className="secondary-button compact-button" type="button" onClick={createNewBackground}>
            New
          </button>
          <button className="primary-button compact-button" type="button" onClick={() => void saveBackground()}>
            <Save aria-hidden="true" />
            Save
          </button>
        </div>
      </div>
      <div className="background-designer-stage">
        <div className="background-designer-canvas-frame" style={{ aspectRatio: `${canvasWidth} / ${canvasHeight}` }}>
          <canvas
            ref={canvasRef}
            className="background-designer-canvas"
            onPointerCancel={handlePointerUp}
            onPointerDown={handlePointerDown}
            onPointerLeave={handlePointerUp}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>
        <div className="background-designer-status" role="status">
          {status}
        </div>
      </div>
      <div className="background-designer-bottom-bar">
        {renderActivePanel()}
        <div className="phone-image-fullscreen-options background-designer-tabs" aria-label="Background tabs">
          {([
            { icon: Brush, id: "paint", label: "Paint" },
            { icon: Layers, id: "layers", label: "Layers" },
            { icon: PaintBucket, id: "format", label: "Format" },
            { icon: Droplets, id: "saved", label: "Saved" },
            { icon: Settings2, id: "settings", label: "Settings" },
          ] as const).map((tab) => {
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                className={`secondary-button compact-button ${activePanel === tab.id ? "active-tool" : ""}`}
                type="button"
                aria-pressed={activePanel === tab.id}
                onClick={() => setActivePanel(tab.id)}
              >
                <Icon aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="background-designer-history-row">
          <button className="secondary-button compact-button" type="button" onClick={() => void undo()} disabled={!history.length}>
            <Undo2 aria-hidden="true" />
          </button>
          <button className="secondary-button compact-button" type="button" onClick={() => void redo()} disabled={!redoStack.length}>
            <Redo2 aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}

function createPaintLayer(layer: CustomBackgroundLayer, width: number, height: number): PaintLayer {
  return {
    ...layer,
    canvas: createCanvas(width, height),
  };
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function reorderLayers(layers: PaintLayer[]): PaintLayer[] {
  return layers.map((layer, index) => ({
    ...layer,
    order: index,
  }));
}

function createFlattenedCanvas(baseColor: string, layers: PaintLayer[], width: number, height: number): HTMLCanvasElement {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    return canvas;
  }

  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, width, height);
  layers.forEach((layer) => {
    if (!layer.visible) {
      return;
    }

    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(layer.canvas, 0, 0);
    ctx.restore();
  });

  return canvas;
}

function createThumbnailDataUrl(source: HTMLCanvasElement): string {
  const thumbnail = createCanvas(180, 320);
  const ctx = thumbnail.getContext("2d");

  if (!ctx) {
    return "";
  }

  ctx.fillStyle = "#fff7ef";
  ctx.fillRect(0, 0, thumbnail.width, thumbnail.height);
  const scale = Math.max(thumbnail.width / source.width, thumbnail.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  const x = (thumbnail.width - width) / 2;
  const y = (thumbnail.height - height) / 2;
  ctx.drawImage(source, x, y, width, height);
  return thumbnail.toDataURL("image/jpeg", 0.78);
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }

      reject(new Error("Could not create background image."));
    }, "image/png");
  });
}

function drawBlobToCanvas(blob: Blob, canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve();
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load background layer."));
    };
    image.src = url;
  });
}

function restoreLayerFromDataUrl(canvas: HTMLCanvasElement, dataUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const ctx = canvas.getContext("2d");
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      ctx?.drawImage(image, 0, 0);
      resolve();
    };
    image.onerror = () => reject(new Error("Could not restore layer."));
    image.src = dataUrl;
  });
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const value = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : "f48fb1";
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(1, Math.max(0, alpha))})`;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
