import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Brush,
  Droplets,
  Feather,
  Hand,
  Image as ImageIcon,
  Minus,
  Moon,
  MousePointer2,
  PenLine,
  Pipette,
  Plus,
  Sparkles,
  Sticker,
  SlidersHorizontal,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import {
  canUseHeaderLetter,
  getCharacterLabel,
  getHeaderLetter,
  getHeaderSourceCharacter,
  isHeaderLetter,
  spacebar,
} from "../data/characterSets";
import type {
  BackgroundStyle,
  BackgroundTexture,
  FontGuideSettings,
  FontSet,
  FontShapeSettings,
  Glyph,
  GlyphDecoration,
  GlyphInkEffect,
  GlyphStroke,
  PreviewSettings,
} from "../types/fontTypes";
import {
  drawGlyph,
  drawGlyphDecoration,
  drawStrokePath,
  findPreviewGlyph,
  getFontHeightScale,
  getFontWidthScale,
  getGlyphAdvance,
  getGlyphLeftBearingOffset,
  getGlyphRenderScales,
  getGlyphTopForBaseline,
  getSpacebarAdvance,
  hasDrawnGlyph,
  selectPreviewGlyph,
} from "../render/glyphRenderer";
import { isNativeFilePlatform, saveNativeFileToDocuments, shareNativeFile } from "../utils/nativeFiles";

type SavedPreviewImage = {
  fontName: string;
  height: number;
  imageDataUrl: string;
  message: string;
  width: number;
};

type TextPreviewProps = {
  font: FontSet;
  fonts: FontSet[];
  onRecordExport?: (message: string) => void;
  onSaveImage?: (image: SavedPreviewImage) => boolean;
  onSelectCharacter: (character: string) => void;
  headerPreviewText: string;
  onHeaderPreviewTextChange: (text: string) => void;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
  selectedGlyph: Glyph;
  spacebarGlyph: Glyph;
};

type ExportPresetId = "phone" | "social" | "transparent";
type FontMetricKey = "baselineOffset" | "leftBearing" | "rightBearing" | "width" | "xAdvance";
type FontGlyphMetricKey = Exclude<FontMetricKey, "width">;
type LetterMetricKey = "baselineOffset" | "height" | "leftBearing" | "rightBearing" | "width" | "xAdvance";
type LetterMetricOverrides = Partial<Pick<Glyph, LetterMetricKey>>;
type ImageMetricKey = "canvasHeight" | "canvasWidth" | "letterSpacing" | "lineSpacing" | "pagePadding";
type ManuscriptMetricKey = "manuscriptAge" | "manuscriptEdges" | "manuscriptFibers" | "manuscriptInkSoak" | "manuscriptRuling" | "manuscriptStains";
type SettingsPanel = "font" | "headerLetter" | "image" | "letter" | "position";
type StyleDrawer = "doodle" | "page" | "select" | "stickers" | "text" | null;
type StyleDoodleSmoothing = "gentle" | "raw" | "strong";
type StyleDoodleTool = "line" | "pen" | "quill";
type StyleSelectTarget = "doodles" | "stickers" | "text";
type TextAlignment = "left" | "center" | "right";
type EyeExpression = NonNullable<GlyphDecoration["expression"]>;

const settingsPanelLabels: Record<SettingsPanel, string> = {
  font: "Font settings",
  headerLetter: "Header Letter settings",
  image: "Image settings",
  letter: "Letter settings",
  position: "Position settings",
};

type PreviewImageSettings = PreviewSettings & {
  accentColor: string;
  alignment: TextAlignment;
  autoFit: boolean;
  backgroundStyle: BackgroundStyle;
  backgroundTexture: BackgroundTexture;
  canvasHeight: number;
  canvasWidth: number;
  exportPreset: ExportPresetId;
  manuscriptAge: number;
  manuscriptEdges: number;
  manuscriptFibers: number;
  manuscriptInkSoak: number;
  manuscriptRuling: number;
  manuscriptStains: number;
  transparent: boolean;
};

type PhoneImageLayout = {
  bodyEndY: number;
  bodyStartY: number;
  headerFontSize: number;
  headerLines: string[];
  lines: string[];
  settings: PreviewImageSettings;
};

type PreviewGlyphHitTarget = {
  character: string;
  editableCharacter: string;
  height: number;
  width: number;
  x: number;
  y: number;
};

type PreviewDoodlePoint = {
  ink?: number;
  pressure?: number;
  spread?: number;
  x: number;
  y: number;
};

type PreviewDoodleStroke = {
  color: string;
  id: string;
  inkEffect: GlyphInkEffect;
  points: PreviewDoodlePoint[];
  size: number;
  tool: StyleDoodleTool;
};

type PreviewSticker = {
  expression: EyeExpression;
  faceMood?: number;
  id: string;
  lookAt?: PreviewDoodlePoint;
  redness?: number;
  sleepiness?: number;
  size: number;
  x: number;
  y: number;
};

