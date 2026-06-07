import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Settings2 } from "lucide-react";
import { BackgroundDesigner } from "./components/BackgroundDesigner";
import { CompileView } from "./components/CompileView";
import FontLibrary from "./components/FontLibrary";
import FontMetricsPanel from "./components/FontMetricsPanel";
import GlyphEditor from "./components/GlyphEditor";
import GlyphGrid from "./components/GlyphGrid";
import { QuillLibraryView } from "./components/QuillLibraryView";
import SavedImagesPanel from "./components/SavedImagesPanel";
import TextPreview, {
  loadPreviewDesignPresetSummaries,
  type PreviewDesignPresetSummary,
} from "./components/TextPreview";
import {
  APP_THEME_STORAGE_KEY,
  appThemes,
  defaultAppThemeId,
  getAppTheme,
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
import { loadCustomBackgrounds, type CustomBackground } from "./storage/customBackgroundStorage";
import {
  buildAutoEntryPair,
  formatAutoEntryTimestamp,
  getLatestAutoEntryPageInfo,
  isMeaningfulAutoEntryActivity,
  type AutoEntryKind,
  type AutoEntryPairDraft,
} from "./storage/quillAutoEntryLog";
import {
  addStructureItemToCompilation,
  deleteCompiledPageImage,
  ensureBookHasAutoSections,
  createBookCompilation,
  loadBookCompilations,
  loadCompiledPages,
  loadUpdateEntries,
  movePlacedPageInCompilation,
  movePlacedPageToStructureItemInCompilation,
  placePageInCompilation,
  removeStructureItemFromCompilation,
  removePlacedPageFromCompilation,
  renameStructureItemInCompilation,
  renameBookCompilation,
  saveBookCompilations,
  saveCompiledPages,
  saveUpdateEntries,
  type BookStructureKind,
  type BookCompilation,
  saveRenderedQuillPage,
  type CompiledPage,
  type SaveRenderedQuillPageInput,
  type UpdateEntry,
} from "./storage/quillWorkspaceStorage";
import type {
  FontCharacterSettings,
  FontGuideSettings,
  FontHomeSettings,
  FontRenderProfile,
  FontSpacingApplyDraft,
  FontShapeSettings,
  FontSet,
  ProjectActivity,
  FontStudioData,
  FontTheme,
  FontWritingStyleSettings,
  Glyph,
  GlyphVariant,
  ProjectActivityDraft,
  SavedImage,
  SavedImageDraft,
} from "./types/fontTypes";

type HomeMode = "design" | "compose" | "compile" | "library" | "backgrounds";

const deletedCompiledPageIdsStorageKey = "quill.deleted-page-ids.v1";

type PendingAutoEntryRequest = {
  bookId: string;
  bookTitle: string;
  createdAt: string;
  fallbackPresetKinds: AutoEntryKind[];
  id: number;
  pair: AutoEntryPairDraft;
};

type AutoEntryRenderJob = {
  bookId: string;
  entries: Array<{
    currentPageId?: string;
    currentPageText?: string;
    kind: AutoEntryKind;
    nextPageNumber: number;
    pageNumber: number;
    pageTitle: string;
    presetId?: string;
    text: string;
  }>;
  requestId: number;
};

type AutoEntryRenderResult = {
  bookId: string;
  entries: Array<{
    fallbackUsed: boolean;
    kind: AutoEntryKind;
    page: CompiledPage;
    pageNumber: number;
    rolledOver: boolean;
  }>;
  requestId: number;
};

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
  const [customBackgrounds, setCustomBackgrounds] = useState<CustomBackground[]>(() => loadCustomBackgrounds());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const sidebarOpenRef = useRef(false);
  const sidebarClosingRef = useRef(false);
  const sidebarCloseTimerRef = useRef<number | undefined>(undefined);
  const [themesMenuOpen, setThemesMenuOpen] = useState(false);
  const [modeSettingsOpen, setModeSettingsOpen] = useState<HomeMode | null>(null);
  const [activeAppThemeId, setActiveAppThemeId] = useState<AppThemeId>(() => {
    if (typeof window === "undefined") {
      return defaultAppThemeId;
    }

    return normalizeAppThemeId(window.localStorage.getItem(APP_THEME_STORAGE_KEY));
  });
  const [headerPreviewText, setHeaderPreviewText] = useState("");
  const [previewText, setPreviewText] = useState("the ducks know about the blue canoe.");
  const [homeMode, setHomeMode] = useState<HomeMode>("compose");
  const [previewDesignPresets, setPreviewDesignPresets] = useState<PreviewDesignPresetSummary[]>(() =>
    loadPreviewDesignPresetSummaries(),
  );
  const [activePreviewDesignPresetId, setActivePreviewDesignPresetId] = useState("");
  const [designPresetApplyRequestId, setDesignPresetApplyRequestId] = useState(0);
  const [presetBuilderRequestId, setPresetBuilderRequestId] = useState(0);
  const [compiledPages, setCompiledPages] = useState<CompiledPage[]>(() => loadCompiledPages());
  const [deletedCompiledPageIds, setDeletedCompiledPageIds] = useState<string[]>(() => loadDeletedCompiledPageIds());
  const [initialBookCompilations] = useState<BookCompilation[]>(() => loadBookCompilations().map(ensureBookHasAutoSections));
  const [bookCompilations, setBookCompilations] = useState<BookCompilation[]>(initialBookCompilations);
  const [updateEntries, setUpdateEntries] = useState<UpdateEntry[]>(() => loadUpdateEntries());
  const [autoEntryQueue, setAutoEntryQueue] = useState<PendingAutoEntryRequest[]>([]);
  const [activeAutoEntryRequestId, setActiveAutoEntryRequestId] = useState<number | null>(null);
  const [autoEntryStatus, setAutoEntryStatus] = useState("Story and Changelog auto-entry is ready for this book.");
  const [activeCompiledPageId, setActiveCompiledPageId] = useState("");
  const [activeBookId, setActiveBookId] = useState(() => initialBookCompilations[0]?.id ?? "");

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
  const selectedCharacterIndex = activeCharacters.indexOf(selectedCharacter);
  const activeBook = useMemo(
    () => bookCompilations.find((book) => book.id === activeBookId) ?? bookCompilations[0],
    [activeBookId, bookCompilations],
  );
  const activeAutoEntryRequest = useMemo(
    () => autoEntryQueue.find((request) => request.id === activeAutoEntryRequestId) ?? null,
    [activeAutoEntryRequestId, autoEntryQueue],
  );
  const autoEntryRenderJob = useMemo(
    () =>
      activeAutoEntryRequest
        ? buildAutoEntryRenderJob(activeAutoEntryRequest, compiledPages, updateEntries, previewDesignPresets)
        : null,
    [activeAutoEntryRequest, compiledPages, updateEntries, previewDesignPresets],
  );
  const latestStoryPage = useMemo(
    () => (activeBook ? getLatestAutoEntryPageInfo(updateEntries, activeBook.id, "story") : null),
    [activeBook, updateEntries],
  );
  const latestChangelogPage = useMemo(
    () => (activeBook ? getLatestAutoEntryPageInfo(updateEntries, activeBook.id, "changelog") : null),
    [activeBook, updateEntries],
  );
  const compilationPages = useMemo(
    () => {
      const deletedPageIds = new Set(deletedCompiledPageIds);
      return buildCompilationPages(compiledPages, updateEntries, studioData.activityLog).filter((page) => !deletedPageIds.has(page.id));
    },
    [compiledPages, deletedCompiledPageIds, studioData.activityLog, updateEntries],
  );
  const handlePreviewDesignPresetsChange = useCallback((presets: PreviewDesignPresetSummary[], activePresetId?: string) => {
    setPreviewDesignPresets(presets);
    setActivePreviewDesignPresetId((currentPresetId) => {
      if (activePresetId) {
        return activePresetId;
      }

      return presets.some((preset) => preset.id === currentPresetId) ? currentPresetId : "";
    });
  }, []);

  function getSavedGlyphCount(font: FontSet) {
    return getVisibleCharacters(font).filter((character) => hasDrawnGlyph(font.glyphs[character])).length;
  }

  useEffect(() => {
    document.body.classList.toggle(
      "editor-fullscreen-open",
      editorFullScreen || gridFullScreen || savedImagesOpen || homeMode === "library",
    );

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, [editorFullScreen, gridFullScreen, homeMode, savedImagesOpen]);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.appTheme = activeAppTheme.id;
    delete root.dataset.appThemeBackground;
    Object.entries(activeAppTheme.cssVariables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });

    try {
      window.localStorage.setItem(APP_THEME_STORAGE_KEY, activeAppTheme.id);
    } catch (error) {
      console.warn("Unable to persist app theme.", error);
    }
  }, [activeAppTheme]);

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
    queueAutoEntriesForActivity(activity ? dataWithActivity.activityLog[0] ?? null : null);
  }

  function persistSavedImages(nextImages: SavedImage[]) {
    saveSavedImages(nextImages);
    setSavedImages(nextImages);
  }

  function persistBookCompilations(nextBooks: BookCompilation[]) {
    const normalizedBooks = nextBooks.map(ensureBookHasAutoSections);
    saveBookCompilations(normalizedBooks);
    setBookCompilations(normalizedBooks);
    if (!normalizedBooks.some((book) => book.id === activeBookId)) {
      setActiveBookId(normalizedBooks[0]?.id ?? "");
    }
  }

  function persistUpdateEntries(nextEntries: UpdateEntry[]) {
    saveUpdateEntries(nextEntries);
    setUpdateEntries(nextEntries);
  }

  function queueAutoEntriesForActivity(activity: ProjectActivity | null) {
    if (!isMeaningfulAutoEntryActivity(activity) || !activeBook) {
      return;
    }

    const pair = buildAutoEntryPair(activity);
    const requestId = Date.now() + autoEntryQueue.length;
    const storyPresetId = resolveAutoEntryPresetId(previewDesignPresets, "story");
    const changelogPresetId = resolveAutoEntryPresetId(previewDesignPresets, "changelog");
    const fallbackPresetKinds: AutoEntryKind[] = [];

    if (!storyPresetId) {
      fallbackPresetKinds.push("story");
    }
    if (!changelogPresetId) {
      fallbackPresetKinds.push("changelog");
    }

    if (fallbackPresetKinds.length > 0) {
      setAutoEntryStatus(
        `Using the current compose layout until the ${fallbackPresetKinds
          .map((kind) => (kind === "story" ? "Story" : "Changelog"))
          .join(" and ")} preset is available.`,
      );
    } else {
      setAutoEntryStatus(`Auto-entry is writing into ${activeBook.title}.`);
    }

    setAutoEntryQueue((current) => [
      ...current,
      {
        bookId: activeBook.id,
        bookTitle: activeBook.title,
        createdAt: pair.createdAt,
        fallbackPresetKinds,
        id: requestId,
        pair,
      },
    ]);
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

  useEffect(() => {
    if (activeAutoEntryRequestId === null && autoEntryQueue.length > 0) {
      setActiveAutoEntryRequestId(autoEntryQueue[0].id);
    }
  }, [activeAutoEntryRequestId, autoEntryQueue]);

  async function handleSaveRenderedPage(input: SaveRenderedQuillPageInput) {
    const page = await saveRenderedQuillPage(input);
    setCompiledPages(loadCompiledPages());
    setActiveCompiledPageId(page.id);
    return page;
  }

  function handleAutoEntryRenderComplete(result: AutoEntryRenderResult) {
    const request = autoEntryQueue.find((item) => item.id === result.requestId);

    if (!request) {
      setActiveAutoEntryRequestId(null);
      return;
    }

    const storyResult = result.entries.find((entry) => entry.kind === "story");
    const changelogResult = result.entries.find((entry) => entry.kind === "changelog");

    if (!storyResult || !changelogResult) {
      setActiveAutoEntryRequestId(null);
      setAutoEntryQueue((current) => current.filter((item) => item.id !== result.requestId));
      return;
    }

    const nextBooks = placeAutoEntryPagesIntoBook(
      bookCompilations,
      request.bookId,
      storyResult.page,
      changelogResult.page,
    );
    persistBookCompilations(nextBooks);

    const nextEntries: UpdateEntry[] = [
      {
        bookId: request.bookId,
        changelogPageId: changelogResult.page.id,
        changelogPageNumber: changelogResult.pageNumber,
        changelogText: request.pair.changelogText,
        createdAt: request.createdAt,
        entryPairId: `entry-pair-${request.pair.sourceActivityId}`,
        id: `update-entry-${request.pair.sourceActivityId}`,
        sourceActivityId: request.pair.sourceActivityId,
        storyPageId: storyResult.page.id,
        storyPageNumber: storyResult.pageNumber,
        storyText: request.pair.storyText,
      },
      ...updateEntries.filter((entry) => entry.sourceActivityId !== request.pair.sourceActivityId),
    ];
    persistUpdateEntries(nextEntries);
    setCompiledPages(loadCompiledPages());
    setActiveCompiledPageId(storyResult.page.id);
    setAutoEntryStatus(
      result.entries.some((entry) => entry.fallbackUsed)
        ? `Updated ${request.bookTitle} using the current compose layout because one or more auto-entry presets were missing.`
        : `Updated ${request.bookTitle}: Story ${storyResult.pageNumber} and Changelog ${changelogResult.pageNumber}.`,
    );
    setAutoEntryQueue((current) => current.filter((item) => item.id !== result.requestId));
    setActiveAutoEntryRequestId(null);
  }

  function handleCreateBookCompilation() {
    const book = createBookCompilation(`Book ${bookCompilations.length + 1}`);
    const nextBooks = [book, ...bookCompilations];
    persistBookCompilations(nextBooks);
    setActiveBookId(book.id);
  }

  function handleAddBookStructureItem(kind: BookStructureKind, title: string) {
    if (!activeBook) {
      return;
    }

    persistBookCompilations(addStructureItemToCompilation(bookCompilations, activeBook.id, title, kind));
  }

  function handleRenameBookStructureItem(structureItemId: string, title: string) {
    if (!activeBook) {
      return;
    }

    persistBookCompilations(renameStructureItemInCompilation(bookCompilations, activeBook.id, structureItemId, title));
  }

  function handleRemoveBookStructureItem(structureItemId: string) {
    if (!activeBook) {
      return;
    }

    persistBookCompilations(removeStructureItemFromCompilation(bookCompilations, activeBook.id, structureItemId));
  }

  function handlePlaceCompiledPage(pageId: string, structureItemId?: string) {
    if (!activeBook) {
      return;
    }

    const page = compilationPages.find((item) => item.id === pageId);
    if (!page) {
      return;
    }

    persistBookCompilations(placePageInCompilation(bookCompilations, activeBook.id, page, structureItemId));
    setActiveCompiledPageId(page.id);
  }

  async function handleUploadCompiledPages(files: File[]) {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    const uploadedPages: CompiledPage[] = [];

    for (const file of imageFiles) {
      const dimensions = await getImageFileDimensions(file);
      const page = await saveRenderedQuillPage({
        blob: file,
        height: dimensions.height,
        textContent: "",
        title: getUploadedPageTitle(file.name),
        width: dimensions.width,
      });

      uploadedPages.push(page);
    }

    setCompiledPages(loadCompiledPages());
    if (uploadedPages.length > 0) {
      setActiveCompiledPageId(uploadedPages[uploadedPages.length - 1].id);
    }
  }

  async function handleDeleteCompiledPage(pageId: string) {
    if (!pageId) {
      return;
    }

    const nextDeletedPageIds = Array.from(new Set([...loadDeletedCompiledPageIds(), pageId]));
    saveDeletedCompiledPageIds(nextDeletedPageIds);
    setDeletedCompiledPageIds(nextDeletedPageIds);

    const nextPages = loadCompiledPages().filter((page) => page.id !== pageId);
    saveCompiledPages(nextPages);
    try {
      await deleteCompiledPageImage(pageId);
    } catch (error) {
      console.warn("Could not delete compiled page image.", error);
    }

    persistBookCompilations(removeCompiledPageReferencesFromBooks(bookCompilations, pageId));
    setCompiledPages(nextPages);
    const hiddenPageIds = new Set(nextDeletedPageIds);
    const nextVisiblePages = buildCompilationPages(nextPages, updateEntries, studioData.activityLog).filter((page) => !hiddenPageIds.has(page.id));
    setActiveCompiledPageId((current) => (current === pageId ? nextVisiblePages[0]?.id ?? "" : current));
  }

  function handleRemovePlacedPage(placedPageId: string) {
    if (!activeBook) {
      return;
    }

    persistBookCompilations(removePlacedPageFromCompilation(bookCompilations, activeBook.id, placedPageId));
  }

  function handleMovePlacedPage(placedPageId: string, offset: number) {
    if (!activeBook) {
      return;
    }

    persistBookCompilations(movePlacedPageInCompilation(bookCompilations, activeBook.id, placedPageId, offset));
  }

  function handleMovePlacedPageToLocation(placedPageId: string, structureItemId: string, targetIndex: number) {
    if (!activeBook) {
      return;
    }

    persistBookCompilations(
      movePlacedPageToStructureItemInCompilation(bookCompilations, activeBook.id, placedPageId, structureItemId, targetIndex),
    );
  }

  function handleRenameBookCompilation(title: string) {
    if (!activeBook) {
      return;
    }

    persistBookCompilations(renameBookCompilation(bookCompilations, activeBook.id, title));
  }

  function selectAppTheme(themeId: AppThemeId) {
    const nextTheme = getAppTheme(themeId);

    setActiveAppThemeId(nextTheme.id);
  }

  function resolveAutoSectionId(book: BookCompilation, kind: AutoEntryKind) {
    return book.structureItems.find((item) => item.systemSectionKey === kind)?.id;
  }

  function placeAutoEntryPagesIntoBook(
    books: BookCompilation[],
    bookId: string,
    storyPage: CompiledPage,
    changelogPage: CompiledPage,
  ): BookCompilation[] {
    const book = books.find((item) => item.id === bookId);

    if (!book) {
      return books;
    }

    const storySectionId = resolveAutoSectionId(book, "story");
    const changelogSectionId = resolveAutoSectionId(book, "changelog");
    let nextBooks = books;

    if (storySectionId && !book.placedPages.some((page) => page.pageId === storyPage.id)) {
      nextBooks = placePageInCompilation(nextBooks, bookId, storyPage, storySectionId);
    }

    const nextBook = nextBooks.find((item) => item.id === bookId) ?? book;
    if (changelogSectionId && !nextBook.placedPages.some((page) => page.pageId === changelogPage.id)) {
      nextBooks = placePageInCompilation(nextBooks, bookId, changelogPage, changelogSectionId);
    }

    return nextBooks;
  }

  const sidebarModeOptions: Array<{ id: HomeMode; label: string }> = [
    { id: "design", label: "Design" },
    { id: "compose", label: "Compose" },
    { id: "compile", label: "Compile" },
    { id: "library", label: "Library" },
    { id: "backgrounds", label: "Backgrounds" },
  ];

  useEffect(() => () => {
    if (sidebarCloseTimerRef.current !== undefined) {
      window.clearTimeout(sidebarCloseTimerRef.current);
    }
  }, []);

  function openSidebar() {
    if (sidebarCloseTimerRef.current !== undefined) {
      window.clearTimeout(sidebarCloseTimerRef.current);
      sidebarCloseTimerRef.current = undefined;
    }
    sidebarOpenRef.current = true;
    sidebarClosingRef.current = false;
    setSidebarClosing(false);
    setSidebarOpen(true);
  }

  function isSidebarVisiblyOpen() {
    if (typeof document === "undefined") {
      return false;
    }

    return document.querySelector(".sidebar-menu.open") !== null;
  }

  function closeSidebar(action?: () => void) {
    const shouldAnimateClose = sidebarOpenRef.current || sidebarClosingRef.current || isSidebarVisiblyOpen();
    if (!shouldAnimateClose) {
      action?.();
      return;
    }

    if (sidebarCloseTimerRef.current !== undefined) {
      window.clearTimeout(sidebarCloseTimerRef.current);
    }

    sidebarOpenRef.current = false;
    sidebarClosingRef.current = true;
    setSidebarOpen(false);
    setSidebarClosing(true);
    setThemesMenuOpen(false);
    setModeSettingsOpen(null);
    sidebarCloseTimerRef.current = window.setTimeout(() => {
      sidebarClosingRef.current = false;
      setSidebarClosing(false);
      sidebarCloseTimerRef.current = undefined;
      action?.();
    }, 360);
  }

  function toggleSidebar() {
    if (sidebarOpenRef.current || isSidebarVisiblyOpen()) {
      closeSidebar();
      return;
    }

    openSidebar();
  }

  function openHomeMode(mode: HomeMode) {
    closeSidebar(() => {
      setEditorFullScreen(false);
      setGridFullScreen(false);
      setSavedImagesOpen(false);
      setHomeMode(mode);
    });
  }

  function toggleModeSettings(mode: HomeMode) {
    setThemesMenuOpen(false);
    setModeSettingsOpen((current) => (current === mode ? null : mode));
  }

  function openSidebarPanelAction(action: () => void) {
    closeSidebar(action);
  }

  function renderBookSetting(label: string, includeCreate = false) {
    if (!activeBook) {
      return (
        <div className="sidebar-settings-empty" role="status">
          No books yet
        </div>
      );
    }

    return (
      <div className="sidebar-settings-field-row">
        <label className="sidebar-settings-field">
          <span>{label}</span>
          <select value={activeBook.id} onChange={(event) => setActiveBookId(event.target.value)}>
            {bookCompilations.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
        </label>
        {includeCreate ? (
          <button className="secondary-button compact-button sidebar-settings-inline-button" type="button" onClick={handleCreateBookCompilation}>
            New
          </button>
        ) : null}
      </div>
    );
  }

  function renderModeSettings(mode: HomeMode) {
    if (mode === "design") {
      return (
        <>
          <strong>Design settings</strong>
          <div className="sidebar-settings-button-grid">
            <button className="secondary-button compact-button" type="button" onClick={() => openSidebarPanelAction(() => setGridFullScreen(true))}>
              Alphabet
            </button>
            <button className="secondary-button compact-button" type="button" onClick={() => openSidebarPanelAction(() => setEditorFullScreen(true))}>
              Design Letters
            </button>
          </div>
        </>
      );
    }

    if (mode === "compose") {
      return (
        <>
          <strong>Compose settings</strong>
          <div className="sidebar-settings-field-row">
            <label className="sidebar-settings-field">
              <span>Preset</span>
              <select
                value={activePreviewDesignPresetId}
                onChange={(event) => {
                  const presetId = event.target.value;
                  setActivePreviewDesignPresetId(presetId);
                  if (presetId) {
                    setDesignPresetApplyRequestId((requestId) => requestId + 1);
                  }
                }}
              >
                <option value="">Presets</option>
                {previewDesignPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondary-button compact-button sidebar-settings-icon-button"
              type="button"
              aria-label="Create preset"
              onClick={() => setPresetBuilderRequestId((requestId) => requestId + 1)}
            >
              <Plus aria-hidden="true" size={18} />
            </button>
          </div>
          {renderBookSetting("Auto-entry book")}
        </>
      );
    }

    if (mode === "compile") {
      return (
        <>
          <strong>Compile settings</strong>
          {renderBookSetting("Active book", true)}
        </>
      );
    }

    if (mode === "backgrounds") {
      return (
        <>
          <strong>Background settings</strong>
          <div className="sidebar-settings-field-row">
            <label className="sidebar-settings-field">
              <span>Saved</span>
              <select value={customBackgrounds[0]?.id ?? ""} onChange={() => openSidebarPanelAction(() => setHomeMode("backgrounds"))}>
                <option value="">{customBackgrounds.length ? `${customBackgrounds.length} backgrounds` : "No backgrounds"}</option>
                {customBackgrounds.map((background) => (
                  <option key={background.id} value={background.id}>
                    {background.name}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary-button compact-button sidebar-settings-inline-button" type="button" onClick={() => openSidebarPanelAction(() => setHomeMode("backgrounds"))}>
              Open
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <strong>Library settings</strong>
        {renderBookSetting("Library book")}
      </>
    );
  }

  return (
    <main className="app-shell">
      <button
        className={`menu-toggle ${sidebarOpen ? "open" : ""} ${sidebarClosing ? "closing" : ""}`}
        type="button"
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        aria-expanded={sidebarOpen}
        onClick={toggleSidebar}
      >
        <span />
        <span />
        <span />
      </button>

      <div
        className={`sidebar-backdrop ${sidebarOpen ? "open" : ""} ${sidebarClosing ? "closing" : ""}`}
        aria-hidden="true"
        onClick={() => closeSidebar()}
      />

      <aside className={`sidebar-menu ${sidebarOpen ? "open" : ""} ${sidebarClosing ? "closing" : ""}`} aria-label="App menu">
        <div className="sidebar-heading">
          <h2>Menu</h2>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-mode-buttons" aria-label="App modes">
            {sidebarModeOptions.map((option) => {
              const settingsOpenForMode = modeSettingsOpen === option.id;
              const settingsPanelId = `sidebar-${option.id}-settings`;

              return (
                <div key={option.id} className="sidebar-mode-control">
                  <button
                    className={`sidebar-mode-main-button ${homeMode === option.id ? "active-tool" : ""}`}
                    type="button"
                    aria-pressed={homeMode === option.id}
                    onClick={() => openHomeMode(option.id)}
                  >
                    {option.label}
                  </button>
                  <button
                    className={`sidebar-mode-settings-button ${settingsOpenForMode ? "active-tool" : ""}`}
                    type="button"
                    aria-label={`${option.label} settings`}
                    aria-expanded={settingsOpenForMode}
                    aria-controls={settingsPanelId}
                    onClick={() => toggleModeSettings(option.id)}
                  >
                    <Settings2 aria-hidden="true" size={17} />
                  </button>
                </div>
              );
            })}
          </div>
          {modeSettingsOpen ? (
            <div
              className="sidebar-mode-settings-panel"
              id={`sidebar-${modeSettingsOpen}-settings`}
              aria-label={`${sidebarModeOptions.find((option) => option.id === modeSettingsOpen)?.label ?? "Mode"} settings`}
            >
              {renderModeSettings(modeSettingsOpen)}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => closeSidebar(() => {
              setSavedImagesOpen(true);
            })}
          >
            Saved Images
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
                </div>
              );
            })}
          </div>
        )}
      </aside>

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
            modeSlot={homeMode === "compose" ? (
              <div className="compose-mode-slot-stack">
                <div className="compose-preset-selector" aria-label="Preset selector">
                  <select
                    value={activePreviewDesignPresetId}
                    onChange={(event) => {
                      const presetId = event.target.value;
                      setActivePreviewDesignPresetId(presetId);
                      if (presetId) {
                        setDesignPresetApplyRequestId((requestId) => requestId + 1);
                      }
                    }}
                    aria-label="Active preset"
                  >
                    <option value="">Presets</option>
                    {previewDesignPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="secondary-button compact-button compose-preset-add-button"
                    type="button"
                    aria-label="Create preset"
                    title="Create preset"
                    onClick={() => setPresetBuilderRequestId((requestId) => requestId + 1)}
                  >
                    <Plus aria-hidden="true" size={18} />
                  </button>
                </div>
                {activeBook ? (
                  <div className="compose-auto-entry-status" aria-label="Auto-entry status">
                    <strong>{activeBook.title}</strong>
                    <span>
                      Latest Story: {latestStoryPage ? `Story ${latestStoryPage.pageNumber}` : "Story 1 not started"}
                    </span>
                    <span>
                      Latest Changelog: {latestChangelogPage ? `Changelog ${latestChangelogPage.pageNumber}` : "Changelog 1 not started"}
                    </span>
                    <small>{autoEntryStatus}</small>
                  </div>
                ) : null}
              </div>
            ) : homeMode === "compile" && activeBook ? (
              <div className="compile-book-selector" aria-label="Book selector">
                <select value={activeBook.id} onChange={(event) => setActiveBookId(event.target.value)} aria-label="Active book">
                  {bookCompilations.map((book) => (
                    <option key={book.id} value={book.id}>
                      {book.title}
                    </option>
                  ))}
                </select>
                <button className="secondary-button compact-button" type="button" onClick={handleCreateBookCompilation}>
                  New
                </button>
              </div>
            ) : null}
          />
          <div style={{ display: homeMode === "compose" ? undefined : "none" }}>
            <TextPreview
              autoEntryRequest={autoEntryRenderJob}
              composeFullscreenOnly={homeMode === "compose"}
              designPresetApplyRequestId={designPresetApplyRequestId}
              designPresetIdToApply={activePreviewDesignPresetId}
              font={activeFont}
              fonts={studioData.fonts}
              onApplyFontSpacing={handleApplyPreviewFontSpacing}
              onAutoEntryRenderComplete={handleAutoEntryRenderComplete}
              onCreatePresetFont={handleCreatePresetFont}
              onDesignPresetsChange={handlePreviewDesignPresetsChange}
              customBackgrounds={customBackgrounds}
              onOpenCharacterEditor={handleSelectCharacter}
              onOpenAppMenu={toggleSidebar}
              onRecordExport={handleRecordPreviewExport}
              onSaveImage={handleSaveImage}
              onSaveRenderedPage={handleSaveRenderedPage}
              onSelectCharacter={handlePreviewSelectCharacter}
              onSelectFont={handleSelectFont}
              headerPreviewText={headerPreviewText}
              onHeaderPreviewTextChange={setHeaderPreviewText}
              visibleHomeSections={activeFont.homeSettings.visibleSections}
              previewText={previewText}
              onPreviewTextChange={setPreviewText}
              presetBuilderRequestId={presetBuilderRequestId}
              selectedGlyph={selectedGlyph}
              spacebarGlyph={spacebarGlyph}
            />
          </div>
          {homeMode === "design" && activeFont.homeSettings.visibleSections.glyphQueue && (
            <FontMetricsPanel
              font={activeFont}
              previewText={previewText}
              selectedCharacter={selectedCharacter}
              onSelectCharacter={handleSelectCharacter}
            />
          )}
          {homeMode === "compile" && activeBook && (
            <CompileView
              activeBook={activeBook}
              activePageId={activeCompiledPageId}
              books={bookCompilations}
              pages={compilationPages}
              onAddStructureItem={handleAddBookStructureItem}
              onCreateBook={handleCreateBookCompilation}
              onMovePlacedPage={handleMovePlacedPage}
              onMovePlacedPageToLocation={handleMovePlacedPageToLocation}
              onDeletePage={handleDeleteCompiledPage}
              onOpenAppMenu={toggleSidebar}
              onPlacePage={handlePlaceCompiledPage}
              onRemoveStructureItem={handleRemoveBookStructureItem}
              onRemovePlacedPage={handleRemovePlacedPage}
              onRenameBook={handleRenameBookCompilation}
              onRenameStructureItem={handleRenameBookStructureItem}
              onSelectBook={setActiveBookId}
              onSelectPage={setActiveCompiledPageId}
              onUploadPages={handleUploadCompiledPages}
            />
          )}
          {homeMode === "library" && activeBook && (
            <QuillLibraryView
              activeBook={activeBook}
              activePageId={activeCompiledPageId}
              books={bookCompilations}
              pages={compilationPages}
              onOpenAppMenu={toggleSidebar}
              onOpenBook={setActiveBookId}
              onOpenPage={setActiveCompiledPageId}
            />
          )}
          {homeMode === "backgrounds" && (
            <BackgroundDesigner
              backgrounds={customBackgrounds}
              onBackgroundsChange={setCustomBackgrounds}
              onOpenAppMenu={toggleSidebar}
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

function resolveAutoEntryPresetId(
  presets: PreviewDesignPresetSummary[],
  kind: AutoEntryKind,
): string | undefined {
  const labels =
    kind === "story"
      ? new Set(["story", "story entry"])
      : new Set(["changelog", "change log", "changelog entry", "change log entry"]);

  return presets.find((preset) => labels.has(preset.name.trim().toLowerCase()))?.id;
}

function buildAutoEntryRenderJob(
  request: PendingAutoEntryRequest,
  compiledPages: CompiledPage[],
  updateEntries: UpdateEntry[],
  previewDesignPresets: PreviewDesignPresetSummary[],
): AutoEntryRenderJob {
  return {
    bookId: request.bookId,
    entries: (["story", "changelog"] as const).map((kind) => {
      const latestPage = getLatestAutoEntryPageInfo(updateEntries, request.bookId, kind);
      const compiledPage = latestPage ? compiledPages.find((page) => page.id === latestPage.pageId) : undefined;
      const currentPageNumber = latestPage?.pageNumber ?? 1;
      const currentPageId = compiledPage?.id;
      const presetId = resolveAutoEntryPresetId(previewDesignPresets, kind);

      return {
        currentPageId,
        currentPageText: compiledPage?.textContent,
        kind,
        nextPageNumber: (latestPage?.pageNumber ?? 0) + 1,
        pageNumber: currentPageNumber,
        pageTitle: `${kind === "story" ? "Story" : "Changelog"} ${currentPageNumber}`,
        presetId,
        text: kind === "story" ? request.pair.storyText : request.pair.changelogText,
      };
    }),
    requestId: request.id,
  };
}

function buildCompilationPages(
  compiledPages: CompiledPage[],
  updateEntries: UpdateEntry[],
  activityLog: ProjectActivity[],
): CompiledPage[] {
  const pages = [...compiledPages];
  const pageIds = new Set(pages.map((page) => page.id));
  const renderedActivityIds = new Set(updateEntries.map((entry) => entry.sourceActivityId));

  for (const entry of updateEntries) {
    addEntryPage(pages, pageIds, {
      createdAt: entry.createdAt,
      id: entry.storyPageId,
      text: entry.storyText,
      title: `Story ${entry.storyPageNumber}`,
    });
    addEntryPage(pages, pageIds, {
      createdAt: entry.createdAt,
      id: entry.changelogPageId,
      text: entry.changelogText,
      title: `Changelog ${entry.changelogPageNumber}`,
    });
  }

  for (const activity of activityLog.filter(isMeaningfulAutoEntryActivity)) {
    if (renderedActivityIds.has(activity.id)) {
      continue;
    }

    const pair = buildAutoEntryPair(activity);
    const stamp = formatAutoEntryTimestamp(pair.createdAt);
    addEntryPage(pages, pageIds, {
      createdAt: pair.createdAt,
      id: `entry-story-${pair.sourceActivityId}`,
      text: pair.storyText,
      title: `Story Entry - ${stamp}`,
    });
    addEntryPage(pages, pageIds, {
      createdAt: pair.createdAt,
      id: `entry-changelog-${pair.sourceActivityId}`,
      text: pair.changelogText,
      title: `Changelog Entry - ${stamp}`,
    });
  }

  return pages;
}

function addEntryPage(
  pages: CompiledPage[],
  pageIds: Set<string>,
  entry: {
    createdAt: string;
    id: string;
    text: string;
    title: string;
  },
) {
  if (pageIds.has(entry.id)) {
    return;
  }

  pageIds.add(entry.id);
  pages.push({
    createdAt: entry.createdAt,
    excerpt: getEntryExcerpt(entry.text),
    height: 1200,
    id: entry.id,
    textContent: entry.text,
    title: entry.title,
    updatedAt: entry.createdAt,
    width: 900,
  });
}

function getEntryExcerpt(text: string): string {
  return text.replace(/\s+/g, " ").trim().slice(0, 150) || "Saved entry.";
}

function loadDeletedCompiledPageIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(deletedCompiledPageIdsStorageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
  } catch {
    return [];
  }
}

function saveDeletedCompiledPageIds(pageIds: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(deletedCompiledPageIdsStorageKey, JSON.stringify(pageIds));
}

function getUploadedPageTitle(fileName: string): string {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Uploaded Page";
}

function getImageFileDimensions(file: File): Promise<{ height: number; width: number }> {
  return new Promise((resolve) => {
    const imageUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(imageUrl);
      resolve({
        height: image.naturalHeight || 1920,
        width: image.naturalWidth || 1080,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(imageUrl);
      resolve({ height: 1920, width: 1080 });
    };
    image.src = imageUrl;
  });
}

function removeCompiledPageReferencesFromBooks(books: BookCompilation[], pageId: string): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) => {
    let changed = false;
    const structureItems = book.structureItems.map((item) => {
      const placedPages = item.placedPages.filter((page) => page.pageId !== pageId);
      if (placedPages.length === item.placedPages.length) {
        return item;
      }

      changed = true;
      return { ...item, placedPages };
    });

    return changed
      ? {
          ...book,
          placedPages: structureItems.flatMap((item) => item.placedPages),
          structureItems,
          updatedAt: now,
        }
      : book;
  });
}
