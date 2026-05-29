import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import FontLibrary from "./components/FontLibrary";
import GlyphEditor from "./components/GlyphEditor";
import GlyphGrid from "./components/GlyphGrid";
import TextPreview from "./components/TextPreview";
import { supportedCharacters } from "./data/characterSets";
import { hasDrawnGlyph } from "./render/glyphRenderer";
import {
  createEmptyGlyph,
  createFontSet,
  createId,
  loadFontStudioData,
  saveFontStudioData,
} from "./storage/fontStorage";
import type { FontSet, FontStudioData, Glyph } from "./types/fontTypes";

function cloneFontSet(font: FontSet, name: string): FontSet {
  const now = new Date().toISOString();

  return {
    ...font,
    id: createId("font"),
    name,
    glyphs: Object.fromEntries(
      Object.entries(font.glyphs).map(([character, glyph]) => [
        character,
        {
          ...glyph,
          decorations: (glyph.decorations ?? []).map((decoration) => ({
            ...decoration,
            id: createId("decoration"),
          })),
          strokes: glyph.strokes.map((stroke) => ({
            ...stroke,
            id: createId("stroke"),
            points: stroke.points.map((point) => ({ ...point })),
          })),
        },
      ]),
    ),
    createdAt: now,
    updatedAt: now,
  };
}

