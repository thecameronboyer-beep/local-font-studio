import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CSSProperties,
  FormEvent as ReactFormEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {
  AlignHorizontalSpaceAround,
  AlignVerticalSpaceAround,
  ArrowLeftToLine,
  ArrowRightToLine,
  Baseline,
  Check,
  ChevronDown,
  Droplets,
  Feather,
  Hand,
  Menu,
  Minus,
  Moon,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  PenLine,
  Pipette,
  Plus,
  Ruler,
  RotateCcw,
  Scaling,
  Sparkles,
  Sticker,
  SlidersHorizontal,
  Space,
  Trash2,
  Type as TypeIcon,
} from "lucide-react";
import {
  canUseHeaderLetter,
  getCharacterLabel,
  getHeaderLetter,
  getVisibleCharacters,
  isHeaderLetter,
  spacebar,
} from "../data/characterSets";
import {
  getDefaultFontPaletteTheme,
  getFontPalette,
  paletteBackgroundPresets,
  paletteInkSwatches,
} from "../data/palettes";
import {
  fontPresets,
  getFontPresetById,
  getFontPresetCanvasFont,
  getFontPresetFromOptionId,
  getFontPresetOptionId,
} from "../data/fontPresets";
import type { FontPreset } from "../data/fontPresets";
import type {
  AppliedLetterMetricOverrides,
  BackgroundStyle,
  BackgroundTexture,
  FontGuideSettings,
  FontHomeSectionId,
  FontSpacingApplyDraft,
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
import { defaultGlyphMetrics, defaultSpacebarMetrics } from "../storage/fontStorage";
import type { CompiledPage, SaveRenderedQuillPageInput } from "../storage/quillWorkspaceStorage";
import { isNativeFilePlatform, saveNativeFileToDocuments, shareNativeFile } from "../utils/nativeFiles";

type SavedPreviewImage = {
  fontName: string;
  height: number;
  imageDataUrl: string;
  message: string;
  width: number;
};

type AutoBookEntryRenderRequest = {
  bookId: string;
  entries: Array<{
    currentPageId?: string;
    currentPageText?: string;
    kind: "story" | "changelog";
    nextPageNumber: number;
    pageNumber: number;
    pageTitle: string;
    presetId?: string;
    text: string;
  }>;
  requestId: number;
};

type AutoBookEntryRenderResult = {
  bookId: string;
  entries: Array<{
    fallbackUsed: boolean;
    kind: "story" | "changelog";
    page: CompiledPage;
    pageNumber: number;
    rolledOver: boolean;
  }>;
  requestId: number;
};

type TextPreviewProps = {
  autoEntryRequest?: AutoBookEntryRenderRequest | null;
  composeFullscreenOnly?: boolean;
  designPresetApplyRequestId?: number;
  designPresetIdToApply?: string;
  font: FontSet;
  fonts: FontSet[];
  onOpenAppMenu?: () => void;
  onCreatePresetFont: (presetFontId: string) => void;
  onDesignPresetsChange?: (presets: PreviewDesignPresetSummary[], activePresetId?: string) => void;
  onAutoEntryRenderComplete?: (result: AutoBookEntryRenderResult) => void;
  onRecordExport?: (message: string) => void;
  onSaveImage?: (image: SavedPreviewImage) => boolean;
  onSaveRenderedPage?: (page: SaveRenderedQuillPageInput) => Promise<CompiledPage>;
  onApplyFontSpacing: (settings: FontSpacingApplyDraft) => void;
  onOpenCharacterEditor: (character: string) => void;
  onSelectCharacter: (character: string) => void;
  onSelectFont: (fontId: string) => void;
  headerPreviewText: string;
  onHeaderPreviewTextChange: (text: string) => void;
  visibleHomeSections: Record<FontHomeSectionId, boolean>;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
  presetBuilderRequestId?: number;
  selectedGlyph: Glyph;
  spacebarGlyph: Glyph;
};

type ExportPresetId = "custom" | "landscape" | "longSkinny" | "phone" | "portrait" | "social";
type FontMetricKey = "baselineOffset" | "leftBearing" | "rightBearing" | "width" | "xAdvance";
type FontGlyphMetricKey = Exclude<FontMetricKey, "width">;
type LetterMetricKey = "baselineOffset" | "height" | "leftBearing" | "rightBearing" | "width" | "xAdvance";
type LetterSettingsSliderId = LetterMetricKey | "size";
type LetterMetricOverrides = AppliedLetterMetricOverrides;
type ImageSettingsSliderId = "canvasHeight" | "canvasWidth" | "pagePadding" | "size";
type StickerMetricId = "height" | "size" | "width";
type ManuscriptMetricKey = "manuscriptAge" | "manuscriptEdges" | "manuscriptFibers" | "manuscriptInkSoak" | "manuscriptRuling" | "manuscriptStains";
type SettingsPanel = "decor" | "font" | "image" | "letter" | "preset";
type FontSettingsSliderId = "height" | "letterSpacing" | "rowSpacing" | "size" | "spacebar" | "width";
type FontSettingsSliderConfig = {
  id: FontSettingsSliderId;
  label: string;
  max: number;
  min: number;
  precision: number;
  step: number;
  value: number;
};
type LetterSettingsSliderConfig = {
  id: LetterSettingsSliderId;
  label: string;
  max: number;
  min: number;
  precision: number;
  step: number;
  value: number;
};
type ImageSettingsSliderConfig = {
  id: ImageSettingsSliderId;
  label: string;
  max: number;
  min: number;
  precision: number;
  step: number;
  value: number;
};
type StickerMetricConfig = {
  disabled: boolean;
  id: StickerMetricId;
  label: string;
  max: number;
  min: number;
  precision: number;
  step: number;
  value: number;
};
type StyleDrawer = "doodle" | "ornaments" | "select" | "stickers" | "text" | null;
type StyleDoodleSmoothing = "gentle" | "raw" | "strong";
type StyleDoodleTool = "line" | "pen" | "quill";
type StyleSelectTarget = "doodles" | "letter" | "ornaments" | "stickers" | "text";
type StyleMoveTarget = Exclude<StyleSelectTarget, "letter">;
type SelectedTextMetricGroup = "size" | "spacing";
type TextAlignment = "left" | "center" | "right";
type EyeExpression = NonNullable<GlyphDecoration["expression"]>;
type PreviewStickerKind =
  | "eyes"
  | "color-swatch"
  | "strawberry-vine-divider"
  | "lace-ribbon-divider"
  | "botanical-branch-divider";

const settingsPanelLabels: Record<SettingsPanel, string> = {
  decor: "Add",
  font: "Select",
  image: "Canvas",
  letter: "Letter Tuning",
  preset: "Preset",
};

const fullscreenPanelOptions: Array<{ id: SettingsPanel; label: string }> = [
  { id: "image", label: "Canvas" },
  { id: "font", label: "Select" },
  { id: "letter", label: "Letter" },
  { id: "preset", label: "Preset" },
  { id: "decor", label: "Add" },
];
const fullscreenSelectOptions: Array<{ id: StyleSelectTarget; label: string }> = [
  { id: "text", label: "Text" },
  { id: "letter", label: "Letter" },
  { id: "stickers", label: "Sticker" },
  { id: "ornaments", label: "Ornament" },
  { id: "doodles", label: "Doodle" },
];
const fullscreenMoveOptions: Array<{ id: StyleMoveTarget; label: string }> = [
  { id: "text", label: "Text" },
  { id: "stickers", label: "Sticker" },
  { id: "ornaments", label: "Ornament" },
  { id: "doodles", label: "Doodle" },
];

const fontSettingsSliderOrder: FontSettingsSliderId[] = ["size", "width", "height", "letterSpacing", "rowSpacing", "spacebar"];
const imageSettingsSliderOrder: ImageSettingsSliderId[] = ["size", "canvasWidth", "canvasHeight", "pagePadding"];
const letterSettingsSliderOrder: LetterSettingsSliderId[] = [
  "size",
  "width",
  "height",
  "baselineOffset",
  "leftBearing",
  "rightBearing",
  "xAdvance",
];

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
  textEffects: PreviewTextEffects;
};
type ImageMetricDefaults = Pick<PreviewImageSettings, "canvasHeight" | "canvasWidth" | "pagePadding">;

type PreviewTextEffectId = "outline" | "shadow" | "smooth" | "texture" | "thicken";

type PreviewTextEffects = Record<PreviewTextEffectId, boolean>;

