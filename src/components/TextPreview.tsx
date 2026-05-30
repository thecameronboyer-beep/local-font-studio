import { useEffect, useMemo, useRef, useState } from "react";
import type { BackgroundStyle, FontSet, PreviewSettings } from "../types/fontTypes";
import { drawGlyph, findPreviewGlyph, getGlyphAdvance, hasDrawnGlyph } from "../render/glyphRenderer";

type SavedPreviewImage = {
  fontName: string;
  height: number;
  imageDataUrl: string;
  message: string;
  width: number;
};

type TextPreviewProps = {
  font: FontSet;
  onRecordExport?: (message: string) => void;
  onSaveImage?: (image: SavedPreviewImage) => boolean;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
};

type ExportPresetId = "phone" | "social" | "print" | "transparent";
type ImageMetricKey = "canvasHeight" | "canvasWidth" | "fontSize" | "lineSpacing" | "pagePadding";
type TextAlignment = "left" | "center" | "right";

type PreviewImageSettings = PreviewSettings & {
  accentColor: string;
  alignment: TextAlignment;
  autoFit: boolean;
  backgroundStyle: BackgroundStyle;
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
const MIN_PHONE_IMAGE_HEIGHT = 240;

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
    id: "print",
    label: "Print",
    settings: {
      canvasWidth: 2550,
      canvasHeight: 3300,
      exportPreset: "print",
      fontSize: 156,
      pagePadding: 210,
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
  return {
    ...defaultPhoneImageSettings,
    ...settings,
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

function isMissingGlyph(font: FontSet, character: string) {
  return character !== "\n" && character !== " " && !findPreviewGlyph(font.glyphs, character);
}

function formatPairGap(value: number) {
  return value.toFixed(2);
}

export default function TextPreview({ font, onRecordExport, onSaveImage, previewText, onPreviewTextChange }: TextPreviewProps) {
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const styleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState("Untitled preview");
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
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

  const diagnostics = useMemo(() => {
    if (typeof document === "undefined") {
      return {
        missingCharacters: [] as string[],
        pairWarnings: [] as Array<{ detail: string; pair: string; status: "tight" | "loose" | "missing" }>,
        oversizedWords: [] as string[],
      };
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return {
        missingCharacters: [] as string[],
        pairWarnings: [] as Array<{ detail: string; pair: string; status: "tight" | "loose" | "missing" }>,
        oversizedWords: [] as string[],
      };
    }

    ctx.font = getFallbackFont(imageSettings.fontSize);
    const maxLineWidth = imageSettings.canvasWidth - imageSettings.pagePadding * 2;
    const missingCharacters = [...new Set([...previewText].filter((character) => isMissingGlyph(font, character)))];
    const oversizedWords = previewText
      .split(/\s+/)
      .filter(Boolean)
      .filter((word) => measureTextRun(ctx, word, imageSettings.fontSize) > maxLineWidth)
      .slice(0, 8);
    const pairWarnings: Array<{ detail: string; pair: string; status: "tight" | "loose" | "missing" }> = [];
    const characters = [...previewText.replace(/\s+/g, "")];

    for (let index = 0; index < characters.length - 1; index += 1) {
      const left = characters[index];
      const right = characters[index + 1];
      const leftGlyph = findPreviewGlyph(font.glyphs, left);
      const rightGlyph = findPreviewGlyph(font.glyphs, right);
      const pair = `${left}${right}`;

      if (!leftGlyph || !rightGlyph) {
        if (pairWarnings.length < 10) {
          pairWarnings.push({ pair, status: "missing", detail: "Missing glyph" });
        }
        continue;
      }

      const gap = leftGlyph.rightBearing + rightGlyph.leftBearing;

      if (gap < -0.02 && pairWarnings.length < 10) {
        pairWarnings.push({ pair, status: "tight", detail: `${formatPairGap(gap)} gap` });
      } else if (gap > 0.28 && pairWarnings.length < 10) {
        pairWarnings.push({ pair, status: "loose", detail: `${formatPairGap(gap)} gap` });
      }
    }

    return {
      missingCharacters: missingCharacters.slice(0, 18),
      oversizedWords,
      pairWarnings,
    };
  }, [font, imageSettings.canvasWidth, imageSettings.fontSize, imageSettings.pagePadding, previewText]);

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
      inkColor: font.theme?.inkColor ?? current.inkColor,
    }));
  }, [font.id]);

  function measureCharacter(ctx: CanvasRenderingContext2D, character: string, fontSize: number) {
    const glyph = findPreviewGlyph(font.glyphs, character);

    if (glyph) {
      return getGlyphAdvance(glyph, fontSize);
    }

    if (character === " ") {
      return fontSize * 0.36;
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

  function hasOversizeWord(ctx: CanvasRenderingContext2D, text: string, maxLineWidth: number, fontSize: number) {
    return text
      .split(/\s+/)
      .filter(Boolean)
      .some((word) => measureTextRun(ctx, word, fontSize) > maxLineWidth);
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
    const lineHeight = renderSettings.fontSize * renderSettings.lineSpacing;
    ctx.font = getFallbackFont(renderSettings.fontSize);
    ctx.textBaseline = "top";

    lines.forEach((line, lineIndex) => {
      let x = getLineX(ctx, line, renderSettings);
      const y = renderSettings.pagePadding + lineIndex * lineHeight;

      for (const character of line) {
        const glyph = findPreviewGlyph(font.glyphs, character);

        if (glyph) {
          const baselineY = y + renderSettings.fontSize * 0.76;
          const glyphX = x + glyph.leftBearing * renderSettings.fontSize;
          const glyphY = baselineY - glyph.baselineOffset * renderSettings.fontSize;

          drawGlyph(ctx, glyph, {
            x: glyphX,
            y: glyphY,
            size: renderSettings.fontSize,
            color: renderSettings.inkColor,
            renderProfile: font.renderProfile,
            widthScale: glyph.width,
          });
          x += getGlyphAdvance(glyph, renderSettings.fontSize);
          continue;
        }

        if (character === " ") {
          x += renderSettings.fontSize * 0.36;
          continue;
        }

        const fallbackWidth = ctx.measureText(character).width;
        ctx.save();
        ctx.fillStyle = "rgba(204, 102, 94, 0.24)";
        ctx.fillRect(x - 3, y + renderSettings.fontSize * 0.02, fallbackWidth + 6, renderSettings.fontSize * 1.02);
        ctx.restore();
        ctx.fillStyle = renderSettings.inkColor;
        ctx.fillText(character, x, y + renderSettings.fontSize * 0.04);
        x += fallbackWidth;
      }
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
      return;
    }

    if (renderSettings.backgroundStyle === "midnight") {
      const gradient = ctx.createLinearGradient(0, 0, imageWidth, imageHeight);
      gradient.addColorStop(0, renderSettings.backgroundColor);
      gradient.addColorStop(1, "#1f3037");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, imageWidth, imageHeight);
      drawPaperTexture(ctx, renderSettings.accentColor, imageWidth, imageHeight);
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
  }

  function getFittedImageLayout(ctx: CanvasRenderingContext2D): PhoneImageLayout {
    let fontSize = imageSettings.fontSize;
    let wrappedLines: string[] = [];
    const minimumFontSize = 24;

    while (fontSize >= minimumFontSize) {
      const candidateSettings = { ...imageSettings, fontSize };
      const maxLineWidth = candidateSettings.canvasWidth - candidateSettings.pagePadding * 2;
      const maxTextHeight = candidateSettings.canvasHeight - candidateSettings.pagePadding * 2;
      ctx.font = getFallbackFont(fontSize);
      wrappedLines = buildWordWrappedLines(ctx, previewText, maxLineWidth, fontSize);

      const lineCount = Math.max(1, wrappedLines.length);
      const lineHeight = fontSize * candidateSettings.lineSpacing;
      const textBlockHeight = (lineCount - 1) * lineHeight + fontSize * 1.08;
      const wordsFit = !hasOversizeWord(ctx, previewText, maxLineWidth, fontSize);
      const heightFits = textBlockHeight <= maxTextHeight || candidateSettings.canvasHeight <= MIN_PHONE_IMAGE_HEIGHT;

      if (!imageSettings.autoFit || (wordsFit && heightFits)) {
        return {
          settings: candidateSettings,
          lines: wrappedLines,
        };
      }

      fontSize -= 4;
    }

    const fittedSettings = { ...imageSettings, fontSize: minimumFontSize };
    const maxLineWidth = fittedSettings.canvasWidth - fittedSettings.pagePadding * 2;
    ctx.font = getFallbackFont(minimumFontSize);
    wrappedLines = buildWordWrappedLines(ctx, previewText, maxLineWidth, minimumFontSize);

    return {
      settings: fittedSettings,
      lines: wrappedLines,
    };
  }

  function renderPhoneImageToCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const fittedLayout = getFittedImageLayout(ctx);
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
    const blob = await getPhoneImageBlob();
    const canvas = imageCanvasRef.current;

    if (!blob || !canvas) {
      setShareStatus("Could not make an image yet.");
      return;
    }

    try {
      const savedLocally = onSaveImage?.({
        fontName: font.name,
        height: canvas.height,
        imageDataUrl: canvas.toDataURL("image/png"),
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

  return (
    <section className="studio-panel preview-panel phone-generator-panel" aria-label="Preview test bench">
      <div className="panel-heading phone-image-heading">
        <div>
          <p className="eyebrow">Preview test bench</p>
          <h2>Real text</h2>
        </div>
        <div className="glyph-pill">{savedGlyphCount} saved</div>
      </div>

      <div className="preview-preset-grid" aria-label="Preview presets">
        {previewPresets.map((preset) => (
          <button key={preset.id} className="secondary-button compact-button" type="button" onClick={() => applyTextPreset(preset)}>
            {preset.label}
          </button>
        ))}
      </div>

      <textarea
        className="preview-input phone-text-input"
        value={previewText}
        onChange={(event) => {
          onPreviewTextChange(event.target.value);
          setActiveDocumentId(null);
        }}
        spellCheck={false}
      />

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

      <div className="preview-diagnostics" aria-label="Preview diagnostics">
        <div className={`diagnostic-card ${diagnostics.missingCharacters.length > 0 ? "warn" : "ok"}`}>
          <strong>Missing</strong>
          <span>{diagnostics.missingCharacters.length > 0 ? diagnostics.missingCharacters.join(" ") : "None"}</span>
        </div>
        <div className={`diagnostic-card ${diagnostics.pairWarnings.length > 0 ? "warn" : "ok"}`}>
          <strong>Pairs</strong>
          <span>
            {diagnostics.pairWarnings.length > 0
              ? diagnostics.pairWarnings.slice(0, 3).map((pair) => `${pair.pair} ${pair.status}`).join(", ")
              : "No obvious pair issues"}
          </span>
        </div>
        <div className={`diagnostic-card ${diagnostics.oversizedWords.length > 0 ? "warn" : "ok"}`}>
          <strong>Words</strong>
          <span>{diagnostics.oversizedWords.length > 0 ? diagnostics.oversizedWords.join(", ") : "Fit current width"}</span>
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

      <div className="phone-image-actions primary-share-actions">
        <button className="primary-button compact-button" type="button" onClick={sharePhoneImage}>
          Share
        </button>
        <button className="secondary-button compact-button" type="button" onClick={downloadPhoneImage}>
          Export PNG
        </button>
        <button className="secondary-button compact-button" type="button" onClick={() => setStyleEditorOpen(true)}>
          Style
        </button>
      </div>
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

      <div className="phone-image-tools preview-layout-tools">
        {renderImageMetricControl({
          label: "Size",
          max: 220,
          metric: "fontSize",
          min: 24,
          step: 4,
          value: imageSettings.fontSize,
        })}
        {renderImageMetricControl({
          label: "Width",
          max: 3300,
          metric: "canvasWidth",
          min: 640,
          step: 80,
          value: imageSettings.canvasWidth,
        })}
        {renderImageMetricControl({
          label: "Height",
          max: 3600,
          metric: "canvasHeight",
          min: 480,
          step: 80,
          value: imageSettings.canvasHeight,
        })}
        {renderImageMetricControl({
          label: "Line",
          max: 2,
          metric: "lineSpacing",
          min: 0.85,
          precision: 2,
          step: 0.05,
          value: imageSettings.lineSpacing,
        })}
        {renderImageMetricControl({
          label: "Pad",
          max: 260,
          metric: "pagePadding",
          min: 0,
          step: 8,
          value: imageSettings.pagePadding,
        })}
      </div>

      <div className="alignment-row" aria-label="Text alignment">
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
            <div>
              <p className="eyebrow">Preview</p>
              <h2>Export image</h2>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={() => setImageViewerOpen(false)}>
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

          <div className="phone-image-fullscreen-actions">
            <button className="primary-button compact-button" type="button" onClick={sharePhoneImage}>
              Share
            </button>
            <button className="secondary-button compact-button" type="button" onClick={downloadPhoneImage}>
              Export PNG
            </button>
          </div>
        </section>
      )}
    </section>
  );
}
