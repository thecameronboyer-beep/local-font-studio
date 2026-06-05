import { useEffect, useMemo, useState } from "react";
import FontLibrary from "./components/FontLibrary";
import FontMetricsPanel from "./components/FontMetricsPanel";
import GlyphEditor from "./components/GlyphEditor";
import GlyphGrid from "./components/GlyphGrid";
import SavedImagesPanel from "./components/SavedImagesPanel";
import SealMaker from "./components/SealMaker";
import TextPreview from "./components/TextPreview";
import {
  APP_THEME_STORAGE_KEY,
  APP_THEME_BACKGROUND_STORAGE_KEY,
  appThemes,
  defaultAppThemeId,
  getAppTheme,
  getAppThemeBackground,
  getDefaultAppThemeBackgroundId,
  normalizeAppThemeBackgroundId,
  normalizeAppThemeId,
  type AppThemeId,
} from "./data/appThemes";
import { getVisibleCharacters, isHeaderLetter, spacebar } from "./data/characterSets";
import { fontPresets } from "./data/fontPresets";
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
  FontHomeSettings,
  FontRenderProfile,
  FontSpacingApplyDraft,
  FontShapeSettings,
  FontSet,
  FontStudioData,
  FontTheme,
  FontWritingStyleSettings,
  Glyph,
  GlyphVariant,
  ProjectActivityDraft,
  SavedImage,
  SavedImageDraft,
} from "./types/fontTypes";

