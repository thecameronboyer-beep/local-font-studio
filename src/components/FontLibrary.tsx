import { useEffect, useState } from "react";
import type { FontSet } from "../types/fontTypes";

type FontLibraryProps = {
  fonts: FontSet[];
  activeFontId: string;
  onSelectFont: (fontId: string) => void;
  onCreateFont: (name: string) => void;
  onRenameFont: (fontId: string, name: string) => void;
  onDuplicateFont: (fontId: string) => void;
  onCreateAngryPreset: () => void;
  onDeleteFont: (fontId: string) => void;
  getSavedGlyphCount: (font: FontSet) => number;
};

export default function FontLibrary({
  fonts,
  activeFontId,
  onSelectFont,
  onCreateFont,
  onRenameFont,
  onDuplicateFont,
  onCreateAngryPreset,
  onDeleteFont,
  getSavedGlyphCount,
}: FontLibraryProps) {
  const activeFont = fonts.find((font) => font.id === activeFontId) ?? fonts[0];
  const [newFontName, setNewFontName] = useState("");
  const [renameValue, setRenameValue] = useState(activeFont.name);

  useEffect(() => {
    setRenameValue(activeFont.name);
  }, [activeFont.id, activeFont.name]);

  function handleCreateFont() {
    const name = newFontName.trim() || `Font ${fonts.length + 1}`;
    onCreateFont(name);
    setNewFontName("");
  }

  function handleRenameFont() {
    const name = renameValue.trim();

    if (name) {
      onRenameFont(activeFont.id, name);
    }
  }

  return (
    <section className="studio-panel library-panel" aria-label="Font library">
      <div className="panel-heading compact-heading">
        <div>
          <p className="eyebrow">Library</p>
          <h2>Font sets</h2>
        </div>
        <div className="glyph-pill">{fonts.length} total</div>
      </div>

      <div className="font-list">
        {fonts.map((font) => (
          <button
            key={font.id}
            type="button"
            className={`font-row ${font.id === activeFontId ? "selected" : ""}`}
            onClick={() => {
              onSelectFont(font.id);
              setRenameValue(font.name);
            }}
          >
            <span>{font.name}</span>
            <strong>{getSavedGlyphCount(font)} saved</strong>
          </button>
        ))}
      </div>

      <div className="library-form">
        <label>
          Rename active
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onBlur={handleRenameFont}
          />
        </label>
        <button className="secondary-button" type="button" onClick={handleRenameFont}>
          Rename
        </button>
      </div>

      <div className="library-form">
        <label>
          New font
          <input
            placeholder="New hand name"
            value={newFontName}
            onChange={(event) => setNewFontName(event.target.value)}
          />
        </label>
        <button className="primary-button" type="button" onClick={handleCreateFont}>
          Create
        </button>
      </div>

      <div className="library-actions">
        <button className="secondary-button" type="button" onClick={() => onDuplicateFont(activeFont.id)}>
          Duplicate
        </button>
        <button
          className="danger-button"
          type="button"
          disabled={fonts.length <= 1}
          onClick={() => onDeleteFont(activeFont.id)}
        >
          Delete
        </button>
      </div>

      <div className="preset-actions">
        <button className="rage-preset-button" type="button" onClick={onCreateAngryPreset}>
          Generate Angry Face preset
        </button>
      </div>
    </section>
  );
}