type StyleStickerDrag = {
  expression: EyeExpression;
  isDragging: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

type StyleStickerDragPreview = {
  expression: EyeExpression;
  x: number;
  y: number;
};

type PreviewTextLayer = {
  fontId: string;
  id: string;
  sizeScale: number;
  text: string;
};

type PreviewTextLayerHitTarget = {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
};

type PreviewDocument = {
  headerText?: string;
  id: string;
  name: string;
  settings: PreviewImageSettings;
  text: string;
  textLayers?: PreviewTextLayer[];
  updatedAt: string;
};

const PREVIEW_DOCUMENTS_KEY = "local-font-studio:preview-documents:v1";
const MIN_IMAGE_CANVAS_WIDTH = 640;
const MAX_IMAGE_CANVAS_WIDTH = 3300;
const MIN_IMAGE_CANVAS_HEIGHT = 480;
const MAX_IMAGE_CANVAS_HEIGHT = 3600;
const HEADER_FONT_SIZE_MULTIPLIER = 3;
const STYLE_CANVAS_MAX_PIXELS = 850_000;
const MANUSCRIPT_PARCHMENT_SRC = "/assets/parchment-clean-vellum.png";

const exportPresets: Array<{
  id: ExportPresetId;
  label: string;
  settings: Partial<PreviewImageSettings>;
}> = [
  {
    id: "phone",
    label: "Phone",
    settings: {
      canvasWidth: 1080,
      canvasHeight: 1920,
      exportPreset: "phone",
      fontSize: 118,
      pagePadding: 92,
      transparent: false,
    },
  },
  {
    id: "social",
    label: "Social",
    settings: {
      canvasWidth: 1080,
      canvasHeight: 1080,
      exportPreset: "social",
      fontSize: 96,
      pagePadding: 86,
      transparent: false,
    },
  },
  {
    id: "transparent",
    label: "Transparent",
    settings: {
      canvasWidth: 1600,
      canvasHeight: 900,
      exportPreset: "transparent",
      fontSize: 112,
      pagePadding: 80,
      transparent: true,
    },
  },
];

const defaultPhoneImageSettings: PreviewImageSettings = {
  accentColor: "#d3bf97",
  alignment: "left",
  autoFit: true,
  backgroundColor: "#f4ead7",
  backgroundStyle: "paper",
  backgroundTexture: "grain",
  canvasHeight: 1920,
  canvasWidth: 1080,
  exportPreset: "phone",
  fontSize: 118,
  inkColor: "#17110b",
  letterSpacing: 0,
  lineSpacing: 1.18,
  manuscriptAge: 0.18,
  manuscriptEdges: 0.38,
  manuscriptFibers: 0.34,
  manuscriptInkSoak: 0.42,
  manuscriptRuling: 0,
  manuscriptStains: 0.16,
  pagePadding: 92,
  transparent: false,
};

const previewPresets = [
  {
    id: "pangram",
    label: "Pangram",
    text: "The quick brown fox jumps over 13 lazy dogs.\nSphinx of black quartz, judge my vow.",
  },
  {
    id: "journal",
    label: "Journal",
    text: "Tuesday, 7:45 p.m.\nI walked home under a blue evening sky and wrote down the small things before they vanished.",
  },
  {
    id: "labels",
    label: "Labels",
    text: "Basil\nCinnamon\nStudio keys\nSeed packets\nJune receipts",
  },
  {
    id: "address",
    label: "Address",
    text: "Mara Vale\n1048 North Cedar Lane\nPortland, OR 97205",
  },
  {
    id: "notes",
    label: "Notes",
    text: "Call Theo about proofs.\nBuy black ink.\nCheck spacing: lift, moon, AV, To.",
  },
  {
    id: "dialogue",
    label: "Dialogue",
    text: "\"Are you coming?\"\n\"After I finish this letter.\"\n\"Make it legible this time.\"",
  },
  {
    id: "alphabet",
    label: "Alphabet",
    text: "ABCDEFGHIJKLMNOPQRSTUVWXYZ\nabcdefghijklmnopqrstuvwxyz\n0123456789\n.,?!:;'\"-()",
  },
];

const inkSwatches = [
  { color: "#19140f", label: "Lamp Black" },
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

const texturePresets: Array<{
  id: BackgroundTexture;
  label: string;
  preview: string;
}> = [
  { id: "clean", label: "Clean", preview: "#f4ead7" },
  {
    id: "grain",
    label: "Grain",
    preview:
      "radial-gradient(circle at 30% 35%, rgba(80, 54, 30, 0.54) 0 2px, transparent 3px), radial-gradient(circle at 70% 62%, rgba(255, 247, 230, 0.34) 0 1px, transparent 2px), #f4ead7",
  },
  {
    id: "fiber",
    label: "Fibers",
    preview:
      "repeating-linear-gradient(8deg, rgba(80, 54, 30, 0.38) 0 2px, transparent 2px 10px), repeating-linear-gradient(-5deg, rgba(255, 247, 230, 0.22) 0 1px, transparent 1px 15px), #f1e4c8",
  },
  {
    id: "canvas",
    label: "Canvas",
    preview:
      "repeating-linear-gradient(0deg, rgba(80, 54, 30, 0.34) 0 2px, rgba(255, 247, 230, 0.16) 2px 3px, transparent 3px 9px), repeating-linear-gradient(90deg, rgba(80, 54, 30, 0.3) 0 2px, rgba(255, 247, 230, 0.14) 2px 3px, transparent 3px 10px), #efe2c4",
  },
  {
    id: "woven",
    label: "Woven",
    preview:
      "repeating-linear-gradient(0deg, rgba(84, 55, 31, 0.32) 0 3px, rgba(255, 248, 229, 0.12) 3px 6px, transparent 6px 14px), repeating-linear-gradient(90deg, rgba(84, 55, 31, 0.28) 0 3px, transparent 3px 13px), #efe0bd",
  },
];

const previewStickerExpression: EyeExpression = "googly";
const styleDoodleSmoothingOptions: Array<{ id: StyleDoodleSmoothing; label: string }> = [
  { id: "raw", label: "Raw" },
  { id: "gentle", label: "Gentle" },
  { id: "strong", label: "Strong" },
];

function PreviewEyeStickerPreview({ expression }: { expression: EyeExpression }) {
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
        id: `preview_eye_option_${expression}`,
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

const backgroundPresets: Array<{
  accentColor: string;
  backgroundColor: string;
  id: BackgroundStyle;
  inkColor: string;
  label: string;
  preview: string;
}> = [
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
    id: "manuscript",
    label: "Manuscript",
    backgroundColor: "#efe0bd",
    inkColor: "#2a160d",
    accentColor: "#9b6f3b",
    preview: "linear-gradient(135deg, #f8edcb, #ecd59b 58%, #9b6f3b)",
  },
  {
    id: "midnight",
    label: "Midnight",
    backgroundColor: "#111827",
    inkColor: "#f7efe0",
    accentColor: "#375a66",
    preview: "linear-gradient(135deg, #111827, #1d2d35)",
  },
  {
    id: "rage",
    label: "Rage",
    backgroundColor: "#1a0507",
    inkColor: "#ff3b30",
    accentColor: "#ffb000",
    preview: "linear-gradient(135deg, #1a0507, #621014 55%, #ffb000)",
  },
  {
    id: "blush",
    label: "Blush",
    backgroundColor: "#f4d1d0",
    inkColor: "#382023",
    accentColor: "#d89598",
    preview: "linear-gradient(135deg, #f8e2dc, #f0bcc2)",
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
];

function createPreviewId() {
  return `preview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isSelectedInkSwatch(currentColor: string, swatch: (typeof inkSwatches)[number]) {
  const current = currentColor.trim().toLowerCase();
  const swatchColor = swatch.color.trim().toLowerCase();

  return current === swatchColor ||
    (swatch.label === "Lamp Black" && (current === "#17110b" || current === "#19140f"));
}

function getFallbackFont(size: number) {
  return `600 ${size}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
}

function sanitizeFileName(name: string) {
  const safeName = name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  return safeName || "local-font";
}

function tokenizeParagraph(paragraph: string) {
  return paragraph.match(/\S+\s*|\s+/g) ?? [];
}

function clampUnit(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function normalizePreviewSettings(settings?: Partial<PreviewImageSettings>): PreviewImageSettings {
  const normalized = {
    ...defaultPhoneImageSettings,
    ...settings,
  };
  const safeSettings = {
    ...normalized,
    manuscriptAge: clampUnit(normalized.manuscriptAge, defaultPhoneImageSettings.manuscriptAge),
    manuscriptEdges: clampUnit(normalized.manuscriptEdges, defaultPhoneImageSettings.manuscriptEdges),
    manuscriptFibers: clampUnit(normalized.manuscriptFibers, defaultPhoneImageSettings.manuscriptFibers),
    manuscriptInkSoak: clampUnit(normalized.manuscriptInkSoak, defaultPhoneImageSettings.manuscriptInkSoak),
    manuscriptRuling: clampUnit(normalized.manuscriptRuling, defaultPhoneImageSettings.manuscriptRuling),
    manuscriptStains: clampUnit(normalized.manuscriptStains, defaultPhoneImageSettings.manuscriptStains),
  };

  return exportPresets.some((preset) => preset.id === safeSettings.exportPreset)
    ? safeSettings
    : {
        ...safeSettings,
        exportPreset: "phone",
      };
}

function loadPreviewDocuments() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREVIEW_DOCUMENTS_KEY) ?? "[]") as PreviewDocument[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((document) => document?.id && typeof document.text === "string")
      .map((document) => ({
        ...document,
        headerText: typeof document.headerText === "string" ? document.headerText : "",
        name: document.name || "Untitled preview",
        settings: normalizePreviewSettings(document.settings),
        textLayers: Array.isArray(document.textLayers)
          ? document.textLayers.filter((layer): layer is PreviewTextLayer =>
              Boolean(layer?.id && typeof layer.text === "string" && typeof layer.fontId === "string"),
            ).map((layer) => ({
              ...layer,
              sizeScale: typeof layer.sizeScale === "number" ? layer.sizeScale : 1,
            }))
          : [],
      }));
  } catch {
    return [];
  }
}

function savePreviewDocuments(documents: PreviewDocument[]) {
  window.localStorage.setItem(PREVIEW_DOCUMENTS_KEY, JSON.stringify(documents));
}

export default function TextPreview({
  font,
  fonts,
  onRecordExport,
  onSaveImage,
  onSelectCharacter,
  headerPreviewText,
  onHeaderPreviewTextChange,
  previewText,
  onPreviewTextChange,
  selectedGlyph,
  spacebarGlyph,
}: TextPreviewProps) {
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewPointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const previewDoodlesRef = useRef<PreviewDoodleStroke[]>([]);
  const previewStickersRef = useRef<PreviewSticker[]>([]);
  const styleActiveDoodleRef = useRef<PreviewDoodleStroke | null>(null);
  const styleActiveStrokeRef = useRef<string | null>(null);
  const styleActiveStrokeTimeRef = useRef(0);
  const styleRenderFrameRef = useRef<number | null>(null);
  const styleStickerDragRef = useRef<StyleStickerDrag | null>(null);
  const styleMovingStickerRef = useRef<string | null>(null);
  const styleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const manuscriptParchmentRef = useRef<HTMLImageElement | null>(null);
  const viewerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<SettingsPanel>("image");
  const [activeStyleDrawer, setActiveStyleDrawer] = useState<StyleDrawer>(null);
  const [documentName, setDocumentName] = useState("Untitled preview");
  const [fullscreenSettingsMenuOpen, setFullscreenSettingsMenuOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [manuscriptParchmentReady, setManuscriptParchmentReady] = useState(false);
  const [previewMenuRoot, setPreviewMenuRoot] = useState<HTMLElement | null>(null);
  const [previewDoodles, setPreviewDoodles] = useState<PreviewDoodleStroke[]>([]);
  const [previewStickers, setPreviewStickers] = useState<PreviewSticker[]>([]);
  const [previewTextLayers, setPreviewTextLayers] = useState<PreviewTextLayer[]>([]);
  const [savedDocuments, setSavedDocuments] = useState<PreviewDocument[]>(() => loadPreviewDocuments());
  const [selectedPreviewDoodleId, setSelectedPreviewDoodleId] = useState<string | null>(null);
  const [selectedPreviewStickerId, setSelectedPreviewStickerId] = useState<string | null>(null);
  const [selectedPreviewTextLayerId, setSelectedPreviewTextLayerId] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [previewFontMetricOverrides, setPreviewFontMetricOverrides] = useState<Partial<Pick<Glyph, FontGlyphMetricKey>>>({});
  const [previewGlyphMetricOverrides, setPreviewGlyphMetricOverrides] = useState<Record<string, LetterMetricOverrides>>({});
  const [previewGuideSettings, setPreviewGuideSettings] = useState<FontGuideSettings | null>(null);
  const [previewShapeSettings, setPreviewShapeSettings] = useState<FontShapeSettings | null>(null);
  const [styleDoodleBrushSize, setStyleDoodleBrushSize] = useState(7);
  const [styleDoodleInkEffect, setStyleDoodleInkEffect] = useState<GlyphInkEffect>("none");
  const [styleDoodleSmoothing, setStyleDoodleSmoothing] = useState<StyleDoodleSmoothing>("strong");
  const [styleDoodleTool, setStyleDoodleTool] = useState<StyleDoodleTool>("pen");
  const [styleDrawMode, setStyleDrawMode] = useState(false);
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [styleSelectMenuOpen, setStyleSelectMenuOpen] = useState(false);
  const [styleSelectModeActive, setStyleSelectModeActive] = useState(false);
  const [styleSelectTarget, setStyleSelectTarget] = useState<StyleSelectTarget>("stickers");
  const [styleStickerDragPreview, setStyleStickerDragPreview] = useState<StyleStickerDragPreview | null>(null);
  const [styleStickerFacePanelOpen, setStyleStickerFacePanelOpen] = useState(false);
  const [styleStickerLookMode, setStyleStickerLookMode] = useState(false);
  const [styleStickerMoveMode, setStyleStickerMoveMode] = useState(false);
  const [styleStickerRednessPanelOpen, setStyleStickerRednessPanelOpen] = useState(false);
  const [styleStickerSleepPanelOpen, setStyleStickerSleepPanelOpen] = useState(false);
  const [imageSettings, setImageSettings] = useState<PreviewImageSettings>(() => ({
    ...defaultPhoneImageSettings,
  }));

  const savedGlyphCount = useMemo(
    () => Object.values(font.glyphs).filter((glyph) => hasDrawnGlyph(glyph)).length,
    [font.glyphs],
  );

  const previewFont = useMemo(() => {
    const glyphs = Object.fromEntries(
      Object.entries(font.glyphs).map(([character, glyph]) => {
        const fontMetricOverrides = character === spacebar ? {} : previewFontMetricOverrides;
        const letterOverrides = previewGlyphMetricOverrides[character] ?? {};
        const overrides = {
          ...fontMetricOverrides,
          ...letterOverrides,
        };

        return [
          character,
          {
            ...glyph,
            ...overrides,
            variants: glyph.variants?.map((variant) => ({
              ...variant,
              ...overrides,
            })),
          },
        ];
      }),
    );

    return {
      ...font,
      glyphs,
      guideSettings: previewGuideSettings ?? font.guideSettings,
      shapeSettings: previewShapeSettings ?? font.shapeSettings,
    };
  }, [font, previewFontMetricOverrides, previewGlyphMetricOverrides, previewGuideSettings, previewShapeSettings]);

  const availableFonts = useMemo(() => {
    const hasActiveFont = fonts.some((item) => item.id === previewFont.id);

    return hasActiveFont
      ? fonts.map((item) => (item.id === previewFont.id ? previewFont : item))
      : [previewFont, ...fonts];
  }, [font, fonts, previewFont]);

  const fontGlyphs = useMemo(
    () => Object.values(previewFont.glyphs).filter((glyph) => glyph.character !== spacebar),
    [previewFont.glyphs],
  );
  const selectedSourceCharacter = getHeaderSourceCharacter(selectedGlyph.character);
  const headerSettingsCharacter = canUseHeaderLetter(selectedSourceCharacter)
    ? getHeaderLetter(selectedSourceCharacter)
    : getHeaderLetter("A");
  const letterSettingsCharacter = isHeaderLetter(selectedGlyph.character)
    ? selectedSourceCharacter
    : selectedGlyph.character;
  const settingsGlyphCharacter = activeSettingsPanel === "headerLetter"
    ? headerSettingsCharacter
    : letterSettingsCharacter;
  const settingsGlyph = previewFont.glyphs[settingsGlyphCharacter] ?? {
    ...selectedGlyph,
    character: settingsGlyphCharacter,
  };
  const settingsGlyphIsHeader = isHeaderLetter(settingsGlyph.character);
  const settingsGlyphLabel = getCharacterLabel(settingsGlyph.character);
  const settingsGlyphPanelLabel = settingsGlyphIsHeader ? "Header Letter settings" : "Letter settings";
  const previewSpacebarGlyph = previewFont.glyphs[spacebar] ?? spacebarGlyph;
  const selectedPreviewDoodle = selectedPreviewDoodleId
    ? previewDoodles.find((stroke) => stroke.id === selectedPreviewDoodleId) ?? null
    : null;
  const selectedPreviewSticker = selectedPreviewStickerId
    ? previewStickers.find((sticker) => sticker.id === selectedPreviewStickerId) ?? null
    : null;
  const selectedPreviewTextLayer = selectedPreviewTextLayerId
    ? previewTextLayers.find((layer) => layer.id === selectedPreviewTextLayerId) ?? null
    : null;
  const headerEditorSourceCharacter = (() => {
    const firstTypedHeaderLetter = headerPreviewText.match(/[A-Za-z]/)?.[0];
    const preferredCharacter = firstTypedHeaderLetter ?? selectedSourceCharacter;
    const uppercaseCharacter = preferredCharacter.toUpperCase();

    return canUseHeaderLetter(uppercaseCharacter) ? uppercaseCharacter : "A";
  })();
  const headerEditorCharacter = getHeaderLetter(headerEditorSourceCharacter);
  const headerEditorLabel = getCharacterLabel(headerEditorCharacter);

  useEffect(() => {
    setPreviewMenuRoot(document.getElementById("preview-text-menu-slot"));
  }, []);

  useEffect(() => {
    const image = new Image();
    image.onload = () => {
      manuscriptParchmentRef.current = image;
      setManuscriptParchmentReady(true);
    };
    image.src = MANUSCRIPT_PARCHMENT_SRC;

    return () => {
      image.onload = null;
    };
  }, []);

  useEffect(() => {
    renderPhoneImage();
  }, [
    font,
    headerPreviewText,
    imageSettings,
    imageViewerOpen,
    manuscriptParchmentReady,
    previewFont,
    previewDoodles,
    previewStickers,
    previewTextLayers,
    previewText,
    selectedPreviewDoodleId,
    selectedPreviewStickerId,
    selectedPreviewTextLayerId,
    styleEditorOpen,
  ]);

  useEffect(() => {
    previewDoodlesRef.current = previewDoodles;
  }, [previewDoodles]);

  useEffect(() => {
    previewStickersRef.current = previewStickers;
  }, [previewStickers]);

  useEffect(() => {
    setPreviewFontMetricOverrides({});
    setPreviewGlyphMetricOverrides({});
    setPreviewGuideSettings(null);
    setPreviewShapeSettings(null);
    setPreviewTextLayers((current) =>
      current.map((layer) => ({
        ...layer,
        fontId: layer.fontId || font.id,
      })),
    );
  }, [font.id]);

  useEffect(() => {
    return () => {
      if (styleRenderFrameRef.current !== null) {
        window.cancelAnimationFrame(styleRenderFrameRef.current);
      }
      cancelStyleStickerDrag();
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("editor-fullscreen-open", imageViewerOpen || styleEditorOpen);

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [imageViewerOpen, styleEditorOpen]);

  useEffect(() => {
    if (!font.theme) {
      return;
    }

    setImageSettings((current) => ({
      ...current,
      accentColor: font.theme?.accentColor ?? current.accentColor,
      backgroundColor: font.theme?.backgroundColor ?? current.backgroundColor,
      backgroundStyle: font.theme?.backgroundStyle ?? current.backgroundStyle,
      backgroundTexture: font.theme?.backgroundTexture ?? current.backgroundTexture,
      inkColor: font.theme?.inkColor ?? current.inkColor,
    }));
  }, [font.id, font.theme?.accentColor, font.theme?.backgroundColor, font.theme?.backgroundStyle, font.theme?.backgroundTexture, font.theme?.inkColor]);

  function getPreviewGlyphKey(character: string, useHeaderLetters = false) {
    return useHeaderLetters && canUseHeaderLetter(character) ? getHeaderLetter(character) : character;
  }

  function measureCharacter(
    ctx: CanvasRenderingContext2D,
    character: string,
    fontSize: number,
    useHeaderLetters = false,
    fontForText: FontSet = previewFont,
  ) {
    if (character === spacebar) {
      return getSpacebarAdvance(fontForText.glyphs[spacebar], fontSize);
    }

    const glyph = findPreviewGlyph(fontForText.glyphs, getPreviewGlyphKey(character, useHeaderLetters));

    if (glyph) {
      return getGlyphAdvance(glyph, fontSize, getFontWidthScale(fontForText));
    }

    return ctx.measureText(character).width;
  }

  function getTrackedCharacterAdvance(characterWidth: number, renderSettings: Pick<PreviewImageSettings, "letterSpacing">) {
    return Math.max(1, characterWidth + renderSettings.letterSpacing);
  }

  function measureTextRun(
    ctx: CanvasRenderingContext2D,
    text: string,
    fontSize: number,
    letterSpacing = imageSettings.letterSpacing,
    useHeaderLetters = false,
    fontForText: FontSet = previewFont,
  ) {
    const characters = [...text];

    return characters.reduce(
      (width, character, index) =>
        width +
        measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText) +
        (index < characters.length - 1 ? letterSpacing : 0),
      0,
    );
  }

  function buildWordWrappedLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxLineWidth: number,
    fontSize: number,
    letterSpacing = imageSettings.letterSpacing,
    useHeaderLetters = false,
    fontForText: FontSet = previewFont,
  ) {
    const paragraphs = text.split("\n");
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      let line = "";
      let lineWidth = 0;

      if (paragraph.length === 0) {
        lines.push("");
        continue;
      }

      for (const rawToken of tokenizeParagraph(paragraph)) {
        const token = line.length === 0 ? rawToken.replace(/^\s+/, "") : rawToken;

        if (!token) {
          continue;
        }

        const tokenWidth = measureTextRun(ctx, token, fontSize, letterSpacing, useHeaderLetters, fontForText);

        if (line.length > 0 && lineWidth + tokenWidth > maxLineWidth) {
          lines.push(line.trimEnd());
          line = token.replace(/^\s+/, "");
          lineWidth = measureTextRun(ctx, line, fontSize, letterSpacing, useHeaderLetters, fontForText);
        } else {
          line += token;
          lineWidth += tokenWidth;
        }

        lineWidth = Math.max(lineWidth, measureTextRun(ctx, line, fontSize, letterSpacing, useHeaderLetters, fontForText));
      }

      lines.push(line.trimEnd());
    }

    return lines;
  }

  function buildCharacterWrappedLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxLineWidth: number,
    fontSize: number,
    letterSpacing = imageSettings.letterSpacing,
    useHeaderLetters = false,
    fontForText: FontSet = previewFont,
  ) {
    const paragraphs = text.split("\n");
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      let line = "";
      let lineWidth = 0;

      if (paragraph.length === 0) {
        lines.push("");
        continue;
      }

      for (const character of paragraph) {
        const characterWidth = measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText);
        const trackedWidth = line.length > 0
          ? getTrackedCharacterAdvance(characterWidth, { letterSpacing })
          : characterWidth;

        if (line.length > 0 && lineWidth + trackedWidth > maxLineWidth) {
          lines.push(line);
          line = character.trimStart();
          lineWidth = measureTextRun(ctx, line, fontSize, letterSpacing, useHeaderLetters, fontForText);
          continue;
        }

        line += character;
        lineWidth += trackedWidth;
      }

      lines.push(line.trimEnd());
    }

    return lines;
  }

  function getLineX(
    ctx: CanvasRenderingContext2D,
    line: string,
    renderSettings: PreviewImageSettings,
    fontSize = renderSettings.fontSize,
    useHeaderLetters = false,
    fontForText: FontSet = previewFont,
  ) {
    const lineWidth = measureTextRun(
      ctx,
      line,
      fontSize,
      renderSettings.letterSpacing,
      useHeaderLetters,
      fontForText,
    );

    if (renderSettings.alignment === "center") {
      return Math.max(renderSettings.pagePadding, (renderSettings.canvasWidth - lineWidth) / 2);
    }

    if (renderSettings.alignment === "right") {
      return Math.max(renderSettings.pagePadding, renderSettings.canvasWidth - renderSettings.pagePadding - lineWidth);
    }

    return renderSettings.pagePadding;
  }

  function drawTextToCanvas(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    renderSettings: PreviewImageSettings,
    options: {
      font?: FontSet;
      fontSize?: number;
      sourceText?: string;
      startY?: number;
      useHeaderLetters?: boolean;
    } = {},
  ) {
    const fontForText = options.font ?? previewFont;
    const fontHeightScale = getFontHeightScale(fontForText);
    const fontWidthScale = getFontWidthScale(fontForText);
    const fontSize = options.fontSize ?? renderSettings.fontSize;
    const sourceText = options.sourceText ?? previewText;
    const startY = options.startY ?? renderSettings.pagePadding;
    const useHeaderLetters = options.useHeaderLetters ?? false;
    const lineHeight = fontSize * renderSettings.lineSpacing * Math.max(0.72, fontHeightScale);
    ctx.font = getFallbackFont(fontSize);
    ctx.textBaseline = "top";

    lines.forEach((line, lineIndex) => {
      let x = getLineX(ctx, line, renderSettings, fontSize, useHeaderLetters, fontForText);
      const y = startY + lineIndex * lineHeight;

      [...line].forEach((character, characterIndex) => {
        const glyphKey = getPreviewGlyphKey(character, useHeaderLetters);
        const glyph = selectPreviewGlyph(
          fontForText.glyphs,
          glyphKey,
          `${fontForText.id}|${sourceText}|${useHeaderLetters ? "header" : "body"}|${lineIndex}|${characterIndex}|${character}`,
        );

        if (glyph) {
          const scales = getGlyphRenderScales(fontForText, glyph);
          const baselineY = y + fontSize * 0.76 * fontHeightScale;
          const glyphX = x + getGlyphLeftBearingOffset(font, glyph, fontSize);
          const glyphY = getGlyphTopForBaseline(glyph, fontSize, baselineY, scales.heightScale);

          drawGlyph(ctx, glyph, {
            x: glyphX,
            y: glyphY,
            size: fontSize,
            color: renderSettings.inkColor,
            renderProfile: fontForText.renderProfile,
            heightScale: scales.heightScale,
            widthScale: scales.widthScale,
            backgroundTexture: renderSettings.backgroundTexture,
          });
          x += getTrackedCharacterAdvance(
            getGlyphAdvance(glyph, fontSize, fontWidthScale),
            renderSettings,
          );
          return;
        }

        if (character === spacebar) {
          x += getTrackedCharacterAdvance(
            measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText),
            renderSettings,
          );
          return;
        }

        const fallbackWidth = ctx.measureText(character).width;
        ctx.save();
        ctx.fillStyle = "rgba(204, 102, 94, 0.24)";
        ctx.fillRect(x - 3, y + fontSize * 0.02, fallbackWidth + 6, fontSize * 1.02);
        ctx.restore();
        ctx.fillStyle = renderSettings.inkColor;
        ctx.fillText(character, x, y + fontSize * 0.04);
        x += getTrackedCharacterAdvance(fallbackWidth, renderSettings);
      });
    });
  }

  function getPreviewGlyphHitTargets(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    renderSettings: PreviewImageSettings,
    options: {
      font?: FontSet;
      fontSize?: number;
      sourceText?: string;
      startY?: number;
      useHeaderLetters?: boolean;
    } = {},
  ): PreviewGlyphHitTarget[] {
    const fontForText = options.font ?? previewFont;
    const fontHeightScale = getFontHeightScale(fontForText);
    const fontWidthScale = getFontWidthScale(fontForText);
    const fontSize = options.fontSize ?? renderSettings.fontSize;
    const sourceText = options.sourceText ?? previewText;
    const startY = options.startY ?? renderSettings.pagePadding;
    const useHeaderLetters = options.useHeaderLetters ?? false;
    const lineHeight = fontSize * renderSettings.lineSpacing * Math.max(0.72, fontHeightScale);
    const targetHeight = Math.max(lineHeight, fontSize * 1.08 * fontHeightScale);
    ctx.font = getFallbackFont(fontSize);

    return lines.flatMap((line, lineIndex) => {
      let x = getLineX(ctx, line, renderSettings, fontSize, useHeaderLetters, fontForText);
      const y = startY + lineIndex * lineHeight - fontSize * 0.08;

      return [...line].flatMap((character, characterIndex) => {
        const glyphKey = getPreviewGlyphKey(character, useHeaderLetters);
        const glyph = selectPreviewGlyph(
          fontForText.glyphs,
          glyphKey,
          `${fontForText.id}|${sourceText}|${useHeaderLetters ? "header" : "body"}|${lineIndex}|${characterIndex}|${character}`,
        );
        const characterWidth = glyph
          ? getGlyphAdvance(glyph, fontSize, fontWidthScale)
          : measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText);
        const target: PreviewGlyphHitTarget = {
          character,
          editableCharacter: glyph?.character ?? glyphKey,
          height: targetHeight,
          width: Math.max(1, characterWidth),
          x,
          y,
        };

        x += getTrackedCharacterAdvance(characterWidth, renderSettings);

        if (character.trim().length === 0 || fontForText.id !== previewFont.id || !fontForText.glyphs[target.editableCharacter]) {
          return [];
        }

        return [target];
      });
    });
  }

  function findPreviewGlyphHitTarget(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    const layout = getPhoneImageLayout(ctx);

    const targets = [
      ...getPreviewGlyphHitTargets(ctx, layout.headerLines, layout.settings, {
        font: previewFont,
        fontSize: layout.headerFontSize,
        sourceText: headerPreviewText,
        startY: layout.settings.pagePadding,
        useHeaderLetters: true,
      }),
      ...getPreviewGlyphHitTargets(ctx, layout.lines, layout.settings, {
        font: previewFont,
        sourceText: previewText,
        startY: layout.bodyStartY,
      }),
    ];

    return targets.find(
      (target) =>
        x >= target.x &&
        x <= target.x + target.width &&
        y >= target.y &&
        y <= target.y + target.height,
    ) ?? null;
  }

  function handleFullscreenPreviewPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    previewPointerStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleFullscreenPreviewPointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    const pointerStart = previewPointerStartRef.current;
    previewPointerStartRef.current = null;

    if (
      pointerStart &&
      pointerStart.id === event.pointerId &&
      Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 8
    ) {
      return;
    }

    const hitTarget = findPreviewGlyphHitTarget(event.currentTarget, event.clientX, event.clientY);

    if (!hitTarget) {
      return;
    }

    event.preventDefault();
    setFullscreenSettingsMenuOpen(false);
    onSelectCharacter(hitTarget.editableCharacter);
    setActiveSettingsPanel(isHeaderLetter(hitTarget.editableCharacter) ? "headerLetter" : "letter");
    setShareStatus(`Selected "${getCharacterLabel(hitTarget.editableCharacter)}".`);
  }

  function clampPreviewPoint(value: number) {
    return Math.min(1, Math.max(0, value));
  }

  function getStyleCanvasPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): PreviewDoodlePoint {
    const rect = canvas.getBoundingClientRect();

    return {
      x: clampPreviewPoint((clientX - rect.left) / Math.max(1, rect.width)),
      y: clampPreviewPoint((clientY - rect.top) / Math.max(1, rect.height)),
    };
  }

  function getStylePointerPressure(event: ReactPointerEvent<HTMLCanvasElement>) {
    const eventPressure = event.pressure > 0 ? event.pressure : undefined;

    return Math.min(1, Math.max(0.48, eventPressure ?? (event.pointerType === "mouse" ? 0.58 : 0.66)));
  }

  function getStyleSmoothedPoint(
    previousPoint: PreviewDoodlePoint,
    point: PreviewDoodlePoint,
    smoothing: StyleDoodleSmoothing,
  ): PreviewDoodlePoint {
    const followAmount = smoothing === "raw" ? 1 : smoothing === "gentle" ? 0.72 : 0.48;

    return {
      ...point,
      x: previousPoint.x + (point.x - previousPoint.x) * followAmount,
      y: previousPoint.y + (point.y - previousPoint.y) * followAmount,
    };
  }

  function getStylePooledInkPoint(
    previousPoint: PreviewDoodlePoint | null,
    point: PreviewDoodlePoint,
    eventTime: number,
    inkEffect: GlyphInkEffect,
  ): PreviewDoodlePoint {
    if (inkEffect !== "subtleSpread") {
      return {
        ...point,
        ink: 0,
        spread: point.spread,
      };
    }

    const elapsed = Math.max(1, eventTime - styleActiveStrokeTimeRef.current);
    const distance = previousPoint
      ? Math.hypot(point.x - previousPoint.x, point.y - previousPoint.y) * imageSettings.canvasWidth
      : 0;
    const speed = distance / elapsed;
    const slowInk = Math.max(0, Math.min(1, (0.22 - speed) / 0.22));
    const dwellInk = Math.max(0, Math.min(1, (elapsed - 22) / 135));
    const pressure = point.pressure ?? 0.66;
    const pool = Math.max(slowInk * slowInk, dwellInk * 0.72, 0.18) * pressure;
    const spread = Math.min(1, 0.12 + pool * 0.62);

    return {
      ...point,
      ink: Math.max(point.ink ?? 0, pool),
      spread: Math.max(point.spread ?? 0, spread),
    };
  }

  function getActivePreviewDoodleStrokes() {
    const activeStroke = styleActiveDoodleRef.current;

    return activeStroke ? [...previewDoodlesRef.current, activeStroke] : previewDoodlesRef.current;
  }

  function scheduleStyleCanvasRender() {
    if (styleRenderFrameRef.current !== null) {
      return;
    }

    styleRenderFrameRef.current = window.requestAnimationFrame(() => {
      styleRenderFrameRef.current = null;

      if (!styleCanvasRef.current) {
        return;
      }

      renderPhoneImageToCanvas(styleCanvasRef.current, {
        doodleStrokes: getActivePreviewDoodleStrokes(),
        renderSettings: getScaledPreviewSettings(imageSettings, STYLE_CANVAS_MAX_PIXELS),
        showSelection: true,
        stickers: previewStickersRef.current,
      });
    });
  }

  function findPreviewStickerAtPoint(point: PreviewDoodlePoint, fallbackToEditableSticker = true) {
    if (previewStickers.length === 0) {
      return null;
    }

    const hitSticker = [...previewStickers].reverse().find((sticker) => {
      const hitRadius = Math.max(0.06, sticker.size * 2.8);
      return Math.hypot(point.x - sticker.x, point.y - sticker.y) <= hitRadius;
    });

    return hitSticker?.id ?? (fallbackToEditableSticker ? getEditablePreviewStickerId() : null);
  }

  function getDistanceToSegment(point: PreviewDoodlePoint, start: PreviewDoodlePoint, end: PreviewDoodlePoint) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared <= 0) {
      return Math.hypot(point.x - start.x, point.y - start.y);
    }

    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
    return Math.hypot(point.x - (start.x + dx * t), point.y - (start.y + dy * t));
  }

  function findPreviewDoodleAtPoint(point: PreviewDoodlePoint) {
    let bestDistance = Number.POSITIVE_INFINITY;
    let bestMatchId: string | null = null;

    previewDoodles.forEach((stroke) => {
      if (stroke.points.length === 0) {
        return;
      }

      const hitRadius = Math.max(0.018, stroke.size * 4.5);
      const distances = stroke.points.length === 1
        ? [Math.hypot(point.x - stroke.points[0].x, point.y - stroke.points[0].y)]
        : stroke.points.slice(1).map((strokePoint, index) =>
            getDistanceToSegment(point, stroke.points[index], strokePoint),
          );
      const distance = Math.min(...distances);

      if (distance <= hitRadius && distance < bestDistance) {
        bestDistance = distance;
        bestMatchId = stroke.id;
      }
    });

    return bestMatchId;
  }

  function findPreviewTextLayerAtPoint(canvas: HTMLCanvasElement, point: PreviewDoodlePoint) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    const renderSettings = getScaledPreviewSettings(imageSettings, STYLE_CANVAS_MAX_PIXELS);
    const layout = getPhoneImageLayout(ctx, renderSettings);
    const targets = getPreviewTextLayerHitTargets(ctx, renderSettings, layout.bodyEndY + renderSettings.fontSize * 0.35);
    const x = point.x * renderSettings.canvasWidth;
    const y = point.y * renderSettings.canvasHeight;

    return [...targets].reverse().find((target) =>
      x >= target.x &&
      x <= target.x + target.width &&
      y >= target.y &&
      y <= target.y + target.height,
    )?.id ?? null;
  }

  function handleStyleSelection(point: PreviewDoodlePoint, canvas: HTMLCanvasElement) {
    if (styleSelectTarget === "stickers") {
      const stickerId = findPreviewStickerAtPoint(point, false);
      setSelectedPreviewStickerId(stickerId);
      setSelectedPreviewTextLayerId(null);
      setSelectedPreviewDoodleId(null);
      setShareStatus(stickerId ? "Selected sticker." : "No sticker selected.");
      scheduleStyleCanvasRender();
      return;
    }

    if (styleSelectTarget === "text") {
      const textLayerId = findPreviewTextLayerAtPoint(canvas, point);
      setSelectedPreviewTextLayerId(textLayerId);
      setSelectedPreviewStickerId(null);
      setSelectedPreviewDoodleId(null);
      setShareStatus(textLayerId ? "Selected text." : "No text selected.");
      scheduleStyleCanvasRender();
      return;
    }

    const doodleId = findPreviewDoodleAtPoint(point);
    setSelectedPreviewDoodleId(doodleId);
    setSelectedPreviewStickerId(null);
    setSelectedPreviewTextLayerId(null);
    setShareStatus(doodleId ? "Selected doodle stroke." : "No doodle stroke selected.");
    scheduleStyleCanvasRender();
  }

  function movePreviewStickerTo(stickerId: string, point: PreviewDoodlePoint) {
    setSelectedPreviewStickerId(stickerId);
    setPreviewStickers((current) =>
      current.map((sticker) =>
        sticker.id === stickerId
          ? {
              ...sticker,
              x: point.x,
              y: point.y,
            }
          : sticker,
      ),
    );
  }

  function handleStyleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (styleStickerLookMode) {
      event.preventDefault();

      if (!selectedPreviewStickerId) {
        setShareStatus("Select eyes first.");
        setStyleStickerLookMode(false);
        return;
      }

      const point = getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY);
      setPreviewStickers((current) => {
        const nextStickers = current.map((sticker) =>
          sticker.id === selectedPreviewStickerId
            ? {
                ...sticker,
                lookAt: point,
              }
            : sticker,
        );

        previewStickersRef.current = nextStickers;
        return nextStickers;
      });
      setActiveDocumentId(null);
      scheduleStyleCanvasRender();
      setShareStatus("Eyes are looking there.");
      return;
    }

    if (styleStickerMoveMode) {
      event.preventDefault();
      const point = getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY);
      const stickerId = findPreviewStickerAtPoint(point);

      if (!stickerId) {
        setShareStatus("Add eyes first.");
        return;
      }

      styleMovingStickerRef.current = stickerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      movePreviewStickerTo(stickerId, point);
      return;
    }

    if (!styleDrawMode) {
      if (styleSelectModeActive || styleSelectMenuOpen) {
        event.preventDefault();
        setStyleSelectMenuOpen(false);
        setStyleSelectModeActive(true);
        handleStyleSelection(getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY), event.currentTarget);
      }
      return;
    }

    event.preventDefault();
    const pressure = getStylePointerPressure(event);
    const point = getStylePooledInkPoint(
      null,
      {
        ...getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY),
        pressure,
      },
      event.timeStamp,
      styleDoodleInkEffect,
    );
    const strokeId = createPreviewId();
    styleActiveStrokeRef.current = strokeId;
    styleActiveStrokeTimeRef.current = event.timeStamp;
    event.currentTarget.setPointerCapture(event.pointerId);
    styleActiveDoodleRef.current = {
      color: imageSettings.inkColor,
      id: strokeId,
      inkEffect: styleDoodleInkEffect,
      points: styleDoodleTool === "line" ? [point, { ...point }] : [point],
      size: styleDoodleBrushSize / Math.max(1, imageSettings.canvasWidth),
      tool: styleDoodleTool,
    };
    scheduleStyleCanvasRender();
  }

  function handleStyleCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (styleStickerMoveMode && styleMovingStickerRef.current) {
      event.preventDefault();
      movePreviewStickerTo(
        styleMovingStickerRef.current,
        getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY),
      );
      return;
    }

    if (!styleDrawMode || !styleActiveStrokeRef.current) {
      return;
    }

    event.preventDefault();
    const pressure = getStylePointerPressure(event);
    const point = {
      ...getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY),
      pressure,
      ink: 0,
    };
    const strokeId = styleActiveStrokeRef.current;
    const stroke = styleActiveDoodleRef.current;

    if (!stroke || stroke.id !== strokeId) {
      return;
    }

    const firstPoint = stroke.points[0] ?? point;

    if (stroke.tool === "line") {
      styleActiveDoodleRef.current = {
        ...stroke,
        points: [firstPoint, getStylePooledInkPoint(firstPoint, point, event.timeStamp, stroke.inkEffect)],
      };
      scheduleStyleCanvasRender();
      styleActiveStrokeTimeRef.current = event.timeStamp;
      return;
    }

    const lastPoint = stroke.points[stroke.points.length - 1] ?? point;
    const smoothedPoint = getStyleSmoothedPoint(lastPoint, point, styleDoodleSmoothing);
    const pooledPoint = getStylePooledInkPoint(lastPoint, smoothedPoint, event.timeStamp, stroke.inkEffect);
    const distance = Math.hypot(pooledPoint.x - lastPoint.x, pooledPoint.y - lastPoint.y);

    if (distance < 0.0015 && (pooledPoint.spread ?? 0) <= 0) {
      return;
    }

    styleActiveDoodleRef.current = {
      ...stroke,
      points: [...stroke.points, pooledPoint],
    };
    scheduleStyleCanvasRender();
    styleActiveStrokeTimeRef.current = event.timeStamp;
  }

  function handleStyleCanvasPointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (styleMovingStickerRef.current) {
      event.preventDefault();
      styleMovingStickerRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      return;
    }

    if (!styleActiveStrokeRef.current) {
      return;
    }

    event.preventDefault();
    const finishedStroke = styleActiveDoodleRef.current;
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (!finishedStroke) {
      scheduleStyleCanvasRender();
      return;
    }

    setPreviewDoodles((current) => {
      const nextDoodles = [...current, finishedStroke];
      previewDoodlesRef.current = nextDoodles;
      return nextDoodles;
    });
  }

  function drawPaperTexture(ctx: CanvasRenderingContext2D, color: string, imageWidth: number, imageHeight: number) {
    ctx.save();
    ctx.fillStyle = color;

    const speckleCount = Math.max(80, Math.ceil((imageWidth * imageHeight) / 4000));

    for (let index = 0; index < speckleCount; index += 1) {
      const x = (index * 97) % imageWidth;
      const y = (index * 193) % imageHeight;
      const radius = 0.8 + (index % 5) * 0.42;
      ctx.globalAlpha = 0.035 + (index % 4) * 0.008;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawImageGrainTexture(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    const speckleCount = Math.max(220, Math.ceil((imageWidth * imageHeight) / 2400));

    ctx.save();
    ctx.fillStyle = renderSettings.accentColor;

    for (let index = 0; index < speckleCount; index += 1) {
      const x = (index * 97) % imageWidth;
      const y = (index * 193) % imageHeight;
      const radius = Math.max(1, imageWidth / 1500) * (0.9 + (index % 5) * 0.32);
      ctx.globalAlpha = 0.075 + (index % 5) * 0.012;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "#fff7e6";
    for (let index = 0; index < speckleCount * 0.28; index += 1) {
      const x = (index * 173) % imageWidth;
      const y = (index * 89) % imageHeight;
      const size = Math.max(1, imageWidth / 1700) * (1 + (index % 2) * 0.7);
      ctx.globalAlpha = 0.04 + (index % 3) * 0.012;
      ctx.fillRect(x, y, size, size);
    }

    ctx.restore();
  }

  function drawImageFiberTexture(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    const fiberCount = Math.max(80, Math.ceil(imageHeight / 12));

    ctx.save();
    ctx.strokeStyle = renderSettings.accentColor;
    ctx.lineWidth = Math.max(1.2, imageWidth / 900);

    for (let index = 0; index < fiberCount; index += 1) {
      const y = (index * 37) % imageHeight;
      const startX = (index * 61) % Math.max(1, imageWidth * 0.22);
      const length = imageWidth * (0.48 + ((index * 17) % 39) / 100);
      const wave = Math.max(5, imageWidth / 180) + (index % 5) * 2;

      ctx.globalAlpha = 0.14 + (index % 4) * 0.03;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.bezierCurveTo(
        startX + length * 0.32,
        y - wave,
        startX + length * 0.66,
        y + wave,
        Math.min(imageWidth, startX + length),
        y + (index % 2 === 0 ? -1 : 1) * wave * 0.6,
      );
      ctx.stroke();
    }

    ctx.strokeStyle = "#fff7e6";
    ctx.lineWidth = Math.max(0.8, imageWidth / 1500);
    for (let index = 0; index < fiberCount * 0.4; index += 1) {
      const y = (index * 47) % imageHeight;
      const startX = (index * 83) % Math.max(1, imageWidth * 0.38);
      const length = imageWidth * (0.24 + ((index * 13) % 28) / 100);

      ctx.globalAlpha = 0.07 + (index % 3) * 0.018;
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(Math.min(imageWidth, startX + length), y + ((index % 3) - 1) * Math.max(3, imageWidth / 360));
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawImageCanvasTexture(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings, spacingMultiplier = 1) {
    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    const spacing = Math.max(12, Math.min(imageWidth, imageHeight) * 0.032);

    ctx.save();
    ctx.strokeStyle = renderSettings.accentColor;
    ctx.lineWidth = Math.max(1.4, imageWidth / 720);

    for (let x = 0; x <= imageWidth; x += spacing * spacingMultiplier) {
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, imageHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= imageHeight; y += spacing * 0.86 * spacingMultiplier) {
      ctx.globalAlpha = 0.13;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(imageWidth, y);
      ctx.stroke();
    }

    ctx.strokeStyle = "#fff7e6";
    ctx.lineWidth = Math.max(0.9, imageWidth / 1500);
    for (let x = spacing * 0.48; x <= imageWidth; x += spacing * spacingMultiplier) {
      ctx.globalAlpha = 0.075;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, imageHeight);
      ctx.stroke();
    }

    for (let y = spacing * 0.4; y <= imageHeight; y += spacing * 0.86 * spacingMultiplier) {
      ctx.globalAlpha = 0.062;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(imageWidth, y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawSelectedImageTexture(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    if (renderSettings.backgroundTexture === "clean") {
      return;
    }

    if (renderSettings.backgroundTexture === "grain") {
      drawImageGrainTexture(ctx, renderSettings);
      return;
    }

    if (renderSettings.backgroundTexture === "fiber") {
      drawImageGrainTexture(ctx, renderSettings);
      drawImageFiberTexture(ctx, renderSettings);
      return;
    }

    if (renderSettings.backgroundTexture === "canvas") {
      drawImageGrainTexture(ctx, renderSettings);
      drawImageCanvasTexture(ctx, renderSettings, 0.64);
      return;
    }

    drawImageGrainTexture(ctx, renderSettings);
    drawImageFiberTexture(ctx, renderSettings);
    drawImageCanvasTexture(ctx, renderSettings, 0.82);
  }

  function drawParchmentTexture(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    const gradient = ctx.createLinearGradient(0, 0, imageWidth, imageHeight);
    gradient.addColorStop(0, "#f8edcb");
    gradient.addColorStop(0.46, renderSettings.backgroundColor);
    gradient.addColorStop(1, "#c69b5f");

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, imageWidth, imageHeight);
    drawPaperTexture(ctx, renderSettings.accentColor, imageWidth, imageHeight);

    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = "#8b5d2e";
    ctx.lineWidth = Math.max(1, imageWidth / 1400);
    for (let index = 0; index < 46; index += 1) {
      const y = ((index * 157) % imageHeight) + Math.sin(index * 1.7) * 18;
      const xStart = (index * 71) % Math.max(1, renderSettings.pagePadding);
      ctx.beginPath();
      ctx.moveTo(xStart, y);
      ctx.bezierCurveTo(
        imageWidth * 0.3,
        y + Math.sin(index) * 28,
        imageWidth * 0.68,
        y - Math.cos(index * 0.6) * 34,
        imageWidth,
        y + Math.sin(index * 0.4) * 16,
      );
      ctx.stroke();
    }

    const edge = Math.max(60, imageWidth * 0.11);
    const edgeGradient = ctx.createRadialGradient(
      imageWidth / 2,
      imageHeight / 2,
      Math.min(imageWidth, imageHeight) * 0.22,
      imageWidth / 2,
      imageHeight / 2,
      Math.max(imageWidth, imageHeight) * 0.72,
    );
    edgeGradient.addColorStop(0, "rgba(92, 50, 21, 0)");
    edgeGradient.addColorStop(0.76, "rgba(92, 50, 21, 0.12)");
    edgeGradient.addColorStop(1, "rgba(54, 28, 12, 0.34)");
    ctx.fillStyle = edgeGradient;
    ctx.globalAlpha = 1;
    ctx.fillRect(-edge, -edge, imageWidth + edge * 2, imageHeight + edge * 2);
    ctx.restore();
  }

  function drawImageCover(
    ctx: CanvasRenderingContext2D,
    image: HTMLImageElement,
    width: number,
    height: number,
  ) {
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.naturalWidth - sourceWidth) / 2;
    const sourceY = (image.naturalHeight - sourceHeight) / 2;

    ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  }

  function drawManuscriptFibers(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    const fiberStrength = renderSettings.manuscriptFibers;

    if (fiberStrength <= 0) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = "#7a5229";
    ctx.lineWidth = Math.max(0.8, imageWidth / 1900);
    ctx.lineCap = "round";

    const fiberCount = Math.ceil((36 + imageHeight / 18) * fiberStrength);

    for (let index = 0; index < fiberCount; index += 1) {
      const y = (index * 47) % imageHeight;
      const x = (index * 113) % imageWidth;
      const length = imageWidth * (0.12 + ((index * 17) % 38) / 100);
      const drift = Math.sin(index * 1.4) * imageWidth * 0.018;

      ctx.globalAlpha = 0.035 + fiberStrength * 0.08 + (index % 3) * 0.012;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(
        x + length * 0.35,
        y - drift,
        x + length * 0.7,
        y + drift,
        Math.min(imageWidth, x + length),
        y + Math.sin(index) * imageWidth * 0.006,
      );
      ctx.stroke();
    }

    ctx.strokeStyle = "#fff4d6";
    for (let index = 0; index < fiberCount * 0.42; index += 1) {
      const y = (index * 73) % imageHeight;
      const x = (index * 59) % imageWidth;
      const length = imageWidth * (0.08 + ((index * 11) % 22) / 100);

      ctx.globalAlpha = 0.035 + fiberStrength * 0.05;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(Math.min(imageWidth, x + length), y + Math.sin(index * 0.8) * imageWidth * 0.004);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawManuscriptStains(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const stainStrength = renderSettings.manuscriptStains;

    if (stainStrength <= 0) {
      return;
    }

    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    const stainCount = Math.ceil(4 + stainStrength * 12);

    ctx.save();
    ctx.globalCompositeOperation = "multiply";

    for (let index = 0; index < stainCount; index += 1) {
      const edgeBias = index % 4;
      const x = edgeBias === 0
        ? imageWidth * (0.08 + ((index * 17) % 18) / 100)
        : edgeBias === 1
          ? imageWidth * (0.72 + ((index * 13) % 18) / 100)
          : imageWidth * (0.2 + ((index * 31) % 60) / 100);
      const y = edgeBias === 2
        ? imageHeight * (0.08 + ((index * 23) % 16) / 100)
        : edgeBias === 3
          ? imageHeight * (0.72 + ((index * 19) % 18) / 100)
          : imageHeight * (0.16 + ((index * 29) % 68) / 100);
      const radiusX = imageWidth * (0.035 + ((index * 7) % 16) / 100) * (0.7 + stainStrength);
      const radiusY = imageHeight * (0.02 + ((index * 5) % 11) / 100) * (0.7 + stainStrength);
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, Math.max(radiusX, radiusY));

      gradient.addColorStop(0, `rgba(116, 66, 23, ${0.06 + stainStrength * 0.14})`);
      gradient.addColorStop(0.65, `rgba(116, 66, 23, ${0.025 + stainStrength * 0.06})`);
      gradient.addColorStop(1, "rgba(116, 66, 23, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.ellipse(x, y, radiusX, radiusY, Math.sin(index) * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawManuscriptRuling(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const rulingStrength = renderSettings.manuscriptRuling;

    if (rulingStrength <= 0) {
      return;
    }

    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    const lineGap = renderSettings.fontSize * renderSettings.lineSpacing * 0.92;

    ctx.save();
    ctx.strokeStyle = "#6e8b92";
    ctx.globalAlpha = 0.08 + rulingStrength * 0.18;
    ctx.lineWidth = Math.max(1, imageWidth / 1700);

    for (let y = renderSettings.pagePadding + renderSettings.fontSize * 0.86; y < imageHeight - renderSettings.pagePadding * 0.5; y += lineGap) {
      ctx.beginPath();
      ctx.moveTo(renderSettings.pagePadding * 0.72, y);
      ctx.lineTo(imageWidth - renderSettings.pagePadding * 0.72, y + Math.sin(y * 0.008) * imageWidth * 0.003);
      ctx.stroke();
    }

    ctx.strokeStyle = "#9b6f3b";
    ctx.globalAlpha = rulingStrength * 0.16;
    ctx.beginPath();
    ctx.moveTo(renderSettings.pagePadding * 0.58, renderSettings.pagePadding * 0.62);
    ctx.lineTo(renderSettings.pagePadding * 0.58, imageHeight - renderSettings.pagePadding * 0.62);
    ctx.stroke();
    ctx.restore();
  }

  function drawManuscriptPage(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    const image = manuscriptParchmentRef.current;

    ctx.save();
    if (image?.complete && image.naturalWidth > 0) {
      drawImageCover(ctx, image, imageWidth, imageHeight);
    } else {
      drawParchmentTexture(ctx, renderSettings);
    }

    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = `rgba(118, 70, 24, ${renderSettings.manuscriptAge * 0.18})`;
    ctx.fillRect(0, 0, imageWidth, imageHeight);

    const edgeGradient = ctx.createRadialGradient(
      imageWidth / 2,
      imageHeight / 2,
      Math.min(imageWidth, imageHeight) * 0.24,
      imageWidth / 2,
      imageHeight / 2,
      Math.max(imageWidth, imageHeight) * 0.74,
    );
    edgeGradient.addColorStop(0, "rgba(80, 42, 14, 0)");
    edgeGradient.addColorStop(0.72, `rgba(80, 42, 14, ${renderSettings.manuscriptEdges * 0.12})`);
    edgeGradient.addColorStop(1, `rgba(45, 23, 9, ${renderSettings.manuscriptEdges * 0.34})`);
    ctx.fillStyle = edgeGradient;
    ctx.fillRect(0, 0, imageWidth, imageHeight);
    ctx.restore();

    drawManuscriptStains(ctx, renderSettings);
    drawManuscriptFibers(ctx, renderSettings);
    drawManuscriptRuling(ctx, renderSettings);
  }

  function drawPreviewBackground(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, imageWidth, imageHeight);

    if (renderSettings.transparent) {
      return;
    }

    if (renderSettings.backgroundStyle === "manuscript") {
      drawManuscriptPage(ctx, renderSettings);
      return;
    }

    if (renderSettings.backgroundStyle === "parchment") {
      drawParchmentTexture(ctx, renderSettings);
      drawSelectedImageTexture(ctx, renderSettings);
      return;
    }

    if (renderSettings.backgroundStyle === "rage") {
      const gradient = ctx.createLinearGradient(0, 0, imageWidth, imageHeight);
      gradient.addColorStop(0, "#130305");
      gradient.addColorStop(0.56, renderSettings.backgroundColor);
      gradient.addColorStop(1, "#6f1115");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, imageWidth, imageHeight);

      const glow = ctx.createRadialGradient(imageWidth * 0.76, imageHeight * 0.14, 40, imageWidth * 0.76, imageHeight * 0.14, imageWidth * 0.7);
      glow.addColorStop(0, "rgba(255, 176, 0, 0.42)");
      glow.addColorStop(1, "rgba(255, 176, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, imageWidth, imageHeight);
      drawPaperTexture(ctx, renderSettings.accentColor, imageWidth, imageHeight);
      drawSelectedImageTexture(ctx, renderSettings);
      return;
    }

    if (renderSettings.backgroundStyle === "midnight") {
      const gradient = ctx.createLinearGradient(0, 0, imageWidth, imageHeight);
      gradient.addColorStop(0, renderSettings.backgroundColor);
      gradient.addColorStop(1, "#1f3037");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, imageWidth, imageHeight);
      drawPaperTexture(ctx, renderSettings.accentColor, imageWidth, imageHeight);
      drawSelectedImageTexture(ctx, renderSettings);
      return;
    }

    if (["blush", "sage", "sky", "lavender"].includes(renderSettings.backgroundStyle)) {
      const gradient = ctx.createLinearGradient(0, 0, imageWidth, imageHeight);
      gradient.addColorStop(0, "#fff7e8");
      gradient.addColorStop(0.42, renderSettings.backgroundColor);
      gradient.addColorStop(1, renderSettings.accentColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, imageWidth, imageHeight);
      drawPaperTexture(ctx, "#ffffff", imageWidth, imageHeight);
      drawSelectedImageTexture(ctx, renderSettings);
      return;
    }

    ctx.fillStyle = renderSettings.backgroundColor;
    ctx.fillRect(0, 0, imageWidth, imageHeight);

    if (renderSettings.backgroundStyle === "paper") {
      drawPaperTexture(ctx, renderSettings.accentColor, imageWidth, imageHeight);
    }

    if (renderSettings.backgroundStyle === "lined") {
      ctx.save();
      ctx.strokeStyle = renderSettings.accentColor;
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = Math.max(2, imageWidth / 720);

      for (let y = renderSettings.pagePadding + renderSettings.fontSize; y < imageHeight - renderSettings.pagePadding / 2; y += renderSettings.fontSize * renderSettings.lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(renderSettings.pagePadding * 0.78, y);
        ctx.lineTo(imageWidth - renderSettings.pagePadding * 0.78, y);
        ctx.stroke();
      }

      ctx.restore();
      drawPaperTexture(ctx, renderSettings.accentColor, imageWidth, imageHeight);
    }

    if (renderSettings.backgroundStyle === "grid") {
      ctx.save();
      ctx.strokeStyle = renderSettings.accentColor;
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = Math.max(2, imageWidth / 900);

      for (let x = renderSettings.pagePadding * 0.78; x < imageWidth; x += renderSettings.fontSize * 0.62) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, imageHeight);
        ctx.stroke();
      }

      for (let y = renderSettings.pagePadding * 0.78; y < imageHeight; y += renderSettings.fontSize * 0.62) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(imageWidth, y);
        ctx.stroke();
      }

      ctx.restore();
    }

    drawSelectedImageTexture(ctx, renderSettings);
  }

  function drawPreviewStickers(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    stickers: PreviewSticker[] = previewStickers,
  ) {
    stickers.forEach((sticker) => {
      if (
        sticker.faceMood !== undefined ||
        sticker.lookAt ||
        (sticker.redness ?? 0) > 0 ||
        (sticker.sleepiness ?? 0) > 0
      ) {
        drawCustomPreviewSticker(ctx, renderSettings, sticker);
        return;
      }

      drawGlyphDecoration(
        ctx,
        {
          expression: sticker.expression,
          id: sticker.id,
          kind: "googly-eyes",
          size: sticker.size,
          x: sticker.x,
          y: sticker.y,
        },
        0,
        0,
        renderSettings.canvasWidth,
        renderSettings.canvasWidth,
        renderSettings.canvasHeight,
      );
    });
  }

  function getPreviewStickerSeed(id: string, salt: number) {
    let seed = salt;

    for (let index = 0; index < id.length; index += 1) {
      seed = (seed * 31 + id.charCodeAt(index)) % 997;
    }

    return seed / 997;
  }

  function drawCustomPreviewSticker(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    sticker: PreviewSticker,
  ) {
    const centerX = sticker.x * renderSettings.canvasWidth;
    const centerY = sticker.y * renderSettings.canvasHeight;
    const targetX = sticker.lookAt ? sticker.lookAt.x * renderSettings.canvasWidth : null;
    const targetY = sticker.lookAt ? sticker.lookAt.y * renderSettings.canvasHeight : null;
    const radius = Math.max(1.6, sticker.size * renderSettings.canvasHeight);
    const eyeOffset = radius * 1.18;
    const leftEyeX = centerX - eyeOffset;
    const rightEyeX = centerX + eyeOffset;
    const outlineWidth = Math.max(0.9, radius * 0.13);
    const faceMood = Math.min(1, Math.max(-1, sticker.faceMood ?? 0));
    const hasFaceMood = sticker.faceMood !== undefined;
    const redness = Math.min(1, Math.max(0, sticker.redness ?? 0));
    const sleepiness = Math.min(1, Math.max(0, sticker.sleepiness ?? 0));

    ctx.save();
    ctx.lineWidth = outlineWidth;
    ctx.strokeStyle = "#17110b";
    ctx.fillStyle = "#fffdf4";
    ctx.lineJoin = "round";

    for (const eyeIndex of [0, 1]) {
      const eyeX = eyeIndex === 0 ? leftEyeX : rightEyeX;
      const randomX = (getPreviewStickerSeed(sticker.id, eyeIndex + 3) - 0.5) * radius * 0.48;
      const randomY = (getPreviewStickerSeed(sticker.id, eyeIndex + 11) - 0.5) * radius * 0.48;
      const dx = targetX === null ? null : targetX - eyeX;
      const dy = targetY === null ? null : targetY - centerY;
      const distance = dx === null || dy === null ? 1 : Math.max(1, Math.hypot(dx, dy));
      const pupilDistance = radius * 0.46;
      const pupilX = dx === null ? randomX : (dx / distance) * pupilDistance;
      const pupilY = dy === null ? randomY : (dy / distance) * pupilDistance;

      ctx.beginPath();
      ctx.arc(eyeX, centerY, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (redness > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(eyeX, centerY, radius * 0.92, 0, Math.PI * 2);
        ctx.clip();

        ctx.globalAlpha = 0.18 + redness * 0.28;
        ctx.fillStyle = "#c95454";
        ctx.beginPath();
        ctx.arc(eyeX, centerY, radius * 0.94, 0, Math.PI * 2);
        ctx.fill();

        for (let cloudIndex = 0; cloudIndex < 5; cloudIndex += 1) {
          const seedX = getPreviewStickerSeed(sticker.id, eyeIndex * 37 + cloudIndex * 13 + 19);
          const seedY = getPreviewStickerSeed(sticker.id, eyeIndex * 41 + cloudIndex * 17 + 23);
          const seedSize = getPreviewStickerSeed(sticker.id, eyeIndex * 43 + cloudIndex * 19 + 29);
          const cloudX = eyeX + (seedX - 0.5) * radius * 1.25;
          const cloudY = centerY + (seedY - 0.5) * radius * 1.05;
          const cloudRadius = radius * (0.18 + seedSize * 0.28) * (0.55 + redness * 0.55);

          ctx.globalAlpha = 0.12 + redness * 0.18;
          ctx.fillStyle = cloudIndex % 2 === 0 ? "#b63b42" : "#e28a83";
          ctx.beginPath();
          ctx.ellipse(cloudX, cloudY, cloudRadius * 1.35, cloudRadius, seedX * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.globalAlpha = 0.08 + redness * 0.22;
        ctx.strokeStyle = "#8f252b";
        ctx.lineWidth = Math.max(0.4, outlineWidth * 0.28);
        for (let veinIndex = 0; veinIndex < 3; veinIndex += 1) {
          const seed = getPreviewStickerSeed(sticker.id, eyeIndex * 47 + veinIndex * 11 + 31);
          const veinY = centerY + (seed - 0.5) * radius * 0.95;

          ctx.beginPath();
          ctx.moveTo(eyeX - radius * 0.72, veinY);
          ctx.quadraticCurveTo(
            eyeX - radius * 0.12,
            veinY + (seed - 0.5) * radius * 0.34,
            eyeX + radius * 0.68,
            veinY + (0.5 - seed) * radius * 0.2,
          );
          ctx.stroke();
        }

        ctx.restore();
        ctx.strokeStyle = "#17110b";
        ctx.lineWidth = outlineWidth;
        ctx.fillStyle = "#fffdf4";
      }

      ctx.fillStyle = "#17110b";
      ctx.beginPath();
      ctx.arc(eyeX + pupilX, centerY + pupilY, radius * 0.38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fffdf4";

      if (sleepiness > 0) {
        const topClose = sleepiness ** 0.85;
        const bottomClose = sleepiness ** 0.55;
        const closedLidY = centerY + radius * 0.18;
        const topOpenY = centerY - radius * 0.7;
        const bottomOpenY = centerY + radius * 0.76;
        const topLidCenterY = topOpenY + (closedLidY - topOpenY) * topClose;
        const bottomLidCenterY = bottomOpenY + (closedLidY - bottomOpenY) * bottomClose;
        const remainingLidGap = bottomLidCenterY - topLidCenterY;
        const isClosedLid = remainingLidGap <= radius * 0.02;
        const lidCurveLift = Math.min(
          radius * (0.16 + sleepiness * 0.08),
          remainingLidGap * 0.45,
        );
        const closedCurveLift = radius * 0.16;
        const drawBottomLidStroke = !isClosedLid && remainingLidGap > radius * 0.015;
        const topLidEdgeY = isClosedLid ? closedLidY : topLidCenterY - lidCurveLift * 0.5;
        const topLidControlY = isClosedLid ? closedLidY + closedCurveLift : topLidCenterY + lidCurveLift * 0.5;
        const bottomLidEdgeY = isClosedLid ? topLidEdgeY : bottomLidCenterY + lidCurveLift * 0.5;
        const bottomLidControlY = isClosedLid ? topLidControlY : bottomLidCenterY - lidCurveLift * 0.5;
        const lidLeftX = eyeX - radius * 0.99;
        const lidRightX = eyeX + radius * 0.99;

        ctx.save();
        ctx.beginPath();
        ctx.arc(eyeX, centerY, radius * 0.99, 0, Math.PI * 2);
        ctx.clip();

        ctx.fillStyle = "#efd8b4";
        ctx.beginPath();
        ctx.moveTo(lidLeftX, topLidEdgeY);
        ctx.quadraticCurveTo(eyeX, topLidControlY, lidRightX, topLidEdgeY);
        ctx.lineTo(lidRightX, centerY - radius * 1.06);
        ctx.lineTo(lidLeftX, centerY - radius * 1.06);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(lidLeftX, bottomLidEdgeY);
        ctx.quadraticCurveTo(eyeX, bottomLidControlY, lidRightX, bottomLidEdgeY);
        ctx.lineTo(lidRightX, centerY + radius * 1.06);
        ctx.lineTo(lidLeftX, centerY + radius * 1.06);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = "#17110b";
        ctx.lineWidth = Math.max(0.8, outlineWidth * 0.72);
        ctx.beginPath();
        ctx.moveTo(lidLeftX, topLidEdgeY);
        ctx.quadraticCurveTo(eyeX, topLidControlY, lidRightX, topLidEdgeY);
        ctx.stroke();

        if (drawBottomLidStroke) {
          ctx.beginPath();
          ctx.moveTo(lidLeftX, bottomLidEdgeY);
          ctx.quadraticCurveTo(eyeX, bottomLidControlY, lidRightX, bottomLidEdgeY);
          ctx.stroke();
        }
        ctx.restore();

        ctx.strokeStyle = "#17110b";
        ctx.lineWidth = outlineWidth;
        ctx.fillStyle = "#fffdf4";
      }
    }

    if (hasFaceMood) {
      const angry = Math.max(0, faceMood);
      const sad = Math.max(0, -faceMood);
      const moodAmount = Math.max(angry, sad);
      const browY = centerY - radius * (1.4 - angry * 0.04 + sad * 0.03);
      const browHalfWidth = radius * (0.74 + moodAmount * 0.16);
      const innerBrowDip = radius * 0.72 * angry;
      const angryOuterLift = radius * 0.32 * angry;
      const sadInnerLift = radius * 0.68 * sad;
      const sadOuterDrop = radius * 0.42 * sad;
      const neutralCurve = radius * 0.12;

      ctx.save();
      ctx.strokeStyle = "#17110b";
      ctx.lineWidth = Math.max(0.9, outlineWidth * (0.82 + moodAmount * 0.18));
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      const browPairs = [
        {
          controlX: leftEyeX,
          innerX: leftEyeX + browHalfWidth,
          outerX: leftEyeX - browHalfWidth,
          innerY: browY + innerBrowDip - sadInnerLift,
          outerY: browY - angryOuterLift + sadOuterDrop,
        },
        {
          controlX: rightEyeX,
          innerX: rightEyeX - browHalfWidth,
          outerX: rightEyeX + browHalfWidth,
          innerY: browY + innerBrowDip - sadInnerLift,
          outerY: browY - angryOuterLift + sadOuterDrop,
        },
      ];

      browPairs.forEach((brow) => {
        const browControlY = sad > angry
          ? Math.max(brow.outerY, brow.innerY) + radius * (0.14 + sad * 0.22)
          : Math.min(brow.outerY, brow.innerY) - neutralCurve * (1 + angry * 0.6);

        ctx.beginPath();
        ctx.moveTo(brow.outerX, brow.outerY);
        ctx.quadraticCurveTo(
          brow.controlX,
          browControlY,
          brow.innerX,
          brow.innerY,
        );
        ctx.stroke();
      });

      if (sad > 0.05) {
        let tearSourceY = centerY + radius * 0.96;
        let tearsFromLids = false;

        if (sleepiness > 0) {
          tearsFromLids = true;
          const topClose = sleepiness ** 0.85;
          const bottomClose = sleepiness ** 0.55;
          const closedLidY = centerY + radius * 0.18;
          const topOpenY = centerY - radius * 0.7;
          const bottomOpenY = centerY + radius * 0.76;
          const topLidCenterY = topOpenY + (closedLidY - topOpenY) * topClose;
          const bottomLidCenterY = bottomOpenY + (closedLidY - bottomOpenY) * bottomClose;
          const remainingLidGap = bottomLidCenterY - topLidCenterY;
          const lidCurveLift = Math.min(
            radius * (0.16 + sleepiness * 0.08),
            remainingLidGap * 0.45,
          );

          tearSourceY = remainingLidGap <= radius * 0.02
            ? closedLidY + radius * 0.03
            : bottomLidCenterY + lidCurveLift * 0.5;
        }

        const tearAlpha = 0.42 + sad * 0.52;
        const tearWidth = radius * (0.24 + sad * 0.42);

        ctx.save();
        ctx.globalAlpha = tearAlpha;
        ctx.strokeStyle = "#1f83a6";
        ctx.lineWidth = Math.max(0.7, outlineWidth * 0.34);

        [leftEyeX, rightEyeX].forEach((eyeX, eyeIndex) => {
          const streamX = eyeX + (eyeIndex === 0 ? -radius * 0.4 : radius * 0.4);
          const streamTop = tearsFromLids ? tearSourceY - radius * 0.02 : tearSourceY;
          const streamBottom = Math.max(
            streamTop + radius * (2.8 + sad * 2.2),
            renderSettings.canvasHeight - radius * 0.16,
          );
          const fallDistance = Math.max(radius, streamBottom - streamTop);
          const sideLean = (eyeIndex === 0 ? -1 : 1) * radius * 0.14 * sad;
          const sourceWidth = tearWidth * 0.42;
          const waterfallGradient = ctx.createLinearGradient(streamX, streamTop, streamX, streamBottom);

          waterfallGradient.addColorStop(0, "#b8f5ff");
          waterfallGradient.addColorStop(0.16, "#67cbe4");
          waterfallGradient.addColorStop(0.7, "#43b6da");
          waterfallGradient.addColorStop(1, "#2c99bf");
          ctx.fillStyle = waterfallGradient;

          ctx.beginPath();
          ctx.moveTo(streamX - sourceWidth, streamTop);
          ctx.bezierCurveTo(
            streamX - tearWidth * 1.42,
            streamTop + fallDistance * 0.18,
            streamX - tearWidth * 0.86 + sideLean,
            streamTop + fallDistance * 0.55,
            streamX - tearWidth * 1.22 + sideLean,
            streamBottom,
          );
          ctx.quadraticCurveTo(
            streamX + sideLean,
            streamBottom + radius * 0.42,
            streamX + tearWidth * 1.16 + sideLean,
            streamBottom,
          );
          ctx.bezierCurveTo(
            streamX + tearWidth * 0.76 + sideLean,
            streamTop + fallDistance * 0.52,
            streamX + tearWidth * 1.28,
            streamTop + fallDistance * 0.18,
            streamX + sourceWidth,
            streamTop,
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.globalAlpha = tearAlpha * 0.78;
          ctx.fillStyle = "#c7f0f8";
          ctx.strokeStyle = "#e5fbff";
          ctx.lineWidth = Math.max(0.45, outlineWidth * 0.18);

          for (let streakIndex = 0; streakIndex < 5; streakIndex += 1) {
            const streakSeed = getPreviewStickerSeed(sticker.id, eyeIndex * 67 + streakIndex * 11 + 41);
            const streakX = streamX + (streakIndex - 2) * tearWidth * 0.22 + sideLean * 0.35;

            ctx.beginPath();
            ctx.moveTo(streakX, streamTop + fallDistance * (0.03 + streakSeed * 0.07));
            ctx.quadraticCurveTo(
              streakX - tearWidth * (0.1 + streakSeed * 0.22),
              streamTop + fallDistance * 0.45,
              streakX + tearWidth * (0.04 + streakSeed * 0.18),
              streamBottom - radius * (0.6 + streakSeed * 0.8),
            );
            ctx.stroke();
          }

          ctx.globalAlpha = tearAlpha * 0.92;
          ctx.fillStyle = "#d9fbff";
          ctx.strokeStyle = "#e9feff";
          ctx.lineWidth = Math.max(0.5, outlineWidth * 0.2);

          for (let splashIndex = 0; splashIndex < 18; splashIndex += 1) {
            const splashSeed = getPreviewStickerSeed(sticker.id, eyeIndex * 71 + splashIndex * 13 + 47);
            const splashSpread = (splashIndex / 17 - 0.5) * tearWidth * 5.8;
            const splashJitter = (splashSeed - 0.5) * tearWidth * 1.35;
            const splashX = streamX + sideLean + splashSpread + splashJitter;
            const splashLift = radius * (0.35 + splashSeed * 2.05) * sad;
            const splashLean = (splashSeed - 0.5) * tearWidth * 2.05;

            ctx.beginPath();
            ctx.moveTo(splashX, streamBottom - radius * 0.05);
            ctx.quadraticCurveTo(
              splashX + splashLean * 0.45,
              streamBottom - splashLift,
              splashX + splashLean,
              streamBottom - radius * 0.04,
            );
            ctx.stroke();
          }

          ctx.globalAlpha = tearAlpha * 0.62;
          ctx.fillStyle = "#baf2fb";
          ctx.beginPath();
          ctx.ellipse(
            streamX + sideLean,
            streamBottom + radius * 0.02,
            tearWidth * 2.65,
            tearWidth * 0.42,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();

          ctx.globalAlpha = tearAlpha * 0.96;
          ctx.fillStyle = "#d9fbff";

          for (let foamIndex = 0; foamIndex < 22; foamIndex += 1) {
            const foamSeed = getPreviewStickerSeed(sticker.id, eyeIndex * 59 + foamIndex * 7 + 37);
            const foamSpread = (foamIndex / 21 - 0.5) * tearWidth * 6.2;
            const foamX = streamX + sideLean + foamSpread + (foamSeed - 0.5) * tearWidth * 1.15;
            const foamY = streamBottom - radius * (0.02 + foamSeed * 0.54);
            const foamScale = 0.12 + foamSeed * 0.34;

            ctx.beginPath();
            ctx.ellipse(foamX, foamY, tearWidth * foamScale, tearWidth * foamScale * 0.68, 0, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.globalAlpha = tearAlpha;
          ctx.strokeStyle = "#1f83a6";
        });

        ctx.restore();
      }

      const mouthY = centerY + radius * 1.72;
      const mouthHalfWidth = radius * (0.68 - angry * 0.18 + sad * 0.04);

      ctx.strokeStyle = "#17110b";
      ctx.lineWidth = Math.max(0.8, outlineWidth * 0.66);
      ctx.beginPath();
      if (angry > 0.02) {
        const scrunch = radius * (0.12 + angry * 0.2);

        ctx.moveTo(centerX - mouthHalfWidth, mouthY);
        ctx.quadraticCurveTo(centerX - mouthHalfWidth * 0.45, mouthY - scrunch, centerX, mouthY);
        ctx.quadraticCurveTo(centerX + mouthHalfWidth * 0.45, mouthY + scrunch * 0.72, centerX + mouthHalfWidth, mouthY - scrunch * 0.2);
      } else {
        const openSad = Math.min(1, Math.max(0, (sad - 0.72) / 0.28));

        if (openSad > 0) {
          const openWidth = radius * (0.34 + openSad * 0.24);
          const openHeight = radius * (0.28 + openSad * 0.44);
          const mouthTop = mouthY - openHeight * 0.44;
          const mouthBottom = mouthY + openHeight * 0.62;
          const leftCornerX = centerX - openWidth;
          const rightCornerX = centerX + openWidth;
          const leftCornerY = mouthY - radius * 0.08 * openSad;
          const rightCornerY = mouthY + radius * 0.04 * openSad;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(leftCornerX, leftCornerY);
          ctx.bezierCurveTo(
            centerX - openWidth * 0.72,
            mouthTop - radius * 0.12 * openSad,
            centerX + openWidth * 0.62,
            mouthTop + radius * 0.1 * openSad,
            rightCornerX,
            rightCornerY,
          );
          ctx.bezierCurveTo(
            centerX + openWidth * 0.58,
            mouthBottom + radius * 0.18 * openSad,
            centerX - openWidth * 0.66,
            mouthBottom,
            leftCornerX,
            leftCornerY,
          );
          ctx.closePath();
          ctx.stroke();
          ctx.clip();

          const toothCount = 6;
          const toothStep = (openWidth * 1.42) / toothCount;
          const toothBaseX = centerX - openWidth * 0.71;
          const missingTeeth = new Set([1, 4]);

          ctx.fillStyle = "#17110b";
          ctx.strokeStyle = "#17110b";
          ctx.lineWidth = Math.max(0.45, outlineWidth * 0.24);

          for (let toothIndex = 0; toothIndex < toothCount; toothIndex += 1) {
            if (missingTeeth.has(toothIndex)) {
              continue;
            }

            const toothSeed = getPreviewStickerSeed(sticker.id, toothIndex * 17 + 83);
            const toothX = toothBaseX + toothIndex * toothStep + toothStep * 0.1;
            const toothW = toothStep * (0.58 + toothSeed * 0.28);
            const toothH = radius * (0.18 + toothSeed * 0.22) * openSad;
            const toothTilt = (toothSeed - 0.5) * toothStep * 0.28;

            ctx.beginPath();
            ctx.moveTo(toothX, mouthTop + radius * 0.02);
            ctx.lineTo(toothX + toothW, mouthTop + radius * 0.03);
            ctx.lineTo(toothX + toothW * 0.82 + toothTilt, mouthTop + toothH);
            ctx.lineTo(toothX + toothW * 0.18 + toothTilt, mouthTop + toothH * (0.78 + toothSeed * 0.32));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          for (let lowerToothIndex = 0; lowerToothIndex < 3; lowerToothIndex += 1) {
            if (lowerToothIndex === 1) {
              continue;
            }

            const toothSeed = getPreviewStickerSeed(sticker.id, lowerToothIndex * 19 + 101);
            const toothX = centerX - openWidth * 0.32 + lowerToothIndex * openWidth * 0.31;
            const toothW = radius * (0.13 + toothSeed * 0.09);
            const toothH = radius * (0.12 + toothSeed * 0.12) * openSad;

            ctx.beginPath();
            ctx.moveTo(toothX, mouthBottom - radius * 0.04);
            ctx.lineTo(toothX + toothW, mouthBottom - radius * 0.03);
            ctx.lineTo(toothX + toothW * 0.72, mouthBottom - toothH);
            ctx.lineTo(toothX + toothW * 0.14, mouthBottom - toothH * (0.72 + toothSeed * 0.24));
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          ctx.restore();

          const droolStartX = rightCornerX - radius * 0.08;
          const droolStartY = rightCornerY + radius * 0.03;
          const droolLength = radius * (0.78 + openSad * 1.18);
          const droolWidth = radius * (0.07 + openSad * 0.08);
          const droolEndX = droolStartX + radius * 0.02 * openSad;
          const droolEndY = droolStartY + droolLength;

          ctx.save();
          ctx.globalAlpha = 0.72 + openSad * 0.22;
          ctx.fillStyle = "#c7f3dc";
          ctx.strokeStyle = "#4ebf9d";
          ctx.lineWidth = Math.max(0.55, outlineWidth * 0.22);
          ctx.beginPath();
          ctx.moveTo(droolStartX - droolWidth * 0.34, droolStartY);
          ctx.bezierCurveTo(
            droolStartX - droolWidth * 0.56,
            droolStartY + droolLength * 0.26,
            droolEndX - droolWidth * 0.5,
            droolStartY + droolLength * 0.72,
            droolEndX - droolWidth * 0.16,
            droolEndY,
          );
          ctx.bezierCurveTo(
            droolEndX + droolWidth * 0.52,
            droolStartY + droolLength * 0.72,
            droolStartX + droolWidth * 0.58,
            droolStartY + droolLength * 0.26,
            droolStartX + droolWidth * 0.28,
            droolStartY,
          );
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          ctx.globalAlpha = 0.86;
          ctx.fillStyle = "#e7fff2";
          ctx.beginPath();
          ctx.ellipse(
            droolEndX + droolWidth * 0.18,
            droolEndY + droolWidth * 0.15,
            droolWidth * 0.56,
            droolWidth * 0.74,
            0,
            0,
            Math.PI * 2,
          );
          ctx.fill();

          ctx.globalAlpha = 0.72;
          ctx.strokeStyle = "#f4fff8";
          ctx.lineWidth = Math.max(0.4, outlineWidth * 0.12);
          ctx.beginPath();
          ctx.moveTo(droolStartX + droolWidth * 0.1, droolStartY + droolLength * 0.14);
          ctx.quadraticCurveTo(
            droolStartX + droolWidth * 0.18,
            droolStartY + droolLength * 0.5,
            droolEndX + droolWidth * 0.04,
            droolEndY - droolWidth * 0.34,
          );
          ctx.stroke();
          ctx.restore();
          ctx.beginPath();
        } else {
          const frownDepth = radius * 0.58 * sad;
          const sadCornerDrop = radius * 0.12 * sad;

          ctx.moveTo(centerX - mouthHalfWidth, mouthY + sadCornerDrop);
          ctx.quadraticCurveTo(centerX, mouthY - frownDepth, centerX + mouthHalfWidth, mouthY + sadCornerDrop);
        }
      }
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawPreviewDoodles(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    doodleStrokes: PreviewDoodleStroke[] = previewDoodles,
  ) {
    doodleStrokes.forEach((stroke) => {
      if (stroke.points.length === 0) {
        return;
      }

      const renderStroke: GlyphStroke = {
        color: stroke.color,
        id: stroke.id,
        inkEffect: stroke.inkEffect,
        points: stroke.points,
        size: Math.max(0.001, stroke.size),
        strokeTool: stroke.tool === "quill" ? "quill" : "pen",
      };

      drawStrokePath(
        ctx,
        renderStroke,
        0,
        0,
        renderSettings.canvasWidth,
        renderSettings.canvasWidth,
        renderSettings.canvasHeight,
        stroke.color,
        {
          backgroundTexture: renderSettings.backgroundTexture,
          renderProfile: font.renderProfile,
        },
      );
    });
  }

  function drawPreviewDecorations(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    options: {
      doodleStrokes?: PreviewDoodleStroke[];
      stickers?: PreviewSticker[];
    } = {},
  ) {
    drawPreviewStickers(ctx, renderSettings, options.stickers);
    drawPreviewDoodles(ctx, renderSettings, options.doodleStrokes);
  }

  function getScaledPreviewSettings(settings: PreviewImageSettings, maxPixels: number): PreviewImageSettings {
    const sourcePixels = settings.canvasWidth * settings.canvasHeight;
    const scale = sourcePixels > maxPixels ? Math.sqrt(maxPixels / sourcePixels) : 1;

    if (scale >= 0.999) {
      return settings;
    }

    return {
      ...settings,
      canvasHeight: Math.max(1, Math.round(settings.canvasHeight * scale)),
      canvasWidth: Math.max(1, Math.round(settings.canvasWidth * scale)),
      fontSize: settings.fontSize * scale,
      letterSpacing: settings.letterSpacing * scale,
      pagePadding: settings.pagePadding * scale,
    };
  }

  function getPhoneImageLayout(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings = imageSettings,
  ): PhoneImageLayout {
    const maxLineWidth = Math.max(1, renderSettings.canvasWidth - renderSettings.pagePadding * 2);
    const headerFontSize = renderSettings.fontSize * HEADER_FONT_SIZE_MULTIPLIER;
    const hasHeaderText = headerPreviewText.trim().length > 0;
    ctx.font = getFallbackFont(headerFontSize);
    const headerLines = hasHeaderText
      ? renderSettings.autoFit
        ? buildWordWrappedLines(
            ctx,
            headerPreviewText,
            maxLineWidth,
            headerFontSize,
            renderSettings.letterSpacing,
            true,
            previewFont,
          )
        : buildCharacterWrappedLines(
            ctx,
            headerPreviewText,
            maxLineWidth,
            headerFontSize,
            renderSettings.letterSpacing,
            true,
            previewFont,
          )
      : [];
    const fontHeightScale = getFontHeightScale(font);
    const headerLineHeight = headerFontSize * renderSettings.lineSpacing * Math.max(0.72, fontHeightScale);
    const headerGap = headerLines.length > 0 ? renderSettings.fontSize * 0.85 : 0;
    const bodyStartY = renderSettings.pagePadding + headerLines.length * headerLineHeight + headerGap;
    ctx.font = getFallbackFont(renderSettings.fontSize);
    const wrappedLines = renderSettings.autoFit
      ? buildWordWrappedLines(ctx, previewText, maxLineWidth, renderSettings.fontSize, renderSettings.letterSpacing, false, previewFont)
      : buildCharacterWrappedLines(ctx, previewText, maxLineWidth, renderSettings.fontSize, renderSettings.letterSpacing, false, previewFont);
    const bodyLineHeight = renderSettings.fontSize * renderSettings.lineSpacing * Math.max(0.72, fontHeightScale);
    const bodyEndY = bodyStartY + wrappedLines.length * bodyLineHeight;

    return {
      settings: renderSettings,
      bodyEndY,
      bodyStartY,
      headerFontSize,
      headerLines,
      lines: wrappedLines,
    };
  }

  function getPreviewLayerFont(fontId: string) {
    return availableFonts.find((item) => item.id === fontId) ?? previewFont;
  }

  function drawPreviewTextLayers(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    startY: number,
  ) {
    let y = startY;
    const maxLineWidth = Math.max(1, renderSettings.canvasWidth - renderSettings.pagePadding * 2);

    previewTextLayers.forEach((layer) => {
      if (!layer.text.trim()) {
        return;
      }

      const layerFont = getPreviewLayerFont(layer.fontId);
      const layerFontSize = renderSettings.fontSize * layer.sizeScale;
      ctx.font = getFallbackFont(layerFontSize);
      const lines = renderSettings.autoFit
        ? buildWordWrappedLines(
            ctx,
            layer.text,
            maxLineWidth,
            layerFontSize,
            renderSettings.letterSpacing,
            false,
            layerFont,
          )
        : buildCharacterWrappedLines(
            ctx,
            layer.text,
            maxLineWidth,
            layerFontSize,
            renderSettings.letterSpacing,
            false,
            layerFont,
          );

      drawTextToCanvas(ctx, lines, renderSettings, {
        font: layerFont,
        fontSize: layerFontSize,
        sourceText: layer.text,
        startY: y,
      });

      y += lines.length * layerFontSize * renderSettings.lineSpacing * Math.max(0.72, getFontHeightScale(layerFont)) +
        renderSettings.fontSize * 0.35;
    });
  }

  function getPreviewTextLayerHitTargets(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    startY: number,
  ): PreviewTextLayerHitTarget[] {
    let y = startY;
    const maxLineWidth = Math.max(1, renderSettings.canvasWidth - renderSettings.pagePadding * 2);
    const targets: PreviewTextLayerHitTarget[] = [];

    previewTextLayers.forEach((layer) => {
      if (!layer.text.trim()) {
        return;
      }

      const layerFont = getPreviewLayerFont(layer.fontId);
      const layerFontSize = renderSettings.fontSize * layer.sizeScale;
      const lineHeight = layerFontSize * renderSettings.lineSpacing * Math.max(0.72, getFontHeightScale(layerFont));
      ctx.font = getFallbackFont(layerFontSize);
      const lines = renderSettings.autoFit
        ? buildWordWrappedLines(
            ctx,
            layer.text,
            maxLineWidth,
            layerFontSize,
            renderSettings.letterSpacing,
            false,
            layerFont,
          )
        : buildCharacterWrappedLines(
            ctx,
            layer.text,
            maxLineWidth,
            layerFontSize,
            renderSettings.letterSpacing,
            false,
            layerFont,
          );
      const height = Math.max(lineHeight, lines.length * lineHeight);

      targets.push({
        height,
        id: layer.id,
        width: maxLineWidth,
        x: renderSettings.pagePadding,
        y,
      });

      y += height + renderSettings.fontSize * 0.35;
    });

    return targets;
  }

  function drawPreviewSelectionOutlines(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    ctx.save();
    ctx.strokeStyle = "#82d0bc";
    ctx.fillStyle = "rgba(130, 208, 188, 0.08)";
    ctx.lineWidth = Math.max(2, renderSettings.canvasWidth / 480);
    ctx.setLineDash([Math.max(6, renderSettings.canvasWidth / 90), Math.max(4, renderSettings.canvasWidth / 140)]);

    const selectedSticker = selectedPreviewStickerId
      ? previewStickers.find((sticker) => sticker.id === selectedPreviewStickerId)
      : null;

    if (selectedSticker) {
      const x = selectedSticker.x * renderSettings.canvasWidth;
      const y = selectedSticker.y * renderSettings.canvasHeight;
      const radius = Math.max(22, selectedSticker.size * renderSettings.canvasWidth * 2.9);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    const selectedDoodle = selectedPreviewDoodleId
      ? previewDoodles.find((stroke) => stroke.id === selectedPreviewDoodleId)
      : null;

    if (selectedDoodle && selectedDoodle.points.length > 0) {
      const [firstPoint, ...restPoints] = selectedDoodle.points;
      ctx.beginPath();
      ctx.moveTo(firstPoint.x * renderSettings.canvasWidth, firstPoint.y * renderSettings.canvasHeight);
      restPoints.forEach((point) => {
        ctx.lineTo(point.x * renderSettings.canvasWidth, point.y * renderSettings.canvasHeight);
      });
      ctx.stroke();
    }

    if (selectedPreviewTextLayerId) {
      const textTargets = getPreviewTextLayerHitTargets(
        ctx,
        renderSettings,
        getPhoneImageLayout(ctx, renderSettings).bodyEndY + renderSettings.fontSize * 0.35,
      );
      const selectedTextTarget = textTargets.find((target) => target.id === selectedPreviewTextLayerId);

      if (selectedTextTarget) {
        ctx.fillRect(selectedTextTarget.x - 8, selectedTextTarget.y - 8, selectedTextTarget.width + 16, selectedTextTarget.height + 16);
        ctx.strokeRect(selectedTextTarget.x - 8, selectedTextTarget.y - 8, selectedTextTarget.width + 16, selectedTextTarget.height + 16);
      }
    }

    ctx.restore();
  }

  function drawPreviewContentToCanvas(
    ctx: CanvasRenderingContext2D,
    layout: PhoneImageLayout,
    options: {
      doodleStrokes?: PreviewDoodleStroke[];
      stickers?: PreviewSticker[];
    } = {},
  ) {
    drawTextToCanvas(ctx, layout.headerLines, layout.settings, {
      font: previewFont,
      fontSize: layout.headerFontSize,
      sourceText: headerPreviewText,
      startY: layout.settings.pagePadding,
      useHeaderLetters: true,
    });
    drawTextToCanvas(ctx, layout.lines, layout.settings, {
      font: previewFont,
      sourceText: previewText,
      startY: layout.bodyStartY,
    });
    drawPreviewTextLayers(ctx, layout.settings, layout.bodyEndY + layout.settings.fontSize * 0.35);
    drawPreviewDecorations(ctx, layout.settings, {
      doodleStrokes: options.doodleStrokes,
      stickers: options.stickers,
    });
  }

  function drawManuscriptInkInterruption(
    ctx: CanvasRenderingContext2D,
    layer: HTMLCanvasElement,
    renderSettings: PreviewImageSettings,
  ) {
    const soak = renderSettings.manuscriptInkSoak;

    if (soak <= 0.02) {
      return;
    }

    const fleckCanvas = document.createElement("canvas");
    fleckCanvas.width = layer.width;
    fleckCanvas.height = layer.height;
    const fleckCtx = fleckCanvas.getContext("2d");

    if (!fleckCtx) {
      return;
    }

    const fleckCount = Math.ceil((layer.width * layer.height) / 1800);
    fleckCtx.fillStyle = "#f6e8bf";

    for (let index = 0; index < fleckCount; index += 1) {
      const x = (index * 157) % layer.width;
      const y = (index * 89) % layer.height;
      const radius = Math.max(0.8, layer.width / 1800) * (0.45 + (index % 5) * 0.25);

      fleckCtx.globalAlpha = 0.05 + soak * 0.18 + (index % 3) * 0.02;
      fleckCtx.beginPath();
      fleckCtx.arc(x, y, radius, 0, Math.PI * 2);
      fleckCtx.fill();
    }

    fleckCtx.globalCompositeOperation = "destination-in";
    fleckCtx.drawImage(layer, 0, 0);

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.16 * soak;
    ctx.drawImage(fleckCanvas, 0, 0);
    ctx.restore();
  }

  function drawManuscriptInkLayer(
    ctx: CanvasRenderingContext2D,
    layer: HTMLCanvasElement,
    renderSettings: PreviewImageSettings,
  ) {
    const soak = renderSettings.manuscriptInkSoak;

    if (renderSettings.backgroundStyle !== "manuscript" || renderSettings.transparent) {
      ctx.drawImage(layer, 0, 0);
      return;
    }

    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.16 + soak * 0.28;
    ctx.filter = `blur(${Math.max(0.25, renderSettings.canvasWidth / 2400) * (0.5 + soak)}px)`;
    ctx.drawImage(layer, -Math.max(1, soak * 2), 0);
    ctx.drawImage(layer, Math.max(1, soak * 1.5), 0);
    ctx.drawImage(layer, 0, Math.max(1, soak * 1.3));

    ctx.filter = "none";
    ctx.globalAlpha = 0.72 + (1 - soak) * 0.18;
    ctx.drawImage(layer, 0, 0);
    ctx.restore();

    drawManuscriptInkInterruption(ctx, layer, renderSettings);
  }

  function renderPhoneImageToCanvas(
    canvas: HTMLCanvasElement,
    options: {
      doodleStrokes?: PreviewDoodleStroke[];
      renderSettings?: PreviewImageSettings;
      showSelection?: boolean;
      stickers?: PreviewSticker[];
    } = {},
  ) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const fittedLayout = getPhoneImageLayout(ctx, options.renderSettings ?? imageSettings);
    canvas.width = fittedLayout.settings.canvasWidth;
    canvas.height = fittedLayout.settings.canvasHeight;

    drawPreviewBackground(ctx, fittedLayout.settings);
    if (fittedLayout.settings.backgroundStyle === "manuscript" && !fittedLayout.settings.transparent) {
      const contentCanvas = document.createElement("canvas");
      contentCanvas.width = fittedLayout.settings.canvasWidth;
      contentCanvas.height = fittedLayout.settings.canvasHeight;
      const contentCtx = contentCanvas.getContext("2d");

      if (contentCtx) {
        drawPreviewContentToCanvas(contentCtx, fittedLayout, {
          doodleStrokes: options.doodleStrokes,
          stickers: options.stickers,
        });
        drawManuscriptInkLayer(ctx, contentCanvas, fittedLayout.settings);
      } else {
        drawPreviewContentToCanvas(ctx, fittedLayout, {
          doodleStrokes: options.doodleStrokes,
          stickers: options.stickers,
        });
      }
    } else {
      drawPreviewContentToCanvas(ctx, fittedLayout, {
        doodleStrokes: options.doodleStrokes,
        stickers: options.stickers,
      });
    }

    if (options.showSelection) {
      drawPreviewSelectionOutlines(ctx, fittedLayout.settings);
    }
  }

  function renderPhoneImage() {
    if (imageCanvasRef.current) {
      renderPhoneImageToCanvas(imageCanvasRef.current);
    }

    if (viewerCanvasRef.current) {
      renderPhoneImageToCanvas(viewerCanvasRef.current);
    }

    if (styleCanvasRef.current) {
      renderPhoneImageToCanvas(styleCanvasRef.current, {
        doodleStrokes: getActivePreviewDoodleStrokes(),
        renderSettings: getScaledPreviewSettings(imageSettings, STYLE_CANVAS_MAX_PIXELS),
        showSelection: true,
        stickers: previewStickersRef.current,
      });
    }
  }

  function getPhoneImageFileName() {
    return `${sanitizeFileName(font.name)}-${imageSettings.exportPreset}.png`;
  }

  function getPhoneImageBlob() {
    const canvas = imageCanvasRef.current;

    if (!canvas) {
      return Promise.resolve<Blob | null>(null);
    }

    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  function getPhoneImageDataUrl() {
    return imageCanvasRef.current?.toDataURL("image/png") ?? "";
  }

  async function shareNativePhoneImage() {
    const dataUrl = getPhoneImageDataUrl();
    const base64Data = dataUrl.split(",")[1];

    if (!base64Data) {
      setShareStatus("Could not make an image yet.");
      return false;
    }

    const fileName = getPhoneImageFileName();
    await shareNativeFile({
      base64Data,
      dialogTitle: "Share image",
      fileName,
      text: "Made in Local Font Studio",
      title: font.name,
    });

    setShareStatus("Share opened.");
    onRecordExport?.(`Shared ${imageSettings.exportPreset} preview PNG.`);
    return true;
  }

  function applyTextPreset(preset: (typeof previewPresets)[number]) {
    onHeaderPreviewTextChange("");
    onPreviewTextChange(preset.text);
    setPreviewTextLayers([]);
    setDocumentName(preset.label);
    setActiveDocumentId(null);
    setShareStatus(`Loaded ${preset.label}.`);
  }

  function applyExportPreset(presetId: ExportPresetId) {
    const preset = exportPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    setImageSettings((current) => ({
      ...current,
      ...preset.settings,
    }));
  }

  function savePreviewDocument() {
    const now = new Date().toISOString();
    const nextDocument: PreviewDocument = {
      headerText: headerPreviewText,
      id: activeDocumentId ?? createPreviewId(),
      name: documentName.trim() || "Untitled preview",
      settings: imageSettings,
      text: previewText,
      textLayers: previewTextLayers,
      updatedAt: now,
    };
    const nextDocuments = activeDocumentId
      ? savedDocuments.map((document) => (document.id === activeDocumentId ? nextDocument : document))
      : [nextDocument, ...savedDocuments].slice(0, 16);

    setActiveDocumentId(nextDocument.id);
    setSavedDocuments(nextDocuments);
    savePreviewDocuments(nextDocuments);
    setShareStatus("Saved preview document.");
  }

  function loadPreviewDocument(documentId: string) {
    const document = savedDocuments.find((item) => item.id === documentId);

    if (!document) {
      return;
    }

    setActiveDocumentId(document.id);
    setDocumentName(document.name);
    setImageSettings(normalizePreviewSettings(document.settings));
    onHeaderPreviewTextChange(document.headerText ?? "");
    onPreviewTextChange(document.text);
    setPreviewTextLayers(document.textLayers ?? []);
    setShareStatus(`Loaded ${document.name}.`);
  }

  function deletePreviewDocument(documentId: string) {
    const nextDocuments = savedDocuments.filter((document) => document.id !== documentId);

    setSavedDocuments(nextDocuments);
    savePreviewDocuments(nextDocuments);

    if (activeDocumentId === documentId) {
      setActiveDocumentId(null);
    }

    setShareStatus("Deleted preview document.");
  }

  async function downloadPhoneImage() {
    const canvas = imageCanvasRef.current;

    if (!canvas) {
      setShareStatus("Could not make an image yet.");
      return;
    }

    try {
      const imageDataUrl = canvas.toDataURL("image/png");
      const base64Data = imageDataUrl.split(",")[1];

      if (isNativeFilePlatform()) {
        if (!base64Data) {
          setShareStatus("Could not make an image yet.");
          return;
        }

        const fileName = getPhoneImageFileName();
        await saveNativeFileToDocuments({
          base64Data,
          fileName,
        });
        setShareStatus("Saved PNG to Documents / Local Font Studio.");
        onRecordExport?.(`Exported ${imageSettings.exportPreset} preview PNG.`);
        return;
      }

      const blob = await getPhoneImageBlob();

      if (!blob) {
        setShareStatus("Could not make an image yet.");
        return;
      }

      const savedLocally = onSaveImage?.({
        fontName: font.name,
        height: canvas.height,
        imageDataUrl,
        message: previewText.trim() || "(blank message)",
        width: canvas.width,
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getPhoneImageFileName();
      link.click();
      URL.revokeObjectURL(objectUrl);
      setShareStatus(savedLocally === false ? "Saved PNG. Could not add to Saved Images." : "Saved PNG.");
      onRecordExport?.(`Exported ${imageSettings.exportPreset} preview PNG.`);
    } catch {
      setShareStatus("Could not save the PNG.");
    }
  }

  async function sharePhoneImage() {
    if (isNativeFilePlatform()) {
      try {
        if (await shareNativePhoneImage()) {
          return;
        }
      } catch {
        setShareStatus("Android sharing did not work. Try Export PNG.");
        return;
      }
    }

    const blob = await getPhoneImageBlob();

    if (!blob) {
      setShareStatus("Could not make an image yet.");
      return;
    }

    const file = new File([blob], getPhoneImageFileName(), { type: "image/png" });
    const shareData: ShareData & { files?: File[] } = {
      files: [file],
      text: "Made in Local Font Studio",
      title: font.name,
    };

    try {
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setShareStatus("Share opened.");
        onRecordExport?.(`Shared ${imageSettings.exportPreset} preview PNG.`);
        return;
      }

      if (navigator.share) {
        await navigator.share({
          text: "Made in Local Font Studio",
          title: font.name,
        });
        setShareStatus("This browser shared the app text, but not the image file.");
        onRecordExport?.("Shared Local Font Studio preview text.");
        return;
      }

      await downloadPhoneImage();
      setShareStatus("Sharing is not supported here, so I saved the PNG.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setShareStatus("Share canceled.");
        return;
      }

      setShareStatus("Sharing did not work here. Try Save PNG.");
    }
  }

  function renderStyleColorInput({
    disabled = false,
    label,
    metric,
    value,
  }: {
    disabled?: boolean;
    label: string;
    metric: "accentColor" | "backgroundColor" | "inkColor";
    value: string;
  }) {
    return (
      <label className="style-color-card">
        <span>{label}</span>
        <input
          type="color"
          value={value}
          disabled={disabled}
          onChange={(event) =>
            setImageSettings((current) => ({
              ...current,
              [metric]: event.target.value,
              ...(metric === "backgroundColor" ? { transparent: false } : {}),
            }))
          }
        />
      </label>
    );
  }

  function selectStyleDoodleTool(tool: StyleDoodleTool) {
    setStyleDoodleTool(tool);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setStyleDrawMode(true);
    setShareStatus(`${tool === "quill" ? "Quill" : tool === "line" ? "Line" : "Pen"} doodle ready.`);
  }

  function addPreviewTextLayer() {
    const alternateFont = availableFonts.find((item) => item.id !== previewFont.id) ?? previewFont;

    setPreviewTextLayers((current) => [
      ...current,
      {
        fontId: alternateFont.id,
        id: createPreviewId(),
        sizeScale: 1,
        text: "additional text",
      },
    ]);
    setActiveDocumentId(null);
    setActiveStyleDrawer("text");
    setShareStatus("Added preview-only text layer.");
  }

  function updatePreviewTextLayer(layerId: string, patch: Partial<PreviewTextLayer>) {
    setPreviewTextLayers((current) =>
      current.map((layer) =>
        layer.id === layerId
          ? {
              ...layer,
              ...patch,
            }
          : layer,
      ),
    );
    setActiveDocumentId(null);
  }

  function removePreviewTextLayer(layerId: string) {
    setPreviewTextLayers((current) => current.filter((layer) => layer.id !== layerId));
    if (selectedPreviewTextLayerId === layerId) {
      setSelectedPreviewTextLayerId(null);
    }
    setActiveDocumentId(null);
    setShareStatus("Removed text layer.");
  }

  function deleteSelectedPreviewDoodle() {
    if (!selectedPreviewDoodleId) {
      setShareStatus("Select a doodle stroke first.");
      return;
    }

    setPreviewDoodles((current) => {
      const nextDoodles = current.filter((stroke) => stroke.id !== selectedPreviewDoodleId);
      previewDoodlesRef.current = nextDoodles;
      return nextDoodles;
    });
    setSelectedPreviewDoodleId(null);
    scheduleStyleCanvasRender();
    setShareStatus("Deleted doodle stroke.");
  }

  function getStyleSelectTargetLabel(target: StyleSelectTarget) {
    if (target === "stickers") {
      return "Stickers";
    }

    if (target === "text") {
      return "Text";
    }

    return "Doodle";
  }

  function renderStyleSelectTargetIcon(target: StyleSelectTarget) {
    if (target === "stickers") {
      return <Sticker aria-hidden="true" />;
    }

    if (target === "text") {
      return <TypeIcon aria-hidden="true" />;
    }

    return <PenLine aria-hidden="true" />;
  }

  function chooseStyleSelectTarget(target: StyleSelectTarget) {
    setStyleSelectTarget(target);
    setStyleSelectModeActive(true);
    setStyleSelectMenuOpen(false);
    setActiveStyleDrawer(null);
    setStyleDrawMode(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);

    if (target !== "stickers") {
      setSelectedPreviewStickerId(null);
    }

    if (target !== "text") {
      setSelectedPreviewTextLayerId(null);
    }

    if (target !== "doodles") {
      setSelectedPreviewDoodleId(null);
    }

    scheduleStyleCanvasRender();
    setShareStatus(`Tap ${getStyleSelectTargetLabel(target).toLowerCase()} on the page to select.`);
  }

  function renderStyleSelectDockIcon() {
    return (
      <span className="style-select-dock-icon" aria-hidden="true">
        <MousePointer2 />
        <span className="style-select-target-icon">{renderStyleSelectTargetIcon(styleSelectTarget)}</span>
      </span>
    );
  }

  function renderStyleSelectPopover() {
    if (!styleSelectMenuOpen) {
      return null;
    }

    return (
      <div className="style-select-popover" aria-label="Select target menu">
        {(["stickers", "text", "doodles"] as StyleSelectTarget[]).map((target) => (
          <button
            key={target}
            className={`draw-drawer-button ${styleSelectTarget === target ? "active-tool" : ""}`}
            type="button"
            aria-pressed={styleSelectTarget === target}
            onClick={() => chooseStyleSelectTarget(target)}
          >
            {renderStyleSelectTargetIcon(target)}
            <span>{getStyleSelectTargetLabel(target)}</span>
          </button>
        ))}
      </div>
    );
  }

  function resizeSelectedPreviewTextLayer(delta: number) {
    if (!selectedPreviewTextLayer) {
      setShareStatus("Select a text layer first.");
      return;
    }

    updatePreviewTextLayer(selectedPreviewTextLayer.id, {
      sizeScale: getSteppedValue(selectedPreviewTextLayer.sizeScale, delta, 0.55, 2, 2),
    });
    setShareStatus("Text size updated.");
  }

  function updateSelectedPreviewStickerSleepiness(value: number) {
    updateSelectedPreviewSticker((sticker) => ({
      ...sticker,
      sleepiness: Math.min(1, Math.max(0, value)),
    }));
    scheduleStyleCanvasRender();
    setActiveDocumentId(null);
    setShareStatus(`Eye sleepiness ${Math.round(value * 100)}%.`);
  }

  function updateSelectedPreviewStickerRedness(value: number) {
    updateSelectedPreviewSticker((sticker) => ({
      ...sticker,
      redness: Math.min(1, Math.max(0, value)),
    }));
    scheduleStyleCanvasRender();
    setActiveDocumentId(null);
    setShareStatus(`Eye redness ${Math.round(value * 100)}%.`);
  }

  function updateSelectedPreviewStickerFaceMood(value: number) {
    const nextMood = Math.min(1, Math.max(-1, value));

    updateSelectedPreviewSticker((sticker) => ({
      ...sticker,
      faceMood: nextMood,
    }));
    scheduleStyleCanvasRender();
    setActiveDocumentId(null);

    if (nextMood < -0.05) {
      setShareStatus(`Sad eyes ${Math.round(Math.abs(nextMood) * 100)}%.`);
      return;
    }

    if (nextMood > 0.05) {
      setShareStatus(`Angry eyes ${Math.round(nextMood * 100)}%.`);
      return;
    }

    setShareStatus("Neutral eyes.");
  }

  function getStickerFaceMoodLabel(value: number) {
    if (value < -0.05) {
      return `Sad ${Math.round(Math.abs(value) * 100)}%`;
    }

    if (value > 0.05) {
      return `Angry ${Math.round(value * 100)}%`;
    }

    return "Neutral";
  }

  function openSelectedTextLayerEditor() {
    if (!selectedPreviewTextLayer) {
      setShareStatus("Select a text layer first.");
      return;
    }

    setStyleSelectModeActive(false);
    setStyleSelectMenuOpen(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setStyleDrawMode(false);
    setActiveStyleDrawer("text");
    setShareStatus("Editing selected text.");
  }

  function renderStyleSelectionActions() {
    if (!styleSelectModeActive || styleSelectMenuOpen) {
      return null;
    }

    if (styleSelectTarget === "stickers" && selectedPreviewSticker) {
      return (
        <>
          {styleStickerSleepPanelOpen && (
            <label className="style-sticker-sleepiness-panel">
              <Moon aria-hidden="true" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedPreviewSticker.sleepiness ?? 0}
                onInput={(event) => updateSelectedPreviewStickerSleepiness(Number(event.currentTarget.value))}
                onChange={(event) => updateSelectedPreviewStickerSleepiness(Number(event.target.value))}
              />
              <output>{Math.round((selectedPreviewSticker.sleepiness ?? 0) * 100)}%</output>
            </label>
          )}
          {styleStickerRednessPanelOpen && (
            <label className="style-sticker-redness-panel">
              <Pipette aria-hidden="true" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={selectedPreviewSticker.redness ?? 0}
                onInput={(event) => updateSelectedPreviewStickerRedness(Number(event.currentTarget.value))}
                onChange={(event) => updateSelectedPreviewStickerRedness(Number(event.target.value))}
              />
              <output>{Math.round((selectedPreviewSticker.redness ?? 0) * 100)}%</output>
            </label>
          )}
          {styleStickerFacePanelOpen && (
            <label className="style-sticker-face-panel">
              <SlidersHorizontal aria-hidden="true" />
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={selectedPreviewSticker.faceMood ?? 0}
                onInput={(event) => updateSelectedPreviewStickerFaceMood(Number(event.currentTarget.value))}
                onChange={(event) => updateSelectedPreviewStickerFaceMood(Number(event.target.value))}
              />
              <output>{getStickerFaceMoodLabel(selectedPreviewSticker.faceMood ?? 0)}</output>
            </label>
          )}
          <div className="style-selection-action-row sticker-actions" aria-label="Selected sticker actions">
            <button
              className={`draw-drawer-button style-looking-button ${styleStickerLookMode ? "active-tool" : ""}`}
              type="button"
              aria-label="Looking at"
              onClick={() => {
                setStyleDrawMode(false);
                setStyleStickerMoveMode(false);
                setStyleStickerFacePanelOpen(false);
                setStyleStickerRednessPanelOpen(false);
                setStyleStickerSleepPanelOpen(false);
                setStyleStickerLookMode((current) => !current);
                setShareStatus(styleStickerLookMode ? "Looking target off." : "Tap the page where the eyes should look.");
              }}
            >
              <MousePointer2 aria-hidden="true" />
              <span>Looking at</span>
            </button>
            <button
              className={`draw-drawer-button ${styleStickerSleepPanelOpen ? "active-tool" : ""}`}
              type="button"
              aria-label="Sleepiness"
              onClick={() => {
                setStyleDrawMode(false);
                setStyleStickerLookMode(false);
                setStyleStickerMoveMode(false);
                setStyleStickerFacePanelOpen(false);
                setStyleStickerRednessPanelOpen(false);
                setStyleStickerSleepPanelOpen((current) => !current);
                setShareStatus(styleStickerSleepPanelOpen ? "Sleepiness closed." : "Adjust eye sleepiness.");
              }}
            >
              <Moon aria-hidden="true" />
              <span>Sleepiness</span>
            </button>
            <button
              className={`draw-drawer-button ${styleStickerRednessPanelOpen ? "active-tool" : ""}`}
              type="button"
              aria-label="Redness"
              onClick={() => {
                setStyleDrawMode(false);
                setStyleStickerLookMode(false);
                setStyleStickerMoveMode(false);
                setStyleStickerFacePanelOpen(false);
                setStyleStickerSleepPanelOpen(false);
                setStyleStickerRednessPanelOpen((current) => !current);
                setShareStatus(styleStickerRednessPanelOpen ? "Redness closed." : "Adjust cloudy eye redness.");
              }}
            >
              <Pipette aria-hidden="true" />
              <span>Redness</span>
            </button>
            <button
              className={`draw-drawer-button ${styleStickerFacePanelOpen ? "active-tool" : ""}`}
              type="button"
              aria-label="Eyebrows"
              onClick={() => {
                setStyleDrawMode(false);
                setStyleStickerLookMode(false);
                setStyleStickerMoveMode(false);
                setStyleStickerRednessPanelOpen(false);
                setStyleStickerSleepPanelOpen(false);

                if (!styleStickerFacePanelOpen && selectedPreviewSticker.faceMood === undefined) {
                  updateSelectedPreviewStickerFaceMood(0);
                }

                setStyleStickerFacePanelOpen((current) => !current);
                setShareStatus(styleStickerFacePanelOpen ? "Eyebrows closed." : "Adjust eye expression.");
              }}
            >
              <SlidersHorizontal aria-hidden="true" />
              <span>Eyebrows</span>
            </button>
            <button
              className={`draw-drawer-button ${styleStickerMoveMode ? "active-tool" : ""}`}
              type="button"
              onClick={() => {
                setStyleDrawMode(false);
                setStyleStickerLookMode(false);
                setStyleStickerFacePanelOpen(false);
                setStyleStickerRednessPanelOpen(false);
                setStyleStickerSleepPanelOpen(false);
                setStyleStickerMoveMode((current) => !current);
                setShareStatus(styleStickerMoveMode ? "Sticker move off." : "Drag selected eyes on the page.");
              }}
            >
              <Hand aria-hidden="true" />
              <span>Move</span>
            </button>
            <button className="draw-drawer-button" type="button" onClick={() => resizeSelectedPreviewSticker(0.004)}>
              <Plus aria-hidden="true" />
              <span>Bigger</span>
            </button>
            <button className="draw-drawer-button" type="button" onClick={() => resizeSelectedPreviewSticker(-0.004)}>
              <Minus aria-hidden="true" />
              <span>Smaller</span>
            </button>
            <button className="draw-drawer-button danger-action" type="button" onClick={deleteSelectedPreviewSticker}>
              <Trash2 aria-hidden="true" />
              <span>Delete</span>
            </button>
          </div>
        </>
      );
    }

    if (styleSelectTarget === "text" && selectedPreviewTextLayer) {
      return (
        <div className="style-selection-action-row" aria-label="Selected text actions">
          <button className="draw-drawer-button" type="button" onClick={openSelectedTextLayerEditor}>
            <TypeIcon aria-hidden="true" />
            <span>Edit</span>
          </button>
          <button className="draw-drawer-button" type="button" onClick={() => resizeSelectedPreviewTextLayer(0.05)}>
            <Plus aria-hidden="true" />
            <span>Bigger</span>
          </button>
          <button className="draw-drawer-button" type="button" onClick={() => resizeSelectedPreviewTextLayer(-0.05)}>
            <Minus aria-hidden="true" />
            <span>Smaller</span>
          </button>
          <button
            className="draw-drawer-button danger-action"
            type="button"
            onClick={() => removePreviewTextLayer(selectedPreviewTextLayer.id)}
          >
            <Trash2 aria-hidden="true" />
            <span>Delete</span>
          </button>
        </div>
      );
    }

    if (styleSelectTarget === "doodles" && selectedPreviewDoodle) {
      return (
        <div className="style-selection-action-row compact" aria-label="Selected doodle actions">
          <button className="draw-drawer-button danger-action" type="button" onClick={deleteSelectedPreviewDoodle}>
            <Trash2 aria-hidden="true" />
            <span>Delete</span>
          </button>
          <button
            className="draw-drawer-button"
            type="button"
            onClick={() => {
              previewDoodlesRef.current = [];
              setPreviewDoodles([]);
              setSelectedPreviewDoodleId(null);
              scheduleStyleCanvasRender();
              setShareStatus("Cleared doodle strokes.");
            }}
          >
            <Trash2 aria-hidden="true" />
            <span>Clear all</span>
          </button>
        </div>
      );
    }

    return null;
  }

  function renderStyleDockButton({
    drawer,
    icon,
    label,
  }: {
    drawer: Exclude<StyleDrawer, null>;
    icon: ReactNode;
    label: string;
  }) {
    const active = drawer === "doodle"
      ? activeStyleDrawer === "doodle" || styleDrawMode
      : drawer === "select"
        ? styleSelectModeActive || styleSelectMenuOpen
        : activeStyleDrawer === drawer;

    return (
      <button
        className={`draw-icon-button draw-glass-button style-dock-button ${active ? "active-tool" : ""}`}
        type="button"
        aria-label={label}
        aria-expanded={drawer === "select" ? styleSelectMenuOpen : activeStyleDrawer === drawer}
        title={label}
        onClick={() => {
          if (drawer === "select") {
            setStyleDrawMode(false);
            setStyleStickerLookMode(false);
            setStyleStickerMoveMode(false);
            setStyleStickerFacePanelOpen(false);
            setStyleStickerRednessPanelOpen(false);
            setStyleStickerSleepPanelOpen(false);
            setActiveStyleDrawer(null);
            setStyleSelectModeActive(true);
            setStyleSelectMenuOpen((current) => !current);
            return;
          }

          setStyleSelectMenuOpen(false);
          setStyleSelectModeActive(false);

          if (drawer === "doodle") {
            setStyleStickerLookMode(false);
            setStyleStickerMoveMode(false);
            setStyleStickerFacePanelOpen(false);
            setStyleStickerRednessPanelOpen(false);
            setStyleStickerSleepPanelOpen(false);
            toggleStyleDrawer("doodle");
            return;
          }

          setStyleDrawMode(false);
          setStyleStickerLookMode(false);
          setStyleStickerMoveMode(false);
          setStyleStickerFacePanelOpen(false);
          setStyleStickerRednessPanelOpen(false);
          setStyleStickerSleepPanelOpen(false);
          toggleStyleDrawer(drawer);
        }}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
  }

  function renderStyleStickerPreview(expression: EyeExpression) {
    return <PreviewEyeStickerPreview expression={expression} />;
  }

  function renderStyleDrawer() {
    if (!activeStyleDrawer) {
      return null;
    }

    if (activeStyleDrawer === "doodle") {
      return (
        <div className="draw-control-drawer style-control-drawer" aria-label="Doodle drawer">
          <div className="draw-drawer-grid three" aria-label="Doodle tool">
            <button
              className={`draw-drawer-button ${styleDoodleTool === "pen" ? "active-tool" : ""}`}
              type="button"
              onClick={() => selectStyleDoodleTool("pen")}
            >
              <PenLine aria-hidden="true" />
              <span>Pen</span>
            </button>
            <button
              className={`draw-drawer-button ${styleDoodleTool === "quill" ? "active-tool" : ""}`}
              type="button"
              onClick={() => selectStyleDoodleTool("quill")}
            >
              <Feather aria-hidden="true" />
              <span>Quill</span>
            </button>
            <button
              className={`draw-drawer-button ${styleDoodleTool === "line" ? "active-tool" : ""}`}
              type="button"
              onClick={() => selectStyleDoodleTool("line")}
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
              value={styleDoodleBrushSize}
              onChange={(event) => setStyleDoodleBrushSize(Number(event.target.value))}
            />
            <output>{styleDoodleBrushSize}px</output>
          </label>

          <div className="draw-drawer-grid two">
            <button
              className={`draw-drawer-button ${styleDrawMode ? "active-tool" : ""}`}
              type="button"
              onClick={() => {
                setStyleStickerMoveMode(false);
                setStyleDrawMode((current) => !current);
                setShareStatus(styleDrawMode ? "Doodle off." : "Draw doodles on the page.");
              }}
            >
              <PenLine aria-hidden="true" />
              <span>{styleDrawMode ? "Doodling" : "Doodle"}</span>
            </button>
            <button
              className="draw-drawer-button"
              type="button"
              disabled={previewDoodles.length === 0}
              onClick={() => {
                styleActiveDoodleRef.current = null;
                styleActiveStrokeRef.current = null;
                previewDoodlesRef.current = [];
                setPreviewDoodles([]);
                scheduleStyleCanvasRender();
                setShareStatus("Cleared doodles.");
              }}
            >
              <Trash2 aria-hidden="true" />
              <span>Clear</span>
            </button>
          </div>

          <div className="draw-ink-swatches style-ink-swatches" aria-label="Ink colors">
            {inkSwatches.map((swatch) => {
              const selected = isSelectedInkSwatch(imageSettings.inkColor, swatch);

              return (
                <button
                  key={swatch.label}
                  className={`draw-ink-swatch ${selected ? "selected" : ""}`}
                  type="button"
                  onClick={() => setImageSettings((current) => ({ ...current, inkColor: swatch.color }))}
                  aria-label={`Use ${swatch.label} ink`}
                  aria-pressed={selected}
                  title={swatch.label}
                >
                  <span style={{ backgroundColor: swatch.color }} />
                </button>
              );
            })}
          </div>

          <div className="draw-drawer-grid two" aria-label="Ink effects">
            <button
              className={`draw-drawer-button ${styleDoodleInkEffect === "subtleSpread" ? "active-tool" : ""}`}
              type="button"
              onClick={() =>
                setStyleDoodleInkEffect((current) => (current === "subtleSpread" ? "none" : "subtleSpread"))
              }
            >
              <Droplets aria-hidden="true" />
              <span>Ink spread</span>
            </button>
            <button
              className={`draw-drawer-button ${styleDoodleInkEffect === "dramaticPooling" ? "active-tool" : ""}`}
              type="button"
              onClick={() =>
                setStyleDoodleInkEffect((current) => (current === "dramaticPooling" ? "none" : "dramaticPooling"))
              }
            >
              <Droplets aria-hidden="true" />
              <span>Dramatic ink</span>
            </button>
          </div>

          <div className="draw-drawer-grid three" aria-label="Stroke smoothing">
            {styleDoodleSmoothingOptions.map((option) => (
              <button
                key={option.id}
                className={`draw-drawer-button ${styleDoodleSmoothing === option.id ? "active-tool" : ""}`}
                type="button"
                onClick={() => setStyleDoodleSmoothing(option.id)}
              >
                <SlidersHorizontal aria-hidden="true" />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeStyleDrawer === "page") {
      return (
        <div className="draw-control-drawer style-control-drawer" aria-label="Page drawer">
          <div className="style-color-card-grid">
            {renderStyleColorInput({
              disabled: imageSettings.transparent,
              label: "Page",
              metric: "backgroundColor",
              value: imageSettings.backgroundColor,
            })}
            {renderStyleColorInput({
              disabled: imageSettings.transparent,
              label: "Accent",
              metric: "accentColor",
              value: imageSettings.accentColor,
            })}
          </div>
          <label className="check-control style-toggle-control">
            <input
              type="checkbox"
              checked={imageSettings.transparent}
              onChange={(event) =>
                setImageSettings((current) => ({ ...current, transparent: event.target.checked }))
              }
            />
            Transparent background
          </label>
          <p className="style-label">Backgrounds</p>
          <div className="draw-background-presets style-background-presets" aria-label="Backgrounds">
            {backgroundPresets.map((preset) => (
              <button
                key={preset.id}
                className={`draw-background-preset ${
                  imageSettings.backgroundStyle === preset.id && !imageSettings.transparent ? "selected" : ""
                }`}
                type="button"
                disabled={imageSettings.transparent}
                onClick={() =>
                  setImageSettings((current) => ({
                    ...current,
                    accentColor: preset.accentColor,
                    backgroundColor: preset.backgroundColor,
                    backgroundStyle: preset.id,
                    backgroundTexture: preset.id === "manuscript" ? "clean" : current.backgroundTexture,
                    inkColor: preset.inkColor,
                    ...(preset.id === "manuscript"
                      ? {
                          manuscriptAge: 0.18,
                          manuscriptEdges: 0.38,
                          manuscriptFibers: 0.34,
                          manuscriptInkSoak: 0.42,
                          manuscriptRuling: 0,
                          manuscriptStains: 0.16,
                        }
                      : {}),
                    transparent: false,
                  }))
                }
                aria-label={`Use ${preset.label} background`}
                title={preset.label}
              >
                <span style={{ background: preset.preview }} />
              </button>
            ))}
          </div>
          {imageSettings.backgroundStyle === "manuscript" && !imageSettings.transparent && (
            <div className="manuscript-slider-grid" aria-label="Manuscript page controls">
              {renderManuscriptRange("Age", "manuscriptAge")}
              {renderManuscriptRange("Edges", "manuscriptEdges")}
              {renderManuscriptRange("Fiber", "manuscriptFibers")}
              {renderManuscriptRange("Stains", "manuscriptStains")}
              {renderManuscriptRange("Lines", "manuscriptRuling")}
              {renderManuscriptRange("Soak", "manuscriptInkSoak")}
            </div>
          )}
          <p className="style-label">Textures</p>
          <div className="draw-background-textures style-texture-presets" aria-label="Paper textures">
            {texturePresets.map((preset) => (
              <button
                key={preset.id}
                className={`draw-texture-preset ${imageSettings.backgroundTexture === preset.id ? "selected" : ""}`}
                type="button"
                onClick={() => setImageSettings((current) => ({ ...current, backgroundTexture: preset.id }))}
                aria-label={`Use ${preset.label} texture`}
                title={preset.label}
              >
                <span style={{ background: preset.preview }} />
                <strong>{preset.label}</strong>
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeStyleDrawer === "text") {
      return (
        <div className="draw-control-drawer style-control-drawer" aria-label="Text drawer">
          <button className="draw-drawer-button accent full" type="button" onClick={addPreviewTextLayer}>
            <Plus aria-hidden="true" />
            <span>Add text</span>
          </button>

          {previewTextLayers.length === 0 ? (
            <p className="style-drawer-empty">Add a preview-only text box to mix another saved font into this image.</p>
          ) : (
            <div className="style-text-layer-list">
              {previewTextLayers.map((layer, index) => (
                <div key={layer.id} className="style-text-layer-card">
                  <div className="style-text-layer-heading">
                    <strong>Text {index + 1}</strong>
                    <button
                      className="metric-default-button"
                      type="button"
                      onClick={() => removePreviewTextLayer(layer.id)}
                    >
                      Remove
                    </button>
                  </div>

                  <label className="style-text-layer-field">
                    <span>Font</span>
                    <select
                      value={layer.fontId}
                      onChange={(event) => updatePreviewTextLayer(layer.id, { fontId: event.target.value })}
                    >
                      {availableFonts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="draw-drawer-range">
                    <span>Size</span>
                    <input
                      type="range"
                      min="0.55"
                      max="2"
                      step="0.05"
                      value={layer.sizeScale}
                      onChange={(event) =>
                        updatePreviewTextLayer(layer.id, { sizeScale: Number(event.target.value) })
                      }
                    />
                    <output>{layer.sizeScale.toFixed(2)}x</output>
                  </label>

                  <textarea
                    className="style-text-layer-input"
                    aria-label={`Text layer ${index + 1}`}
                    value={layer.text}
                    onChange={(event) => updatePreviewTextLayer(layer.id, { text: event.target.value })}
                    spellCheck={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (activeStyleDrawer === "select") {
      return (
        <div className="draw-control-drawer style-control-drawer" aria-label="Select drawer">
          <div className="draw-drawer-grid three" aria-label="Selectable things">
            <button
              className={`draw-drawer-button ${styleSelectTarget === "stickers" ? "active-tool" : ""}`}
              type="button"
              onClick={() => {
                setStyleSelectTarget("stickers");
                setStyleStickerMoveMode(false);
                setShareStatus("Tap eyes on the page to select them.");
              }}
            >
              <Sticker aria-hidden="true" />
              <span>Stickers</span>
            </button>
            <button
              className={`draw-drawer-button ${styleSelectTarget === "text" ? "active-tool" : ""}`}
              type="button"
              onClick={() => {
                setStyleSelectTarget("text");
                setStyleStickerMoveMode(false);
                setShareStatus("Tap a text layer to select it.");
              }}
            >
              <TypeIcon aria-hidden="true" />
              <span>Text</span>
            </button>
            <button
              className={`draw-drawer-button ${styleSelectTarget === "doodles" ? "active-tool" : ""}`}
              type="button"
              onClick={() => {
                setStyleSelectTarget("doodles");
                setStyleStickerMoveMode(false);
                setShareStatus("Tap a doodle stroke to select it.");
              }}
            >
              <PenLine aria-hidden="true" />
              <span>Doodles</span>
            </button>
          </div>

          {styleSelectTarget === "stickers" && (
            <div className="style-select-edit-panel">
              <p className="style-drawer-empty">
                {selectedPreviewStickerId ? "Sticker selected." : "Tap an eye sticker on the page, or add eyes from Stickers."}
              </p>
              <button
                className={`draw-drawer-button full ${styleStickerMoveMode ? "active-tool" : ""}`}
                type="button"
                disabled={!selectedPreviewStickerId}
                onClick={() => {
                  setStyleDrawMode(false);
                  setStyleStickerMoveMode((current) => !current);
                  setShareStatus(styleStickerMoveMode ? "Sticker move off." : "Drag selected eyes on the page.");
                }}
              >
                <Hand aria-hidden="true" />
                <span>Move with hand</span>
              </button>
              <div className="draw-drawer-grid two">
                <button
                  className="draw-drawer-button"
                  type="button"
                  disabled={!selectedPreviewStickerId}
                  onClick={() => resizeSelectedPreviewSticker(0.004)}
                >
                  <Plus aria-hidden="true" />
                  <span>Bigger</span>
                </button>
                <button
                  className="draw-drawer-button"
                  type="button"
                  disabled={!selectedPreviewStickerId}
                  onClick={() => resizeSelectedPreviewSticker(-0.004)}
                >
                  <Minus aria-hidden="true" />
                  <span>Smaller</span>
                </button>
              </div>
              <button
                className="draw-drawer-button danger-action full"
                type="button"
                disabled={!selectedPreviewStickerId}
                onClick={deleteSelectedPreviewSticker}
              >
                <Trash2 aria-hidden="true" />
                <span>Delete sticker</span>
              </button>
            </div>
          )}

          {styleSelectTarget === "text" && (
            <div className="style-select-edit-panel">
              {previewTextLayers.length === 0 ? (
                <>
                  <p className="style-drawer-empty">No extra text layers yet.</p>
                  <button className="draw-drawer-button accent full" type="button" onClick={addPreviewTextLayer}>
                    <Plus aria-hidden="true" />
                    <span>Add text</span>
                  </button>
                </>
              ) : selectedPreviewTextLayer ? (
                <div className="style-text-layer-card">
                  <div className="style-text-layer-heading">
                    <strong>Selected text</strong>
                    <button
                      className="metric-default-button"
                      type="button"
                      onClick={() => removePreviewTextLayer(selectedPreviewTextLayer.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <label className="style-text-layer-field">
                    <span>Font</span>
                    <select
                      value={selectedPreviewTextLayer.fontId}
                      onChange={(event) =>
                        updatePreviewTextLayer(selectedPreviewTextLayer.id, { fontId: event.target.value })
                      }
                    >
                      {availableFonts.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="draw-drawer-range">
                    <span>Size</span>
                    <input
                      type="range"
                      min="0.55"
                      max="2"
                      step="0.05"
                      value={selectedPreviewTextLayer.sizeScale}
                      onChange={(event) =>
                        updatePreviewTextLayer(selectedPreviewTextLayer.id, { sizeScale: Number(event.target.value) })
                      }
                    />
                    <output>{selectedPreviewTextLayer.sizeScale.toFixed(2)}x</output>
                  </label>
                  <textarea
                    className="style-text-layer-input"
                    aria-label="Selected text layer"
                    value={selectedPreviewTextLayer.text}
                    onChange={(event) =>
                      updatePreviewTextLayer(selectedPreviewTextLayer.id, { text: event.target.value })
                    }
                    spellCheck={false}
                  />
                </div>
              ) : (
                <>
                  <p className="style-drawer-empty">Tap a text layer on the page, or choose one here.</p>
                  <div className="draw-drawer-grid two">
                    {previewTextLayers.map((layer, index) => (
                      <button
                        key={layer.id}
                        className="draw-drawer-button"
                        type="button"
                        onClick={() => {
                          setSelectedPreviewTextLayerId(layer.id);
                          scheduleStyleCanvasRender();
                        }}
                      >
                        <TypeIcon aria-hidden="true" />
                        <span>Text {index + 1}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {styleSelectTarget === "doodles" && (
            <div className="style-select-edit-panel">
              <p className="style-drawer-empty">
                {selectedPreviewDoodle ? "Doodle stroke selected." : "Tap a doodle stroke on the page to select it."}
              </p>
              <button
                className="draw-drawer-button danger-action full"
                type="button"
                disabled={!selectedPreviewDoodle}
                onClick={deleteSelectedPreviewDoodle}
              >
                <Trash2 aria-hidden="true" />
                <span>Delete stroke</span>
              </button>
              {previewDoodles.length > 0 && (
                <button
                  className="draw-drawer-button full"
                  type="button"
                  onClick={() => {
                    previewDoodlesRef.current = [];
                    setPreviewDoodles([]);
                    setSelectedPreviewDoodleId(null);
                    scheduleStyleCanvasRender();
                    setShareStatus("Cleared doodle strokes.");
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  <span>Clear doodles</span>
                </button>
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeStyleDrawer === "stickers") {
      return (
        <div className="draw-control-drawer style-control-drawer" aria-label="Sticker drawer">
          <div className="draw-drawer-grid style-sticker-grid">
            <button
              className="draw-drawer-button style-sticker-button style-eyes-button"
              type="button"
              aria-label="Drag eyes sticker onto page"
              draggable={false}
              onClick={(event) => event.preventDefault()}
              onPointerDown={(event) => beginStyleStickerDrag(event, previewStickerExpression)}
            >
              {renderStyleStickerPreview(previewStickerExpression)}
            </button>
          </div>
        </div>
      );
    }

    return null;
  }

  function getSteppedValue(value: number, delta: number, min: number, max: number, precision = 0) {
    const nextValue = Math.min(max, Math.max(min, value + delta));

    return Number(nextValue.toFixed(precision));
  }

  function updateImageMetric(
    metric: ImageMetricKey,
    delta: number,
    min: number,
    max: number,
    precision = 0,
  ) {
    setImageSettings((current) => ({
      ...current,
      [metric]: getSteppedValue(current[metric], delta, min, max, precision),
    }));
  }

  function updateManuscriptMetric(metric: ManuscriptMetricKey, value: number) {
    setImageSettings((current) => ({
      ...current,
      [metric]: Math.min(1, Math.max(0, value)),
    }));
  }

  function updateImageCanvasSize(deltaWidth: number) {
    setImageSettings((current) => {
      const requestedWidth = current.canvasWidth + deltaWidth;
      const requestedScale = requestedWidth / current.canvasWidth;
      const minScale = Math.max(
        MIN_IMAGE_CANVAS_WIDTH / current.canvasWidth,
        MIN_IMAGE_CANVAS_HEIGHT / current.canvasHeight,
      );
      const maxScale = Math.min(
        MAX_IMAGE_CANVAS_WIDTH / current.canvasWidth,
        MAX_IMAGE_CANVAS_HEIGHT / current.canvasHeight,
      );
      const scale = Math.min(maxScale, Math.max(minScale, requestedScale));

      return {
        ...current,
        canvasHeight: Math.round(current.canvasHeight * scale),
        canvasWidth: Math.round(current.canvasWidth * scale),
      };
    });
  }

  function getAverageGlyphMetric(metric: FontGlyphMetricKey) {
    if (fontGlyphs.length === 0) {
      return selectedGlyph[metric];
    }

    const total = fontGlyphs.reduce((sum, glyph) => sum + glyph[metric], 0);
    return total / fontGlyphs.length;
  }

  function updateFontMetric(
    metric: FontGlyphMetricKey,
    delta: number,
    min: number,
    max: number,
    precision = 2,
  ) {
    const currentValue =
      metric === "baselineOffset"
        ? previewFont.guideSettings?.baseline ?? getAverageGlyphMetric(metric)
        : getAverageGlyphMetric(metric);
    const nextValue = getSteppedValue(currentValue, delta, min, max, precision);

    setPreviewFontMetricOverrides((current) => ({
      ...current,
      [metric]: nextValue,
    }));

    if (metric === "baselineOffset") {
      setPreviewGuideSettings({
        ...previewFont.guideSettings,
        baseline: nextValue,
      });
    }

    setShareStatus("Preview-only font settings updated.");
  }

  function updateFontShapeMetric(
    metric: keyof FontShapeSettings,
    delta: number,
    min: number,
    max: number,
    precision = 2,
  ) {
    const currentShapeSettings = previewFont.shapeSettings ?? { heightScale: 1, widthScale: 1 };
    const nextValue = getSteppedValue(currentShapeSettings[metric], delta, min, max, precision);

    setPreviewShapeSettings({
      ...currentShapeSettings,
      [metric]: nextValue,
    });
    setShareStatus("Preview-only font shape updated.");
  }

  function updateSpacebarAdvance(delta: number) {
    const nextValue = getSteppedValue(previewSpacebarGlyph.xAdvance, delta, 0.18, 1.2, 2);

    setPreviewGlyphMetricOverrides((current) => ({
      ...current,
      [spacebar]: {
        ...(current[spacebar] ?? {}),
        xAdvance: nextValue,
      },
    }));
    setShareStatus("Preview-only spacebar updated.");
  }

  function updateSelectedLetterMetric(
    metric: LetterMetricKey,
    delta: number,
    min: number,
    max: number,
    precision = 2,
  ) {
    const nextValue = getSteppedValue(settingsGlyph[metric], delta, min, max, precision);

    setPreviewGlyphMetricOverrides((current) => ({
      ...current,
      [settingsGlyph.character]: {
        ...(current[settingsGlyph.character] ?? {}),
        [metric]: nextValue,
      },
    }));
    setShareStatus(`Preview-only "${settingsGlyphLabel}" settings updated.`);
  }

  function openSelectedLetterEditor() {
    setFullscreenSettingsMenuOpen(false);
    setImageViewerOpen(false);
    onSelectCharacter(settingsGlyph.character);
    setShareStatus(`Editing "${settingsGlyphLabel}".`);
  }

  function openHeaderLetterEditor() {
    setFullscreenSettingsMenuOpen(false);
    setImageViewerOpen(false);
    setActiveSettingsPanel("headerLetter");
    onSelectCharacter(headerEditorCharacter);
    setShareStatus(`Editing "${headerEditorLabel}".`);
  }

  function openStyleEditor() {
    setActiveStyleDrawer(null);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setStyleEditorOpen(true);
    setFullscreenSettingsMenuOpen(false);
  }

  function closeStyleEditor() {
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setStyleEditorOpen(false);
  }

  function toggleStyleDrawer(drawer: Exclude<StyleDrawer, null>) {
    setActiveStyleDrawer((current) => (current === drawer ? null : drawer));
  }

  function getEditablePreviewStickerId(stickers = previewStickers) {
    if (selectedPreviewStickerId && stickers.some((sticker) => sticker.id === selectedPreviewStickerId)) {
      return selectedPreviewStickerId;
    }

    return stickers.at(-1)?.id ?? null;
  }

  function updateSelectedPreviewSticker(updater: (sticker: PreviewSticker) => PreviewSticker) {
    const stickerId = getEditablePreviewStickerId();

    if (!stickerId) {
      setShareStatus("Add eyes first.");
      return;
    }

    setSelectedPreviewStickerId(stickerId);
    setPreviewStickers((current) => {
      const nextStickers = current.map((sticker) => (sticker.id === stickerId ? updater(sticker) : sticker));

      previewStickersRef.current = nextStickers;
      return nextStickers;
    });
  }

  function resizeSelectedPreviewSticker(delta: number) {
    updateSelectedPreviewSticker((sticker) => ({
      ...sticker,
      size: Math.min(0.07, Math.max(0.018, sticker.size + delta)),
    }));
  }

  function deleteSelectedPreviewSticker() {
    const stickerId = getEditablePreviewStickerId();

    if (!stickerId) {
      setShareStatus("Add eyes first.");
      return;
    }

    setPreviewStickers((current) => {
      const nextStickers = current.filter((sticker) => sticker.id !== stickerId);
      return nextStickers;
    });
    const nextSelectedStickerId = previewStickers.filter((sticker) => sticker.id !== stickerId).at(-1)?.id ?? null;
    setSelectedPreviewStickerId(nextSelectedStickerId);
    if (!nextSelectedStickerId) {
      setStyleStickerLookMode(false);
      setStyleStickerMoveMode(false);
      setStyleStickerFacePanelOpen(false);
      setStyleStickerRednessPanelOpen(false);
      setStyleStickerSleepPanelOpen(false);
    }
    setShareStatus("Deleted eye sticker.");
  }

  function addPreviewStickerAt(point: PreviewDoodlePoint, expression = previewStickerExpression) {
    const stickerId = createPreviewId();

    setPreviewStickers((current) => {
      const nextStickers = [
        ...current,
        {
          expression,
          id: stickerId,
          size: 0.03,
          x: point.x,
          y: point.y,
        },
      ];

      previewStickersRef.current = nextStickers;
      return nextStickers;
    });
    setSelectedPreviewStickerId(stickerId);
    setSelectedPreviewDoodleId(null);
    setSelectedPreviewTextLayerId(null);
    setActiveDocumentId(null);
    scheduleStyleCanvasRender();
    setShareStatus("Dropped eyes.");
  }

  function cancelStyleStickerDrag() {
    window.removeEventListener("pointermove", handleStyleStickerDragMove);
    window.removeEventListener("pointerup", handleStyleStickerDragEnd);
    window.removeEventListener("pointercancel", handleStyleStickerDragCancel);
    styleStickerDragRef.current = null;
    setStyleStickerDragPreview(null);
  }

  function handleStyleStickerDragMove(event: PointerEvent) {
    const drag = styleStickerDragRef.current;

    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    const isDragging = drag.isDragging || distance > 10;

    if (!isDragging) {
      return;
    }

    event.preventDefault();
    if (!drag.isDragging) {
      setShareStatus("Drag eyes onto the page.");
    }

    styleStickerDragRef.current = {
      ...drag,
      isDragging,
      x: event.clientX,
      y: event.clientY,
    };
    setStyleStickerDragPreview({
      expression: drag.expression,
      x: event.clientX,
      y: event.clientY,
    });
  }

  function handleStyleStickerDragEnd(event: PointerEvent) {
    const drag = styleStickerDragRef.current;

    if (!drag || event.pointerId !== drag.pointerId) {
      return;
    }

    window.removeEventListener("pointermove", handleStyleStickerDragMove);
    window.removeEventListener("pointerup", handleStyleStickerDragEnd);
    window.removeEventListener("pointercancel", handleStyleStickerDragCancel);
    styleStickerDragRef.current = null;
    setStyleStickerDragPreview(null);

    if (!drag.isDragging) {
      return;
    }

    const canvas = styleCanvasRef.current;

    if (!canvas) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const droppedOnCanvas =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;

    if (!droppedOnCanvas) {
      setShareStatus("Drop eyes on the page to add them.");
      return;
    }

    addPreviewStickerAt(getStyleCanvasPoint(canvas, event.clientX, event.clientY), drag.expression);
  }

  function handleStyleStickerDragCancel(event?: PointerEvent) {
    const drag = styleStickerDragRef.current;

    if (event && drag && event.pointerId !== drag.pointerId) {
      return;
    }

    cancelStyleStickerDrag();
  }

  function beginStyleStickerDrag(event: ReactPointerEvent<HTMLButtonElement>, expression: EyeExpression) {
    event.preventDefault();
    event.stopPropagation();
    cancelStyleStickerDrag();
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);

    styleStickerDragRef.current = {
      expression,
      isDragging: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
    };

    window.addEventListener("pointermove", handleStyleStickerDragMove, { passive: false });
    window.addEventListener("pointerup", handleStyleStickerDragEnd);
    window.addEventListener("pointercancel", handleStyleStickerDragCancel);
  }

  function clearPreviewDecorations() {
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    cancelStyleStickerDrag();
    previewDoodlesRef.current = [];
    previewStickersRef.current = [];
    setPreviewDoodles([]);
    setPreviewStickers([]);
    setSelectedPreviewStickerId(null);
    setShareStatus("Cleared stickers and doodles.");
  }

  function renderImageMetricControl({
    label,
    max,
    metric,
    min,
    precision = 0,
    step,
    value,
  }: {
    label: string;
    max: number;
    metric: ImageMetricKey;
    min: number;
    precision?: number;
    step: number;
    value: number;
  }) {
    const displayValue = precision > 0 ? value.toFixed(precision) : value.toString();

    return (
      <div className="phone-metric-stepper">
        <div className="phone-metric-readout">
          <span>{label}</span>
          <strong>{displayValue}</strong>
        </div>
        <div className="phone-metric-buttons">
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateImageMetric(metric, -step, min, max, precision)}
            aria-label={`Decrease ${label}`}
          >
            Down
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateImageMetric(metric, step, min, max, precision)}
            aria-label={`Increase ${label}`}
          >
            Up
          </button>
        </div>
      </div>
    );
  }

  function renderImageSizeControl() {
    return (
      <div className="phone-metric-stepper">
        <div className="phone-metric-readout">
          <span>Size</span>
          <strong>
            {imageSettings.canvasWidth}x{imageSettings.canvasHeight}
          </strong>
        </div>
        <div className="phone-metric-buttons">
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateImageCanvasSize(-80)}
            aria-label="Decrease Size"
          >
            Down
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateImageCanvasSize(80)}
            aria-label="Increase Size"
          >
            Up
          </button>
        </div>
      </div>
    );
  }

  function renderManuscriptRange(label: string, metric: ManuscriptMetricKey) {
    return (
      <label className="draw-drawer-range manuscript-range">
        <span>{label}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={imageSettings[metric]}
          onChange={(event) => updateManuscriptMetric(metric, Number(event.target.value))}
        />
        <output>{Math.round(imageSettings[metric] * 100)}%</output>
      </label>
    );
  }

  function renderLetterMetricControl({
    label,
    max,
    metric,
    min,
    precision = 2,
    step,
    value,
  }: {
    label: string;
    max: number;
    metric: LetterMetricKey;
    min: number;
    precision?: number;
    step: number;
    value: number;
  }) {
    const displayValue = precision > 0 ? value.toFixed(precision) : value.toString();

    return (
      <div className="phone-metric-stepper">
        <div className="phone-metric-readout">
          <span>{label}</span>
          <strong>{displayValue}</strong>
        </div>
        <div className="phone-metric-buttons">
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateSelectedLetterMetric(metric, -step, min, max, precision)}
            aria-label={`Decrease ${label} for ${settingsGlyphLabel}`}
          >
            Down
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateSelectedLetterMetric(metric, step, min, max, precision)}
            aria-label={`Increase ${label} for ${settingsGlyphLabel}`}
          >
            Up
          </button>
        </div>
      </div>
    );
  }

  function renderFontMetricControl({
    label,
    max,
    metric,
    min,
    precision = 2,
    step,
    value,
  }: {
    label: string;
    max: number;
    metric: FontGlyphMetricKey;
    min: number;
    precision?: number;
    step: number;
    value: number;
  }) {
    const displayValue = precision > 0 ? value.toFixed(precision) : value.toString();

    return (
      <div className="phone-metric-stepper">
        <div className="phone-metric-readout">
          <span>{label}</span>
          <strong>{displayValue}</strong>
        </div>
        <div className="phone-metric-buttons">
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateFontMetric(metric, -step, min, max, precision)}
            aria-label={`Decrease ${label}`}
          >
            Down
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateFontMetric(metric, step, min, max, precision)}
            aria-label={`Increase ${label}`}
          >
            Up
          </button>
        </div>
      </div>
    );
  }

  function renderFontShapeMetricControl({
    label,
    max,
    metric,
    min,
    precision = 2,
    step,
    value,
  }: {
    label: string;
    max: number;
    metric: keyof FontShapeSettings;
    min: number;
    precision?: number;
    step: number;
    value: number;
  }) {
    const displayValue = precision > 0 ? value.toFixed(precision) : value.toString();

    return (
      <div className="phone-metric-stepper">
        <div className="phone-metric-readout">
          <span>{label}</span>
          <strong>{displayValue}</strong>
        </div>
        <div className="phone-metric-buttons">
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateFontShapeMetric(metric, -step, min, max, precision)}
            aria-label={`Decrease ${label}`}
          >
            Down
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => updateFontShapeMetric(metric, step, min, max, precision)}
            aria-label={`Increase ${label}`}
          >
            Up
          </button>
        </div>
      </div>
    );
  }

  function setFullscreenSettings(panel: SettingsPanel) {
    setActiveSettingsPanel(panel);
    setFullscreenSettingsMenuOpen(false);
  }

  function closeFullscreenPreview() {
    setFullscreenSettingsMenuOpen(false);
    setImageViewerOpen(false);
  }

  function renderFullscreenSettingsMenu() {
    return (
      <div className="phone-image-fullscreen-menu" aria-label="Export image menu">
        <button
          className={`secondary-button compact-button ${activeSettingsPanel === "font" ? "active-tool" : ""}`}
          type="button"
          onClick={() => setFullscreenSettings("font")}
        >
          Font settings
        </button>
        <button
          className={`secondary-button compact-button ${activeSettingsPanel === "letter" ? "active-tool" : ""}`}
          type="button"
          onClick={() => setFullscreenSettings("letter")}
        >
          Letter settings
        </button>
        <button
          className={`secondary-button compact-button ${activeSettingsPanel === "headerLetter" ? "active-tool" : ""}`}
          type="button"
          onClick={() => setFullscreenSettings("headerLetter")}
        >
          Header Letter settings
        </button>
        <button
          className={`secondary-button compact-button ${activeSettingsPanel === "image" ? "active-tool" : ""}`}
          type="button"
          onClick={() => setFullscreenSettings("image")}
        >
          Image settings
        </button>
        <button
          className={`secondary-button compact-button ${activeSettingsPanel === "position" ? "active-tool" : ""}`}
          type="button"
          onClick={() => setFullscreenSettings("position")}
        >
          Position settings
        </button>
        <button className="secondary-button compact-button" type="button" onClick={openStyleEditor}>
          Style
        </button>
        <button
          className="primary-button compact-button"
          type="button"
          onClick={() => {
            setFullscreenSettingsMenuOpen(false);
            sharePhoneImage();
          }}
        >
          Share
        </button>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={() => {
            setFullscreenSettingsMenuOpen(false);
            downloadPhoneImage();
          }}
        >
          Export PNG
        </button>
      </div>
    );
  }

  function renderImageLayoutControls(className = "phone-image-tools preview-layout-tools") {
    return (
      <div className={className}>
        {renderImageSizeControl()}
        {renderImageMetricControl({
          label: "Width",
          max: MAX_IMAGE_CANVAS_WIDTH,
          metric: "canvasWidth",
          min: MIN_IMAGE_CANVAS_WIDTH,
          step: 80,
          value: imageSettings.canvasWidth,
        })}
        {renderImageMetricControl({
          label: "Height",
          max: MAX_IMAGE_CANVAS_HEIGHT,
          metric: "canvasHeight",
          min: MIN_IMAGE_CANVAS_HEIGHT,
          step: 80,
          value: imageSettings.canvasHeight,
        })}
        {renderImageMetricControl({
          label: "Spacing",
          max: 2,
          metric: "lineSpacing",
          min: 0.45,
          precision: 2,
          step: 0.03,
          value: imageSettings.lineSpacing,
        })}
        {renderImageMetricControl({
          label: "Letters",
          max: 96,
          metric: "letterSpacing",
          min: -48,
          step: 2,
          value: imageSettings.letterSpacing,
        })}
        {renderImageMetricControl({
          label: "Padding",
          max: 260,
          metric: "pagePadding",
          min: 0,
          step: 8,
          value: imageSettings.pagePadding,
        })}
      </div>
    );
  }

  function renderPositionSettingsControls(className = "alignment-row image-option-row") {
    return (
      <div className={className} aria-label="Position settings">
        {(["left", "center", "right"] as const).map((alignment) => (
          <button
            key={alignment}
            className={`secondary-button compact-button ${imageSettings.alignment === alignment ? "active-tool" : ""}`}
            type="button"
            onClick={() => setImageSettings((current) => ({ ...current, alignment }))}
          >
            {alignment}
          </button>
        ))}
        <label className="check-control">
          <input
            type="checkbox"
            checked={imageSettings.autoFit}
            onChange={(event) =>
              setImageSettings((current) => ({ ...current, autoFit: event.target.checked }))
            }
          />
          Fit
        </label>
      </div>
    );
  }

  function renderLetterSettingsControls(className = "phone-image-tools preview-layout-tools letter-settings-tools") {
    return (
      <div className={className} aria-label={settingsGlyphPanelLabel}>
        {renderLetterMetricControl({
          label: "Baseline",
          max: 1.2,
          metric: "baselineOffset",
          min: 0,
          step: 0.02,
          value: settingsGlyph.baselineOffset,
        })}
        {renderLetterMetricControl({
          label: "Width",
          max: 1.8,
          metric: "width",
          min: 0.35,
          step: 0.02,
          value: settingsGlyph.width,
        })}
        {renderLetterMetricControl({
          label: "Height",
          max: 1.8,
          metric: "height",
          min: 0.35,
          step: 0.02,
          value: settingsGlyph.height,
        })}
        {renderLetterMetricControl({
          label: "Advance",
          max: 2,
          metric: "xAdvance",
          min: 0.12,
          step: 0.02,
          value: settingsGlyph.xAdvance,
        })}
        {renderLetterMetricControl({
          label: "Left",
          max: 0.6,
          metric: "leftBearing",
          min: -0.5,
          step: 0.02,
          value: settingsGlyph.leftBearing,
        })}
        {renderLetterMetricControl({
          label: "Right",
          max: 0.6,
          metric: "rightBearing",
          min: -0.5,
          step: 0.02,
          value: settingsGlyph.rightBearing,
        })}
      </div>
    );
  }

  function renderFontSettingsControls(className = "phone-image-tools preview-layout-tools font-settings-tools") {
    return (
      <div className={className}>
        {renderFontMetricControl({
          label: "Baseline",
          max: 1.2,
          metric: "baselineOffset",
          min: 0,
          step: 0.02,
          value: previewFont.guideSettings?.baseline ?? getAverageGlyphMetric("baselineOffset"),
        })}
        {renderFontShapeMetricControl({
          label: "Width",
          max: 1.6,
          metric: "widthScale",
          min: 0.55,
          step: 0.05,
          value: previewFont.shapeSettings?.widthScale ?? 1,
        })}
        {renderFontMetricControl({
          label: "Advance",
          max: 2,
          metric: "xAdvance",
          min: 0.18,
          step: 0.02,
          value: getAverageGlyphMetric("xAdvance"),
        })}
        {renderFontMetricControl({
          label: "Left",
          max: 0.6,
          metric: "leftBearing",
          min: -0.4,
          step: 0.02,
          value: getAverageGlyphMetric("leftBearing"),
        })}
        {renderFontMetricControl({
          label: "Right",
          max: 0.6,
          metric: "rightBearing",
          min: -0.4,
          step: 0.02,
          value: getAverageGlyphMetric("rightBearing"),
        })}
        <div className="phone-metric-stepper">
          <div className="phone-metric-readout">
            <span>Spacebar</span>
            <strong>{previewSpacebarGlyph.xAdvance.toFixed(2)}</strong>
          </div>
          <div className="phone-metric-buttons">
            <button
              className="secondary-button"
              type="button"
              onClick={() => updateSpacebarAdvance(-0.02)}
              aria-label="Decrease spacebar"
            >
              Down
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => updateSpacebarAdvance(0.02)}
              aria-label="Increase spacebar"
            >
              Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderPreviewTextMenu() {
    return (
      <details className="sidebar-dropdown preview-text-dropdown">
        <summary>
          <span>Preview Text</span>
          <strong>{savedGlyphCount} saved</strong>
        </summary>

        <div className="sidebar-preview-controls">
          <div className="preview-preset-grid" aria-label="Preview presets">
            {previewPresets.map((preset) => (
              <button key={preset.id} className="secondary-button compact-button" type="button" onClick={() => applyTextPreset(preset)}>
                {preset.label}
              </button>
            ))}
          </div>

          <div className="preview-document-tools" aria-label="Preview documents">
            <input
              aria-label="Preview document name"
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
            />
            <button className="primary-button compact-button" type="button" onClick={savePreviewDocument}>
              Save doc
            </button>
          </div>

          {savedDocuments.length > 0 && (
            <div className="preview-document-list" aria-label="Saved preview documents">
              {savedDocuments.map((document) => (
                <div key={document.id} className={`preview-document-card ${activeDocumentId === document.id ? "selected" : ""}`}>
                  <button type="button" onClick={() => loadPreviewDocument(document.id)}>
                    <strong>{document.name}</strong>
                    <span>{document.text.slice(0, 42) || "(blank)"}</span>
                  </button>
                  <button className="metric-default-button" type="button" onClick={() => deletePreviewDocument(document.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>
    );
  }

  function renderPreviewTextBox(className = "preview-input phone-text-input") {
    return (
      <textarea
        className={className}
        aria-label="Preview text"
        value={previewText}
        onChange={(event) => {
          onPreviewTextChange(event.target.value);
          setActiveDocumentId(null);
        }}
        spellCheck={false}
      />
    );
  }

  function renderHeaderPreviewTextBox(className = "preview-input phone-text-input phone-header-text-input") {
    return (
      <textarea
        className={className}
        aria-label="Header letters"
        placeholder="Header letters"
        value={headerPreviewText}
        onChange={(event) => {
          onHeaderPreviewTextChange(event.target.value);
          setActiveDocumentId(null);
        }}
        spellCheck={false}
      />
    );
  }

  return (
    <>
      {previewMenuRoot ? createPortal(renderPreviewTextMenu(), previewMenuRoot) : null}

      <section
        id="preview-panel"
        className="studio-panel preview-panel phone-generator-panel"
        aria-label="Preview image"
      >
        <div className="panel-heading preview-dashboard-heading">
          <div>
            <p className="eyebrow">Export</p>
            <h2>Preview image</h2>
          </div>
          <div className="preview-summary-pill">
            {imageSettings.canvasWidth}x{imageSettings.canvasHeight}
          </div>
        </div>

      <div className="export-preset-grid" aria-label="Export presets">
        {exportPresets.map((preset) => (
          <button
            key={preset.id}
            className={`secondary-button compact-button ${imageSettings.exportPreset === preset.id ? "active-tool" : ""}`}
            type="button"
            onClick={() => applyExportPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="phone-image-actions">
        <button className="primary-button compact-button" type="button" onClick={sharePhoneImage}>
          Share
        </button>
        <button className="secondary-button compact-button" type="button" onClick={downloadPhoneImage}>
          Export PNG
        </button>
      </div>
      <div className="header-letter-input-group">
        {renderHeaderPreviewTextBox("preview-input phone-text-input phone-image-text-input phone-header-text-input")}
        <button
          className="secondary-button compact-button header-letter-draw-button"
          type="button"
          onClick={openHeaderLetterEditor}
          aria-label={`Draw ${headerEditorLabel}`}
        >
          <PenLine aria-hidden="true" />
          <span>Draw {headerEditorLabel}</span>
        </button>
      </div>
      {renderPreviewTextBox("preview-input phone-text-input phone-image-text-input")}
      <div className="share-status" aria-live="polite">
        {shareStatus}
      </div>

      <button
        className={`phone-image-preview phone-image-open-button ${imageSettings.transparent ? "transparent-preview" : ""}`}
        type="button"
        aria-label="Open preview image full screen"
        onClick={() => setImageViewerOpen(true)}
      >
        <canvas
          ref={imageCanvasRef}
          className="phone-image-canvas"
          aria-label="Generated preview image"
        />
      </button>

      {styleEditorOpen && (
        <section className="studio-panel phone-style-fullscreen" aria-label="Preview style editor">
          <div className="panel-heading phone-style-heading">
            <div>
              <p className="eyebrow">Preview style</p>
              <h2>{styleStickerMoveMode ? "Move sticker" : styleDrawMode ? "Doodle" : activeStyleDrawer === "text" ? "Text" : styleSelectModeActive || styleSelectMenuOpen ? "Select" : "Style"}</h2>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={closeStyleEditor}>
              Close
            </button>
          </div>

          <div className={`phone-image-preview phone-style-preview ${imageSettings.transparent ? "transparent-preview" : ""}`}>
            <canvas
              ref={styleCanvasRef}
              className={`phone-image-canvas ${styleDrawMode ? "drawing-enabled" : ""} ${
                styleStickerMoveMode ? "moving-sticker-enabled" : ""
              }`}
              aria-label="Generated preview style image"
              onPointerDown={handleStyleCanvasPointerDown}
              onPointerMove={handleStyleCanvasPointerMove}
              onPointerUp={handleStyleCanvasPointerEnd}
              onPointerCancel={handleStyleCanvasPointerEnd}
              onPointerLeave={handleStyleCanvasPointerEnd}
            />
          </div>

          <div className="phone-style-dock" aria-label="Preview style controls">
            {renderStyleDrawer()}
            {renderStyleSelectPopover()}
            {renderStyleSelectionActions()}
            <div className="phone-style-toolbar">
              {renderStyleDockButton({
                drawer: "doodle",
                icon: styleDrawMode ? <Sparkles aria-hidden="true" /> : <Brush aria-hidden="true" />,
                label: "Doodle",
              })}
              {renderStyleDockButton({
                drawer: "page",
                icon: <ImageIcon aria-hidden="true" />,
                label: "Page",
              })}
              {renderStyleDockButton({
                drawer: "text",
                icon: <TypeIcon aria-hidden="true" />,
                label: "Text",
              })}
              {renderStyleDockButton({
                drawer: "stickers",
                icon: <Sticker aria-hidden="true" />,
                label: "Stickers",
              })}
              {renderStyleDockButton({
                drawer: "select",
                icon: renderStyleSelectDockIcon(),
                label: "Select",
              })}
            </div>
          </div>

          {styleStickerDragPreview && (
            <div
              className="style-sticker-drag-preview"
              style={{
                left: `${styleStickerDragPreview.x}px`,
                top: `${styleStickerDragPreview.y}px`,
              }}
              aria-hidden="true"
            >
              {renderStyleStickerPreview(styleStickerDragPreview.expression)}
            </div>
          )}
        </section>
      )}

      {imageViewerOpen && (
        <section className="studio-panel phone-image-fullscreen" aria-label="Full screen preview image">
          <div className="panel-heading phone-image-fullscreen-heading">
            <div className="phone-image-menu-wrap">
              <button
                className={`secondary-button compact-button phone-image-menu-button ${fullscreenSettingsMenuOpen ? "active-tool" : ""}`}
                type="button"
                aria-expanded={fullscreenSettingsMenuOpen}
                aria-label="Open export image settings"
                onClick={() => setFullscreenSettingsMenuOpen((open) => !open)}
              >
                <span className="hamburger-lines" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
              {fullscreenSettingsMenuOpen && renderFullscreenSettingsMenu()}
            </div>
            <div
              className={`phone-image-active-settings ${
                activeSettingsPanel === "letter" || activeSettingsPanel === "headerLetter"
                  ? "phone-letter-heading-settings"
                  : ""
              }`}
              aria-live="polite"
            >
              {activeSettingsPanel === "letter" || activeSettingsPanel === "headerLetter" ? (
                <>
                  <span>{settingsGlyphPanelLabel}</span>
                  <strong className={settingsGlyphIsHeader ? "header-letter-chip" : ""}>
                    {settingsGlyphLabel}
                  </strong>
                  <button className="secondary-button compact-button" type="button" onClick={openSelectedLetterEditor}>
                    Draw letter
                  </button>
                </>
              ) : (
                settingsPanelLabels[activeSettingsPanel]
              )}
            </div>
            <button className="secondary-button compact-button" type="button" onClick={closeFullscreenPreview}>
              Close
            </button>
          </div>

          <div className={`phone-image-fullscreen-surface ${imageSettings.transparent ? "transparent-preview" : ""}`}>
            <canvas
              ref={viewerCanvasRef}
              className="phone-image-canvas phone-image-fullscreen-canvas"
              aria-label="Full screen generated preview image"
              onPointerDown={handleFullscreenPreviewPointerDown}
              onPointerUp={handleFullscreenPreviewPointerUp}
            />
          </div>

          <div className="phone-image-fullscreen-settings">
            {activeSettingsPanel === "font" &&
              renderFontSettingsControls("phone-image-fullscreen-tools preview-layout-tools font-settings-tools")}
            {(activeSettingsPanel === "letter" || activeSettingsPanel === "headerLetter") &&
              renderLetterSettingsControls("phone-image-fullscreen-tools preview-layout-tools letter-settings-tools")}
            {activeSettingsPanel === "image" &&
              renderImageLayoutControls("phone-image-fullscreen-tools preview-layout-tools")}
            {activeSettingsPanel === "position" &&
              renderPositionSettingsControls("alignment-row image-option-row phone-image-fullscreen-options")}
          </div>
        </section>
      )}
      </section>
    </>
  );
}
