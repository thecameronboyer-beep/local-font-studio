import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { Check, Feather, Palette, X } from "lucide-react";
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
import { fontPresets, getFontPresetById, getFontPresetCanvasFont } from "../data/fontPresets";
import { fontPalettes, getDefaultFontPaletteTheme } from "../data/palettes";
import {
  defaultFontCharacterSettings,
  defaultFontGuideSettings,
  fontHomeSectionOptions,
  defaultFontWritingStyleSettings,
  defaultFontShapeSettings,
  exportFontSet,
  fontWritingStyleOptions,
} from "../storage/fontStorage";
import type {
  FontCharacterSettings,
  FontGuideSettings,
  FontHomeSectionId,
  FontHomeSettings,
  FontPaletteId,
  FontRenderProfile,
  FontSet,
  FontShapeSettings,
  FontTheme,
  FontWritingStyleId,
  FontWritingStyleSettings,
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
  onCreatePresetFont: (presetFontId: string) => void;
  onStartDrawing: () => void;
  onRenameFont: (fontId: string, name: string) => void;
  onUpdateFontSettings: (
    fontId: string,
    settings: {
      characterSettings?: FontCharacterSettings;
      guideSettings?: FontGuideSettings;
      homeSettings?: FontHomeSettings;
      shapeSettings?: FontShapeSettings;
      theme?: FontTheme;
      writingStyleSettings?: FontWritingStyleSettings;
    },
  ) => void;
  onDuplicateFont: (fontId: string) => void;
  onDeleteFont: (fontId: string) => void;
  getSavedGlyphCount: (font: FontSet) => number;
};

