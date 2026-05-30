import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  drawGlyph,
  findPreviewGlyph,
  getFontHeightScale,
  getFontWidthScale,
  getGlyphAdvance,
  getGlyphLeftBearingOffset,
  getGlyphRenderScales,
  getGlyphTopForBaseline,
} from "../render/glyphRenderer";
import { defaultFontCharacterSettings, defaultFontGuideSettings, exportFontSet } from "../storage/fontStorage";
import type { FontCharacterSettings, FontGuideSettings, FontRenderProfile, FontSet } from "../types/fontTypes";

type FontLibraryProps = {
  fonts: FontSet[];
  activeFontId: string;
  onSelectFont: (fontId: string) => void;
  onCreateFont: (
    name: string,
    renderProfile: FontRenderProfile,
    characterSettings: FontCharacterSettings,
    guideSettings: FontGuideSettings,
  ) => void;
  onRenameFont: (fontId: string, name: string) => void;
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

    for (const character of font.name) {
      const glyph = findPreviewGlyph(font.glyphs, character);

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

function downloadFontJson(font: FontSet) {
  const blob = new Blob([exportFontSet(font)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `${sanitizeFileName(font.name)}.font-studio.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type GuideKey = keyof FontGuideSettings;

const guideRows: Array<{
  color: string;
  key: GuideKey;
  label: string;
}> = [
  { key: "ascender", label: "Ascender", color: "rgba(41, 128, 145, 0.86)" },
  { key: "xHeight", label: "Height", color: "rgba(181, 132, 42, 0.9)" },
  { key: "baseline", label: "Baseline", color: "rgba(35, 112, 76, 0.92)" },
  { key: "descender", label: "Descender", color: "rgba(133, 58, 57, 0.86)" },
];

function clampGuideValue(settings: FontGuideSettings, key: GuideKey, value: number): FontGuideSettings {
  const next = {
    ...settings,
    [key]: Math.min(0.98, Math.max(0.04, value)),
  };

  if (key === "ascender") {
    next.ascender = Math.min(next.xHeight - 0.04, Math.max(0.04, next.ascender));
  }

  if (key === "xHeight") {
    next.xHeight = Math.min(next.baseline - 0.04, Math.max(next.ascender + 0.04, next.xHeight));
  }

  if (key === "baseline") {
    next.baseline = Math.min(next.descender - 0.04, Math.max(next.xHeight + 0.04, next.baseline));
  }

  if (key === "descender") {
    next.descender = Math.min(0.98, Math.max(next.baseline + 0.04, next.descender));
  }

  return {
    ascender: Number(next.ascender.toFixed(2)),
    baseline: Number(next.baseline.toFixed(2)),
    descender: Number(next.descender.toFixed(2)),
    xHeight: Number(next.xHeight.toFixed(2)),
  };
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
  const activeGuideRef = useRef<GuideKey | null>(null);

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

    ctx.strokeStyle = "rgba(23, 17, 11, 0.18)";
    ctx.lineWidth = 2;
    for (const x of [0.1, 0.9]) {
      const px = x * size;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size);
      ctx.stroke();
    }

    ctx.font = "900 18px Inter, ui-sans-serif, system-ui";
    ctx.textBaseline = "middle";

    for (const guide of guideRows) {
      const y = settings[guide.key] * size;
      ctx.strokeStyle = guide.color;
      ctx.fillStyle = guide.color;
      ctx.lineWidth = guide.key === "baseline" ? 4 : 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(size - 42, y, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillText(guide.label, 18, Math.max(24, y - 18));
    }
  }, [settings]);

  function getPointerY(event: ReactPointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return Math.min(0.98, Math.max(0.04, (event.clientY - rect.top) / rect.height));
  }

  function findNearestGuide(y: number) {
    return guideRows.reduce((nearest, guide) => {
      const distance = Math.abs(settings[guide.key] - y);
      return distance < nearest.distance ? { distance, key: guide.key } : nearest;
    }, {
      distance: Number.POSITIVE_INFINITY,
      key: "baseline" as GuideKey,
    }).key;
  }

  function updateGuide(key: GuideKey, value: number) {
    onChange(clampGuideValue(settings, key, value));
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const y = getPointerY(event);
    const guideKey = findNearestGuide(y);
    activeGuideRef.current = guideKey;
    event.currentTarget.setPointerCapture(event.pointerId);
    updateGuide(guideKey, y);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!activeGuideRef.current) {
      return;
    }

    updateGuide(activeGuideRef.current, getPointerY(event));
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
            {guideRows.map((guide) => (
              <label key={guide.key} className="font-guide-control">
                <span>
                  {guide.label}
                  <output>{Math.round(settings[guide.key] * 100)}%</output>
                </span>
                <input
                  type="range"
                  min="0.04"
                  max="0.98"
                  step="0.01"
                  value={settings[guide.key]}
                  onChange={(event) => updateGuide(guide.key, Number(event.target.value))}
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
  onRenameFont,
  onDuplicateFont,
  onDeleteFont,
  getSavedGlyphCount,
}: FontLibraryProps) {
  const activeFont = fonts.find((font) => font.id === activeFontId) ?? fonts[0];
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [advancedSettingsOpen, setAdvancedSettingsOpen] = useState(false);
  const [newFontCharacterSettings, setNewFontCharacterSettings] = useState<FontCharacterSettings>({
    ...defaultFontCharacterSettings,
  });
  const [guideEditorOpen, setGuideEditorOpen] = useState(false);
  const [newFontGuideSettings, setNewFontGuideSettings] = useState<FontGuideSettings>({
    ...defaultFontGuideSettings,
  });
  const [newFontName, setNewFontName] = useState("");
  const [newFontProfile, setNewFontProfile] = useState<FontRenderProfile>("plain");
  const [renameValue, setRenameValue] = useState(activeFont.name);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setRenameValue(activeFont.name);
    setSettingsOpen(false);
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
    onCreateFont(name, newFontProfile, newFontCharacterSettings, newFontGuideSettings);
    setNewFontName("");
    setNewFontProfile("plain");
    setAdvancedSettingsOpen(false);
    setNewFontCharacterSettings({ ...defaultFontCharacterSettings });
    setNewFontGuideSettings({ ...defaultFontGuideSettings });
    setGuideEditorOpen(false);
    setCreateFormOpen(false);
  }

  function updateNewFontCharacterSetting(key: keyof FontCharacterSettings, value: boolean) {
    setNewFontCharacterSettings((current) => ({
      ...current,
      [key]: value,
    }));
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
                      onClick={() => {
                        downloadFontJson(activeFont);
                        setSettingsOpen(false);
                      }}
                    >
                      Export JSON
                    </button>
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
                <div className="font-guide-summary">
                  <span>Height {Math.round(newFontGuideSettings.xHeight * 100)}%</span>
                  <span>Baseline {Math.round(newFontGuideSettings.baseline * 100)}%</span>
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

    </section>
  );
}
