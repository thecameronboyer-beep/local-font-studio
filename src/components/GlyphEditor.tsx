import { useEffect, useRef, useState } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  TouchEvent as ReactTouchEvent,
} from "react";
import { flushSync } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  Droplets,
  Ellipsis,
  Eraser,
  Eye,
  Feather,
  Hand,
  Home,
  Minus,
  MousePointer2,
  Palette,
  PenLine,
  Redo2,
  RotateCcw,
  Save,
  SkipForward,
  Sparkles,
  Sticker,
  SlidersHorizontal,
  Layers,
  Plus,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import GlyphCanvas from "./GlyphCanvas";
import type {
  CanvasViewOffset,
  DrawingTool,
  EraserMode,
  SelectMode,
  SmoothingMode,
  StickerDropRequest,
} from "./GlyphCanvas";
import GlyphConstructionCanvas from "./GlyphConstructionCanvas";
import type {
  ConstructionSelection,
  ConstructionSnapSettings,
  ConstructionTool,
} from "./GlyphConstructionCanvas";
import SpacingControls from "./SpacingControls";
import { getCharacterLabel, getVisibleCharacters, spacebar } from "../data/characterSets";
import { getDefaultFontPaletteTheme, paletteBackgroundPresets, paletteInkSwatches } from "../data/palettes";
import {
  drawGlyph,
  drawGlyphDecoration,
  getFontHeightScale,
  getFontWidthScale,
  getGlyphAdvance,
  getGlyphLeftBearingOffset,
  getGlyphRenderScales,
  getGlyphTopForBaseline,
  getSpacebarAdvance,
  selectPreviewGlyph,
} from "../render/glyphRenderer";
import { defaultFontGuideSettings } from "../storage/fontStorage";
import type {
  BackgroundStyle,
  BackgroundTexture,
  ConstructionAnchorPoint,
  ConstructionPath,
  FontGuideSettings,
  FontSet,
  FontTheme,
  Glyph,
  GlyphConstruction,
  GlyphDecoration,
  GlyphInkEffect,
  GlyphVariant,
  GlyphStroke,
} from "../types/fontTypes";
import { clampFontGuideSettings, fontGuideRows } from "../utils/fontGuides";

type GlyphEditorProps = {
  font: FontSet;
  glyph: Glyph;
  onSaveGlyph: (glyph: Glyph) => void;
  onSaveGlyphAndNext: (glyph: Glyph) => void;
  onSaveGlyphVariant: (glyph: Glyph, variantIndex?: number) => void;
  onUpdateFontGuideSettings: (guideSettings: FontGuideSettings) => void;
  onUpdateFontTheme: (theme: FontTheme) => void;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
  characterIndex: number;
  characterTotal: number;
  onPreviousCharacter: () => void;
  onNextCharacter: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
};

type FullscreenDrawer =
  | "ink"
  | "background"
  | "guides"
  | "more"
  | "constructionAdd"
  | "constructionInk"
  | "constructionPaths"
  | "constructionSettings"
  | "constructionMore"
  | null;
type ActiveVariation = "base" | "new" | number;
type EditorMode = "draw" | "construction";
type InkTool = Extract<DrawingTool, "pen" | "quill" | "line">;
const inkPresetIds = ["primary", "secondary", "tertiary"] as const;
type InkPresetId = (typeof inkPresetIds)[number];
type InkPreset = {
  brushSize: number;
  highlightColor: string;
  inkColor: string;
  inkEffect: GlyphInkEffect;
  smoothingMode: SmoothingMode;
  tool: InkTool;
};
type ConstructionInkPreset = {
  inkColor: string;
  thickness: number;
};

const DEFAULT_HIGHLIGHT_COLOR = "#ffd6f0";

const glyphInkSwatches = [
  ...paletteInkSwatches,
  { color: "#19140f", label: "Lamp Black" },
  { color: "#ff6fb2", label: "Bubble Pink" },
  { color: "#ffd1dc", label: "Blush Pink" },
  { color: "#d93434", label: "Modern Red" },
  { color: "#f0a934", label: "Modern Amber" },
  { color: "#16815f", label: "Modern Green" },
  { color: "#2468c9", label: "Modern Blue" },
  { color: "#8b4bd9", label: "Modern Violet" },
  { color: "#e34234", label: "Vermilion Red" },
  { color: "#5a3726", label: "Walnut Brown" },
  { color: "#9f4632", label: "Red Ochre" },
  { color: "#3d6f8f", label: "Azurite Blue" },
  { color: "#263ca8", label: "Ultramarine" },
  { color: "#3a9b88", label: "Verdigris Green" },
  { color: "#68743c", label: "Herbal Green" },
  { color: "#c4933a", label: "Yellow Ochre" },
  { color: "#d79a22", label: "Saffron Gold" },
  { color: "#493424", label: "Umber Brown" },
  { color: "#e5ddc8", label: "Bone White" },
  { color: "#a88943", label: "Aged Gold" },
];

const bubbleHighlightSwatches = [
  { color: "#fff7f2", label: "Pearl shine" },
  { color: "#ffd6f0", label: "Pink shine" },
  { color: "#ffe6f4", label: "Cotton candy shine" },
  { color: "#f2dcff", label: "Lavender shine" },
  { color: "#dff4ff", label: "Sky shine" },
  { color: "#fff1a8", label: "Gold shine" },
];
const editorBackgroundPresets: Array<{
  accentColor: string;
  backgroundColor: string;
  id: BackgroundStyle;
  inkColor: string;
  label: string;
  preview: string;
}> = [
  ...paletteBackgroundPresets,
  {
    id: "paper",
    label: "Paper",
    backgroundColor: "#f4ead7",
    inkColor: "#17110b",
    accentColor: "#d3bf97",
    preview: "#f4ead7",
  },
  {
    id: "parchment",
    label: "Parchment",
    backgroundColor: "#efe0bd",
    inkColor: "#2a160d",
    accentColor: "#9b6f3b",
    preview: "linear-gradient(135deg, #f6eccd, #d6b97c 58%, #8f5f30)",
  },
  {
    id: "lined",
    label: "Lined",
    backgroundColor: "#fff7e8",
    inkColor: "#17110b",
    accentColor: "#96bfce",
    preview: "repeating-linear-gradient(0deg, #fff7e8 0 20px, #96bfce 21px 22px)",
  },
  {
    id: "grid",
    label: "Grid",
    backgroundColor: "#f7f0dc",
    inkColor: "#17110b",
    accentColor: "#d7bb70",
    preview: "linear-gradient(#d7bb70 1px, transparent 1px), linear-gradient(90deg, #d7bb70 1px, #f7f0dc 1px)",
  },
  {
    id: "sage",
    label: "Sage",
    backgroundColor: "#dce8d3",
    inkColor: "#15251d",
    accentColor: "#93b48b",
    preview: "linear-gradient(135deg, #edf4dc, #c6dcc5)",
  },
  {
    id: "sky",
    label: "Sky",
    backgroundColor: "#dcecff",
    inkColor: "#142138",
    accentColor: "#8eb7de",
    preview: "linear-gradient(135deg, #eef7ff, #bad7f5)",
  },
  {
    id: "lavender",
    label: "Lavender",
    backgroundColor: "#e8dcff",
    inkColor: "#221832",
    accentColor: "#a68ac8",
    preview: "linear-gradient(135deg, #f5ecff, #d7c2f3)",
  },
  {
    id: "midnight",
    label: "Midnight",
    backgroundColor: "#111827",
    inkColor: "#f7efe0",
    accentColor: "#375a66",
    preview: "linear-gradient(135deg, #111827, #1d2d35)",
  },
];
const editorTexturePresets: Array<{
  id: BackgroundTexture;
  label: string;
  preview: string;
}> = [
  { id: "clean", label: "Clean", preview: "#f4ead7" },
  {
    id: "grain",
    label: "Grain",
    preview: "radial-gradient(circle at 30% 35%, rgba(80, 54, 30, 0.54) 0 2px, transparent 3px), radial-gradient(circle at 70% 62%, rgba(255, 247, 230, 0.34) 0 1px, transparent 2px), #f4ead7",
  },
  {
    id: "fiber",
    label: "Fibers",
    preview: "repeating-linear-gradient(8deg, rgba(80, 54, 30, 0.38) 0 2px, transparent 2px 10px), repeating-linear-gradient(-5deg, rgba(255, 247, 230, 0.22) 0 1px, transparent 1px 15px), #f1e4c8",
  },
  {
    id: "canvas",
    label: "Canvas",
    preview: "repeating-linear-gradient(0deg, rgba(80, 54, 30, 0.34) 0 2px, rgba(255, 247, 230, 0.16) 2px 3px, transparent 3px 9px), repeating-linear-gradient(90deg, rgba(80, 54, 30, 0.3) 0 2px, rgba(255, 247, 230, 0.14) 2px 3px, transparent 3px 10px), #efe2c4",
  },
  {
    id: "woven",
    label: "Woven",
    preview: "repeating-linear-gradient(0deg, rgba(80, 54, 30, 0.36) 0 2px, transparent 2px 11px), repeating-linear-gradient(90deg, rgba(80, 54, 30, 0.32) 0 2px, transparent 2px 11px), repeating-linear-gradient(8deg, rgba(255, 247, 230, 0.18) 0 1px, transparent 1px 12px), #f1e4c8",
  },
];
const DEFAULT_BRUSH_SIZE = 7;
const DEFAULT_CONSTRUCTION_THICKNESS = 12;
const DEFAULT_CANVAS_VIEW: CanvasViewOffset = { x: 0, y: 0 };
const smoothingOptions: Array<{ id: SmoothingMode; label: string }> = [
  { id: "raw", label: "Raw" },
  { id: "gentle", label: "Gentle" },
  { id: "strong", label: "Strong" },
];
const eyeExpressionOptions: Array<{
  id: NonNullable<GlyphDecoration["expression"]>;
  label: string;
}> = [
  { id: "googly", label: "Plain" },
  { id: "happy", label: "Happy" },
  { id: "angry", label: "Angry" },
  { id: "sad", label: "Sad" },
  { id: "tired", label: "Tired" },
  { id: "stoned", label: "Stoned" },
];

function getDefaultDrawingTool(_font: FontSet): InkTool {
  return "quill";
}

function getDefaultInkEffect(_font: FontSet): GlyphInkEffect {
  return "none";
}

function getDefaultInkPresets(font: FontSet): Record<InkPresetId, InkPreset> {
  const defaultTool = getDefaultDrawingTool(font);
  const primaryColor = font.theme?.inkColor ?? getDefaultFontPaletteTheme().inkColor;

  return {
    primary: {
      brushSize: DEFAULT_BRUSH_SIZE,
      highlightColor: DEFAULT_HIGHLIGHT_COLOR,
      inkColor: primaryColor,
      inkEffect: getDefaultInkEffect(font),
      smoothingMode: "strong",
      tool: defaultTool,
    },
    secondary: {
      brushSize: DEFAULT_BRUSH_SIZE,
      highlightColor: DEFAULT_HIGHLIGHT_COLOR,
      inkColor: primaryColor.toLowerCase() === "#e34234" ? "#19140f" : "#e34234",
      inkEffect: "none",
      smoothingMode: "strong",
      tool: defaultTool,
    },
    tertiary: {
      brushSize: DEFAULT_BRUSH_SIZE,
      highlightColor: DEFAULT_HIGHLIGHT_COLOR,
      inkColor: primaryColor.toLowerCase() === "#3d6f8f" ? "#493424" : "#3d6f8f",
      inkEffect: "none",
      smoothingMode: "strong",
      tool: defaultTool,
    },
  };
}

function getDefaultConstructionInkPresets(font: FontSet): Record<InkPresetId, ConstructionInkPreset> {
  const primaryColor = font.theme?.inkColor ?? getDefaultFontPaletteTheme().inkColor;

  return {
    primary: {
      inkColor: primaryColor,
      thickness: DEFAULT_CONSTRUCTION_THICKNESS,
    },
    secondary: {
      inkColor: primaryColor.toLowerCase() === "#e34234" ? "#19140f" : "#e34234",
      thickness: 9,
    },
    tertiary: {
      inkColor: primaryColor.toLowerCase() === "#3d6f8f" ? "#493424" : "#3d6f8f",
      thickness: 6,
    },
  };
}

function getConstructionStrokeWidth(thickness: number) {
  return Math.max(0.01, thickness / 200);
}

function getInkToolLabel(tool: InkTool) {
  return tool === "quill" ? "Quill" : tool === "line" ? "Line" : "Pen";
}

function getReadableInkButtonColor(color: string) {
  const normalizedColor = color.trim();
  const hex = normalizedColor.startsWith("#") ? normalizedColor.slice(1) : normalizedColor;
  const expandedHex =
    hex.length === 3
      ? hex
          .split("")
          .map((digit) => `${digit}${digit}`)
          .join("")
      : hex;

  if (expandedHex.length !== 6) {
    return "#fff7e6";
  }

  const red = Number.parseInt(expandedHex.slice(0, 2), 16);
  const green = Number.parseInt(expandedHex.slice(2, 4), 16);
  const blue = Number.parseInt(expandedHex.slice(4, 6), 16);

  if ([red, green, blue].some((channel) => Number.isNaN(channel))) {
    return "#fff7e6";
  }

  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.58 ? "#17110b" : "#fff7e6";
}

function cloneStrokes(strokes: GlyphStroke[]) {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }));
}

function cloneDecorations(decorations: GlyphDecoration[] = []) {
  return decorations.map((decoration) => ({ ...decoration }));
}

function cloneConstructionPoint(point: ConstructionAnchorPoint): ConstructionAnchorPoint {
  return {
    ...point,
    ...(point.inHandle ? { inHandle: { ...point.inHandle } } : {}),
    ...(point.outHandle ? { outHandle: { ...point.outHandle } } : {}),
  };
}