function FontNamePreview({
  font,
  variant = "full",
  showThemeBackground = true,
  color,
}: {
  font: FontSet;
  variant?: "full" | "compact";
  showThemeBackground?: boolean;
  color?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const previewCanvas = canvas;
    const isCompact = variant === "compact";
    const height = isCompact ? 34 : 52;
    const fontSize = isCompact ? 22 : 27;
    const paddingX = 6;
    const textTop = isCompact ? 6 : 12;
    const glyphTop = isCompact ? 6 : 11;
    const preset = getFontPresetById(font.presetFontId);
    previewCanvas.style.width = "100%";
    previewCanvas.style.height = `${height}px`;

    function drawPreview() {
      const ctx = previewCanvas.getContext("2d");

      if (!ctx) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(previewCanvas.getBoundingClientRect().width || 260));

      previewCanvas.width = width * dpr;
      previewCanvas.height = height * dpr;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (showThemeBackground && font.theme) {
        ctx.fillStyle = font.theme?.backgroundColor ?? "#efe0bd";
        ctx.fillRect(0, 0, width, height);
      }
      ctx.font = preset
        ? getFontPresetCanvasFont(preset, fontSize)
        : `900 ${fontSize}px Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textBaseline = "top";
      const previewColor = color ?? font.theme?.inkColor ?? "#fff4df";
      const fontHeightScale = getFontHeightScale(font);
      const fontWidthScale = getFontWidthScale(font);
      ctx.fillStyle = previewColor;

      if (preset) {
        ctx.fillText(font.name, paddingX, textTop);
        return;
      }

      let x = paddingX;

      for (const [characterIndex, character] of [...font.name].entries()) {
        const glyph = selectPreviewGlyph(font.glyphs, character, `${font.id}|${font.name}|${characterIndex}|${character}`);

        if (glyph) {
          const scales = getGlyphRenderScales(font, glyph);
          const scaledBaselineY = glyphTop + fontSize * 0.76 * fontHeightScale;
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

    const resizeObserver = new ResizeObserver(drawPreview);
    resizeObserver.observe(previewCanvas);

    if (preset && document.fonts) {
      document.fonts.load(getFontPresetCanvasFont(preset, fontSize)).finally(() => {
        if (!cancelled) {
          drawPreview();
        }
      });
    }

    return () => {
      cancelled = true;
      resizeObserver.disconnect();
    };
  }, [color, font, showThemeBackground, variant]);

  return (
    <canvas
      ref={canvasRef}
      className={`font-name-preview ${variant === "compact" ? "compact-font-name-preview" : ""}`}
      aria-hidden="true"
    />
  );
}

function getFontThemeRowStyle(font: FontSet) {
  if (!font.theme) {
    return undefined;
  }

  return {
    "--font-row-accent": font.theme.accentColor,
    "--font-row-bg": font.theme.backgroundColor,
    "--font-row-ink": font.theme.inkColor,
  } as React.CSSProperties;
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
            <p className="eyebrow">Font settings</p>
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
  onCreatePresetFont,
  onStartDrawing,
  onRenameFont,
  onUpdateFontSettings,
  onDuplicateFont,
  onDeleteFont,
  getSavedGlyphCount,
}: FontLibraryProps) {
  const activeFont = fonts.find((font) => font.id === activeFontId) ?? fonts[0];
  const [createFormOpen, setCreateFormOpen] = useState(false);
  const [newFontCharacterSettings, setNewFontCharacterSettings] = useState<FontCharacterSettings>({
    ...defaultFontCharacterSettings,
  });
  const [guideEditorOpen, setGuideEditorOpen] = useState(false);
  const [activeGuideEditorOpen, setActiveGuideEditorOpen] = useState(false);
  const [newFontGuideSettings, setNewFontGuideSettings] = useState<FontGuideSettings>({
    ...defaultFontGuideSettings,
  });
  const [newFontName, setNewFontName] = useState("");
  const [newFontProfile, setNewFontProfile] = useState<FontRenderProfile>("plain");
  const [editingFontId, setEditingFontId] = useState<string | null>(null);
  const [fontRenameValue, setFontRenameValue] = useState("");
  const [presetPickerOpen, setPresetPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    setSettingsOpen(false);
    setEditingFontId(null);
    setActiveGuideEditorOpen(false);
    setPresetPickerOpen(false);
  }, [activeFont.id, activeFont.name]);

  function handleCreateFont() {
    const name = newFontName.trim() || (newFontProfile === "quillParchment" ? "Quill on Parchment" : `Font ${fonts.length + 1}`);
    onCreateFont(name, newFontProfile, newFontCharacterSettings, newFontGuideSettings, defaultFontShapeSettings);
    setNewFontName("");
    setNewFontProfile("plain");
    setNewFontCharacterSettings({ ...defaultFontCharacterSettings });
    setNewFontGuideSettings({ ...defaultFontGuideSettings });
    setGuideEditorOpen(false);
    setCreateFormOpen(false);
    setPresetPickerOpen(false);
  }

  function updateNewFontCharacterSetting(key: keyof FontCharacterSettings, value: boolean) {
    setNewFontCharacterSettings((current) => ({
      ...current,
      [key]: value,
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

  function updateActiveHomeSection(sectionId: FontHomeSectionId, visible: boolean) {
    onUpdateFontSettings(activeFont.id, {
      homeSettings: {
        visibleSections: {
          ...activeFont.homeSettings.visibleSections,
          [sectionId]: visible,
        },
      },
    });
  }

  function updateActiveWritingStyle(styleId: FontWritingStyleId, enabled: boolean) {
    const currentSettings = activeFont.writingStyleSettings ?? defaultFontWritingStyleSettings;
    const enabledStyles = {
      ...currentSettings.enabledStyles,
      [styleId]: enabled,
    };

    if (!enabledStyles.draw && !enabledStyles.build) {
      return;
    }

    onUpdateFontSettings(activeFont.id, {
      writingStyleSettings: {
        enabledStyles,
      },
    });
  }

  function updateActivePalette(paletteId: FontPaletteId) {
    onUpdateFontSettings(activeFont.id, {
      theme: getDefaultFontPaletteTheme(paletteId),
    });
  }

  function beginRenameFont(font: FontSet) {
    setEditingFontId(font.id);
    setFontRenameValue(font.name);
  }

  function handleRenameFont(fontId: string) {
    const name = fontRenameValue.trim();

    if (name) {
      onRenameFont(fontId, name);
    }

    setEditingFontId(null);
  }

  function handleUsePresetFont(presetFontId: string) {
    onCreatePresetFont(presetFontId);
    setPresetPickerOpen(false);
    setCreateFormOpen(false);
    setSettingsOpen(false);
  }

  function renderPresetPicker() {
    if (!presetPickerOpen) {
      return null;
    }

    return (
      <div className="font-preset-picker" aria-label="Preset fonts">
        {fontPresets.map((preset) => (
          <button
            key={preset.id}
            className="font-preset-option"
            type="button"
            onClick={() => handleUsePresetFont(preset.id)}
          >
            <span style={{ fontFamily: `"${preset.family}", serif` }}>{preset.label}</span>
            <small>{preset.license}</small>
          </button>
        ))}
      </div>
    );
  }

  function renderCreateFontForm(className = "library-form settings-create-font-form") {
    return (
      <form
        className={`${className} ${createFormOpen ? "expanded" : "collapsed"}`}
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
            <div className="advanced-font-options">
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
              <div className="font-guide-summary">
                <span>Height {Math.round(newFontGuideSettings.xHeight * 100)}%</span>
                <span>Baseline {Math.round(newFontGuideSettings.baseline * 100)}%</span>
                <span>Left {Math.round(newFontGuideSettings.leftBound * 100)}%</span>
                <span>Right {Math.round(newFontGuideSettings.rightBound * 100)}%</span>
              </div>
            </div>
            <button className="primary-button" type="submit">
              Create
            </button>
          </>
        ) : (
          <div className="font-create-actions">
            <button
              className="primary-button create-font-toggle"
              type="button"
              onClick={() => {
                setCreateFormOpen(true);
                setPresetPickerOpen(false);
              }}
            >
              Create new font
            </button>
            <button
              className={`secondary-button create-font-toggle use-preset-toggle ${presetPickerOpen ? "active-tool" : ""}`}
              type="button"
              onClick={() => {
                setCreateFormOpen(false);
                setPresetPickerOpen((open) => !open);
              }}
            >
              Use preset
            </button>
          </div>
        )}
      </form>
    );
  }

  return (
    <section className="studio-panel library-panel font-profile-panel" aria-label="Font profile">
      <div className="font-list">
        <div className="font-row selected active-profile-row themed-font-row" style={getFontThemeRowStyle(activeFont)}>
          <button
            type="button"
            className="font-select-button active-font-preview-button"
            onClick={() => setSettingsOpen(true)}
            aria-label={`Open ${activeFont.name} font profile`}
          >
            <FontNamePreview font={activeFont} />
          </button>
        </div>
      </div>

      {settingsOpen && (
        <section className="font-profile-fullscreen" aria-label="Font profile">
          <div className="font-profile-fullscreen-heading">
            <div>
              <p className="eyebrow">Font profile</p>
              <h2>{activeFont.name}</h2>
            </div>
            <button className="secondary-button compact-button" type="button" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>

          <div className="font-settings-menu font-profile-fullscreen-menu" role="menu">
            <div className="font-settings-section">
              <strong>Change font</strong>
              <div className="settings-font-list">
                {fonts.map((font) => (
                  editingFontId === font.id ? (
                    <form
                      key={font.id}
                      className={`settings-font-option settings-font-rename-row ${
                        font.id === activeFontId ? "selected" : ""
                      }`}
                      onSubmit={(event) => {
                        event.preventDefault();
                        handleRenameFont(font.id);
                      }}
                    >
                      <input
                        autoFocus
                        aria-label={`Rename ${font.name}`}
                        value={fontRenameValue}
                        onChange={(event) => setFontRenameValue(event.target.value)}
                      />
                      <button className="font-rename-icon-button" type="submit" aria-label="Save font name">
                        <Check aria-hidden="true" />
                      </button>
                      <button
                        className="font-rename-icon-button"
                        type="button"
                        aria-label="Cancel rename"
                        onClick={() => setEditingFontId(null)}
                      >
                        <X aria-hidden="true" />
                      </button>
                    </form>
                  ) : (
                    <div
                      key={font.id}
                      className={`settings-font-option themed-font-row ${font.id === activeFontId ? "selected" : ""}`}
                      style={getFontThemeRowStyle(font)}
                    >
                      <button
                        className="settings-font-select-button"
                        type="button"
                        onClick={() => {
                          onSelectFont(font.id);
                          setSettingsOpen(false);
                        }}
                        aria-label={`Select ${font.name}`}
                      >
                        <FontNamePreview font={font} variant="compact" />
                      </button>
                      <button
                        className="settings-font-edit-button"
                        type="button"
                        aria-label={`Rename ${font.name}`}
                        onClick={() => beginRenameFont(font)}
                      >
                        <Feather aria-hidden="true" />
                      </button>
                    </div>
                  )
                ))}
              </div>
              {renderCreateFontForm()}
              {renderPresetPicker()}
            </div>
            <div className="font-settings-section">
              <strong>Writing style</strong>
              <div className="home-section-toggle-list">
                {fontWritingStyleOptions.map((option) => (
                  <label key={option.id} className="font-option-check">
                    <input
                      type="checkbox"
                      checked={(activeFont.writingStyleSettings ?? defaultFontWritingStyleSettings).enabledStyles[option.id]}
                      onChange={(event) => updateActiveWritingStyle(option.id, event.target.checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="font-settings-section">
              <strong>Palette</strong>
              <div className="font-palette-selector" aria-label="Font palette">
                {fontPalettes.map((palette) => {
                  const selected = activeFont.theme?.paletteId === palette.id;
                  const swatches = [...palette.main, ...palette.accents, palette.ink];

                  return (
                    <button
                      key={palette.id}
                      className={`font-palette-option ${selected ? "selected" : ""}`}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updateActivePalette(palette.id)}
                    >
                      <Palette aria-hidden="true" />
                      <span className="font-palette-copy">
                        <strong>{palette.label}</strong>
                        <span>{palette.ink.label} ink</span>
                      </span>
                      <span className="font-palette-swatches" aria-hidden="true">
                        {swatches.map((swatch) => (
                          <span key={`${palette.id}-${swatch.label}`} style={{ backgroundColor: swatch.color }} />
                        ))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="font-settings-section">
              <strong>Home screen</strong>
              <div className="home-section-toggle-list">
                {fontHomeSectionOptions.map((option) => (
                  <label key={option.id} className="font-option-check">
                    <input
                      type="checkbox"
                      checked={activeFont.homeSettings.visibleSections[option.id]}
                      onChange={(event) => updateActiveHomeSection(option.id, event.target.checked)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="font-settings-section">
              <strong>Characters</strong>
              <div className="advanced-font-options active-font-options">
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
            </div>
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
        </section>
      )}

      {activeFont.homeSettings.visibleSections.drawActions && (
        <div className="library-actions">
          <button className="primary-button start-drawing-button" type="button" onClick={onStartDrawing}>
            Start drawing
          </button>
        </div>
      )}

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
