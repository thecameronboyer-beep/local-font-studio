import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { spacebar } from "../data/characterSets";
import type {
  BackgroundStyle,
  BackgroundTexture,
  FontGuideSettings,
  FontSet,
  FontShapeSettings,
  Glyph,
  PreviewSettings,
} from "../types/fontTypes";
import {
  drawGlyph,
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
  onUpdateFontMetrics: (updates: {
    glyphMetrics?: Partial<Pick<Glyph, "baselineOffset" | "leftBearing" | "rightBearing" | "xAdvance">>;
    guideSettings?: FontGuideSettings;
    shapeSettings?: FontShapeSettings;
  }) => void;
  onRecordExport?: (message: string) => void;
  onSaveImage?: (image: SavedPreviewImage) => boolean;
  onUpdateSelectedGlyph: (glyph: Glyph) => void;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
  selectedGlyph: Glyph;
  spacebarGlyph: Glyph;
};

type ExportPresetId = "phone" | "social" | "transparent";
type FontMetricKey = "baselineOffset" | "leftBearing" | "rightBearing" | "width" | "xAdvance";
type FontGlyphMetricKey = Exclude<FontMetricKey, "width">;
type ImageMetricKey = "canvasHeight" | "canvasWidth" | "lineSpacing" | "pagePadding";
type SettingsPanel = "font" | "image" | "position";
type TextAlignment = "left" | "center" | "right";

const settingsPanelLabels: Record<SettingsPanel, string> = {
  font: "Font settings",
  image: "Image settings",
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
  transparent: boolean;
};

type PhoneImageLayout = {
  lines: string[];
  settings: PreviewImageSettings;
};

type PreviewDocument = {
  id: string;
  name: string;
  settings: PreviewImageSettings;
  text: string;
  updatedAt: string;
};

const PREVIEW_DOCUMENTS_KEY = "local-font-studio:preview-documents:v1";
const MIN_IMAGE_CANVAS_WIDTH = 640;
const MAX_IMAGE_CANVAS_WIDTH = 3300;
const MIN_IMAGE_CANVAS_HEIGHT = 480;
const MAX_IMAGE_CANVAS_HEIGHT = 3600;

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
  lineSpacing: 1.18,
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
  { label: "Ink", color: "#17110b" },
  { label: "Cream", color: "#f4ead7" },
  { label: "Gold", color: "#c8a45d" },
  { label: "Sage", color: "#1f6f5b" },
  { label: "Rose", color: "#9b343f" },
  { label: "Blue", color: "#1f4f78" },
];

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

