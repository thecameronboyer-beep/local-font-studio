import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Download, Eraser, RefreshCw, Save, Share2 } from "lucide-react";
import { exportWaxSealPNG, getWaxSealPNGDataUrl } from "../rendering/wax/exportWaxSeal";
import { renderWaxSeal } from "../rendering/wax/WaxSealRenderer";
import type {
  WaxDebugRenderMode,
  WaxSealMode,
  WaxSealRenderOptions,
  WaxSealStroke,
} from "../rendering/wax/waxTypes";
import type { FontSet, SavedImageDraft } from "../types/fontTypes";
import { isNativeFilePlatform, saveNativeFileToDocuments, shareNativeFile } from "../utils/nativeFiles";

type SealMakerProps = {
  font: FontSet;
  onRecordExport?: (message: string) => void;
  onSaveImage?: (image: SavedImageDraft) => boolean;
};

type SealTemplateId = "ruby" | "garnet" | "blackCherry" | "forest" | "gold";

type SealTemplate = {
  color: string;
  id: SealTemplateId;
  label: string;
  seed: number;
};

const sealTemplates: SealTemplate[] = [
  { color: "#970607", id: "ruby", label: "Ruby", seed: 11 },
  { color: "#a71922", id: "garnet", label: "Garnet", seed: 41 },
  { color: "#6f0b1a", id: "blackCherry", label: "Cherry", seed: 73 },
  { color: "#1d5f39", id: "forest", label: "Forest", seed: 97 },
  { color: "#b77919", id: "gold", label: "Gold", seed: 131 },
];

const previewRenderSize = 768;
const drawPadSize = 512;
const exportSizes = [1024, 1536, 2048] as const;
const debugModes: Array<{ id: WaxDebugRenderMode; label: string }> = [
  { id: "final", label: "Final shaded" },
  { id: "alpha", label: "Alpha mask" },
  { id: "edge", label: "Organic edge" },
  { id: "sdf", label: "Signed distance" },
  { id: "height", label: "Height map" },
  { id: "normal", label: "Normal map" },
  { id: "ao", label: "Ambient occlusion" },
  { id: "roughness", label: "Roughness" },
];

