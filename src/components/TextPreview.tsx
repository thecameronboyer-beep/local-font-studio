import { useEffect, useMemo, useRef, useState } from "react";
import type { BackgroundStyle, FontSet, PreviewSettings } from "../types/fontTypes";
import { drawGlyph, findPreviewGlyph, getGlyphAdvance, hasDrawnGlyph } from "../render/glyphRenderer";

type TextPreviewProps = {
  font: FontSet;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
};

type PhoneImageSettings = PreviewSettings & {
  accentColor: string;
  autoFit: boolean;
  backgroundStyle: BackgroundStyle;
};

const PHONE_IMAGE_WIDTH = 1080;
const MIN_PHONE_IMAGE_HEIGHT = 240;

type PhoneImageLayout = {
  height: number;
  lines: string[];
  settings: PhoneImageSettings;
};

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

export default function TextPreview({ font, previewText, onPreviewTextChange }: TextPreviewProps) {
  const imageCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const styleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [shareStatus, setShareStatus] = useState("");
  const [styleEditorOpen, setStyleEditorOpen] = useState(false);
  const [imageSettings, setImageSettings] = useState<PhoneImageSettings>({
    fontSize: 118,
    lineSpacing: 1.18,
    inkColor: "#17110b",
    backgroundColor: "#f4ead7",
    accentColor: "#d3bf97",
    backgroundStyle: "paper",
    pagePadding: 92,
    autoFit: true,
  });

  const savedGlyphCount = useMemo(
    () => Object.values(font.glyphs).filter((glyph) => hasDrawnGlyph(glyph)).length,
    [font.glyphs],
  );

  useEffect(() => {
    renderPhoneImage();
  }, [font, previewText, imageSettings, styleEditorOpen]);

  useEffect(() => {
    document.body.classList.toggle("editor-fullscreen-open", styleEditorOpen);

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [styleEditorOpen]);

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

  function drawTextToCanvas(
    ctx: CanvasRenderingContext2D,
    lines: string[],
    renderSettings: PreviewSettings,
  ) {
    const lineHeight = renderSettings.fontSize * renderSettings.lineSpacing;
    ctx.font = getFallbackFont(renderSettings.fontSize);
    ctx.textBaseline = "top";

    lines.forEach((line, lineIndex) => {
      let x = renderSettings.pagePadding;
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
            widthScale: glyph.width,
          });
          x += getGlyphAdvance(glyph, renderSettings.fontSize);
          continue;
        }

        if (character === " ") {
          x += renderSettings.fontSize * 0.36;
          continue;
        }

        ctx.fillStyle = renderSettings.inkColor;
        ctx.fillText(character, x, y + renderSettings.fontSize * 0.04);
        x += ctx.measureText(character).width;
      }
    });
  }

  function drawPaperTexture(ctx: CanvasRenderingContext2D, color: string, imageHeight: number) {
    ctx.save();
    ctx.fillStyle = color;

    const speckleCount = Math.max(80, Math.ceil((PHONE_IMAGE_WIDTH * imageHeight) / 4000));

    for (let index = 0; index < speckleCount; index += 1) {
      const x = (index * 97) % PHONE_IMAGE_WIDTH;
      const y = (index * 193) % imageHeight;
      const radius = 0.8 + (index % 5) * 0.42;
      ctx.globalAlpha = 0.035 + (index % 4) * 0.008;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  function drawPhoneBackground(
    ctx: CanvasRenderingContext2D,
    renderSettings: PhoneImageSettings,
    imageHeight: number,
  ) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (renderSettings.backgroundStyle === "rage") {
      const gradient = ctx.createLinearGradient(0, 0, PHONE_IMAGE_WIDTH, imageHeight);
      gradient.addColorStop(0, "#130305");
      gradient.addColorStop(0.56, renderSettings.backgroundColor);
      gradient.addColorStop(1, "#6f1115");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, PHONE_IMAGE_WIDTH, imageHeight);

      const glow = ctx.createRadialGradient(820, 220, 40, 820, 220, 760);
      glow.addColorStop(0, "rgba(255, 176, 0, 0.42)");
      glow.addColorStop(1, "rgba(255, 176, 0, 0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, PHONE_IMAGE_WIDTH, imageHeight);
      drawPaperTexture(ctx, renderSettings.accentColor, imageHeight);
      return;
    }

    if (renderSettings.backgroundStyle === "midnight") {
      const gradient = ctx.createLinearGradient(0, 0, PHONE_IMAGE_WIDTH, imageHeight);
      gradient.addColorStop(0, renderSettings.backgroundColor);
      gradient.addColorStop(1, "#1f3037");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, PHONE_IMAGE_WIDTH, imageHeight);
      drawPaperTexture(ctx, renderSettings.accentColor, imageHeight);
      return;
    }

    if (["blush", "sage", "sky", "lavender"].includes(renderSettings.backgroundStyle)) {
      const gradient = ctx.createLinearGradient(0, 0, PHONE_IMAGE_WIDTH, imageHeight);
      gradient.addColorStop(0, "#fff7e8");
      gradient.addColorStop(0.42, renderSettings.backgroundColor);
      gradient.addColorStop(1, renderSettings.accentColor);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, PHONE_IMAGE_WIDTH, imageHeight);
      drawPaperTexture(ctx, "#ffffff", imageHeight);
      return;
    }

    ctx.fillStyle = renderSettings.backgroundColor;
    ctx.fillRect(0, 0, PHONE_IMAGE_WIDTH, imageHeight);

    if (renderSettings.backgroundStyle === "paper") {
      drawPaperTexture(ctx, renderSettings.accentColor, imageHeight);
    }

    if (renderSettings.backgroundStyle === "lined") {
      ctx.save();
      ctx.strokeStyle = renderSettings.accentColor;
      ctx.globalAlpha = 0.62;
      ctx.lineWidth = 2;

      for (let y = 220; y < imageHeight - 120; y += 84) {
        ctx.beginPath();
        ctx.moveTo(72, y);
        ctx.lineTo(PHONE_IMAGE_WIDTH - 72, y);
        ctx.stroke();
      }

      ctx.restore();
      drawPaperTexture(ctx, renderSettings.accentColor, imageHeight);
    }

    if (renderSettings.backgroundStyle === "grid") {
      ctx.save();
      ctx.strokeStyle = renderSettings.accentColor;
      ctx.globalAlpha = 0.34;
      ctx.lineWidth = 2;

      for (let x = 72; x < PHONE_IMAGE_WIDTH; x += 72) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, imageHeight);
        ctx.stroke();
      }

      for (let y = 72; y < imageHeight; y += 72) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(PHONE_IMAGE_WIDTH, y);
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  function getPhoneImageHeight(lines: string[], renderSettings: PreviewSettings) {
    const lineCount = Math.max(1, lines.length);
    const lineHeight = renderSettings.fontSize * renderSettings.lineSpacing;
    const textBlockHeight = (lineCount - 1) * lineHeight + renderSettings.fontSize * 1.08;

    return Math.max(MIN_PHONE_IMAGE_HEIGHT, Math.ceil(renderSettings.pagePadding * 2 + textBlockHeight));
  }

  function getFittedImageLayout(ctx: CanvasRenderingContext2D): PhoneImageLayout {
    let fontSize = imageSettings.fontSize;
    let wrappedLines: string[] = [];
    const minimumFontSize = 34;

    while (fontSize >= minimumFontSize) {
      const candidateSettings = { ...imageSettings, fontSize };
      const maxLineWidth = PHONE_IMAGE_WIDTH - candidateSettings.pagePadding * 2;
      ctx.font = getFallbackFont(fontSize);
      wrappedLines = buildWordWrappedLines(ctx, previewText, maxLineWidth, fontSize);

      const wordsFit = !hasOversizeWord(ctx, previewText, maxLineWidth, fontSize);

      if (!imageSettings.autoFit || wordsFit) {
        return {
          height: getPhoneImageHeight(wrappedLines, candidateSettings),
          settings: candidateSettings,
          lines: wrappedLines,
        };
      }

      fontSize -= 4;
    }

    const fittedSettings = { ...imageSettings, fontSize: minimumFontSize };
    const maxLineWidth = PHONE_IMAGE_WIDTH - fittedSettings.pagePadding * 2;
    ctx.font = getFallbackFont(minimumFontSize);
    wrappedLines = buildWordWrappedLines(ctx, previewText, maxLineWidth, minimumFontSize);

    return {
      height: getPhoneImageHeight(wrappedLines, fittedSettings),
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
    canvas.width = PHONE_IMAGE_WIDTH;
    canvas.height = fittedLayout.height;

    drawPhoneBackground(ctx, fittedLayout.settings, fittedLayout.height);
    drawTextToCanvas(ctx, fittedLayout.lines, fittedLayout.settings);
  }

  function renderPhoneImage() {
    const canvases = [imageCanvasRef.current, styleCanvasRef.current].filter(
      (canvas): canvas is HTMLCanvasElement => Boolean(canvas),
    );

    canvases.forEach(renderPhoneImageToCanvas);
  }

  function getPhoneImageFileName() {
    return `${sanitizeFileName(font.name)}-phone-image.png`;
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

  async function downloadPhoneImage() {
    const blob = await getPhoneImageBlob();

    if (!blob) {
      setShareStatus("Could not make an image yet.");
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = getPhoneImageFileName();
      link.click();
      URL.revokeObjectURL(objectUrl);
      setShareStatus("Saved PNG.");
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
        return;
      }

      if (navigator.share) {
        await navigator.share({
          text: "Made in Local Font Studio",
          title: font.name,
        });
        setShareStatus("This browser shared the app text, but not the image file.");
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
              className={`background-preset ${imageSettings.backgroundStyle === preset.id ? "selected" : ""}`}
              type="button"
              onClick={() =>
                setImageSettings((current) => ({
                  ...current,
                  accentColor: preset.accentColor,
                  backgroundColor: preset.backgroundColor,
                  backgroundStyle: preset.id,
                  inkColor: preset.inkColor,
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

  return (
    <section className="studio-panel preview-panel phone-generator-panel" aria-label="Phone image generator">
      <div className="panel-heading phone-image-heading">
        <div>
          <p className="eyebrow">Phone image</p>
          <h2>Share image</h2>
        </div>
        <div className="glyph-pill">{savedGlyphCount} saved</div>
      </div>

      <textarea
        className="preview-input phone-text-input"
        value={previewText}
        onChange={(event) => onPreviewTextChange(event.target.value)}
        spellCheck={false}
      />

      <div className="phone-image-actions primary-share-actions">
        <button className="primary-button compact-button" type="button" onClick={sharePhoneImage}>
          Share
        </button>
        <button className="secondary-button compact-button" type="button" onClick={downloadPhoneImage}>
          Save PNG
        </button>
        <button className="secondary-button compact-button" type="button" onClick={() => setStyleEditorOpen(true)}>
          Style
        </button>
      </div>
      <div className="share-status" aria-live="polite">
        {shareStatus}
      </div>

      <div className="phone-image-preview">
        <canvas
          ref={imageCanvasRef}
          className="phone-image-canvas"
          aria-label="Generated phone image preview"
        />
      </div>

      <div className="phone-image-tools">
        <label>
          Size
          <input
            type="number"
            min="34"
            max="220"
            value={imageSettings.fontSize}
            onChange={(event) =>
              setImageSettings((current) => ({ ...current, fontSize: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Line
          <input
            type="number"
            min="0.9"
            max="2"
            step="0.05"
            value={imageSettings.lineSpacing}
            onChange={(event) =>
              setImageSettings((current) => ({ ...current, lineSpacing: Number(event.target.value) }))
            }
          />
        </label>
        <label>
          Pad
          <input
            type="number"
            min="36"
            max="180"
            value={imageSettings.pagePadding}
            onChange={(event) =>
              setImageSettings((current) => ({ ...current, pagePadding: Number(event.target.value) }))
            }
          />
        </label>
        <label className="check-control">
          <input
            type="checkbox"
            checked={imageSettings.autoFit}
            onChange={(event) =>
              setImageSettings((current) => ({ ...current, autoFit: event.target.checked }))
            }
          />
          Fit text
        </label>
      </div>

      {styleEditorOpen && (
        <section className="studio-panel phone-style-fullscreen" aria-label="Phone image style editor">
          <div className="panel-heading phone-style-heading">
            <div>
              <p className="eyebrow">Image style</p>
              <h2>Colors</h2>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={() => setStyleEditorOpen(false)}>
              Close
            </button>
          </div>

          <div className="phone-image-preview phone-style-preview">
            <canvas
              ref={styleCanvasRef}
              className="phone-image-canvas"
              aria-label="Generated phone image style preview"
            />
          </div>

          <div className="phone-style-content">
            {renderColorInputs()}
            {renderInkControls()}
            {renderBackgroundControls()}
          </div>
        </section>
      )}
    </section>
  );
}
