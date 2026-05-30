import { useEffect, useState } from "react";
import type { FontRenderProfile, FontSet } from "../types/fontTypes";

type FontLibraryProps = {
  fonts: FontSet[];
  activeFontId: string;
  onSelectFont: (fontId: string) => void;
  onCreateFont: (name: string, renderProfile: FontRenderProfile) => void;
  onRenameFont: (fontId: string, name: string) => void;
  onDuplicateFont: (fontId: string) => void;
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
  onDeleteFont,
  getSavedGlyphCount,
}: FontLibraryProps) {
  const activeFont = fonts.find((font) => font.id === activeFontId) ?? fonts[0];
  const [newFontName, setNewFontName] = useState("");
  const [newFontProfile, setNewFontProfile] = useState<FontRenderProfile>("plain");
  const [renameValue, setRenameValue] = useState(activeFont.name);

  useEffect(() => {
    setRenameValue(activeFont.name);
  }, [activeFont.id, activeFont.name]);

  function handleCreateFont() {
    const name = newFontName.trim() || (newFontProfile === "quillParchment" ? "Quill on Parchment" : `Font ${fonts.length + 1}`);
    onCreateFont(name, newFontProfile);
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
        <div className="font-style-selector" aria-label="New font style">
          {([
            { id: "plain", label: "Plain" },
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

    </section>
  );
}
