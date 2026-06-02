import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  drawGlyph,
  getFontHeightScale,
  getFontWidthScale,
  getGlyphAdvance,
  getGlyphLeftBearingOffset,
  getGlyphRenderScales,
  getGlyphTopForBaseline,
  selectPreviewGlyph,
} from "../render/glyphRenderer";
import {
  defaultFontCharacterSettings,
  defaultFontGuideSettings,
  defaultFontShapeSettings,
  exportFontSet,
} from "../storage/fontStorage";
import type {
  FontCharacterSettings,
  FontGuideSettings,
  FontRenderProfile,
  FontSet,
  FontShapeSettings,
  FontTheme,
} from "../types/fontTypes";
import { clampFontGuideSettings, fontGuideRows } from "../utils/fontGuides";
import type { FontGuideKey } from "../utils/fontGuides";
import { isNativeFilePlatform, saveNativeFileToDocuments, shareNativeFile } from "../utils/nativeFiles";

type FontLibraryProps = {
  fonts: FontSet[];
  activeFontId: string;
  onSelectFont: (fontId: string) => void;
  onCreateFont: (
    name: string,
    renderProfile: FontRenderProfile,
    characterSettings: FontCharacterSettings,
    guideSettings: FontGuideSettings,
    shapeSettings: FontShapeSettings,
  ) => void;
  onStartDrawing: () => void;
  onRenameFont: (fontId: string, name: string) => void;
  onUpdateFontSettings: (
    fontId: string,
    settings: {
      characterSettings?: FontCharacterSettings;
      guideSettings?: FontGuideSettings;
      shapeSettings?: FontShapeSettings;
      theme?: FontTheme;
    },
  ) => void;
  onDuplicateFont: (fontId: string) => void;
  onDeleteFont: (fontId: string) => void;
  getSavedGlyphCount: (font: FontSet) => number;
};

