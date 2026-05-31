import { useEffect, useMemo, useState } from "react";
import FontLibrary from "./components/FontLibrary";
import FontMetricsPanel from "./components/FontMetricsPanel";
import GlyphEditor from "./components/GlyphEditor";
import GlyphGrid from "./components/GlyphGrid";
import SavedImagesPanel from "./components/SavedImagesPanel";
import TextPreview from "./components/TextPreview";
import { getVisibleCharacters, spacebar } from "./data/characterSets";
import { hasDrawnGlyph } from "./render/glyphRenderer";
import {
  cloneFontSet,
  createEmptyGlyph,
  createFontSet,
  createId,
  loadFontStudioDataWithHealth,
  recordProjectActivity,
  saveFontStudioData,
} from "./storage/fontStorage";
import { loadSavedImages, saveSavedImages } from "./storage/savedImageStorage";
import type {
  FontCharacterSettings,
  FontGuideSettings,
  FontRenderProfile,
  FontShapeSettings,
  FontSet,
  FontStudioData,
  FontTheme,
  Glyph,
  ProjectActivityDraft,
  SavedImage,
  SavedImageDraft,
} from "./types/fontTypes";

export default function App() {
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
  const [savedImagesOpen, setSavedImagesOpen] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedImage[]>(() => loadSavedImages());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewText, setPreviewText] = useState("the ducks know about the blue canoe.");

  const activeFont = useMemo(
    () =>
      studioData.fonts.find((font) => font.id === studioData.activeFontId) ??
      studioData.fonts[0],
    [studioData],
  );

  const selectedGlyph = activeFont.glyphs[selectedCharacter] ?? createEmptyGlyph(selectedCharacter);
  const spacebarGlyph = activeFont.glyphs[spacebar] ?? createEmptyGlyph(spacebar);
  const activeCharacters = useMemo(() => getVisibleCharacters(activeFont), [activeFont]);
  const selectedCharacterIndex = activeCharacters.indexOf(selectedCharacter);

  function getSavedGlyphCount(font: FontSet) {
    return Object.values(font.glyphs).filter((glyph) => hasDrawnGlyph(glyph)).length;
  }

  useEffect(() => {
    document.body.classList.toggle("editor-fullscreen-open", editorFullScreen || gridFullScreen || savedImagesOpen);

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [editorFullScreen, gridFullScreen, savedImagesOpen]);

  useEffect(() => {
    if (!activeCharacters.includes(selectedCharacter)) {
      setSelectedCharacter(activeCharacters[0] ?? "A");
    }
  }, [activeCharacters, selectedCharacter]);

  function persist(nextData: FontStudioData, activity?: ProjectActivityDraft) {
    const dataWithActivity = activity ? recordProjectActivity(nextData, activity) : nextData;

    setStudioData(dataWithActivity);
    saveFontStudioData(dataWithActivity, { backupReason: activity?.type ?? "autosave" });
  }

  function persistSavedImages(nextImages: SavedImage[]) {
    saveSavedImages(nextImages);
    setSavedImages(nextImages);
  }

  function handleSelectCharacter(character: string) {
    setSelectedCharacter(character);
    setGridFullScreen(false);
    setEditorFullScreen(true);
  }

  function handleStartDrawing() {
    const firstMissingCharacter =
      activeCharacters.find((character) => !hasDrawnGlyph(activeFont.glyphs[character] ?? createEmptyGlyph(character))) ??
      activeCharacters[0] ??
      "A";

    setSelectedCharacter(firstMissingCharacter);
    setGridFullScreen(false);
    setSavedImagesOpen(false);
    setSidebarOpen(false);
    setEditorFullScreen(true);
  }

  function selectCharacterByOffset(offset: number) {
    const currentIndex = Math.max(0, selectedCharacterIndex);
    const nextIndex = (currentIndex + offset + activeCharacters.length) % activeCharacters.length;
    setSelectedCharacter(activeCharacters[nextIndex]);
  }

  function handleSelectFont(fontId: string) {
    persist({
      ...studioData,
      activeFontId: fontId,
    });
  }

  function handleCreateFont(
    name: string,
    renderProfile: FontRenderProfile = "plain",
    characterSettings?: FontCharacterSettings,
    guideSettings?: FontGuideSettings,
    shapeSettings?: FontShapeSettings,
  ) {
    const font = createFontSet(name, renderProfile, characterSettings, guideSettings, shapeSettings);

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

  function handleUpdateFontSettings(
    fontId: string,
    settings: {
      characterSettings?: FontCharacterSettings;
      guideSettings?: FontGuideSettings;
      shapeSettings?: FontShapeSettings;
      theme?: FontTheme;
    },
  ) {
    const now = new Date().toISOString();

    persist({
      ...studioData,
      fonts: studioData.fonts.map((font) =>
        font.id === fontId
          ? {
              ...font,
              ...settings,
              characterSettings: settings.characterSettings ?? font.characterSettings,
              guideSettings: settings.guideSettings ?? font.guideSettings,
              shapeSettings: settings.shapeSettings ?? font.shapeSettings,
              theme: settings.theme ?? font.theme,
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

  function handleSaveImage(image: SavedImageDraft) {
    const nextImage: SavedImage = {
      ...image,
      createdAt: new Date().toISOString(),
      id: createId("saved_image"),
    };
    const nextImages = [nextImage, ...savedImages].slice(0, 24);

    try {
      persistSavedImages(nextImages);
      return true;
    } catch {
      return false;
    }
  }

  function handleDeleteSavedImage(imageId: string) {
    persistSavedImages(savedImages.filter((image) => image.id !== imageId));
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
          <h2>Menu</h2>
        </div>

        <div id="preview-text-menu-slot" className="sidebar-preview-slot" />

        <nav className="sidebar-nav">
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setGridFullScreen(true);
            }}
          >
            Alphabet
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setSavedImagesOpen(true);
            }}
          >
            Saved Images
          </button>
          <button
            type="button"
            onClick={() => {
              setSidebarOpen(false);
              setEditorFullScreen(true);
            }}
          >
            Draw Letters
          </button>
        </nav>
      </aside>

      <header className="app-header">
        <h1>Font Studio</h1>
      </header>

      <div className="workspace">
        <div className="left-stack">
          <FontLibrary
            fonts={studioData.fonts}
            activeFontId={studioData.activeFontId}
            onSelectFont={handleSelectFont}
            onStartDrawing={handleStartDrawing}
            onCreateFont={handleCreateFont}
            onRenameFont={handleRenameFont}
            onUpdateFontSettings={handleUpdateFontSettings}
            onDuplicateFont={handleDuplicateFont}
            onDeleteFont={handleDeleteFont}
            getSavedGlyphCount={getSavedGlyphCount}
          />
          <TextPreview
            font={activeFont}
            onRecordExport={handleRecordPreviewExport}
            onSaveImage={handleSaveImage}
            onUpdateSelectedGlyph={handleSaveGlyph}
            previewText={previewText}
            onPreviewTextChange={setPreviewText}
            selectedGlyph={selectedGlyph}
            spacebarGlyph={spacebarGlyph}
          />
          <FontMetricsPanel
            font={activeFont}
            previewText={previewText}
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

      {savedImagesOpen && (
        <SavedImagesPanel
          images={savedImages}
          onClose={() => setSavedImagesOpen(false)}
          onDeleteImage={handleDeleteSavedImage}
        />
      )}

      {editorFullScreen && (
        <GlyphEditor
          key={activeFont.id}
          font={activeFont}
          glyph={selectedGlyph}
          onSaveGlyph={handleSaveGlyph}
          onUpdateFontTheme={(theme) => handleUpdateFontSettings(activeFont.id, { theme })}
          previewText={previewText}
          onPreviewTextChange={setPreviewText}
          characterIndex={Math.max(0, selectedCharacterIndex)}
          characterTotal={activeCharacters.length}
          onPreviousCharacter={() => selectCharacterByOffset(-1)}
          onNextCharacter={() => selectCharacterByOffset(1)}
          isFullScreen
          onToggleFullScreen={() => setEditorFullScreen(false)}
        />
      )}
    </main>
  );
}