function getTemplate(templateId: SealTemplateId) {
  return sealTemplates.find((template) => template.id === templateId) ?? sealTemplates[0];
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createSealId() {
  return `seal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeFileName(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
    .toLowerCase() || "quill";
}

function getSealFileName(fontName: string) {
  return `${sanitizeFileName(fontName)}-wax-seal.png`;
}

function getFontInitials(fontName: string) {
  const words = fontName
    .replace(/[^a-z0-9\s]/gi, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "Q";
  }

  return words.slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

function drawSmoothStrokePath(context: CanvasRenderingContext2D, points: WaxSealStroke["points"], drawRadius: number) {
  if (points.length < 2) {
    return;
  }

  const center = drawPadSize / 2;
  const toCanvasPoint = (point: WaxSealStroke["points"][number]) => ({
    x: center + (point.x - 0.5) * drawRadius,
    y: center + (point.y - 0.5) * drawRadius,
  });
  const first = toCanvasPoint(points[0]);

  context.moveTo(first.x, first.y);

  if (points.length === 2) {
    const second = toCanvasPoint(points[1]);
    context.lineTo(second.x, second.y);
    return;
  }

  for (let index = 1; index < points.length - 1; index += 1) {
    const current = toCanvasPoint(points[index]);
    const next = toCanvasPoint(points[index + 1]);
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }

  const last = toCanvasPoint(points[points.length - 1]);
  context.lineTo(last.x, last.y);
}

function drawMarkPad(canvas: HTMLCanvasElement, strokes: WaxSealStroke[]) {
  const context = canvas.getContext("2d");

  if (!context) {
    return;
  }

  canvas.width = drawPadSize;
  canvas.height = drawPadSize;
  context.clearRect(0, 0, drawPadSize, drawPadSize);
  context.fillStyle = "#141114";
  context.fillRect(0, 0, drawPadSize, drawPadSize);
  context.strokeStyle = "rgba(248, 230, 194, 0.18)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(drawPadSize / 2, drawPadSize / 2, drawPadSize * 0.42, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = "#f3dfb6";
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 16;

  strokes.forEach((stroke) => {
    if (stroke.points.length < 2) {
      return;
    }

    context.beginPath();
    drawSmoothStrokePath(context, stroke.points, drawPadSize * 0.84);
    context.stroke();
  });
}

export default function SealMaker({ font, onRecordExport, onSaveImage }: SealMakerProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeStrokeIdRef = useRef<string | null>(null);
  const renderFrameRef = useRef<number | null>(null);
  const [templateId, setTemplateId] = useState<SealTemplateId>("ruby");
  const [mode, setMode] = useState<WaxSealMode>("engraved");
  const [waxColor, setWaxColor] = useState(getTemplate("ruby").color);
  const [seed, setSeed] = useState(getTemplate("ruby").seed);
  const [debugMode, setDebugMode] = useState<WaxDebugRenderMode>("final");
  const [depth, setDepth] = useState(0.78);
  const [stampDepth, setStampDepth] = useState(0.24);
  const [edgeIrregularity, setEdgeIrregularity] = useState(0.38);
  const [rimHeight, setRimHeight] = useState(0.68);
  const [textureIntensity, setTextureIntensity] = useState(0.22);
  const [roughness, setRoughness] = useState(0.42);
  const [specularStrength, setSpecularStrength] = useState(0.48);
  const [translucency, setTranslucency] = useState(0.12);
  const [markScale, setMarkScale] = useState(0.92);
  const [markWeight, setMarkWeight] = useState(0.48);
  const [lightX, setLightX] = useState(-0.45);
  const [lightY, setLightY] = useState(-0.55);
  const [shadow, setShadow] = useState(false);
  const [transparentBackground, setTransparentBackground] = useState(true);
  const [exportSize, setExportSize] = useState<(typeof exportSizes)[number]>(1024);
  const [stampText, setStampText] = useState(() => getFontInitials(font.name));
  const [strokes, setStrokes] = useState<WaxSealStroke[]>([]);
  const [status, setStatus] = useState("");

  const template = getTemplate(templateId);

  const renderOptions = useMemo<WaxSealRenderOptions>(() => ({
    debugMode,
    depth,
    edgeIrregularity,
    lightDirection: [lightX, lightY, 0.75],
    markScale,
    markWeight,
    mode,
    renderSize: previewRenderSize,
    rimHeight,
    roughness,
    seed,
    shadow,
    specularStrength,
    stampDepth: mode === "raised" ? stampDepth : -stampDepth,
    stampFontFamily: "Georgia, 'Times New Roman', serif",
    stampStrokes: strokes,
    stampText,
    textureIntensity,
    translucency,
    transparentBackground,
    waxColor,
  }), [
    debugMode,
    depth,
    edgeIrregularity,
    lightX,
    lightY,
    markScale,
    markWeight,
    mode,
    rimHeight,
    roughness,
    seed,
    shadow,
    specularStrength,
    stampDepth,
    stampText,
    strokes,
    textureIntensity,
    translucency,
    transparentBackground,
    waxColor,
  ]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;

    if (!canvas) {
      return;
    }

    if (renderFrameRef.current !== null) {
      window.cancelAnimationFrame(renderFrameRef.current);
    }

    renderFrameRef.current = window.requestAnimationFrame(() => {
      renderWaxSeal(canvas, renderOptions);
      renderFrameRef.current = null;
    });

    return () => {
      if (renderFrameRef.current !== null) {
        window.cancelAnimationFrame(renderFrameRef.current);
        renderFrameRef.current = null;
      }
    };
  }, [renderOptions]);

  useEffect(() => {
    const canvas = drawCanvasRef.current;

    if (!canvas) {
      return;
    }

    drawMarkPad(canvas, strokes);
  }, [strokes]);

  function getCanvasPoint(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    return {
      x: clamp((event.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((event.clientY - rect.top) / rect.height, 0, 1),
    };
  }

  function startStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (mode === "blank") {
      setStatus("Blank mode ignores center marks.");
      return;
    }

    const strokeId = createSealId();
    const startPoint = getCanvasPoint(event);
    activeStrokeIdRef.current = strokeId;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Synthetic pointer events can lack an active browser pointer.
    }
    setStrokes((current) => [...current, { id: strokeId, points: [startPoint] }]);
    setStatus("Mark started.");
  }

  function continueStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    const strokeId = activeStrokeIdRef.current;

    if (!strokeId) {
      return;
    }

    const nextPoint = getCanvasPoint(event);
    setStrokes((current) =>
      current.map((stroke) =>
        stroke.id === strokeId ? { ...stroke, points: [...stroke.points, nextPoint] } : stroke,
      ),
    );
  }

  function endStroke(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (activeStrokeIdRef.current) {
      setStatus("Mark updated.");
    }

    activeStrokeIdRef.current = null;

    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // Matching guard for non-captured synthetic pointer events.
    }
  }

  function createRenderCanvas(size: number) {
    const canvas = document.createElement("canvas");
    renderWaxSeal(canvas, {
      ...renderOptions,
      debugMode: "final",
      renderSize: size,
    });
    return canvas;
  }

  function getSealDataUrl() {
    const canvas = previewCanvasRef.current;

    if (!canvas) {
      return "";
    }

    return getWaxSealPNGDataUrl(canvas);
  }

  async function getSealBlob(canvas: HTMLCanvasElement) {
    return exportWaxSealPNG(canvas);
  }

  function saveSealToGallery() {
    const canvas = createRenderCanvas(previewRenderSize);
    const dataUrl = getWaxSealPNGDataUrl(canvas);

    if (!dataUrl) {
      setStatus("Could not make a seal yet.");
      return false;
    }

    const saved = onSaveImage?.({
      fontName: font.name,
      height: canvas.height,
      imageDataUrl: dataUrl,
      message: `${template.label} ${mode} wax seal`,
      width: canvas.width,
    });

    setStatus(saved === false ? "Could not add to Saved Images." : "Saved to Saved Images.");
    return saved !== false;
  }

  async function exportSeal() {
    try {
      const exportCanvas = createRenderCanvas(exportSize);
      const dataUrl = getWaxSealPNGDataUrl(exportCanvas);
      const base64Data = dataUrl.split(",")[1];
      const fileName = getSealFileName(font.name);

      if (isNativeFilePlatform()) {
        if (!base64Data) {
          setStatus("Could not make a seal yet.");
          return;
        }

        await saveNativeFileToDocuments({ base64Data, fileName });
        setStatus("Saved PNG to Documents / Local Font Studio.");
        onRecordExport?.(`Exported ${template.label} ${mode} wax seal PNG.`);
        return;
      }

      const blob = await getSealBlob(exportCanvas);

      if (!blob) {
        setStatus("Could not make a seal yet.");
        return;
      }

      saveSealToGallery();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(objectUrl);
      setStatus(`Saved ${exportSize}px transparent PNG.`);
      onRecordExport?.(`Exported ${template.label} ${mode} wax seal PNG.`);
    } catch {
      setStatus("Could not save the PNG.");
    }
  }

  async function shareSeal() {
    try {
      const shareCanvas = createRenderCanvas(1024);
      const dataUrl = getWaxSealPNGDataUrl(shareCanvas);
      const base64Data = dataUrl.split(",")[1];
      const fileName = getSealFileName(font.name);

      if (isNativeFilePlatform()) {
        if (!base64Data) {
          setStatus("Could not make a seal yet.");
          return;
        }

        await shareNativeFile({
          base64Data,
          dialogTitle: "Share seal",
          fileName,
          text: "Made in Quill",
          title: font.name,
        });
        setStatus("Share opened.");
        onRecordExport?.(`Shared ${template.label} ${mode} wax seal PNG.`);
        return;
      }

      const blob = await getSealBlob(shareCanvas);

      if (!blob) {
        setStatus("Could not make a seal yet.");
        return;
      }

      const file = new File([blob], fileName, { type: "image/png" });
      const shareData: ShareData & { files?: File[] } = {
        files: [file],
        text: "Made in Quill",
        title: font.name,
      };

      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setStatus("Share opened.");
        onRecordExport?.(`Shared ${template.label} ${mode} wax seal PNG.`);
        return;
      }

      await exportSeal();
      setStatus("Sharing is not supported here, so I saved the PNG.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("Share canceled.");
        return;
      }

      setStatus("Sharing did not work here. Try Export PNG.");
    }
  }

  function selectTemplate(nextTemplateId: SealTemplateId) {
    const nextTemplate = getTemplate(nextTemplateId);
    setTemplateId(nextTemplate.id);
    setWaxColor(nextTemplate.color);
    setSeed(nextTemplate.seed);
    setStatus(`${nextTemplate.label} wax selected.`);
  }

  function randomizeWax() {
    setSeed((current) => current + 137);
    setStatus("Wax imperfections randomized.");
  }

  return (
    <section className="studio-panel seal-maker-panel" aria-label="Seal maker">
      <div className="panel-heading seal-maker-heading">
        <div>
          <p className="eyebrow">Seal</p>
          <h2>Wax seal</h2>
        </div>
        <div className="preview-summary-pill">{previewRenderSize}x{previewRenderSize}</div>
      </div>

      <div className="seal-maker-layout">
        <div className="seal-preview-column">
          <canvas ref={previewCanvasRef} className="seal-preview-canvas" aria-label="Generated seal preview" />
          <div className="seal-action-row">
            <button className="secondary-button compact-button" type="button" onClick={shareSeal}>
              <Share2 aria-hidden="true" size={16} />
              <span>Share</span>
            </button>
            <button className="secondary-button compact-button" type="button" onClick={saveSealToGallery}>
              <Save aria-hidden="true" size={16} />
              <span>Save</span>
            </button>
            <button className="primary-button compact-button" type="button" onClick={exportSeal}>
              <Download aria-hidden="true" size={16} />
              <span>Export PNG</span>
            </button>
          </div>
          <div className="share-status seal-status" aria-live="polite">
            {status}
          </div>
        </div>

        <div className="seal-control-panel">
          <div className="seal-template-grid" aria-label="Seal templates">
            {sealTemplates.map((item) => (
              <button
                key={item.id}
                className={`secondary-button seal-template-button ${templateId === item.id ? "active-tool" : ""}`}
                type="button"
                aria-pressed={templateId === item.id}
                onClick={() => selectTemplate(item.id)}
              >
                <span
                  className="seal-template-swatch"
                  style={{ background: `radial-gradient(circle at 30% 25%, #fff3df, ${item.color} 48%, #240002)` }}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="seal-input-grid">
            <label className="seal-color-control">
              <span>Wax color</span>
              <input
                type="color"
                value={waxColor}
                onChange={(event) => setWaxColor(event.target.value)}
              />
            </label>
            <label>
              <span>Debug view</span>
              <select
                className="preview-input seal-select-input"
                value={debugMode}
                onChange={(event) => setDebugMode(event.target.value as WaxDebugRenderMode)}
              >
                {debugModes.map((debugOption) => (
                  <option key={debugOption.id} value={debugOption.id}>
                    {debugOption.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="seal-input-grid">
            <label className="seal-wide-control">
              <span>Initials</span>
              <input
                className="preview-input seal-text-input"
                maxLength={8}
                type="text"
                value={stampText}
                disabled={mode === "blank"}
                onChange={(event) => setStampText(event.target.value)}
              />
            </label>
          </div>

          <div className="seal-depth-row" aria-label="Seal relief">
            {([
              { id: "blank", label: "Blank" },
              { id: "engraved", label: "Engraved" },
              { id: "raised", label: "Raised" },
            ] as const).map((option) => (
              <button
                key={option.id}
                className={`secondary-button compact-button ${mode === option.id ? "active-tool" : ""}`}
                type="button"
                aria-pressed={mode === option.id}
                onClick={() => {
                  setMode(option.id);
                  if (option.id === "raised") {
                    setStampDepth(0.18);
                  } else if (option.id === "engraved") {
                    setStampDepth(0.24);
                  }
                }}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="seal-draw-pad-panel">
            <div className="seal-control-heading">
              <span>Custom mark</span>
              <button
                className="secondary-button compact-button seal-icon-button"
                type="button"
                aria-label="Clear center mark"
                title="Clear center mark"
                onClick={() => {
                  setStrokes([]);
                  setStatus("Mark cleared.");
                }}
              >
                <Eraser aria-hidden="true" size={16} />
              </button>
            </div>
            <canvas
              ref={drawCanvasRef}
              className="seal-draw-pad"
              aria-label="Draw center mark"
              onPointerCancel={endStroke}
              onPointerDown={startStroke}
              onPointerLeave={endStroke}
              onPointerMove={continueStroke}
              onPointerUp={endStroke}
            />
          </div>

          <div className="seal-toggle-row">
            <label>
              <input
                checked={transparentBackground}
                type="checkbox"
                onChange={(event) => setTransparentBackground(event.target.checked)}
              />
              <span>Transparent</span>
            </label>
            <label>
              <input
                checked={shadow}
                type="checkbox"
                onChange={(event) => setShadow(event.target.checked)}
              />
              <span>Shadow</span>
            </label>
            <button className="secondary-button compact-button" type="button" onClick={randomizeWax}>
              <RefreshCw aria-hidden="true" size={16} />
              <span>Seed</span>
            </button>
          </div>

          <div className="seal-export-size-row" aria-label="Export size">
            {exportSizes.map((size) => (
              <button
                key={size}
                className={`secondary-button compact-button ${exportSize === size ? "active-tool" : ""}`}
                type="button"
                aria-pressed={exportSize === size}
                onClick={() => setExportSize(size)}
              >
                {size}
              </button>
            ))}
          </div>

          <div className="seal-slider-grid">
            <label>
              <span>Wax depth</span>
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={depth}
                onChange={(event) => setDepth(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Stamp depth</span>
              <input
                max="0.55"
                min="0.04"
                step="0.01"
                type="range"
                value={stampDepth}
                disabled={mode === "blank"}
                onChange={(event) => setStampDepth(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Edge irregularity</span>
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={edgeIrregularity}
                onChange={(event) => setEdgeIrregularity(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Rim height</span>
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={rimHeight}
                onChange={(event) => setRimHeight(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Texture</span>
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={textureIntensity}
                onChange={(event) => setTextureIntensity(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Roughness</span>
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={roughness}
                onChange={(event) => setRoughness(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Specular</span>
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={specularStrength}
                onChange={(event) => setSpecularStrength(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Translucency</span>
              <input
                max="0.5"
                min="0"
                step="0.01"
                type="range"
                value={translucency}
                onChange={(event) => setTranslucency(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Mark size</span>
              <input
                max="1.22"
                min="0.58"
                step="0.01"
                type="range"
                value={markScale}
                disabled={mode === "blank"}
                onChange={(event) => setMarkScale(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Mark weight</span>
              <input
                max="1"
                min="0"
                step="0.01"
                type="range"
                value={markWeight}
                disabled={mode === "blank"}
                onChange={(event) => setMarkWeight(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Light X</span>
              <input
                max="1"
                min="-1"
                step="0.01"
                type="range"
                value={lightX}
                onChange={(event) => setLightX(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Light Y</span>
              <input
                max="1"
                min="-1"
                step="0.01"
                type="range"
                value={lightY}
                onChange={(event) => setLightY(Number(event.target.value))}
              />
            </label>
          </div>
        </div>
      </div>
    </section>
  );
}