function FontNamePreview({ font }: { font: FontSet }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const width = 260;
    const height = 52;
    const fontSize = 27;
    const paddingX = 6;
    const ctx = canvas.getContext("2d");

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = "100%";
    canvas.style.height = `${height}px`;

    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (font.renderProfile === "quillParchment") {
      ctx.fillStyle = font.theme?.backgroundColor ?? "#efe0bd";
      ctx.fillRect(0, 0, width, height);
    }
    ctx.font = `900 ${fontSize}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    const previewColor = font.renderProfile === "quillParchment" ? font.theme?.inkColor ?? "#2a160d" : "#fff4df";
    const fontHeightScale = getFontHeightScale(font);
    const fontWidthScale = getFontWidthScale(font);
    ctx.fillStyle = previewColor;

    let x = paddingX;

    for (const [characterIndex, character] of [...font.name].entries()) {
      const glyph = selectPreviewGlyph(font.glyphs, character, `${font.id}|${font.name}|${characterIndex}|${character}`);

      if (glyph) {
        const scales = getGlyphRenderScales(font, glyph);
        const scaledBaselineY = 11 + fontSize * 0.76 * fontHeightScale;
        const glyphX = x + getGlyphLeftBearingOffset(font, glyph, fontSize);
        const glyphY = getGlyphTopForBaseline(glyph, fontSize, scaledBaselineY, scales.heightScale);

        drawGlyph(ctx, glyph, {
          x: glyphX,
          y: glyphY,
          size: fontSize,
          color: previewColor,
          renderProfile: font.renderProfile,
          heightScale: scales.heightScale,
          widthScale: scales.widthScale,
          backgroundTexture: font.theme?.backgroundTexture,
        });
        x += getGlyphAdvance(glyph, fontSize, fontWidthScale);
      } else if (character === " ") {
        x += fontSize * 0.36;
      } else {
        ctx.fillText(character, x, 11);
        x += ctx.measureText(character).width;
      }

      if (x > width - 18) {
        break;
      }
    }
  }, [font]);

  return <canvas ref={canvasRef} className="font-name-preview" aria-hidden="true" />;
}

function sanitizeFileName(value: string) {
  return value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "font";
}

async function downloadFontJson(font: FontSet) {
  const fileName = `${sanitizeFileName(font.name)}.font-studio.json`;
  const textData = exportFontSet(font);

  if (isNativeFilePlatform()) {
    await saveNativeFileToDocuments({
      fileName,
      textData,
    });
    await shareNativeFile({
      dialogTitle: "Export font JSON",
      fileName,
      textData,
      title: font.name,
    });
    return;
  }

  const blob = new Blob([textData], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function FontGuideEditor({
  settings,
  onChange,
  onClose,
  onReset,
}: {
  settings: FontGuideSettings;
  onChange: (settings: FontGuideSettings) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeGuideRef = useRef<FontGuideKey | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    const size = 720;
    const ctx = canvas.getContext("2d");

    canvas.width = size * dpr;
    canvas.height = size * dpr;

    if (!ctx) {
      return;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = "#f4ead7";
    ctx.fillRect(0, 0, size, size);
    ctx.strokeStyle = "rgba(23, 17, 11, 0.1)";
    ctx.lineWidth = 1;

    for (let index = 1; index < 12; index += 1) {
      const offset = (index / 12) * size;
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset, size);
      ctx.moveTo(0, offset);
      ctx.lineTo(size, offset);
      ctx.stroke();
    }

    const left = settings.leftBound * size;
    const right = settings.rightBound * size;
    const fullTop = settings.ascender * size;
    const fullBottom = settings.descender * size;
    const bodyTop = settings.xHeight * size;
    const bodyBottom = settings.baseline * size;

    ctx.fillStyle = "rgba(68, 85, 118, 0.08)";
    ctx.fillRect(left, fullTop, Math.max(1, right - left), Math.max(1, fullBottom - fullTop));
    ctx.fillStyle = "rgba(181, 132, 42, 0.11)";
    ctx.fillRect(left, bodyTop, Math.max(1, right - left), Math.max(1, bodyBottom - bodyTop));

    ctx.strokeStyle = "rgba(68, 85, 118, 0.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo((left + right) / 2, 0);
    ctx.lineTo((left + right) / 2, size);
    ctx.stroke();

    ctx.font = "900 18px Inter, ui-sans-serif, system-ui";
    ctx.textBaseline = "middle";

    for (const guide of fontGuideRows) {
      const offset = settings[guide.key] * size;
      ctx.strokeStyle = guide.color;
      ctx.fillStyle = guide.color;
      ctx.lineWidth = guide.key === "baseline" ? 4 : 3;
      ctx.beginPath();
      if (guide.axis === "x") {
        ctx.moveTo(offset, 0);
        ctx.lineTo(offset, size);
      } else {
        ctx.moveTo(0, offset);
        ctx.lineTo(size, offset);
      }
      ctx.stroke();
      ctx.beginPath();
      if (guide.axis === "x") {
        ctx.arc(offset, size - 42, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(guide.label, Math.min(size - 92, Math.max(18, offset - 28)), size - 70);
      } else {
        ctx.arc(size - 42, offset, 15, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillText(guide.label, 18, Math.max(24, offset - 18));
      }
    }
  }, [settings]);

  function getPointerPosition(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(0.98, Math.max(0.02, (event.clientX - rect.left) / rect.width)),
      y: Math.min(0.98, Math.max(0.02, (event.clientY - rect.top) / rect.height)),
    };
  }

  function findNearestGuide(point: { x: number; y: number }) {
    return fontGuideRows.reduce((nearest, guide) => {
      const distance = Math.abs(settings[guide.key] - (guide.axis === "x" ? point.x : point.y));
      return distance < nearest.distance ? { distance, key: guide.key } : nearest;
    }, {
      distance: Number.POSITIVE_INFINITY,
      key: "baseline" as FontGuideKey,
    }).key;
  }

  function updateGuide(key: FontGuideKey, point: { x: number; y: number }) {
    const guide = fontGuideRows.find((item) => item.key === key);
    onChange(clampFontGuideSettings(settings, key, guide?.axis === "x" ? point.x : point.y));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const point = getPointerPosition(event);
    const guideKey = findNearestGuide(point);
    activeGuideRef.current = guideKey;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateGuide(guideKey, point);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeGuideRef.current) {
      return;
    }

    updateGuide(activeGuideRef.current, getPointerPosition(event));
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activeGuideRef.current = null;
  }

  return (
    <section className="font-guide-overlay" aria-label="Drawing line setup">
      <div className="font-guide-card">
        <div className="font-guide-heading">
          <div>
            <p className="eyebrow">Advanced settings</p>
            <h2>Drawing lines</h2>
          </div>
          <button className="secondary-button compact-button" type="button" onClick={onClose}>
            Done
          </button>
        </div>

        <div className="font-guide-editor-layout">
          <canvas
            ref={canvasRef}
            className="font-guide-canvas"
            aria-label="Adjust drawing guide lines"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />

          <div className="font-guide-controls">
            {fontGuideRows.map((guide) => (
              <label key={guide.key} className="font-guide-control">
                <span>
                  {guide.label}
                  <output>{Math.round(settings[guide.key] * 100)}%</output>
                </span>
                <input
                  type="range"
                  min="0.02"
                  max="0.98"
                  step="0.01"
                  value={settings[guide.key]}
                  onChange={(event) =>
                    onChange(clampFontGuideSettings(settings, guide.key, Number(event.target.value)))
                  }
                />
              </label>
            ))}
            <button className="secondary-button compact-button" type="button" onClick={onReset}>
              Reset lines
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function FontLibrary({
  fonts,
  activeFontId,
  onSelectFont,
  onCreateFont,
  onStartDrawing,
  onRenameFont,
  onUpdateFontSettings,
  onDuplicateFont,
  onDeleteFont,
  getSavedGlyphCount,
}: FontLibraryProps) {
  const activeFont = fonts.find((font) => font.id === activeFontId) ?? fonts[0];
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [activeAdvancedSettingsOpen, setActiveAdvancedSettingsOpen] = useState(false);
  const [newFontCharacterSettings, setNewFontCharacterSettings] = useState<FontCharacterSettings>({
    ...defaultFontCharacterSettings,
  });
  const [guideEditorOpen, setGuideEditorOpen] = useState(false);
  const [activeGuideEditorOpen, setActiveGuideEditorOpen] = useState(false);
  const [newFontGuideSettings, setNewFontGuideSettings] = useState<FontGuideSettings>({
    ...defaultFontGuideSettings,
  });
  const [newFontShapeSettings, setNewFontShapeSettings] = useState<FontShapeSettings>({
    ...defaultFontShapeSettings,
  });
  const [newFontName, setNewFontName] = useState("");
  const [newFontProfile, setNewFontProfile] = useState<FontRenderProfile>("plain");
  const [renameValue, setRenameValue] = useState(activeFont.name);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRenameValue(activeFont.name);
    setSettingsOpen(false);
    setActiveAdvancedSettingsOpen(false);
    setActiveGuideEditorOpen(false);
  }, [activeFont.id, activeFont.name]);

  useEffect(() => {
    if (!settingsOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node) || settingsRef.current?.contains(target)) {
        return;
      }

      setSettingsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [settingsOpen]);

  function handleCreateFont() {
    const name = newFontName.trim() || (newFontProfile === "quillParchment" ? "Quill on Parchment" : `Font ${fonts.length + 1}`);
    onCreateFont(name, newFontProfile, newFontCharacterSettings, newFontGuideSettings, newFontShapeSettings);
    setNewFontName("");
    setNewFontProfile("plain");
    setAdvancedSettingsOpen(false);
    setNewFontCharacterSettings({ ...defaultFontCharacterSettings });
    setNewFontGuideSettings({ ...defaultFontGuideSettings });
    setNewFontShapeSettings({ ...defaultFontShapeSettings });
    setGuideEditorOpen(false);
    setCreateFormOpen(false);
  }

  function updateNewFontCharacterSetting(key: keyof FontCharacterSettings, value: boolean) {
    setNewFontCharacterSettings((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateNewFontShapeSetting(key: keyof FontShapeSettings, value: number) {
    setNewFontShapeSettings((current) => ({
      ...current,
      [key]: Number(value.toFixed(2)),
    }));
  }

  function updateActiveFontCharacterSetting(key: keyof FontCharacterSettings, value: boolean) {
    onUpdateFontSettings(activeFont.id, {
      characterSettings: {
        ...(activeFont.characterSettings ?? defaultFontCharacterSettings),
        [key]: value,
      },
    });
  }

  function updateActiveFontShapeSetting(key: keyof FontShapeSettings, value: number) {
    onUpdateFontSettings(activeFont.id, {
      shapeSettings: {
        ...(activeFont.shapeSettings ?? defaultFontShapeSettings),
        [key]: Number(value.toFixed(2)),
      },
    });
  }

  function handleRenameFont() {
    const name = renameValue.trim();

    if (name) {
      onRenameFont(activeFont.id, name);
    }
  }

  return (
    <section className="studio-panel library-panel" aria-label="Font library">
      <div className="font-list">
        {fonts.map((font) => (
          <div
            key={font.id}
            className={`font-row ${font.id === activeFontId ? "selected" : ""}`}
          >
            <button
              type="button"
              className="font-select-button"
              onClick={() => {
                onSelectFont(font.id);
                setRenameValue(font.name);
              }}
              aria-label={`Select ${font.name}`}
            >
              <FontNamePreview font={font} />
              <strong>{getSavedGlyphCount(font)} saved</strong>
            </button>
            {font.id === activeFontId && (
              <div className="font-settings-wrap" ref={settingsRef}>
                <button
                  className={`font-settings-button ${settingsOpen ? "active-tool" : ""}`}
                  type="button"
                  aria-label="Font settings"
                  aria-expanded={settingsOpen}
                  onClick={() => setSettingsOpen((current) => !current)}
                >
                  <span className="hamburger-lines" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </button>
                {settingsOpen && (
                  <div className="font-settings-menu" role="menu">
                    <label>
                      Rename
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                      />
                    </label>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        handleRenameFont();
                        setSettingsOpen(false);
                      }}
                    >
                      Rename
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => {
                        onDuplicateFont(activeFont.id);
                        setSettingsOpen(false);
                      }}
                    >
                      Duplicate
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={async () => {
                        try {
                          await downloadFontJson(activeFont);
                        } finally {
                          setSettingsOpen(false);
                        }
                      }}
                    >
                      Export JSON
                    </button>
                    <button
                      className="secondary-button"
                      type="button"
                      aria-expanded={activeAdvancedSettingsOpen}
                      onClick={() => setActiveAdvancedSettingsOpen((current) => !current)}
                    >
                      Advanced settings
                    </button>
                    {activeAdvancedSettingsOpen && (
                      <div className="advanced-font-options active-font-options">
                        <label className="font-option-check">
                          <input
                            type="checkbox"
                            checked={(activeFont.characterSettings ?? defaultFontCharacterSettings).showForgotten}
                            onChange={(event) => updateActiveFontCharacterSetting("showForgotten", event.target.checked)}
                          />
                          <span>Forgotten</span>
                        </label>
                        <label className="font-option-check">
                          <input
                            type="checkbox"
                            checked={(activeFont.characterSettings ?? defaultFontCharacterSettings).showHeaderLetters}
                            onChange={(event) => updateActiveFontCharacterSetting("showHeaderLetters", event.target.checked)}
                          />
                          <span>Header Letters</span>
                        </label>
                        <label className="font-option-check">
                          <input
                            type="checkbox"
                            checked={(activeFont.characterSettings ?? defaultFontCharacterSettings).showSpacebar}
                            onChange={(event) => updateActiveFontCharacterSetting("showSpacebar", event.target.checked)}
                          />
                          <span>Space Bar</span>
                        </label>
                        <label className="font-option-slider">
                          <span>
                            Height
                            <output>{(activeFont.shapeSettings ?? defaultFontShapeSettings).heightScale.toFixed(2)}x</output>
                          </span>
                          <input
                            type="range"
                            min="0.55"
                            max="1.6"
                            step="0.01"
                            value={(activeFont.shapeSettings ?? defaultFontShapeSettings).heightScale}
                            onChange={(event) => updateActiveFontShapeSetting("heightScale", Number(event.target.value))}
                          />
                        </label>
                        <label className="font-option-slider">
                          <span>
                            Width
                            <output>{(activeFont.shapeSettings ?? defaultFontShapeSettings).widthScale.toFixed(2)}x</output>
                          </span>
                          <input
                            type="range"
                            min="0.55"
                            max="1.6"
                            step="0.01"
                            value={(activeFont.shapeSettings ?? defaultFontShapeSettings).widthScale}
                            onChange={(event) => updateActiveFontShapeSetting("widthScale", Number(event.target.value))}
                          />
                        </label>
                        <button
                          className="secondary-button compact-button font-guide-launch"
                          type="button"
                          onClick={() => setActiveGuideEditorOpen(true)}
                        >
                          Adjust drawing lines
                        </button>
                        <div className="font-guide-summary">
                          <span>Height {Math.round(activeFont.guideSettings.xHeight * 100)}%</span>
                          <span>Baseline {Math.round(activeFont.guideSettings.baseline * 100)}%</span>
                          <span>Left {Math.round(activeFont.guideSettings.leftBound * 100)}%</span>
                          <span>Right {Math.round(activeFont.guideSettings.rightBound * 100)}%</span>
                        </div>
                      </div>
                    )}
                    <button
                      className="danger-button"
                      type="button"
                      disabled={fonts.length <= 1}
                      onClick={() => {
                        onDeleteFont(activeFont.id);
                        setSettingsOpen(false);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="library-actions">
        <button className="primary-button start-drawing-button" type="button" onClick={onStartDrawing}>
          Start drawing
        </button>
      </div>

      <form
        className={`library-form ${createFormOpen ? "expanded" : "collapsed"}`}
        onSubmit={(event) => {
          event.preventDefault();
          handleCreateFont();
        }}
      >
        {createFormOpen ? (
          <>
            <label>
              New font
              <input
                autoFocus
                placeholder="New hand name"
                value={newFontName}
                onChange={(event) => setNewFontName(event.target.value)}
              />
            </label>
            <div className="font-style-selector" aria-label="New font style">
              {([
                { id: "plain", label: "Pen" },
                { id: "quillParchment", label: "Quill" },
              ] as const).map((option) => (
                <button
                  key={option.id}
                  className={`secondary-button compact-button ${newFontProfile === option.id ? "active-tool" : ""}`}
                  type="button"
                  onClick={() => setNewFontProfile(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              className="secondary-button compact-button advanced-font-toggle"
              type="button"
              aria-expanded={advancedSettingsOpen}
              onClick={() => setAdvancedSettingsOpen((current) => !current)}
            >
              Advanced settings
            </button>
            {advancedSettingsOpen && (
              <div className="advanced-font-options">
                <label className="font-option-check">
                  <input
                    type="checkbox"
                    checked={newFontCharacterSettings.showForgotten}
                    onChange={(event) => updateNewFontCharacterSetting("showForgotten", event.target.checked)}
                  />
                  <span>Forgotten</span>
                </label>
                <label className="font-option-check">
                  <input
                    type="checkbox"
                    checked={newFontCharacterSettings.showHeaderLetters}
                    onChange={(event) => updateNewFontCharacterSetting("showHeaderLetters", event.target.checked)}
                  />
                  <span>Header Letters</span>
                </label>
                <label className="font-option-check">
                  <input
                    type="checkbox"
                    checked={newFontCharacterSettings.showSpacebar}
                    onChange={(event) => updateNewFontCharacterSetting("showSpacebar", event.target.checked)}
                  />
                  <span>Space Bar</span>
                </label>
                <button
                  className="secondary-button compact-button font-guide-launch"
                  type="button"
                  onClick={() => setGuideEditorOpen(true)}
                >
                  Adjust drawing lines
                </button>
                <label className="font-option-slider">
                  <span>
                    Height
                    <output>{newFontShapeSettings.heightScale.toFixed(2)}x</output>
                  </span>
                  <input
                    type="range"
                    min="0.55"
                    max="1.6"
                    step="0.01"
                    value={newFontShapeSettings.heightScale}
                    onChange={(event) => updateNewFontShapeSetting("heightScale", Number(event.target.value))}
                  />
                </label>
                <label className="font-option-slider">
                  <span>
                    Width
                    <output>{newFontShapeSettings.widthScale.toFixed(2)}x</output>
                  </span>
                  <input
                    type="range"
                    min="0.55"
                    max="1.6"
                    step="0.01"
                    value={newFontShapeSettings.widthScale}
                    onChange={(event) => updateNewFontShapeSetting("widthScale", Number(event.target.value))}
                  />
                </label>
                <div className="font-guide-summary">
                  <span>Height {Math.round(newFontGuideSettings.xHeight * 100)}%</span>
                  <span>Baseline {Math.round(newFontGuideSettings.baseline * 100)}%</span>
                  <span>Left {Math.round(newFontGuideSettings.leftBound * 100)}%</span>
                  <span>Right {Math.round(newFontGuideSettings.rightBound * 100)}%</span>
                </div>
              </div>
            )}
            <button className="primary-button" type="submit">
              Create
            </button>
          </>
        ) : (
          <button className="primary-button create-font-toggle" type="button" onClick={() => setCreateFormOpen(true)}>
            Create new font
          </button>
        )}
      </form>

      {guideEditorOpen && (
        <FontGuideEditor
          settings={newFontGuideSettings}
          onChange={setNewFontGuideSettings}
          onClose={() => setGuideEditorOpen(false)}
          onReset={() => setNewFontGuideSettings({ ...defaultFontGuideSettings })}
        />
      )}

      {activeGuideEditorOpen && (
        <FontGuideEditor
          settings={activeFont.guideSettings}
          onChange={(guideSettings) => onUpdateFontSettings(activeFont.id, { guideSettings })}
          onClose={() => setActiveGuideEditorOpen(false)}
          onReset={() => onUpdateFontSettings(activeFont.id, { guideSettings: { ...defaultFontGuideSettings } })}
        />
      )}

    </section>
  );
}
