import { useEffect, useRef, useState } from "react";
import GlyphCanvas from "./GlyphCanvas";
import type { CanvasViewOffset, DrawingTool, EraserMode, SmoothingMode } from "./GlyphCanvas";
import SpacingControls from "./SpacingControls";
import { getCharacterLabel, spacebar, supportedCharacters } from "../data/characterSets";
import { drawGlyph, findPreviewGlyph, getGlyphAdvance, getSpacebarAdvance } from "../render/glyphRenderer";
import type { FontSet, Glyph, GlyphDecoration, GlyphInkEffect, GlyphStroke } from "../types/fontTypes";

type GlyphEditorProps = {
  font: FontSet;
  glyph: Glyph;
  onSaveGlyph: (glyph: Glyph) => void;
  previewText: string;
  onPreviewTextChange: (text: string) => void;
  characterIndex: number;
  characterTotal: number;
  onPreviousCharacter: () => void;
  onNextCharacter: () => void;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
};

const glyphInkSwatches = ["#19140f", "#d93434", "#f0a934", "#16815f", "#2468c9", "#8b4bd9"];
const DEFAULT_CANVAS_VIEW: CanvasViewOffset = { x: 0, y: 0 };
const smoothingOptions: Array<{ id: SmoothingMode; label: string }> = [
  { id: "raw", label: "Raw" },
  { id: "gentle", label: "Gentle" },
  { id: "strong", label: "Strong" },
];

function getDefaultDrawingTool(font: FontSet): DrawingTool {
  return font.renderProfile === "quillParchment" ? "quill" : "pen";
}

function getDefaultInkEffect(font: FontSet): GlyphInkEffect {
  return font.renderProfile === "quillParchment" ? "dramaticPooling" : "none";
}
const eyeExpressionOptions: Array<{
  id: NonNullable<GlyphDecoration["expression"]>;
  label: string;
}> = [
  { id: "googly", label: "Plain" },
  { id: "happy", label: "Happy" },
  { id: "angry", label: "Angry" },
  { id: "tired", label: "Tired" },
  { id: "stoned", label: "Stoned" },
];

function cloneStrokes(strokes: GlyphStroke[]) {
  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((point) => ({ ...point })),
  }));
}

function cloneDecorations(decorations: GlyphDecoration[] = []) {
  return decorations.map((decoration) => ({ ...decoration }));
}

function cloneGlyph(glyph: Glyph): Glyph {
  return {
    ...glyph,
    decorations: cloneDecorations(glyph.decorations),
    strokes: cloneStrokes(glyph.strokes),
  };
}

function getDecorationInset(decoration: GlyphDecoration) {
  return decoration.size * 3.2;
}

function getGlyphElementBounds(strokes: GlyphStroke[], decorations: GlyphDecoration[] = []) {
  const strokePoints = strokes.flatMap((stroke) => stroke.points);
  const decorationPoints = decorations.flatMap((decoration) => {
    const inset = getDecorationInset(decoration);

    return [
      { x: decoration.x - inset, y: decoration.y - inset },
      { x: decoration.x + inset, y: decoration.y + inset },
    ];
  });
  const points = [...strokePoints, ...decorationPoints];

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

function centerGlyphElements(glyph: Glyph, axis: "x" | "y" | "both") {
  const bounds = getGlyphElementBounds(glyph.strokes, glyph.decorations);

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
    decorations: translateDecorations(glyph.decorations, safeDx, safeDy),
    strokes: translateStrokes(glyph.strokes, safeDx, safeDy),
  };
}

