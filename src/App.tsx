import { useEffect, useMemo, useState } from "react";
import FontLibrary from "./components/FontLibrary";
import FontMetricsPanel from "./components/FontMetricsPanel";
import GlyphEditor from "./components/GlyphEditor";
import GlyphGrid from "./components/GlyphGrid";
import SavedImagesPanel from "./components/SavedImagesPanel";
import TextPreview from "./components/TextPreview";
import { getVisibleCharacters, isHeaderLetter, spacebar } from "./data/characterSets";
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
  GlyphVariant,
  ProjectActivityDraft,
  SavedImage,
  SavedImageDraft,
} from "./types/fontTypes";

export default function App() {
  const [initialLoad] = useState(() => {
    const result = loadFontStudioDataWithHealth();
    try {
      saveFontStudioData(result.data, {
        backupReason: result.health.status === "migrated" ? "migration" : "autosave",
        createBackup: result.health.status === "migrated",
      });
    } catch (error) {
      console.warn("Unable to persist initial font studio data.", error);
    }
    return result;
  });
  const [studioData, setStudioData] = useState<FontStudioData>(initialLoad.data);
  const [selectedCharacter, setSelectedCharacter] = useState("A");
  const [editorFullScreen, setEditorFullScreen] = useState(false);
  const [gridFullScreen, setGridFullScreen] = useState(false);
  const [savedImagesOpen, setSavedImagesOpen] = useState(false);
  const [savedImages, setSavedImages] = useState<SavedImage[]>(() => loadSavedImages());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerPreviewText, setHeaderPreviewText] = useState("");
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
  const activeSavedGlyphCount = useMemo(() => getSavedGlyphCount(activeFont), [activeFont]);

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
    if (!activeCharacters.includes(selectedCharacter) && !isHeaderLetter(selectedCharacter)) {
      setSelectedCharacter(activeCharacters[0] ?? "A");
    }
  }, [activeCharacters, selectedCharacter]);

  function saveProjectData(data: FontStudioData, activity?: ProjectActivityDraft) {
    try {
      saveFontStudioData(data, { backupReason: activity?.type ?? "autosave" });
    } catch (error) {
      console.warn("Unable to persist font studio data.", error);
    }
  }

  function deferProjectSave(data: FontStudioData, activity?: ProjectActivityDraft) {
    window.setTimeout(() => saveProjectData(data, activity), 0);
  }

  function persist(nextData: FontStudioData, activity?: ProjectActivityDraft) {
    const dataWithActivity = activity ? recordProjectActivity(nextData, activity) : nextData;

    setStudioData(dataWithActivity);
    saveProjectData(dataWithActivity, activity);
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

  function handleOpenHome() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleOpenExport() {
    document.getElementById("preview-panel")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
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

  function mergeGlyphWithExistingVariants(font: FontSet, glyph: Glyph, updatedAt: string): Glyph {
    const existingGlyph = font.glyphs[glyph.character] ?? createEmptyGlyph(glyph.character);

    return {
      ...glyph,
      variants: glyph.variants ?? existingGlyph.variants ?? [],
      updatedAt,
    };
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
                [glyph.character]: mergeGlyphWithExistingVariants(font, glyph, now),
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

  function getNextCharacterAfterSave(savedGlyph: Glyph) {
    if (activeCharacters.length === 0) {
      return savedGlyph.character;
    }

    const currentIndex = Math.max(0, activeCharacters.indexOf(savedGlyph.character));
    const sequentialNext = activeCharacters[(currentIndex + 1) % activeCharacters.length] ?? savedGlyph.character;

    if (!hasDrawnGlyph(savedGlyph)) {
      return sequentialNext;
    }

    for (let offset = 1; offset <= activeCharacters.length; offset += 1) {
      const candidate = activeCharacters[(currentIndex + offset) % activeCharacters.length];
      const candidateGlyph = candidate === savedGlyph.character
        ? savedGlyph
        : activeFont.glyphs[candidate] ?? createEmptyGlyph(candidate);

      if (!hasDrawnGlyph(candidateGlyph)) {
        return candidate;
      }
    }

    return sequentialNext;
  }

  function handleSaveGlyphAndNext(glyph: Glyph) {
    const now = new Date().toISOString();
    const savedGlyph = mergeGlyphWithExistingVariants(activeFont, glyph, glyph.updatedAt ?? now);
    const nextCharacter = getNextCharacterAfterSave(savedGlyph);
    const nextData: FontStudioData = {
      ...studioData,
      fonts: studioData.fonts.map((font) =>
        font.id === activeFont.id
          ? {
              ...font,
              glyphs: {
                ...font.glyphs,
                [savedGlyph.character]: savedGlyph,
              },
              updatedAt: now,
            }
          : font,
      ),
    };
    const activity = {
      character: savedGlyph.character,
      fontId: activeFont.id,
      message: `Saved glyph "${savedGlyph.character}" in "${activeFont.name}".`,
      type: "glyph_edit",
    } satisfies ProjectActivityDraft;
    const dataWithActivity = recordProjectActivity(nextData, activity);

    setStudioData(dataWithActivity);
    setSelectedCharacter(nextCharacter);
    deferProjectSave(dataWithActivity, activity);
  }

  function handleSaveGlyphVariant(glyph: Glyph, variantIndex?: number) {
    const now = new Date().toISOString();
    const { variants: _discardedVariants, ...variantDraft } = glyph;
    const variant: GlyphVariant = {
      ...variantDraft,
      character: glyph.character,
      updatedAt: now,
    };
    const existingGlyph = activeFont.glyphs[glyph.character] ?? createEmptyGlyph(glyph.character);
    const existingVariants = existingGlyph.variants ?? [];
    const isUpdatingVariant =
      typeof variantIndex === "number" && variantIndex >= 0 && variantIndex < existingVariants.length;
    const nextVariants = isUpdatingVariant
      ? existingVariants.map((existingVariant, index) => (index === variantIndex ? variant : existingVariant))
      : [...existingVariants, variant];
    const savedVariantNumber = isUpdatingVariant ? variantIndex + 1 : nextVariants.length;
    const nextData: FontStudioData = {
      ...studioData,
      fonts: studioData.fonts.map((font) =>
        font.id === activeFont.id
          ? {
              ...font,
              glyphs: {
                ...font.glyphs,
                [glyph.character]: {
                  ...existingGlyph,
                  variants: nextVariants,
                  updatedAt: now,
                },
              },
              updatedAt: now,
            }
          : font,
      ),
    };

    persist(nextData, {
      character: glyph.character,
      details: { variantCount: nextVariants.length, variantIndex: savedVariantNumber },
      fontId: activeFont.id,
      message: `Saved variant ${savedVariantNumber} for "${glyph.character}" in "${activeFont.name}".`,
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
        <div className="app-title-block">
          <p className="eyebrow">Tablet drawing desk</p>
          <h1>Font Studio</h1>
        </div>
        <div className="app-header-actions" aria-label="Studio modes">
          <div className="app-status-pill">
            <span>{activeFont.name}</span>
            <strong>
              {activeSavedGlyphCount}/{activeCharacters.length} drawn
            </strong>
          </div>
          <nav className="mode-switcher" aria-label="Primary workspace modes">
            <button className="mode-button active" type="button" onClick={handleOpenHome}>
              Home
            </button>
            <button className="mode-button" type="button" onClick={handleStartDrawing}>
              Draw
            </button>
            <button className="mode-button" type="button" onClick={handleOpenExport}>
              Export
            </button>
          </nav>
        </div>
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
            fonts={studioData.fonts}
            onRecordExport={handleRecordPreviewExport}
            onSaveImage={handleSaveImage}
            onSelectCharacter={handleSelectCharacter}
            headerPreviewText={headerPreviewText}
            onHeaderPreviewTextChange={setHeaderPreviewText}
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
          onSaveGlyphAndNext={handleSaveGlyphAndNext}
          onSaveGlyphVariant={handleSaveGlyphVariant}
          onUpdateFontGuideSettings={(guideSettings) => handleUpdateFontSettings(activeFont.id, { guideSettings })}
          onUpdateFontTheme={(theme) => handleUpdateFontSettings(activeFont.id, { theme })}
          previewText={headerPreviewText.trim() || previewText}
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