type PhoneImageLayout = {
  bodyEndY: number;
  bodyFontSize: number;
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

type GlyphWidthMetrics = Pick<Glyph, "leftBearing" | "rightBearing" | "width" | "xAdvance">;
type TextRunMeasureMode = "render" | "wrap";

type PresetCharacterMetrics = {
  advance: number;
  heightScale: number;
  leftBearingOffset: number;
  topOffset: number;
  visualWidth: number;
  widthScale: number;
};

type PreviewDoodlePoint = {
  ink?: number;
  pressure?: number;
  spread?: number;
  x: number;
  y: number;
};

type PreviewDoodleStroke = {
  baseSize?: number;
  color: string;
  heightScale?: number;
  id: string;
  inkEffect: GlyphInkEffect;
  points: PreviewDoodlePoint[];
  size: number;
  tool: StyleDoodleTool;
  widthScale?: number;
};

type PreviewSticker = {
  color?: string;
  expression: EyeExpression;
  faceMood?: number;
  heightScale?: number;
  id: string;
  kind?: PreviewStickerKind;
  lookAt?: PreviewDoodlePoint;
  redness?: number;
  sleepiness?: number;
  size: number;
  widthScale?: number;
  x: number;
  y: number;
};

type StyleStickerDrag = {
  asset: StyleStickerAsset;
  isDragging: boolean;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
};

type StyleStickerDragPreview = {
  asset: StyleStickerAsset;
  x: number;
  y: number;
};

type StyleStickerAsset = {
  aspectRatio?: number;
  defaultSize?: number;
  id: PreviewStickerKind;
  kind: PreviewStickerKind;
  label: string;
  maxSize?: number;
  minSize?: number;
  src?: string;
};

type PreviewTextLayer = {
  fontId: string;
  id: string;
  sizeScale: number;
  text: string;
  width?: number;
  x?: number;
  y?: number;
};
type PreviewTextLayerDraft = Omit<PreviewTextLayer, "id">;

type PalettePageTextLayerKey = PalettePageColorKey | "title";

type PreviewTextPlacement = {
  sizeScale?: number;
  x?: number;
  y?: number;
};

type StyleMovingText = {
  id: string;
  offsetX: number;
  offsetY: number;
  target: PreviewTextLayerHitTarget;
};

type StyleMovingDoodle = {
  id: string;
  lastPoint: PreviewDoodlePoint;
};

type PreviewTextFontSource =
  | { font: FontSet; kind: "custom" }
  | { kind: "preset"; preset: FontPreset };
type PreviewTextFontOption =
  | { font: FontSet; id: string; kind: "custom"; label: string }
  | { id: string; kind: "preset"; label: string; preset: FontPreset };

type PreviewTextLayerHitTarget = {
  height: number;
  id: string;
  width: number;
  x: number;
  y: number;
};

type PreviewTextSelectionTone = "active" | "available";
type PalettePageColorKey = "primary" | "secondary" | "background" | "accent" | "gold" | "ink";

type PalettePageDraft = Record<PalettePageColorKey, string> & {
  title: string;
};

const PREVIEW_TEXT_SELECTION_HIT_PADDING = 8;
const PREVIEW_TEXT_SELECTION_VISUAL_PADDING = 3;
const PREVIEW_TEXT_LAYER_EDGE_BLEED = 12;

type PreviewDocument = {
  headerText?: string;
  id: string;
  name: string;
  settings: PreviewImageSettings;
  text: string;
  textLayers?: PreviewTextLayer[];
  textTargetPlacements?: Record<string, PreviewTextPlacement>;
  updatedAt: string;
};

type PreviewDesignPreset = {
  fontOptionId: string;
  id: string;
  name: string;
  settings: PreviewImageSettings;
  updatedAt: string;
};

export type PreviewDesignPresetSummary = {
  id: string;
  name: string;
  updatedAt: string;
};

const PREVIEW_DOCUMENTS_KEY = "quill:preview-documents:v1";
const PREVIEW_DESIGN_PRESETS_KEY = "quill:preview-design-presets:v1";
const PALETTE_PAGE_PRESET_ID = "builtin:palette-page";
const PALETTE_PAGE_TEXT_LAYER_PREFIX = "builtin:palette-page:text:";

const palettePageFields: Array<{ id: PalettePageColorKey; label: string }> = [
  { id: "primary", label: "Primary" },
  { id: "secondary", label: "Secondary" },
  { id: "background", label: "Background" },
  { id: "accent", label: "Accent" },
  { id: "gold", label: "Gold" },
  { id: "ink", label: "Ink" },
];

const defaultPalettePageDraft: PalettePageDraft = {
  title: "Strawberry Market",
  primary: "#E96A7A",
  secondary: "#F48FB1",
  background: "#FFF4EE",
  accent: "#8BCF8A",
  gold: "#F2C66D",
  ink: "#5A4035",
};

function PreviewTextFontNamePreview({
  accentColor,
  backgroundColor,
  compact = false,
  inkColor,
  option,
}: {
  accentColor: string;
  backgroundColor: string;
  compact?: boolean;
  inkColor: string;
  option: PreviewTextFontOption;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const height = compact ? 20 : 34;
    const fontSize = compact ? 15 : 22;
    const paddingX = compact ? 5 : 8;
    const textTop = compact ? 2 : 5;
    const glyphTop = compact ? 2 : 5;

    function drawPreview() {
      const ctx = canvas?.getContext("2d");

      if (!ctx || !canvas) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(canvas.getBoundingClientRect().width || 220));

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = "100%";
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.strokeStyle = accentColor;
      ctx.globalAlpha = 0.34;
      ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = inkColor;
      ctx.textBaseline = "top";

      if (option.kind === "preset") {
        ctx.font = getFontPresetCanvasFont(option.preset, fontSize);
        ctx.fillText(option.label, paddingX, textTop);
        return;
      }

      const font = option.font;
      const fontHeightScale = getFontHeightScale(font);
      const fontWidthScale = getFontWidthScale(font);
      let x = paddingX;

      ctx.font = `900 ${fontSize}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

      for (const [characterIndex, character] of [...option.label].entries()) {
        const glyph = selectPreviewGlyph(font.glyphs, character, `${font.id}|${option.label}|${characterIndex}|${character}`);

        if (glyph) {
          const scales = getGlyphRenderScales(font, glyph);
          const scaledBaselineY = glyphTop + fontSize * 0.76 * fontHeightScale;
          const glyphX = x + getGlyphLeftBearingOffset(font, glyph, fontSize);
          const glyphY = getGlyphTopForBaseline(glyph, fontSize, scaledBaselineY, scales.heightScale);

          drawGlyph(ctx, glyph, {
            x: glyphX,
            y: glyphY,
            size: fontSize,
            color: inkColor,
            renderProfile: font.renderProfile,
            heightScale: scales.heightScale,
            widthScale: scales.widthScale,
            backgroundTexture: font.theme?.backgroundTexture,
          });
          x += getGlyphAdvance(glyph, fontSize, fontWidthScale);
        } else if (character === " ") {
          x += fontSize * 0.36;
        } else {
          ctx.fillText(character, x, glyphTop);
          x += ctx.measureText(character).width;
        }

        if (x > width - 18) {
          break;
        }
      }
    }

    drawPreview();
    let cancelled = false;
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(drawPreview) : null;
    resizeObserver?.observe(canvas);

    if (option.kind === "preset" && document.fonts) {
      document.fonts.load(getFontPresetCanvasFont(option.preset, fontSize)).finally(() => {
        if (!cancelled) {
          drawPreview();
        }
      });
    }

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
    };
  }, [accentColor, backgroundColor, compact, inkColor, option]);

  return (
    <canvas
      ref={canvasRef}
      className={`preview-text-font-name-preview ${compact ? "compact" : ""}`}
      aria-hidden="true"
    />
  );
}

const MIN_IMAGE_CANVAS_WIDTH = 640;
const MAX_IMAGE_CANVAS_WIDTH = 50000;
const MIN_IMAGE_CANVAS_HEIGHT = 150;
const MAX_IMAGE_CANVAS_HEIGHT = 3600;
const HEADER_FONT_SIZE_MULTIPLIER = 3;
const LONG_SKINNY_BOTTOM_PADDING_RATIO = 0.12;
const LONG_SKINNY_TOP_PADDING_RATIO = 0.3;
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
    id: "portrait",
    label: "Portrait",
    settings: {
      canvasWidth: 2550,
      canvasHeight: 3300,
      exportPreset: "portrait",
      fontSize: 132,
      pagePadding: 180,
      transparent: false,
    },
  },
  {
    id: "landscape",
    label: "Landscape",
    settings: {
      canvasWidth: 3300,
      canvasHeight: 2550,
      exportPreset: "landscape",
      fontSize: 120,
      pagePadding: 170,
      transparent: false,
    },
  },
  {
    id: "custom",
    label: "Custom",
    settings: {
      exportPreset: "custom",
    },
  },
];

const defaultPreviewTheme = getDefaultFontPaletteTheme();

const defaultPreviewTextEffects: PreviewTextEffects = {
  outline: false,
  shadow: false,
  smooth: false,
  texture: false,
  thicken: false,
};

const previewTextEffectOptions: Array<{ id: PreviewTextEffectId; label: string }> = [
  { id: "texture", label: "Texture" },
  { id: "shadow", label: "Shadow" },
  { id: "outline", label: "Outline" },
  { id: "smooth", label: "Smooth" },
  { id: "thicken", label: "Thicken" },
];

const defaultPhoneImageSettings: PreviewImageSettings = {
  accentColor: defaultPreviewTheme.accentColor,
  alignment: "left",
  autoFit: true,
  backgroundColor: defaultPreviewTheme.backgroundColor,
  backgroundStyle: defaultPreviewTheme.backgroundStyle,
  backgroundTexture: defaultPreviewTheme.backgroundTexture,
  canvasHeight: 1920,
  canvasWidth: 1080,
  exportPreset: "phone",
  fontSize: 118,
  inkColor: defaultPreviewTheme.inkColor,
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
  textEffects: { ...defaultPreviewTextEffects },
};

const builtInPreviewDesignPresets: PreviewDesignPreset[] = [
  {
    fontOptionId: getFontPresetOptionId("oldStandardTT"),
    id: PALETTE_PAGE_PRESET_ID,
    name: "Palette",
    settings: normalizePreviewSettings({
      ...defaultPhoneImageSettings,
      accentColor: "#E96A7A",
      alignment: "left",
      backgroundColor: "#FFF4EE",
      backgroundStyle: "strawberryCream",
      backgroundTexture: "clean",
      canvasHeight: 1920,
      canvasWidth: 1080,
      exportPreset: "phone",
      fontSize: 62,
      inkColor: "#5A4035",
      letterSpacing: 0,
      lineSpacing: 1.28,
      pagePadding: 78,
      transparent: false,
      textEffects: { ...defaultPreviewTextEffects },
    }),
    updatedAt: "2026-06-07T00:00:00.000Z",
  },
];

function getImageMetricDefaults(settings: PreviewImageSettings): ImageMetricDefaults {
  return {
    canvasHeight: settings.canvasHeight,
    canvasWidth: settings.canvasWidth,
    pagePadding: settings.pagePadding,
  };
}

const previewPresets = [
  {
    id: "pangram",
    label: "Pangram",
    text: "The quick brown fox jumps over 13 lazy dogs.\nSphinx of black quartz, judge my vow.",
  },
  {
    id: "entry",
    label: "Entry",
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
  ...paletteInkSwatches,
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

const previewStickerExpression: EyeExpression = "googly";
const STRAWBERRY_MARKET_STICKER_PATH = "/assets/stickers/strawberry-market";
const styleStickerAssets: StyleStickerAsset[] = [
  { id: "eyes", kind: "eyes", label: "Eyes" },
  {
    defaultSize: 0.12,
    id: "color-swatch",
    kind: "color-swatch",
    label: "Color swatch",
    maxSize: 0.28,
    minSize: 0.04,
  },
  {
    aspectRatio: 3,
    defaultSize: 0.46,
    id: "strawberry-vine-divider",
    kind: "strawberry-vine-divider",
    label: "Strawberry vine",
    maxSize: 0.92,
    minSize: 0.16,
    src: `${STRAWBERRY_MARKET_STICKER_PATH}/strawberry-vine-divider-transparent.png`,
  },
  {
    aspectRatio: 3,
    defaultSize: 0.46,
    id: "lace-ribbon-divider",
    kind: "lace-ribbon-divider",
    label: "Lace ribbon",
    maxSize: 0.92,
    minSize: 0.16,
    src: `${STRAWBERRY_MARKET_STICKER_PATH}/lace-ribbon-divider-transparent.png`,
  },
  {
    aspectRatio: 3,
    defaultSize: 0.46,
    id: "botanical-branch-divider",
    kind: "botanical-branch-divider",
    label: "Botanical branch",
    maxSize: 0.92,
    minSize: 0.16,
    src: `${STRAWBERRY_MARKET_STICKER_PATH}/botanical-branch-divider-transparent.png`,
  },
];
const styleStickerOnlyAssets = styleStickerAssets.filter((asset) => asset.kind === "eyes");
const styleOrnamentAssets = styleStickerAssets.filter((asset) => asset.kind !== "eyes");
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

type BackgroundPreset = {
  accentColor: string;
  backgroundColor: string;
  id: BackgroundStyle;
  inkColor: string;
  label: string;
  preview: string;
};

function isEyePreviewSticker(sticker: PreviewSticker | null | undefined) {
  return !sticker?.kind || sticker.kind === "eyes";
}

function isColorSwatchPreviewSticker(sticker: PreviewSticker | null | undefined) {
  return sticker?.kind === "color-swatch";
}

function getStyleStickerAsset(kind: PreviewStickerKind | undefined) {
  return styleStickerAssets.find((asset) => asset.kind === (kind ?? "eyes")) ?? styleStickerAssets[0];
}

const backgroundPresets: BackgroundPreset[] = [
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

function formatPaletteSourceText(draft: PalettePageDraft) {
  return palettePageFields
    .map((field) => `${field.id}: ${draft[field.id]}`)
    .join("\n");
}

function isPreviewPaletteHex(value: string) {
  return /^#[\da-f]{6}$/i.test(value.trim());
}

function normalizePreviewPaletteHex(value: string, fallback: string) {
  const trimmed = value.trim();

  return isPreviewPaletteHex(trimmed) ? trimmed : fallback;
}

function hexToPreviewPaletteRgb(value: string) {
  const normalized = normalizePreviewPaletteHex(value, "#000000").slice(1);

  return {
    b: parseInt(normalized.slice(4, 6), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    r: parseInt(normalized.slice(0, 2), 16),
  };
}

function previewPaletteRgba(sourceHex: string, alpha: number) {
  const source = hexToPreviewPaletteRgb(sourceHex);

  return `rgba(${source.r}, ${source.g}, ${source.b}, ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`;
}

function getPalettePageTextLayerId(key: PalettePageTextLayerKey) {
  return `${PALETTE_PAGE_TEXT_LAYER_PREFIX}${key}`;
}

function isPalettePageTextLayerId(layerId: string) {
  return layerId.startsWith(PALETTE_PAGE_TEXT_LAYER_PREFIX);
}

function getPalettePageCanvasMetrics(renderSettings: PreviewImageSettings) {
  const pageX = renderSettings.pagePadding;
  const pageWidth = Math.max(1, renderSettings.canvasWidth - pageX * 2);
  const gap = Math.max(10, Math.round(renderSettings.fontSize * 0.16));
  const columns = 1;
  const cardWidth = pageWidth;
  const cardHeight = Math.max(98, Math.round(renderSettings.fontSize * 1.55));
  const swatchSize = Math.max(54, Math.round(renderSettings.fontSize * 0.9));
  const cardRadius = 0;
  const swatchRadius = Math.max(8, Math.round(renderSettings.fontSize * 0.14));
  const cardPadding = 0;
  const titleTop = renderSettings.pagePadding + Math.max(36, renderSettings.fontSize * 0.58);
  const titleSizeScale = 1.35;
  const titleHeight = renderSettings.fontSize * titleSizeScale * renderSettings.lineSpacing;
  const gridY = titleTop + titleHeight + Math.max(26, renderSettings.fontSize * 0.34);

  return {
    cardHeight,
    cardPadding,
    cardRadius,
    cardWidth,
    columns,
    gap,
    gridY,
    pageWidth,
    pageX,
    swatchRadius,
    swatchSize,
    titleSizeScale,
    titleTop,
  };
}

function getPalettePageCardMetrics(renderSettings: PreviewImageSettings, index: number) {
  const metrics = getPalettePageCanvasMetrics(renderSettings);
  const row = index;
  const x = metrics.pageX;
  const y = metrics.gridY + row * (metrics.cardHeight + metrics.gap);
  const swatchX = x + metrics.cardWidth - metrics.swatchSize;
  const swatchY = y + Math.max(0, (metrics.cardHeight - metrics.swatchSize) / 2);
  const textX = x;
  const textY = y + Math.max(10, renderSettings.fontSize * 0.12);

  return {
    ...metrics,
    swatchX,
    swatchY,
    textX,
    textY,
    x,
    y,
  };
}

function createPalettePageTextLayers(
  draft: PalettePageDraft,
  renderSettings: PreviewImageSettings,
  fontOptionId: string,
): PreviewTextLayer[] {
  const metrics = getPalettePageCanvasMetrics(renderSettings);
  const title = draft.title.trim() || "Palette";

  return [
    {
      fontId: fontOptionId,
      id: getPalettePageTextLayerId("title"),
      sizeScale: metrics.titleSizeScale,
      text: title,
      width: metrics.pageWidth / renderSettings.canvasWidth,
      x: metrics.pageX / renderSettings.canvasWidth,
      y: metrics.titleTop / renderSettings.canvasHeight,
    },
    ...palettePageFields.map((field, index) => {
      const cardMetrics = getPalettePageCardMetrics(renderSettings, index);
      const textWidth = Math.max(
        1,
        cardMetrics.swatchX - cardMetrics.textX - Math.max(18, renderSettings.fontSize * 0.28),
      );

      return {
        fontId: fontOptionId,
        id: getPalettePageTextLayerId(field.id),
        sizeScale: 0.42,
        text: `${field.id}\n${draft[field.id].trim() || field.label}`,
        width: textWidth / renderSettings.canvasWidth,
        x: cardMetrics.textX / renderSettings.canvasWidth,
        y: cardMetrics.textY / renderSettings.canvasHeight,
      };
    }),
  ];
}

function tokenizeParagraph(paragraph: string) {
  return paragraph.match(/\S+\s*|\s+/g) ?? [];
}

function clampUnit(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

function clampPreviewTextSizeScale(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Number(Math.min(2.5, Math.max(0.45, value)).toFixed(2));
}

function normalizePreviewTextEffects(value: unknown): PreviewTextEffects {
  const effects = typeof value === "object" && value !== null
    ? value as Partial<Record<PreviewTextEffectId, unknown>>
    : {};

  return {
    outline: typeof effects.outline === "boolean" ? effects.outline : defaultPreviewTextEffects.outline,
    shadow: typeof effects.shadow === "boolean" ? effects.shadow : defaultPreviewTextEffects.shadow,
    smooth: typeof effects.smooth === "boolean" ? effects.smooth : defaultPreviewTextEffects.smooth,
    texture: typeof effects.texture === "boolean" ? effects.texture : defaultPreviewTextEffects.texture,
    thicken: typeof effects.thicken === "boolean" ? effects.thicken : defaultPreviewTextEffects.thicken,
  };
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
    textEffects: normalizePreviewTextEffects(normalized.textEffects),
  };

  return exportPresets.some((preset) => preset.id === safeSettings.exportPreset)
    ? safeSettings
    : {
        ...safeSettings,
        exportPreset: "phone",
      };
}

function normalizePreviewTextPlacement(value: unknown): PreviewTextPlacement | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const placement = value as Partial<PreviewTextPlacement>;

  const hasPosition = typeof placement.x === "number" && typeof placement.y === "number";
  const hasSizeScale = typeof placement.sizeScale === "number";

  if (!hasPosition && !hasSizeScale) {
    return null;
  }

  return {
    ...(hasSizeScale ? { sizeScale: clampPreviewTextSizeScale(placement.sizeScale) } : {}),
    ...(hasPosition ? { x: clampUnit(placement.x, 0), y: clampUnit(placement.y, 0) } : {}),
  };
}

function normalizePreviewTextPlacements(value: unknown): Record<string, PreviewTextPlacement> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, PreviewTextPlacement>>(
    (placements, [id, placementValue]) => {
      const placement = normalizePreviewTextPlacement(placementValue);

      if (placement) {
        placements[id] = placement;
      }

      return placements;
    },
    {},
  );
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
              width: typeof layer.width === "number" ? clampUnit(layer.width, 1) : undefined,
              x: typeof layer.x === "number" ? clampUnit(layer.x, 0) : undefined,
              y: typeof layer.y === "number" ? clampUnit(layer.y, 0) : undefined,
            }))
          : [],
        textTargetPlacements: normalizePreviewTextPlacements(document.textTargetPlacements),
      }));
  } catch {
    return [];
  }
}

function savePreviewDocuments(documents: PreviewDocument[]) {
  window.localStorage.setItem(PREVIEW_DOCUMENTS_KEY, JSON.stringify(documents));
}

function loadPreviewDesignPresets() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(PREVIEW_DESIGN_PRESETS_KEY) ?? "[]") as PreviewDesignPreset[];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((preset) => preset?.id && typeof preset.fontOptionId === "string")
      .map((preset) => ({
        ...preset,
        name: preset.name || "Untitled preset",
        settings: normalizePreviewSettings(preset.settings),
        updatedAt: typeof preset.updatedAt === "string" ? preset.updatedAt : new Date().toISOString(),
      }));
  } catch {
    return [];
  }
}

function savePreviewDesignPresets(presets: PreviewDesignPreset[]) {
  window.localStorage.setItem(PREVIEW_DESIGN_PRESETS_KEY, JSON.stringify(presets));
}

function getVisiblePreviewDesignPresets(presets: PreviewDesignPreset[]) {
  return [...builtInPreviewDesignPresets, ...presets];
}

function getPreviewDesignPresetSummaries(presets: PreviewDesignPreset[]): PreviewDesignPresetSummary[] {
  return getVisiblePreviewDesignPresets(presets).map((preset) => ({
    id: preset.id,
    name: preset.name,
    updatedAt: preset.updatedAt,
  }));
}

export function loadPreviewDesignPresetSummaries(): PreviewDesignPresetSummary[] {
  return getPreviewDesignPresetSummaries(loadPreviewDesignPresets());
}

export default function TextPreview({
  autoEntryRequest = null,
  composeFullscreenOnly = false,
  designPresetApplyRequestId = 0,
  designPresetIdToApply = "",
  font,
  fonts,
  onOpenAppMenu,
  onApplyFontSpacing,
  onAutoEntryRenderComplete,
  onCreatePresetFont,
  onDesignPresetsChange,
  onOpenCharacterEditor,
  onRecordExport,
  onSaveImage,
  onSaveRenderedPage,
  onSelectCharacter,
  onSelectFont,
  headerPreviewText,
  onHeaderPreviewTextChange,
  visibleHomeSections,
  previewText,
  onPreviewTextChange,
  presetBuilderRequestId = 0,
  selectedGlyph,
  spacebarGlyph,
}: TextPreviewProps) {
  const showExportControls = visibleHomeSections.exportControls;
  const showPreviewText = visibleHomeSections.previewText;
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewPointerStartRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const previewDoodlesRef = useRef<PreviewDoodleStroke[]>([]);
  const previewStickersRef = useRef<PreviewSticker[]>([]);
  const autoEntryRequestRef = useRef<number>(0);
  const styleActiveDoodleRef = useRef<PreviewDoodleStroke | null>(null);
  const styleActiveStrokeRef = useRef<string | null>(null);
  const styleActiveStrokeTimeRef = useRef(0);
  const styleRenderFrameRef = useRef<number | null>(null);
  const styleStickerDragRef = useRef<StyleStickerDrag | null>(null);
  const styleMovingStickerRef = useRef<string | null>(null);
  const styleMovingTextRef = useRef<StyleMovingText | null>(null);
  const styleMovingDoodleRef = useRef<StyleMovingDoodle | null>(null);
  const designPresetApplyRequestRef = useRef(designPresetApplyRequestId);
  const hiddenPreviewTextTargetIdsRef = useRef<Set<string>>(new Set());
  const styleStickerImagesRef = useRef<Partial<Record<PreviewStickerKind, HTMLImageElement>>>({});
  const manuscriptParchmentRef = useRef<HTMLImageElement | null>(null);
  const presetBuilderRequestRef = useRef(presetBuilderRequestId);
  const viewerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const saveTitleInputRef = useRef<HTMLInputElement | null>(null);
  const customImageMetricDefaultsRef = useRef<ImageMetricDefaults>(getImageMetricDefaults(defaultPhoneImageSettings));
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<SettingsPanel>("image");
  const [activeFontSettingsSliderId, setActiveFontSettingsSliderId] = useState<FontSettingsSliderId | null>(null);
  const [activeImageSettingsSliderId, setActiveImageSettingsSliderId] = useState<ImageSettingsSliderId | null>(null);
  const [activeLetterSettingsSliderId, setActiveLetterSettingsSliderId] = useState<LetterSettingsSliderId | null>(null);
  const [activeStyleDrawer, setActiveStyleDrawer] = useState<StyleDrawer>(null);
  const [canvasFormatDrawerOpen, setCanvasFormatDrawerOpen] = useState(false);
  const [documentName, setDocumentName] = useState("Untitled preview");
  const [fontEffectsMenuOpen, setFontEffectsMenuOpen] = useState(false);
  const [fullscreenActionPanelOpen, setFullscreenActionPanelOpen] = useState(true);
  const [fullscreenAddMenuOpen, setFullscreenAddMenuOpen] = useState(false);
  const [fullscreenMoveMenuOpen, setFullscreenMoveMenuOpen] = useState(false);
  const [fullscreenSelectMenuOpen, setFullscreenSelectMenuOpen] = useState(false);
  const [otherBackgroundsOpen, setOtherBackgroundsOpen] = useState(false);
  const [imageStyleDrawerOpen, setImageStyleDrawerOpen] = useState(false);
  const [imageViewerMode, setImageViewerMode] = useState<"page" | "preset">("page");
  const [imageViewerOpen, setImageViewerOpen] = useState(composeFullscreenOnly);
  const [saveTitleDraft, setSaveTitleDraft] = useState("");
  const [saveTitlePromptOpen, setSaveTitlePromptOpen] = useState(false);
  const [fontPresetsReady, setFontPresetsReady] = useState(false);
  const [hiddenPreviewTextTargetIds, setHiddenPreviewTextTargetIds] = useState<string[]>([]);
  const [manuscriptParchmentReady, setManuscriptParchmentReady] = useState(false);
  const [previewDoodles, setPreviewDoodles] = useState<PreviewDoodleStroke[]>([]);
  const [previewStickers, setPreviewStickers] = useState<PreviewSticker[]>([]);
  const [styleStickerImagesReady, setStyleStickerImagesReady] = useState(0);
  const [draftPreviewTextLayer, setDraftPreviewTextLayer] = useState<PreviewTextLayerDraft | null>(null);
  const [expandedPreviewTextFontPickerId, setExpandedPreviewTextFontPickerId] = useState<string | null>(null);
  const [palettePageDraft, setPalettePageDraft] = useState<PalettePageDraft>(defaultPalettePageDraft);
  const [palettePageActive, setPalettePageActive] = useState(false);
  const [palettePageControlsOpen, setPalettePageControlsOpen] = useState(false);
  const [previewTextLayers, setPreviewTextLayers] = useState<PreviewTextLayer[]>([]);
  const [previewDesignPresets, setPreviewDesignPresets] = useState<PreviewDesignPreset[]>(() => loadPreviewDesignPresets());
  const [previewTextTargetPlacements, setPreviewTextTargetPlacements] = useState<Record<string, PreviewTextPlacement>>({});
  const [savedDocuments, setSavedDocuments] = useState<PreviewDocument[]>(() => loadPreviewDocuments());
  const [selectedPreviewDoodleId, setSelectedPreviewDoodleId] = useState<string | null>(null);
  const [selectedPreviewStickerId, setSelectedPreviewStickerId] = useState<string | null>(null);
  const [selectedPreviewTextLayerId, setSelectedPreviewTextLayerId] = useState<string | null>(null);
  const [selectedTextMetricsOpen, setSelectedTextMetricsOpen] = useState(false);
  const [selectedTextMetricGroup, setSelectedTextMetricGroup] = useState<SelectedTextMetricGroup | null>(null);
  const [selectedLetterMetricsOpen, setSelectedLetterMetricsOpen] = useState(false);
  const [selectedLetterMetricGroup, setSelectedLetterMetricGroup] = useState<SelectedTextMetricGroup | null>(null);
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
  const [styleSelectMenuOpen, setStyleSelectMenuOpen] = useState(false);
  const [styleSelectModeActive, setStyleSelectModeActive] = useState(false);
  const [styleSelectTarget, setStyleSelectTarget] = useState<StyleSelectTarget>("stickers");
  const [styleMoveModeActive, setStyleMoveModeActive] = useState(false);
  const [selectedStickerMetricsOpen, setSelectedStickerMetricsOpen] = useState(false);
  const [activeStickerMetricId, setActiveStickerMetricId] = useState<StickerMetricId | null>(null);
  const [styleStickerDragPreview, setStyleStickerDragPreview] = useState<StyleStickerDragPreview | null>(null);
  const [styleStickerFacePanelOpen, setStyleStickerFacePanelOpen] = useState(false);
  const [styleStickerLookMode, setStyleStickerLookMode] = useState(false);
  const [styleStickerMoveMode, setStyleStickerMoveMode] = useState(false);
  const [styleStickerRednessPanelOpen, setStyleStickerRednessPanelOpen] = useState(false);
  const [styleStickerSleepPanelOpen, setStyleStickerSleepPanelOpen] = useState(false);
  const [selectedTextDeletePrimedId, setSelectedTextDeletePrimedId] = useState<string | null>(null);
  const [imageSettings, setImageSettings] = useState<PreviewImageSettings>(() => ({
    ...defaultPhoneImageSettings,
  }));
  const selectedTextDeletePrimed = Boolean(selectedTextDeletePrimedId);
  function setSelectedTextDeletePrimed(primed: boolean) {
    setSelectedTextDeletePrimedId(primed ? selectedPreviewTextLayerId : null);
  }

  const savedGlyphCount = useMemo(
    () => getVisibleCharacters(font).filter((character) => hasDrawnGlyph(font.glyphs[character])).length,
    [font],
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

  const availableTextFontOptions = useMemo(
    (): PreviewTextFontOption[] => [
      ...availableFonts.map((item) => ({
        font: item,
        id: item.id,
        kind: "custom" as const,
        label: item.name,
      })),
      ...fontPresets.map((preset) => ({
        id: getFontPresetOptionId(preset.id),
        kind: "preset" as const,
        label: preset.label,
        preset,
      })),
    ],
    [availableFonts],
  );
  const activeFontPreset = useMemo(
    () => getFontPresetById(previewFont.presetFontId),
    [previewFont.presetFontId],
  );

  const fontGlyphs = useMemo(
    () => Object.values(previewFont.glyphs).filter((glyph) => glyph.character !== spacebar),
    [previewFont.glyphs],
  );
  const settingsGlyphCharacter = selectedGlyph.character;
  const settingsGlyph = previewFont.glyphs[settingsGlyphCharacter] ?? {
    ...selectedGlyph,
    character: settingsGlyphCharacter,
  };
  const settingsGlyphIsHeader = isHeaderLetter(settingsGlyph.character);
  const settingsGlyphLabel = getCharacterLabel(settingsGlyph.character);
  const settingsGlyphPanelLabel = "Letter Tuning";
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
  const hasPendingFontSpacingChanges = useMemo(
    () =>
      Object.keys(previewFontMetricOverrides).length > 0 ||
      Object.values(previewGlyphMetricOverrides).some((overrides) => Object.keys(overrides).length > 0) ||
      previewGuideSettings !== null ||
      previewShapeSettings !== null,
    [
      previewFontMetricOverrides,
      previewGlyphMetricOverrides,
      previewGuideSettings,
      previewShapeSettings,
    ],
  );
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
    const imageStickerAssets = styleStickerAssets.filter((asset) => asset.src);
    let cancelled = false;

    imageStickerAssets.forEach((asset) => {
      if (!asset.src) {
        return;
      }

      const image = new Image();

      image.onload = () => {
        if (cancelled) {
          return;
        }

        styleStickerImagesRef.current[asset.kind] = image;
        setStyleStickerImagesReady((current) => current + 1);
      };
      image.src = asset.src;
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) {
      setFontPresetsReady(true);
      return;
    }

    let cancelled = false;

    Promise.all(fontPresets.map((preset) => document.fonts.load(getFontPresetCanvasFont(preset, 48))))
      .finally(() => {
        if (!cancelled) {
          setFontPresetsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (presetBuilderRequestId === presetBuilderRequestRef.current) {
      return;
    }

    presetBuilderRequestRef.current = presetBuilderRequestId;
    openPresetBuilderCanvas();
  }, [presetBuilderRequestId]);

  useEffect(() => {
    if (designPresetApplyRequestId === designPresetApplyRequestRef.current) {
      return;
    }

    designPresetApplyRequestRef.current = designPresetApplyRequestId;

    if (designPresetIdToApply) {
      applyDesignPreset(designPresetIdToApply);
    }
  }, [designPresetApplyRequestId, designPresetIdToApply]);

  useEffect(() => {
    onDesignPresetsChange?.(getPreviewDesignPresetSummaries(previewDesignPresets));
  }, [onDesignPresetsChange, previewDesignPresets]);

  useEffect(() => {
    if (!palettePageActive) {
      return;
    }

    onHeaderPreviewTextChange(palettePageDraft.title);
    onPreviewTextChange(formatPaletteSourceText(palettePageDraft));
    setPreviewTextLayers((current) => {
      const fontOptionId = getActivePreviewFontOptionId();
      const nextPaletteLayers = createPalettePageTextLayers(palettePageDraft, imageSettings, fontOptionId);

      return [
        ...current.filter((layer) => !isPalettePageTextLayerId(layer.id)),
        ...nextPaletteLayers.map((layer) => {
          const existingLayer = current.find((item) => item.id === layer.id);

          return existingLayer
            ? {
                ...existingLayer,
                fontId: existingLayer.fontId || layer.fontId,
                sizeScale: existingLayer.sizeScale || layer.sizeScale,
                text: layer.text,
                width: existingLayer.width ?? layer.width,
                x: existingLayer.x ?? layer.x,
                y: existingLayer.y ?? layer.y,
              }
            : layer;
        }),
      ];
    });
  }, [onHeaderPreviewTextChange, onPreviewTextChange, palettePageActive, palettePageDraft]);

  useEffect(() => {
    if (!autoEntryRequest || !onSaveRenderedPage || !onAutoEntryRenderComplete) {
      return;
    }

    if (autoEntryRequest.requestId === autoEntryRequestRef.current) {
      return;
    }

    autoEntryRequestRef.current = autoEntryRequest.requestId;
    let cancelled = false;

    void (async () => {
      try {
        const results = [];

        for (const entry of autoEntryRequest.entries) {
          const result = await renderAndSaveAutoEntryPage(entry);

          if (cancelled) {
            return;
          }

          if (result) {
            results.push(result);
          }
        }

        onAutoEntryRenderComplete({
          bookId: autoEntryRequest.bookId,
          entries: results,
          requestId: autoEntryRequest.requestId,
        });
      } catch (error) {
        console.error("Could not write auto-entry pages.", error);
        if (!cancelled) {
          onAutoEntryRenderComplete({
            bookId: autoEntryRequest.bookId,
            entries: [],
            requestId: autoEntryRequest.requestId,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [autoEntryRequest, onAutoEntryRenderComplete, onSaveRenderedPage, previewDesignPresets]);

  useEffect(() => {
    renderPhoneImage();
  }, [
    activeSettingsPanel,
    font,
    fontPresetsReady,
    fullscreenSelectMenuOpen,
    headerPreviewText,
    hiddenPreviewTextTargetIds,
    imageSettings,
    imageViewerOpen,
    manuscriptParchmentReady,
    previewFont,
    previewDoodles,
    previewStickers,
    previewTextTargetPlacements,
    previewTextLayers,
    previewText,
    selectedPreviewDoodleId,
    selectedPreviewStickerId,
    selectedPreviewTextLayerId,
    styleMoveModeActive,
    styleSelectMenuOpen,
    styleSelectModeActive,
    styleSelectTarget,
    styleStickerImagesReady,
  ]);

  useEffect(() => {
    previewDoodlesRef.current = previewDoodles;
  }, [previewDoodles]);

  useEffect(() => {
    previewStickersRef.current = previewStickers;
  }, [previewStickers]);

  useEffect(() => {
    setSelectedTextMetricsOpen(false);
    setSelectedTextDeletePrimedId((current) =>
      current && selectedPreviewTextLayerId && current !== selectedPreviewTextLayerId ? null : current,
    );
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
  }, [selectedPreviewTextLayerId]);

  useEffect(() => {
    setActiveFontSettingsSliderId(null);
    setActiveImageSettingsSliderId(null);
    setActiveLetterSettingsSliderId(null);
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
    if (!activeFontSettingsSliderId && !activeImageSettingsSliderId && !activeLetterSettingsSliderId && !activeStickerMetricId) {
      return undefined;
    }

    function closeSettingsSliderOnOutsidePointer(event: PointerEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest(
          ".font-slider-shell, .image-slider-shell, .letter-slider-shell, .font-slider-drawer, .selected-text-option-row, .selected-sticker-option-row",
        )
      ) {
        return;
      }

      setActiveFontSettingsSliderId(null);
      setActiveImageSettingsSliderId(null);
      setActiveLetterSettingsSliderId(null);
      setActiveStickerMetricId(null);
    }

    document.addEventListener("pointerdown", closeSettingsSliderOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeSettingsSliderOnOutsidePointer);
  }, [activeFontSettingsSliderId, activeImageSettingsSliderId, activeLetterSettingsSliderId, activeStickerMetricId]);

  useEffect(() => {
    return () => {
      if (styleRenderFrameRef.current !== null) {
        window.cancelAnimationFrame(styleRenderFrameRef.current);
      }
      cancelStyleStickerDrag();
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("editor-fullscreen-open", imageViewerOpen);

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [imageViewerOpen]);

  useEffect(() => {
    if (composeFullscreenOnly) {
      setImageViewerOpen(true);
    } else {
      setImageViewerOpen(false);
    }
  }, [composeFullscreenOnly]);

  useEffect(() => {
    if (saveTitlePromptOpen) {
      saveTitleInputRef.current?.focus();
      saveTitleInputRef.current?.select();
    }
  }, [saveTitlePromptOpen]);

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

  function getMetricGlyphForCharacter(fontForText: FontSet, character: string, useHeaderLetters = false) {
    const glyphKey = getPreviewGlyphKey(character, useHeaderLetters);
    const exactGlyph = fontForText.glyphs[glyphKey];

    if (exactGlyph) {
      return exactGlyph;
    }

    const caseFallback = glyphKey === glyphKey.toLowerCase()
      ? glyphKey.toUpperCase()
      : glyphKey.toLowerCase();

    return caseFallback !== glyphKey ? fontForText.glyphs[caseFallback] : undefined;
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

    const glyphKey = getPreviewGlyphKey(character, useHeaderLetters);
    const glyph = findPreviewGlyph(fontForText.glyphs, glyphKey);

    if (glyph) {
      return getGlyphAdvance(glyph, fontSize, getFontWidthScale(fontForText));
    }

    const metricGlyph = getMetricGlyphForCharacter(fontForText, character, useHeaderLetters);

    if (metricGlyph) {
      return getGlyphAdvance(metricGlyph, fontSize, getFontWidthScale(fontForText));
    }

    return ctx.measureText(character).width * getFontWidthScale(fontForText);
  }

  function getGlyphWrapWidth(glyph: GlyphWidthMetrics, fontSize: number, fontForText: FontSet) {
    const fontWidthScale = getFontWidthScale(fontForText);
    const bearingAdvance = glyph.leftBearing + glyph.width + glyph.rightBearing;
    const renderedAdvance = Math.max(
      fontSize * 0.18,
      fontSize * Math.max(glyph.xAdvance, bearingAdvance) * fontWidthScale,
    );
    const visibleWidth = fontSize * Math.max(0.18, glyph.width) * fontWidthScale;

    return Math.min(renderedAdvance, visibleWidth);
  }

  function measureCharacterForWrap(
    ctx: CanvasRenderingContext2D,
    character: string,
    fontSize: number,
    useHeaderLetters = false,
    fontForText: FontSet = previewFont,
  ) {
    if (character === spacebar) {
      return getSpacebarAdvance(fontForText.glyphs[spacebar], fontSize);
    }

    const glyphKey = getPreviewGlyphKey(character, useHeaderLetters);
    const glyph = findPreviewGlyph(fontForText.glyphs, glyphKey);

    if (glyph) {
      return getGlyphWrapWidth(glyph, fontSize, fontForText);
    }

    const metricGlyph = getMetricGlyphForCharacter(fontForText, character, useHeaderLetters);

    if (metricGlyph) {
      return getGlyphWrapWidth(metricGlyph, fontSize, fontForText);
    }

    return measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText);
  }

  function getFontLetterSpacing(fontForText: FontSet, fontSize: number) {
    return fontSize * (fontForText.shapeSettings?.letterSpacing ?? 0);
  }

  function getTrackedCharacterAdvance(characterWidth: number, letterSpacing: number) {
    return Math.max(1, characterWidth + letterSpacing);
  }

  function measureTextRun(
    ctx: CanvasRenderingContext2D,
    text: string,
    fontSize: number,
    useHeaderLetters = false,
    fontForText: FontSet = previewFont,
    mode: TextRunMeasureMode = "render",
  ) {
    const characters = [...text];
    const letterSpacing = getFontLetterSpacing(fontForText, fontSize);

    return characters.reduce((width, character, index) => {
      const characterWidth = mode === "wrap"
        ? measureCharacterForWrap(ctx, character, fontSize, useHeaderLetters, fontForText)
        : measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText);
      const advance = index < characters.length - 1
        ? getTrackedCharacterAdvance(characterWidth, letterSpacing)
        : characterWidth;

      return width + advance;
    }, 0);
  }

  function buildWordWrappedLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxLineWidth: number,
    fontSize: number,
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

        const tokenWidth = measureTextRun(ctx, token, fontSize, useHeaderLetters, fontForText, "wrap");

        if (line.length > 0 && lineWidth + tokenWidth > maxLineWidth) {
          lines.push(line.trimEnd());
          line = token.replace(/^\s+/, "");
          lineWidth = measureTextRun(ctx, line, fontSize, useHeaderLetters, fontForText, "wrap");
        } else {
          line += token;
          lineWidth += tokenWidth;
        }

        lineWidth = Math.max(lineWidth, measureTextRun(ctx, line, fontSize, useHeaderLetters, fontForText, "wrap"));
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
    useHeaderLetters = false,
    fontForText: FontSet = previewFont,
  ) {
    const paragraphs = text.split("\n");
    const lines: string[] = [];
    const letterSpacing = getFontLetterSpacing(fontForText, fontSize);

    for (const paragraph of paragraphs) {
      let line = "";
      let lineWidth = 0;

      if (paragraph.length === 0) {
        lines.push("");
        continue;
      }

      for (const character of paragraph) {
        const characterWidth = measureCharacterForWrap(ctx, character, fontSize, useHeaderLetters, fontForText);
        const trackedWidth = line.length > 0
          ? getTrackedCharacterAdvance(characterWidth, letterSpacing)
          : characterWidth;

        if (line.length > 0 && lineWidth + trackedWidth > maxLineWidth) {
          lines.push(line);
          line = character.trimStart();
          lineWidth = measureTextRun(ctx, line, fontSize, useHeaderLetters, fontForText, "wrap");
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
    const lineWidth = measureTextRun(ctx, line, fontSize, useHeaderLetters, fontForText);

    if (renderSettings.alignment === "center") {
      return Math.max(renderSettings.pagePadding, (renderSettings.canvasWidth - lineWidth) / 2);
    }

    if (renderSettings.alignment === "right") {
      return Math.max(renderSettings.pagePadding, renderSettings.canvasWidth - renderSettings.pagePadding - lineWidth);
    }

    return renderSettings.pagePadding;
  }

  function setPresetCanvasFont(ctx: CanvasRenderingContext2D, preset: FontPreset, fontSize: number) {
    ctx.font = getFontPresetCanvasFont(preset, fontSize);
  }

  function getPresetAdvanceScale(fontForText?: FontSet) {
    if (!fontForText) {
      return 1;
    }

    const glyphs = Object.values(fontForText.glyphs).filter((glyph) => glyph.character !== spacebar);
    const totalAdvance = glyphs.reduce((sum, glyph) => sum + glyph.xAdvance, 0);
    const averageAdvance = glyphs.length > 0 ? totalAdvance / glyphs.length : defaultGlyphMetrics.xAdvance;

    return Math.max(0.1, averageAdvance / defaultGlyphMetrics.xAdvance);
  }

  function getPresetCharacterMetrics(
    ctx: CanvasRenderingContext2D,
    character: string,
    fontSize: number,
    fontForText?: FontSet,
    useHeaderLetters = false,
  ): PresetCharacterMetrics {
    const fontWidthScale = fontForText ? getFontWidthScale(fontForText) : 1;
    const fontHeightScale = fontForText ? getFontHeightScale(fontForText) : 1;

    if (character.trim().length === 0) {
      const spaceGlyph = fontForText?.glyphs[spacebar] ?? (fontForText?.id === previewFont.id ? previewSpacebarGlyph : undefined);
      const advance = getSpacebarAdvance(spaceGlyph, fontSize) * getPresetAdvanceScale(fontForText);

      return {
        advance,
        heightScale: fontHeightScale,
        leftBearingOffset: 0,
        topOffset: 0,
        visualWidth: advance,
        widthScale: fontWidthScale,
      };
    }

    const metricGlyph = fontForText
      ? getMetricGlyphForCharacter(fontForText, character, useHeaderLetters)
      : undefined;
    const presetAdvanceScale = metricGlyph
      ? Math.max(0.1, metricGlyph.xAdvance / defaultGlyphMetrics.xAdvance)
      : getPresetAdvanceScale(fontForText);
    const widthScale = fontWidthScale * (metricGlyph?.width ?? 1);
    const heightScale = fontHeightScale * (metricGlyph?.height ?? 1);
    const measuredWidth = ctx.measureText(character).width;
    const visualWidth = measuredWidth * widthScale;
    const leftBearingOffset = metricGlyph
      ? (metricGlyph.leftBearing - defaultGlyphMetrics.leftBearing) * fontSize * fontWidthScale
      : 0;
    const rightBearingOffset = metricGlyph
      ? (metricGlyph.rightBearing - defaultGlyphMetrics.rightBearing) * fontSize * fontWidthScale
      : 0;
    const topOffset = metricGlyph
      ? (defaultGlyphMetrics.baselineOffset - metricGlyph.baselineOffset) * fontSize * heightScale
      : 0;
    const scaledAdvance = measuredWidth * fontWidthScale * presetAdvanceScale;
    const advance = Math.max(
      fontSize * 0.18,
      Math.max(scaledAdvance, visualWidth) + leftBearingOffset + rightBearingOffset,
    );

    return {
      advance,
      heightScale,
      leftBearingOffset,
      topOffset,
      visualWidth,
      widthScale,
    };
  }

  function getPresetCharacterAdvance(
    ctx: CanvasRenderingContext2D,
    character: string,
    fontSize: number,
    fontForText?: FontSet,
    useHeaderLetters = false,
  ) {
    return getPresetCharacterMetrics(ctx, character, fontSize, fontForText, useHeaderLetters).advance;
  }

  function measurePresetTextRun(
    ctx: CanvasRenderingContext2D,
    text: string,
    fontSize: number,
    fontForText?: FontSet,
    useHeaderLetters = false,
  ) {
    const characters = [...text];
    const letterSpacing = fontForText ? getFontLetterSpacing(fontForText, fontSize) : 0;

    return characters.reduce((width, character, index) => {
      const characterAdvance = getPresetCharacterAdvance(ctx, character, fontSize, fontForText, useHeaderLetters);

      return width + characterAdvance + (index < characters.length - 1 ? letterSpacing : 0);
    }, 0);
  }

  function buildPresetWordWrappedLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxLineWidth: number,
    preset: FontPreset,
    fontSize: number,
    fontForText?: FontSet,
    useHeaderLetters = false,
  ) {
    setPresetCanvasFont(ctx, preset, fontSize);
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

        const tokenWidth = measurePresetTextRun(ctx, token, fontSize, fontForText, useHeaderLetters);

        if (line.length > 0 && lineWidth + tokenWidth > maxLineWidth) {
          lines.push(line.trimEnd());
          line = token.replace(/^\s+/, "");
          lineWidth = measurePresetTextRun(ctx, line, fontSize, fontForText, useHeaderLetters);
        } else {
          line += token;
          lineWidth += tokenWidth;
        }

        lineWidth = Math.max(lineWidth, measurePresetTextRun(ctx, line, fontSize, fontForText, useHeaderLetters));
      }

      lines.push(line.trimEnd());
    }

    return lines;
  }

  function buildPresetCharacterWrappedLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxLineWidth: number,
    preset: FontPreset,
    fontSize: number,
    fontForText?: FontSet,
    useHeaderLetters = false,
  ) {
    setPresetCanvasFont(ctx, preset, fontSize);
    const paragraphs = text.split("\n");
    const letterSpacing = fontForText ? getFontLetterSpacing(fontForText, fontSize) : 0;
    const lines: string[] = [];

    for (const paragraph of paragraphs) {
      let line = "";
      let lineWidth = 0;

      if (paragraph.length === 0) {
        lines.push("");
        continue;
      }

      for (const character of paragraph) {
        const characterWidth = getPresetCharacterAdvance(ctx, character, fontSize, fontForText, useHeaderLetters);
        const trackedWidth = line.length > 0 ? characterWidth + letterSpacing : characterWidth;

        if (line.length > 0 && lineWidth + trackedWidth > maxLineWidth) {
          lines.push(line);
          line = character.trimStart();
          lineWidth = measurePresetTextRun(ctx, line, fontSize, fontForText, useHeaderLetters);
          continue;
        }

        line += character;
        lineWidth += trackedWidth;
      }

      lines.push(line.trimEnd());
    }

    return lines;
  }

  function getPresetLineHeight(renderSettings: PreviewImageSettings, fontSize: number) {
    return fontSize * renderSettings.lineSpacing;
  }

  function getPresetLineX(
    ctx: CanvasRenderingContext2D,
    line: string,
    renderSettings: PreviewImageSettings,
    preset: FontPreset,
    fontSize: number,
    fontForText?: FontSet,
    useHeaderLetters = false,
  ) {
    setPresetCanvasFont(ctx, preset, fontSize);
    const lineWidth = measurePresetTextRun(ctx, line, fontSize, fontForText, useHeaderLetters);

    if (renderSettings.alignment === "center") {
      return Math.max(renderSettings.pagePadding, (renderSettings.canvasWidth - lineWidth) / 2);
    }

    if (renderSettings.alignment === "right") {
      return Math.max(renderSettings.pagePadding, renderSettings.canvasWidth - renderSettings.pagePadding - lineWidth);
    }

    return renderSettings.pagePadding;
  }

  function drawPresetTextToCanvas(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    renderSettings: PreviewImageSettings,
    options: {
      fontSize: number;
      fontForText?: FontSet;
      preset: FontPreset;
      startX?: number;
      startY: number;
      useHeaderLetters?: boolean;
    },
  ) {
    const lineHeight = getPresetLineHeight(renderSettings, options.fontSize);
    const letterSpacing = options.fontForText ? getFontLetterSpacing(options.fontForText, options.fontSize) : 0;
    ctx.fillStyle = renderSettings.inkColor;
    ctx.textBaseline = "top";
    setPresetCanvasFont(ctx, options.preset, options.fontSize);

    lines.forEach((line, lineIndex) => {
      let x = options.startX ??
        getPresetLineX(
          ctx,
          line,
          renderSettings,
          options.preset,
          options.fontSize,
          options.fontForText,
          options.useHeaderLetters,
        );
      const y = options.startY + lineIndex * lineHeight;

      [...line].forEach((character, characterIndex) => {
        const metrics = getPresetCharacterMetrics(
          ctx,
          character,
          options.fontSize,
          options.fontForText,
          options.useHeaderLetters,
        );

        if (character.trim().length > 0) {
          ctx.save();
          ctx.translate(x + metrics.leftBearingOffset, y + metrics.topOffset);
          ctx.scale(metrics.widthScale, metrics.heightScale);
          ctx.fillText(character, 0, 0);
          ctx.restore();
        }

        x += metrics.advance + (characterIndex < line.length - 1 ? letterSpacing : 0);
      });
    });
  }

  function getActivePresetFontSize(fontSize: number) {
    return fontSize;
  }

  function drawTextToCanvas(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    renderSettings: PreviewImageSettings,
    options: {
      font?: FontSet;
      fontSize?: number;
      sourceText?: string;
      startX?: number;
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
    const letterSpacing = getFontLetterSpacing(fontForText, fontSize);
    const lineHeight = fontSize * renderSettings.lineSpacing;
    ctx.font = getFallbackFont(fontSize);
    ctx.textBaseline = "top";

    lines.forEach((line, lineIndex) => {
      let x = options.startX ?? getLineX(ctx, line, renderSettings, fontSize, useHeaderLetters, fontForText);
      const y = startY + lineIndex * lineHeight;

      [...line].forEach((character, characterIndex) => {
        const glyphKey = getPreviewGlyphKey(character, useHeaderLetters);
        const metricGlyph = getMetricGlyphForCharacter(fontForText, character, useHeaderLetters);
        const glyph = selectPreviewGlyph(
          fontForText.glyphs,
          glyphKey,
          `${fontForText.id}|${sourceText}|${useHeaderLetters ? "header" : "body"}|${lineIndex}|${characterIndex}|${character}`,
        );

        if (glyph) {
          const scales = getGlyphRenderScales(fontForText, glyph);
          const baselineY = y + fontSize * 0.76 * fontHeightScale;
          const glyphX = x + getGlyphLeftBearingOffset(fontForText, glyph, fontSize);
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
            letterSpacing,
          );
          return;
        }

        if (character === spacebar) {
          x += getTrackedCharacterAdvance(
            measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText),
            letterSpacing,
          );
          return;
        }

        const fallbackWidth = measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText);
        const fallbackHeightScale = (metricGlyph?.height ?? 1) * fontHeightScale;
        const fallbackWidthScale = (metricGlyph?.width ?? 1) * fontWidthScale;
        const fallbackBaselineY = y + fontSize * 0.76 * fontHeightScale;
        const fallbackX = x + (metricGlyph ? getGlyphLeftBearingOffset(fontForText, metricGlyph, fontSize) : 0);
        const fallbackY = metricGlyph
          ? getGlyphTopForBaseline(metricGlyph, fontSize, fallbackBaselineY, fallbackHeightScale)
          : y + fontSize * 0.04;

        ctx.save();
        ctx.fillStyle = renderSettings.inkColor;
        ctx.translate(fallbackX, fallbackY);
        ctx.scale(fallbackWidthScale, fallbackHeightScale);
        ctx.fillText(character, 0, 0);
        ctx.restore();
        x += getTrackedCharacterAdvance(fallbackWidth, letterSpacing);
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
      startX?: number;
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
    const letterSpacing = getFontLetterSpacing(fontForText, fontSize);
    const lineHeight = fontSize * renderSettings.lineSpacing;
    ctx.font = getFallbackFont(fontSize);

    return lines.flatMap((line, lineIndex) => {
      let x = options.startX ?? getLineX(ctx, line, renderSettings, fontSize, useHeaderLetters, fontForText);
      const y = startY + lineIndex * lineHeight - fontSize * 0.08;

      return [...line].flatMap((character, characterIndex) => {
        const glyphKey = getPreviewGlyphKey(character, useHeaderLetters);
        const metricGlyph = getMetricGlyphForCharacter(fontForText, character, useHeaderLetters);
        const glyph = selectPreviewGlyph(
          fontForText.glyphs,
          glyphKey,
          `${fontForText.id}|${sourceText}|${useHeaderLetters ? "header" : "body"}|${lineIndex}|${characterIndex}|${character}`,
        );
        const characterWidth = glyph
          ? getGlyphAdvance(glyph, fontSize, fontWidthScale)
          : measureCharacter(ctx, character, fontSize, useHeaderLetters, fontForText);
        const characterHeightScale = glyph
          ? getGlyphRenderScales(fontForText, glyph).heightScale
          : (metricGlyph?.height ?? 1) * fontHeightScale;
        const targetHeight = Math.max(lineHeight, fontSize * 1.08 * characterHeightScale);
        const target: PreviewGlyphHitTarget = {
          character,
          editableCharacter: glyph?.character ?? glyphKey,
          height: targetHeight,
          width: Math.max(1, characterWidth),
          x,
          y,
        };

        x += getTrackedCharacterAdvance(characterWidth, letterSpacing);

        if (character.trim().length === 0 || fontForText.id !== previewFont.id || !fontForText.glyphs[target.editableCharacter]) {
          return [];
        }

        return [target];
      });
    });
  }

  function getPresetPreviewGlyphHitTargets(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    renderSettings: PreviewImageSettings,
    preset: FontPreset,
    options: {
      font?: FontSet;
      fontSize?: number;
      startX?: number;
      startY?: number;
      useHeaderLetters?: boolean;
    } = {},
  ): PreviewGlyphHitTarget[] {
    const fontForText = options.font ?? previewFont;
    const fontSize = options.fontSize ?? renderSettings.fontSize;
    const startY = options.startY ?? renderSettings.pagePadding;
    const useHeaderLetters = options.useHeaderLetters ?? false;
    const letterSpacing = getFontLetterSpacing(fontForText, fontSize);
    const lineHeight = getPresetLineHeight(renderSettings, fontSize);
    setPresetCanvasFont(ctx, preset, fontSize);

    return lines.flatMap((line, lineIndex) => {
      let x = options.startX ?? getPresetLineX(ctx, line, renderSettings, preset, fontSize, fontForText, useHeaderLetters);
      const y = startY + lineIndex * lineHeight;
      const lineCharacters = [...line];

      return lineCharacters.flatMap((character, characterIndex) => {
        const metricGlyph = getMetricGlyphForCharacter(fontForText, character, useHeaderLetters);
        const glyphKey = getPreviewGlyphKey(character, useHeaderLetters);
        const editableCharacter = metricGlyph?.character ?? glyphKey;
        const metrics = getPresetCharacterMetrics(ctx, character, fontSize, fontForText, useHeaderLetters);
        const targetX = x + Math.min(0, metrics.leftBearingOffset);
        const targetY = y + Math.min(0, metrics.topOffset) - fontSize * 0.08;
        const target: PreviewGlyphHitTarget = {
          character,
          editableCharacter,
          height: Math.max(lineHeight, fontSize * 1.08 * metrics.heightScale + Math.abs(metrics.topOffset)),
          width: Math.max(1, metrics.advance, metrics.visualWidth + Math.abs(metrics.leftBearingOffset)),
          x: targetX,
          y: targetY,
        };

        x += metrics.advance + (characterIndex < lineCharacters.length - 1 ? letterSpacing : 0);

        if (character.trim().length === 0 || fontForText.id !== previewFont.id || !fontForText.glyphs[editableCharacter]) {
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
    const headerPlacement = getPreviewTextCanvasPlacement("preview-header", layout.settings);
    const bodyPlacement = getPreviewTextCanvasPlacement("preview-body", layout.settings);

    const targets = activeFontPreset
      ? [
          ...getPresetPreviewGlyphHitTargets(ctx, layout.headerLines, layout.settings, activeFontPreset, {
            font: previewFont,
            fontSize: layout.headerFontSize,
            startX: headerPlacement?.x,
            startY: headerPlacement?.y ?? layout.settings.pagePadding,
            useHeaderLetters: true,
          }),
          ...getPresetPreviewGlyphHitTargets(ctx, layout.lines, layout.settings, activeFontPreset, {
            font: previewFont,
            fontSize: layout.bodyFontSize,
            startX: bodyPlacement?.x,
            startY: bodyPlacement?.y ?? layout.bodyStartY,
          }),
        ]
      : [
          ...getPreviewGlyphHitTargets(ctx, layout.headerLines, layout.settings, {
            font: previewFont,
            fontSize: layout.headerFontSize,
            sourceText: headerPreviewText,
            startX: headerPlacement?.x,
            startY: headerPlacement?.y ?? layout.settings.pagePadding,
            useHeaderLetters: true,
          }),
          ...getPreviewGlyphHitTargets(ctx, layout.lines, layout.settings, {
            font: previewFont,
            fontSize: layout.bodyFontSize,
            sourceText: previewText,
            startX: bodyPlacement?.x,
            startY: bodyPlacement?.y ?? layout.bodyStartY,
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
    const selectingLetterFromSelect =
      activeSettingsPanel === "font" &&
      styleSelectModeActive &&
      styleSelectTarget === "letter";

    setFontEffectsMenuOpen(false);
    onSelectCharacter(hitTarget.editableCharacter);
    setActiveSettingsPanel(selectingLetterFromSelect ? "font" : "letter");
    setFullscreenSelectMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setStyleSelectModeActive(selectingLetterFromSelect);
    setStyleMoveModeActive(false);
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
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

      if (!viewerCanvasRef.current) {
        return;
      }

      renderPhoneImageToCanvas(viewerCanvasRef.current, {
        doodleStrokes: getActivePreviewDoodleStrokes(),
        showSelection: true,
        stickers: previewStickersRef.current,
      });
    });
  }

  function getImageStickerAspectRatio(asset: StyleStickerAsset) {
    const image = styleStickerImagesRef.current[asset.kind];

    if (image?.naturalWidth && image.naturalHeight) {
      return image.naturalWidth / image.naturalHeight;
    }

    return asset.aspectRatio ?? 1;
  }

  function getPreviewStickerWidthScale(sticker: PreviewSticker) {
    return Math.max(0.35, sticker.widthScale ?? 1);
  }

  function getPreviewStickerHeightScale(sticker: PreviewSticker) {
    return Math.max(0.35, sticker.heightScale ?? 1);
  }

  function getPreviewDoodleWidthScale(stroke: PreviewDoodleStroke) {
    return Math.max(0.35, stroke.widthScale ?? 1);
  }

  function getPreviewDoodleHeightScale(stroke: PreviewDoodleStroke) {
    return Math.max(0.35, stroke.heightScale ?? 1);
  }

  function getPreviewDoodleBounds(stroke: PreviewDoodleStroke) {
    const firstPoint = stroke.points[0];

    if (!firstPoint) {
      return null;
    }

    return stroke.points.reduce(
      (bounds, point) => ({
        maxX: Math.max(bounds.maxX, point.x),
        maxY: Math.max(bounds.maxY, point.y),
        minX: Math.min(bounds.minX, point.x),
        minY: Math.min(bounds.minY, point.y),
      }),
      {
        maxX: firstPoint.x,
        maxY: firstPoint.y,
        minX: firstPoint.x,
        minY: firstPoint.y,
      },
    );
  }

  function getPreviewDoodleRenderPoints(stroke: PreviewDoodleStroke) {
    const widthScale = getPreviewDoodleWidthScale(stroke);
    const heightScale = getPreviewDoodleHeightScale(stroke);

    if (widthScale === 1 && heightScale === 1) {
      return stroke.points;
    }

    const bounds = getPreviewDoodleBounds(stroke);

    if (!bounds) {
      return stroke.points;
    }

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerY = (bounds.minY + bounds.maxY) / 2;

    return stroke.points.map((point) => ({
      ...point,
      x: centerX + (point.x - centerX) * widthScale,
      y: centerY + (point.y - centerY) * heightScale,
    }));
  }

  function getPreviewImageStickerCanvasBox(
    sticker: PreviewSticker,
    renderSettings: PreviewImageSettings,
  ) {
    const asset = getStyleStickerAsset(sticker.kind);

    if (!asset.src) {
      return null;
    }

    const baseWidth = Math.max(1, sticker.size * renderSettings.canvasWidth);
    const baseHeight = baseWidth / getImageStickerAspectRatio(asset);
    const width = baseWidth * getPreviewStickerWidthScale(sticker);
    const height = baseHeight * getPreviewStickerHeightScale(sticker);

    return {
      height,
      width,
      x: sticker.x * renderSettings.canvasWidth - width / 2,
      y: sticker.y * renderSettings.canvasHeight - height / 2,
    };
  }

  function getPreviewColorSwatchCanvasBox(
    sticker: PreviewSticker,
    renderSettings: PreviewImageSettings,
  ) {
    if (!isColorSwatchPreviewSticker(sticker)) {
      return null;
    }

    const baseSize = Math.max(1, sticker.size * renderSettings.canvasWidth);
    const width = baseSize * getPreviewStickerWidthScale(sticker);
    const height = baseSize * getPreviewStickerHeightScale(sticker);

    return {
      height,
      width,
      x: sticker.x * renderSettings.canvasWidth - width / 2,
      y: sticker.y * renderSettings.canvasHeight - height / 2,
    };
  }

  function getPreviewImageStickerNormalizedBox(
    sticker: PreviewSticker,
    renderSettings: PreviewImageSettings,
  ) {
    const box = getPreviewImageStickerCanvasBox(sticker, renderSettings) ??
      getPreviewColorSwatchCanvasBox(sticker, renderSettings);

    if (!box) {
      return null;
    }

    return {
      height: box.height / renderSettings.canvasHeight,
      width: box.width / renderSettings.canvasWidth,
      x: box.x / renderSettings.canvasWidth,
      y: box.y / renderSettings.canvasHeight,
    };
  }

  function findPreviewStickerAtPoint(
    point: PreviewDoodlePoint,
    fallbackToEditableSticker = true,
    filterSticker: (sticker: PreviewSticker) => boolean = () => true,
  ) {
    if (previewStickers.length === 0) {
      return null;
    }

    const renderSettings = getScaledPreviewSettings(imageSettings, STYLE_CANVAS_MAX_PIXELS);
    const hitSticker = [...previewStickers].reverse().find((sticker) => {
      if (!filterSticker(sticker)) {
        return false;
      }

      const imageBox = getPreviewImageStickerNormalizedBox(sticker, renderSettings);

      if (imageBox) {
        return (
          point.x >= imageBox.x &&
          point.x <= imageBox.x + imageBox.width &&
          point.y >= imageBox.y &&
          point.y <= imageBox.y + imageBox.height
        );
      }

      const hitRadiusX = Math.max(0.06, sticker.size * 2.8 * getPreviewStickerWidthScale(sticker));
      const hitRadiusY = Math.max(0.06, sticker.size * 2.8 * getPreviewStickerHeightScale(sticker));
      return Math.hypot((point.x - sticker.x) / hitRadiusX, (point.y - sticker.y) / hitRadiusY) <= 1;
    });

    return hitSticker?.id ?? (fallbackToEditableSticker ? getEditablePreviewStickerId(previewStickers, filterSticker) : null);
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
      const renderPoints = getPreviewDoodleRenderPoints(stroke);
      const distances = renderPoints.length === 1
        ? [Math.hypot(point.x - renderPoints[0].x, point.y - renderPoints[0].y)]
        : renderPoints.slice(1).map((strokePoint, index) =>
            getDistanceToSegment(point, renderPoints[index], strokePoint),
          );
      const distance = Math.min(...distances);

      if (distance <= hitRadius && distance < bestDistance) {
        bestDistance = distance;
        bestMatchId = stroke.id;
      }
    });

    return bestMatchId;
  }

  function findPreviewTextTargetAtPoint(canvas: HTMLCanvasElement, point: PreviewDoodlePoint) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    const renderSettings = getScaledPreviewSettings(imageSettings, STYLE_CANVAS_MAX_PIXELS);
    const targets = getAllPreviewTextHitTargets(ctx, renderSettings);
    const x = point.x * renderSettings.canvasWidth;
    const y = point.y * renderSettings.canvasHeight;
    const visiblePadding = PREVIEW_TEXT_SELECTION_HIT_PADDING;
    const hitSlop = Math.max(42, renderSettings.canvasWidth / 24);
    const targetStack = [...targets].reverse();

    const directTarget = targetStack.find((target) =>
      x >= target.x - visiblePadding &&
      x <= target.x + target.width + visiblePadding &&
      y >= target.y - visiblePadding &&
      y <= target.y + target.height + visiblePadding,
    );

    if (directTarget) {
      return directTarget;
    }

    let nearestTarget: PreviewTextLayerHitTarget | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const target of targetStack) {
      const nearestX = Math.min(Math.max(x, target.x), target.x + target.width);
      const nearestY = Math.min(Math.max(y, target.y), target.y + target.height);
      const distance = Math.hypot(x - nearestX, y - nearestY);

      if (distance <= hitSlop && distance < nearestDistance) {
        nearestTarget = target;
        nearestDistance = distance;
      }
    }

    return nearestTarget;
  }

  function findPreviewTextLayerAtPoint(canvas: HTMLCanvasElement, point: PreviewDoodlePoint) {
    return findPreviewTextTargetAtPoint(canvas, point)?.id ?? null;
  }

  function selectPreviewTextTargetAtPoint(point: PreviewDoodlePoint, canvas: HTMLCanvasElement) {
    const textLayerId = findPreviewTextLayerAtPoint(canvas, point);

    if (!textLayerId) {
      return false;
    }

    setStyleSelectTarget("text");
    setSelectedPreviewTextLayerId(textLayerId);
    setSelectedPreviewStickerId(null);
    setSelectedPreviewDoodleId(null);
    setShareStatus("Selected text.");
    scheduleStyleCanvasRender();
    return true;
  }

  function isTextSelectionTarget(target = styleSelectTarget) {
    return target === "text" || target === "letter";
  }

  function handleStyleSelection(point: PreviewDoodlePoint, canvas: HTMLCanvasElement) {
    if (styleSelectTarget === "stickers" || styleSelectTarget === "ornaments") {
      const selectingOrnament = styleSelectTarget === "ornaments";
      const stickerId = findPreviewStickerAtPoint(
        point,
        false,
        (sticker) => selectingOrnament ? !isEyePreviewSticker(sticker) : isEyePreviewSticker(sticker),
      );

      if (!stickerId && selectPreviewTextTargetAtPoint(point, canvas)) {
        return;
      }

      setSelectedPreviewStickerId(stickerId);
      setSelectedPreviewTextLayerId(null);
      setSelectedPreviewDoodleId(null);
      setShareStatus(
        stickerId
          ? `Selected ${selectingOrnament ? "ornament" : "sticker"}.`
          : `No ${selectingOrnament ? "ornament" : "sticker"} selected.`,
      );
      scheduleStyleCanvasRender();
      return;
    }

    if (isTextSelectionTarget()) {
      const textLayerId = findPreviewTextLayerAtPoint(canvas, point);
      setSelectedPreviewTextLayerId(textLayerId);
      setSelectedPreviewStickerId(null);
      setSelectedPreviewDoodleId(null);
      setShareStatus(textLayerId ? "Selected text." : "No text selected.");
      scheduleStyleCanvasRender();
      return;
    }

    const doodleId = findPreviewDoodleAtPoint(point);

    if (!doodleId && selectPreviewTextTargetAtPoint(point, canvas)) {
      return;
    }

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
    setActiveDocumentId(null);
    scheduleStyleCanvasRender();
  }

  function getClampedTextPlacement(
    target: PreviewTextLayerHitTarget,
    point: PreviewDoodlePoint,
    offsetX: number,
    offsetY: number,
    renderSettings: PreviewImageSettings,
  ): PreviewTextPlacement {
    const width = Math.min(1, target.width / Math.max(1, renderSettings.canvasWidth));
    const height = Math.min(1, target.height / Math.max(1, renderSettings.canvasHeight));

    return {
      x: Math.min(Math.max(0, 1 - width), Math.max(0, point.x - offsetX)),
      y: Math.min(Math.max(0, 1 - height), Math.max(0, point.y - offsetY)),
    };
  }

  function setPreviewTextTargetPlacement(targetId: string, placement: PreviewTextPlacement) {
    if (targetId === "preview-header" || targetId === "preview-body") {
      setPreviewTextTargetPlacements((current) => ({
        ...current,
        [targetId]: {
          ...current[targetId],
          ...placement,
        },
      }));
      return;
    }

    setPreviewTextLayers((current) =>
      current.map((layer) =>
        layer.id === targetId
          ? {
              ...layer,
              x: placement.x,
              y: placement.y,
            }
          : layer,
      ),
    );
  }

  function movePreviewTextTargetTo(
    targetId: string,
    target: PreviewTextLayerHitTarget,
    point: PreviewDoodlePoint,
    offsetX: number,
    offsetY: number,
  ) {
    const renderSettings = getScaledPreviewSettings(imageSettings, STYLE_CANVAS_MAX_PIXELS);
    const placement = getClampedTextPlacement(target, point, offsetX, offsetY, renderSettings);

    setPreviewTextTargetPlacement(targetId, placement);
    setSelectedPreviewTextLayerId(targetId);
    setSelectedPreviewStickerId(null);
    setSelectedPreviewDoodleId(null);
    setActiveDocumentId(null);
    scheduleStyleCanvasRender();
  }

  function movePreviewDoodleBy(doodleId: string, fromPoint: PreviewDoodlePoint, toPoint: PreviewDoodlePoint) {
    const dx = toPoint.x - fromPoint.x;
    const dy = toPoint.y - fromPoint.y;

    setSelectedPreviewDoodleId(doodleId);
    setPreviewDoodles((current) => {
      const nextDoodles = current.map((stroke) =>
        stroke.id === doodleId
          ? {
              ...stroke,
              points: stroke.points.map((point) => ({
                ...point,
                x: clampPreviewPoint(point.x + dx),
                y: clampPreviewPoint(point.y + dy),
              })),
            }
          : stroke,
      );

      previewDoodlesRef.current = nextDoodles;
      return nextDoodles;
    });
    setSelectedPreviewStickerId(null);
    setSelectedPreviewTextLayerId(null);
    setActiveDocumentId(null);
    scheduleStyleCanvasRender();
  }

  function handleStyleCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (styleStickerLookMode) {
      event.preventDefault();

      if (!selectedPreviewStickerId || !isEyePreviewSticker(selectedPreviewSticker)) {
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

    if (styleMoveModeActive) {
      event.preventDefault();
      const point = getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY);

      if (styleSelectTarget === "text") {
        const target = findPreviewTextTargetAtPoint(event.currentTarget, point);

        if (!target) {
          setShareStatus("No text there.");
          return;
        }

        const renderSettings = getScaledPreviewSettings(imageSettings, STYLE_CANVAS_MAX_PIXELS);
        const offsetX = point.x - target.x / Math.max(1, renderSettings.canvasWidth);
        const offsetY = point.y - target.y / Math.max(1, renderSettings.canvasHeight);

        styleMovingTextRef.current = {
          id: target.id,
          offsetX,
          offsetY,
          target,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        movePreviewTextTargetTo(target.id, target, point, offsetX, offsetY);
        setShareStatus("Dragging text.");
        return;
      }

      if (styleSelectTarget === "stickers" || styleSelectTarget === "ornaments") {
        const selectingOrnament = styleSelectTarget === "ornaments";
        const stickerId = findPreviewStickerAtPoint(
          point,
          false,
          (sticker) => selectingOrnament ? !isEyePreviewSticker(sticker) : isEyePreviewSticker(sticker),
        );

        if (!stickerId) {
          setShareStatus(`No ${selectingOrnament ? "ornament" : "sticker"} there.`);
          return;
        }

        styleMovingStickerRef.current = stickerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        movePreviewStickerTo(stickerId, point);
        setSelectedPreviewTextLayerId(null);
        setSelectedPreviewDoodleId(null);
        setShareStatus(`Dragging ${selectingOrnament ? "ornament" : "sticker"}.`);
        return;
      }

      if (styleSelectTarget === "doodles") {
        const doodleId = findPreviewDoodleAtPoint(point);

        if (!doodleId) {
          setShareStatus("No doodle there.");
          return;
        }

        styleMovingDoodleRef.current = {
          id: doodleId,
          lastPoint: point,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setSelectedPreviewDoodleId(doodleId);
        setSelectedPreviewStickerId(null);
        setSelectedPreviewTextLayerId(null);
        scheduleStyleCanvasRender();
        setShareStatus("Dragging doodle.");
        return;
      }

      setShareStatus("That target cannot be moved.");
      return;
    }

    if (styleStickerMoveMode) {
      event.preventDefault();
      const point = getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY);
      const stickerId = findPreviewStickerAtPoint(point);

      if (!stickerId) {
        setShareStatus("Add a sticker first.");
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
      baseSize: styleDoodleBrushSize / Math.max(1, imageSettings.canvasWidth),
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
    if (styleMoveModeActive && styleMovingTextRef.current) {
      event.preventDefault();
      const movingText = styleMovingTextRef.current;
      movePreviewTextTargetTo(
        movingText.id,
        movingText.target,
        getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY),
        movingText.offsetX,
        movingText.offsetY,
      );

      return;
    }

    if (styleMoveModeActive && styleMovingDoodleRef.current) {
      event.preventDefault();
      const point = getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY);
      movePreviewDoodleBy(styleMovingDoodleRef.current.id, styleMovingDoodleRef.current.lastPoint, point);
      styleMovingDoodleRef.current = {
        ...styleMovingDoodleRef.current,
        lastPoint: point,
      };
      return;
    }

    if ((styleStickerMoveMode || styleMoveModeActive) && styleMovingStickerRef.current) {
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
    if (styleMovingTextRef.current || styleMovingDoodleRef.current) {
      event.preventDefault();
      styleMovingTextRef.current = null;
      styleMovingDoodleRef.current = null;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      return;
    }

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

  function shouldUsePreviewStyleInteractions() {
    return (
      activeSettingsPanel === "decor" ||
      styleDrawMode ||
      styleStickerLookMode ||
      styleMoveModeActive ||
      styleStickerMoveMode ||
      Boolean(styleActiveStrokeRef.current) ||
      Boolean(styleMovingStickerRef.current) ||
      Boolean(styleMovingTextRef.current) ||
      Boolean(styleMovingDoodleRef.current) ||
      (
        activeSettingsPanel === "font" &&
        styleSelectModeActive &&
        styleSelectTarget !== "letter"
      )
    );
  }

  function handleViewerCanvasPointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (shouldUsePreviewStyleInteractions()) {
      previewPointerStartRef.current = null;
      handleStyleCanvasPointerDown(event);
      return;
    }

    handleFullscreenPreviewPointerDown(event);
  }

  function handleViewerCanvasClick(event: ReactMouseEvent<HTMLCanvasElement>) {
    if (
      !styleDrawMode &&
      !styleMoveModeActive &&
      !styleStickerLookMode &&
      !styleStickerMoveMode &&
      styleSelectModeActive &&
      !styleSelectMenuOpen &&
      !fullscreenSelectMenuOpen &&
      styleSelectTarget !== "letter"
    ) {
      event.preventDefault();
      handleStyleSelection(getStyleCanvasPoint(event.currentTarget, event.clientX, event.clientY), event.currentTarget);
    }
  }

  function handleViewerCanvasPointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (shouldUsePreviewStyleInteractions()) {
      handleStyleCanvasPointerMove(event);
    }
  }

  function handleViewerCanvasPointerEnd(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (shouldUsePreviewStyleInteractions()) {
      handleStyleCanvasPointerEnd(event);
      return;
    }

    handleFullscreenPreviewPointerUp(event);
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

    if (["strawberryRed", "berryPink", "strawberryCream"].includes(renderSettings.backgroundStyle)) {
      const gradient = ctx.createLinearGradient(0, 0, imageWidth, imageHeight);
      gradient.addColorStop(0, "#fffaf5");
      gradient.addColorStop(0.5, renderSettings.backgroundColor);
      gradient.addColorStop(1, renderSettings.accentColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, imageWidth, imageHeight);
      drawPaperTexture(ctx, "#ffffff", imageWidth, imageHeight);
      drawSelectedImageTexture(ctx, renderSettings);
      return;
    }

    if (["midnightParchment", "midnightMoonlit", "midnightSlate"].includes(renderSettings.backgroundStyle)) {
      const gradient = ctx.createLinearGradient(0, 0, imageWidth, imageHeight);
      gradient.addColorStop(0, renderSettings.backgroundStyle === "midnightSlate" ? "#e9e5dc" : "#fffdf8");
      gradient.addColorStop(0.52, renderSettings.backgroundColor);
      gradient.addColorStop(1, renderSettings.backgroundStyle === "midnightParchment" ? "#d6c8a7" : "#a8b0bf");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, imageWidth, imageHeight);
      drawPaperTexture(ctx, renderSettings.backgroundStyle === "midnightSlate" ? "#2b2f3a" : "#ffffff", imageWidth, imageHeight);
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
      if (isColorSwatchPreviewSticker(sticker)) {
        drawPreviewColorSwatch(ctx, renderSettings, sticker);
        return;
      }

      if (!isEyePreviewSticker(sticker)) {
        drawPreviewImageSticker(ctx, renderSettings, sticker);
        return;
      }

      if (
        sticker.faceMood !== undefined ||
        sticker.lookAt ||
        (sticker.redness ?? 0) > 0 ||
        (sticker.sleepiness ?? 0) > 0
      ) {
        drawCustomPreviewSticker(ctx, renderSettings, sticker);
        return;
      }

      const centerX = sticker.x * renderSettings.canvasWidth;
      const centerY = sticker.y * renderSettings.canvasHeight;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(getPreviewStickerWidthScale(sticker), getPreviewStickerHeightScale(sticker));
      ctx.translate(-centerX, -centerY);
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
      ctx.restore();
    });
  }

  function getPreviewColorSwatchColor(sticker: PreviewSticker) {
    return normalizePreviewPaletteHex(sticker.color ?? imageSettings.inkColor, imageSettings.inkColor);
  }

  function drawPreviewColorSwatch(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    sticker: PreviewSticker,
  ) {
    const box = getPreviewColorSwatchCanvasBox(sticker, renderSettings);

    if (!box) {
      return;
    }

    const strokeWidth = Math.max(1, Math.round(renderSettings.canvasWidth / 600));

    ctx.save();
    ctx.fillStyle = getPreviewColorSwatchColor(sticker);
    ctx.fillRect(box.x, box.y, box.width, box.height);
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = "rgba(23, 17, 11, 0.32)";
    ctx.strokeRect(box.x + strokeWidth / 2, box.y + strokeWidth / 2, box.width - strokeWidth, box.height - strokeWidth);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.strokeRect(
      box.x + strokeWidth * 1.5,
      box.y + strokeWidth * 1.5,
      Math.max(1, box.width - strokeWidth * 3),
      Math.max(1, box.height - strokeWidth * 3),
    );
    ctx.restore();
  }

  function drawPreviewImageSticker(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    sticker: PreviewSticker,
  ) {
    const asset = getStyleStickerAsset(sticker.kind);
    const image = styleStickerImagesRef.current[asset.kind];
    const box = getPreviewImageStickerCanvasBox(sticker, renderSettings);

    if (!asset.src || !box) {
      return;
    }

    if (!image?.complete || !image.naturalWidth) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = imageSettings.accentColor;
      ctx.lineWidth = Math.max(1, renderSettings.canvasWidth / 900);
      ctx.strokeRect(box.x, box.y, box.width, box.height);
      ctx.restore();
      return;
    }

    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, box.x, box.y, box.width, box.height);
    ctx.restore();
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
    ctx.translate(centerX, centerY);
    ctx.scale(getPreviewStickerWidthScale(sticker), getPreviewStickerHeightScale(sticker));
    ctx.translate(-centerX, -centerY);
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
        points: getPreviewDoodleRenderPoints(stroke),
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

  function drawLongSkinnyPaperRules(
    ctx: CanvasRenderingContext2D,
    layout: PhoneImageLayout,
    bodyFontSize: number,
  ) {
    if (!shouldUseLongSkinnyFormat(layout.settings)) {
      return;
    }

    const imageWidth = layout.settings.canvasWidth;
    const imageHeight = layout.settings.canvasHeight;
    const fontHeightScale = getFontHeightScale(previewFont);
    const baselineY = layout.bodyStartY + bodyFontSize * 0.76 * fontHeightScale;
    const indexX = Math.max(18, layout.settings.pagePadding * 0.56);

    ctx.save();
    ctx.lineCap = "butt";

    ctx.strokeStyle = "#7fb7d8";
    ctx.globalAlpha = 0.62;
    ctx.lineWidth = Math.max(1.2, bodyFontSize * 0.035);
    ctx.beginPath();
    ctx.moveTo(0, Math.round(baselineY) + 0.5);
    ctx.lineTo(imageWidth, Math.round(baselineY) + 0.5);
    ctx.stroke();

    ctx.strokeStyle = "#dc8ba0";
    ctx.globalAlpha = 0.52;
    ctx.lineWidth = Math.max(1.2, bodyFontSize * 0.028);
    ctx.beginPath();
    ctx.moveTo(Math.round(indexX) + 0.5, 0);
    ctx.lineTo(Math.round(indexX) + 0.5, imageHeight);
    ctx.stroke();

    ctx.restore();
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

  function shouldUseLongSkinnyFormat(renderSettings: PreviewImageSettings) {
    return renderSettings.exportPreset === "longSkinny" || (renderSettings.exportPreset as string) === "extreme";
  }

  function getLongSkinnySingleLineBodyText(text: string) {
    const singleLine = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ");

    return [singleLine];
  }

  function getLongSkinnyLayoutSettings(
    renderSettings: PreviewImageSettings,
    bodyLineWidth: number,
    bodyStartY: number,
    bodyVisualHeight: number,
    hasHeaderText: boolean,
  ): { bodyEndY: number; bodyStartY: number; settings: PreviewImageSettings } {
    const horizontalPadding = Math.max(renderSettings.pagePadding, renderSettings.fontSize * 0.5);
    const topPadding = Math.max(10, Math.ceil(bodyVisualHeight * LONG_SKINNY_TOP_PADDING_RATIO));
    const bottomPadding = Math.max(6, Math.ceil(bodyVisualHeight * LONG_SKINNY_BOTTOM_PADDING_RATIO));
    const canvasWidth = Math.max(1, Math.ceil(bodyLineWidth + horizontalPadding * 2));
    const canvasHeight = Math.min(
      MAX_IMAGE_CANVAS_HEIGHT,
      Math.max(1, Math.ceil(bodyVisualHeight + topPadding + bottomPadding)),
    );
    const nextBodyStartY = hasHeaderText ? bodyStartY : topPadding;

    return {
      bodyEndY: nextBodyStartY + bodyVisualHeight,
      bodyStartY: nextBodyStartY,
      settings: {
        ...renderSettings,
        canvasHeight,
        canvasWidth,
        pagePadding: horizontalPadding,
      },
    };
  }

  function getPreviewTextTargetSizeScale(targetId: string) {
    const layer = previewTextLayers.find((item) => item.id === targetId);

    if (layer) {
      return getClampedMetricValue(layer.sizeScale, 0.45, 2.5, 2);
    }

    const placementScale = previewTextTargetPlacements[targetId]?.sizeScale;

    return typeof placementScale === "number" ? getClampedMetricValue(placementScale, 0.45, 2.5, 2) : 1;
  }

  function getPreviewTextTargetBaseSizeScale(targetId: string) {
    if (targetId === "preview-header" || targetId === "preview-body") {
      return getPreviewTextTargetSizeScale(targetId);
    }

    return selectedPreviewTextLayer?.id === targetId
      ? getClampedMetricValue(selectedPreviewTextLayer.sizeScale, 0.45, 2.5, 2)
      : 1;
  }

  function getPhoneImageLayout(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings = imageSettings,
  ): PhoneImageLayout {
    const maxLineWidth = Math.max(1, renderSettings.canvasWidth - renderSettings.pagePadding * 2);
    const headerFontSize = renderSettings.fontSize * HEADER_FONT_SIZE_MULTIPLIER * getPreviewTextTargetSizeScale("preview-header");
    const bodyFontSize = renderSettings.fontSize * getPreviewTextTargetSizeScale("preview-body");
    const hasHeaderText = headerPreviewText.trim().length > 0;
    const useLongSkinnyFormat = shouldUseLongSkinnyFormat(renderSettings);

    if (activeFontPreset) {
      const presetHeaderFontSize = getActivePresetFontSize(headerFontSize);
      const presetBodyFontSize = getActivePresetFontSize(bodyFontSize);
      const headerLines = hasHeaderText
        ? renderSettings.autoFit
          ? buildPresetWordWrappedLines(
              ctx,
              headerPreviewText,
              maxLineWidth,
              activeFontPreset,
              presetHeaderFontSize,
              previewFont,
              true,
            )
          : buildPresetCharacterWrappedLines(
              ctx,
              headerPreviewText,
              maxLineWidth,
              activeFontPreset,
              presetHeaderFontSize,
              previewFont,
              true,
            )
        : [];
      const headerLineHeight = getPresetLineHeight(renderSettings, presetHeaderFontSize);
      const headerGap = headerLines.length > 0 ? presetBodyFontSize * 0.85 : 0;
      const bodyStartY = renderSettings.pagePadding + headerLines.length * headerLineHeight + headerGap;
      const wrappedLines = useLongSkinnyFormat
        ? getLongSkinnySingleLineBodyText(previewText)
        : renderSettings.autoFit
          ? buildPresetWordWrappedLines(
              ctx,
              previewText,
              maxLineWidth,
              activeFontPreset,
              presetBodyFontSize,
              previewFont,
            )
          : buildPresetCharacterWrappedLines(
              ctx,
              previewText,
              maxLineWidth,
              activeFontPreset,
              presetBodyFontSize,
              previewFont,
            );
      const bodyLineHeight = getPresetLineHeight(renderSettings, presetBodyFontSize);
      const bodyVisualHeight = useLongSkinnyFormat
        ? bodyLineHeight * Math.max(1, getFontHeightScale(previewFont))
        : bodyLineHeight;
      const bodyEndY = bodyStartY + wrappedLines.length * bodyVisualHeight;
      const longSkinnyLayout = useLongSkinnyFormat
        ? getLongSkinnyLayoutSettings(
            renderSettings,
            (() => {
              setPresetCanvasFont(ctx, activeFontPreset, presetBodyFontSize);
              return measurePresetTextRun(ctx, wrappedLines[0] ?? "", presetBodyFontSize, previewFont);
            })(),
            bodyStartY,
            bodyVisualHeight,
            hasHeaderText,
          )
        : null;

      return {
        settings: longSkinnyLayout?.settings ?? renderSettings,
        bodyEndY: longSkinnyLayout?.bodyEndY ?? bodyEndY,
        bodyFontSize: presetBodyFontSize,
        bodyStartY: longSkinnyLayout?.bodyStartY ?? bodyStartY,
        headerFontSize: presetHeaderFontSize,
        headerLines,
        lines: wrappedLines,
      };
    }

    ctx.font = getFallbackFont(headerFontSize);
    const headerLines = hasHeaderText
      ? renderSettings.autoFit
        ? buildWordWrappedLines(
            ctx,
            headerPreviewText,
            maxLineWidth,
            headerFontSize,
            true,
            previewFont,
          )
        : buildCharacterWrappedLines(
            ctx,
            headerPreviewText,
            maxLineWidth,
            headerFontSize,
            true,
            previewFont,
          )
      : [];
    const headerLineHeight = headerFontSize * renderSettings.lineSpacing;
    const headerGap = headerLines.length > 0 ? bodyFontSize * 0.85 : 0;
    const bodyStartY = renderSettings.pagePadding + headerLines.length * headerLineHeight + headerGap;
    ctx.font = getFallbackFont(bodyFontSize);
    const wrappedLines = useLongSkinnyFormat
      ? getLongSkinnySingleLineBodyText(previewText)
      : renderSettings.autoFit
        ? buildWordWrappedLines(ctx, previewText, maxLineWidth, bodyFontSize, false, previewFont)
        : buildCharacterWrappedLines(ctx, previewText, maxLineWidth, bodyFontSize, false, previewFont);
    const bodyLineHeight = bodyFontSize * renderSettings.lineSpacing;
    const bodyVisualHeight = useLongSkinnyFormat
      ? bodyLineHeight * Math.max(1, getFontHeightScale(previewFont))
      : bodyLineHeight;
    const bodyEndY = bodyStartY + wrappedLines.length * bodyVisualHeight;
    const longSkinnyLayout = useLongSkinnyFormat
      ? getLongSkinnyLayoutSettings(
          renderSettings,
          measureTextRun(ctx, wrappedLines[0] ?? "", bodyFontSize, false, previewFont),
          bodyStartY,
          bodyVisualHeight,
          hasHeaderText,
        )
      : null;

    return {
      settings: longSkinnyLayout?.settings ?? renderSettings,
      bodyEndY: longSkinnyLayout?.bodyEndY ?? bodyEndY,
      bodyFontSize,
      bodyStartY: longSkinnyLayout?.bodyStartY ?? bodyStartY,
      headerFontSize,
      headerLines,
      lines: wrappedLines,
    };
  }

  function getPreviewLayerFontSource(fontId: string): PreviewTextFontSource {
    const preset = getFontPresetFromOptionId(fontId);

    if (preset) {
      return { kind: "preset", preset };
    }

    return {
      font: availableFonts.find((item) => item.id === fontId) ?? previewFont,
      kind: "custom",
    };
  }

  function getPreviewTextPlacement(targetId: string): PreviewTextPlacement | null {
    const textLayer = previewTextLayers.find((layer) => layer.id === targetId);

    if (textLayer && typeof textLayer.x === "number" && typeof textLayer.y === "number") {
      return {
        sizeScale: getClampedMetricValue(textLayer.sizeScale, 0.45, 2.5, 2),
        x: clampPreviewPoint(textLayer.x),
        y: clampPreviewPoint(textLayer.y),
      };
    }

    return previewTextTargetPlacements[targetId] ?? null;
  }

  function resolveAutoEntryPreset(presetId?: string) {
    const preset = presetId ? previewDesignPresets.find((item) => item.id === presetId) : undefined;
    const renderSettings = normalizePreviewSettings(preset?.settings ?? imageSettings);

    if (!preset) {
      return {
        fallbackUsed: true,
        fontForText: previewFont,
        presetFont: undefined as FontPreset | undefined,
        renderSettings,
      };
    }

    const presetFont = getFontPresetFromOptionId(preset.fontOptionId);

    if (presetFont) {
      return {
        fallbackUsed: false,
        fontForText: previewFont,
        presetFont,
        renderSettings,
      };
    }

    return {
      fallbackUsed: !availableFonts.some((item) => item.id === preset.fontOptionId),
      fontForText: availableFonts.find((item) => item.id === preset.fontOptionId) ?? previewFont,
      presetFont: undefined as FontPreset | undefined,
      renderSettings,
    };
  }

  function getAutoEntryPhoneImageLayout(
    ctx: CanvasRenderingContext2D,
    options: {
      bodyText: string;
      fontForText: FontSet;
      headerText: string;
      presetFont?: FontPreset;
      renderSettings: PreviewImageSettings;
    },
  ): PhoneImageLayout {
    const { bodyText, fontForText, headerText, presetFont, renderSettings } = options;
    const maxLineWidth = Math.max(1, renderSettings.canvasWidth - renderSettings.pagePadding * 2);
    const headerFontSize = renderSettings.fontSize * HEADER_FONT_SIZE_MULTIPLIER;
    const bodyFontSize = renderSettings.fontSize;
    const hasHeaderText = headerText.trim().length > 0;
    const useLongSkinnyFormat = shouldUseLongSkinnyFormat(renderSettings);

    if (presetFont) {
      const presetHeaderFontSize = getActivePresetFontSize(headerFontSize);
      const presetBodyFontSize = getActivePresetFontSize(bodyFontSize);
      const headerLines = hasHeaderText
        ? renderSettings.autoFit
          ? buildPresetWordWrappedLines(ctx, headerText, maxLineWidth, presetFont, presetHeaderFontSize, fontForText, true)
          : buildPresetCharacterWrappedLines(ctx, headerText, maxLineWidth, presetFont, presetHeaderFontSize, fontForText, true)
        : [];
      const headerLineHeight = getPresetLineHeight(renderSettings, presetHeaderFontSize);
      const headerGap = headerLines.length > 0 ? presetBodyFontSize * 0.85 : 0;
      const bodyStartY = renderSettings.pagePadding + headerLines.length * headerLineHeight + headerGap;
      const wrappedLines = useLongSkinnyFormat
        ? getLongSkinnySingleLineBodyText(bodyText)
        : renderSettings.autoFit
          ? buildPresetWordWrappedLines(ctx, bodyText, maxLineWidth, presetFont, presetBodyFontSize, fontForText)
          : buildPresetCharacterWrappedLines(ctx, bodyText, maxLineWidth, presetFont, presetBodyFontSize, fontForText);
      const bodyLineHeight = getPresetLineHeight(renderSettings, presetBodyFontSize);
      const bodyVisualHeight = useLongSkinnyFormat
        ? bodyLineHeight * Math.max(1, getFontHeightScale(fontForText))
        : bodyLineHeight;
      const bodyEndY = bodyStartY + wrappedLines.length * bodyVisualHeight;
      const longSkinnyLayout = useLongSkinnyFormat
        ? getLongSkinnyLayoutSettings(
            renderSettings,
            (() => {
              setPresetCanvasFont(ctx, presetFont, presetBodyFontSize);
              return measurePresetTextRun(ctx, wrappedLines[0] ?? "", presetBodyFontSize, fontForText);
            })(),
            bodyStartY,
            bodyVisualHeight,
            hasHeaderText,
          )
        : null;

      return {
        settings: longSkinnyLayout?.settings ?? renderSettings,
        bodyEndY: longSkinnyLayout?.bodyEndY ?? bodyEndY,
        bodyFontSize: presetBodyFontSize,
        bodyStartY: longSkinnyLayout?.bodyStartY ?? bodyStartY,
        headerFontSize: presetHeaderFontSize,
        headerLines,
        lines: wrappedLines,
      };
    }

    ctx.font = getFallbackFont(headerFontSize);
    const headerLines = hasHeaderText
      ? renderSettings.autoFit
        ? buildWordWrappedLines(ctx, headerText, maxLineWidth, headerFontSize, true, fontForText)
        : buildCharacterWrappedLines(ctx, headerText, maxLineWidth, headerFontSize, true, fontForText)
      : [];
    const headerLineHeight = headerFontSize * renderSettings.lineSpacing;
    const headerGap = headerLines.length > 0 ? bodyFontSize * 0.85 : 0;
    const bodyStartY = renderSettings.pagePadding + headerLines.length * headerLineHeight + headerGap;
    ctx.font = getFallbackFont(bodyFontSize);
    const wrappedLines = useLongSkinnyFormat
      ? getLongSkinnySingleLineBodyText(bodyText)
      : renderSettings.autoFit
        ? buildWordWrappedLines(ctx, bodyText, maxLineWidth, bodyFontSize, false, fontForText)
        : buildCharacterWrappedLines(ctx, bodyText, maxLineWidth, bodyFontSize, false, fontForText);
    const bodyLineHeight = bodyFontSize * renderSettings.lineSpacing;
    const bodyVisualHeight = useLongSkinnyFormat
      ? bodyLineHeight * Math.max(1, getFontHeightScale(fontForText))
      : bodyLineHeight;
    const bodyEndY = bodyStartY + wrappedLines.length * bodyVisualHeight;
    const longSkinnyLayout = useLongSkinnyFormat
      ? getLongSkinnyLayoutSettings(
          renderSettings,
          measureTextRun(ctx, wrappedLines[0] ?? "", bodyFontSize, false, fontForText),
          bodyStartY,
          bodyVisualHeight,
          hasHeaderText,
        )
      : null;

    return {
      settings: longSkinnyLayout?.settings ?? renderSettings,
      bodyEndY: longSkinnyLayout?.bodyEndY ?? bodyEndY,
      bodyFontSize,
      bodyStartY: longSkinnyLayout?.bodyStartY ?? bodyStartY,
      headerFontSize,
      headerLines,
      lines: wrappedLines,
    };
  }

  function drawAutoEntryContentToCanvas(
    ctx: CanvasRenderingContext2D,
    layout: PhoneImageLayout,
    options: {
      bodyText: string;
      fontForText: FontSet;
      headerText: string;
      presetFont?: FontPreset;
    },
  ) {
    if (options.presetFont) {
      drawPresetTextToCanvas(ctx, layout.headerLines, layout.settings, {
        fontForText: options.fontForText,
        fontSize: layout.headerFontSize,
        preset: options.presetFont,
        startY: layout.settings.pagePadding,
        useHeaderLetters: true,
      });
      drawPresetTextToCanvas(ctx, layout.lines, layout.settings, {
        fontForText: options.fontForText,
        fontSize: layout.bodyFontSize,
        preset: options.presetFont,
        startY: layout.bodyStartY,
      });
      return;
    }

    drawTextToCanvas(ctx, layout.headerLines, layout.settings, {
      font: options.fontForText,
      fontSize: layout.headerFontSize,
      sourceText: options.headerText,
      startY: layout.settings.pagePadding,
      useHeaderLetters: true,
    });
    drawTextToCanvas(ctx, layout.lines, layout.settings, {
      font: options.fontForText,
      fontSize: layout.bodyFontSize,
      sourceText: options.bodyText,
      startY: layout.bodyStartY,
    });
  }

  function renderAutoEntryPageToCanvas(
    canvas: HTMLCanvasElement,
    options: {
      bodyText: string;
      fontForText: FontSet;
      headerText: string;
      presetFont?: FontPreset;
      renderSettings: PreviewImageSettings;
    },
  ) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return null;
    }

    const layout = getAutoEntryPhoneImageLayout(ctx, options);
    canvas.width = layout.settings.canvasWidth;
    canvas.height = layout.settings.canvasHeight;
    drawPreviewBackground(ctx, layout.settings);

    if (layout.settings.backgroundStyle === "manuscript" && !layout.settings.transparent) {
      const contentCanvas = document.createElement("canvas");
      contentCanvas.width = layout.settings.canvasWidth;
      contentCanvas.height = layout.settings.canvasHeight;
      const contentCtx = contentCanvas.getContext("2d");

      if (contentCtx) {
        drawAutoEntryContentToCanvas(contentCtx, layout, options);
        drawManuscriptInkLayer(ctx, contentCanvas, layout.settings);
      } else {
        drawAutoEntryContentToCanvas(ctx, layout, options);
      }
    } else {
      drawAutoEntryContentToCanvas(ctx, layout, options);
    }

    return layout;
  }

  function autoEntryLayoutFits(layout: PhoneImageLayout) {
    return layout.bodyEndY <= layout.settings.canvasHeight - layout.settings.pagePadding;
  }

  function getAutoEntryPageLabel(kind: "story" | "changelog", pageNumber: number) {
    return `${kind === "story" ? "Story" : "Changelog"} ${pageNumber}`;
  }

  async function getCanvasBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/png");
    });
  }

  async function renderAndSaveAutoEntryPage(requestEntry: AutoBookEntryRenderRequest["entries"][number]) {
    const resolvedPreset = resolveAutoEntryPreset(requestEntry.presetId);
    const attemptText = requestEntry.currentPageText
      ? `${requestEntry.currentPageText.trim()}\n\n${requestEntry.text}`.trim()
      : requestEntry.text;
    const initialCanvas = document.createElement("canvas");
    const initialLayout = renderAutoEntryPageToCanvas(initialCanvas, {
      bodyText: attemptText,
      fontForText: resolvedPreset.fontForText,
      headerText: requestEntry.pageTitle,
      presetFont: resolvedPreset.presetFont,
      renderSettings: resolvedPreset.renderSettings,
    });

    let finalCanvas = initialCanvas;
    let finalLayout = initialLayout;
    let finalText = attemptText;
    let finalPageId = requestEntry.currentPageId;
    let finalPageNumber = requestEntry.pageNumber;
    let finalPageTitle = requestEntry.pageTitle;
    let rolledOver = false;

    if (
      requestEntry.currentPageId &&
      finalLayout &&
      !autoEntryLayoutFits(finalLayout)
    ) {
      rolledOver = true;
      finalCanvas = document.createElement("canvas");
      finalPageId = undefined;
      finalPageNumber = requestEntry.nextPageNumber;
      finalPageTitle = getAutoEntryPageLabel(requestEntry.kind, finalPageNumber);
      finalText = requestEntry.text;
      finalLayout = renderAutoEntryPageToCanvas(finalCanvas, {
        bodyText: finalText,
        fontForText: resolvedPreset.fontForText,
        headerText: finalPageTitle,
        presetFont: resolvedPreset.presetFont,
        renderSettings: resolvedPreset.renderSettings,
      });
    }

    const blob = await getCanvasBlob(finalCanvas);

    if (!blob || !finalLayout || !onSaveRenderedPage) {
      return null;
    }

    const page = await onSaveRenderedPage({
      blob,
      height: finalCanvas.height,
      pageId: finalPageId,
      textContent: finalText,
      title: finalPageTitle,
      width: finalCanvas.width,
    });

    return {
      fallbackUsed: resolvedPreset.fallbackUsed,
      kind: requestEntry.kind,
      page,
      pageNumber: finalPageNumber,
      rolledOver,
    };
  }

  function isPreviewTextTargetHidden(targetId: string) {
    return hiddenPreviewTextTargetIdsRef.current.has(targetId);
  }

  function getPreviewTextCanvasPlacement(targetId: string, renderSettings: PreviewImageSettings) {
    const placement = getPreviewTextPlacement(targetId);

    if (!placement || typeof placement.x !== "number" || typeof placement.y !== "number") {
      return null;
    }

    return {
      x: placement.x * renderSettings.canvasWidth,
      y: placement.y * renderSettings.canvasHeight,
    };
  }

  function getPreviewTextLayerLineBox(layer: PreviewTextLayer, renderSettings: PreviewImageSettings, fallbackY: number) {
    const maxLineWidth = Math.max(1, renderSettings.canvasWidth - renderSettings.pagePadding * 2);
    const layerPlacement = getPreviewTextCanvasPlacement(layer.id, renderSettings);
    const baseX = layerPlacement?.x ?? renderSettings.pagePadding;
    const edgeBleed = layerPlacement ? 0 : Math.min(PREVIEW_TEXT_LAYER_EDGE_BLEED, renderSettings.pagePadding);
    const x = Math.max(0, baseX - edgeBleed);
    const layerWidth = layer.width
      ? Math.max(1, layer.width * renderSettings.canvasWidth)
      : maxLineWidth;
    const width = Math.max(1, Math.min(renderSettings.canvasWidth - x, layerWidth + edgeBleed * 2));

    return {
      width,
      x,
      y: layerPlacement?.y ?? fallbackY,
    };
  }

  function drawPreviewTextLayers(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    startY: number,
  ) {
    let y = startY;

    previewTextLayers.forEach((layer) => {
      if (!layer.text.trim() || isPreviewTextTargetHidden(layer.id)) {
        return;
      }

      const layerFontSource = getPreviewLayerFontSource(layer.fontId);
      const layerFontSize = renderSettings.fontSize * layer.sizeScale;
      const layerBox = getPreviewTextLayerLineBox(layer, renderSettings, y);

      if (layerFontSource.kind === "preset") {
        const lines = renderSettings.autoFit
          ? buildPresetWordWrappedLines(
              ctx,
              layer.text,
              layerBox.width,
              layerFontSource.preset,
              layerFontSize,
            )
          : buildPresetCharacterWrappedLines(
              ctx,
              layer.text,
              layerBox.width,
              layerFontSource.preset,
              layerFontSize,
            );

        drawPresetTextToCanvas(ctx, lines, renderSettings, {
          fontSize: layerFontSize,
          preset: layerFontSource.preset,
          startX: layerBox.x,
          startY: layerBox.y,
        });

        y += lines.length * getPresetLineHeight(renderSettings, layerFontSize) + renderSettings.fontSize * 0.35;
        return;
      }

      const layerFont = layerFontSource.font;
      ctx.font = getFallbackFont(layerFontSize);
      const lines = renderSettings.autoFit
          ? buildWordWrappedLines(
              ctx,
              layer.text,
              layerBox.width,
              layerFontSize,
              false,
              layerFont,
            )
          : buildCharacterWrappedLines(
              ctx,
              layer.text,
              layerBox.width,
              layerFontSize,
              false,
              layerFont,
            );

      drawTextToCanvas(ctx, lines, renderSettings, {
        font: layerFont,
        fontSize: layerFontSize,
        sourceText: layer.text,
        startX: layerBox.x,
        startY: layerBox.y,
      });

      y += lines.length * layerFontSize * renderSettings.lineSpacing +
        renderSettings.fontSize * 0.35;
    });
  }

  function hasActivePreviewTextEffects(renderSettings: PreviewImageSettings) {
    return Object.values(renderSettings.textEffects).some(Boolean);
  }

  function drawTintedTextLayer(
    ctx: CanvasRenderingContext2D,
    source: HTMLCanvasElement,
    color: string,
    alpha: number,
    offsetX = 0,
    offsetY = 0,
    filter = "none",
  ) {
    const tintCanvas = document.createElement("canvas");
    tintCanvas.width = source.width;
    tintCanvas.height = source.height;
    const tintCtx = tintCanvas.getContext("2d");

    if (!tintCtx) {
      return;
    }

    tintCtx.drawImage(source, 0, 0);
    tintCtx.globalCompositeOperation = "source-in";
    tintCtx.fillStyle = color;
    tintCtx.fillRect(0, 0, tintCanvas.width, tintCanvas.height);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.filter = filter;
    ctx.drawImage(tintCanvas, offsetX, offsetY);
    ctx.restore();
  }

  function createTexturedTextLayer(source: HTMLCanvasElement, renderSettings: PreviewImageSettings) {
    const texturedCanvas = document.createElement("canvas");
    texturedCanvas.width = source.width;
    texturedCanvas.height = source.height;
    const texturedCtx = texturedCanvas.getContext("2d");

    if (!texturedCtx) {
      return source;
    }

    texturedCtx.drawImage(source, 0, 0);
    texturedCtx.globalCompositeOperation = "destination-out";

    const width = renderSettings.canvasWidth;
    const height = renderSettings.canvasHeight;
    const fleckCount = Math.min(2400, Math.ceil((width * height) / 2200));
    const scratchCount = Math.min(190, Math.ceil(fleckCount / 12));

    for (let index = 0; index < fleckCount; index += 1) {
      const xSeed = (index * 193) % width;
      const ySeed = (index * 389) % height;
      const radius = Math.max(0.7, width / 1800) * (0.35 + (index % 5) * 0.15);
      texturedCtx.globalAlpha = 0.1 + (index % 4) * 0.025;
      texturedCtx.beginPath();
      texturedCtx.arc(xSeed, ySeed, radius, 0, Math.PI * 2);
      texturedCtx.fill();
    }

    texturedCtx.lineCap = "round";
    for (let index = 0; index < scratchCount; index += 1) {
      const x = (index * 431) % width;
      const y = (index * 251) % height;
      const length = Math.max(4, renderSettings.fontSize * (0.08 + (index % 4) * 0.04));
      texturedCtx.globalAlpha = 0.06 + (index % 3) * 0.018;
      texturedCtx.lineWidth = Math.max(0.8, width / 1800);
      texturedCtx.beginPath();
      texturedCtx.moveTo(x, y);
      texturedCtx.lineTo(x + length, y + length * 0.16);
      texturedCtx.stroke();
    }

    texturedCtx.globalAlpha = 1;
    texturedCtx.globalCompositeOperation = "source-over";

    return texturedCanvas;
  }

  function drawPreviewPaletteRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number,
  ) {
    const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));

    ctx.beginPath();
    ctx.moveTo(x + safeRadius, y);
    ctx.lineTo(x + width - safeRadius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    ctx.lineTo(x + width, y + height - safeRadius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    ctx.lineTo(x + safeRadius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    ctx.lineTo(x, y + safeRadius);
    ctx.quadraticCurveTo(x, y, x + safeRadius, y);
    ctx.closePath();
  }

  function drawPalettePageToCanvas(ctx: CanvasRenderingContext2D, layout: PhoneImageLayout) {
    const renderSettings = layout.settings;
    const metrics = getPalettePageCanvasMetrics(renderSettings);
    const inkColor = normalizePreviewPaletteHex(palettePageDraft.ink, renderSettings.inkColor);
    const backgroundColor = normalizePreviewPaletteHex(palettePageDraft.background, renderSettings.backgroundColor);
    const primaryColor = normalizePreviewPaletteHex(palettePageDraft.primary, renderSettings.accentColor);
    const swatchStrokeWidth = Math.max(2, Math.round(renderSettings.canvasWidth / 520));

    ctx.save();
    palettePageFields.forEach((field, index) => {
      const cardMetrics = getPalettePageCardMetrics(renderSettings, index);
      const rawValue = palettePageDraft[field.id].trim();
      const swatchColor = normalizePreviewPaletteHex(rawValue, field.id === "background" ? backgroundColor : primaryColor);

      ctx.save();
      drawPreviewPaletteRoundedRect(
        ctx,
        cardMetrics.swatchX,
        cardMetrics.swatchY,
        cardMetrics.swatchSize,
        cardMetrics.swatchSize,
        cardMetrics.swatchRadius,
      );
      ctx.fillStyle = swatchColor;
      ctx.fill();
      ctx.lineWidth = swatchStrokeWidth;
      ctx.strokeStyle = previewPaletteRgba(inkColor, field.id === "background" ? 0.24 : 0.12);
      ctx.stroke();
      ctx.restore();
    });

    drawPreviewTextLayers(
      ctx,
      renderSettings,
      metrics.gridY + Math.ceil(palettePageFields.length / metrics.columns) * (metrics.cardHeight + metrics.gap),
    );
    ctx.restore();
  }

  function drawPreviewTextContentToCanvas(ctx: CanvasRenderingContext2D, layout: PhoneImageLayout) {
    if (palettePageActive) {
      drawPalettePageToCanvas(ctx, layout);
      return;
    }

    const headerPlacement = getPreviewTextCanvasPlacement("preview-header", layout.settings);
    const bodyPlacement = getPreviewTextCanvasPlacement("preview-body", layout.settings);
    const headerLines = isPreviewTextTargetHidden("preview-header") ? [] : layout.headerLines;
    const bodyLines = isPreviewTextTargetHidden("preview-body") ? [] : layout.lines;

    if (activeFontPreset) {
      drawPresetTextToCanvas(ctx, headerLines, layout.settings, {
        fontSize: layout.headerFontSize,
        fontForText: previewFont,
        preset: activeFontPreset,
        startX: headerPlacement?.x,
        startY: headerPlacement?.y ?? layout.settings.pagePadding,
        useHeaderLetters: true,
      });
      drawPresetTextToCanvas(ctx, bodyLines, layout.settings, {
        fontSize: layout.bodyFontSize,
        fontForText: previewFont,
        preset: activeFontPreset,
        startX: bodyPlacement?.x,
        startY: bodyPlacement?.y ?? layout.bodyStartY,
      });
    } else {
      drawTextToCanvas(ctx, headerLines, layout.settings, {
        font: previewFont,
        fontSize: layout.headerFontSize,
        sourceText: headerPreviewText,
        startX: headerPlacement?.x,
        startY: headerPlacement?.y ?? layout.settings.pagePadding,
        useHeaderLetters: true,
      });
      drawTextToCanvas(ctx, bodyLines, layout.settings, {
        font: previewFont,
        fontSize: layout.bodyFontSize,
        sourceText: previewText,
        startX: bodyPlacement?.x,
        startY: bodyPlacement?.y ?? layout.bodyStartY,
      });
    }

    drawPreviewTextLayers(ctx, layout.settings, layout.bodyEndY + layout.settings.fontSize * 0.35);
  }

  function drawPreviewTextLayerWithEffects(ctx: CanvasRenderingContext2D, layout: PhoneImageLayout) {
    if (palettePageActive) {
      drawPreviewTextContentToCanvas(ctx, layout);
      return;
    }

    if (!hasActivePreviewTextEffects(layout.settings)) {
      drawPreviewTextContentToCanvas(ctx, layout);
      return;
    }

    const textCanvas = document.createElement("canvas");
    textCanvas.width = layout.settings.canvasWidth;
    textCanvas.height = layout.settings.canvasHeight;
    const textCtx = textCanvas.getContext("2d");

    if (!textCtx) {
      drawPreviewTextContentToCanvas(ctx, layout);
      return;
    }

    drawPreviewTextContentToCanvas(textCtx, layout);

    const effects = layout.settings.textEffects;
    const textLayer = effects.texture ? createTexturedTextLayer(textCanvas, layout.settings) : textCanvas;
    const effectUnit = Math.max(1, Math.round(layout.settings.fontSize * 0.018));

    if (effects.shadow) {
      const shadowOffset = Math.max(2, effectUnit * 1.6);
      drawTintedTextLayer(
        ctx,
        textLayer,
        "rgba(10, 7, 6, 0.95)",
        0.44,
        shadowOffset,
        shadowOffset * 1.15,
        `blur(${Math.max(1.2, effectUnit * 1.35)}px)`,
      );
    }

    if (effects.outline) {
      const outlineOffsets = [
        [-effectUnit, 0],
        [effectUnit, 0],
        [0, -effectUnit],
        [0, effectUnit],
        [-effectUnit, -effectUnit],
        [effectUnit, -effectUnit],
        [-effectUnit, effectUnit],
        [effectUnit, effectUnit],
      ];

      outlineOffsets.forEach(([offsetX, offsetY]) => {
        drawTintedTextLayer(ctx, textLayer, layout.settings.accentColor, 0.72, offsetX, offsetY);
      });
    }

    if (effects.thicken) {
      const thickenOffset = Math.max(1, Math.round(effectUnit * 0.75));
      ctx.save();
      ctx.globalAlpha = 0.62;
      [
        [-thickenOffset, 0],
        [thickenOffset, 0],
        [0, -thickenOffset],
        [0, thickenOffset],
      ].forEach(([offsetX, offsetY]) => {
        ctx.drawImage(textLayer, offsetX, offsetY);
      });
      ctx.restore();
    }

    if (effects.smooth) {
      ctx.save();
      ctx.globalAlpha = 0.38;
      ctx.filter = `blur(${Math.max(0.7, effectUnit * 0.6)}px)`;
      ctx.drawImage(textLayer, 0, 0);
      ctx.restore();
    }

    ctx.drawImage(textLayer, 0, 0);
  }

  function getPreviewTextLayerHitTargets(
    ctx: CanvasRenderingContext2D,
    renderSettings: PreviewImageSettings,
    startY: number,
  ): PreviewTextLayerHitTarget[] {
    let y = startY;
    const targets: PreviewTextLayerHitTarget[] = [];

    previewTextLayers.forEach((layer) => {
      if (!layer.text.trim() || isPreviewTextTargetHidden(layer.id)) {
        return;
      }

      const layerFontSource = getPreviewLayerFontSource(layer.fontId);
      const layerFontSize = renderSettings.fontSize * layer.sizeScale;
      const layerBox = getPreviewTextLayerLineBox(layer, renderSettings, y);

      if (layerFontSource.kind === "preset") {
        const lineHeight = getPresetLineHeight(renderSettings, layerFontSize);
        const lines = renderSettings.autoFit
          ? buildPresetWordWrappedLines(
              ctx,
              layer.text,
              layerBox.width,
              layerFontSource.preset,
              layerFontSize,
            )
          : buildPresetCharacterWrappedLines(
              ctx,
              layer.text,
              layerBox.width,
              layerFontSource.preset,
              layerFontSize,
            );
        const height = Math.max(lineHeight, lines.length * lineHeight);

        targets.push({
          height,
          id: layer.id,
          width: layerBox.width,
          x: layerBox.x,
          y: layerBox.y,
        });

        y += height + renderSettings.fontSize * 0.35;
        return;
      }

      const layerFont = layerFontSource.font;
      const lineHeight = layerFontSize * renderSettings.lineSpacing;
      ctx.font = getFallbackFont(layerFontSize);
      const lines = renderSettings.autoFit
        ? buildWordWrappedLines(
            ctx,
            layer.text,
            layerBox.width,
            layerFontSize,
            false,
            layerFont,
          )
        : buildCharacterWrappedLines(
            ctx,
            layer.text,
            layerBox.width,
            layerFontSize,
            false,
            layerFont,
          );
      const height = Math.max(lineHeight, lines.length * lineHeight);

      targets.push({
        height,
        id: layer.id,
        width: layerBox.width,
        x: layerBox.x,
        y: layerBox.y,
      });

      y += height + renderSettings.fontSize * 0.35;
    });

    return targets;
  }

  function getPreviewTextBaseHitTargets(layout: PhoneImageLayout): PreviewTextLayerHitTarget[] {
    const maxLineWidth = Math.max(1, layout.settings.canvasWidth - layout.settings.pagePadding * 2);
    const targets: PreviewTextLayerHitTarget[] = [];
    const headerPlacement = getPreviewTextCanvasPlacement("preview-header", layout.settings);
    const bodyPlacement = getPreviewTextCanvasPlacement("preview-body", layout.settings);

    if (palettePageActive) {
      return targets;
    }

    if (layout.headerLines.length > 0 && !isPreviewTextTargetHidden("preview-header")) {
      const headerLineHeight = activeFontPreset
        ? getPresetLineHeight(layout.settings, layout.headerFontSize)
        : layout.headerFontSize * layout.settings.lineSpacing;

      targets.push({
        height: Math.max(headerLineHeight, layout.headerLines.length * headerLineHeight),
        id: "preview-header",
        width: maxLineWidth,
        x: headerPlacement?.x ?? layout.settings.pagePadding,
        y: headerPlacement?.y ?? layout.settings.pagePadding,
      });
    }

    if (layout.lines.length > 0 && previewText.trim() && !isPreviewTextTargetHidden("preview-body")) {
      const bodyLineHeight = activeFontPreset
        ? getPresetLineHeight(layout.settings, layout.bodyFontSize)
        : layout.bodyFontSize * layout.settings.lineSpacing;
      const bodyVisualHeight = shouldUseLongSkinnyFormat(layout.settings)
        ? bodyLineHeight * Math.max(1, getFontHeightScale(previewFont))
        : bodyLineHeight;

      targets.push({
        height: Math.max(bodyVisualHeight, layout.lines.length * bodyVisualHeight),
        id: "preview-body",
        width: maxLineWidth,
        x: bodyPlacement?.x ?? layout.settings.pagePadding,
        y: bodyPlacement?.y ?? layout.bodyStartY,
      });
    }

    return targets;
  }

  function getAllPreviewTextHitTargets(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const layout = getPhoneImageLayout(ctx, renderSettings);

    return [
      ...getPreviewTextBaseHitTargets(layout),
      ...getPreviewTextLayerHitTargets(ctx, renderSettings, layout.bodyEndY + renderSettings.fontSize * 0.35),
    ];
  }

  function drawPreviewTextSelectionTarget(
    ctx: CanvasRenderingContext2D,
    target: PreviewTextLayerHitTarget,
    tone: PreviewTextSelectionTone,
  ) {
    const padding = PREVIEW_TEXT_SELECTION_VISUAL_PADDING;

    if (tone === "active") {
      ctx.fillStyle = "rgba(58, 126, 114, 0.2)";
      ctx.strokeStyle = "#4f9f8e";
    } else {
      ctx.fillStyle = "rgba(130, 208, 188, 0.06)";
      ctx.strokeStyle = "rgba(130, 208, 188, 0.58)";
    }

    ctx.fillRect(
      target.x - padding,
      target.y - padding,
      target.width + padding * 2,
      target.height + padding * 2,
    );
    ctx.strokeRect(
      target.x - padding,
      target.y - padding,
      target.width + padding * 2,
      target.height + padding * 2,
    );
  }

  function drawPreviewStickerSelectionTarget(
    ctx: CanvasRenderingContext2D,
    sticker: PreviewSticker,
    renderSettings: PreviewImageSettings,
    tone: PreviewTextSelectionTone,
  ) {
    if (tone === "active") {
      ctx.fillStyle = "rgba(58, 126, 114, 0.2)";
      ctx.strokeStyle = "#4f9f8e";
    } else {
      ctx.fillStyle = "rgba(130, 208, 188, 0.06)";
      ctx.strokeStyle = "rgba(130, 208, 188, 0.58)";
    }

    const imageBox = getPreviewImageStickerCanvasBox(sticker, renderSettings);

    if (imageBox) {
      const padding = Math.max(8, renderSettings.canvasWidth / 140);
      ctx.fillRect(
        imageBox.x - padding,
        imageBox.y - padding,
        imageBox.width + padding * 2,
        imageBox.height + padding * 2,
      );
      ctx.strokeRect(
        imageBox.x - padding,
        imageBox.y - padding,
        imageBox.width + padding * 2,
        imageBox.height + padding * 2,
      );
      return;
    }

    const x = sticker.x * renderSettings.canvasWidth;
    const y = sticker.y * renderSettings.canvasHeight;
    const radiusX = Math.max(22, sticker.size * renderSettings.canvasWidth * 2.9 * getPreviewStickerWidthScale(sticker));
    const radiusY = Math.max(22, sticker.size * renderSettings.canvasWidth * 2.9 * getPreviewStickerHeightScale(sticker));

    ctx.beginPath();
    ctx.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  function drawPreviewDoodleSelectionTarget(
    ctx: CanvasRenderingContext2D,
    stroke: PreviewDoodleStroke,
    renderSettings: PreviewImageSettings,
    tone: PreviewTextSelectionTone,
  ) {
    const [firstPoint, ...restPoints] = getPreviewDoodleRenderPoints(stroke);

    if (!firstPoint) {
      return;
    }

    ctx.save();
    ctx.strokeStyle = tone === "active" ? "#4f9f8e" : "rgba(130, 208, 188, 0.58)";
    ctx.lineWidth = Math.max(8, stroke.size * renderSettings.canvasWidth * 2.5);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(firstPoint.x * renderSettings.canvasWidth, firstPoint.y * renderSettings.canvasHeight);
    restPoints.forEach((point) => {
      ctx.lineTo(point.x * renderSettings.canvasWidth, point.y * renderSettings.canvasHeight);
    });
    ctx.stroke();
    ctx.restore();
  }

  function drawPreviewSelectionOutlines(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    ctx.save();
    ctx.strokeStyle = "#82d0bc";
    ctx.fillStyle = "rgba(130, 208, 188, 0.08)";
    ctx.lineWidth = Math.max(2, renderSettings.canvasWidth / 480);
    ctx.setLineDash([Math.max(6, renderSettings.canvasWidth / 90), Math.max(4, renderSettings.canvasWidth / 140)]);

    const showSelectedStickerOutline =
      (styleSelectModeActive || styleMoveModeActive) &&
      (styleSelectTarget === "stickers" || styleSelectTarget === "ornaments") &&
      !styleSelectMenuOpen &&
      !fullscreenSelectMenuOpen &&
      !fullscreenMoveMenuOpen;

    if (showSelectedStickerOutline) {
      const filterSticker = getStyleSelectStickerFilter();
      const selectedSticker = selectedPreviewStickerId
        ? previewStickers.find((sticker) => sticker.id === selectedPreviewStickerId && filterSticker(sticker)) ?? null
        : null;

      previewStickers
        .filter((sticker) => filterSticker(sticker) && sticker.id !== selectedPreviewStickerId)
        .forEach((sticker) => drawPreviewStickerSelectionTarget(ctx, sticker, renderSettings, "available"));

      if (selectedSticker) {
        drawPreviewStickerSelectionTarget(ctx, selectedSticker, renderSettings, "active");
      }
    }

    const showSelectedDoodleOutline =
      (styleSelectModeActive || styleMoveModeActive) &&
      styleSelectTarget === "doodles" &&
      !styleSelectMenuOpen &&
      !fullscreenSelectMenuOpen &&
      !fullscreenMoveMenuOpen;

    if (showSelectedDoodleOutline) {
      const selectedDoodle = selectedPreviewDoodleId
        ? previewDoodles.find((stroke) => stroke.id === selectedPreviewDoodleId) ?? null
        : null;

      previewDoodles
        .filter((stroke) => stroke.id !== selectedPreviewDoodleId)
        .forEach((stroke) => drawPreviewDoodleSelectionTarget(ctx, stroke, renderSettings, "available"));

      if (selectedDoodle) {
        drawPreviewDoodleSelectionTarget(ctx, selectedDoodle, renderSettings, "active");
      }
    }

    const showSelectedTextOutline =
      (styleSelectModeActive || styleMoveModeActive) &&
      styleSelectTarget === "text" &&
      !styleSelectMenuOpen &&
      !fullscreenSelectMenuOpen &&
      !fullscreenMoveMenuOpen;

    if (showSelectedTextOutline) {
      const textTargets = getAllPreviewTextHitTargets(ctx, renderSettings);
      const selectedTextTarget = selectedPreviewTextLayerId
        ? textTargets.find((target) => target.id === selectedPreviewTextLayerId)
        : null;

      textTargets
        .filter((target) => target.id !== selectedPreviewTextLayerId)
        .forEach((target) => drawPreviewTextSelectionTarget(ctx, target, "available"));

      if (selectedTextTarget) {
        drawPreviewTextSelectionTarget(ctx, selectedTextTarget, "active");
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
    drawLongSkinnyPaperRules(
      ctx,
      layout,
      layout.bodyFontSize,
    );

    drawPreviewTextLayerWithEffects(ctx, layout);
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
      renderPhoneImageToCanvas(viewerCanvasRef.current, {
        doodleStrokes: getActivePreviewDoodleStrokes(),
        showSelection: imageViewerOpen && (activeSettingsPanel === "decor" || activeSettingsPanel === "font"),
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
      text: "Made in Quill",
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
    clearHiddenPreviewTextTargets();
    setDocumentName(preset.label);
    setActiveDocumentId(null);
    setShareStatus(`Loaded ${preset.label}.`);
  }

  function applyExportPreset(presetId: ExportPresetId) {
    const preset = exportPresets.find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    if (presetId === "custom") {
      customImageMetricDefaultsRef.current = getImageMetricDefaults(imageSettings);
    }

    setImageSettings((current) => ({
      ...current,
      ...preset.settings,
    }));
    setActiveImageSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setShareStatus(`${preset.label} format selected.`);
  }

  function savePreviewDocument() {
    const now = new Date().toISOString();
    const nextDocument: PreviewDocument = {
      headerText: isPreviewTextTargetHidden("preview-header") ? "" : headerPreviewText,
      id: activeDocumentId ?? createPreviewId(),
      name: documentName.trim() || "Untitled preview",
      settings: imageSettings,
      text: isPreviewTextTargetHidden("preview-body") ? "" : previewText,
      textLayers: previewTextLayers.filter((layer) => !isPreviewTextTargetHidden(layer.id)),
      textTargetPlacements: previewTextTargetPlacements,
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

    const nextSettings = normalizePreviewSettings(document.settings);

    if (nextSettings.exportPreset === "custom") {
      customImageMetricDefaultsRef.current = getImageMetricDefaults(nextSettings);
    }

    setActiveDocumentId(document.id);
    setDocumentName(document.name);
    setImageSettings(nextSettings);
    onHeaderPreviewTextChange(document.headerText ?? "");
    onPreviewTextChange(document.text);
    setPreviewTextLayers(document.textLayers ?? []);
    setPreviewTextTargetPlacements(document.textTargetPlacements ?? {});
    clearHiddenPreviewTextTargets();
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

  function getRenderedPageTitle(titleOverride?: string) {
    const namedDocument = titleOverride?.trim() || documentName.trim();
    if (namedDocument && namedDocument !== "Untitled preview") {
      return namedDocument;
    }

    return `${font.name} page`;
  }

  function getDesignPresetTitle(titleOverride?: string) {
    const namedPreset = titleOverride?.trim();

    return namedPreset || `${font.name} preset`;
  }

  function getRenderedPageTextContent() {
    return [
      isPreviewTextTargetHidden("preview-header") ? "" : headerPreviewText,
      isPreviewTextTargetHidden("preview-body") ? "" : previewText,
      ...previewTextLayers
        .filter((layer) => !isPreviewTextTargetHidden(layer.id))
        .map((layer) => layer.text),
    ]
      .map((value) => value.trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function openSaveTitlePrompt() {
    setSaveTitleDraft(imageViewerMode === "preset" ? getDesignPresetTitle() : getRenderedPageTitle());
    setSaveTitlePromptOpen(true);
  }

  function saveDesignPreset(titleOverride?: string) {
    const now = new Date().toISOString();
    const nextPreset: PreviewDesignPreset = {
      fontOptionId: getActivePreviewFontOptionId(),
      id: createPreviewId(),
      name: getDesignPresetTitle(titleOverride),
      settings: normalizePreviewSettings(imageSettings),
      updatedAt: now,
    };
    const nextPresets = [nextPreset, ...previewDesignPresets].slice(0, 24);

    setPreviewDesignPresets(nextPresets);
    savePreviewDesignPresets(nextPresets);
    onDesignPresetsChange?.(getPreviewDesignPresetSummaries(nextPresets), nextPreset.id);
    setShareStatus(`Saved "${nextPreset.name}" preset.`);
    onRecordExport?.(`Saved "${nextPreset.name}" compose preset.`);
    return true;
  }

  function applyDesignPreset(presetId: string) {
    const preset = getVisiblePreviewDesignPresets(previewDesignPresets).find((item) => item.id === presetId);

    if (!preset) {
      return;
    }

    const isPalettePreset = preset.id === PALETTE_PAGE_PRESET_ID;
    const nextSettings = normalizePreviewSettings(preset.settings);

    if (nextSettings.exportPreset === "custom") {
      customImageMetricDefaultsRef.current = getImageMetricDefaults(nextSettings);
    }

    setImageSettings(nextSettings);
    selectPrimaryPreviewFont(preset.fontOptionId);
    setCanvasFormatDrawerOpen(false);
    setImageStyleDrawerOpen(false);
    setActiveFontSettingsSliderId(null);
    setPalettePageActive(isPalettePreset);
    setPalettePageControlsOpen(isPalettePreset);
    setPreviewTextLayers((current) => {
      if (!isPalettePreset) {
        return current.filter((layer) => !isPalettePageTextLayerId(layer.id));
      }

      const nextPaletteLayers = createPalettePageTextLayers(palettePageDraft, nextSettings, preset.fontOptionId);

      return [
        ...current.filter((layer) => !isPalettePageTextLayerId(layer.id)),
        ...nextPaletteLayers,
      ];
    });
    if (isPalettePreset) {
      clearHiddenPreviewTextTargets();
    }
    setFullscreenActionPanelOpen(isPalettePreset);
    setShareStatus(`Applied "${preset.name}" preset.`);
  }

  async function saveRenderedPage(titleOverride?: string) {
    const canvas = imageCanvasRef.current;

    if (!canvas || !onSaveRenderedPage) {
      setShareStatus("Could not save a page yet.");
      return false;
    }

    const blob = await getPhoneImageBlob();

    if (!blob) {
      setShareStatus("Could not make an image yet.");
      return false;
    }

    try {
      const imageDataUrl = getPhoneImageDataUrl();
      const title = getRenderedPageTitle(titleOverride);
      const page = await onSaveRenderedPage({
        blob,
        height: canvas.height,
        textContent: getRenderedPageTextContent(),
        title,
        width: canvas.width,
      });

      onSaveImage?.({
        fontName: font.name,
        height: canvas.height,
        imageDataUrl,
        message: getRenderedPageTextContent() || "(blank page)",
        width: canvas.width,
      });
      setShareStatus(`Saved "${page.title}" to Library.`);
      onRecordExport?.(`Saved "${page.title}" as a Quill page.`);
      return true;
    } catch {
      setShareStatus("Could not save this page.");
      return false;
    }
  }

  async function submitSaveTitle(event: ReactFormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (imageViewerMode === "preset") {
      if (saveDesignPreset(saveTitleDraft)) {
        setSaveTitlePromptOpen(false);
      }
      return;
    }

    if (await saveRenderedPage(saveTitleDraft)) {
      setSaveTitlePromptOpen(false);
    }
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
        setShareStatus("Saved PNG to Documents / Quill.");
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
      text: "Made in Quill",
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
          text: "Made in Quill",
          title: font.name,
        });
        setShareStatus("This browser shared the app text, but not the image file.");
        onRecordExport?.("Shared Quill preview text.");
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

  function renderPreviewTextFontPicker({
    ariaLabel,
    onChange,
    pickerId,
    value,
  }: {
    ariaLabel: string;
    onChange: (fontId: string) => void;
    pickerId: string;
    value: string;
  }) {
    const customOptions = availableTextFontOptions.filter((option) => option.kind === "custom");
    const presetOptions = availableTextFontOptions.filter((option) => option.kind === "preset");
    const selectedOption = availableTextFontOptions.find((option) => option.id === value) ?? availableTextFontOptions[0] ?? null;
    const pickerOpen = expandedPreviewTextFontPickerId === pickerId;
    const pickerStyle = {
      "--preview-text-font-accent": imageSettings.accentColor,
      "--preview-text-font-bg": imageSettings.backgroundColor,
      "--preview-text-font-ink": imageSettings.inkColor,
    } as CSSProperties;

    function renderFontOption(option: PreviewTextFontOption) {
      const selected = option.id === value;

      return (
        <button
          key={option.id}
          className={`preview-text-font-picker-option ${selected ? "selected" : ""}`}
          type="button"
          role="option"
          aria-selected={selected}
          aria-label={option.label}
          onClick={() => {
            onChange(option.id);
            setExpandedPreviewTextFontPickerId(null);
          }}
        >
          <PreviewTextFontNamePreview
            option={option}
            compact
            inkColor={imageSettings.inkColor}
            backgroundColor={imageSettings.backgroundColor}
            accentColor={imageSettings.accentColor}
          />
        </button>
      );
    }

    return (
      <div className="preview-text-font-picker" style={pickerStyle}>
        <button
          className="preview-text-font-picker-button"
          type="button"
          aria-expanded={pickerOpen}
          aria-label={selectedOption ? `${ariaLabel}: ${selectedOption.label}` : ariaLabel}
          onClick={() =>
            setExpandedPreviewTextFontPickerId((current) => (current === pickerId ? null : pickerId))
          }
        >
          {selectedOption ? (
            <PreviewTextFontNamePreview
              option={selectedOption}
              inkColor={imageSettings.inkColor}
              backgroundColor={imageSettings.backgroundColor}
              accentColor={imageSettings.accentColor}
            />
          ) : (
            <span className="preview-text-font-picker-empty">Choose font</span>
          )}
          <ChevronDown className={pickerOpen ? "expanded" : ""} aria-hidden="true" />
        </button>

        {pickerOpen ? (
          <div className="preview-text-font-picker-menu" role="listbox" aria-label={ariaLabel}>
            {customOptions.length > 0 ? (
              <>
                <span className="preview-text-font-picker-group-label">Designed fonts</span>
                {customOptions.map(renderFontOption)}
              </>
            ) : null}
            <span className="preview-text-font-picker-group-label">Preset fonts</span>
            {presetOptions.map(renderFontOption)}
          </div>
        ) : null}
      </div>
    );
  }

  function getActivePreviewFontOptionId() {
    return activeFontPreset ? getFontPresetOptionId(activeFontPreset.id) : previewFont.id;
  }

  function selectPrimaryPreviewFont(fontId: string) {
    const preset = getFontPresetFromOptionId(fontId);

    setExpandedPreviewTextFontPickerId(null);

    if (preset) {
      onCreatePresetFont(preset.id);
      setShareStatus(`Using "${preset.label}" font.`);
      return;
    }

    if (availableFonts.some((item) => item.id === fontId)) {
      onSelectFont(fontId);
      const fontLabel = availableFonts.find((item) => item.id === fontId)?.name ?? "selected";
      setShareStatus(`Using "${fontLabel}" font.`);
    }
  }

  function getDefaultPreviewTextLayerDraft(): PreviewTextLayerDraft {
    return {
      fontId: getActivePreviewFontOptionId(),
      sizeScale: 1,
      text: "",
    };
  }

  function openPreviewTextLayerDraft() {
    setDraftPreviewTextLayer(getDefaultPreviewTextLayerDraft());
    setExpandedPreviewTextFontPickerId(null);
    setActiveStyleDrawer("text");
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedTextDeletePrimed(false);
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setShareStatus("Text box ready.");
  }

  function updateDraftPreviewTextLayer(patch: Partial<PreviewTextLayerDraft>) {
    setDraftPreviewTextLayer((current) => ({
      ...(current ?? getDefaultPreviewTextLayerDraft()),
      ...patch,
    }));
  }

  function insertColorSwatchIntoTextDraft() {
    const swatchToken = `[swatch:${normalizePreviewPaletteHex(imageSettings.inkColor, "#19140f")}]`;

    setDraftPreviewTextLayer((current) => {
      const draft = current ?? getDefaultPreviewTextLayerDraft();
      const trimmedText = draft.text.trimEnd();
      const nextText = trimmedText ? `${trimmedText}\n${swatchToken}` : swatchToken;

      return {
        ...draft,
        text: nextText,
      };
    });
    setActiveStyleDrawer("text");
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedTextDeletePrimed(false);
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setShareStatus("Added color swatch to text box.");
  }

  function addPreviewTextLayer() {
    const nextLayer = draftPreviewTextLayer ?? getDefaultPreviewTextLayerDraft();

    styleActiveDoodleRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setPreviewTextLayers((current) => [
      ...current,
      {
        fontId: nextLayer.fontId,
        id: createPreviewId(),
        sizeScale: nextLayer.sizeScale,
        text: nextLayer.text,
      },
    ]);
    setActiveDocumentId(null);
    setActiveStyleDrawer(null);
    setDraftPreviewTextLayer(null);
    setExpandedPreviewTextFontPickerId(null);
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setSelectedTextDeletePrimed(false);
    setShareStatus("Added text layer.");
  }

  function updatePreviewTextLayer(layerId: string, patch: Partial<PreviewTextLayer>) {
    if (patch.fontId) {
      setExpandedPreviewTextFontPickerId(null);
    }

    unhidePreviewTextTarget(layerId);
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
    if (styleMovingTextRef.current?.id === layerId) {
      styleMovingTextRef.current = null;
    }
    setSelectedTextDeletePrimed(false);
    setActiveDocumentId(null);
    setShareStatus("Removed text layer.");
  }

  function clearPreviewTextTargetPlacement(targetId: string) {
    setPreviewTextTargetPlacements((current) => {
      const { [targetId]: _removed, ...nextPlacements } = current;
      return nextPlacements;
    });
  }

  function setHiddenPreviewTextTargets(nextIds: string[]) {
    hiddenPreviewTextTargetIdsRef.current = new Set(nextIds);
    setHiddenPreviewTextTargetIds(nextIds);
  }

  function clearHiddenPreviewTextTargets() {
    setHiddenPreviewTextTargets([]);
  }

  function hidePreviewTextTarget(targetId: string) {
    if (hiddenPreviewTextTargetIdsRef.current.has(targetId)) {
      return;
    }

    setHiddenPreviewTextTargets([...hiddenPreviewTextTargetIdsRef.current, targetId]);
  }

  function unhidePreviewTextTarget(targetId: string) {
    if (!hiddenPreviewTextTargetIdsRef.current.has(targetId)) {
      return;
    }

    setHiddenPreviewTextTargets([...hiddenPreviewTextTargetIdsRef.current].filter((id) => id !== targetId));
  }

  function deleteSelectedPreviewTextTarget() {
    const targetId = selectedPreviewTextLayerId ?? selectedTextDeletePrimedId;

    if (!targetId) {
      setShareStatus("Select text first.");
      return;
    }

    if (selectedTextDeletePrimedId !== targetId) {
      setSelectedTextDeletePrimedId(targetId);
      setShareStatus("Tap Delete again to remove text.");
      return;
    }

    hidePreviewTextTarget(targetId);

    if (targetId === "preview-header") {
      onHeaderPreviewTextChange("");
      clearPreviewTextTargetPlacement(targetId);
    } else if (targetId === "preview-body") {
      onPreviewTextChange("");
      clearPreviewTextTargetPlacement(targetId);
    } else {
      setPreviewTextLayers((current) => current.filter((layer) => layer.id !== targetId));
    }

    if (styleMovingTextRef.current?.id === targetId) {
      styleMovingTextRef.current = null;
    }

    setSelectedPreviewTextLayerId(null);
    setSelectedTextDeletePrimedId(null);
    setActiveDocumentId(null);
    renderPhoneImage();
    setShareStatus("Deleted text.");
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
      return "Sticker";
    }

    if (target === "ornaments") {
      return "Ornament";
    }

    if (target === "letter") {
      return "Letter";
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

    if (target === "ornaments") {
      return <Sparkles aria-hidden="true" />;
    }

    if (target === "letter") {
      return <PenLine aria-hidden="true" />;
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
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedLetterMetricsOpen(false);
    setSelectedLetterMetricGroup(null);
    setSelectedTextDeletePrimed(false);
    setActiveFontSettingsSliderId(null);
    setActiveLetterSettingsSliderId(null);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);
    setFontEffectsMenuOpen(false);
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;

    if (target === "stickers") {
      setSelectedPreviewStickerId((current) =>
        current && previewStickers.some((sticker) => sticker.id === current && isEyePreviewSticker(sticker))
          ? current
          : null,
      );
    } else if (target === "ornaments") {
      setSelectedPreviewStickerId((current) =>
        current && previewStickers.some((sticker) => sticker.id === current && !isEyePreviewSticker(sticker))
          ? current
          : null,
      );
    } else {
      setSelectedPreviewStickerId(null);
    }

    setSelectedPreviewTextLayerId(null);

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
        {(["stickers", "ornaments", "text", "doodles"] as StyleSelectTarget[]).map((target) => (
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

    setSelectedTextMetricsOpen(false);
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
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

  function toggleSelectedTextMetrics() {
    const nextOpen = !selectedTextMetricsOpen;

    setActiveFontSettingsSliderId(null);
    setActiveStickerMetricId(null);
    setSelectedStickerMetricsOpen(false);
    setFontEffectsMenuOpen(false);
    setSelectedTextMetricsOpen(nextOpen);
    setShareStatus(nextOpen ? "Choose size or spacing metrics." : "Text metrics closed.");
  }

  function toggleSelectedTextEffects() {
    const nextOpen = !fontEffectsMenuOpen;

    setActiveFontSettingsSliderId(null);
    setActiveStickerMetricId(null);
    setSelectedStickerMetricsOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setFontEffectsMenuOpen(nextOpen);
    setShareStatus(nextOpen ? "Text effects shown." : "Text effects closed.");
  }

  function selectTextMetricGroup(group: SelectedTextMetricGroup) {
    setSelectedTextMetricGroup(group);
    setSelectedTextMetricsOpen(false);
    setActiveFontSettingsSliderId(null);
    setActiveStickerMetricId(null);
    setSelectedStickerMetricsOpen(false);
    setFontEffectsMenuOpen(false);
    setShareStatus(group === "size" ? "Size metrics shown." : "Spacing metrics shown.");
  }

  function getSelectedPreviewTextTargetId() {
    return selectedPreviewTextLayerId ?? selectedTextDeletePrimedId;
  }

  function getSelectedTextSizeConfig(): FontSettingsSliderConfig {
    const id: FontSettingsSliderId = "size";
    const value = getPreviewTextTargetBaseSizeScale(getSelectedPreviewTextTargetId() ?? "");

    return {
      id,
      label: "Size",
      max: 2.5,
      min: 0.45,
      precision: 2,
      step: 0.05,
      value,
    };
  }

  function getSelectedTextMetricConfigs() {
    const metricIds: FontSettingsSliderId[] = selectedTextMetricGroup === "spacing"
      ? ["letterSpacing", "rowSpacing", "spacebar"]
      : selectedTextMetricGroup === "size"
        ? ["size", "height", "width"]
        : [];

    return metricIds.map((id) => (id === "size" ? getSelectedTextSizeConfig() : getFontSettingsSliderConfig(id)));
  }

  function renderSelectedTextMetricsPopover() {
    return (
      <div className="selected-text-metrics-popover" aria-label="Text metric groups">
        <button
          className={`draw-glass-button selected-text-metric-option ${
            selectedTextMetricGroup === "size" ? "active-tool" : ""
          }`}
          type="button"
          aria-pressed={selectedTextMetricGroup === "size"}
          onClick={() => selectTextMetricGroup("size")}
        >
          <Scaling aria-hidden="true" />
          <span>Size</span>
        </button>
        <button
          className={`draw-glass-button selected-text-metric-option ${
            selectedTextMetricGroup === "spacing" ? "active-tool" : ""
          }`}
          type="button"
          aria-pressed={selectedTextMetricGroup === "spacing"}
          onClick={() => selectTextMetricGroup("spacing")}
        >
          <Space aria-hidden="true" />
          <span>Spacing</span>
        </button>
      </div>
    );
  }

  function renderSelectedTextOptionsRow() {
    const metricConfigs = getSelectedTextMetricConfigs();
    const activeSliderConfig = activeFontSettingsSliderId
      ? metricConfigs.find((config) => config.id === activeFontSettingsSliderId) ?? null
      : null;
    const selectedTextMetricsActive = selectedTextMetricsOpen || Boolean(selectedTextMetricGroup);
    const selectedTextEffectsVisible = fontEffectsMenuOpen;
    const activeEffectCount = previewTextEffectOptions.filter((option) => imageSettings.textEffects[option.id]).length;

    return (
      <div
        className={`phone-image-action-row selected-text-option-row ${
          selectedTextMetricsOpen || selectedTextMetricGroup ? "metrics-open" : ""
        } ${selectedTextEffectsVisible ? "effects-open" : ""}`}
        aria-label="Selected text options"
      >
        {activeSliderConfig ? renderFontSettingsSliderDrawer(activeSliderConfig) : null}
        {!selectedTextEffectsVisible ? (
          <>
            <button
              className={`draw-icon-button draw-glass-button selected-text-option-button ${
                selectedTextMetricsOpen ? "active-tool" : ""
              }`}
              type="button"
              aria-pressed={selectedTextMetricsOpen}
              onClick={toggleSelectedTextMetrics}
            >
              <Ruler aria-hidden="true" />
              <span>Metrics</span>
            </button>

            {!selectedTextMetricsActive ? (
              <button
                className={`draw-icon-button draw-glass-button selected-text-option-button ${
                  activeEffectCount > 0 ? "active-tool" : ""
                }`}
                type="button"
                aria-expanded={selectedTextEffectsVisible}
                aria-label={`Text effects${activeEffectCount > 0 ? `: ${activeEffectCount} active` : ""}`}
                onClick={toggleSelectedTextEffects}
              >
                <Sparkles aria-hidden="true" />
                <span>Effects</span>
              </button>
            ) : null}

            {!selectedTextMetricsActive ? (
              <button
                className={`draw-icon-button draw-glass-button selected-text-option-button selected-text-delete-button ${
                  selectedTextDeletePrimed ? "confirm-delete" : ""
                }`}
                type="button"
                disabled={!selectedPreviewTextLayerId && !selectedTextDeletePrimedId}
                aria-pressed={selectedTextDeletePrimed}
                onClick={deleteSelectedPreviewTextTarget}
              >
                <Trash2 aria-hidden="true" />
                <span>{selectedTextDeletePrimed ? "Delete?" : "Delete"}</span>
              </button>
            ) : null}

            {selectedTextMetricsOpen ? renderSelectedTextMetricsPopover() : null}
            {metricConfigs.map((config) => {
              const selected = activeFontSettingsSliderId === config.id;

              return (
                <button
                  key={config.id}
                  className={`draw-icon-button draw-glass-button selected-text-inline-metric-button ${
                    selected ? "active-tool" : ""
                  }`}
                  type="button"
                  aria-expanded={selected}
                  aria-label={`${config.label}: ${formatMetricValue(config.value, config.precision)}`}
                  onClick={() => {
                    setSelectedTextMetricsOpen(false);
                    setFontEffectsMenuOpen(false);
                    setActiveFontSettingsSliderId((current) => (current === config.id ? null : config.id));
                  }}
                >
                  {getFontSettingsSliderIcon(config.id)}
                  <span>{config.label}</span>
                  <strong>{formatMetricValue(config.value, config.precision)}</strong>
                </button>
              );
            })}
            {metricConfigs.length > 0 ? (
              <button
                className="draw-glass-button selected-text-apply-button"
                type="button"
                disabled={!hasPendingFontSpacingChanges}
                onClick={applyFontSpacingToFont}
                aria-label="Apply text metric changes to Font"
                title="Apply to Font"
              >
                Apply
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              className="draw-icon-button draw-glass-button selected-text-option-button active-tool"
              type="button"
              aria-expanded={selectedTextEffectsVisible}
              aria-label={`Text effects${activeEffectCount > 0 ? `: ${activeEffectCount} active` : ""}`}
              onClick={toggleSelectedTextEffects}
            >
              <Sparkles aria-hidden="true" />
              <span>Effects</span>
            </button>
            {previewTextEffectOptions.map((option) => (
              <button
                key={option.id}
                className={`draw-glass-button selected-text-effect-button ${
                  imageSettings.textEffects[option.id] ? "active-tool" : ""
                }`}
                type="button"
                aria-pressed={imageSettings.textEffects[option.id]}
                onClick={() => togglePreviewTextEffect(option.id)}
              >
                {option.label}
              </button>
            ))}
          </>
        )}
      </div>
    );
  }

  function toggleSelectedLetterMetrics() {
    const nextOpen = !selectedLetterMetricsOpen;

    setActiveLetterSettingsSliderId(null);
    setActiveFontSettingsSliderId(null);
    setActiveStickerMetricId(null);
    setSelectedStickerMetricsOpen(false);
    setFontEffectsMenuOpen(false);
    setSelectedLetterMetricsOpen(nextOpen);
    setShareStatus(nextOpen ? "Choose size or spacing metrics." : "Letter metrics closed.");
  }

  function toggleSelectedLetterEffects() {
    const nextOpen = !fontEffectsMenuOpen;

    setActiveLetterSettingsSliderId(null);
    setActiveFontSettingsSliderId(null);
    setActiveStickerMetricId(null);
    setSelectedStickerMetricsOpen(false);
    setSelectedLetterMetricsOpen(false);
    setSelectedLetterMetricGroup(null);
    setFontEffectsMenuOpen(nextOpen);
    setShareStatus(nextOpen ? "Letter effects shown." : "Letter effects closed.");
  }

  function selectLetterMetricGroup(group: SelectedTextMetricGroup) {
    setSelectedLetterMetricGroup(group);
    setSelectedLetterMetricsOpen(false);
    setActiveLetterSettingsSliderId(null);
    setActiveFontSettingsSliderId(null);
    setActiveStickerMetricId(null);
    setSelectedStickerMetricsOpen(false);
    setFontEffectsMenuOpen(false);
    setShareStatus(group === "size" ? "Size metrics shown." : "Spacing metrics shown.");
  }

  function getSelectedLetterMetricConfigs() {
    const metricIds: LetterSettingsSliderId[] = selectedLetterMetricGroup === "spacing"
      ? ["xAdvance", "leftBearing", "rightBearing"]
      : selectedLetterMetricGroup === "size"
        ? ["size", "height", "width"]
        : [];

    return metricIds.map((id) => getLetterSettingsSliderConfig(id));
  }

  function renderSelectedLetterMetricsPopover() {
    return (
      <div className="selected-text-metrics-popover" aria-label="Letter metric groups">
        <button
          className={`draw-glass-button selected-text-metric-option ${
            selectedLetterMetricGroup === "size" ? "active-tool" : ""
          }`}
          type="button"
          aria-pressed={selectedLetterMetricGroup === "size"}
          onClick={() => selectLetterMetricGroup("size")}
        >
          <Scaling aria-hidden="true" />
          <span>Size</span>
        </button>
        <button
          className={`draw-glass-button selected-text-metric-option ${
            selectedLetterMetricGroup === "spacing" ? "active-tool" : ""
          }`}
          type="button"
          aria-pressed={selectedLetterMetricGroup === "spacing"}
          onClick={() => selectLetterMetricGroup("spacing")}
        >
          <Space aria-hidden="true" />
          <span>Spacing</span>
        </button>
      </div>
    );
  }

  function renderSelectedLetterOptionsRow() {
    const metricConfigs = getSelectedLetterMetricConfigs();
    const activeSliderConfig = activeLetterSettingsSliderId
      ? metricConfigs.find((config) => config.id === activeLetterSettingsSliderId) ?? null
      : null;
    const selectedLetterMetricsActive = selectedLetterMetricsOpen || Boolean(selectedLetterMetricGroup);
    const selectedLetterEffectsVisible = fontEffectsMenuOpen;
    const activeEffectCount = previewTextEffectOptions.filter((option) => imageSettings.textEffects[option.id]).length;

    return (
      <div
        className={`phone-image-action-row selected-text-option-row selected-letter-option-row ${
          selectedLetterMetricsOpen || selectedLetterMetricGroup ? "metrics-open" : ""
        } ${selectedLetterEffectsVisible ? "effects-open" : ""}`}
        aria-label="Selected letter options"
      >
        {activeSliderConfig ? renderLetterSettingsSliderDrawer(activeSliderConfig) : null}
        {!selectedLetterEffectsVisible ? (
          <>
            <button
              className={`draw-icon-button draw-glass-button selected-text-option-button ${
                selectedLetterMetricsOpen ? "active-tool" : ""
              }`}
              type="button"
              aria-pressed={selectedLetterMetricsOpen}
              onClick={toggleSelectedLetterMetrics}
            >
              <Ruler aria-hidden="true" />
              <span>Metrics</span>
            </button>

            {!selectedLetterMetricsActive ? (
              <button
                className={`draw-icon-button draw-glass-button selected-text-option-button ${
                  activeEffectCount > 0 ? "active-tool" : ""
                }`}
                type="button"
                aria-expanded={selectedLetterEffectsVisible}
                aria-label={`Letter effects${activeEffectCount > 0 ? `: ${activeEffectCount} active` : ""}`}
                onClick={toggleSelectedLetterEffects}
              >
                <Sparkles aria-hidden="true" />
                <span>Effects</span>
              </button>
            ) : null}

            {!selectedLetterMetricsActive ? (
              <button
                className="draw-icon-button draw-glass-button selected-text-option-button selected-letter-design-button"
                type="button"
                onClick={openSelectedLetterEditor}
              >
                <PenLine aria-hidden="true" />
                <span>Design</span>
              </button>
            ) : null}

            {selectedLetterMetricsOpen ? renderSelectedLetterMetricsPopover() : null}
            {metricConfigs.map((config) => {
              const selected = activeLetterSettingsSliderId === config.id;

              return (
                <button
                  key={config.id}
                  className={`draw-icon-button draw-glass-button selected-text-inline-metric-button ${
                    selected ? "active-tool" : ""
                  }`}
                  type="button"
                  aria-expanded={selected}
                  aria-label={`${config.label} for ${settingsGlyphLabel}: ${formatMetricValue(config.value, config.precision)}`}
                  onClick={() => {
                    setSelectedLetterMetricsOpen(false);
                    setFontEffectsMenuOpen(false);
                    setActiveLetterSettingsSliderId((current) => (current === config.id ? null : config.id));
                  }}
                >
                  {getLetterSettingsSliderIcon(config.id)}
                  <span>{config.label}</span>
                  <strong>{formatMetricValue(config.value, config.precision)}</strong>
                </button>
              );
            })}
            {metricConfigs.length > 0 ? (
              <button
                className="draw-glass-button selected-text-apply-button"
                type="button"
                disabled={!hasPendingFontSpacingChanges}
                onClick={applyFontSpacingToFont}
                aria-label="Apply letter metric changes to Font"
                title="Apply to Font"
              >
                Apply
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button
              className="draw-icon-button draw-glass-button selected-text-option-button active-tool"
              type="button"
              aria-expanded={selectedLetterEffectsVisible}
              aria-label={`Letter effects${activeEffectCount > 0 ? `: ${activeEffectCount} active` : ""}`}
              onClick={toggleSelectedLetterEffects}
            >
              <Sparkles aria-hidden="true" />
              <span>Effects</span>
            </button>
            {previewTextEffectOptions.map((option) => (
              <button
                key={option.id}
                className={`draw-glass-button selected-text-effect-button ${
                  imageSettings.textEffects[option.id] ? "active-tool" : ""
                }`}
                type="button"
                aria-pressed={imageSettings.textEffects[option.id]}
                onClick={() => togglePreviewTextEffect(option.id)}
              >
                {option.label}
              </button>
            ))}
          </>
        )}
      </div>
    );
  }

  function getStyleSelectStickerFilter(target = styleSelectTarget) {
    return (sticker: PreviewSticker) => (
      target === "ornaments" ? !isEyePreviewSticker(sticker) : isEyePreviewSticker(sticker)
    );
  }

  function getCurrentStyleSelectSticker() {
    if (styleSelectTarget !== "stickers" && styleSelectTarget !== "ornaments") {
      return null;
    }

    const filterSticker = getStyleSelectStickerFilter();
    const selectedSticker = selectedPreviewStickerId
      ? previewStickers.find((sticker) => sticker.id === selectedPreviewStickerId && filterSticker(sticker)) ?? null
      : null;

    return selectedSticker ?? [...previewStickers].reverse().find(filterSticker) ?? null;
  }

  function getCurrentStyleSelectDoodle() {
    if (styleSelectTarget !== "doodles") {
      return null;
    }

    const selectedDoodle = selectedPreviewDoodleId
      ? previewDoodles.find((stroke) => stroke.id === selectedPreviewDoodleId) ?? null
      : null;

    return selectedDoodle ?? previewDoodles.at(-1) ?? null;
  }

  function getStickerMetricConfig(id: StickerMetricId): StickerMetricConfig {
    const sticker = getCurrentStyleSelectSticker();
    const asset = sticker ? getStyleStickerAsset(sticker.kind) : null;
    const defaultSize = asset ? getDefaultPreviewStickerSize(asset) : 0.03;
    const sizeMin = asset ? (asset.minSize ?? 0.018) / defaultSize : 0.6;
    const sizeMax = asset ? (asset.maxSize ?? 0.07) / defaultSize : 2;
    const disabled = !sticker;

    switch (id) {
      case "size":
        return {
          disabled,
          id,
          label: "Size",
          max: sizeMax,
          min: sizeMin,
          precision: 2,
          step: 0.05,
          value: sticker ? getClampedMetricValue(sticker.size / defaultSize, sizeMin, sizeMax, 2) : 1,
        };
      case "height":
        return {
          disabled,
          id,
          label: "Height",
          max: 1.8,
          min: 0.35,
          precision: 2,
          step: 0.05,
          value: sticker ? getPreviewStickerHeightScale(sticker) : 1,
        };
      case "width":
        return {
          disabled,
          id,
          label: "Width",
          max: 1.8,
          min: 0.35,
          precision: 2,
          step: 0.05,
          value: sticker ? getPreviewStickerWidthScale(sticker) : 1,
        };
    }
  }

  function getDoodleMetricConfig(id: StickerMetricId): StickerMetricConfig {
    const doodle = getCurrentStyleSelectDoodle();
    const defaultSize = Math.max(0.001, doodle?.baseSize ?? doodle?.size ?? styleDoodleBrushSize / Math.max(1, imageSettings.canvasWidth));
    const disabled = !doodle;

    switch (id) {
      case "size":
        return {
          disabled,
          id,
          label: "Size",
          max: 2.5,
          min: 0.35,
          precision: 2,
          step: 0.05,
          value: doodle ? getClampedMetricValue(doodle.size / defaultSize, 0.35, 2.5, 2) : 1,
        };
      case "height":
        return {
          disabled,
          id,
          label: "Height",
          max: 1.8,
          min: 0.35,
          precision: 2,
          step: 0.05,
          value: doodle ? getPreviewDoodleHeightScale(doodle) : 1,
        };
      case "width":
        return {
          disabled,
          id,
          label: "Width",
          max: 1.8,
          min: 0.35,
          precision: 2,
          step: 0.05,
          value: doodle ? getPreviewDoodleWidthScale(doodle) : 1,
        };
    }
  }

  function setSelectedStickerMetricValue(id: StickerMetricId, value: number) {
    const config = getStickerMetricConfig(id);
    const filterSticker = getStyleSelectStickerFilter();

    updateSelectedPreviewSticker((sticker) => {
      const nextValue = getClampedMetricValue(value, config.min, config.max, config.precision);

      if (id === "size") {
        const asset = getStyleStickerAsset(sticker.kind);
        return {
          ...sticker,
          size: getDefaultPreviewStickerSize(asset) * nextValue,
        };
      }

      if (id === "height") {
        return {
          ...sticker,
          heightScale: nextValue,
        };
      }

      return {
        ...sticker,
        widthScale: nextValue,
      };
    }, filterSticker);
    setActiveDocumentId(null);
    setShareStatus(`${config.label} updated.`);
  }

  function setSelectedDoodleMetricValue(id: StickerMetricId, value: number) {
    const config = getDoodleMetricConfig(id);
    const doodleId = getCurrentStyleSelectDoodle()?.id ?? null;

    if (!doodleId) {
      setShareStatus("Design a doodle first.");
      return;
    }

    setSelectedPreviewDoodleId(doodleId);
    setPreviewDoodles((current) => {
      const nextDoodles = current.map((stroke) => {
        if (stroke.id !== doodleId) {
          return stroke;
        }

        const nextValue = getClampedMetricValue(value, config.min, config.max, config.precision);
        const baseSize = Math.max(0.001, stroke.baseSize ?? stroke.size);

        if (id === "size") {
          return {
            ...stroke,
            baseSize,
            size: baseSize * nextValue,
          };
        }

        if (id === "height") {
          return {
            ...stroke,
            heightScale: nextValue,
          };
        }

        return {
          ...stroke,
          widthScale: nextValue,
        };
      });

      previewDoodlesRef.current = nextDoodles;
      return nextDoodles;
    });
    setActiveDocumentId(null);
    scheduleStyleCanvasRender();
    setShareStatus(`${config.label} updated.`);
  }

  function setSelectedDecorMetricValue(id: StickerMetricId, value: number) {
    if (styleSelectTarget === "doodles") {
      setSelectedDoodleMetricValue(id, value);
      return;
    }

    setSelectedStickerMetricValue(id, value);
  }

  function getStickerMetricIcon(id: StickerMetricId) {
    switch (id) {
      case "size":
        return <Scaling aria-hidden="true" />;
      case "height":
        return <MoveVertical aria-hidden="true" />;
      case "width":
        return <MoveHorizontal aria-hidden="true" />;
    }
  }

  function renderStickerMetricSliderDrawer(config: StickerMetricConfig) {
    const sliderFill = Math.max(0, Math.min(100, ((config.value - config.min) / (config.max - config.min)) * 100));

    return (
      <div
        className="font-slider-drawer sticker-slider-drawer"
        style={{ "--slider-fill": `${sliderFill}%` } as CSSProperties}
        aria-label={`${config.label} slider`}
      >
        <div className="font-slider-body font-settings-slider-body">
          <button
            className="draw-icon-button draw-glass-button font-slider-default-button"
            type="button"
            disabled={config.disabled}
            onClick={() => setSelectedDecorMetricValue(config.id, 1)}
            aria-label={`Default ${config.label}`}
            title="Default"
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <input
            className="font-horizontal-slider"
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={config.value}
            disabled={config.disabled}
            onChange={(event) => setSelectedDecorMetricValue(config.id, Number(event.target.value))}
            aria-label={`${config.label} value`}
          />
          <button
            className="draw-icon-button draw-glass-button font-slider-step-button"
            type="button"
            disabled={config.disabled}
            onClick={() => setSelectedDecorMetricValue(config.id, config.value - config.step)}
            aria-label={`Decrease ${config.label}`}
            title={`Decrease ${config.label}`}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            className="draw-icon-button draw-glass-button font-slider-step-button"
            type="button"
            disabled={config.disabled}
            onClick={() => setSelectedDecorMetricValue(config.id, config.value + config.step)}
            aria-label={`Increase ${config.label}`}
            title={`Increase ${config.label}`}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  function renderSelectedStickerOptionsRow() {
    const metricConfigs = (["size", "height", "width"] as StickerMetricId[]).map((id) =>
      styleSelectTarget === "doodles" ? getDoodleMetricConfig(id) : getStickerMetricConfig(id),
    );
    const activeSliderConfig = activeStickerMetricId
      ? metricConfigs.find((config) => config.id === activeStickerMetricId) ?? null
      : null;
    const targetLabel = getStyleSelectTargetLabel(styleSelectTarget);

    return (
      <div
        className={`phone-image-action-row selected-text-option-row selected-sticker-option-row ${
          selectedStickerMetricsOpen ? "metrics-open" : ""
        }`}
        aria-label={`Selected ${targetLabel.toLowerCase()} options`}
      >
        {activeSliderConfig ? renderStickerMetricSliderDrawer(activeSliderConfig) : null}
        <button
          className={`draw-icon-button draw-glass-button selected-text-option-button ${
            selectedStickerMetricsOpen ? "active-tool" : ""
          }`}
          type="button"
          aria-pressed={selectedStickerMetricsOpen}
          onClick={() => {
            const nextOpen = !selectedStickerMetricsOpen;
            setSelectedStickerMetricsOpen(nextOpen);
            setActiveStickerMetricId(null);
            setShareStatus(nextOpen ? `${targetLabel} metrics shown.` : `${targetLabel} metrics closed.`);
          }}
        >
          <Ruler aria-hidden="true" />
          <span>Metrics</span>
        </button>

        {selectedStickerMetricsOpen ? metricConfigs.map((config) => {
          const selected = activeStickerMetricId === config.id;

          return (
            <button
              key={config.id}
              className={`draw-icon-button draw-glass-button selected-text-inline-metric-button ${
                selected ? "active-tool" : ""
              }`}
              type="button"
              disabled={config.disabled}
              aria-expanded={selected}
              aria-label={`${targetLabel} ${config.label}: ${formatMetricValue(config.value, config.precision)}`}
              onClick={() => setActiveStickerMetricId((current) => (current === config.id ? null : config.id))}
            >
              {getStickerMetricIcon(config.id)}
              <span>{config.label}</span>
              <strong>{formatMetricValue(config.value, config.precision)}</strong>
            </button>
          );
        }) : null}
      </div>
    );
  }

  function renderStyleSelectionActions() {
    if (!styleSelectModeActive || styleSelectMenuOpen || fullscreenSelectMenuOpen) {
      return null;
    }

    if (styleSelectTarget === "stickers" || styleSelectTarget === "ornaments" || styleSelectTarget === "doodles") {
      return renderSelectedStickerOptionsRow();
    }

    if (styleSelectTarget === "letter") {
      return renderSelectedLetterOptionsRow();
    }

    if (isTextSelectionTarget()) {
      return renderSelectedTextOptionsRow();
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
            const selectMenuWasOpen = styleSelectMenuOpen;

            setStyleDrawMode(false);
            setStyleStickerLookMode(false);
            setStyleStickerMoveMode(false);
            setStyleMoveModeActive(false);
            setStyleStickerFacePanelOpen(false);
            setStyleStickerRednessPanelOpen(false);
            setStyleStickerSleepPanelOpen(false);
            setSelectedPreviewTextLayerId(null);
            setSelectedTextMetricsOpen(false);
            setSelectedTextMetricGroup(null);
            setSelectedLetterMetricsOpen(false);
            setSelectedLetterMetricGroup(null);
            setSelectedTextDeletePrimed(false);
            setActiveFontSettingsSliderId(null);
            setActiveLetterSettingsSliderId(null);
            setFontEffectsMenuOpen(false);
            setActiveStyleDrawer(null);
            styleMovingTextRef.current = null;
            styleMovingDoodleRef.current = null;

            if (selectMenuWasOpen) {
              setStyleSelectModeActive(false);
              setStyleSelectMenuOpen(false);
              setShareStatus("Select closed.");
              return;
            }

            setStyleSelectModeActive(true);
            setStyleSelectMenuOpen(true);
            return;
          }

          setStyleSelectMenuOpen(false);
          setStyleSelectModeActive(false);
          setStyleMoveModeActive(false);
          styleMovingTextRef.current = null;
          styleMovingDoodleRef.current = null;

          if (drawer === "doodle") {
            setStyleStickerLookMode(false);
            setStyleStickerMoveMode(false);
            setStyleMoveModeActive(false);
            setStyleStickerFacePanelOpen(false);
            setStyleStickerRednessPanelOpen(false);
            setStyleStickerSleepPanelOpen(false);
            toggleStyleDrawer("doodle");
            return;
          }

          setStyleDrawMode(false);
          setStyleStickerLookMode(false);
          setStyleStickerMoveMode(false);
          setStyleMoveModeActive(false);
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

  function renderStyleStickerPreview(asset: StyleStickerAsset) {
    if (asset.kind === "color-swatch") {
      return (
        <span
          className="style-color-swatch-preview"
          style={{ backgroundColor: normalizePreviewPaletteHex(imageSettings.inkColor, "#19140f") }}
          aria-hidden="true"
        />
      );
    }

    if (asset.src) {
      return <img src={asset.src} alt="" draggable={false} aria-hidden="true" />;
    }

    return <PreviewEyeStickerPreview expression={previewStickerExpression} />;
  }

  function renderPageStyleControls(className = "draw-control-drawer style-control-drawer") {
    const themedBackgroundPresets = getFontPalette(font.theme?.paletteId).backgrounds;
    const themedBackgroundIds = new Set(themedBackgroundPresets.map((preset) => preset.id));
    const otherBackgroundPresets = backgroundPresets.filter((preset) => !themedBackgroundIds.has(preset.id));
    const otherBackgroundSelected = !imageSettings.transparent && otherBackgroundPresets.some((preset) => (
      preset.id === imageSettings.backgroundStyle
    ));
    const renderBackgroundPresetButton = (preset: BackgroundPreset) => (
      <button
        key={preset.id}
        className={`draw-background-preset ${
          imageSettings.backgroundStyle === preset.id && !imageSettings.transparent ? "selected" : ""
        }`}
        type="button"
        disabled={imageSettings.transparent}
        onClick={() => {
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
          }));
        }}
        aria-label={`Use ${preset.label} background`}
        title={preset.label}
      >
        <span style={{ background: preset.preview }} />
      </button>
    );

    return (
      <div className={className} aria-label="Page style drawer">
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
        <button
          className={`secondary-button compact-button style-transparent-toggle ${imageSettings.transparent ? "active-tool" : ""}`}
          type="button"
          aria-pressed={imageSettings.transparent}
          onClick={() =>
            setImageSettings((current) => ({ ...current, transparent: !current.transparent }))
          }
        >
          Transparent background
        </button>
        <p className="style-label">Backgrounds</p>
        <div className="draw-background-presets style-background-presets" aria-label="Backgrounds">
          {themedBackgroundPresets.map(renderBackgroundPresetButton)}
          <button
            className={`secondary-button compact-button style-background-others-button ${
              otherBackgroundsOpen || otherBackgroundSelected ? "active-tool" : ""
            }`}
            type="button"
            aria-expanded={otherBackgroundsOpen}
            onClick={() => setOtherBackgroundsOpen((open) => !open)}
          >
            Others
          </button>
        </div>
        {otherBackgroundsOpen && (
          <div className="draw-background-presets style-background-presets style-background-others-grid" aria-label="Other backgrounds">
            {otherBackgroundPresets.map(renderBackgroundPresetButton)}
          </div>
        )}
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
      </div>
    );
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
                setShareStatus(styleDrawMode ? "Doodle off." : "Design doodles on the page.");
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

          <div className="draw-ink-highlight-row palette-doodle-swatch-group">
            <span>Color swatches</span>
            <div className="draw-ink-swatches style-ink-swatches palette-doodle-swatches" aria-label="Color swatches">
              {palettePageFields.map((field) => {
                const swatchColor = normalizePreviewPaletteHex(
                  palettePageDraft[field.id],
                  defaultPalettePageDraft[field.id],
                );
                const selected = imageSettings.inkColor.trim().toLowerCase() === swatchColor.trim().toLowerCase();

                return (
                  <button
                    key={field.id}
                    className={`draw-ink-swatch ${selected ? "selected" : ""}`}
                    type="button"
                    onClick={() => setImageSettings((current) => ({ ...current, inkColor: swatchColor }))}
                    aria-label={`Use ${field.label} color swatch`}
                    aria-pressed={selected}
                    title={`${field.label} ${swatchColor}`}
                  >
                    <span style={{ backgroundColor: swatchColor }} />
                  </button>
                );
              })}
            </div>
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

    if (activeStyleDrawer === "text") {
      return (
        <div
          className={`draw-control-drawer style-control-drawer ${draftPreviewTextLayer ? "style-text-draft-drawer" : ""}`}
          aria-label="Text drawer"
        >
          {renderPositionSettingsControls("alignment-row text-position-row style-text-position-row")}
          {draftPreviewTextLayer ? (
            <div className="style-text-layer-card">
              <div className="style-text-layer-field">
                {renderPreviewTextFontPicker({
                  ariaLabel: "New text font",
                  pickerId: "draft",
                  value: draftPreviewTextLayer.fontId,
                  onChange: (fontId) => updateDraftPreviewTextLayer({ fontId }),
                })}
              </div>

              <label className="draw-drawer-range">
                <span>Size</span>
                <input
                  type="range"
                  min="0.55"
                  max="2"
                  step="0.05"
                  value={draftPreviewTextLayer.sizeScale}
                  onChange={(event) => updateDraftPreviewTextLayer({ sizeScale: Number(event.target.value) })}
                />
                <output>{draftPreviewTextLayer.sizeScale.toFixed(2)}x</output>
              </label>

              <textarea
                className="style-text-layer-input"
                aria-label="New text layer"
                value={draftPreviewTextLayer.text}
                onChange={(event) => updateDraftPreviewTextLayer({ text: event.target.value })}
                placeholder="Type text"
                spellCheck={false}
              />
              <div className="style-add-action-row">
                <button
                  className="draw-drawer-button accent style-add-text-button"
                  type="button"
                  disabled={!draftPreviewTextLayer.text.trim()}
                  onClick={addPreviewTextLayer}
                >
                  <Plus aria-hidden="true" />
                  <span>Add text</span>
                </button>
                <button
                  className="draw-drawer-button style-add-swatch-button"
                  type="button"
                  onClick={insertColorSwatchIntoTextDraft}
                >
                  <Pipette aria-hidden="true" />
                  <span>Add color swatch</span>
                </button>
              </div>
            </div>
          ) : previewTextLayers.length === 0 ? (
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

                  <div className="style-text-layer-field">
                    {renderPreviewTextFontPicker({
                      ariaLabel: `Text ${index + 1} font`,
                      pickerId: `layer:${layer.id}`,
                      value: layer.fontId,
                      onChange: (fontId) => updatePreviewTextLayer(layer.id, { fontId }),
                    })}
                  </div>

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
          {!draftPreviewTextLayer ? (
            <div className="style-add-action-row">
              <button
                className="draw-drawer-button accent style-add-text-button"
                type="button"
                onClick={openPreviewTextLayerDraft}
              >
                <Plus aria-hidden="true" />
                <span>Add text</span>
              </button>
              <button
                className="draw-drawer-button style-add-swatch-button"
                type="button"
                onClick={insertColorSwatchIntoTextDraft}
              >
                <Pipette aria-hidden="true" />
                <span>Add color swatch</span>
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    if (activeStyleDrawer === "select") {
      return (
        <div className="draw-control-drawer style-control-drawer" aria-label="Select drawer">
          <div className="draw-drawer-grid two" aria-label="Selectable decor">
            <button
              className={`draw-drawer-button ${styleSelectTarget === "stickers" ? "active-tool" : ""}`}
              type="button"
              onClick={() => {
                setStyleSelectTarget("stickers");
                setStyleStickerMoveMode(false);
                setShareStatus("Tap a sticker on the page to select it.");
              }}
            >
              <Sticker aria-hidden="true" />
              <span>Stickers</span>
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
                {selectedPreviewStickerId ? "Sticker selected." : "Tap a sticker on the page, or add one from Stickers."}
              </p>
              <button
                className={`draw-drawer-button full ${styleStickerMoveMode ? "active-tool" : ""}`}
                type="button"
                disabled={!selectedPreviewStickerId}
                onClick={() => {
                  setStyleDrawMode(false);
                  setStyleStickerMoveMode((current) => !current);
                  setShareStatus(styleStickerMoveMode ? "Sticker move off." : "Drag selected sticker on the page.");
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
                  <button className="draw-drawer-button accent full" type="button" onClick={openPreviewTextLayerDraft}>
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
                  <div className="style-text-layer-field">
                    {renderPreviewTextFontPicker({
                      ariaLabel: "Selected text font",
                      pickerId: `selected:${selectedPreviewTextLayer.id}`,
                      value: selectedPreviewTextLayer.fontId,
                      onChange: (fontId) => updatePreviewTextLayer(selectedPreviewTextLayer.id, { fontId }),
                    })}
                  </div>
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
            {styleStickerOnlyAssets.map((asset) => (
              <button
                key={asset.id}
                className={`draw-drawer-button style-sticker-button ${asset.kind === "eyes" ? "style-eyes-button" : ""}`}
                type="button"
                aria-label={`Drag ${asset.label} sticker onto page`}
                draggable={false}
                title={asset.label}
                onClick={(event) => event.preventDefault()}
                onPointerDown={(event) => beginStyleStickerDrag(event, asset)}
              >
                {renderStyleStickerPreview(asset)}
                {asset.kind !== "eyes" && <span>{asset.label}</span>}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (activeStyleDrawer === "ornaments") {
      return (
        <div className="draw-control-drawer style-control-drawer" aria-label="Ornament drawer">
          <div className="draw-drawer-grid style-sticker-grid">
            {styleOrnamentAssets.map((asset) => (
              <button
                key={asset.id}
                className="draw-drawer-button style-sticker-button"
                type="button"
                aria-label={`Drag ${asset.label} ornament onto page`}
                draggable={false}
                title={asset.label}
                onClick={(event) => event.preventDefault()}
                onPointerDown={(event) => beginStyleStickerDrag(event, asset)}
              >
                {renderStyleStickerPreview(asset)}
                <span>{asset.label}</span>
              </button>
            ))}
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

  function getClampedMetricValue(value: number, min: number, max: number, precision = 2) {
    return Number(Math.min(max, Math.max(min, value)).toFixed(precision));
  }

  function updateManuscriptMetric(metric: ManuscriptMetricKey, value: number) {
    setImageSettings((current) => ({
      ...current,
      [metric]: Math.min(1, Math.max(0, value)),
    }));
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

    setFontMetricValue(metric, nextValue, min, max, precision);
  }

  function setFontMetricValue(
    metric: FontGlyphMetricKey,
    value: number,
    min: number,
    max: number,
    precision = 2,
  ) {
    const nextValue = getClampedMetricValue(value, min, max, precision);

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
    const currentShapeSettings = previewFont.shapeSettings ?? { heightScale: 1, letterSpacing: 0, widthScale: 1 };
    const nextValue = getSteppedValue(currentShapeSettings[metric], delta, min, max, precision);

    setFontShapeMetricValue(metric, nextValue, min, max, precision);
  }

  function setFontShapeMetricValue(
    metric: keyof FontShapeSettings,
    value: number,
    min: number,
    max: number,
    precision = 2,
  ) {
    const currentShapeSettings = previewFont.shapeSettings ?? { heightScale: 1, letterSpacing: 0, widthScale: 1 };
    const nextValue = getClampedMetricValue(value, min, max, precision);

    setPreviewShapeSettings({
      ...currentShapeSettings,
      [metric]: nextValue,
    });
    setShareStatus("Preview-only font shape updated.");
  }

  function applyFontSpacingToFont() {
    if (!hasPendingFontSpacingChanges) {
      return;
    }

    onApplyFontSpacing({
      fontMetricOverrides: previewFontMetricOverrides,
      glyphMetricOverrides: previewGlyphMetricOverrides,
      guideSettings: previewGuideSettings,
      shapeSettings: previewFont.shapeSettings ?? { heightScale: 1, letterSpacing: 0, widthScale: 1 },
    });
    setPreviewFontMetricOverrides({});
    setPreviewGlyphMetricOverrides({});
    setPreviewGuideSettings(null);
    setPreviewShapeSettings(null);
    setShareStatus("Applied spacing to the saved font.");
  }

  function updateSpacebarAdvance(delta: number) {
    const nextValue = getSteppedValue(previewSpacebarGlyph.xAdvance, delta, 0.18, 1.2, 2);

    setSpacebarAdvanceValue(nextValue);
  }

  function setSpacebarAdvanceValue(value: number) {
    const nextValue = getClampedMetricValue(value, 0.18, 1.2, 2);

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
    metric: LetterSettingsSliderId,
    delta: number,
    min: number,
    max: number,
    precision = 2,
  ) {
    const currentValue = metric === "size" ? (settingsGlyph.width + settingsGlyph.height) / 2 : settingsGlyph[metric];
    const nextValue = getSteppedValue(currentValue, delta, min, max, precision);

    setSelectedLetterMetricValue(metric, nextValue, min, max, precision);
  }

  function setSelectedLetterMetricValue(
    metric: LetterSettingsSliderId,
    value: number,
    min: number,
    max: number,
    precision = 2,
  ) {
    const nextValue = getClampedMetricValue(value, min, max, precision);

    setPreviewGlyphMetricOverrides((current) => ({
      ...current,
      [settingsGlyph.character]: {
        ...(current[settingsGlyph.character] ?? {}),
        ...(metric === "size"
          ? {
              height: nextValue,
              width: nextValue,
            }
          : {
              [metric]: nextValue,
            }),
      },
    }));
    setShareStatus(`Preview-only "${settingsGlyphLabel}" settings updated.`);
  }

  function openSelectedLetterEditor() {
    if (composeFullscreenOnly) {
      setImageViewerOpen(true);
      return;
    }

    setImageViewerOpen(false);
    onOpenCharacterEditor(settingsGlyph.character);
    setShareStatus(`Editing "${settingsGlyphLabel}".`);
  }

  function openStyleEditor(startDrawer: StyleDrawer = null) {
    setActiveSettingsPanel("decor");
    setActiveStyleDrawer(startDrawer);
    setExpandedPreviewTextFontPickerId(null);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);
    setSelectedTextDeletePrimed(false);
    setFontEffectsMenuOpen(false);
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
  }

  function closeStyleEditor() {
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setDraftPreviewTextLayer(null);
    setExpandedPreviewTextFontPickerId(null);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);
    setSelectedTextDeletePrimed(false);
  }

  function toggleStyleDrawer(drawer: Exclude<StyleDrawer, null>) {
    setActiveStyleDrawer((current) => (current === drawer ? null : drawer));
  }

  function getEditablePreviewStickerId(
    stickers = previewStickers,
    filterSticker: (sticker: PreviewSticker) => boolean = () => true,
  ) {
    if (
      selectedPreviewStickerId &&
      stickers.some((sticker) => sticker.id === selectedPreviewStickerId && filterSticker(sticker))
    ) {
      return selectedPreviewStickerId;
    }

    return stickers.filter(filterSticker).at(-1)?.id ?? null;
  }

  function updateSelectedPreviewSticker(
    updater: (sticker: PreviewSticker) => PreviewSticker,
    filterSticker: (sticker: PreviewSticker) => boolean = () => true,
  ) {
    const stickerId = getEditablePreviewStickerId(previewStickers, filterSticker);

    if (!stickerId) {
      setShareStatus("Add a sticker first.");
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
      size: Math.min(
        getStyleStickerAsset(sticker.kind).maxSize ?? 0.07,
        Math.max(getStyleStickerAsset(sticker.kind).minSize ?? 0.018, sticker.size + delta),
      ),
    }));
  }

  function deleteSelectedPreviewSticker() {
    const stickerId = getEditablePreviewStickerId();

    if (!stickerId) {
      setShareStatus("Add a sticker first.");
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
    setShareStatus("Deleted sticker.");
  }

  function getDefaultPreviewStickerSize(asset: StyleStickerAsset) {
    return asset.defaultSize ?? 0.03;
  }

  function addPreviewStickerAt(point: PreviewDoodlePoint, asset: StyleStickerAsset) {
    const stickerId = createPreviewId();

    setPreviewStickers((current) => {
      const nextStickers = [
        ...current,
        {
          expression: previewStickerExpression,
          ...(asset.kind === "color-swatch"
            ? { color: normalizePreviewPaletteHex(imageSettings.inkColor, "#19140f") }
            : {}),
          id: stickerId,
          kind: asset.kind,
          size: getDefaultPreviewStickerSize(asset),
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
    setShareStatus(`Dropped ${asset.label}.`);
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
      setShareStatus("Drag sticker onto the page.");
    }

    styleStickerDragRef.current = {
      ...drag,
      isDragging,
      x: event.clientX,
      y: event.clientY,
    };
    setStyleStickerDragPreview({
      asset: drag.asset,
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

    const canvas = viewerCanvasRef.current;

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
      setShareStatus("Drop sticker on the page to add it.");
      return;
    }

    addPreviewStickerAt(getStyleCanvasPoint(canvas, event.clientX, event.clientY), drag.asset);
  }

  function handleStyleStickerDragCancel(event?: PointerEvent) {
    const drag = styleStickerDragRef.current;

    if (event && drag && event.pointerId !== drag.pointerId) {
      return;
    }

    cancelStyleStickerDrag();
  }

  function beginStyleStickerDrag(event: ReactPointerEvent<HTMLButtonElement>, asset: StyleStickerAsset) {
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
      asset,
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

  function formatMetricValue(value: number, precision = 2) {
    return precision > 0 ? value.toFixed(precision) : value.toString();
  }

  function getImageSettingsPresetDefaults() {
    if (imageSettings.exportPreset === "custom") {
      return customImageMetricDefaultsRef.current;
    }

    const presetSettings = exportPresets.find((item) => item.id === imageSettings.exportPreset)?.settings ?? {};
    const canvasHeight =
      typeof presetSettings.canvasHeight === "number"
        ? presetSettings.canvasHeight
        : defaultPhoneImageSettings.canvasHeight;
    const canvasWidth =
      typeof presetSettings.canvasWidth === "number"
        ? presetSettings.canvasWidth
        : defaultPhoneImageSettings.canvasWidth;
    const pagePadding =
      typeof presetSettings.pagePadding === "number"
        ? presetSettings.pagePadding
        : defaultPhoneImageSettings.pagePadding;

    return { canvasHeight, canvasWidth, pagePadding };
  }

  function getImageSettingsSliderConfig(id: ImageSettingsSliderId): ImageSettingsSliderConfig {
    const defaults = getImageSettingsPresetDefaults();

    switch (id) {
      case "size":
        const min = Math.max(
          MIN_IMAGE_CANVAS_WIDTH / defaults.canvasWidth,
          MIN_IMAGE_CANVAS_HEIGHT / defaults.canvasHeight,
        );
        const max = Math.min(
          MAX_IMAGE_CANVAS_WIDTH / defaults.canvasWidth,
          MAX_IMAGE_CANVAS_HEIGHT / defaults.canvasHeight,
        );

        return {
          id,
          label: "Size",
          max,
          min,
          precision: 2,
          step: 0.05,
          value: getClampedMetricValue(imageSettings.canvasWidth / defaults.canvasWidth, min, max, 2),
        };
      case "canvasWidth":
        return {
          id,
          label: "Width",
          max: MAX_IMAGE_CANVAS_WIDTH,
          min: MIN_IMAGE_CANVAS_WIDTH,
          precision: 0,
          step: 80,
          value: imageSettings.canvasWidth,
        };
      case "canvasHeight":
        return {
          id,
          label: "Height",
          max: MAX_IMAGE_CANVAS_HEIGHT,
          min: MIN_IMAGE_CANVAS_HEIGHT,
          precision: 0,
          step: 80,
          value: imageSettings.canvasHeight,
        };
      case "pagePadding":
        return {
          id,
          label: "Padding",
          max: 260,
          min: 0,
          precision: 0,
          step: 8,
          value: imageSettings.pagePadding,
        };
    }
  }

  function setImageSettingsSliderValue(id: ImageSettingsSliderId, value: number) {
    const config = getImageSettingsSliderConfig(id);
    const nextValue = getClampedMetricValue(value, config.min, config.max, config.precision);

    if (id === "size") {
      const defaults = getImageSettingsPresetDefaults();

      setImageSettings((current) => ({
        ...current,
        canvasHeight: Math.round(defaults.canvasHeight * nextValue),
        canvasWidth: Math.round(defaults.canvasWidth * nextValue),
        exportPreset: "custom",
      }));
      setShareStatus("Image size updated.");
      return;
    }

    setImageSettings((current) => ({
      ...current,
      [id]: nextValue,
      exportPreset: "custom",
    }));
    setShareStatus(`${config.label} updated.`);
  }

  function getLetterSettingsSliderConfig(id: LetterSettingsSliderId): LetterSettingsSliderConfig {
    switch (id) {
      case "size":
        return {
          id,
          label: "Size",
          max: 1.8,
          min: 0.35,
          precision: 2,
          step: 0.02,
          value: Number(((settingsGlyph.width + settingsGlyph.height) / 2).toFixed(2)),
        };
      case "width":
        return {
          id,
          label: "Width",
          max: 1.8,
          min: 0.35,
          precision: 2,
          step: 0.02,
          value: settingsGlyph.width,
        };
      case "xAdvance":
        return {
          id,
          label: "Advance",
          max: 2,
          min: 0.12,
          precision: 2,
          step: 0.02,
          value: settingsGlyph.xAdvance,
        };
      case "height":
        return {
          id,
          label: "Height",
          max: 1.8,
          min: 0.35,
          precision: 2,
          step: 0.02,
          value: settingsGlyph.height,
        };
      case "baselineOffset":
        return {
          id,
          label: "Baseline",
          max: 1.2,
          min: 0,
          precision: 2,
          step: 0.02,
          value: settingsGlyph.baselineOffset,
        };
      case "leftBearing":
        return {
          id,
          label: "Left",
          max: 1.2,
          min: -1.2,
          precision: 2,
          step: 0.02,
          value: settingsGlyph.leftBearing,
        };
      case "rightBearing":
        return {
          id,
          label: "Right",
          max: 1.2,
          min: -1.2,
          precision: 2,
          step: 0.02,
          value: settingsGlyph.rightBearing,
        };
    }
  }

  function getLetterSettingsSliderIcon(id: LetterSettingsSliderId) {
    switch (id) {
      case "size":
        return <Scaling aria-hidden="true" />;
      case "width":
        return <MoveHorizontal aria-hidden="true" />;
      case "xAdvance":
        return <Ruler aria-hidden="true" />;
      case "height":
        return <MoveVertical aria-hidden="true" />;
      case "baselineOffset":
        return <Baseline aria-hidden="true" />;
      case "leftBearing":
        return <ArrowLeftToLine aria-hidden="true" />;
      case "rightBearing":
        return <ArrowRightToLine aria-hidden="true" />;
    }
  }

  function getFontSizeScaleBase() {
    const presetFontSize = exportPresets.find((item) => item.id === imageSettings.exportPreset)?.settings.fontSize;

    return typeof presetFontSize === "number" ? presetFontSize : defaultPhoneImageSettings.fontSize;
  }

  function getFontSettingsSliderConfig(id: FontSettingsSliderId): FontSettingsSliderConfig {
    switch (id) {
      case "size":
        const sizeBase = getFontSizeScaleBase();
        const sizeMin = shouldUseLongSkinnyFormat(imageSettings) ? 0.25 : 0.55;
        const sizeMax = shouldUseLongSkinnyFormat(imageSettings) ? 5 : 1.6;

        return {
          id,
          label: "Size",
          max: sizeMax,
          min: sizeMin,
          precision: 2,
          step: 0.05,
          value: getClampedMetricValue(imageSettings.fontSize / sizeBase, sizeMin, sizeMax, 2),
        };
      case "height":
        return {
          id,
          label: "Height",
          max: 1.6,
          min: 0.55,
          precision: 2,
          step: 0.05,
          value: previewFont.shapeSettings?.heightScale ?? 1,
        };
      case "width":
        return {
          id,
          label: "Width",
          max: 1.6,
          min: 0.55,
          precision: 2,
          step: 0.05,
          value: previewFont.shapeSettings?.widthScale ?? 1,
        };
      case "letterSpacing":
        return {
          id,
          label: "Letter gap",
          max: 0.6,
          min: -0.8,
          precision: 2,
          step: 0.01,
          value: previewFont.shapeSettings?.letterSpacing ?? 0,
        };
      case "rowSpacing":
        return {
          id,
          label: "Row spacing",
          max: 2,
          min: 0.45,
          precision: 2,
          step: 0.03,
          value: imageSettings.lineSpacing,
        };
      case "spacebar":
        return {
          id,
          label: "Spacebar",
          max: 1.2,
          min: 0.18,
          precision: 2,
          step: 0.02,
          value: previewSpacebarGlyph.xAdvance,
        };
    }
  }

  function updateSelectedPreviewTextSize(value: number, min: number, max: number, precision: number) {
    const targetId = getSelectedPreviewTextTargetId();

    if (!targetId) {
      setShareStatus("Select text first.");
      return false;
    }

    const sizeScale = getClampedMetricValue(value, min, max, precision);

    if (targetId === "preview-header" || targetId === "preview-body") {
      setPreviewTextTargetPlacements((current) => ({
        ...current,
        [targetId]: {
          ...current[targetId],
          sizeScale,
        },
      }));
      unhidePreviewTextTarget(targetId);
      setActiveDocumentId(null);
      setShareStatus("Selected text size updated.");
      return true;
    }

    if (previewTextLayers.some((layer) => layer.id === targetId)) {
      updatePreviewTextLayer(targetId, { sizeScale });
      setShareStatus("Selected text size updated.");
      return true;
    }

    setShareStatus("Select text first.");
    return false;
  }

  function setFontSettingsSliderValue(id: FontSettingsSliderId, value: number) {
    const config = getFontSettingsSliderConfig(id);

    if (id === "size" && selectedTextMetricGroup === "size" && getSelectedPreviewTextTargetId()) {
      updateSelectedPreviewTextSize(value, 0.45, 2.5, 2);
      return;
    }

    if (id === "size") {
      const sizeBase = getFontSizeScaleBase();

      setImageSettings((current) => ({
        ...current,
        fontSize: Math.round(sizeBase * getClampedMetricValue(value, config.min, config.max, config.precision)),
      }));
      setShareStatus("Text size updated.");
      return;
    }

    if (id === "height") {
      setFontShapeMetricValue("heightScale", value, config.min, config.max, config.precision);
      return;
    }

    if (id === "width") {
      setFontShapeMetricValue("widthScale", value, config.min, config.max, config.precision);
      return;
    }

    if (id === "letterSpacing") {
      setFontShapeMetricValue("letterSpacing", value, config.min, config.max, config.precision);
      return;
    }

    if (id === "rowSpacing") {
      setImageSettings((current) => ({
        ...current,
        lineSpacing: getClampedMetricValue(value, config.min, config.max, config.precision),
      }));
      setShareStatus("Row spacing updated.");
      return;
    }

    if (id === "spacebar") {
      setSpacebarAdvanceValue(value);
    }
  }

  function getFontSettingsSliderIcon(id: FontSettingsSliderId) {
    switch (id) {
      case "size":
        return <Scaling aria-hidden="true" />;
      case "height":
        return <MoveVertical aria-hidden="true" />;
      case "width":
        return <MoveHorizontal aria-hidden="true" />;
      case "letterSpacing":
        return <AlignHorizontalSpaceAround aria-hidden="true" />;
      case "rowSpacing":
        return <AlignVerticalSpaceAround aria-hidden="true" />;
      case "spacebar":
        return <Space aria-hidden="true" />;
    }
  }

  function getImageSettingsSliderIcon(id: ImageSettingsSliderId) {
    switch (id) {
      case "size":
        return <Scaling aria-hidden="true" />;
      case "canvasWidth":
        return <MoveHorizontal aria-hidden="true" />;
      case "canvasHeight":
        return <MoveVertical aria-hidden="true" />;
      case "pagePadding":
        return <SlidersHorizontal aria-hidden="true" />;
    }
  }

  function getFontSettingsDefaultValue(id: FontSettingsSliderId) {
    switch (id) {
      case "size":
      case "height":
      case "width":
        return 1;
      case "letterSpacing":
        return 0;
      case "rowSpacing":
        return defaultPhoneImageSettings.lineSpacing;
      case "spacebar":
        return defaultSpacebarMetrics.xAdvance;
    }
  }

  function getImageSettingsDefaultValue(id: ImageSettingsSliderId) {
    const defaults = getImageSettingsPresetDefaults();

    switch (id) {
      case "size":
        return 1;
      case "canvasWidth":
        return defaults.canvasWidth;
      case "canvasHeight":
        return defaults.canvasHeight;
      case "pagePadding":
        return defaults.pagePadding;
    }
  }

  function getLetterSettingsDefaultValue(id: LetterSettingsSliderId) {
    switch (id) {
      case "size":
      case "height":
      case "width":
        return 1;
      case "baselineOffset":
        return defaultGlyphMetrics.baselineOffset;
      case "leftBearing":
        return defaultGlyphMetrics.leftBearing;
      case "rightBearing":
        return defaultGlyphMetrics.rightBearing;
      case "xAdvance":
        return defaultGlyphMetrics.xAdvance;
    }
  }

  function renderLetterSliderTrigger(config: LetterSettingsSliderConfig) {
    const selected = activeLetterSettingsSliderId === config.id;

    return (
      <div key={config.id} className={`font-slider-slot ${selected ? "is-open" : ""}`}>
        <button
          className={`draw-icon-button draw-glass-button font-slider-icon-button ${selected ? "active-tool" : ""}`}
          type="button"
          onClick={() => setActiveLetterSettingsSliderId((current) => (current === config.id ? null : config.id))}
          aria-expanded={selected}
          aria-label={`${config.label} for ${settingsGlyphLabel}: ${formatMetricValue(config.value, config.precision)}`}
          title={`${config.label}: ${formatMetricValue(config.value, config.precision)}`}
        >
          {getLetterSettingsSliderIcon(config.id)}
          <span className="font-slider-button-value">
            {formatMetricValue(config.value, config.precision)}
          </span>
        </button>
      </div>
    );
  }

  function renderLetterSettingsSliderDrawer(config: LetterSettingsSliderConfig) {
    const sliderFill = Math.max(0, Math.min(100, ((config.value - config.min) / (config.max - config.min)) * 100));

    return (
      <div
        className="font-slider-drawer letter-slider-drawer"
        style={{ "--slider-fill": `${sliderFill}%` } as CSSProperties}
        aria-label={`${config.label} slider for ${settingsGlyphLabel}`}
      >
        <div className="font-slider-body font-settings-slider-body">
          <button
            className="draw-icon-button draw-glass-button font-slider-default-button"
            type="button"
            onClick={() => setSelectedLetterMetricValue(config.id, getLetterSettingsDefaultValue(config.id), config.min, config.max, config.precision)}
            aria-label={`Default ${config.label} for ${settingsGlyphLabel}`}
            title="Default"
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <input
            className="font-horizontal-slider"
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={config.value}
            onChange={(event) =>
              setSelectedLetterMetricValue(config.id, Number(event.target.value), config.min, config.max, config.precision)
            }
            aria-label={`${config.label} value for ${settingsGlyphLabel}`}
          />
          <button
            className="draw-icon-button draw-glass-button font-slider-step-button"
            type="button"
            onClick={() =>
              setSelectedLetterMetricValue(config.id, config.value - config.step, config.min, config.max, config.precision)
            }
            aria-label={`Decrease ${config.label} for ${settingsGlyphLabel}`}
            title={`Decrease ${config.label}`}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            className="draw-icon-button draw-glass-button font-slider-step-button"
            type="button"
            onClick={() =>
              setSelectedLetterMetricValue(config.id, config.value + config.step, config.min, config.max, config.precision)
            }
            aria-label={`Increase ${config.label} for ${settingsGlyphLabel}`}
            title={`Increase ${config.label}`}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  function renderImageSliderTrigger(config: ImageSettingsSliderConfig) {
    const selected = activeImageSettingsSliderId === config.id;

    return (
      <div key={config.id} className={`font-slider-slot ${selected ? "is-open" : ""}`}>
        <button
          className={`draw-icon-button draw-glass-button font-slider-icon-button ${selected ? "active-tool" : ""}`}
          type="button"
          onClick={() => {
            setCanvasFormatDrawerOpen(false);
            setImageStyleDrawerOpen(false);
            setActiveImageSettingsSliderId((current) => (current === config.id ? null : config.id));
          }}
          aria-expanded={selected}
          aria-label={`${config.label}: ${formatMetricValue(config.value, config.precision)}`}
          title={`${config.label}: ${formatMetricValue(config.value, config.precision)}`}
        >
          {getImageSettingsSliderIcon(config.id)}
          <span className="font-slider-button-value">
            {formatMetricValue(config.value, config.precision)}
          </span>
        </button>
      </div>
    );
  }

  function renderImageSettingsSliderDrawer(config: ImageSettingsSliderConfig) {
    const sliderFill = Math.max(0, Math.min(100, ((config.value - config.min) / (config.max - config.min)) * 100));

    return (
      <div
        className={`font-slider-drawer image-slider-drawer ${
          config.id === "pagePadding" ? "padding-slider-drawer" : ""
        }`}
        style={{ "--slider-fill": `${sliderFill}%` } as CSSProperties}
        aria-label={`${config.label} slider`}
      >
        <div className="font-slider-body font-settings-slider-body">
          <button
            className="draw-icon-button draw-glass-button font-slider-default-button"
            type="button"
            onClick={() => setImageSettingsSliderValue(config.id, getImageSettingsDefaultValue(config.id))}
            aria-label={`Default ${config.label}`}
            title="Default"
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <input
            className="font-horizontal-slider"
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={config.value}
            onChange={(event) => setImageSettingsSliderValue(config.id, Number(event.target.value))}
            aria-label={`${config.label} value`}
          />
          <button
            className="draw-icon-button draw-glass-button font-slider-step-button"
            type="button"
            onClick={() => setImageSettingsSliderValue(config.id, config.value - config.step)}
            aria-label={`Decrease ${config.label}`}
            title={`Decrease ${config.label}`}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            className="draw-icon-button draw-glass-button font-slider-step-button"
            type="button"
            onClick={() => setImageSettingsSliderValue(config.id, config.value + config.step)}
            aria-label={`Increase ${config.label}`}
            title={`Increase ${config.label}`}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  function renderFontSliderTrigger(config: FontSettingsSliderConfig) {
    const selected = activeFontSettingsSliderId === config.id;

    return (
      <div key={config.id} className={`font-slider-slot ${selected ? "is-open" : ""}`}>
        <button
          className={`draw-icon-button draw-glass-button font-slider-icon-button ${selected ? "active-tool" : ""}`}
          type="button"
          onClick={() => {
            setFontEffectsMenuOpen(false);
            setActiveFontSettingsSliderId((current) => (current === config.id ? null : config.id));
          }}
          aria-expanded={selected}
          aria-label={`${config.label}: ${formatMetricValue(config.value, config.precision)}`}
          title={`${config.label}: ${formatMetricValue(config.value, config.precision)}`}
        >
          {getFontSettingsSliderIcon(config.id)}
          <span className="font-slider-button-value">
            {formatMetricValue(config.value, config.precision)}
          </span>
        </button>
      </div>
    );
  }

  function renderFontSettingsSliderDrawer(config: FontSettingsSliderConfig) {
    const sliderFill = Math.max(0, Math.min(100, ((config.value - config.min) / (config.max - config.min)) * 100));

    return (
      <div
        className="font-slider-drawer"
        style={{ "--slider-fill": `${sliderFill}%` } as CSSProperties}
        aria-label={`${config.label} slider`}
      >
        <div className="font-slider-body font-settings-slider-body">
          <button
            className="draw-icon-button draw-glass-button font-slider-default-button"
            type="button"
            onClick={() => setFontSettingsSliderValue(config.id, getFontSettingsDefaultValue(config.id))}
            aria-label={`Default ${config.label}`}
            title="Default"
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <input
            className="font-horizontal-slider"
            type="range"
            min={config.min}
            max={config.max}
            step={config.step}
            value={config.value}
            onChange={(event) => setFontSettingsSliderValue(config.id, Number(event.target.value))}
            aria-label={`${config.label} value`}
          />
          <button
            className="draw-icon-button draw-glass-button font-slider-step-button"
            type="button"
            onClick={() => setFontSettingsSliderValue(config.id, config.value - config.step)}
            aria-label={`Decrease ${config.label}`}
            title={`Decrease ${config.label}`}
          >
            <Minus aria-hidden="true" />
          </button>
          <button
            className="draw-icon-button draw-glass-button font-slider-step-button"
            type="button"
            onClick={() => setFontSettingsSliderValue(config.id, config.value + config.step)}
            aria-label={`Increase ${config.label}`}
            title={`Increase ${config.label}`}
          >
            <Plus aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  function closeFullscreenActionControls() {
    setActiveFontSettingsSliderId(null);
    setActiveImageSettingsSliderId(null);
    setActiveLetterSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setFontEffectsMenuOpen(false);
    setImageStyleDrawerOpen(false);
    setActiveStyleDrawer(null);
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setDraftPreviewTextLayer(null);
    setExpandedPreviewTextFontPickerId(null);
    setFullscreenSelectMenuOpen(false);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedLetterMetricsOpen(false);
    setSelectedLetterMetricGroup(null);
    setSelectedTextDeletePrimed(false);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
  }

  function openFullscreenSelectPopover() {
    const currentlyOpen = activeSettingsPanel === "font" && fullscreenActionPanelOpen && fullscreenSelectMenuOpen;

    if (currentlyOpen) {
      closeFullscreenActionControls();
      setFullscreenActionPanelOpen(false);
      setShareStatus("Select closed.");
      return;
    }

    setFullscreenActionPanelOpen(true);
    setActiveSettingsPanel("font");
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setDraftPreviewTextLayer(null);
    setExpandedPreviewTextFontPickerId(null);
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
    setActiveImageSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setImageStyleDrawerOpen(false);
    setActiveLetterSettingsSliderId(null);
    setActiveStyleDrawer(null);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedTextDeletePrimed(false);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setSelectedPreviewTextLayerId(null);
    setFullscreenSelectMenuOpen(true);
  }

  function openFullscreenMovePopover() {
    const currentlyOpen = fullscreenActionPanelOpen && fullscreenMoveMenuOpen;

    if (currentlyOpen) {
      closeFullscreenActionControls();
      setFullscreenActionPanelOpen(false);
      setShareStatus("Grab closed.");
      return;
    }

    setFullscreenActionPanelOpen(true);
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(true);
    setFullscreenSelectMenuOpen(false);
    setDraftPreviewTextLayer(null);
    setExpandedPreviewTextFontPickerId(null);
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
    setActiveImageSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setImageStyleDrawerOpen(false);
    setActiveLetterSettingsSliderId(null);
    setActiveStyleDrawer(null);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedTextDeletePrimed(false);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
  }

  function chooseFullscreenSelectTarget(target: StyleSelectTarget) {
    setFullscreenActionPanelOpen(true);
    setActiveSettingsPanel("font");
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setDraftPreviewTextLayer(null);
    setFullscreenSelectMenuOpen(false);
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
    setActiveImageSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setImageStyleDrawerOpen(false);
    setActiveLetterSettingsSliderId(null);
    setActiveStyleDrawer(null);
    setStyleDrawMode(false);
    setStyleSelectTarget(target);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(true);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedLetterMetricsOpen(false);
    setSelectedLetterMetricGroup(null);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);

    if (target === "stickers") {
      setSelectedPreviewStickerId((current) =>
        current && previewStickers.some((sticker) => sticker.id === current && isEyePreviewSticker(sticker))
          ? current
          : null,
      );
    } else if (target === "ornaments") {
      setSelectedPreviewStickerId((current) =>
        current && previewStickers.some((sticker) => sticker.id === current && !isEyePreviewSticker(sticker))
          ? current
          : null,
      );
    } else {
      setSelectedPreviewStickerId(null);
    }

    setSelectedPreviewTextLayerId(null);

    if (target !== "doodles") {
      setSelectedPreviewDoodleId(null);
    }

    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setShareStatus(`Tap a ${getStyleSelectTargetLabel(target).toLowerCase()} to select it.`);
  }

  function chooseFullscreenMoveTarget(target: StyleMoveTarget) {
    setFullscreenActionPanelOpen(true);
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setFullscreenSelectMenuOpen(false);
    setDraftPreviewTextLayer(null);
    setExpandedPreviewTextFontPickerId(null);
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
    setActiveImageSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setImageStyleDrawerOpen(false);
    setActiveLetterSettingsSliderId(null);
    setActiveStyleDrawer(null);
    setStyleDrawMode(false);
    setStyleSelectTarget(target);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(true);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedTextDeletePrimed(false);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);

    if (target === "stickers") {
      setSelectedPreviewStickerId((current) =>
        current && previewStickers.some((sticker) => sticker.id === current && isEyePreviewSticker(sticker))
          ? current
          : null,
      );
    } else if (target === "ornaments") {
      setSelectedPreviewStickerId((current) =>
        current && previewStickers.some((sticker) => sticker.id === current && !isEyePreviewSticker(sticker))
          ? current
          : null,
      );
    } else {
      setSelectedPreviewStickerId(null);
    }

    if (target !== "text") {
      setSelectedPreviewTextLayerId(null);
    }

    if (target !== "doodles") {
      setSelectedPreviewDoodleId(null);
    }

    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setShareStatus(`Drag a ${getStyleSelectTargetLabel(target).toLowerCase()} on the page.`);
  }

  function setFullscreenSettings(panel: SettingsPanel) {
    setFullscreenMoveMenuOpen(false);
    setStyleMoveModeActive(false);
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;

    if (panel === activeSettingsPanel) {
      const nextOpen = !fullscreenActionPanelOpen;

      if (!nextOpen) {
        closeFullscreenActionControls();
      }

      setFullscreenActionPanelOpen(nextOpen);
      return;
    }

    setFullscreenActionPanelOpen(true);
    setActiveSettingsPanel(panel);

    if (panel === "preset") {
      setPalettePageControlsOpen(palettePageActive);
    } else {
      setPalettePageControlsOpen(false);
    }

    if (panel !== "font") {
      setFullscreenSelectMenuOpen(false);
      setActiveFontSettingsSliderId(null);
      setFontEffectsMenuOpen(false);
      setSelectedPreviewTextLayerId(null);
      setSelectedTextMetricsOpen(false);
      setSelectedTextMetricGroup(null);
      setSelectedTextDeletePrimed(false);
      setSelectedStickerMetricsOpen(false);
      setActiveStickerMetricId(null);

      if (activeStyleDrawer === "text") {
        setActiveStyleDrawer(null);
      }
    }

    if (panel !== "decor") {
      setFullscreenAddMenuOpen(false);
      setDraftPreviewTextLayer(null);
      setExpandedPreviewTextFontPickerId(null);
    }

    if (panel !== "image") {
      setActiveImageSettingsSliderId(null);
      setCanvasFormatDrawerOpen(false);
      setImageStyleDrawerOpen(false);
    } else {
      setCanvasFormatDrawerOpen(false);
    }

    if (panel !== "letter") {
      setActiveLetterSettingsSliderId(null);
    }

    if (panel === "decor" && styleSelectModeActive) {
      setStyleSelectModeActive(false);
    }

    if (panel !== "decor") {
      if (activeStyleDrawer !== "text") {
        setActiveStyleDrawer(null);
      }
      setStyleDrawMode(false);
      setStyleSelectMenuOpen(false);
      setStyleSelectModeActive(
        panel === "font" &&
          (styleSelectTarget === "text" || styleSelectTarget === "stickers" || styleSelectTarget === "ornaments") &&
          styleSelectModeActive,
      );
      setStyleStickerLookMode(false);
      setStyleStickerMoveMode(false);
      setStyleStickerFacePanelOpen(false);
      setStyleStickerRednessPanelOpen(false);
      setStyleStickerSleepPanelOpen(false);
      styleActiveDoodleRef.current = null;
      styleActiveStrokeRef.current = null;
      styleMovingStickerRef.current = null;
      styleMovingTextRef.current = null;
      styleMovingDoodleRef.current = null;
    }

  }

  function togglePreviewTextEffect(effectId: PreviewTextEffectId) {
    const optionLabel = previewTextEffectOptions.find((option) => option.id === effectId)?.label ?? "Effect";
    const nextEnabled = !imageSettings.textEffects[effectId];

    setImageSettings((current) => {
      return {
        ...current,
        textEffects: {
          ...current.textEffects,
          [effectId]: !current.textEffects[effectId],
        },
      };
    });
    setShareStatus(`${optionLabel} ${nextEnabled ? "enabled" : "disabled"}.`);
  }

  function closeFullscreenPreview() {
    setActiveFontSettingsSliderId(null);
    setActiveImageSettingsSliderId(null);
    setActiveLetterSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setFontEffectsMenuOpen(false);
    setFullscreenAddMenuOpen(false);
    setFullscreenActionPanelOpen(true);
    setFullscreenMoveMenuOpen(false);
    setFullscreenSelectMenuOpen(false);
    setImageStyleDrawerOpen(false);
    setImageViewerMode("page");
    setPalettePageControlsOpen(false);
    setSaveTitlePromptOpen(false);
    closeStyleEditor();
    if (composeFullscreenOnly) {
      setActiveSettingsPanel("image");
      setImageViewerOpen(true);
      return;
    }

    setImageViewerOpen(false);
  }

  function openPresetBuilderCanvas() {
    setActiveSettingsPanel("preset");
    setFullscreenActionPanelOpen(true);
    setImageViewerMode("preset");
    setActiveFontSettingsSliderId(null);
    setActiveImageSettingsSliderId(null);
    setActiveLetterSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setFontEffectsMenuOpen(false);
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setFullscreenSelectMenuOpen(false);
    setImageStyleDrawerOpen(false);
    setPalettePageActive(false);
    setPalettePageControlsOpen(false);
    setSaveTitlePromptOpen(false);
    closeStyleEditor();
    setImageViewerOpen(true);
    setShareStatus("Preset builder ready.");
  }

  function renderFontEffectsMenu() {
    return (
      <div className="font-effects-menu" aria-label="Preview text effects">
        {previewTextEffectOptions.map((option) => (
          <button
            key={option.id}
            className={`secondary-button compact-button ${imageSettings.textEffects[option.id] ? "active-tool" : ""}`}
            type="button"
            aria-pressed={imageSettings.textEffects[option.id]}
            onClick={() => togglePreviewTextEffect(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

  function renderImageLayoutControls(
    className = "phone-image-tools preview-layout-tools image-settings-tools",
    sliderIds: ImageSettingsSliderId[] = imageSettingsSliderOrder,
  ) {
    const sliderConfigs = sliderIds.map((id) => getImageSettingsSliderConfig(id));
    const activeSliderConfig = activeImageSettingsSliderId
      ? sliderConfigs.find((config) => config.id === activeImageSettingsSliderId) ?? null
      : null;

    return (
      <div className={className} aria-label="Image settings">
        <div className={`font-slider-shell image-slider-shell ${activeSliderConfig ? "has-open-slider" : ""}`}>
          {activeSliderConfig ? renderImageSettingsSliderDrawer(activeSliderConfig) : null}
          <div className="font-slider-button-row image-slider-button-row" aria-label="Image settings sliders">
            {sliderConfigs.map((config) => renderImageSliderTrigger(config))}
          </div>
        </div>
      </div>
    );
  }

  function renderPositionSettingsControls(className = "alignment-row image-option-row") {
    const alignmentOptions: Array<{ id: TextAlignment; label: string }> = [
      { id: "left", label: "Left" },
      { id: "center", label: "Middle" },
      { id: "right", label: "Right" },
    ];

    return (
      <div className={className} aria-label="Position settings">
        {alignmentOptions.map((option) => (
          <button
            key={option.id}
            className={`secondary-button compact-button check-control ${imageSettings.alignment === option.id ? "active-tool" : ""}`}
            type="button"
            aria-pressed={imageSettings.alignment === option.id}
            onClick={() => setImageSettings((current) => ({ ...current, alignment: option.id }))}
          >
            {option.label}
          </button>
        ))}
        <button
          className={`secondary-button compact-button check-control ${imageSettings.autoFit ? "active-tool" : ""}`}
          type="button"
          aria-pressed={imageSettings.autoFit}
          onClick={() => setImageSettings((current) => ({ ...current, autoFit: !current.autoFit }))}
        >
          Fit
        </button>
      </div>
    );
  }

  function renderLetterSettingsControls(className = "phone-image-tools preview-layout-tools letter-settings-tools") {
    const sliderConfigs = letterSettingsSliderOrder.map((id) => getLetterSettingsSliderConfig(id));
    const activeSliderConfig = activeLetterSettingsSliderId
      ? getLetterSettingsSliderConfig(activeLetterSettingsSliderId)
      : null;

    return (
      <div className={className} aria-label={settingsGlyphPanelLabel}>
        <div className={`font-slider-shell letter-slider-shell ${activeSliderConfig ? "has-open-slider" : ""}`}>
          {activeSliderConfig ? renderLetterSettingsSliderDrawer(activeSliderConfig) : null}
          <div className="font-slider-button-row letter-slider-button-row" aria-label={`${settingsGlyphPanelLabel} sliders`}>
            {sliderConfigs.map((config) => renderLetterSliderTrigger(config))}
          </div>
        </div>
      </div>
    );
  }

  function renderFontSettingsControls(className = "phone-image-tools preview-layout-tools font-settings-tools") {
    const sliderConfigs = fontSettingsSliderOrder.map((id) => getFontSettingsSliderConfig(id));
    const activeSliderConfig = activeFontSettingsSliderId
      ? getFontSettingsSliderConfig(activeFontSettingsSliderId)
      : null;
    const activeEffectCount = previewTextEffectOptions.filter((option) => imageSettings.textEffects[option.id]).length;

    return (
      <div className={className}>
        <div className={`font-slider-shell font-settings-slider-shell ${activeSliderConfig ? "has-open-slider" : ""}`}>
          {activeSliderConfig ? renderFontSettingsSliderDrawer(activeSliderConfig) : null}
          {fontEffectsMenuOpen ? renderFontEffectsMenu() : null}
          <div className="font-slider-button-row" aria-label="Font settings controls">
            {sliderConfigs.map((config) => renderFontSliderTrigger(config))}
            <div className={`font-slider-slot font-effects-slot ${fontEffectsMenuOpen ? "is-open" : ""}`}>
              <button
                className={`draw-icon-button draw-glass-button font-slider-icon-button font-effects-trigger-button ${
                  fontEffectsMenuOpen || activeEffectCount > 0 ? "active-tool" : ""
                }`}
                type="button"
                aria-expanded={fontEffectsMenuOpen}
                aria-label={`Text effects${activeEffectCount > 0 ? `: ${activeEffectCount} active` : ""}`}
                title="Text effects"
                onClick={() => {
                  setActiveFontSettingsSliderId(null);
                  setFontEffectsMenuOpen((open) => !open);
                }}
              >
                <Sparkles aria-hidden="true" />
                <span className="font-slider-button-value">{activeEffectCount > 0 ? activeEffectCount : "FX"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderFormatPresetControls(className = "phone-image-format-preset-row") {
    return (
      <div className={className} aria-label="Format presets">
        {exportPresets.map((preset) => (
          <button
            key={preset.id}
            className={`secondary-button compact-button ${
              imageSettings.exportPreset === preset.id ? "active-tool" : ""
            }`}
            type="button"
            onClick={() => applyExportPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    );
  }

  function renderCanvasCategoryControls() {
    const customFormatActive = imageSettings.exportPreset === "custom";
    const paddingConfig = getImageSettingsSliderConfig("pagePadding");
    const paddingSliderOpen = activeImageSettingsSliderId === "pagePadding";

    return (
      <div className="phone-image-panel-stack canvas-panel-controls" aria-label="Canvas controls">
        {canvasFormatDrawerOpen ? renderFormatPresetControls("phone-image-format-preset-row phone-image-canvas-format-drawer") : null}
        {paddingSliderOpen ? renderImageSettingsSliderDrawer(paddingConfig) : null}
        <div className="phone-image-action-row canvas-action-row">
          <button
            className={`secondary-button compact-button phone-image-tool-button phone-image-format-trigger ${
              canvasFormatDrawerOpen ? "active-tool" : ""
            }`}
            type="button"
            aria-expanded={canvasFormatDrawerOpen}
            aria-label="Format presets"
            title="Format"
            onClick={() => {
              setActiveImageSettingsSliderId(null);
              setImageStyleDrawerOpen(false);
              setCanvasFormatDrawerOpen((open) => !open);
            }}
          >
            <span>Format</span>
          </button>
          <button
            className={`secondary-button compact-button phone-image-style-button ${imageStyleDrawerOpen ? "active-tool" : ""}`}
            type="button"
            aria-expanded={imageStyleDrawerOpen}
            aria-label="Open canvas style controls"
            title="Style"
            onClick={() => {
              setActiveImageSettingsSliderId(null);
              setCanvasFormatDrawerOpen(false);
              setFontEffectsMenuOpen(false);
              setImageStyleDrawerOpen((open) => !open);
            }}
          >
            <span>Style</span>
          </button>
          <button
            className={`secondary-button compact-button phone-image-style-button phone-image-padding-button ${
              paddingSliderOpen ? "active-tool" : ""
            }`}
            type="button"
            aria-expanded={paddingSliderOpen}
            aria-label={`Padding: ${formatMetricValue(paddingConfig.value, paddingConfig.precision)}`}
            title={`Padding: ${formatMetricValue(paddingConfig.value, paddingConfig.precision)}`}
            onClick={() => {
              setCanvasFormatDrawerOpen(false);
              setFontEffectsMenuOpen(false);
              setImageStyleDrawerOpen(false);
              setActiveImageSettingsSliderId((current) => (current === "pagePadding" ? null : "pagePadding"));
            }}
          >
            <span>Padding</span>
          </button>
          {customFormatActive
            ? renderImageLayoutControls(
                "phone-image-fullscreen-tools preview-layout-tools image-settings-tools",
                ["size", "canvasWidth", "canvasHeight"],
              )
            : null}
        </div>
        {imageStyleDrawerOpen &&
          renderPageStyleControls("draw-control-drawer style-control-drawer phone-image-inline-style-drawer")}
      </div>
    );
  }

  function renderFullscreenSelectPopover() {
    return (
      <div className="phone-image-select-popover" aria-label="Select options">
        {fullscreenSelectOptions.map((option) => {
          const selected = styleSelectModeActive && styleSelectTarget === option.id;

          return (
            <button
              key={option.id}
              className={`secondary-button compact-button phone-image-select-option ${selected ? "active-tool" : ""}`}
              type="button"
              aria-pressed={selected}
              onClick={() => chooseFullscreenSelectTarget(option.id)}
            >
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderFullscreenMovePopover() {
    return (
      <div className="phone-image-select-popover phone-image-grab-popover" aria-label="Grab options">
        {fullscreenMoveOptions.map((option) => {
          const selected = styleMoveModeActive && styleSelectTarget === option.id;

          return (
            <button
              key={option.id}
              className={`secondary-button compact-button phone-image-select-option ${selected ? "active-tool" : ""}`}
              type="button"
              aria-pressed={selected}
              onClick={() => chooseFullscreenMoveTarget(option.id)}
            >
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  function renderMoveCategoryControls() {
    return (
      <div className="phone-image-panel-stack grab-panel-controls" aria-label="Grab controls">
        {fullscreenMoveMenuOpen ? renderFullscreenMovePopover() : null}
      </div>
    );
  }

  function renderFontCategoryControls() {
    const textLayerDrawerOpen = activeStyleDrawer === "text";
    const selectTargetControlsVisible =
      styleSelectModeActive &&
      (
        isTextSelectionTarget() ||
        styleSelectTarget === "stickers" ||
        styleSelectTarget === "ornaments" ||
        styleSelectTarget === "doodles"
      ) &&
      !styleSelectMenuOpen &&
      !fullscreenSelectMenuOpen;
    const fontMetricControlsVisible = !selectTargetControlsVisible && !fullscreenSelectMenuOpen;

    return (
      <div className="phone-image-panel-stack font-panel-controls" aria-label={styleSelectTarget === "letter" ? "Letter controls" : "Text controls"}>
        {fullscreenSelectMenuOpen ? renderFullscreenSelectPopover() : null}
        {fontMetricControlsVisible ? (
          <div className="phone-image-action-row">
            {renderFontSettingsControls("phone-image-fullscreen-tools preview-layout-tools font-settings-tools")}
            <button
              className="draw-icon-button draw-gold-button font-slider-apply-button"
              type="button"
              disabled={!hasPendingFontSpacingChanges}
              onClick={applyFontSpacingToFont}
              aria-label="Apply to Font"
              title="Apply to Font"
            >
              Apply
            </button>
          </div>
        ) : null}
        {fontMetricControlsVisible ? renderPositionSettingsControls("alignment-row text-position-row phone-image-fullscreen-options") : null}
        {textLayerDrawerOpen && renderStyleDrawer()}
        {renderStyleSelectionActions()}
      </div>
    );
  }

  function renderPalettePageForm() {
    return (
      <div className="palette-preset-form" aria-label="Palette source fields">
        <label className="palette-preset-field palette-preset-title-field">
          <span>Title</span>
          <input
            type="text"
            value={palettePageDraft.title}
            onChange={(event) =>
              setPalettePageDraft((current) => ({
                ...current,
                title: event.target.value,
              }))
            }
          />
        </label>
        <div className="palette-preset-color-grid">
          {palettePageFields.map((field) => {
            const value = palettePageDraft[field.id];

            return (
              <label className="palette-preset-field" key={field.id}>
                <span>{field.label}</span>
                <div className="palette-preset-color-row">
                  <span
                    className="palette-preset-swatch"
                    style={/^#[\da-f]{6}$/i.test(value) ? { backgroundColor: value } : undefined}
                    aria-hidden="true"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(event) =>
                      setPalettePageDraft((current) => ({
                        ...current,
                        [field.id]: event.target.value,
                      }))
                    }
                  />
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPresetCategoryControls() {
    const fontSizeConfig = getFontSettingsSliderConfig("size");
    const activeFontOptionId = getActivePreviewFontOptionId();
    const visiblePresets = getVisiblePreviewDesignPresets(previewDesignPresets);

    if (imageViewerMode !== "preset") {
      return (
        <div className="phone-image-panel-stack preset-panel-controls preset-picker-controls" aria-label="Preset controls">
          <div
            className={`preset-picker-popover ${palettePageControlsOpen ? "has-palette-form" : ""}`}
            aria-label="Saved presets"
          >
            <button
              className="primary-button compact-button preset-picker-new-button"
              type="button"
              onClick={openPresetBuilderCanvas}
            >
              New Preset
            </button>
            {visiblePresets.length > 0 ? (
              visiblePresets.map((preset) => (
                <button
                  key={preset.id}
                  className="secondary-button compact-button preset-picker-option"
                  type="button"
                  onClick={() => applyDesignPreset(preset.id)}
                >
                  <strong>{preset.name}</strong>
                  {preset.id.startsWith("builtin:") ? null : <span>{preset.settings.exportPreset}</span>}
                </button>
              ))
            ) : (
              <p className="preset-picker-empty">No presets saved.</p>
            )}
            {palettePageControlsOpen ? renderPalettePageForm() : null}
          </div>
        </div>
      );
    }

    return (
      <div className="phone-image-panel-stack preset-panel-controls" aria-label="Preset controls">
        {canvasFormatDrawerOpen ? renderFormatPresetControls("phone-image-format-preset-row phone-image-canvas-format-drawer preset-format-drawer") : null}
        {imageStyleDrawerOpen ?
          renderPageStyleControls("draw-control-drawer style-control-drawer phone-image-inline-style-drawer preset-style-drawer")
          : null}
        <div className="phone-image-action-row preset-action-row">
          <button
            className={`secondary-button compact-button phone-image-tool-button ${canvasFormatDrawerOpen ? "active-tool" : ""}`}
            type="button"
            aria-expanded={canvasFormatDrawerOpen}
            onClick={() => {
              setImageStyleDrawerOpen(false);
              setActiveFontSettingsSliderId(null);
              setCanvasFormatDrawerOpen((open) => !open);
            }}
          >
            <span>Format</span>
          </button>
          <button
            className={`secondary-button compact-button phone-image-tool-button ${imageStyleDrawerOpen ? "active-tool" : ""}`}
            type="button"
            aria-expanded={imageStyleDrawerOpen}
            onClick={() => {
              setCanvasFormatDrawerOpen(false);
              setActiveFontSettingsSliderId(null);
              setImageStyleDrawerOpen((open) => !open);
            }}
          >
            <span>Style</span>
          </button>
          <div className="preset-font-control">
            {renderPreviewTextFontPicker({
              ariaLabel: "Preview font",
              pickerId: "primary-preview-font",
              value: activeFontOptionId,
              onChange: selectPrimaryPreviewFont,
            })}
          </div>
          <div className={`font-slider-shell preset-size-slider-shell ${activeFontSettingsSliderId === "size" ? "has-open-slider" : ""}`}>
            {activeFontSettingsSliderId === "size" ? renderFontSettingsSliderDrawer(fontSizeConfig) : null}
            <div className="font-slider-button-row" aria-label="Preset font size">
              {renderFontSliderTrigger(fontSizeConfig)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderLetterCategoryControls() {
    return (
      <div className="phone-image-panel-stack letter-panel-controls" aria-label="Letter controls">
        {renderLetterTuningRow()}
      </div>
    );
  }

  function renderLetterTuningRow(className = "phone-image-action-row") {
    return (
      <div className={className}>
        {renderLetterSettingsControls("phone-image-fullscreen-tools preview-layout-tools letter-settings-tools")}
        <button className="secondary-button compact-button phone-image-tool-button" type="button" onClick={openSelectedLetterEditor}>
          <PenLine aria-hidden="true" />
          <span>Design letter</span>
        </button>
        <button
          className="draw-icon-button draw-gold-button font-slider-apply-button"
          type="button"
          disabled={!hasPendingFontSpacingChanges}
          onClick={applyFontSpacingToFont}
          aria-label={`Apply ${settingsGlyphPanelLabel} changes to Font`}
          title="Apply to Font"
        >
          Apply
        </button>
      </div>
    );
  }

  function openDecorDrawer(drawer: Exclude<StyleDrawer, "text" | null>) {
    setFullscreenAddMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setDraftPreviewTextLayer(null);
    setExpandedPreviewTextFontPickerId(null);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);
    setSelectedTextDeletePrimed(false);
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setActiveStyleDrawer((current) => {
      const nextDrawer = current === drawer ? null : drawer;
      setStyleSelectModeActive(nextDrawer === "select");
      return nextDrawer;
    });
  }

  function openFullscreenAddPopover() {
    const currentlyOpen = activeSettingsPanel === "decor" && fullscreenActionPanelOpen && fullscreenAddMenuOpen;

    setFullscreenActionPanelOpen(true);
    setActiveSettingsPanel("decor");
    setFullscreenSelectMenuOpen(false);
    setFullscreenMoveMenuOpen(false);
    setActiveFontSettingsSliderId(null);
    setFontEffectsMenuOpen(false);
    setActiveImageSettingsSliderId(null);
    setCanvasFormatDrawerOpen(false);
    setImageStyleDrawerOpen(false);
    setActiveLetterSettingsSliderId(null);
    setActiveStyleDrawer(null);
    setDraftPreviewTextLayer(null);
    setExpandedPreviewTextFontPickerId(null);
    setStyleDrawMode(false);
    setStyleSelectMenuOpen(false);
    setStyleSelectModeActive(false);
    setStyleMoveModeActive(false);
    setStyleStickerLookMode(false);
    setStyleStickerMoveMode(false);
    setStyleStickerFacePanelOpen(false);
    setStyleStickerRednessPanelOpen(false);
    setStyleStickerSleepPanelOpen(false);
    setSelectedTextMetricsOpen(false);
    setSelectedTextMetricGroup(null);
    setSelectedTextDeletePrimed(false);
    setSelectedStickerMetricsOpen(false);
    setActiveStickerMetricId(null);
    styleActiveDoodleRef.current = null;
    styleActiveStrokeRef.current = null;
    styleMovingStickerRef.current = null;
    styleMovingTextRef.current = null;
    styleMovingDoodleRef.current = null;
    setFullscreenAddMenuOpen(!currentlyOpen);
  }

  function renderDecorCategoryControls() {
    return (
      <div className="phone-image-panel-stack decor-panel-controls add-panel-controls" aria-label="Add controls">
        {fullscreenAddMenuOpen ? (
          <div className="phone-image-add-popover" aria-label="Add options">
            <button
              className="secondary-button compact-button phone-image-add-option"
              type="button"
              onClick={openPreviewTextLayerDraft}
            >
              <span>Text</span>
            </button>
            <button
              className="secondary-button compact-button phone-image-add-option"
              type="button"
              onClick={insertColorSwatchIntoTextDraft}
            >
              <span>Swatch</span>
            </button>
            <button
              className={`secondary-button compact-button phone-image-add-option ${
                activeStyleDrawer === "stickers" ? "active-tool" : ""
              }`}
              type="button"
              aria-expanded={activeStyleDrawer === "stickers"}
              onClick={() => openDecorDrawer("stickers")}
            >
              <span>Stickers</span>
            </button>
            <button
              className={`secondary-button compact-button phone-image-add-option ${
                activeStyleDrawer === "ornaments" ? "active-tool" : ""
              }`}
              type="button"
              aria-expanded={activeStyleDrawer === "ornaments"}
              onClick={() => openDecorDrawer("ornaments")}
            >
              <span>Ornaments</span>
            </button>
            <button
              className={`secondary-button compact-button phone-image-add-option ${
                activeStyleDrawer === "doodle" || styleDrawMode ? "active-tool" : ""
              }`}
              type="button"
              aria-expanded={activeStyleDrawer === "doodle"}
              onClick={() => openDecorDrawer("doodle")}
            >
              <span>Doodle</span>
            </button>
          </div>
        ) : null}
        {activeStyleDrawer ? renderStyleDrawer() : null}
        {!isTextSelectionTarget() ? renderStyleSelectionActions() : null}
      </div>
    );
  }

  function renderFullscreenCategoryControls() {
    if (!fullscreenActionPanelOpen) {
      return null;
    }

    if (fullscreenMoveMenuOpen || styleMoveModeActive) {
      return renderMoveCategoryControls();
    }

    if (activeSettingsPanel === "font") {
      return renderFontCategoryControls();
    }

    if (activeSettingsPanel === "letter") {
      return renderLetterCategoryControls();
    }

    if (activeSettingsPanel === "preset") {
      return renderPresetCategoryControls();
    }

    if (activeSettingsPanel === "decor") {
      return renderDecorCategoryControls();
    }

    return renderCanvasCategoryControls();
  }

  function renderFullscreenCategoryTabs() {
    return (
      <div className="phone-image-category-row" aria-label="Preview edit categories">
        {fullscreenPanelOptions.map((option) => {
          if (option.id === "letter") {
            const grabTargetLabel = getStyleSelectTargetLabel(styleSelectTarget);
            const showGrabTarget = styleMoveModeActive && styleSelectTarget !== "letter";
            const grabSelected = fullscreenMoveMenuOpen || styleMoveModeActive;

            return (
              <button
                key={option.id}
                className={[
                  "secondary-button",
                  "compact-button",
                  "phone-image-select-category-button",
                  grabSelected ? "active-tool" : "",
                ].filter(Boolean).join(" ")}
                type="button"
                aria-expanded={fullscreenMoveMenuOpen}
                aria-pressed={grabSelected}
                aria-label={showGrabTarget ? `Grab ${grabTargetLabel}` : "Grab"}
                onClick={openFullscreenMovePopover}
              >
                <Hand aria-hidden="true" />
                <span className="phone-image-select-category-label">{showGrabTarget ? grabTargetLabel : "Grab"}</span>
              </button>
            );
          }

          const isSelectPanel = option.id === "font";
          const selected = option.id === "font"
            ? activeSettingsPanel === "font" && fullscreenActionPanelOpen && !fullscreenMoveMenuOpen && !styleMoveModeActive
            : activeSettingsPanel === option.id && fullscreenActionPanelOpen && !fullscreenMoveMenuOpen && !styleMoveModeActive;
          const selectTargetLabel = getStyleSelectTargetLabel(styleSelectTarget);
          const showSelectTarget = isSelectPanel && styleSelectModeActive;

          return (
            <button
              key={option.id}
              className={[
                "secondary-button",
                "compact-button",
                showSelectTarget ? "phone-image-select-category-button" : "",
                selected ? "active-tool" : "",
              ].filter(Boolean).join(" ")}
              type="button"
              aria-expanded={selected}
              aria-pressed={selected}
              aria-label={showSelectTarget ? `Select ${selectTargetLabel}` : option.label}
              onClick={() => {
                if (isSelectPanel) {
                  openFullscreenSelectPopover();
                  return;
                }

                if (option.id === "decor") {
                  openFullscreenAddPopover();
                  return;
                }

                setFullscreenSettings(option.id);
              }}
            >
              {showSelectTarget ? (
                <>
                  <MousePointer2 aria-hidden="true" />
                  <span className="phone-image-select-category-label">{selectTargetLabel}</span>
                </>
              ) : option.label}
            </button>
          );
        })}
      </div>
    );
  }

  function renderPreviewTextBox(className = "preview-input phone-text-input") {
    return (
      <textarea
        className={className}
        aria-label="Preview text"
        value={previewText}
        onChange={(event) => {
          unhidePreviewTextTarget("preview-body");
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
          unhidePreviewTextTarget("preview-header");
          onHeaderPreviewTextChange(event.target.value);
          setActiveDocumentId(null);
        }}
        spellCheck={false}
      />
    );
  }

  return (
    <>
      <section
        id="preview-panel"
        className={`studio-panel preview-panel phone-generator-panel ${
          !showExportControls && !showPreviewText ? "minimal-preview-panel" : ""
        }`}
        aria-label="Preview image"
      >
        {showExportControls && (
          <div className="panel-heading preview-dashboard-heading">
            <div>
              <p className="eyebrow">Export</p>
              <h2>Preview image</h2>
            </div>
            <div className="preview-summary-pill">
              {imageSettings.canvasWidth}x{imageSettings.canvasHeight}
            </div>
          </div>
        )}

        <button
          className={`phone-image-preview phone-image-open-button ${
            imageSettings.transparent ? "transparent-preview" : ""
          } ${shouldUseLongSkinnyFormat(imageSettings) ? "long-skinny-preview" : ""}`}
          type="button"
          aria-label="Open image settings"
          onClick={() => {
            setActiveSettingsPanel("image");
            setFullscreenActionPanelOpen(true);
            setImageViewerMode("page");
            setActiveFontSettingsSliderId(null);
            setActiveImageSettingsSliderId(null);
            setActiveLetterSettingsSliderId(null);
            setCanvasFormatDrawerOpen(false);
            setFontEffectsMenuOpen(false);
            setImageStyleDrawerOpen(false);
            setSaveTitlePromptOpen(false);
            setImageViewerOpen(true);
          }}
        >
          <canvas
            ref={imageCanvasRef}
            className="phone-image-canvas"
            aria-label="Generated preview image"
          />
        </button>

        {showExportControls && (
          <>
            <div className="export-preset-grid" aria-label="Export presets">
              {exportPresets.map((preset) => (
                <button
                  key={preset.id}
                  className={`secondary-button compact-button ${
                    imageSettings.exportPreset === preset.id ? "active-tool" : ""
                  }`}
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
              <button className="primary-button compact-button" type="button" onClick={openSaveTitlePrompt}>
                Save As
              </button>
              <button className="secondary-button compact-button" type="button" onClick={downloadPhoneImage}>
                Export PNG
              </button>
            </div>
            {saveTitlePromptOpen && !imageViewerOpen && (
              <form className="phone-image-actions phone-image-save-as-form inline-save-as-form" aria-label="Save As" onSubmit={submitSaveTitle}>
                <input
                  ref={saveTitleInputRef}
                  aria-label="Save as title"
                  placeholder={imageViewerMode === "preset" ? "Title this preset" : "Title this save"}
                  value={saveTitleDraft}
                  onChange={(event) => setSaveTitleDraft(event.target.value)}
                />
                <button className="primary-button compact-button phone-image-save-confirm" type="submit" aria-label="Confirm Save As" title="Confirm">
                  <Check aria-hidden="true" size={18} />
                </button>
              </form>
            )}
          </>
        )}

        {showPreviewText && (
          <>
            {renderPositionSettingsControls("alignment-row text-position-row")}
            <div className="header-letter-input-group">
              <span className="preview-field-label">Header</span>
              {renderHeaderPreviewTextBox("preview-input phone-text-input phone-image-text-input phone-header-text-input")}
            </div>
            <div className="preview-body-input-group">
              <span className="preview-field-label">Body</span>
            {renderPreviewTextBox("preview-input phone-text-input phone-image-text-input")}
            </div>
            <div className="share-status" aria-live="polite">
              {shareStatus}
            </div>
          </>
        )}

      {imageViewerOpen && (
        <section className="studio-panel phone-image-fullscreen" aria-label="Full screen preview image">
          <div className="panel-heading phone-image-fullscreen-heading">
            <button
              className="secondary-button compact-button phone-image-home-button"
              type="button"
              aria-label="Open menu"
              title="Menu"
              onClick={composeFullscreenOnly && onOpenAppMenu ? onOpenAppMenu : closeFullscreenPreview}
            >
              <Menu aria-hidden="true" />
            </button>
            <div
              className={`phone-image-active-settings ${
                activeSettingsPanel === "letter" && !fullscreenMoveMenuOpen && !styleMoveModeActive
                  ? "phone-letter-heading-settings"
                  : ""
              }`}
              aria-live="polite"
            >
              {fullscreenMoveMenuOpen || styleMoveModeActive ? (
                "Grab"
              ) : activeSettingsPanel === "letter" ? (
                <>
                  <span>{settingsGlyphPanelLabel}</span>
                  <strong className={settingsGlyphIsHeader ? "header-letter-chip" : ""}>
                    {settingsGlyphLabel}
                  </strong>
                </>
              ) : imageViewerMode === "preset" ? (
                "Preset Builder"
              ) : (
                settingsPanelLabels[activeSettingsPanel]
              )}
            </div>
            {saveTitlePromptOpen ? (
              <form className="phone-image-header-actions phone-image-save-as-form" aria-label="Save As" onSubmit={submitSaveTitle}>
                <input
                  ref={saveTitleInputRef}
                  aria-label="Save as title"
                  placeholder={imageViewerMode === "preset" ? "Title this preset" : "Title this save"}
                  value={saveTitleDraft}
                  onChange={(event) => setSaveTitleDraft(event.target.value)}
                />
                <button className="primary-button compact-button phone-image-save-confirm" type="submit" aria-label="Confirm Save As" title="Confirm">
                  <Check aria-hidden="true" size={18} />
                </button>
              </form>
            ) : imageViewerMode === "preset" ? (
              <div className="phone-image-header-actions" aria-label="Preset actions">
                <button
                  className="primary-button compact-button"
                  type="button"
                  onClick={openSaveTitlePrompt}
                >
                  Save As
                </button>
              </div>
            ) : (
              <div className="phone-image-header-actions" aria-label="Output actions">
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={sharePhoneImage}
                >
                  Share
                </button>
                <button
                  className="primary-button compact-button"
                  type="button"
                  onClick={openSaveTitlePrompt}
                >
                  Save As
                </button>
                <button
                  className="secondary-button compact-button"
                  type="button"
                  onClick={downloadPhoneImage}
                >
                  Export PNG
                </button>
              </div>
            )}
          </div>

          <div
            className={`phone-image-fullscreen-surface ${
              imageSettings.transparent ? "transparent-preview" : ""
            } ${imageSettings.exportPreset === "phone" ? "phone-format-preview" : ""} ${
              shouldUseLongSkinnyFormat(imageSettings) ? "long-skinny-preview" : ""
            }`}
          >
            <canvas
              ref={viewerCanvasRef}
              className={`phone-image-canvas phone-image-fullscreen-canvas ${styleDrawMode ? "drawing-enabled" : ""} ${
                styleStickerMoveMode ? "moving-sticker-enabled" : ""
              } ${styleMoveModeActive ? "moving-grab-enabled" : ""}`}
              aria-label="Full screen generated preview image"
              onClick={handleViewerCanvasClick}
              onPointerDown={handleViewerCanvasPointerDown}
              onPointerMove={handleViewerCanvasPointerMove}
              onPointerUp={handleViewerCanvasPointerEnd}
              onPointerCancel={handleViewerCanvasPointerEnd}
              onPointerLeave={handleViewerCanvasPointerEnd}
            />
          </div>

          <div className="phone-image-fullscreen-bottom-bar phone-image-edit-panel">
            {fullscreenActionPanelOpen ? (
              <div className="phone-image-action-panel">
                {renderFullscreenCategoryControls()}
              </div>
            ) : null}
            {renderFullscreenCategoryTabs()}
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
              {renderStyleStickerPreview(styleStickerDragPreview.asset)}
            </div>
          )}
        </section>
      )}
      </section>
    </>
  );
}
