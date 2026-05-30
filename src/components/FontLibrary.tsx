import { useEffect, useRef, useState } from "react";
import { drawGlyph, findPreviewGlyph, getGlyphAdvance } from "../render/glyphRenderer";
import { defaultFontCharacterSettings, exportFontSet } from "../storage/fontStorage";
import type { FontCharacterSettings, FontRenderProfile, FontSet } from "../types/fontTypes";

type FontLibraryProps = {
  fonts: FontSet[];
  activeFontId: string;
  onSelectFont: (fontId: string) => void;
  onCreateFont: (name: string, renderProfile: FontRenderProfile, characterSettings: FontCharacterSettings) => void;
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
    const baselineY = 37;
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
    ctx.fillStyle = previewColor;

    let x = paddingX;

    for (const character of font.name) {
      const glyph = findPreviewGlyph(font.glyphs, character);

      if (glyph) {
        const glyphX = x + glyph.leftBearing * fontSize;
        const glyphY = baselineY - glyph.baselineOffset * fontSize;

        drawGlyph(ctx, glyph, {
          x: glyphX,
          y: glyphY,
          size: fontSize,
          color: previewColor,
          renderProfile: font.renderProfile,
          widthScale: glyph.width,
        });
        x += getGlyphAdvance(glyph, fontSize);
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
    onCreateFont(name, newFontProfile, newFontCharacterSettings);
    setNewFontName("");
    setNewFontProfile("plain");
    setAdvancedSettingsOpen(false);
    setNewFontCharacterSettings({ ...defaultFontCharacterSettings });
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

    </section>
  );
}