function cloneConstructionPath(path: ConstructionPath): ConstructionPath {
  return {
    ...path,
    points: path.points.map(cloneConstructionPoint),
  };
}

function cloneConstruction(construction?: GlyphConstruction): GlyphConstruction | undefined {
  if (!construction) {
    return undefined;
  }

  return {
    ...(construction.fillColor ? { fillColor: construction.fillColor } : {}),
    paths: construction.paths.map(cloneConstructionPath),
    ...(construction.strokeColor ? { strokeColor: construction.strokeColor } : {}),
  };
}

function cloneGlyphVariant(variant: GlyphVariant): GlyphVariant {
  const construction = cloneConstruction(variant.construction);

  return {
    ...variant,
    ...(construction ? { construction } : {}),
    decorations: cloneDecorations(variant.decorations),
    strokes: cloneStrokes(variant.strokes),
  };
}

function cloneGlyph(glyph: Glyph): Glyph {
  const construction = cloneConstruction(glyph.construction);

  return {
    ...glyph,
    ...(construction ? { construction } : {}),
    decorations: cloneDecorations(glyph.decorations),
    strokes: cloneStrokes(glyph.strokes),
    variants: glyph.variants?.map(cloneGlyphVariant) ?? [],
  };
}

function createGlyphDraftFromVariant(glyph: Glyph, variant: GlyphVariant): Glyph {
  return {
    ...cloneGlyphVariant(variant),
    variants: glyph.variants?.map(cloneGlyphVariant) ?? [],
  };
}

function createEmptyVariationDraft(glyph: Glyph): Glyph {
  return {
    ...cloneGlyph(glyph),
    construction: undefined,
    decorations: [],
    strokes: [],
  };
}

function getVariationLabel(variation: ActiveVariation) {
  if (variation === "base") {
    return "Base";
  }

  if (variation === "new") {
    return "New variation";
  }

  return `Var ${variation + 1}`;
}

function getDecorationInset(decoration: GlyphDecoration) {
  return decoration.size * 3.2;
}

function getConstructionPoints(construction?: GlyphConstruction) {
  return construction?.paths.flatMap((path) =>
    path.points.flatMap((point) => [
      point,
      ...(point.inHandle ? [point.inHandle] : []),
      ...(point.outHandle ? [point.outHandle] : []),
    ]),
  ) ?? [];
}

function getGlyphElementBounds(
  strokes: GlyphStroke[],
  decorations: GlyphDecoration[] = [],
  construction?: GlyphConstruction,
) {
  const strokePoints = strokes.flatMap((stroke) => stroke.points);
  const decorationPoints = decorations.flatMap((decoration) => {
    const inset = getDecorationInset(decoration);

    return [
      { x: decoration.x - inset, y: decoration.y - inset },
      { x: decoration.x + inset, y: decoration.y + inset },
    ];
  });
  const points = [...strokePoints, ...decorationPoints, ...getConstructionPoints(construction)];

  if (points.length === 0) {
    return undefined;
  }

  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    {
      minX: points[0].x,
      maxX: points[0].x,
      minY: points[0].y,
      maxY: points[0].y,
    },
  );
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function translateStrokes(strokes: GlyphStroke[], dx: number, dy: number) {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({
      ...point,
      x: clamp(point.x + dx),
      y: clamp(point.y + dy),
    })),
  }));
}

function translateDecorations(decorations: GlyphDecoration[], dx: number, dy: number) {
  return decorations.map((decoration) => ({
    ...decoration,
    x: clamp(decoration.x + dx),
    y: clamp(decoration.y + dy),
  }));
}

function translateConstruction(construction: GlyphConstruction | undefined, dx: number, dy: number) {
  if (!construction) {
    return undefined;
  }

  return {
    ...construction,
    paths: construction.paths.map((path) => ({
      ...path,
      points: path.points.map((point) => ({
        ...point,
        ...(point.inHandle ? { inHandle: { x: clamp(point.inHandle.x + dx), y: clamp(point.inHandle.y + dy) } } : {}),
        ...(point.outHandle ? { outHandle: { x: clamp(point.outHandle.x + dx), y: clamp(point.outHandle.y + dy) } } : {}),
        x: clamp(point.x + dx),
        y: clamp(point.y + dy),
      })),
    })),
  };
}

function centerGlyphElements(glyph: Glyph, axis: "x" | "y" | "both") {
  const bounds = getGlyphElementBounds(glyph.strokes, glyph.decorations, glyph.construction);

  if (!bounds) {
    return glyph;
  }

  const currentCenterX = (bounds.minX + bounds.maxX) / 2;
  const currentCenterY = (bounds.minY + bounds.maxY) / 2;
  const dx = axis === "x" || axis === "both" ? 0.5 - currentCenterX : 0;
  const dy = axis === "y" || axis === "both" ? 0.5 - currentCenterY : 0;
  const safeDx = Math.min(1 - bounds.maxX, Math.max(-bounds.minX, dx));
  const safeDy = Math.min(1 - bounds.maxY, Math.max(-bounds.minY, dy));

  return {
    ...glyph,
    construction: translateConstruction(glyph.construction, safeDx, safeDy),
    decorations: translateDecorations(glyph.decorations, safeDx, safeDy),
    strokes: translateStrokes(glyph.strokes, safeDx, safeDy),
  };
}

function nudgeGlyphElements(glyph: Glyph, dx: number, dy: number) {
  return {
    ...glyph,
    construction: translateConstruction(glyph.construction, dx, dy),
    decorations: translateDecorations(glyph.decorations, dx, dy),
    strokes: translateStrokes(glyph.strokes, dx, dy),
  };
}