type HomeMode = "design" | "compose" | "seal";

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
  const [themesMenuOpen, setThemesMenuOpen] = useState(false);
  const [activeAppThemeId, setActiveAppThemeId] = useState<AppThemeId>(() => {
    if (typeof window === "undefined") {
      return defaultAppThemeId;
    }

    return normalizeAppThemeId(window.localStorage.getItem(APP_THEME_STORAGE_KEY));
  });
  const [activeAppThemeBackgroundId, setActiveAppThemeBackgroundId] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const storedTheme = getAppTheme(normalizeAppThemeId(window.localStorage.getItem(APP_THEME_STORAGE_KEY)));
    return normalizeAppThemeBackgroundId(
      storedTheme,
      window.localStorage.getItem(APP_THEME_BACKGROUND_STORAGE_KEY),
    );
  });
  const [headerPreviewText, setHeaderPreviewText] = useState("");
  const [previewText, setPreviewText] = useState("the ducks know about the blue canoe.");
  const [homeMode, setHomeMode] = useState<HomeMode>("compose");

  const activeFont = useMemo(
    () =>
      studioData.fonts.find((font) => font.id === studioData.activeFontId) ??
      studioData.fonts[0],
    [studioData],
  );

  const selectedGlyph = activeFont.glyphs[selectedCharacter] ?? createEmptyGlyph(selectedCharacter);
  const spacebarGlyph = activeFont.glyphs[spacebar] ?? createEmptyGlyph(spacebar);
  const activeCharacters = useMemo(() => getVisibleCharacters(activeFont), [activeFont]);
  const activeAppTheme = useMemo(() => getAppTheme(activeAppThemeId), [activeAppThemeId]);
  const activeAppThemeBackground = useMemo(
    () => getAppThemeBackground(activeAppTheme, activeAppThemeBackgroundId),
    [activeAppTheme, activeAppThemeBackgroundId],
  );
  const selectedCharacterIndex = activeCharacters.indexOf(selectedCharacter);

  function getSavedGlyphCount(font: FontSet) {
    return getVisibleCharacters(font).filter((character) => hasDrawnGlyph(font.glyphs[character])).length;
  }

  useEffect(() => {
    document.body.classList.toggle("editor-fullscreen-open", editorFullScreen || gridFullScreen || savedImagesOpen);

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [editorFullScreen, gridFullScreen, savedImagesOpen]);

  useEffect(() => {
    const root = document.documentElement;
    const safeBackgroundId = normalizeAppThemeBackgroundId(activeAppTheme, activeAppThemeBackgroundId);

    root.dataset.appTheme = activeAppTheme.id;
    root.dataset.appThemeBackground = safeBackgroundId;
    Object.entries(activeAppTheme.cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    Object.entries(activeAppThemeBackground?.cssVariables ?? {}).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    if (safeBackgroundId !== activeAppThemeBackgroundId) {
      setActiveAppThemeBackgroundId(safeBackgroundId);
    }

    try {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, activeAppTheme.id);
      window.localStorage.setItem(APP_THEME_BACKGROUND_STORAGE_KEY, safeBackgroundId);
    } catch (error) {
      console.warn("Unable to persist app theme.", error);
    }
  }, [activeAppTheme, activeAppThemeBackground, activeAppThemeBackgroundId]);

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

  function handlePreviewSelectCharacter(character: string) {
    setSelectedCharacter(character);
  }

  function handleApplyPreviewFontSpacing(draft: FontSpacingApplyDraft) {
    const now = new Date().toISOString();
    const nextData: FontStudioData = {
      ...studioData,
      fonts: studioData.fonts.map((font) => {
        if (font.id !== activeFont.id) {
          return font;
        }

        const glyphs = Object.entries(font.glyphs).reduce<Record<string, Glyph>>(
          (nextGlyphs, [character, glyph]) => {
            const globalOverrides = character === spacebar ? {} : draft.fontMetricOverrides;
            const glyphOverrides = draft.glyphMetricOverrides[character] ?? {};
            const metricOverrides = {
              ...globalOverrides,
              ...glyphOverrides,
            };

            nextGlyphs[character] = Object.keys(metricOverrides).length === 0
              ? glyph
              : {
                  ...glyph,
                  ...metricOverrides,
                  variants: glyph.variants?.map((variant) => ({
                    ...variant,
                    ...metricOverrides,
                    updatedAt: now,
                  })),
                  updatedAt: now,
                };

            return nextGlyphs;
          },
          {},
        );

        return {
          ...font,
          glyphs,
          guideSettings: draft.guideSettings ?? font.guideSettings,
          shapeSettings: {
            ...font.shapeSettings,
            ...draft.shapeSettings,
          },
          updatedAt: now,
        };
      }),
    };

    persist(nextData, {
      details: {
        globalAdvance: draft.fontMetricOverrides.xAdvance ?? null,
        letterSpacing: draft.shapeSettings.letterSpacing,
        spacebarAdvance: draft.glyphMetricOverrides[spacebar]?.xAdvance ?? null,
        widthScale: draft.shapeSettings.widthScale,
      },
      fontId: activeFont.id,
      message: `Applied spacing settings to "${activeFont.name}".`,
      type: "metrics_batch",
    });
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

  function handleCreatePresetFont(presetFontId: string) {
    const preset = fontPresets.find((item) => item.id === presetFontId);

    if (!preset) {
      return;
    }

    const existingPresetFont = studioData.fonts.find((font) => font.presetFontId === preset.id);

    if (existingPresetFont) {
      persist({
        ...studioData,
        activeFontId: existingPresetFont.id,
      });
      return;
    }

    const font = createFontSet(preset.label);
    const presetFont: FontSet = {
      ...font,
      name: preset.label,
      presetFontId: preset.id,
      homeSettings: {
        visibleSections: {
          ...font.homeSettings.visibleSections,
          drawActions: false,
          glyphQueue: false,
        },
      },
    };

    persist({
      ...studioData,
      activeFontId: presetFont.id,
      fonts: [...studioData.fonts, presetFont],
    }, {
      fontId: presetFont.id,
      message: `Added preset font "${presetFont.name}".`,
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
      homeSettings?: FontHomeSettings;
      shapeSettings?: FontShapeSettings;
      theme?: FontTheme;
      writingStyleSettings?: FontWritingStyleSettings;
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
              homeSettings: settings.homeSettings ?? font.homeSettings,
              shapeSettings: settings.shapeSettings ?? font.shapeSettings,
              theme: settings.theme ?? font.theme,
              updatedAt: now,
              writingStyleSettings: settings.writingStyleSettings ?? font.writingStyleSettings,
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

  function selectAppTheme(themeId: AppThemeId) {
    const nextTheme = getAppTheme(themeId);

    setActiveAppThemeId(nextTheme.id);
    setActiveAppThemeBackgroundId(getDefaultAppThemeBackgroundId(nextTheme));
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
            Design Letters
          </button>
          <button
            type="button"
            aria-expanded={themesMenuOpen}
            onClick={() => setThemesMenuOpen((open) => !open)}
          >
            Themes
          </button>
        </nav>

        {themesMenuOpen && (
          <div className="sidebar-theme-panel" aria-label="App themes">
            {appThemes.map((theme) => {
              const selected = activeAppThemeId === theme.id;

              return (
                <div key={theme.id} className={`sidebar-theme-card ${selected ? "selected" : ""}`}>
                  <button
                    className="sidebar-theme-option"
                    type="button"
                    aria-pressed={selected}
                    onClick={() => selectAppTheme(theme.id)}
                  >
                    <span className="sidebar-theme-swatches" aria-hidden="true">
                      {theme.swatches.map((color, index) => (
                        <span key={`${theme.id}-${color}-${index}`} style={{ backgroundColor: color }} />
                      ))}
                    </span>
                    <span className="sidebar-theme-copy">
                      <strong>{theme.label}</strong>
                      <span>{theme.description}</span>
                    </span>
                  </button>
                  {selected && theme.backgrounds?.length ? (
                    <div className="sidebar-theme-backgrounds" aria-label={`${theme.label} backgrounds`}>
                      {theme.backgrounds.map((background) => {
                        const backgroundSelected = activeAppThemeBackgroundId === background.id;

                        return (
                          <button
                            key={background.id}
                            className={`sidebar-theme-background-button ${backgroundSelected ? "selected" : ""}`}
                            type="button"
                            aria-pressed={backgroundSelected}
                            onClick={() => setActiveAppThemeBackgroundId(background.id)}
                          >
                            <span style={{ backgroundColor: background.swatch }} aria-hidden="true" />
                            {background.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </aside>

      <header className="app-header">
        <div className="app-title-block">
          <h1>Quill</h1>
        </div>
      </header>

      <div className="workspace">
        <div className="left-stack">
          <FontLibrary
            homeMode={homeMode}
            fonts={studioData.fonts}
            activeFontId={studioData.activeFontId}
            onHomeModeChange={setHomeMode}
            onSelectFont={handleSelectFont}
            onStartDrawing={handleStartDrawing}
            onCreateFont={handleCreateFont}
            onCreatePresetFont={handleCreatePresetFont}
            onRenameFont={handleRenameFont}
            onUpdateFontSettings={handleUpdateFontSettings}
            onDuplicateFont={handleDuplicateFont}
            onDeleteFont={handleDeleteFont}
            getSavedGlyphCount={getSavedGlyphCount}
          />
          {homeMode === "compose" && (
            <TextPreview
              font={activeFont}
              fonts={studioData.fonts}
              onApplyFontSpacing={handleApplyPreviewFontSpacing}
              onOpenCharacterEditor={handleSelectCharacter}
              onRecordExport={handleRecordPreviewExport}
              onSaveImage={handleSaveImage}
              onSelectCharacter={handlePreviewSelectCharacter}
              headerPreviewText={headerPreviewText}
              onHeaderPreviewTextChange={setHeaderPreviewText}
              visibleHomeSections={activeFont.homeSettings.visibleSections}
              previewText={previewText}
              onPreviewTextChange={setPreviewText}
              selectedGlyph={selectedGlyph}
              spacebarGlyph={spacebarGlyph}
            />
          )}
          {homeMode === "design" && activeFont.homeSettings.visibleSections.glyphQueue && (
            <FontMetricsPanel
              font={activeFont}
              previewText={previewText}
              selectedCharacter={selectedCharacter}
              onSelectCharacter={handleSelectCharacter}
            />
          )}
          {homeMode === "seal" && (
            <SealMaker
              font={activeFont}
              onRecordExport={handleRecordPreviewExport}
              onSaveImage={handleSaveImage}
            />
          )}
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