function nudgeGlyphElements(glyph: Glyph, dx: number, dy: number) {
  return {
    ...glyph,
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
          {glyphInkSwatches.map((color) => (
            <button
              key={color}
              className={`glyph-ink-swatch ${inkColor === color ? "selected" : ""}`}
              type="button"
              onClick={() => selectColor(color)}
              aria-label={`Use ink color ${color}`}
            >
              <span style={{ backgroundColor: color }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EyeExpressionControl({
  expression,
  onExpressionChange,
}: {
  expression: NonNullable<GlyphDecoration["expression"]>;
  onExpressionChange: (expression: NonNullable<GlyphDecoration["expression"]>) => void;
}) {
  return (
    <div className="eye-style-control" aria-label="Eye expression">
      {eyeExpressionOptions.map((option) => (
        <button
          key={option.id}
          className={`eye-style-button ${expression === option.id ? "selected" : ""}`}
          type="button"
          onClick={() => onExpressionChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
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
  const textToRender = previewText.trim() ? previewText : `${draftGlyph.character} ${draftGlyph.character}${draftGlyph.character}`;

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
    const lineHeight = fontSize * 1.16;
    const previewBackground = font.renderProfile === "quillParchment" ? font.theme?.backgroundColor ?? "#efe0bd" : "#171516";
    const previewInkColor = font.renderProfile === "quillParchment" ? font.theme?.inkColor ?? "#2a160d" : "#f4ead7";
    const glyphs = {
      ...font.glyphs,
      [draftGlyph.character]: draftGlyph,
    };

    ctx.font = getFallbackFont(fontSize);

    const lines: string[] = [];
    let line = "";
    let lineWidth = 0;
    const maxLineWidth = width - padding * 2;

    for (const character of textToRender.replace(/\n/g, " ")) {
      const glyph = findPreviewGlyph(glyphs, character);
      const characterWidth = glyph
        ? getGlyphAdvance(glyph, fontSize)
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

      for (const character of previewLine) {
        const glyph = findPreviewGlyph(glyphs, character);

        if (glyph) {
          const baselineY = y + fontSize * 0.76;
          drawGlyph(ctx, glyph, {
            x: x + glyph.leftBearing * fontSize,
            y: baselineY - glyph.baselineOffset * fontSize,
            size: fontSize,
            color: previewInkColor,
            renderProfile: font.renderProfile,
            widthScale: glyph.width,
          });
          x += getGlyphAdvance(glyph, fontSize);
          continue;
        }

        if (character === spacebar) {
          x += getSpacebarAdvance(font.glyphs[spacebar], fontSize);
          continue;
        }

        ctx.fillStyle = previewInkColor;
        ctx.fillText(character, x, y + fontSize * 0.04);
        x += ctx.measureText(character).width;
      }
    });
  }, [draftGlyph, font, surfaceWidth, textToRender]);

  return (
    <div className="editor-live-preview">
      <input
        aria-label="Preview text"
        value={previewText}
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
  const draftGlyphRef = useRef<Glyph>(draftGlyph);
  const pastRef = useRef<Glyph[]>([]);
  const futureRef = useRef<Glyph[]>([]);
  const [brushSize, setBrushSize] = useState(9);
  const [eraserMode, setEraserMode] = useState<EraserMode>("stroke");
  const [eyeExpression, setEyeExpression] = useState<NonNullable<GlyphDecoration["expression"]>>("googly");
  const [inkEffect, setInkEffect] = useState<GlyphInkEffect>(() => getDefaultInkEffect(font));
  const [inkColor, setInkColor] = useState(font.theme?.inkColor ?? "#19140f");
  const [referenceCharacter, setReferenceCharacter] = useState("");
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [smoothingMode, setSmoothingMode] = useState<SmoothingMode>("gentle");
  const [tool, setTool] = useState<DrawingTool>(() => getDefaultDrawingTool(font));
  const [viewOffset, setViewOffset] = useState<CanvasViewOffset>(DEFAULT_CANVAS_VIEW);
  const [viewScale, setViewScale] = useState(1);
  const [savedMessage, setSavedMessage] = useState("");
  const [historyCounts, setHistoryCounts] = useState({ past: 0, future: 0 });
  const [fullScreenPage, setFullScreenPage] = useState<"draw" | "adjust">("draw");
  const characterLabel = getCharacterLabel(glyph.character);
  const activeReferenceCharacter = referenceCharacter === glyph.character ? "" : referenceCharacter;
  const referenceGlyph = activeReferenceCharacter ? font.glyphs[activeReferenceCharacter] : null;

  useEffect(() => {
    const nextGlyph = cloneGlyph(glyph);
    draftGlyphRef.current = nextGlyph;
    pastRef.current = [];
    futureRef.current = [];
    setDraftGlyph(nextGlyph);
    setHistoryCounts({ past: 0, future: 0 });
    setReferenceCharacter((current) => (current === glyph.character ? "" : current));
    setSelectedStrokeId(null);
    setSavedMessage("");
  }, [glyph.character]);

  useEffect(() => {
    setTool(getDefaultDrawingTool(font));
    setInkEffect(getDefaultInkEffect(font));
    setInkColor(font.theme?.inkColor ?? "#19140f");
  }, [font.id, font.renderProfile, font.theme?.inkColor]);

  useEffect(() => {
    document.body.classList.toggle("editor-fullscreen-open", isFullScreen);

    if (isFullScreen) {
      setFullScreenPage("draw");
    }

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [isFullScreen]);

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

  function chooseTool(nextTool: DrawingTool) {
    setTool(nextTool);

    if (nextTool !== "select") {
      setSelectedStrokeId(null);
    }
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

  function handleZoom(delta: number) {
    setViewScale((current) => Math.min(3, Math.max(0.65, Number((current + delta).toFixed(2)))));
  }

  function handleResetView() {
    setViewScale(1);
    setViewOffset(DEFAULT_CANVAS_VIEW);
  }

  function renderReferenceGlyphControl() {
    return (
      <label className="reference-control">
        <span>Reference</span>
        <select value={activeReferenceCharacter} onChange={(event) => setReferenceCharacter(event.target.value)}>
          <option value="">None</option>
          {supportedCharacters
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

  function handleSave() {
    const savedGlyph = {
      ...cloneGlyph(draftGlyphRef.current),
      updatedAt: new Date().toISOString(),
    };

    onSaveGlyph({
      ...savedGlyph,
      character: glyph.character,
    });

    setSavedMessage(`Saved ${getCharacterLabel(glyph.character)}`);
  }

  function handleSaveAndNext() {
    handleSave();
    onNextCharacter();
  }

  function handleClear() {
    pushHistory();
    updateDraftGlyph({
      ...draftGlyphRef.current,
      decorations: [],
      strokes: [],
    });
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
    setSavedMessage("Undid change");
    syncHistoryCounts();
  }

  function handleRedo() {
    const nextGlyph = futureRef.current.shift();

    if (!nextGlyph) {
      return;
    }

    pastRef.current = [...pastRef.current.slice(-29), cloneGlyph(draftGlyphRef.current)];
    updateDraftGlyph(cloneGlyph(nextGlyph));
    setSavedMessage("Redid change");
    syncHistoryCounts();
  }

  if (isFullScreen && fullScreenPage === "draw") {
    return (
      <section className="studio-panel editor-panel fullscreen-editor fullscreen-draw-only" aria-label="Glyph editor">
        <GlyphCanvas
          strokes={draftGlyph.strokes}
          decorations={draftGlyph.decorations}
          brushSize={brushSize}
          eyeExpression={eyeExpression}
          eraserMode={eraserMode}
          inkEffect={inkEffect}
          inkColor={inkColor}
          referenceGlyph={referenceGlyph}
          renderProfile={font.renderProfile}
          selectedStrokeId={selectedStrokeId}
          showGuides={showGuides}
          smoothingMode={smoothingMode}
          tool={tool}
          viewOffset={viewOffset}
          viewScale={viewScale}
          onEditStart={pushHistory}
          onChangeViewOffset={setViewOffset}
          onChangeDecorations={updateDraftDecorations}
          onChangeStrokes={updateDraftStrokes}
          onSelectStroke={setSelectedStrokeId}
        />

        <div className="draw-only-topbar" aria-label="Drawing navigation">
          <button className="draw-glass-button" type="button" onClick={onToggleFullScreen}>
            Exit
          </button>
          <button className="draw-glass-button" type="button" onClick={onPreviousCharacter}>
            Prev
          </button>
          <div className="draw-character-pill">
            <strong>{characterLabel}</strong>
            <span>
              {characterIndex + 1}/{characterTotal}
            </span>
          </div>
          <button className="draw-glass-button" type="button" onClick={onNextCharacter}>
            Next
          </button>
          <button className="draw-glass-button accent" type="button" onClick={() => setFullScreenPage("adjust")}>
            Adjust
          </button>
        </div>

        <div className="draw-only-toolbar" aria-label="Drawing tools">
          <div className="draw-tool-grid">
            <button
              className={`draw-glass-button ${tool === "pen" ? "active-tool" : ""}`}
              type="button"
              onClick={() => chooseTool("pen")}
            >
              Pen
            </button>
            <button
              className={`draw-glass-button ${tool === "quill" ? "active-tool" : ""}`}
              type="button"
              onClick={() => chooseTool("quill")}
            >
              Quill
            </button>
            <button
              className={`draw-glass-button ${tool === "eyes" ? "active-tool" : ""}`}
              type="button"
              onClick={() => chooseTool("eyes")}
            >
              Eyes
            </button>
            <button
              className={`draw-glass-button ${tool === "eraser" ? "active-tool" : ""}`}
              type="button"
              onClick={() => chooseTool("eraser")}
            >
              Eraser
            </button>
            <button
              className={`draw-glass-button ${tool === "select" ? "active-tool" : ""}`}
              type="button"
              onClick={() => chooseTool("select")}
            >
              Select
            </button>
            <button
              className={`draw-glass-button ${tool === "pan" ? "active-tool" : ""}`}
              type="button"
              onClick={() => chooseTool("pan")}
            >
              Pan
            </button>
            <button
              className="draw-glass-button"
              type="button"
              disabled={historyCounts.past === 0}
              onClick={handleUndo}
            >
              Undo
            </button>
            <button
              className="draw-glass-button"
              type="button"
              disabled={historyCounts.future === 0}
              onClick={handleRedo}
            >
              Redo
            </button>
          </div>

          {tool === "eyes" && (
            <EyeExpressionControl expression={eyeExpression} onExpressionChange={setEyeExpression} />
          )}

          {tool === "eraser" && (
            <div className="engine-option-row" aria-label="Eraser mode">
              <button
                className={`draw-glass-button ${eraserMode === "stroke" ? "active-tool" : ""}`}
                type="button"
                onClick={() => setEraserMode("stroke")}
              >
                Stroke
              </button>
              <button
                className={`draw-glass-button ${eraserMode === "point" ? "active-tool" : ""}`}
                type="button"
                onClick={() => setEraserMode("point")}
              >
                Point
              </button>
            </div>
          )}

          <div className="draw-compact-row smoothing-row" aria-label="Stroke smoothing">
            {smoothingOptions.map((option) => (
              <button
                key={option.id}
                className={`draw-glass-button ${smoothingMode === option.id ? "active-tool" : ""}`}
                type="button"
                onClick={() => setSmoothingMode(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="draw-compact-row ink-effect-row" aria-label="Ink effect">
            <button
              className={`draw-glass-button ${inkEffect === "dramaticPooling" ? "active-tool" : ""}`}
              type="button"
              onClick={() =>
                setInkEffect((current) => (current === "dramaticPooling" ? "none" : "dramaticPooling"))
              }
            >
              Dramatic ink
            </button>
          </div>

          <div className="draw-compact-row view-row" aria-label="Canvas view">
            <button className="draw-glass-button" type="button" onClick={() => handleZoom(-0.15)}>
              Zoom -
            </button>
            <button className="draw-glass-button" type="button" onClick={handleResetView}>
              {Math.round(viewScale * 100)}%
            </button>
            <button className="draw-glass-button" type="button" onClick={() => handleZoom(0.15)}>
              Zoom +
            </button>
            <button
              className={`draw-glass-button ${showGuides ? "active-tool" : ""}`}
              type="button"
              onClick={() => setShowGuides((current) => !current)}
            >
              Guides
            </button>
          </div>

          {selectedStrokeId && (
            <button className="draw-glass-button danger-action" type="button" onClick={handleDeleteSelectedStroke}>
              Delete stroke
            </button>
          )}

          <div className="draw-brush-ink-row">
            <label className="draw-brush-control">
              <span>Brush</span>
              <input
                type="range"
                min="3"
                max="28"
                value={brushSize}
                onChange={(event) => setBrushSize(Number(event.target.value))}
              />
              <output>{brushSize}px</output>
            </label>

            <InkColorControl inkColor={inkColor} onInkColorChange={setInkColor} />
          </div>

          <div className="draw-save-row">
            <button className="draw-glass-button" type="button" onClick={handleSave}>
              Save
            </button>
            <button className="draw-gold-button" type="button" onClick={handleSaveAndNext}>
              Save + next
            </button>
          </div>
        </div>

        <div className="draw-save-status" aria-live="polite">
          {savedMessage}
        </div>
      </section>
    );
  }

  if (isFullScreen && fullScreenPage === "adjust") {
    return (
      <section className="studio-panel editor-panel fullscreen-editor fullscreen-adjust-page" aria-label="Glyph adjustments">
        <div className="panel-heading adjust-page-heading">
          <div>
            <p className="eyebrow">Adjust glyph</p>
            <h2>{characterLabel}</h2>
          </div>
          <div className="editor-heading-actions">
            <button className="secondary-button compact-button" type="button" onClick={() => setFullScreenPage("draw")}>
              Draw
            </button>
            <button className="secondary-button compact-button" type="button" onClick={onToggleFullScreen}>
              Exit
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
              {characterIndex + 1} / {characterTotal}
            </span>
          </div>
          <button className="secondary-button" type="button" onClick={onNextCharacter}>
            Next
          </button>
        </div>

        <EditorLivePreview
          font={font}
          draftGlyph={draftGlyph}
          previewText={previewText}
          onPreviewTextChange={onPreviewTextChange}
        />

        <div className="adjust-controls-page">
          {renderReferenceGlyphControl()}

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

          <div className="nudge-row" aria-label="Nudge glyph">
            <button className="secondary-button" type="button" onClick={() => handleNudge(0, -0.025, "up")}>
              Nudge up
            </button>
            <button className="secondary-button" type="button" onClick={() => handleNudge(-0.025, 0, "left")}>
              Nudge left
            </button>
            <button className="secondary-button" type="button" onClick={() => handleNudge(0.025, 0, "right")}>
              Nudge right
            </button>
            <button className="secondary-button" type="button" onClick={() => handleNudge(0, 0.025, "down")}>
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

        <div className="save-status" aria-live="polite">
          {savedMessage}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`studio-panel editor-panel ${isFullScreen ? "fullscreen-editor" : ""}`}
      aria-label="Glyph editor"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Glyph editor</p>
          <h2>{characterLabel}</h2>
        </div>
        <div className="editor-heading-actions">
          <div className="glyph-pill">{draftGlyph.strokes.length} strokes</div>
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
            {characterIndex + 1} / {characterTotal}
          </span>
        </div>
        <button className="secondary-button" type="button" onClick={onNextCharacter}>
          Next
        </button>
      </div>

      <GlyphCanvas
        strokes={draftGlyph.strokes}
        decorations={draftGlyph.decorations}
        brushSize={brushSize}
        eyeExpression={eyeExpression}
        eraserMode={eraserMode}
        inkEffect={inkEffect}
        inkColor={inkColor}
        referenceGlyph={referenceGlyph}
        renderProfile={font.renderProfile}
        selectedStrokeId={selectedStrokeId}
        showGuides={showGuides}
        smoothingMode={smoothingMode}
        tool={tool}
        viewOffset={viewOffset}
        viewScale={viewScale}
        onEditStart={pushHistory}
        onChangeViewOffset={setViewOffset}
        onChangeDecorations={updateDraftDecorations}
        onChangeStrokes={updateDraftStrokes}
        onSelectStroke={setSelectedStrokeId}
      />

      <EditorLivePreview
        font={font}
        draftGlyph={draftGlyph}
        previewText={previewText}
        onPreviewTextChange={onPreviewTextChange}
      />

      <div className="quick-save-row" aria-label="Primary glyph actions">
        <button className="secondary-button" type="button" onClick={handleSave}>
          Save
        </button>
        <button className="primary-button" type="button" onClick={handleSaveAndNext}>
          Save and next
        </button>
      </div>

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
            className={`secondary-button ${tool === "eyes" ? "active-tool" : ""}`}
            type="button"
            onClick={() => chooseTool("eyes")}
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

        {tool === "eyes" && (
          <EyeExpressionControl expression={eyeExpression} onExpressionChange={setEyeExpression} />
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
              onClick={() => setSmoothingMode(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="engine-option-row" aria-label="Ink effect">
          <button
            className={`secondary-button ${inkEffect === "dramaticPooling" ? "active-tool" : ""}`}
            type="button"
            onClick={() =>
              setInkEffect((current) => (current === "dramaticPooling" ? "none" : "dramaticPooling"))
            }
          >
            Dramatic ink
          </button>
        </div>

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
            onChange={(event) => setBrushSize(Number(event.target.value))}
          />
          <output>{brushSize}px</output>
        </label>

        <InkColorControl inkColor={inkColor} onInkColorChange={setInkColor} />

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

        <div className="nudge-row" aria-label="Nudge glyph">
          <button className="secondary-button" type="button" onClick={() => handleNudge(0, -0.025, "up")}>
            Nudge up
          </button>
          <button className="secondary-button" type="button" onClick={() => handleNudge(-0.025, 0, "left")}>
            Nudge left
          </button>
          <button className="secondary-button" type="button" onClick={() => handleNudge(0.025, 0, "right")}>
            Nudge right
          </button>
          <button className="secondary-button" type="button" onClick={() => handleNudge(0, 0.025, "down")}>
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

      <div className="save-status" aria-live="polite">
        {savedMessage}
      </div>
    </section>
  );
}