export default function App() {
  const libraryRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [studioData, setStudioData] = useState<FontStudioData>(() => {
    const data = loadFontStudioData();
    saveFontStudioData(data);
    return data;
  });
  const [selectedCharacter, setSelectedCharacter] = useState("A");
  const [editorFullScreen, setEditorFullScreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewText, setPreviewText] = useState("Draw and save A, then type A here.");

  const activeFont = useMemo(
    () =>
      studioData.fonts.find((font) => font.id === studioData.activeFontId) ??
      studioData.fonts[0],
    [studioData],
  );

  const selectedGlyph = activeFont.glyphs[selectedCharacter] ?? createEmptyGlyph(selectedCharacter);
  const selectedCharacterIndex = supportedCharacters.indexOf(selectedCharacter);

  function getSavedGlyphCount(font: FontSet) {
    return Object.values(font.glyphs).filter((glyph) => hasDrawnGlyph(glyph)).length;
  }

  const savedGlyphCount = getSavedGlyphCount(activeFont);

  function persist(nextData: FontStudioData) {
    setStudioData(nextData);
    saveFontStudioData(nextData);
  }

  function handleSelectCharacter(character: string) {
    setSelectedCharacter(character);

    window.setTimeout(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function selectCharacterByOffset(offset: number) {
    const currentIndex = Math.max(0, selectedCharacterIndex);
    const nextIndex = (currentIndex + offset + supportedCharacters.length) % supportedCharacters.length;
    setSelectedCharacter(supportedCharacters[nextIndex]);
  }

  function jumpToSection(ref: RefObject<HTMLDivElement | null>) {
    setSidebarOpen(false);

    window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function handleSelectFont(fontId: string) {
    persist({
      ...studioData,
      activeFontId: fontId,
    });
  }

  function handleCreateFont(name: string) {
    const font = createFontSet(name);

    persist({
      ...studioData,
      activeFontId: font.id,
      fonts: [...studioData.fonts, font],
    });
  }

  function handleRenameFont(fontId: string, name: string) {
    const now = new Date().toISOString();

    persist({
      ...studioData,
      fonts: studioData.fonts.map((font) =>
        font.id === fontId
          ? {
              ...font,
              name,
              updatedAt: now,
            }
          : font,
      ),
    });
  }

  function handleDuplicateFont(fontId: string) {
    const sourceFont = studioData.fonts.find((font) => font.id === fontId);

    if (!sourceFont) {
      return;
    }

    const copy = cloneFontSet(sourceFont, `${sourceFont.name} Copy`);

    persist({
      ...studioData,
      activeFontId: copy.id,
      fonts: [...studioData.fonts, copy],
    });
  }

  function handleDeleteFont(fontId: string) {
    if (studioData.fonts.length <= 1) {
      return;
    }

    const font = studioData.fonts.find((item) => item.id === fontId);
    const confirmed = window.confirm(`Delete "${font?.name ?? "this font"}"?`);

    if (!confirmed) {
      return;
    }

    const remainingFonts = studioData.fonts.filter((item) => item.id !== fontId);
    const activeFontId = studioData.activeFontId === fontId
      ? remainingFonts[0].id
      : studioData.activeFontId;

    persist({
      ...studioData,
      activeFontId,
      fonts: remainingFonts,
    });
  }

  function handleSaveGlyph(glyph: Glyph) {
    const now = new Date().toISOString();
    const nextData: FontStudioData = {
      ...studioData,
      fonts: studioData.fonts.map((font) =>
        font.id === activeFont.id
          ? {
              ...font,
              glyphs: {
                ...font.glyphs,
                [glyph.character]: glyph,
              },
              updatedAt: now,
            }
          : font,
      ),
    };

    persist(nextData);
  }

  return (
    <main className="app-shell">
      <button
        className="menu-toggle"
        type="button"
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((current) => !current)}
      >
        <span />
        <span />
        <span />
      </button>

      <div
        className={`sidebar-backdrop ${sidebarOpen ? "open" : ""}`}
        aria-hidden="true"
        onClick={() => setSidebarOpen(false)}
      />

      <aside className={`sidebar-menu ${sidebarOpen ? "open" : ""}`} aria-label="App menu">
        <div className="sidebar-heading">
          <div>
            <p className="eyebrow">Menu</p>
            <h2>Font Studio</h2>
          </div>
          <button className="secondary-button compact-button" type="button" onClick={() => setSidebarOpen(false)}>
            Close
          </button>
        </div>

        <div className="sidebar-status">
          <span>{activeFont.name}</span>
          <strong>
            {savedGlyphCount}/{supportedCharacters.length} glyphs
          </strong>
        </div>

        <nav className="sidebar-nav">
          <button type="button" onClick={() => jumpToSection(libraryRef)}>
            Font library
          </button>
          <button type="button" onClick={() => jumpToSection(gridRef)}>
            Glyph grid
          </button>
          <button type="button" onClick={() => jumpToSection(previewRef)}>
            Phone image
          </button>
          <button type="button" onClick={() => jumpToSection(editorRef)}>
            Glyph editor
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setEditorFullScreen(true);
            }}
          >
            Full-screen draw
          </button>
        </nav>
      </aside>

      <header className="app-header">
        <div>
          <p className="eyebrow">Standalone local app</p>
          <h1>Local Font Studio</h1>
          <p className="header-copy">
            Draw glyphs, save strokes in this browser, and preview your custom hand.
          </p>
        </div>

        <div className="font-badge" aria-label="Current font set">
          <span>{activeFont.name}</span>
          <strong>
            {savedGlyphCount}/{supportedCharacters.length}
          </strong>
        </div>
      </header>

      <div className="workspace">
        <div className="left-stack">
          <div ref={libraryRef}>
            <FontLibrary
              fonts={studioData.fonts}
              activeFontId={studioData.activeFontId}
              onSelectFont={handleSelectFont}
              onCreateFont={handleCreateFont}
              onRenameFont={handleRenameFont}
              onDuplicateFont={handleDuplicateFont}
              onDeleteFont={handleDeleteFont}
              getSavedGlyphCount={getSavedGlyphCount}
            />
          </div>
          <div ref={gridRef}>
            <GlyphGrid
              font={activeFont}
              selectedCharacter={selectedCharacter}
              onSelectCharacter={handleSelectCharacter}
            />
          </div>
          <div ref={previewRef}>
            <TextPreview
              font={activeFont}
              previewText={previewText}
              onPreviewTextChange={setPreviewText}
            />
          </div>
        </div>

        <div ref={editorRef}>
          <GlyphEditor
            key={activeFont.id}
            font={activeFont}
            glyph={selectedGlyph}
            onSaveGlyph={handleSaveGlyph}
            previewText={previewText}
            onPreviewTextChange={setPreviewText}
            characterIndex={Math.max(0, selectedCharacterIndex)}
            characterTotal={supportedCharacters.length}
            onPreviousCharacter={() => selectCharacterByOffset(-1)}
            onNextCharacter={() => selectCharacterByOffset(1)}
            isFullScreen={editorFullScreen}
            onToggleFullScreen={() => setEditorFullScreen((current) => !current)}
          />
        </div>
      </div>
    </main>
  );
}
