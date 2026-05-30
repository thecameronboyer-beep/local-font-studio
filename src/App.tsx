import { useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import FontLibrary from "./components/FontLibrary";
import FontMetricsPanel from "./components/FontMetricsPanel";
import GlyphEditor from "./components/GlyphEditor";
import GlyphGrid from "./components/GlyphGrid";
import TextPreview from "./components/TextPreview";
import { spacebar, supportedCharacters } from "./data/characterSets";
import { hasDrawnGlyph } from "./render/glyphRenderer";
import {
  cloneFontSet,
  createEmptyGlyph,
  createFontSet,
  loadFontStudioDataWithHealth,
  recordProjectActivity,
  saveFontStudioData,
} from "./storage/fontStorage";
import type { FontRenderProfile, FontSet, FontStudioData, Glyph, ProjectActivityDraft } from "./types/fontTypes";

export default function App() {
  const libraryRef = useRef<HTMLDivElement | null>(null);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [initialLoad] = useState(() => {
    const result = loadFontStudioDataWithHealth();
    saveFontStudioData(result.data, {
      backupReason: result.health.status === "migrated" ? "migration" : "autosave",
      createBackup: result.health.status === "migrated",
    });
    return result;
  });
  const [studioData, setStudioData] = useState<FontStudioData>(initialLoad.data);
  const [selectedCharacter, setSelectedCharacter] = useState("A");
  const [editorFullScreen, setEditorFullScreen] = useState(false);
  const [gridFullScreen, setGridFullScreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewText, setPreviewText] = useState("Draw and save A, then type A here.");

  const activeFont = useMemo(
    () =>
      studioData.fonts.find((font) => font.id === studioData.activeFontId) ??
      studioData.fonts[0],
    [studioData],
  );

  const selectedGlyph = activeFont.glyphs[selectedCharacter] ?? createEmptyGlyph(selectedCharacter);
  const spacebarGlyph = activeFont.glyphs[spacebar] ?? createEmptyGlyph(spacebar);
  const selectedCharacterIndex = supportedCharacters.indexOf(selectedCharacter);

  function getSavedGlyphCount(font: FontSet) {
    return Object.values(font.glyphs).filter((glyph) => hasDrawnGlyph(glyph)).length;
  }

  const savedGlyphCount = getSavedGlyphCount(activeFont);

  useEffect(() => {
    document.body.classList.toggle("editor-fullscreen-open", editorFullScreen || gridFullScreen);

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [editorFullScreen, gridFullScreen]);

  function persist(nextData: FontStudioData, activity?: ProjectActivityDraft) {
    const dataWithActivity = activity ? recordProjectActivity(nextData, activity) : nextData;

    setStudioData(dataWithActivity);
    saveFontStudioData(dataWithActivity, { backupReason: activity?.type ?? "autosave" });
  }

  function handleSelectCharacter(character: string) {
    setSelectedCharacter(character);
    setGridFullScreen(false);
    setEditorFullScreen(true);
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

  function handleCreateFont(name: string, renderProfile: FontRenderProfile = "plain") {
    const font = createFontSet(name, renderProfile);

    persist({
      ...studioData,
      activeFontId: font.id,
      fonts: [...studioData.fonts, font],
    }, {
      fontId: font.id,
      message: `Created ${renderProfile === "quillParchment" ? "quill" : "font"} "${font.name}".`,
      type: "font_create",
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
    }, {
      fontId,
      message: `Renamed font to "${name}".`,
      type: "font_rename",
    });
  }

  function handleDuplicateFont(fontId: string) {
    const sourceFont = studioData.fonts.find((font) => font.id === fontId);

    if (!sourceFont) {
      return;
    }

    const copy = cloneFontSet(sourceFont, studioData.fonts);

    persist({
      ...studioData,
      activeFontId: copy.id,
      fonts: [...studioData.fonts, copy],
    }, {
      details: { sourceFontId: sourceFont.id },
      fontId: copy.id,
      message: `Duplicated "${sourceFont.name}" as "${copy.name}".`,
      type: "font_duplicate",
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
    }, {
      fontId,
      message: `Deleted font "${font?.name ?? "Untitled"}".`,
      type: "font_delete",
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

    persist(nextData, {
      character: glyph.character,
      fontId: activeFont.id,
      message: `Saved glyph "${glyph.character}" in "${activeFont.name}".`,
      type: "glyph_edit",
    });
  }

  function handleRecordPreviewExport(message: string) {
    persist(studioData, {
      fontId: activeFont.id,
      message,
      type: "export",
    });
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
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setGridFullScreen(true);
            }}
          >
            Glyph grid
          </button>
          <button type="button" onClick={() => jumpToSection(previewRef)}>
            Phone image
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setEditorFullScreen(true);
            }}
          >
            Edit selected glyph
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
          <div ref={previewRef}>
            <TextPreview
              font={activeFont}
              onRecordExport={handleRecordPreviewExport}
              onUpdateSelectedGlyph={handleSaveGlyph}
              previewText={previewText}
              onPreviewTextChange={setPreviewText}
              selectedGlyph={selectedGlyph}
              spacebarGlyph={spacebarGlyph}
            />
          </div>
          <FontMetricsPanel
            font={activeFont}
            selectedCharacter={selectedCharacter}
            onSelectCharacter={handleSelectCharacter}
          />
        </div>
      </div>

      {gridFullScreen && (
        <GlyphGrid
          font={activeFont}
          selectedCharacter={selectedCharacter}
          onSelectCharacter={handleSelectCharacter}
          isFullScreen
          onClose={() => setGridFullScreen(false)}
        />
      )}

      {editorFullScreen && (
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
          isFullScreen
          onToggleFullScreen={() => setEditorFullScreen(false)}
        />
      )}
    </main>
  );
}