function getFallbackFont(size: number) {
  return `700 ${size}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function InkColorControl({
  inkColor,
  onInkColorChange,
}: {
  inkColor: string;
  onInkColorChange: (color: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  function selectColor(color: string) {
    onInkColorChange(color);
    setIsOpen(false);
  }

  return (
    <div className="glyph-ink-control">
      <button
        className={`glyph-ink-toggle ${isOpen ? "open" : ""}`}
        type="button"
        aria-expanded={isOpen}
        aria-label="Choose ink color"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="glyph-ink-current" style={{ backgroundColor: inkColor }} />
        Ink
      </button>

      {isOpen && (
        <div className="glyph-ink-menu" aria-label="Ink color menu">
          {glyphInkSwatches.map((swatch) => (
            <button
              key={swatch.label}
              className={`glyph-ink-swatch ${inkColor === swatch.color ? "selected" : ""}`}
              type="button"
              onClick={() => selectColor(swatch.color)}
              aria-label={`Use ${swatch.label} ink`}
              title={swatch.label}
            >
              <span style={{ backgroundColor: swatch.color }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EyeExpressionControl({
  draggableOptions = false,
  expression,
  onOptionPointerDown,
  onExpressionChange,
  showLabels = true,
}: {
  draggableOptions?: boolean;
  expression: NonNullable<GlyphDecoration["expression"]>;
  onOptionPointerDown?: (
    expression: NonNullable<GlyphDecoration["expression"]>,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onExpressionChange: (expression: NonNullable<GlyphDecoration["expression"]>) => void;
  showLabels?: boolean;
}) {
  return (
    <div className={`eye-style-control ${showLabels ? "" : "icon-only"}`} aria-label="Eye expression">
      {eyeExpressionOptions.map((option) => (
        <button
          key={option.id}
          className={`eye-style-button ${expression === option.id ? "selected" : ""}`}
          draggable={false}
          type="button"
          aria-label={option.label}
          title={option.label}
          onClick={() => onExpressionChange(option.id)}
          onPointerDown={(event) => {
            if (draggableOptions) {
              onOptionPointerDown?.(option.id, event);
            }
          }}
        >
          <EyeExpressionPreview expression={option.id} />
          {showLabels && <span>{option.label}</span>}
        </button>
      ))}
    </div>
  );
}

function EyeExpressionPreview({
  expression,
}: {
  expression: NonNullable<GlyphDecoration["expression"]>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const width = 52;
    const height = 34;
    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext("2d");

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    drawGlyphDecoration(
      ctx,
      {
        expression,
        id: `eye_option_${expression}`,
        kind: "googly-eyes",
        size: 0.17,
        x: 0.5,
        y: 0.5,
      },
      0,
      0,
      width,
      width,
      height,
    );
  }, [expression]);

  return <canvas ref={canvasRef} className="eye-style-preview" aria-hidden="true" />;
}

function EditorLivePreview({
  font,
  draftGlyph,
  previewText,
  onPreviewTextChange,
}: {
  font: FontSet;
  draftGlyph: Glyph;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [surfaceWidth, setSurfaceWidth] = useState(320);
  const safePreviewText = previewText ?? "";
  const textToRender = safePreviewText.trim()
    ? safePreviewText
    : `${draftGlyph.character} ${draftGlyph.character}${draftGlyph.character}`;

  useEffect(() => {
    const surface = surfaceRef.current;

    if (!surface) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const nextWidth = Math.floor(entries[0].contentRect.width);

      if (nextWidth > 0) {
        setSurfaceWidth(nextWidth);
      }
    });

    observer.observe(surface);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(260, surfaceWidth);
    const fontSize = 42;
    const padding = 12;
    const previewBackground = font.renderProfile === "quillParchment" ? font.theme?.backgroundColor ?? "#efe0bd" : "#171516";
    const previewInkColor = font.renderProfile === "quillParchment" ? font.theme?.inkColor ?? "#2a160d" : "#f4ead7";
    const fontHeightScale = getFontHeightScale(font);
    const fontWidthScale = getFontWidthScale(font);
    const lineHeight = fontSize * 1.16 * Math.max(0.72, fontHeightScale);
    const glyphs = {
      ...font.glyphs,
      [draftGlyph.character]: draftGlyph,
    };

    ctx.font = getFallbackFont(fontSize);

    const lines: string[] = [];
    let line = "";
    let lineWidth = 0;
    const maxLineWidth = width - padding * 2;

    for (const [characterIndex, character] of [...textToRender.replace(/\n/g, " ")].entries()) {
      const glyph = selectPreviewGlyph(glyphs, character, `${textToRender}|measure|${characterIndex}|${character}`);
      const characterWidth = glyph
        ? getGlyphAdvance(glyph, fontSize, fontWidthScale)
        : character === spacebar
          ? getSpacebarAdvance(font.glyphs[spacebar], fontSize)
          : ctx.measureText(character).width;

      if (line.length > 0 && lineWidth + characterWidth > maxLineWidth) {
        lines.push(line);
        line = character;
        lineWidth = characterWidth;
      } else {
        line += character;
        lineWidth += characterWidth;
      }
    }

    lines.push(line);

    const height = Math.max(104, padding * 2 + lines.length * lineHeight);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = previewBackground;
    ctx.fillRect(0, 0, width, height);
    ctx.font = getFallbackFont(fontSize);
    ctx.textBaseline = "top";

    lines.forEach((previewLine, lineIndex) => {
      let x = padding;
      const y = padding + lineIndex * lineHeight;

      [...previewLine].forEach((character, characterIndex) => {
        const glyph = selectPreviewGlyph(
          glyphs,
          character,
          `${textToRender}|${lineIndex}|${characterIndex}|${character}`,
        );

        if (glyph) {
          const scales = getGlyphRenderScales(font, glyph);
          const baselineY = y + fontSize * 0.76 * fontHeightScale;
          drawGlyph(ctx, glyph, {
            x: x + getGlyphLeftBearingOffset(font, glyph, fontSize),
            y: getGlyphTopForBaseline(glyph, fontSize, baselineY, scales.heightScale),
            size: fontSize,
            color: previewInkColor,
            renderProfile: font.renderProfile,
            heightScale: scales.heightScale,
            widthScale: scales.widthScale,
            backgroundTexture: font.theme?.backgroundTexture,
          });
          x += getGlyphAdvance(glyph, fontSize, fontWidthScale);
          return;
        }

        if (character === spacebar) {
          x += getSpacebarAdvance(font.glyphs[spacebar], fontSize);
          return;
        }

        ctx.fillStyle = previewInkColor;
        ctx.fillText(character, x, y + fontSize * 0.04);
        x += ctx.measureText(character).width;
      });
    });
  }, [draftGlyph, font, surfaceWidth, textToRender]);

  return (
    <div className="editor-live-preview">
      <input
        aria-label="Preview text"
        value={safePreviewText}
        onChange={(event) => onPreviewTextChange(event.target.value)}
      />
      <div ref={surfaceRef} className="editor-live-preview-surface">
        <canvas ref={canvasRef} aria-label="Live typed text preview" />
      </div>
    </div>
  );
}

export default function GlyphEditor({
  font,
  glyph,
  onSaveGlyph,
  onSaveGlyphAndNext,
  onSaveGlyphVariant,
  onUpdateFontGuideSettings,
  onUpdateFontTheme,
  previewText,
  onPreviewTextChange,
  characterIndex,
  characterTotal,
  onPreviousCharacter,
  onNextCharacter,
  isFullScreen,
  onToggleFullScreen,
}: GlyphEditorProps) {
  const [draftGlyph, setDraftGlyph] = useState<Glyph>(() => cloneGlyph(glyph));
  const [activeVariation, setActiveVariation] = useState<ActiveVariation>("base");
  const [editorMode, setEditorMode] = useState<EditorMode>(() =>
    font.writingStyleSettings?.enabledStyles.draw === false && font.writingStyleSettings?.enabledStyles.build
      ? "construction"
      : "draw",
  );
  const draftGlyphRef = useRef<Glyph>(draftGlyph);
  const pastRef = useRef<Glyph[]>([]);
  const futureRef = useRef<Glyph[]>([]);
  const saveAndNextLockRef = useRef(false);
  const [brushSize, setBrushSize] = useState(DEFAULT_BRUSH_SIZE);
  const [eraserMode, setEraserMode] = useState<EraserMode>("stroke");
  const [eyeExpression, setEyeExpression] = useState<NonNullable<GlyphDecoration["expression"]>>("googly");
  const [inkEffect, setInkEffect] = useState<GlyphInkEffect>(() => getDefaultInkEffect(font));
  const [inkColor, setInkColor] = useState(font.theme?.inkColor ?? getDefaultFontPaletteTheme().inkColor);
  const [highlightColor, setHighlightColor] = useState(DEFAULT_HIGHLIGHT_COLOR);
  const [inkPresets, setInkPresets] = useState<Record<InkPresetId, InkPreset>>(() => getDefaultInkPresets(font));
  const [activeInkPresetId, setActiveInkPresetId] = useState<InkPresetId>("primary");
  const [constructionInkPresets, setConstructionInkPresets] = useState<Record<InkPresetId, ConstructionInkPreset>>(() =>
    getDefaultConstructionInkPresets(font),
  );
  const [activeConstructionInkPresetId, setActiveConstructionInkPresetId] = useState<InkPresetId>("primary");
  const [referenceCharacter, setReferenceCharacter] = useState("");
  const [selectMode, setSelectMode] = useState<SelectMode>("moveStroke");
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [stickerDropRequest, setStickerDropRequest] = useState<StickerDropRequest | null>(null);
  const [stickerEyesOpen, setStickerEyesOpen] = useState(false);
  const [stickerMode, setStickerMode] = useState(false);
  const [smoothingMode, setSmoothingMode] = useState<SmoothingMode>("strong");
  const [lastInkTool, setLastInkTool] = useState<InkTool>(() => getDefaultDrawingTool(font));
  const [tool, setTool] = useState<DrawingTool>(() => getDefaultDrawingTool(font));
  const [viewOffset, setViewOffset] = useState<CanvasViewOffset>(DEFAULT_CANVAS_VIEW);
  const [viewScale, setViewScale] = useState(1);
  const [savedMessage, setSavedMessage] = useState("");
  const [historyCounts, setHistoryCounts] = useState({ past: 0, future: 0 });
  const [activeFullscreenDrawer, setActiveFullscreenDrawer] = useState<FullscreenDrawer>(null);
  const [constructionTool, setConstructionTool] = useState<ConstructionTool>("select");
  const [constructionSelection, setConstructionSelection] = useState<ConstructionSelection>({ pathId: null });
  const [constructionShowGuides, setConstructionShowGuides] = useState(true);
  const [constructionSnapSettings, setConstructionSnapSettings] = useState<ConstructionSnapSettings>({
    anchors: true,
    centerline: true,
    grid: true,
    guides: true,
  });
  const [draggingEyeSticker, setDraggingEyeSticker] = useState<{
    expression: NonNullable<GlyphDecoration["expression"]>;
    x: number;
    y: number;
  } | null>(null);
  const fullscreenControlsRef = useRef<HTMLDivElement | null>(null);
  const [stickerEditOpen, setStickerEditOpen] = useState(false);
  const characterLabel = getCharacterLabel(glyph.character);
  const activeReferenceCharacter = referenceCharacter === glyph.character ? "" : referenceCharacter;
  const referenceGlyph = activeReferenceCharacter ? font.glyphs[activeReferenceCharacter] : null;
  const selectedSticker = draftGlyph.decorations.find((decoration) => decoration.id === selectedDecorationId) ?? null;
  const variantCount = glyph.variants?.length ?? 0;
  const activeVariationLabel = getVariationLabel(activeVariation);
  const activeFontTheme: FontTheme = font.theme ?? {
    ...getDefaultFontPaletteTheme(),
    inkColor: inkColor,
  };
  const activeConstructionInkPreset = constructionInkPresets[activeConstructionInkPresetId];
  const enabledWritingStyles = font.writingStyleSettings?.enabledStyles ?? { build: true, draw: true };
  const canUseBuildStyle = enabledWritingStyles.build;
  const canUseDrawStyle = enabledWritingStyles.draw || !canUseBuildStyle;

  useEffect(() => {
    if (editorMode === "draw" && !canUseDrawStyle && canUseBuildStyle) {
      setEditorMode("construction");
      setActiveFullscreenDrawer(null);
      return;
    }

    if (editorMode === "construction" && !canUseBuildStyle && canUseDrawStyle) {
      setEditorMode("draw");
      setActiveFullscreenDrawer(null);
    }
  }, [canUseBuildStyle, canUseDrawStyle, editorMode]);

  useEffect(() => {
    const nextGlyph = cloneGlyph(glyph);
    draftGlyphRef.current = nextGlyph;
    pastRef.current = [];
    futureRef.current = [];
    setDraftGlyph(nextGlyph);
    setActiveVariation("base");
    setHistoryCounts({ past: 0, future: 0 });
    setReferenceCharacter((current) => (current === glyph.character ? "" : current));
    setSelectedDecorationId(null);
    setSelectedStrokeId(null);
    setConstructionSelection({ pathId: null });
    setActiveFullscreenDrawer(null);
    setStickerDropRequest(null);
    setStickerEyesOpen(false);
    setStickerEditOpen(false);
    setStickerMode(false);
    setDraggingEyeSticker(null);
    setSavedMessage("");
  }, [glyph.character]);

  useEffect(() => {
    const nextPresets = getDefaultInkPresets(font);
    const primaryPreset = nextPresets.primary;
    const nextConstructionPresets = getDefaultConstructionInkPresets(font);

    setInkPresets(nextPresets);
    setActiveInkPresetId("primary");
    setConstructionInkPresets(nextConstructionPresets);
    setActiveConstructionInkPresetId("primary");
    setLastInkTool(primaryPreset.tool);
    setTool(primaryPreset.tool);
    setBrushSize(primaryPreset.brushSize);
    setInkEffect(primaryPreset.inkEffect);
    setInkColor(primaryPreset.inkColor);
    setHighlightColor(primaryPreset.highlightColor);
    setSmoothingMode(primaryPreset.smoothingMode);
  }, [font.id, font.renderProfile]);

  useEffect(() => {
    document.body.classList.toggle("editor-fullscreen-open", isFullScreen);

    if (!isFullScreen) {
      setActiveFullscreenDrawer(null);
    }

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [isFullScreen]);

  useEffect(() => {
    if (!isFullScreen || !activeFullscreenDrawer) {
      return;
    }

    function closeDrawerOnOutsidePress(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node) || fullscreenControlsRef.current?.contains(target)) {
        return;
      }

      if (
        activeFullscreenDrawer === "guides" &&
        target instanceof Element &&
        target.classList.contains("glyph-canvas")
      ) {
        return;
      }

      setActiveFullscreenDrawer(null);
    }

    document.addEventListener("pointerdown", closeDrawerOnOutsidePress);
    return () => document.removeEventListener("pointerdown", closeDrawerOnOutsidePress);
  }, [activeFullscreenDrawer, isFullScreen]);

  useEffect(() => {
    if (!stickerMode) {
      setStickerEditOpen(false);
      setStickerEyesOpen(false);
    }
  }, [stickerMode]);

  function syncHistoryCounts() {
    setHistoryCounts({
      past: pastRef.current.length,
      future: futureRef.current.length,
    });
  }

  function pushHistory() {
    pastRef.current = [...pastRef.current.slice(-29), cloneGlyph(draftGlyphRef.current)];
    futureRef.current = [];
    syncHistoryCounts();
  }

  function updateDraftGlyph(glyphDraft: Glyph) {
    draftGlyphRef.current = glyphDraft;
    setDraftGlyph(glyphDraft);
  }

  function replaceDraftGlyph(glyphDraft: Glyph) {
    draftGlyphRef.current = glyphDraft;
    pastRef.current = [];
    futureRef.current = [];
    setSelectedDecorationId(null);
    setSelectedStrokeId(null);
    setDraftGlyph(glyphDraft);
    setHistoryCounts({ past: 0, future: 0 });
  }

  function getGlyphDraftForVariation(variation: ActiveVariation) {
    if (variation === "base") {
      return cloneGlyph(glyph);
    }

    if (variation === "new") {
      return createEmptyVariationDraft(glyph);
    }

    const variant = glyph.variants?.[variation];
    return variant ? createGlyphDraftFromVariant(glyph, variant) : cloneGlyph(glyph);
  }

  function handleSelectVariation(variation: ActiveVariation) {
    setActiveVariation(variation);
    replaceDraftGlyph(getGlyphDraftForVariation(variation));
    setSavedMessage("");
  }

  function handleNewVariation() {
    handleSelectVariation("new");
    setSavedMessage(`New ${getCharacterLabel(glyph.character)} variation draft`);
  }

  function updateDraftStrokes(strokes: GlyphStroke[]) {
    updateDraftGlyph({
      ...draftGlyphRef.current,
      strokes,
    });
  }

  function updateDraftDecorations(decorations: GlyphDecoration[]) {
    updateDraftGlyph({
      ...draftGlyphRef.current,
      decorations,
    });
  }

  function updateDraftConstruction(construction: GlyphConstruction) {
    updateDraftGlyph({
      ...draftGlyphRef.current,
      construction,
    });
  }

  function getSelectedConstructionPath() {
    return draftGlyph.construction?.paths.find((path) => path.id === constructionSelection.pathId) ?? null;
  }

  function getSelectedConstructionPoint() {
    const path = getSelectedConstructionPath();

    return path?.points.find((point) => point.id === constructionSelection.pointId) ?? null;
  }

  function handleDeleteSelectedConstructionTarget() {
    const selectedPath = getSelectedConstructionPath();
    const selectedPoint = getSelectedConstructionPoint();

    if (!selectedPath) {
      return;
    }

    pushHistory();

    if (selectedPoint) {
      updateDraftConstruction({
        ...(draftGlyphRef.current.construction ?? { paths: [] }),
        paths: (draftGlyphRef.current.construction?.paths ?? [])
          .map((path) =>
            path.id === selectedPath.id
              ? { ...path, points: path.points.filter((point) => point.id !== selectedPoint.id) }
              : path,
          )
          .filter((path) => path.points.length > 0),
      });
      setConstructionSelection({ pathId: null });
      return;
    }

    updateDraftConstruction({
      ...(draftGlyphRef.current.construction ?? { paths: [] }),
      paths: (draftGlyphRef.current.construction?.paths ?? []).filter((path) => path.id !== selectedPath.id),
    });
    setConstructionSelection({ pathId: null });
  }

  function handleClearConstruction() {
    if (!(draftGlyphRef.current.construction?.paths.length)) {
      return;
    }

    pushHistory();
    updateDraftConstruction({ paths: [] });
    setConstructionSelection({ pathId: null });
    setConstructionTool("select");
    setSavedMessage("Cleared construction paths");
  }

  function armNewConstructionPath() {
    setConstructionSelection({ pathId: null, pendingNewPath: true });
    setConstructionTool("point");
  }

  function getDefaultConstructionHandle(
    anchor: ConstructionAnchorPoint,
    target: ConstructionAnchorPoint | undefined,
    fallbackDx: number,
  ) {
    if (target) {
      return {
        x: clamp(anchor.x + (target.x - anchor.x) * 0.35),
        y: clamp(anchor.y + (target.y - anchor.y) * 0.35),
      };
    }

    return {
      x: clamp(anchor.x + fallbackDx),
      y: anchor.y,
    };
  }

  function makeSelectedConstructionPointCurved() {
    const selectedPath = getSelectedConstructionPath();
    const selectedPoint = getSelectedConstructionPoint();

    if (!selectedPath || !selectedPoint) {
      setSavedMessage("Select a point first");
      return;
    }

    const pointIndex = selectedPath.points.findIndex((point) => point.id === selectedPoint.id);
    const previousPoint = selectedPath.points[pointIndex - 1] ?? (selectedPath.closed ? selectedPath.points[selectedPath.points.length - 1] : undefined);
    const nextPoint = selectedPath.points[pointIndex + 1] ?? (selectedPath.closed ? selectedPath.points[0] : undefined);
    const inHandle = selectedPoint.inHandle ?? getDefaultConstructionHandle(selectedPoint, previousPoint, -0.12);
    const outHandle = selectedPoint.outHandle ?? getDefaultConstructionHandle(selectedPoint, nextPoint, 0.12);

    pushHistory();
    updateDraftConstruction({
      ...(draftGlyphRef.current.construction ?? { paths: [] }),
      paths: (draftGlyphRef.current.construction?.paths ?? []).map((path) =>
        path.id === selectedPath.id
          ? {
              ...path,
              points: path.points.map((point) =>
                point.id === selectedPoint.id
                  ? {
                      ...point,
                      inHandle,
                      outHandle,
                      segmentType: "curve",
                      type: point.type === "corner" ? "smooth" : point.type,
                    }
                  : point,
              ),
            }
          : path,
      ),
    });
    setConstructionSelection({ handle: "out", pathId: selectedPath.id, pointId: selectedPoint.id });
    setConstructionTool("select");
    setActiveFullscreenDrawer(null);
  }

  function chooseConstructionTool(nextTool: ConstructionTool) {
    setConstructionTool(nextTool);
    setActiveFullscreenDrawer(null);
  }

  function toggleConstructionSnapAll() {
    setConstructionSnapSettings((current) => {
      const nextValue = !Object.values(current).some(Boolean);
      return {
        anchors: nextValue,
        centerline: nextValue,
        grid: nextValue,
        guides: nextValue,
      };
    });
  }

  function openConstructionMode() {
    if (!canUseBuildStyle) {
      return;
    }

    setEditorMode("construction");
    setActiveFullscreenDrawer(null);
  }

  function updateActiveInkPreset(patch: Partial<InkPreset>) {
    setInkPresets((current) => ({
      ...current,
      [activeInkPresetId]: {
        ...current[activeInkPresetId],
        ...patch,
      },
    }));
  }

  function updateBrushSize(value: number) {
    setBrushSize(value);
    updateActiveInkPreset({ brushSize: value });
  }

  function updateInkColor(value: string) {
    setInkColor(value);
    updateActiveInkPreset({ inkColor: value });
  }

  function updateHighlightColor(value: string) {
    setHighlightColor(value);
    updateActiveInkPreset({ highlightColor: value });
  }

  function updateInkEffect(value: GlyphInkEffect) {
    setInkEffect(value);
    updateActiveInkPreset({ inkEffect: value });
  }

  function toggleSpreadInk() {
    updateInkEffect(inkEffect === "subtleSpread" ? "none" : "subtleSpread");
  }

  function toggleDramaticInk() {
    updateInkEffect(inkEffect === "dramaticPooling" ? "none" : "dramaticPooling");
  }

  function toggleBubbleInk() {
    const isTurningOn = inkEffect !== "bubbleHighlight";

    updateInkEffect(isTurningOn ? "bubbleHighlight" : "none");

    if (isTurningOn) {
      setLastInkTool("pen");
      setTool("pen");
      updateActiveInkPreset({ tool: "pen" });
    }
  }

  function updateSmoothingMode(value: SmoothingMode) {
    setSmoothingMode(value);
    updateActiveInkPreset({ smoothingMode: value });
  }

  function applyInkPreset(presetId: InkPresetId) {
    const preset = inkPresets[presetId];

    setActiveInkPresetId(presetId);
    setBrushSize(preset.brushSize);
    setInkColor(preset.inkColor);
    setHighlightColor(preset.highlightColor);
    setInkEffect(preset.inkEffect);
    setSmoothingMode(preset.smoothingMode);
    setLastInkTool(preset.tool);
    setTool(preset.tool);
    setSelectedStrokeId(null);
    setSelectedDecorationId(null);
    setStickerEyesOpen(false);
  }

  function handleInkPresetButton(presetId: InkPresetId) {
    if (presetId === activeInkPresetId) {
      toggleFullscreenDrawer("ink");
      return;
    }

    applyInkPreset(presetId);
    setActiveFullscreenDrawer(null);
  }

  function updateActiveConstructionInkPreset(patch: Partial<ConstructionInkPreset>) {
    setConstructionInkPresets((current) => ({
      ...current,
      [activeConstructionInkPresetId]: {
        ...current[activeConstructionInkPresetId],
        ...patch,
      },
    }));
  }

  function updateConstructionInkColor(value: string) {
    updateActiveConstructionInkPreset({ inkColor: value });
  }

  function updateConstructionInkThickness(value: number) {
    updateActiveConstructionInkPreset({ thickness: value });
  }

  function handleConstructionInkPresetButton(presetId: InkPresetId) {
    if (presetId === activeConstructionInkPresetId) {
      toggleFullscreenDrawer("constructionInk");
      return;
    }

    setActiveConstructionInkPresetId(presetId);
    setActiveFullscreenDrawer(null);
  }

  function chooseTool(nextTool: DrawingTool) {
    if (nextTool === "pen" || nextTool === "quill" || nextTool === "line") {
      setLastInkTool(nextTool);
      updateActiveInkPreset({ tool: nextTool });
    }

    setTool(nextTool);

    if (nextTool !== "select") {
      setSelectedStrokeId(null);
    }

    if (nextTool !== "eyes") {
      setSelectedDecorationId(null);
      setStickerEyesOpen(false);
    }
  }

  function chooseDockTool(nextTool: DrawingTool) {
    chooseTool(nextTool);
    setActiveFullscreenDrawer(null);
  }

  function toggleFullscreenDrawer(drawer: Exclude<FullscreenDrawer, null>) {
    setActiveFullscreenDrawer((current) => (current === drawer ? null : drawer));
  }

  function enterStickerMode() {
    setActiveFullscreenDrawer(null);
    setStickerEditOpen(false);
    setStickerEyesOpen(false);
    setStickerMode(true);
    chooseTool("eyes");
  }

  function exitStickerMode() {
    setStickerMode(false);
    setStickerEditOpen(false);
    setStickerEyesOpen(false);
    setSelectedDecorationId(null);
    chooseTool(lastInkTool);
  }

  function handleSelectBackgroundPreset(preset: (typeof editorBackgroundPresets)[number]) {
    const nextTheme: FontTheme = {
      accentColor: preset.accentColor,
      backgroundColor: preset.backgroundColor,
      backgroundStyle: preset.id,
      backgroundTexture: activeFontTheme.backgroundTexture,
      inkColor: preset.inkColor,
      paletteId: activeFontTheme.paletteId,
    };

    onUpdateFontTheme(nextTheme);
    updateInkColor(preset.inkColor);
  }

  function handleSelectBackgroundTexture(texture: BackgroundTexture) {
    onUpdateFontTheme({
      ...activeFontTheme,
      backgroundTexture: texture,
    });
  }

  function handleGuideSettingChange(key: keyof FontGuideSettings, value: number) {
    onUpdateFontGuideSettings(clampFontGuideSettings(font.guideSettings, key, value));
  }

  function handleDeleteSelectedStroke() {
    if (!selectedStrokeId) {
      return;
    }

    pushHistory();
    updateDraftStrokes(draftGlyphRef.current.strokes.filter((stroke) => stroke.id !== selectedStrokeId));
    setSelectedStrokeId(null);
    setSavedMessage("Deleted stroke");
  }

  function handleDeleteSelectedSticker() {
    if (!selectedDecorationId) {
      return;
    }

    pushHistory();
    updateDraftDecorations(draftGlyphRef.current.decorations.filter((decoration) => decoration.id !== selectedDecorationId));
    setSelectedDecorationId(null);
    setSavedMessage("Deleted sticker");
  }

  function handleEyeStickerDragStart(
    expression: NonNullable<GlyphDecoration["expression"]>,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    const dragSource = event.currentTarget;
    dragSource.setPointerCapture(event.pointerId);
    flushSync(() => {
      setEyeExpression(expression);
      setDraggingEyeSticker({ expression, x: event.clientX, y: event.clientY });
    });

    function handlePointerMove(pointerEvent: PointerEvent) {
      setDraggingEyeSticker({ expression, x: pointerEvent.clientX, y: pointerEvent.clientY });
    }

    function handlePointerUp(pointerEvent: PointerEvent) {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      if (dragSource.hasPointerCapture(pointerEvent.pointerId)) {
        dragSource.releasePointerCapture(pointerEvent.pointerId);
      }
      setDraggingEyeSticker(null);
      setStickerDropRequest({
        clientX: pointerEvent.clientX,
        clientY: pointerEvent.clientY,
        expression,
        id: Date.now(),
      });
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }

  function smoothStrokePoints(points: GlyphStroke["points"]) {
    if (points.length < 3) {
      return points.map((point) => ({ ...point }));
    }

    return points.map((point, index) => {
      const previousPoint = points[index - 1];
      const nextPoint = points[index + 1];

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
    });
  }

  function handleSmoothSelectedStroke() {
    if (!selectedStrokeId) {
      return;
    }

    pushHistory();
    updateDraftStrokes(
      draftGlyphRef.current.strokes.map((stroke) =>
        stroke.id === selectedStrokeId
          ? {
              ...stroke,
              points: smoothStrokePoints(stroke.points),
            }
          : stroke,
      ),
    );
    chooseTool("select");
    setSavedMessage("Smoothed stroke");
  }

  function handleSpreadSelectedStroke() {
    if (!selectedStrokeId) {
      return;
    }

    pushHistory();
    updateDraftStrokes(
      draftGlyphRef.current.strokes.map((stroke) => {
        if (stroke.id !== selectedStrokeId) {
          return stroke;
        }

        const strokeWidthPx = Math.max(1, stroke.size * 720);
        const spreadAmount = Math.min(1, 0.34 + Math.min(1, strokeWidthPx / 24) * 0.32);

        return {
          ...stroke,
          inkEffect: stroke.inkEffect === "dramaticPooling" ? stroke.inkEffect : "subtleSpread",
          points: stroke.points.map((point) => ({
            ...point,
            spread: Math.max(point.spread ?? 0, spreadAmount),
          })),
        };
      }),
    );
    chooseTool("select");
    setSavedMessage("Added ink spread");
  }

  function handleZoom(delta: number) {
    setViewScale((current) => Math.min(3, Math.max(0.65, Number((current + delta).toFixed(2)))));
  }

  function handleResetView() {
    setViewScale(1);
    setViewOffset(DEFAULT_CANVAS_VIEW);
  }

  function renderReferenceGlyphControl() {
    const visibleCharacters = getVisibleCharacters(font);

    return (
      <label className="reference-control">
        <span>Reference</span>
        <select value={activeReferenceCharacter} onChange={(event) => setReferenceCharacter(event.target.value)}>
          <option value="">None</option>
          {visibleCharacters
            .filter((character) => character !== glyph.character)
            .map((character) => (
              <option key={character} value={character}>
                {getCharacterLabel(character)}
              </option>
            ))}
        </select>
      </label>
    );
  }

  function getSavedGlyphDraft() {
    return {
      ...cloneGlyph(draftGlyphRef.current),
      character: glyph.character,
      updatedAt: new Date().toISOString(),
    };
  }

  function saveActiveVariation(savedGlyph: Glyph) {
    if (activeVariation === "base") {
      onSaveGlyph(savedGlyph);
      setSavedMessage(`Saved ${getCharacterLabel(glyph.character)} base`);
      return;
    }

    const variantIndex = activeVariation === "new" ? undefined : activeVariation;

    onSaveGlyphVariant(savedGlyph, variantIndex);

    if (activeVariation === "new") {
      setActiveVariation(variantCount);
      setSavedMessage(`Saved Var ${variantCount + 1} for ${getCharacterLabel(glyph.character)}`);
      return;
    }

    setSavedMessage(`Saved ${getVariationLabel(activeVariation)} for ${getCharacterLabel(glyph.character)}`);
  }

  function handleSave() {
    const savedGlyph = getSavedGlyphDraft();

    saveActiveVariation(savedGlyph);
  }

  function handleSaveAndNext() {
    const savedGlyph = getSavedGlyphDraft();

    if (activeVariation === "base") {
      flushSync(() => {
        onSaveGlyphAndNext(savedGlyph);
      });
      setSavedMessage(`Saved ${getCharacterLabel(glyph.character)} base`);
      return;
    }

    flushSync(() => {
      onSaveGlyphVariant(savedGlyph, activeVariation === "new" ? undefined : activeVariation);
      onNextCharacter();
    });
    setActiveVariation("base");
    setSavedMessage(`Saved ${getCharacterLabel(glyph.character)} variation`);
  }

  function runFullscreenSaveAndNext() {
    if (saveAndNextLockRef.current) {
      return;
    }

    saveAndNextLockRef.current = true;
    handleSaveAndNext();
    window.setTimeout(() => {
      saveAndNextLockRef.current = false;
    }, 180);
  }

  function handleFullscreenSaveAndNext(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    runFullscreenSaveAndNext();
  }

  function handleFullscreenSaveAndNextTouch(event: ReactTouchEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    runFullscreenSaveAndNext();
  }

  function handleSaveAndNextClick(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    runFullscreenSaveAndNext();
  }

  function handleSaveVariant() {
    const savedGlyph = {
      ...cloneGlyph(draftGlyphRef.current),
      updatedAt: new Date().toISOString(),
    };

    onSaveGlyphVariant({
      ...savedGlyph,
      character: glyph.character,
    });

    setActiveVariation(variantCount);
    setSavedMessage(`Saved variant ${variantCount + 1} for ${getCharacterLabel(glyph.character)}`);
  }

  function handleClear() {
    pushHistory();
    updateDraftGlyph({
      ...draftGlyphRef.current,
      construction: undefined,
      decorations: [],
      strokes: [],
    });
    setConstructionSelection({ pathId: null });
    setSavedMessage("");
  }

  function handleCenter(axis: "x" | "y" | "both") {
    pushHistory();
    updateDraftGlyph(centerGlyphElements(draftGlyphRef.current, axis));
    setSavedMessage("Centered draft");
  }

  function handleNudge(dx: number, dy: number, label: string) {
    pushHistory();
    updateDraftGlyph(nudgeGlyphElements(draftGlyphRef.current, dx, dy));
    setSavedMessage(`Nudged ${label}`);
  }

  function handleMetricChange(nextGlyph: Glyph) {
    pushHistory();
    updateDraftGlyph(nextGlyph);
    setSavedMessage("Spacing adjusted");
  }

  function handleUndo() {
    const previousGlyph = pastRef.current.pop();

    if (!previousGlyph) {
      return;
    }

    futureRef.current = [cloneGlyph(draftGlyphRef.current), ...futureRef.current.slice(0, 29)];
    updateDraftGlyph(cloneGlyph(previousGlyph));
    syncHistoryCounts();
  }

  function handleRedo() {
    const nextGlyph = futureRef.current.shift();

    if (!nextGlyph) {
      return;
    }

    pastRef.current = [...pastRef.current.slice(-29), cloneGlyph(draftGlyphRef.current)];
    updateDraftGlyph(cloneGlyph(nextGlyph));
    syncHistoryCounts();
  }

  function renderConstructionMode() {
    const selectedPath = getSelectedConstructionPath();
    const selectedPoint = getSelectedConstructionPoint();
    const hasSnap = Object.values(constructionSnapSettings).some(Boolean);
    const constructionPaths = draftGlyph.construction?.paths ?? [];
    const constructionPathCount = constructionPaths.length;
    const constructionPointCount = constructionPaths.reduce((total, path) => total + path.points.length, 0);
    const selectedPointHasCurve = Boolean(selectedPoint && (selectedPoint.inHandle || selectedPoint.outHandle || selectedPoint.segmentType === "curve"));
    const selectedPathIndex = selectedPath ? constructionPaths.findIndex((path) => path.id === selectedPath.id) : -1;
    const selectedLabel = selectedPoint
      ? "Point"
      : selectedPath && selectedPathIndex >= 0
        ? `Path ${selectedPathIndex + 1}`
        : "None";
    const toolOptions: Array<{ id: ConstructionTool; label: string }> = [
      { id: "select", label: "Select" },
      { id: "point", label: "Point" },
      { id: "delete", label: "Delete" },
    ];

    return (
      <div className="construction-editor-layout construction-editor-layout-simple">
        <aside className="construction-side-panel construction-viewer-panel" aria-label="Construction glyph viewer">
          <div className="construction-panel-heading">
            <span>Anchor paths</span>
            <strong>{characterLabel}</strong>
          </div>
          <div className="construction-stat-grid">
            <div>
              <span>Paths</span>
              <strong>{constructionPathCount}</strong>
            </div>
            <div>
              <span>Points</span>
              <strong>{constructionPointCount}</strong>
            </div>
          </div>
          <div className="construction-path-list" aria-label="Construction paths">
            {constructionPaths.map((path, index) => (
              <button
                key={path.id}
                className={`construction-path-chip ${constructionSelection.pathId === path.id ? "selected" : ""}`}
                type="button"
                onClick={() => setConstructionSelection({ pathId: path.id })}
              >
                <span>Path {index + 1}</span>
                <strong>{path.points.length} pts</strong>
              </button>
            ))}
            <button
              className={`construction-path-chip ${constructionSelection.pendingNewPath ? "selected" : ""}`}
              type="button"
              onClick={armNewConstructionPath}
            >
              <span>New path</span>
              <strong>tap canvas</strong>
            </button>
          </div>
        </aside>

        <div className="construction-center-panel">
          <GlyphConstructionCanvas
            backgroundAccentColor={activeFontTheme.accentColor}
            backgroundColor={activeFontTheme.backgroundColor}
            backgroundStyle={activeFontTheme.backgroundStyle}
            backgroundTexture={activeFontTheme.backgroundTexture}
            construction={draftGlyph.construction}
            guideSettings={font.guideSettings}
            selection={constructionSelection}
            showGuides={constructionShowGuides}
            snapSettings={constructionSnapSettings}
            strokeColor={activeConstructionInkPreset.inkColor}
            strokeWidth={getConstructionStrokeWidth(activeConstructionInkPreset.thickness)}
            tool={constructionTool}
            onChange={updateDraftConstruction}
            onEditStart={pushHistory}
            onSelectionChange={setConstructionSelection}
          />
        </div>

        <aside className="construction-side-panel construction-controls-panel" aria-label="Construction mode controls">
          <div className="construction-panel-heading">
            <span>Construction</span>
            <strong>{selectedLabel}</strong>
          </div>

          <div className="construction-tool-grid three" aria-label="Construction tools">
            {toolOptions.map((option) => (
              <button
                key={option.id}
                className={`secondary-button ${constructionTool === option.id ? "active-tool" : ""}`}
                type="button"
                onClick={() => setConstructionTool(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="construction-tool-grid two" aria-label="Construction toggles">
            <button
              className={`secondary-button ${constructionShowGuides ? "active-tool" : ""}`}
              type="button"
              onClick={() => setConstructionShowGuides((current) => !current)}
            >
              Guides
            </button>
            <button
              className={`secondary-button ${hasSnap ? "active-tool" : ""}`}
              type="button"
              onClick={toggleConstructionSnapAll}
            >
              Snap
            </button>
          </div>

          <div className="construction-section">
            <div className="construction-section-heading">
              <span>Selected</span>
              <strong>
                {selectedPoint
                  ? `${Math.round(selectedPoint.x * 100)}, ${Math.round(selectedPoint.y * 100)}`
                  : selectedPath
                    ? `${selectedPath.points.length} points`
                    : "Nothing"}
              </strong>
            </div>
            <div className="construction-tool-grid two">
              <button
                className={`secondary-button ${constructionSelection.pendingNewPath ? "active-tool" : ""}`}
                type="button"
                onClick={armNewConstructionPath}
              >
                New Path
              </button>
              <button
                className={`secondary-button ${selectedPointHasCurve ? "active-tool" : ""}`}
                type="button"
                disabled={!selectedPoint}
                onClick={makeSelectedConstructionPointCurved}
              >
                Curve
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={!selectedPath}
                onClick={handleDeleteSelectedConstructionTarget}
              >
                Delete Selected
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={!constructionPathCount}
                onClick={handleClearConstruction}
              >
                Clear All
              </button>
            </div>
          </div>
        </aside>
      </div>
    );
  }

  function renderVariationControls(className = "glyph-variation-strip") {
    const variants = glyph.variants ?? [];

    return (
      <div className={className} aria-label={`${getCharacterLabel(glyph.character)} variations`}>
        <div className="variation-summary">
          <Layers aria-hidden="true" />
          <span>{activeVariationLabel}</span>
          <strong>{variants.length + 1} forms</strong>
        </div>
        <div className="variation-buttons" role="group" aria-label="Choose variation to edit">
          <button
            className={`variation-button ${activeVariation === "base" ? "selected" : ""}`}
            type="button"
            aria-pressed={activeVariation === "base"}
            onClick={() => handleSelectVariation("base")}
          >
            Base
          </button>
          {variants.map((variant, index) => (
            <button
              key={`${variant.updatedAt}-${index}`}
              className={`variation-button ${activeVariation === index ? "selected" : ""}`}
              type="button"
              aria-pressed={activeVariation === index}
              onClick={() => handleSelectVariation(index)}
            >
              Var {index + 1}
            </button>
          ))}
          <button
            className={`variation-button new-variation-button ${activeVariation === "new" ? "selected" : ""}`}
            type="button"
            aria-pressed={activeVariation === "new"}
            onClick={handleNewVariation}
          >
            <Plus aria-hidden="true" />
            New
          </button>
        </div>
      </div>
    );
  }

  function renderConstructionFullscreen() {
    const selectedPath = getSelectedConstructionPath();
    const selectedPoint = getSelectedConstructionPoint();
    const constructionPaths = draftGlyph.construction?.paths ?? [];
    const constructionPathCount = constructionPaths.length;
    const constructionPointCount = constructionPaths.reduce((total, path) => total + path.points.length, 0);
    const selectedPointHasCurve = Boolean(selectedPoint && (selectedPoint.inHandle || selectedPoint.outHandle || selectedPoint.segmentType === "curve"));
    const selectedPathIndex = selectedPath ? constructionPaths.findIndex((path) => path.id === selectedPath.id) : -1;
    const selectedLabel = selectedPoint
      ? "Point"
      : selectedPath && selectedPathIndex >= 0
        ? `Path ${selectedPathIndex + 1}`
        : "None";
    const hasSnap = Object.values(constructionSnapSettings).some(Boolean);

    return (
      <section className="studio-panel editor-panel fullscreen-editor fullscreen-construction-only" aria-label="Letter construction">
        <div className="construction-fullscreen-canvas">
          <GlyphConstructionCanvas
            backgroundAccentColor={activeFontTheme.accentColor}
            backgroundColor={activeFontTheme.backgroundColor}
            backgroundStyle={activeFontTheme.backgroundStyle}
            backgroundTexture={activeFontTheme.backgroundTexture}
            construction={draftGlyph.construction}
            guideSettings={font.guideSettings}
            selection={constructionSelection}
            showGuides={constructionShowGuides}
            snapSettings={constructionSnapSettings}
            strokeColor={activeConstructionInkPreset.inkColor}
            strokeWidth={getConstructionStrokeWidth(activeConstructionInkPreset.thickness)}
            tool={constructionTool}
            onChange={updateDraftConstruction}
            onEditStart={pushHistory}
            onSelectionChange={setConstructionSelection}
          />
        </div>

        <div className="construction-header-stack" aria-label="Construction header">
          <div className="draw-only-topbar construction-only-topbar" aria-label="Construction navigation">
            <button
              className="draw-glass-button draw-icon-button draw-top-icon"
              type="button"
              aria-label="Go home"
              title="Home"
              onClick={() => {
                setActiveFullscreenDrawer(null);
                onToggleFullScreen();
              }}
            >
              <Home aria-hidden="true" />
            </button>
            <button
              className="draw-glass-button draw-icon-button draw-top-icon"
              type="button"
              aria-label="Previous glyph"
              title="Previous"
              onClick={onPreviousCharacter}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <div className="draw-character-pill">
              <strong>{characterLabel}</strong>
              <span>
                {activeVariationLabel} - {characterIndex + 1}/{characterTotal}
              </span>
            </div>
            {canUseDrawStyle && (
              <button
                className="draw-glass-button draw-top-construction-button"
                type="button"
                aria-label="Return to drawing mode"
                title="Draw"
                onClick={() => {
                  setEditorMode("draw");
                  setActiveFullscreenDrawer(null);
                }}
              >
                Draw
              </button>
            )}
            <button
              className="draw-glass-button draw-icon-button draw-top-icon"
              type="button"
              aria-label="Next glyph"
              title="Next"
              onClick={onNextCharacter}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>

          <div className="construction-path-strip" aria-label="Construction paths">
            {constructionPaths.map((path, index) => (
              <button
                key={path.id}
                className={`construction-path-tab ${constructionSelection.pathId === path.id ? "selected" : ""}`}
                type="button"
                aria-pressed={constructionSelection.pathId === path.id}
                onClick={() => {
                  setConstructionSelection({ pathId: path.id });
                  setActiveFullscreenDrawer(null);
                }}
              >
                <span>Path {index + 1}</span>
                <strong>{path.points.length}</strong>
              </button>
            ))}
            <button
              className={`construction-path-tab construction-path-new-tab ${constructionSelection.pendingNewPath ? "selected" : ""}`}
              type="button"
              aria-pressed={constructionSelection.pendingNewPath}
              onClick={() => {
                armNewConstructionPath();
                setActiveFullscreenDrawer(null);
              }}
            >
              <Plus aria-hidden="true" />
              <span>New</span>
            </button>
          </div>
        </div>

        <div className="draw-fullscreen-controls construction-fullscreen-controls" ref={fullscreenControlsRef}>
          {savedMessage && (
            <div className="draw-save-status" aria-live="polite">
              {savedMessage}
            </div>
          )}

          {activeFullscreenDrawer === "constructionPaths" && (
            <div id="construction-paths-drawer" className="draw-control-drawer construction-paths-drawer" aria-label="Construction paths drawer">
              <div className="construction-stat-grid">
                <div>
                  <span>Paths</span>
                  <strong>{constructionPathCount}</strong>
                </div>
                <div>
                  <span>Points</span>
                  <strong>{constructionPointCount}</strong>
                </div>
                <div>
                  <span>Selected</span>
                  <strong>{selectedLabel}</strong>
                </div>
              </div>
              <div className="construction-path-list construction-path-list-horizontal" aria-label="Construction paths">
                {constructionPaths.map((path, index) => (
                  <button
                    key={path.id}
                    className={`construction-path-chip ${constructionSelection.pathId === path.id ? "selected" : ""}`}
                    type="button"
                    onClick={() => setConstructionSelection({ pathId: path.id })}
                  >
                    <span>Path {index + 1}</span>
                    <strong>{path.points.length} pts</strong>
                  </button>
                ))}
                <button
                  className={`construction-path-chip ${constructionSelection.pendingNewPath ? "selected" : ""}`}
                  type="button"
                  onClick={armNewConstructionPath}
                >
                  <span>New path</span>
                  <strong>tap canvas</strong>
                </button>
              </div>
              <div className="draw-drawer-grid three" aria-label="Construction path actions">
                <button className="draw-drawer-button" type="button" onClick={armNewConstructionPath}>
                  <Plus aria-hidden="true" />
                  <span>New Path</span>
                </button>
                <button
                  className="draw-drawer-button danger-action"
                  type="button"
                  disabled={!selectedPath}
                  onClick={handleDeleteSelectedConstructionTarget}
                >
                  <X aria-hidden="true" />
                  <span>Delete Selected</span>
                </button>
                <button
                  className="draw-drawer-button danger-action"
                  type="button"
                  disabled={!constructionPathCount}
                  onClick={handleClearConstruction}
                >
                  <RotateCcw aria-hidden="true" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          )}

          {activeFullscreenDrawer === "constructionAdd" && (
            <div id="construction-add-drawer" className="draw-control-drawer" aria-label="Construction add drawer">
              <div className="draw-drawer-grid two">
                <button
                  className={`draw-drawer-button ${constructionTool === "point" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => chooseConstructionTool("point")}
                >
                  <Plus aria-hidden="true" />
                  <span>Point</span>
                </button>
                <button
                  className={`draw-drawer-button ${selectedPointHasCurve ? "active-tool" : ""}`}
                  type="button"
                  disabled={!selectedPoint}
                  onClick={makeSelectedConstructionPointCurved}
                >
                  <Circle aria-hidden="true" />
                  <span>Curve</span>
                </button>
              </div>
            </div>
          )}

          {activeFullscreenDrawer === "constructionInk" && (
            <div id="construction-ink-drawer" className="draw-control-drawer" aria-label="Construction ink drawer">
              <div className="draw-ink-preset-selector" aria-label="Construction ink quick slots">
                {inkPresetIds.map((presetId, index) => {
                  const preset = constructionInkPresets[presetId];

                  return (
                    <button
                      key={presetId}
                      className={`draw-ink-preset-option ${activeConstructionInkPresetId === presetId ? "active-tool" : ""}`}
                      type="button"
                      onClick={() => setActiveConstructionInkPresetId(presetId)}
                      aria-label={`Edit construction ink slot ${index + 1}`}
                    >
                      <span className="draw-ink-preset-dot" style={{ backgroundColor: preset.inkColor }} />
                      <strong>{index + 1}</strong>
                      <span>{preset.thickness}px</span>
                    </button>
                  );
                })}
              </div>

              <label className="draw-drawer-range">
                <span>Thickness</span>
                <input
                  type="range"
                  min="2"
                  max="28"
                  value={activeConstructionInkPreset.thickness}
                  onChange={(event) => updateConstructionInkThickness(Number(event.target.value))}
                />
                <output>{activeConstructionInkPreset.thickness}px</output>
              </label>

              <div className="draw-ink-swatches" aria-label="Construction ink colors">
                {glyphInkSwatches.map((swatch) => (
                  <button
                    key={swatch.label}
                    className={`draw-ink-swatch ${activeConstructionInkPreset.inkColor === swatch.color ? "selected" : ""}`}
                    type="button"
                    onClick={() => updateConstructionInkColor(swatch.color)}
                    aria-label={`Use ${swatch.label} construction ink`}
                    title={swatch.label}
                  >
                    <span style={{ backgroundColor: swatch.color }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFullscreenDrawer === "constructionSettings" && (
            <div id="construction-settings-drawer" className="draw-control-drawer draw-guide-drawer" aria-label="Construction settings drawer">
              <div className="draw-drawer-grid three" aria-label="Construction guide actions">
                <button
                  className={`draw-drawer-button ${constructionShowGuides ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => setConstructionShowGuides((current) => !current)}
                >
                  <Eye aria-hidden="true" />
                  <span>Guides</span>
                </button>
                <button
                  className={`draw-drawer-button ${hasSnap ? "active-tool" : ""}`}
                  type="button"
                  onClick={toggleConstructionSnapAll}
                >
                  <MousePointer2 aria-hidden="true" />
                  <span>Snap</span>
                </button>
                <button className="draw-drawer-button" type="button" onClick={() => onUpdateFontGuideSettings({ ...defaultFontGuideSettings })}>
                  <RotateCcw aria-hidden="true" />
                  <span>Reset</span>
                </button>
              </div>
              <div className="draw-guide-settings">
                {fontGuideRows.map((guide) => (
                  <label key={guide.key} className="draw-drawer-range draw-guide-range">
                    <span>{guide.label}</span>
                    <input
                      type="range"
                      min="0.02"
                      max="0.98"
                      step="0.01"
                      value={font.guideSettings[guide.key]}
                      onChange={(event) => handleGuideSettingChange(guide.key, Number(event.target.value))}
                    />
                    <output>{Math.round(font.guideSettings[guide.key] * 100)}%</output>
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeFullscreenDrawer === "constructionMore" && (
            <div id="construction-more-drawer" className="draw-control-drawer" aria-label="Construction save drawer">
              {renderVariationControls("glyph-variation-strip draw-variation-strip")}
              <div className="draw-drawer-grid three" aria-label="Construction save actions">
                <button
                  className="draw-drawer-button"
                  type="button"
                  onClick={() => {
                    handleSave();
                    setActiveFullscreenDrawer(null);
                  }}
                >
                  <Save aria-hidden="true" />
                  <span>Save base</span>
                </button>
                <button
                  className="draw-drawer-button"
                  type="button"
                  onClick={() => {
                    handleSaveVariant();
                    setActiveFullscreenDrawer(null);
                  }}
                >
                  <Save aria-hidden="true" />
                  <span>Save var</span>
                </button>
                <button
                  className="draw-drawer-button accent"
                  type="button"
                  onPointerUp={handleFullscreenSaveAndNext}
                  onTouchEnd={handleFullscreenSaveAndNextTouch}
                  onClick={handleSaveAndNextClick}
                >
                  <SkipForward aria-hidden="true" />
                  <span>Save + next</span>
                </button>
              </div>
            </div>
          )}

          <div className="draw-only-toolbar construction-only-toolbar" aria-label="Construction dock">
            <button
              className={`draw-glass-button draw-icon-button ${constructionTool === "select" ? "active-tool" : ""}`}
              type="button"
              aria-label="Use construction select"
              title="Select"
              onClick={() => chooseConstructionTool("select")}
            >
              <MousePointer2 aria-hidden="true" />
            </button>
            <button
              className={`draw-glass-button draw-icon-button ${
                activeFullscreenDrawer === "constructionAdd" || constructionTool === "point" ? "active-tool" : ""
              }`}
              type="button"
              aria-label="Open construction add tools"
              aria-expanded={activeFullscreenDrawer === "constructionAdd"}
              aria-controls="construction-add-drawer"
              title="Add"
              onClick={() => toggleFullscreenDrawer("constructionAdd")}
            >
              <Plus aria-hidden="true" />
            </button>
            <button
              className={`draw-glass-button draw-icon-button ${constructionTool === "delete" ? "active-tool" : ""}`}
              type="button"
              aria-label="Use construction delete"
              title="Delete"
              onClick={() => chooseConstructionTool("delete")}
            >
              <X aria-hidden="true" />
            </button>
            <button
              className="draw-glass-button draw-icon-button"
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              disabled
            />
            <div className="draw-ink-preset-group construction-ink-preset-group" aria-label="Construction ink quick slots">
              {inkPresetIds.map((presetId, index) => {
                const preset = constructionInkPresets[presetId];
                const isActivePreset = presetId === activeConstructionInkPresetId;

                return (
                  <button
                    key={presetId}
                    className={`draw-glass-button draw-icon-button draw-ink-color-button ${
                      isActivePreset ? "selected-preset" : ""
                    } ${isActivePreset && activeFullscreenDrawer === "constructionInk" ? "active-tool" : ""}`}
                    type="button"
                    aria-label={`${isActivePreset ? "Open" : "Use"} construction ink slot ${index + 1}`}
                    aria-expanded={isActivePreset ? activeFullscreenDrawer === "constructionInk" : undefined}
                    aria-controls="construction-ink-drawer"
                    title={`Construction ink ${index + 1}: ${preset.thickness}px`}
                    style={{ backgroundColor: preset.inkColor, color: getReadableInkButtonColor(preset.inkColor) }}
                    onClick={() => handleConstructionInkPresetButton(presetId)}
                  >
                    <span>{index + 1}</span>
                  </button>
                );
              })}
            </div>
            <button
              className={`draw-glass-button draw-icon-button ${activeFullscreenDrawer === "constructionSettings" ? "active-tool" : ""}`}
              type="button"
              aria-label="Open construction settings"
              aria-expanded={activeFullscreenDrawer === "constructionSettings"}
              aria-controls="construction-settings-drawer"
              title="Settings"
              onClick={() => toggleFullscreenDrawer("constructionSettings")}
            >
              <SlidersHorizontal aria-hidden="true" />
            </button>
            <button
              className="draw-glass-button draw-icon-button"
              type="button"
              aria-label="Undo"
              title="Undo"
              disabled={historyCounts.past === 0}
              onClick={handleUndo}
            >
              <Undo2 aria-hidden="true" />
            </button>
            <button
              className="draw-glass-button draw-icon-button"
              type="button"
              aria-label="Redo"
              title="Redo"
              disabled={historyCounts.future === 0}
              onClick={handleRedo}
            >
              <Redo2 aria-hidden="true" />
            </button>
            <button
              className={`draw-glass-button draw-icon-button ${activeFullscreenDrawer === "constructionMore" ? "active-tool" : ""}`}
              type="button"
              aria-label="Open construction save actions"
              aria-expanded={activeFullscreenDrawer === "constructionMore"}
              aria-controls="construction-more-drawer"
              title="More"
              onClick={() => toggleFullscreenDrawer("constructionMore")}
            >
              <Ellipsis aria-hidden="true" />
            </button>
            <button
              className="draw-gold-button draw-icon-button draw-save-next-button"
              type="button"
              aria-label="Save and next glyph"
              title="Save + next"
              onPointerUp={handleFullscreenSaveAndNext}
              onTouchEnd={handleFullscreenSaveAndNextTouch}
              onClick={handleSaveAndNextClick}
            >
              <SkipForward aria-hidden="true" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (isFullScreen && editorMode === "construction") {
    return renderConstructionFullscreen();
  }

  if (isFullScreen && editorMode === "draw") {
    return (
      <section className="studio-panel editor-panel fullscreen-editor fullscreen-draw-only" aria-label="Glyph editor">
        <GlyphCanvas
          strokes={draftGlyph.strokes}
          decorations={draftGlyph.decorations}
          backgroundAccentColor={activeFontTheme.accentColor}
          backgroundColor={activeFontTheme.backgroundColor}
          backgroundStyle={activeFontTheme.backgroundStyle}
          backgroundTexture={activeFontTheme.backgroundTexture}
          brushSize={brushSize}
          eyeExpression={eyeExpression}
          eraserMode={eraserMode}
          guideEditMode={activeFullscreenDrawer === "guides"}
          guideSettings={font.guideSettings}
          highlightColor={highlightColor}
          inkEffect={inkEffect}
          inkColor={inkColor}
          referenceGlyph={referenceGlyph}
          renderProfile={font.renderProfile}
          selectMode={selectMode}
          selectedDecorationId={selectedDecorationId}
          selectedStrokeId={selectedStrokeId}
          showGuides={showGuides}
          smoothingMode={smoothingMode}
          stickerDropRequest={stickerDropRequest}
          tool={tool}
          viewOffset={viewOffset}
          viewScale={viewScale}
          onEditStart={pushHistory}
          onChangeGuideSettings={onUpdateFontGuideSettings}
          onChangeViewOffset={setViewOffset}
          onChangeDecorations={updateDraftDecorations}
          onChangeStrokes={updateDraftStrokes}
          onSelectDecoration={setSelectedDecorationId}
          onSelectStroke={setSelectedStrokeId}
          onStickerDropHandled={(requestId) => {
            setStickerDropRequest((current) => (current?.id === requestId ? null : current));
          }}
        />

        <div className="draw-header-stack" aria-label="Drawing header">
          <div className="draw-only-topbar" aria-label="Drawing navigation">
            <button
              className="draw-glass-button draw-icon-button draw-top-icon"
              type="button"
              aria-label="Go home"
              title="Home"
              onClick={() => {
                setActiveFullscreenDrawer(null);
                onToggleFullScreen();
              }}
            >
              <Home aria-hidden="true" />
            </button>
            <button
              className="draw-glass-button draw-icon-button draw-top-icon"
              type="button"
              aria-label="Previous glyph"
              title="Previous"
              onClick={onPreviousCharacter}
            >
              <ChevronLeft aria-hidden="true" />
            </button>
            <div className="draw-character-pill">
              <strong>{characterLabel}</strong>
              <span>
                {activeVariationLabel} - {characterIndex + 1}/{characterTotal}
              </span>
            </div>
            {canUseBuildStyle && (
              <button
                className="draw-glass-button draw-top-construction-button"
                type="button"
                aria-label="Open letter construction mode"
                title="Construction"
                onClick={openConstructionMode}
              >
                Build
              </button>
            )}
            <button
              className="draw-glass-button draw-icon-button draw-top-icon"
              type="button"
              aria-label="Next glyph"
              title="Next"
              onClick={onNextCharacter}
            >
              <ChevronRight aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="draw-fullscreen-controls" ref={fullscreenControlsRef}>
          {savedMessage && (
            <div className="draw-save-status" aria-live="polite">
              {savedMessage}
            </div>
          )}

          {activeFullscreenDrawer === "ink" && (
            <div id="draw-ink-drawer" className="draw-control-drawer" aria-label="Ink drawer">
              <div className="draw-ink-preset-selector" aria-label="Ink quick slots">
                {inkPresetIds.map((presetId, index) => {
                  const preset = inkPresets[presetId];

                  return (
                    <button
                      key={presetId}
                      className={`draw-ink-preset-option ${activeInkPresetId === presetId ? "active-tool" : ""}`}
                      type="button"
                      onClick={() => applyInkPreset(presetId)}
                      aria-label={`Use ink slot ${index + 1}`}
                    >
                      <span className="draw-ink-preset-dot" style={{ backgroundColor: preset.inkColor }} />
                      <strong>{index + 1}</strong>
                      <span>{getInkToolLabel(preset.tool)}</span>
                    </button>
                  );
                })}
              </div>

              <div className="draw-drawer-grid three" aria-label="Ink tool">
                <button
                  className={`draw-drawer-button ${lastInkTool === "pen" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => chooseTool("pen")}
                >
                  <PenLine aria-hidden="true" />
                  <span>Pen</span>
                </button>
                <button
                  className={`draw-drawer-button ${lastInkTool === "quill" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => chooseTool("quill")}
                >
                  <Feather aria-hidden="true" />
                  <span>Quill</span>
                </button>
                <button
                  className={`draw-drawer-button ${lastInkTool === "line" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => chooseTool("line")}
                >
                  <Minus aria-hidden="true" />
                  <span>Line</span>
                </button>
              </div>

              <label className="draw-drawer-range">
                <span>Brush</span>
                <input
                  type="range"
                  min="3"
                  max="28"
                  value={brushSize}
                  onChange={(event) => updateBrushSize(Number(event.target.value))}
                />
                <output>{brushSize}px</output>
              </label>

              <div className="draw-ink-swatches" aria-label="Ink colors">
                {glyphInkSwatches.map((swatch) => (
                  <button
                    key={swatch.label}
                    className={`draw-ink-swatch ${inkColor === swatch.color ? "selected" : ""}`}
                    type="button"
                    onClick={() => updateInkColor(swatch.color)}
                    aria-label={`Use ${swatch.label} ink`}
                    title={swatch.label}
                  >
                    <span style={{ backgroundColor: swatch.color }} />
                  </button>
                ))}
              </div>

              <button
                className={`draw-drawer-button full ${inkEffect === "subtleSpread" ? "active-tool" : ""}`}
                type="button"
                onClick={toggleSpreadInk}
              >
                <Droplets aria-hidden="true" />
                <span>Ink spread</span>
              </button>

              <button
                className={`draw-drawer-button full ${inkEffect === "dramaticPooling" ? "active-tool" : ""}`}
                type="button"
                onClick={toggleDramaticInk}
              >
                <Droplets aria-hidden="true" />
                <span>Dramatic ink</span>
              </button>

              <button
                className={`draw-drawer-button full ${inkEffect === "bubbleHighlight" ? "active-tool" : ""}`}
                type="button"
                onClick={toggleBubbleInk}
              >
                <Sparkles aria-hidden="true" />
                <span>Bubble ink</span>
              </button>

              {inkEffect === "bubbleHighlight" && (
                <div className="draw-ink-highlight-row" aria-label="Bubble shine colors">
                  <span>Shine</span>
                  <div className="draw-ink-swatches">
                    {bubbleHighlightSwatches.map((swatch) => (
                      <button
                        key={swatch.label}
                        className={`draw-ink-swatch ${highlightColor === swatch.color ? "selected" : ""}`}
                        type="button"
                        onClick={() => updateHighlightColor(swatch.color)}
                        aria-label={`Use ${swatch.label}`}
                        title={swatch.label}
                      >
                        <span style={{ backgroundColor: swatch.color }} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="draw-drawer-grid three" aria-label="Stroke smoothing">
                {smoothingOptions.map((option) => (
                  <button
                    key={option.id}
                    className={`draw-drawer-button ${smoothingMode === option.id ? "active-tool" : ""}`}
                    type="button"
                    onClick={() => updateSmoothingMode(option.id)}
                  >
                    <SlidersHorizontal aria-hidden="true" />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFullscreenDrawer === "background" && (
            <div id="draw-background-drawer" className="draw-control-drawer" aria-label="Background drawer">
              <div className="draw-background-presets" aria-label="Canvas backgrounds">
                {editorBackgroundPresets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`draw-background-preset ${activeFontTheme.backgroundStyle === preset.id ? "selected" : ""}`}
                    type="button"
                    onClick={() => handleSelectBackgroundPreset(preset)}
                    aria-label={`Use ${preset.label} background`}
                    title={preset.label}
                  >
                    <span style={{ background: preset.preview }} />
                  </button>
                ))}
              </div>
              <div className="draw-background-textures" aria-label="Background textures">
                {editorTexturePresets.map((preset) => (
                  <button
                    key={preset.id}
                    className={`draw-texture-preset ${activeFontTheme.backgroundTexture === preset.id ? "selected" : ""}`}
                    type="button"
                    onClick={() => handleSelectBackgroundTexture(preset.id)}
                    aria-label={`Use ${preset.label} texture`}
                    title={preset.label}
                  >
                    <span style={{ background: preset.preview }} />
                    <strong>{preset.label}</strong>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeFullscreenDrawer === "more" && (
            <div id="draw-more-drawer" className="draw-control-drawer" aria-label="More drawing controls">
              {renderVariationControls("glyph-variation-strip draw-variation-strip")}

              <div className="draw-drawer-grid three" aria-label="Save actions">
                <button
                  className="draw-drawer-button"
                  type="button"
                  onClick={() => {
                    handleSave();
                    setActiveFullscreenDrawer(null);
                  }}
                >
                  <Save aria-hidden="true" />
                  <span>Save {activeVariation === "base" ? "base" : "var"}</span>
                </button>
                <button
                  className="draw-drawer-button"
                  type="button"
                  onClick={() => {
                    handleSaveVariant();
                    setActiveFullscreenDrawer(null);
                  }}
                >
                  <Save aria-hidden="true" />
                  <span>Save as var</span>
                </button>
                <button
                  className="draw-drawer-button accent"
                  type="button"
                  onPointerUp={handleFullscreenSaveAndNext}
                  onTouchEnd={handleFullscreenSaveAndNextTouch}
                  onClick={handleSaveAndNextClick}
                >
                  <SkipForward aria-hidden="true" />
                  <span>Save + next</span>
                </button>
              </div>

              <div className="draw-drawer-grid four" aria-label="Canvas view">
                <button className="draw-drawer-button" type="button" onClick={() => handleZoom(-0.15)}>
                  <ZoomOut aria-hidden="true" />
                  <span>Zoom</span>
                </button>
                <button className="draw-drawer-button" type="button" onClick={handleResetView}>
                  <RotateCcw aria-hidden="true" />
                  <span>{Math.round(viewScale * 100)}%</span>
                </button>
                <button className="draw-drawer-button" type="button" onClick={() => handleZoom(0.15)}>
                  <ZoomIn aria-hidden="true" />
                  <span>Zoom</span>
                </button>
                <button
                  className={`draw-drawer-button ${showGuides ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => setShowGuides((current) => !current)}
                >
                  <Eye aria-hidden="true" />
                  <span>Guides</span>
                </button>
              </div>

              <button
                className="draw-drawer-button full"
                type="button"
                onClick={() => {
                  setShowGuides(true);
                  setActiveFullscreenDrawer("guides");
                }}
              >
                <SlidersHorizontal aria-hidden="true" />
                <span>Guide settings</span>
              </button>

              <div className="draw-drawer-grid two" aria-label="Eraser mode">
                <button
                  className={`draw-drawer-button ${eraserMode === "stroke" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => setEraserMode("stroke")}
                >
                  <Eraser aria-hidden="true" />
                  <span>Stroke</span>
                </button>
                <button
                  className={`draw-drawer-button ${eraserMode === "point" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => setEraserMode("point")}
                >
                  <Eraser aria-hidden="true" />
                  <span>Point</span>
                </button>
              </div>

              <div className="draw-drawer-grid two" aria-label="Select options">
                <button
                  className={`draw-drawer-button ${selectMode === "moveStroke" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectMode("moveStroke");
                    chooseTool("select");
                  }}
                >
                  <Hand aria-hidden="true" />
                  <span>Move stroke</span>
                </button>
                <button
                  className={`draw-drawer-button ${selectMode === "editPoint" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectMode("editPoint");
                    chooseTool("select");
                  }}
                >
                  <MousePointer2 aria-hidden="true" />
                  <span>Point edit</span>
                </button>
                <button
                  className={`draw-drawer-button ${selectMode === "smoothCircle" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectMode("smoothCircle");
                    chooseTool("select");
                  }}
                >
                  <Circle aria-hidden="true" />
                  <span>Smooth circle</span>
                </button>
                <button
                  className="draw-drawer-button"
                  type="button"
                  disabled={!selectedStrokeId}
                  onClick={handleSmoothSelectedStroke}
                >
                  <SlidersHorizontal aria-hidden="true" />
                  <span>Smooth stroke</span>
                </button>
                <button
                  className={`draw-drawer-button ${selectMode === "spreadCircle" ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectMode("spreadCircle");
                    chooseTool("select");
                  }}
                >
                  <Droplets aria-hidden="true" />
                  <span>Spread circle</span>
                </button>
                <button
                  className="draw-drawer-button"
                  type="button"
                  disabled={!selectedStrokeId}
                  onClick={handleSpreadSelectedStroke}
                >
                  <Droplets aria-hidden="true" />
                  <span>Spread stroke</span>
                </button>
              </div>

              <button className="draw-drawer-button full" type="button" onClick={enterStickerMode}>
                <Sticker aria-hidden="true" />
                <span>Sticker mode</span>
              </button>

              {selectedStrokeId && (
                <button className="draw-drawer-button danger-action full" type="button" onClick={handleDeleteSelectedStroke}>
                  <X aria-hidden="true" />
                  <span>Delete stroke</span>
                </button>
              )}
            </div>
          )}

          {activeFullscreenDrawer === "guides" && (
            <div id="draw-guides-drawer" className="draw-control-drawer draw-guide-drawer" aria-label="Guide settings drawer">
              <div className="draw-guide-settings">
                {fontGuideRows.map((guide) => (
                  <label key={guide.key} className="draw-drawer-range draw-guide-range">
                    <span>{guide.label}</span>
                    <input
                      type="range"
                      min="0.02"
                      max="0.98"
                      step="0.01"
                      value={font.guideSettings[guide.key]}
                      onChange={(event) => handleGuideSettingChange(guide.key, Number(event.target.value))}
                    />
                    <output>{Math.round(font.guideSettings[guide.key] * 100)}%</output>
                  </label>
                ))}
              </div>
              <div className="draw-drawer-grid two" aria-label="Guide actions">
                <button
                  className={`draw-drawer-button ${showGuides ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => setShowGuides((current) => !current)}
                >
                  <Eye aria-hidden="true" />
                  <span>Guides</span>
                </button>
                <button
                  className="draw-drawer-button"
                  type="button"
                  onClick={() => onUpdateFontGuideSettings({ ...defaultFontGuideSettings })}
                >
                  <RotateCcw aria-hidden="true" />
                  <span>Reset guides</span>
                </button>
              </div>
            </div>
          )}

          {stickerMode && (
            <div id="draw-stickers-drawer" className="draw-sticker-popouts" aria-label="Stickers drawer">
              <div className="draw-sticker-category-popout" aria-label="Sticker categories">
                {stickerEyesOpen && (
                  <div className="draw-control-drawer">
                  <EyeExpressionControl
                    draggableOptions
                    expression={eyeExpression}
                    onExpressionChange={setEyeExpression}
                    onOptionPointerDown={handleEyeStickerDragStart}
                    showLabels={false}
                  />
                  </div>
                )}
              </div>

              <div className="draw-sticker-edit-column">
                {stickerEditOpen && (
                  <div id="draw-sticker-edit-popout" className="draw-control-drawer draw-sticker-edit-popout" aria-label="Sticker edit actions">
                    <button
                      className={`draw-drawer-button ${tool === "eyes" ? "active-tool" : ""}`}
                      type="button"
                      onClick={() => chooseTool("eyes")}
                    >
                      <Hand aria-hidden="true" />
                      <span>Move</span>
                    </button>
                    <button
                      className="draw-drawer-button danger-action"
                      type="button"
                      disabled={!selectedSticker}
                      onClick={handleDeleteSelectedSticker}
                    >
                      <X aria-hidden="true" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {!stickerMode ? (
          <div className="draw-only-toolbar" aria-label="Drawing dock">
            <button
              className={`draw-glass-button draw-icon-button ${tool === lastInkTool ? "active-tool" : ""}`}
              type="button"
              aria-label={`Use ${getInkToolLabel(lastInkTool).toLowerCase()}`}
              title={getInkToolLabel(lastInkTool)}
              onClick={() => chooseDockTool(lastInkTool)}
            >
              {lastInkTool === "quill" ? (
                <Feather aria-hidden="true" />
              ) : lastInkTool === "line" ? (
                <Minus aria-hidden="true" />
              ) : (
                <PenLine aria-hidden="true" />
              )}
            </button>
            <button
              className={`draw-glass-button draw-icon-button ${tool === "eraser" ? "active-tool" : ""}`}
              type="button"
              aria-label="Use eraser"
              title="Eraser"
              onClick={() => chooseDockTool("eraser")}
            >
              <Eraser aria-hidden="true" />
            </button>
            <button
              className={`draw-glass-button draw-icon-button ${tool === "select" ? "active-tool" : ""}`}
              type="button"
              aria-label="Use select"
              title="Select"
              onClick={() => chooseDockTool("select")}
            >
              <MousePointer2 aria-hidden="true" />
            </button>
            <button
              className={`draw-glass-button draw-icon-button ${tool === "pan" ? "active-tool" : ""}`}
              type="button"
              aria-label="Use pan"
              title="Pan"
              onClick={() => chooseDockTool("pan")}
            >
              <Hand aria-hidden="true" />
            </button>
            <div className="draw-ink-preset-group" aria-label="Ink quick slots">
              {inkPresetIds.map((presetId, index) => {
                const preset = inkPresets[presetId];
                const isActivePreset = presetId === activeInkPresetId;

                return (
                  <button
                    key={presetId}
                    className={`draw-glass-button draw-icon-button draw-ink-color-button ${
                      isActivePreset ? "selected-preset" : ""
                    } ${isActivePreset && activeFullscreenDrawer === "ink" ? "active-tool" : ""}`}
                    type="button"
                    aria-label={`${isActivePreset ? "Open" : "Use"} ink slot ${index + 1}, ${getInkToolLabel(preset.tool).toLowerCase()}`}
                    aria-expanded={isActivePreset ? activeFullscreenDrawer === "ink" : undefined}
                    aria-controls="draw-ink-drawer"
                    title={`Ink ${index + 1}: ${getInkToolLabel(preset.tool)}`}
                    style={{ backgroundColor: preset.inkColor, color: getReadableInkButtonColor(preset.inkColor) }}
                    onClick={() => handleInkPresetButton(presetId)}
                  >
                    <span>{index + 1}</span>
                  </button>
                );
              })}
            </div>
            <button
              className={`draw-glass-button draw-icon-button ${activeFullscreenDrawer === "background" ? "active-tool" : ""}`}
              type="button"
              aria-label="Open background settings"
              aria-expanded={activeFullscreenDrawer === "background"}
              aria-controls="draw-background-drawer"
              title="Background"
              onClick={() => toggleFullscreenDrawer("background")}
            >
              <Palette aria-hidden="true" />
            </button>
            <button
              className="draw-glass-button draw-icon-button"
              type="button"
              aria-label="Undo"
              title="Undo"
              disabled={historyCounts.past === 0}
              onClick={handleUndo}
            >
              <Undo2 aria-hidden="true" />
            </button>
            <button
              className="draw-glass-button draw-icon-button"
              type="button"
              aria-label="Redo"
              title="Redo"
              disabled={historyCounts.future === 0}
              onClick={handleRedo}
            >
              <Redo2 aria-hidden="true" />
            </button>
            <button
              className={`draw-glass-button draw-icon-button draw-more-button ${
                activeFullscreenDrawer === "more" ? "active-tool" : ""
              }`}
              type="button"
              aria-label="Open more drawing controls"
              aria-expanded={activeFullscreenDrawer === "more"}
              aria-controls="draw-more-drawer"
              title="More"
              onClick={() => toggleFullscreenDrawer("more")}
            >
              <Ellipsis aria-hidden="true" />
            </button>
            <button
              className="draw-gold-button draw-icon-button draw-save-next-button"
              type="button"
              aria-label="Save and next glyph"
              title="Save + next"
              onPointerUp={handleFullscreenSaveAndNext}
              onTouchEnd={handleFullscreenSaveAndNextTouch}
              onClick={handleSaveAndNextClick}
            >
              <SkipForward aria-hidden="true" />
            </button>
          </div>
          ) : (
          <div className="draw-only-toolbar draw-sticker-mode-toolbar" aria-label="Sticker mode dock">
            <button
              className={`draw-glass-button draw-icon-button ${stickerEyesOpen ? "active-tool" : ""}`}
              type="button"
              aria-label="Open eyes stickers"
              aria-expanded={stickerEyesOpen}
              aria-controls="draw-stickers-drawer"
              title="Eyes"
              onClick={() => {
                setStickerEyesOpen((current) => !current);
                setStickerEditOpen(false);
              }}
            >
              <Eye aria-hidden="true" />
            </button>
            <button
              className={`draw-glass-button draw-icon-button ${stickerEditOpen ? "active-tool" : ""}`}
              type="button"
              aria-label="Edit sticker"
              aria-expanded={stickerEditOpen}
              aria-controls="draw-sticker-edit-popout"
              title="Edit sticker"
              onClick={() => {
                setStickerEditOpen((current) => !current);
                setStickerEyesOpen(false);
              }}
            >
              <Sticker aria-hidden="true" />
              <span>Edit</span>
            </button>
            <button
              className="draw-glass-button draw-icon-button"
              type="button"
              aria-label="Exit sticker mode"
              title="Done"
              onClick={exitStickerMode}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          )}

          {draggingEyeSticker && (
            <div
              className="sticker-drag-ghost"
              style={{
                left: draggingEyeSticker.x,
                top: draggingEyeSticker.y,
              }}
            >
              <EyeExpressionPreview expression={draggingEyeSticker.expression} />
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`studio-panel editor-panel ${isFullScreen ? "fullscreen-editor" : ""} ${
        editorMode === "construction" ? "construction-mode-editor" : ""
      }`}
      aria-label="Glyph editor"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Glyph editor</p>
          <h2>{characterLabel}</h2>
        </div>
        <div className="editor-heading-actions">
          <div className="glyph-pill">
            {draftGlyph.strokes.length} strokes / {draftGlyph.construction?.paths.length ?? 0} paths
          </div>
          {canUseBuildStyle && (
            <button
              className={`secondary-button compact-button ${editorMode === "construction" ? "active-tool" : ""}`}
              type="button"
              onClick={openConstructionMode}
            >
              Construction
            </button>
          )}
          <button className="secondary-button compact-button" type="button" onClick={onToggleFullScreen}>
            {isFullScreen ? "Exit" : "Full screen"}
          </button>
        </div>
      </div>

      <div className="glyph-nav" aria-label="Glyph navigation">
        <button className="secondary-button" type="button" onClick={onPreviousCharacter}>
          Previous
        </button>
        <div className="glyph-progress">
          <strong>{characterLabel}</strong>
          <span>
            {activeVariationLabel} - {characterIndex + 1} / {characterTotal}
          </span>
        </div>
        <button className="secondary-button" type="button" onClick={onNextCharacter}>
          Next
        </button>
      </div>

      {renderVariationControls()}

      {canUseDrawStyle && canUseBuildStyle && (
        <div className="editor-mode-switch" role="group" aria-label="Editor mode">
          <button
            className={`secondary-button ${editorMode === "draw" ? "active-tool" : ""}`}
            type="button"
            onClick={() => setEditorMode("draw")}
          >
            Draw
          </button>
          <button
            className={`secondary-button ${editorMode === "construction" ? "active-tool" : ""}`}
            type="button"
            onClick={() => setEditorMode("construction")}
          >
            Build
          </button>
        </div>
      )}

      {editorMode === "construction" ? (
        renderConstructionMode()
      ) : (
        <>
      <GlyphCanvas
        strokes={draftGlyph.strokes}
        decorations={draftGlyph.decorations}
        backgroundAccentColor={activeFontTheme.accentColor}
        backgroundColor={activeFontTheme.backgroundColor}
        backgroundStyle={activeFontTheme.backgroundStyle}
        backgroundTexture={activeFontTheme.backgroundTexture}
        brushSize={brushSize}
        eyeExpression={eyeExpression}
        eraserMode={eraserMode}
        guideSettings={font.guideSettings}
        highlightColor={highlightColor}
        inkEffect={inkEffect}
        inkColor={inkColor}
        referenceGlyph={referenceGlyph}
        renderProfile={font.renderProfile}
        selectMode={selectMode}
        selectedDecorationId={selectedDecorationId}
        selectedStrokeId={selectedStrokeId}
        showGuides={showGuides}
        smoothingMode={smoothingMode}
        stickerDropRequest={stickerDropRequest}
        tool={tool}
        viewOffset={viewOffset}
        viewScale={viewScale}
        onEditStart={pushHistory}
        onChangeGuideSettings={onUpdateFontGuideSettings}
        onChangeViewOffset={setViewOffset}
        onChangeDecorations={updateDraftDecorations}
        onChangeStrokes={updateDraftStrokes}
        onSelectDecoration={setSelectedDecorationId}
        onSelectStroke={setSelectedStrokeId}
        onStickerDropHandled={(requestId) => {
          setStickerDropRequest((current) => (current?.id === requestId ? null : current));
        }}
      />

      <EditorLivePreview
        font={font}
        draftGlyph={draftGlyph}
        previewText={previewText}
        onPreviewTextChange={onPreviewTextChange}
      />
        </>
      )}

      <div className="quick-save-row" aria-label="Primary glyph actions">
        <button className="secondary-button" type="button" onClick={handleSave}>
          Save {activeVariation === "base" ? "base" : "variation"}
        </button>
        <button className="secondary-button" type="button" onClick={handleSaveVariant}>
          Save as new variation
        </button>
        <button className="primary-button" type="button" onClick={handleSaveAndNext}>
          Save and next
        </button>
      </div>

      {editorMode === "draw" && (
      <div className="editor-controls">
        <div className="tool-row" aria-label="Drawing tools">
          <button
            className={`secondary-button ${tool === "pen" ? "active-tool" : ""}`}
            type="button"
            onClick={() => chooseTool("pen")}
          >
            Pen
          </button>
          <button
            className={`secondary-button ${tool === "quill" ? "active-tool" : ""}`}
            type="button"
            onClick={() => chooseTool("quill")}
          >
            Quill
          </button>
          <button
            className={`secondary-button ${tool === "line" ? "active-tool" : ""}`}
            type="button"
            onClick={() => chooseTool("line")}
          >
            Line
          </button>
          <button
            className={`secondary-button ${tool === "eyes" || stickerEyesOpen ? "active-tool" : ""}`}
            type="button"
            aria-expanded={stickerEyesOpen}
            onClick={() => {
              chooseTool("eyes");
              setStickerEyesOpen((current) => !current);
            }}
          >
            Eyes
          </button>
          <button
            className={`secondary-button ${tool === "eraser" ? "active-tool" : ""}`}
            type="button"
            onClick={() => chooseTool("eraser")}
          >
            Eraser
          </button>
          <button
            className={`secondary-button ${tool === "select" ? "active-tool" : ""}`}
            type="button"
            onClick={() => chooseTool("select")}
          >
            Select
          </button>
          <button
            className={`secondary-button ${tool === "pan" ? "active-tool" : ""}`}
            type="button"
            onClick={() => chooseTool("pan")}
          >
            Pan
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={historyCounts.past === 0}
            onClick={handleUndo}
          >
            Undo
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={historyCounts.future === 0}
            onClick={handleRedo}
          >
            Redo
          </button>
        </div>

        {stickerEyesOpen && (
          <EyeExpressionControl
            draggableOptions
            expression={eyeExpression}
            onExpressionChange={setEyeExpression}
            onOptionPointerDown={handleEyeStickerDragStart}
            showLabels={false}
          />
        )}

        {tool === "eraser" && (
          <div className="engine-option-row" aria-label="Eraser mode">
            <button
              className={`secondary-button ${eraserMode === "stroke" ? "active-tool" : ""}`}
              type="button"
              onClick={() => setEraserMode("stroke")}
            >
              Stroke
            </button>
            <button
              className={`secondary-button ${eraserMode === "point" ? "active-tool" : ""}`}
              type="button"
              onClick={() => setEraserMode("point")}
            >
              Point
            </button>
          </div>
        )}

        <div className="engine-option-row" aria-label="Stroke smoothing">
          {smoothingOptions.map((option) => (
            <button
              key={option.id}
              className={`secondary-button ${smoothingMode === option.id ? "active-tool" : ""}`}
              type="button"
              onClick={() => updateSmoothingMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="engine-option-row ink-effect-row" aria-label="Ink effect">
          <button
            className={`secondary-button ${inkEffect === "subtleSpread" ? "active-tool" : ""}`}
            type="button"
            onClick={toggleSpreadInk}
          >
            Ink spread
          </button>
          <button
            className={`secondary-button ${inkEffect === "dramaticPooling" ? "active-tool" : ""}`}
            type="button"
            onClick={toggleDramaticInk}
          >
            Dramatic ink
          </button>
          <button
            className={`secondary-button ${inkEffect === "bubbleHighlight" ? "active-tool" : ""}`}
            type="button"
            onClick={toggleBubbleInk}
          >
            Bubble ink
          </button>
        </div>

        {inkEffect === "bubbleHighlight" && (
          <div className="draw-ink-highlight-row editor-highlight-row" aria-label="Bubble shine colors">
            <span>Shine</span>
            <div className="draw-ink-swatches">
              {bubbleHighlightSwatches.map((swatch) => (
                <button
                  key={swatch.label}
                  className={`draw-ink-swatch ${highlightColor === swatch.color ? "selected" : ""}`}
                  type="button"
                  onClick={() => updateHighlightColor(swatch.color)}
                  aria-label={`Use ${swatch.label}`}
                  title={swatch.label}
                >
                  <span style={{ backgroundColor: swatch.color }} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="engine-option-row canvas-view-row" aria-label="Canvas view">
          <button className="secondary-button" type="button" onClick={() => handleZoom(-0.15)}>
            Zoom -
          </button>
          <button className="secondary-button" type="button" onClick={handleResetView}>
            {Math.round(viewScale * 100)}%
          </button>
          <button className="secondary-button" type="button" onClick={() => handleZoom(0.15)}>
            Zoom +
          </button>
          <button
            className={`secondary-button ${showGuides ? "active-tool" : ""}`}
            type="button"
            onClick={() => setShowGuides((current) => !current)}
          >
            Guides
          </button>
        </div>

        {renderReferenceGlyphControl()}

        {selectedStrokeId && (
          <button className="danger-button" type="button" onClick={handleDeleteSelectedStroke}>
            Delete stroke
          </button>
        )}

        <label className="range-control">
          <span>Brush</span>
          <input
            type="range"
            min="3"
            max="28"
            value={brushSize}
            onChange={(event) => updateBrushSize(Number(event.target.value))}
          />
          <output>{brushSize}px</output>
          <button
            className="metric-default-button"
            type="button"
            disabled={brushSize === DEFAULT_BRUSH_SIZE}
            onClick={() => updateBrushSize(DEFAULT_BRUSH_SIZE)}
          >
            Default
          </button>
        </label>

        <InkColorControl inkColor={inkColor} onInkColorChange={updateInkColor} />

        <div className="center-row" aria-label="Center glyph">
          <button className="secondary-button" type="button" onClick={() => handleCenter("x")}>
            Center X
          </button>
          <button className="secondary-button" type="button" onClick={() => handleCenter("y")}>
            Center Y
          </button>
          <button className="secondary-button" type="button" onClick={() => handleCenter("both")}>
            Center both
          </button>
        </div>

        <div className="nudge-row nudge-pad" aria-label="Nudge glyph">
          <button className="secondary-button nudge-up" type="button" onClick={() => handleNudge(0, -0.025, "up")}>
            Nudge up
          </button>
          <button className="secondary-button nudge-left" type="button" onClick={() => handleNudge(-0.025, 0, "left")}>
            Nudge left
          </button>
          <button className="secondary-button nudge-right" type="button" onClick={() => handleNudge(0.025, 0, "right")}>
            Nudge right
          </button>
          <button className="secondary-button nudge-down" type="button" onClick={() => handleNudge(0, 0.025, "down")}>
            Nudge down
          </button>
        </div>

        <SpacingControls glyph={draftGlyph} onChange={handleMetricChange} />

        <div className="button-row">
          <button className="secondary-button" type="button" onClick={handleClear}>
            Clear
          </button>
          <button className="primary-button" type="button" onClick={handleSave}>
            Save glyph
          </button>
        </div>

      </div>
      )}

      <div className="save-status" aria-live="polite">
        {savedMessage}
      </div>

      {draggingEyeSticker && (
        <div
          className="sticker-drag-ghost"
          style={{
            left: draggingEyeSticker.x,
            top: draggingEyeSticker.y,
          }}
        >
          <EyeExpressionPreview expression={draggingEyeSticker.expression} />
        </div>
      )}
    </section>
  );
}