function normalizePreviewSettings(settings?: Partial<PreviewImageSettings>): PreviewImageSettings {
  const normalized = {
    ...defaultPhoneImageSettings,
    ...settings,
  };

  return exportPresets.some((preset) => preset.id === normalized.exportPreset)
    ? normalized
    : {
        ...normalized,
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
        name: document.name || "Untitled preview",
        settings: normalizePreviewSettings(document.settings),
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
  onUpdateFontMetrics,
  onRecordExport,
  onSaveImage,
  onUpdateSelectedGlyph,
  previewText,
  onPreviewTextChange,
  selectedGlyph,
  spacebarGlyph,
}: TextPreviewProps) {
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const styleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeSettingsPanel, setActiveSettingsPanel] = useState<SettingsPanel>("image");
  const [documentName, setDocumentName] = useState("Untitled preview");
  const [fullscreenSettingsMenuOpen, setFullscreenSettingsMenuOpen] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [previewMenuRoot, setPreviewMenuRoot] = useState<HTMLElement | null>(null);
  const [savedDocuments, setSavedDocuments] = useState<PreviewDocument[]>(() => loadPreviewDocuments());
  const [shareStatus, setShareStatus] = useState("");
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [imageSettings, setImageSettings] = useState<PreviewImageSettings>(() => ({
    ...defaultPhoneImageSettings,
  }));

  const savedGlyphCount = useMemo(
    () => Object.values(font.glyphs).filter((glyph) => hasDrawnGlyph(glyph)).length,
    [font.glyphs],
  );

  const fontGlyphs = useMemo(
    () => Object.values(font.glyphs).filter((glyph) => glyph.character !== spacebar),
    [font.glyphs],
  );

  useEffect(() => {
    setPreviewMenuRoot(document.getElementById("preview-text-menu-slot"));
  }, []);

  useEffect(() => {
    renderPhoneImage();
  }, [font, imageSettings, imageViewerOpen, previewText, styleEditorOpen]);

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

  function measureCharacter(ctx: CanvasRenderingContext2D, character: string, fontSize: number) {
    if (character === spacebar) {
      return getSpacebarAdvance(font.glyphs[spacebar], fontSize);
    }

    const glyph = findPreviewGlyph(font.glyphs, character);

    if (glyph) {
      return getGlyphAdvance(glyph, fontSize, getFontWidthScale(font));
    }

    return ctx.measureText(character).width;
  }

  function measureTextRun(ctx: CanvasRenderingContext2D, text: string, fontSize: number) {
    return [...text].reduce((width, character) => width + measureCharacter(ctx, character, fontSize), 0);
  }

  function buildWordWrappedLines(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxLineWidth: number,
    fontSize: number,
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

        const tokenWidth = measureTextRun(ctx, token, fontSize);

        if (line.length > 0 && lineWidth + tokenWidth > maxLineWidth) {
          lines.push(line.trimEnd());
          line = token.replace(/^\s+/, "");
          lineWidth = measureTextRun(ctx, line, fontSize);
        } else {
          line += token;
          lineWidth += tokenWidth;
        }

        lineWidth = Math.max(lineWidth, measureTextRun(ctx, line, fontSize));
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
        const characterWidth = measureCharacter(ctx, character, fontSize);

        if (line.length > 0 && lineWidth + characterWidth > maxLineWidth) {
          lines.push(line);
          line = character.trimStart();
          lineWidth = measureTextRun(ctx, line, fontSize);
          continue;
        }

        line += character;
        lineWidth += characterWidth;
      }

      lines.push(line.trimEnd());
    }

    return lines;
  }

  function getLineX(ctx: CanvasRenderingContext2D, line: string, renderSettings: PreviewImageSettings) {
    const lineWidth = measureTextRun(ctx, line, renderSettings.fontSize);

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
  ) {
    const fontHeightScale = getFontHeightScale(font);
    const fontWidthScale = getFontWidthScale(font);
    const lineHeight = renderSettings.fontSize * renderSettings.lineSpacing * Math.max(0.72, fontHeightScale);
    ctx.font = getFallbackFont(renderSettings.fontSize);
    ctx.textBaseline = "top";

    lines.forEach((line, lineIndex) => {
      let x = getLineX(ctx, line, renderSettings);
      const y = renderSettings.pagePadding + lineIndex * lineHeight;

      [...line].forEach((character, characterIndex) => {
        const glyph = selectPreviewGlyph(
          font.glyphs,
          character,
          `${previewText}|${lineIndex}|${characterIndex}|${character}`,
        );

        if (glyph) {
          const scales = getGlyphRenderScales(font, glyph);
          const baselineY = y + renderSettings.fontSize * 0.76 * fontHeightScale;
          const glyphX = x + getGlyphLeftBearingOffset(font, glyph, renderSettings.fontSize);
          const glyphY = getGlyphTopForBaseline(glyph, renderSettings.fontSize, baselineY, scales.heightScale);

          drawGlyph(ctx, glyph, {
            x: glyphX,
            y: glyphY,
            size: renderSettings.fontSize,
            color: renderSettings.inkColor,
            renderProfile: font.renderProfile,
            heightScale: scales.heightScale,
            widthScale: scales.widthScale,
            backgroundTexture: renderSettings.backgroundTexture,
          });
          x += getGlyphAdvance(glyph, renderSettings.fontSize, fontWidthScale);
          return;
        }

        if (character === spacebar) {
          x += measureCharacter(ctx, character, renderSettings.fontSize);
          return;
        }

        const fallbackWidth = ctx.measureText(character).width;
        ctx.save();
        ctx.fillStyle = "rgba(204, 102, 94, 0.24)";
        ctx.fillRect(x - 3, y + renderSettings.fontSize * 0.02, fallbackWidth + 6, renderSettings.fontSize * 1.02);
        ctx.restore();
        ctx.fillStyle = renderSettings.inkColor;
        ctx.fillText(character, x, y + renderSettings.fontSize * 0.04);
        x += fallbackWidth;
      });
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

  function drawPreviewBackground(ctx: CanvasRenderingContext2D, renderSettings: PreviewImageSettings) {
    const imageWidth = renderSettings.canvasWidth;
    const imageHeight = renderSettings.canvasHeight;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, imageWidth, imageHeight);

    if (renderSettings.transparent) {
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

  function getPhoneImageLayout(ctx: CanvasRenderingContext2D): PhoneImageLayout {
    const maxLineWidth = Math.max(1, imageSettings.canvasWidth - imageSettings.pagePadding * 2);
    ctx.font = getFallbackFont(imageSettings.fontSize);
    const wrappedLines = imageSettings.autoFit
      ? buildWordWrappedLines(ctx, previewText, maxLineWidth, imageSettings.fontSize)
      : buildCharacterWrappedLines(ctx, previewText, maxLineWidth, imageSettings.fontSize);

    return {
      settings: imageSettings,
      lines: wrappedLines,
    };
  }

  function renderPhoneImageToCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const fittedLayout = getPhoneImageLayout(ctx);
    canvas.width = fittedLayout.settings.canvasWidth;
    canvas.height = fittedLayout.settings.canvasHeight;

    drawPreviewBackground(ctx, fittedLayout.settings);
    drawTextToCanvas(ctx, fittedLayout.lines, fittedLayout.settings);
  }

  function renderPhoneImage() {
    const canvases = [imageCanvasRef.current, styleCanvasRef.current, viewerCanvasRef.current].filter(
      (canvas): canvas is HTMLCanvasElement => Boolean(canvas),
    );

    canvases.forEach(renderPhoneImageToCanvas);
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
    onPreviewTextChange(preset.text);
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
      id: activeDocumentId ?? createPreviewId(),
      name: documentName.trim() || "Untitled preview",
      settings: imageSettings,
      text: previewText,
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
    onPreviewTextChange(document.text);
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

  function renderColorInputs() {
    return (
      <div className="phone-image-tools style-color-tools">
        <label>
          Ink
          <input
            type="color"
            value={imageSettings.inkColor}
            onChange={(event) =>
              setImageSettings((current) => ({ ...current, inkColor: event.target.value }))
            }
          />
        </label>
        <label>
          Page
          <input
            type="color"
            value={imageSettings.backgroundColor}
            disabled={imageSettings.transparent}
            onChange={(event) =>
              setImageSettings((current) => ({ ...current, backgroundColor: event.target.value }))
            }
          />
        </label>
        <label>
          Accent
          <input
            type="color"
            value={imageSettings.accentColor}
            disabled={imageSettings.transparent}
            onChange={(event) =>
              setImageSettings((current) => ({ ...current, accentColor: event.target.value }))
            }
          />
        </label>
      </div>
    );
  }

  function renderInkControls() {
    return (
      <div className="image-style-section">
        <p className="style-label">Ink colors</p>
        <div className="ink-swatch-row">
          {inkSwatches.map((swatch) => (
            <button
              key={swatch.color}
              className={`ink-swatch ${imageSettings.inkColor === swatch.color ? "selected" : ""}`}
              type="button"
              onClick={() => setImageSettings((current) => ({ ...current, inkColor: swatch.color }))}
            >
              <span style={{ backgroundColor: swatch.color }} />
              {swatch.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  function renderBackgroundControls() {
    return (
      <div className="image-style-section">
        <p className="style-label">Backgrounds</p>
        <div className="background-preset-grid">
          {backgroundPresets.map((preset) => (
            <button
              key={preset.id}
              className={`background-preset ${imageSettings.backgroundStyle === preset.id && !imageSettings.transparent ? "selected" : ""}`}
              type="button"
              disabled={imageSettings.transparent}
              onClick={() =>
                setImageSettings((current) => ({
                  ...current,
                  accentColor: preset.accentColor,
                  backgroundColor: preset.backgroundColor,
                  backgroundStyle: preset.id,
                  inkColor: preset.inkColor,
                  transparent: false,
                }))
              }
            >
              <span className="background-preset-swatch" style={{ background: preset.preview }} />
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    );
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
        ? font.guideSettings?.baseline ?? getAverageGlyphMetric(metric)
        : getAverageGlyphMetric(metric);
    const nextValue = getSteppedValue(currentValue, delta, min, max, precision);
    const glyphMetrics: Partial<Pick<Glyph, "baselineOffset" | "leftBearing" | "rightBearing" | "xAdvance">> = {
      [metric]: nextValue,
    };

    onUpdateFontMetrics({
      glyphMetrics,
      ...(metric === "baselineOffset"
        ? {
            guideSettings: {
              ...font.guideSettings,
              baseline: nextValue,
            },
          }
        : {}),
    });
  }

  function updateFontShapeMetric(
    metric: keyof FontShapeSettings,
    delta: number,
    min: number,
    max: number,
    precision = 2,
  ) {
    const currentShapeSettings = font.shapeSettings ?? { heightScale: 1, widthScale: 1 };
    const nextValue = getSteppedValue(currentShapeSettings[metric], delta, min, max, precision);

    onUpdateFontMetrics({
      shapeSettings: {
        ...currentShapeSettings,
        [metric]: nextValue,
      },
    });
  }

  function updateSpacebarAdvance(delta: number) {
    onUpdateSelectedGlyph({
      ...spacebarGlyph,
      character: spacebar,
      xAdvance: getSteppedValue(spacebarGlyph.xAdvance, delta, 0.18, 1.2, 2),
      updatedAt: new Date().toISOString(),
    });
  }

  function openStyleEditor() {
    setStyleEditorOpen(true);
    setFullscreenSettingsMenuOpen(false);
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
          min: 0.85,
          precision: 2,
          step: 0.05,
          value: imageSettings.lineSpacing,
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

  function renderFontSettingsControls(className = "phone-image-tools preview-layout-tools font-settings-tools") {
    return (
      <div className={className}>
        {renderFontMetricControl({
          label: "Baseline",
          max: 1.2,
          metric: "baselineOffset",
          min: 0,
          step: 0.02,
          value: font.guideSettings?.baseline ?? getAverageGlyphMetric("baselineOffset"),
        })}
        {renderFontShapeMetricControl({
          label: "Width",
          max: 1.6,
          metric: "widthScale",
          min: 0.55,
          step: 0.05,
          value: font.shapeSettings?.widthScale ?? 1,
        })}
        {renderFontMetricControl({
          label: "Advance",
          max: 2,
          metric: "xAdvance",
          min: 0.18,
          step: 0.05,
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
            <strong>{spacebarGlyph.xAdvance.toFixed(2)}</strong>
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

  return (
    <>
      {previewMenuRoot ? createPortal(renderPreviewTextMenu(), previewMenuRoot) : null}

      <section className="studio-panel preview-panel phone-generator-panel" aria-label="Preview image">
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
              <h2>Colors</h2>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={() => setStyleEditorOpen(false)}>
              Close
            </button>
          </div>

          <div className={`phone-image-preview phone-style-preview ${imageSettings.transparent ? "transparent-preview" : ""}`}>
            <canvas
              ref={styleCanvasRef}
              className="phone-image-canvas"
              aria-label="Generated preview style image"
            />
          </div>

          <div className="phone-style-content">
            {renderColorInputs()}
            <label className="check-control">
              <input
                type="checkbox"
                checked={imageSettings.transparent}
                onChange={(event) =>
                  setImageSettings((current) => ({ ...current, transparent: event.target.checked }))
                }
              />
              Transparent background
            </label>
            {renderInkControls()}
            {renderBackgroundControls()}
          </div>
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
            <div className="phone-image-active-settings" aria-live="polite">
              {settingsPanelLabels[activeSettingsPanel]}
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
            />
          </div>

          <div className="phone-image-fullscreen-settings">
            {activeSettingsPanel === "font" &&
              renderFontSettingsControls("phone-image-fullscreen-tools preview-layout-tools font-settings-tools")}
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
