import { fontCharacters, spacebar } from "../data/characterSets";
import type {
  BackgroundStyle,
  BackgroundTexture,
  ConstructionAnchorPoint,
  ConstructionCornerStyle,
  ConstructionPath,
  ConstructionPointType,
  ConstructionSegmentType,
  FontCharacterSettings,
  FontGuideSettings,
  FontRenderProfile,
  FontSet,
  FontShapeSettings,
  FontStudioData,
  FontTheme,
  GlyphInkEffect,
  Glyph,
  GlyphDecoration,
  GlyphPoint,
  GlyphVariant,
  GlyphStroke,
  GlyphStrokeTool,
  ProjectActivity,
  ProjectActivityDraft,
  ProjectBackup,
  FontExportFile,
  GlyphConstruction,
  ProjectExportFile,
  StorageHealthCheck,
} from "../types/fontTypes";

const STORAGE_KEY = "local-font-studio:data:v1";
const BACKUP_STORAGE_KEY = "local-font-studio:backups:v1";
const CORRUPT_STORAGE_KEY = "local-font-studio:data:corrupt:v1";
const CURRENT_STORAGE_VERSION = 2;
const MAX_ACTIVITY_ENTRIES = 80;
const MAX_BACKUPS = 12;
const AUTO_BACKUP_INTERVAL_MS = 5 * 60 * 1000;
const GLYPH_CANVAS_SIZE = 720;
const DEFAULT_STROKE_SIZE = 4 / GLYPH_CANVAS_SIZE;
const MIN_STROKE_SIZE = 3 / GLYPH_CANVAS_SIZE;
const MAX_STROKE_SIZE = 64 / GLYPH_CANVAS_SIZE;

type SaveOptions = {
  backupReason?: string;
  createBackup?: boolean;
};

export type LoadFontStudioDataResult = {
  data: FontStudioData;
  health: StorageHealthCheck;
};

export const defaultGlyphMetrics = {
  width: 1,
  height: 1,
  xAdvance: 0.74,
  baselineOffset: 0.76,
  leftBearing: 0.08,
  rightBearing: 0.08,
};

export const defaultSpacebarMetrics = {
  ...defaultGlyphMetrics,
  leftBearing: 0,
  rightBearing: 0,
  width: 0.36,
  xAdvance: 0.36,
};

export const quillParchmentTheme: FontTheme = {
  accentColor: "#9b6f3b",
  backgroundColor: "#efe0bd",
  backgroundStyle: "parchment",
  backgroundTexture: "fiber",
  inkColor: "#2a160d",
};

export const defaultFontCharacterSettings: FontCharacterSettings = {
  showForgotten: false,
  showHeaderLetters: false,
  showSpacebar: false,
};

export const defaultFontShapeSettings: FontShapeSettings = {
  heightScale: 1,
  widthScale: 1,
};

export const defaultFontGuideSettings: FontGuideSettings = {
  ascender: 0.14,
  baseline: 0.76,
  descender: 0.9,
  leftBound: 0.1,
  rightBound: 0.9,
  xHeight: 0.42,
};

const legacyFontCharacterSettings: FontCharacterSettings = {
  showForgotten: true,
  showHeaderLetters: false,
  showSpacebar: false,
};

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyGlyph(character: string): Glyph {
  return {
    character,
    decorations: [],
    strokes: [],
    ...(character === spacebar ? defaultSpacebarMetrics : defaultGlyphMetrics),
    updatedAt: new Date().toISOString(),
  };
}

export function createFontSet(
  name: string,
  renderProfile: FontRenderProfile = "plain",
  characterSettings: FontCharacterSettings = defaultFontCharacterSettings,
  guideSettings: FontGuideSettings = defaultFontGuideSettings,
  shapeSettings: FontShapeSettings = defaultFontShapeSettings,
): FontSet {
  const safeGuideSettings = normalizeGuideSettings(guideSettings, defaultFontGuideSettings);
  const glyphs = fontCharacters.reduce<Record<string, Glyph>>((map, character) => {
    const glyph = createEmptyGlyph(character);
    map[character] = character === spacebar
      ? glyph
      : {
          ...glyph,
          baselineOffset: safeGuideSettings.baseline,
    };
    return map;
  }, {});

  const now = new Date().toISOString();

  return {
    id: createId("font"),
    name,
    characterSettings: { ...characterSettings },
    glyphs,
    createdAt: now,
    guideSettings: { ...safeGuideSettings },
    ...(renderProfile === "quillParchment" ? { renderProfile, theme: quillParchmentTheme } : {}),
    shapeSettings: { ...shapeSettings },
    updatedAt: now,
  };
}

export function createDefaultFontSet(): FontSet {
  return createFontSet("My First Font");
}

function getStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function createDefaultData(activity?: ProjectActivity): FontStudioData {
  const font = createDefaultFontSet();

  return {
    version: CURRENT_STORAGE_VERSION,
    activeFontId: font.id,
    activityLog: activity ? [activity] : [],
    fonts: [font],
  };
}

function createStorageHealth(
  status: StorageHealthCheck["status"],
  message: string,
  warnings: string[] = [],
  recoveredBackupId?: string,
): StorageHealthCheck {
  return {
    checkedAt: new Date().toISOString(),
    message,
    recoveredBackupId,
    status,
    storageVersion: CURRENT_STORAGE_VERSION,
    warnings,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function safeNumber(value: unknown, fallback: number, min = 0, max = 4) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function isRemovedAngryPreset(font: Partial<FontSet>) {
  return font.name === "Angry Face" || font.theme?.backgroundStyle === "rage";
}

function normalizeRenderProfile(value: unknown): FontRenderProfile | undefined {
  return value === "quillParchment" ? "quillParchment" : undefined;
}

function normalizeBackgroundTexture(value: unknown): BackgroundTexture {
  return value === "clean" || value === "fiber" || value === "canvas" || value === "woven"
    ? value
    : value === "stained"
      ? "canvas"
      : "grain";
}

function normalizeStrokeTool(value: unknown): GlyphStrokeTool | undefined {
  return value === "quill" ? "quill" : undefined;
}

function normalizeGlyphInkEffect(value: unknown): GlyphInkEffect | undefined {
  return value === "dramaticPooling" || value === "subtleSpread" || value === "bubbleHighlight" ? value : undefined;
}

function normalizeCharacterSettings(value: unknown, fallback: FontCharacterSettings): FontCharacterSettings {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    showForgotten: typeof value.showForgotten === "boolean" ? value.showForgotten : fallback.showForgotten,
    showHeaderLetters:
      typeof value.showHeaderLetters === "boolean" ? value.showHeaderLetters : fallback.showHeaderLetters,
    showSpacebar: typeof value.showSpacebar === "boolean" ? value.showSpacebar : fallback.showSpacebar,
  };
}

function normalizeGuideSettings(value: unknown, fallback: FontGuideSettings): FontGuideSettings {
  if (!isRecord(value)) {
    return fallback;
  }

  const ascender = safeNumber(value.ascender, fallback.ascender, 0.04, 0.72);
  const xHeight = safeNumber(value.xHeight, fallback.xHeight, 0.08, 0.82);
  const baseline = safeNumber(value.baseline, fallback.baseline, 0.12, 0.92);
  const descender = safeNumber(value.descender, fallback.descender, 0.2, 0.98);
  const leftBound = safeNumber(value.leftBound, fallback.leftBound, 0.02, 0.9);
  const rightBound = safeNumber(value.rightBound, fallback.rightBound, 0.1, 0.98);
  const safeAscender = Math.min(0.72, Math.max(0.04, ascender));
  const safeXHeight = Math.min(0.82, Math.max(safeAscender + 0.04, xHeight));
  const safeBaseline = Math.min(0.92, Math.max(safeXHeight + 0.04, baseline));
  const safeDescender = Math.min(0.98, Math.max(safeBaseline + 0.04, descender));
  const safeLeftBound = Math.min(0.9, Math.max(0.02, leftBound));
  const safeRightBound = Math.min(0.98, Math.max(safeLeftBound + 0.08, rightBound));

  return {
    ascender: Number(safeAscender.toFixed(2)),
    baseline: Number(safeBaseline.toFixed(2)),
    descender: Number(safeDescender.toFixed(2)),
    leftBound: Number(safeLeftBound.toFixed(2)),
    rightBound: Number(safeRightBound.toFixed(2)),
    xHeight: Number(safeXHeight.toFixed(2)),
  };
}

function normalizeShapeSettings(value: unknown, fallback: FontShapeSettings): FontShapeSettings {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    heightScale: safeNumber(value.heightScale, fallback.heightScale, 0.55, 1.6),
    widthScale: safeNumber(value.widthScale, fallback.widthScale, 0.55, 1.6),
  };
}

function normalizePoint(point: unknown): GlyphPoint | null {
  if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") {
    return null;
  }

  return {
    ...(typeof point.ink === "number" ? { ink: point.ink } : {}),
    ...(typeof point.pressure === "number" ? { pressure: point.pressure } : {}),
    ...(typeof point.spread === "number" ? { spread: safeNumber(point.spread, 0, 0, 1) } : {}),
    x: point.x,
    y: point.y,
  };
}

function normalizeStrokeSize(size: unknown) {
  if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) {
    return DEFAULT_STROKE_SIZE;
  }

  const normalizedSize = size > 0.5 ? size / GLYPH_CANVAS_SIZE : size;

  return Math.min(MAX_STROKE_SIZE, Math.max(MIN_STROKE_SIZE, normalizedSize));
}

function normalizeStroke(stroke: unknown): GlyphStroke | null {
  if (!isRecord(stroke)) {
    return null;
  }

  const points = Array.isArray(stroke.points)
    ? stroke.points.map(normalizePoint).filter((point): point is GlyphPoint => Boolean(point))
    : [];

  if (points.length === 0) {
    return null;
  }

  const inkEffect = normalizeGlyphInkEffect(stroke.inkEffect);

  return {
    ...(typeof stroke.color === "string" ? { color: stroke.color } : {}),
    ...(typeof stroke.highlightColor === "string" ? { highlightColor: stroke.highlightColor } : {}),
    ...(inkEffect ? { inkEffect } : {}),
    id: safeString(stroke.id, createId("stroke")),
    points,
    size: normalizeStrokeSize(stroke.size),
    ...(normalizeStrokeTool(stroke.strokeTool) ? { strokeTool: "quill" as const } : {}),
  };
}

function normalizeConstructionPointType(value: unknown): ConstructionPointType {
  return value === "smooth" || value === "symmetric" || value === "rounded" ? value : "corner";
}

function normalizeConstructionSegmentType(value: unknown): ConstructionSegmentType {
  return value === "curve" ? "curve" : "line";
}

function normalizeConstructionCornerStyle(value: unknown): ConstructionCornerStyle {
  return value === "rounded" || value === "chamfered" ? value : "sharp";
}

function normalizeConstructionHandle(value: unknown) {
  if (!isRecord(value)) {
    return undefined;
  }

  return {
    x: safeNumber(value.x, 0.5, -1, 2),
    y: safeNumber(value.y, 0.5, -1, 2),
  };
}

function normalizeConstructionPoint(point: unknown): ConstructionAnchorPoint | null {
  if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") {
    return null;
  }

  const cornerStyle = normalizeConstructionCornerStyle(point.cornerStyle);
  const normalizedPoint: ConstructionAnchorPoint = {
    ...(typeof point.chamferDistance === "number"
      ? { chamferDistance: safeNumber(point.chamferDistance, 0.04, 0, 0.32) }
      : {}),
    ...(typeof point.cornerRadius === "number"
      ? { cornerRadius: safeNumber(point.cornerRadius, 0.04, 0, 0.32) }
      : {}),
    cornerStyle,
    id: safeString(point.id, createId("anchor")),
    ...(normalizeConstructionHandle(point.inHandle) ? { inHandle: normalizeConstructionHandle(point.inHandle) } : {}),
    ...(normalizeConstructionHandle(point.outHandle) ? { outHandle: normalizeConstructionHandle(point.outHandle) } : {}),
    segmentType: normalizeConstructionSegmentType(point.segmentType),
    type: normalizeConstructionPointType(point.type),
    x: safeNumber(point.x, 0.5, -1, 2),
    y: safeNumber(point.y, 0.5, -1, 2),
  };

  return normalizedPoint;
}

function normalizeConstructionPath(path: unknown): ConstructionPath | null {
  if (!isRecord(path)) {
    return null;
  }

  const points = Array.isArray(path.points)
    ? path.points
        .map(normalizeConstructionPoint)
        .filter((point): point is ConstructionAnchorPoint => Boolean(point))
    : [];

  if (points.length === 0) {
    return null;
  }

  return {
    closed: typeof path.closed === "boolean" ? path.closed : false,
    ...(typeof path.fillColor === "string" ? { fillColor: path.fillColor } : {}),
    filled: typeof path.filled === "boolean" ? path.filled : false,
    id: safeString(path.id, createId("path")),
    points,
    ...(typeof path.strokeColor === "string" ? { strokeColor: path.strokeColor } : {}),
    strokeWidth: safeNumber(path.strokeWidth, 0.05, 0.004, 0.4),
  };
}

function normalizeConstruction(value: unknown): GlyphConstruction | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const paths = Array.isArray(value.paths)
    ? value.paths
        .map(normalizeConstructionPath)
        .filter((path): path is ConstructionPath => Boolean(path))
    : [];

  if (paths.length === 0) {
    return undefined;
  }

  if (paths.every((path) => path.id.startsWith("construction_sample_"))) {
    return undefined;
  }

  return {
    ...(typeof value.fillColor === "string" ? { fillColor: value.fillColor } : {}),
    paths,
    ...(typeof value.strokeColor === "string" ? { strokeColor: value.strokeColor } : {}),
  };
}

function normalizeDecoration(decoration: unknown): GlyphDecoration | null {
  if (!isRecord(decoration) || decoration.kind !== "googly-eyes") {
    return null;
  }

  const expression = typeof decoration.expression === "string"
    ? decoration.expression
    : undefined;

  return {
    ...(expression ? { expression: expression as GlyphDecoration["expression"] } : {}),
    id: safeString(decoration.id, createId("decoration")),
    kind: "googly-eyes",
    size: safeNumber(decoration.size, 0.18, 0.04, 0.8),
    x: safeNumber(decoration.x, 0.5, -1, 2),
    y: safeNumber(decoration.y, 0.35, -1, 2),
  };
}

function normalizeGlyphVariant(rawGlyph: unknown, character: string): GlyphVariant | null {
  if (!isRecord(rawGlyph)) {
    return null;
  }

  const construction = normalizeConstruction(rawGlyph.construction);

  return {
    character,
    ...(construction ? { construction } : {}),
    decorations: Array.isArray(rawGlyph.decorations)
      ? rawGlyph.decorations
          .map(normalizeDecoration)
          .filter((decoration): decoration is GlyphDecoration => Boolean(decoration))
      : [],
    strokes: Array.isArray(rawGlyph.strokes)
      ? rawGlyph.strokes.map(normalizeStroke).filter((stroke): stroke is GlyphStroke => Boolean(stroke))
      : [],
    width: safeNumber(rawGlyph.width, defaultGlyphMetrics.width, 0.1, 3),
    height: safeNumber(rawGlyph.height, defaultGlyphMetrics.height, 0.1, 3),
    xAdvance: safeNumber(rawGlyph.xAdvance, defaultGlyphMetrics.xAdvance, 0.1, 3),
    baselineOffset: safeNumber(rawGlyph.baselineOffset, defaultGlyphMetrics.baselineOffset, -2, 2),
    leftBearing: safeNumber(rawGlyph.leftBearing, defaultGlyphMetrics.leftBearing, -1, 1),
    rightBearing: safeNumber(rawGlyph.rightBearing, defaultGlyphMetrics.rightBearing, -1, 1),
    updatedAt: safeString(rawGlyph.updatedAt, new Date().toISOString()),
  };
}

function normalizeGlyph(rawGlyph: unknown, character: string): Glyph {
  const emptyGlyph = createEmptyGlyph(character);

  if (!isRecord(rawGlyph)) {
    return emptyGlyph;
  }

  const construction = normalizeConstruction(rawGlyph.construction);
  const normalizedGlyph = {
    ...emptyGlyph,
    width: safeNumber(rawGlyph.width, emptyGlyph.width, 0.1, 3),
    height: safeNumber(rawGlyph.height, emptyGlyph.height, 0.1, 3),
    xAdvance: safeNumber(rawGlyph.xAdvance, emptyGlyph.xAdvance, 0.1, 3),
    baselineOffset: safeNumber(rawGlyph.baselineOffset, emptyGlyph.baselineOffset, -2, 2),
    leftBearing: safeNumber(rawGlyph.leftBearing, emptyGlyph.leftBearing, -1, 1),
    rightBearing: safeNumber(rawGlyph.rightBearing, emptyGlyph.rightBearing, -1, 1),
    character,
    ...(construction ? { construction } : {}),
    decorations: Array.isArray(rawGlyph.decorations)
      ? rawGlyph.decorations
          .map(normalizeDecoration)
          .filter((decoration): decoration is GlyphDecoration => Boolean(decoration))
      : [],
    strokes: Array.isArray(rawGlyph.strokes)
      ? rawGlyph.strokes.map(normalizeStroke).filter((stroke): stroke is GlyphStroke => Boolean(stroke))
      : [],
    variants: Array.isArray(rawGlyph.variants)
      ? rawGlyph.variants
          .map((variant) => normalizeGlyphVariant(variant, character))
          .filter((variant): variant is GlyphVariant => Boolean(variant))
      : [],
    updatedAt: safeString(rawGlyph.updatedAt, emptyGlyph.updatedAt),
  };

  if (
    character === spacebar &&
    normalizedGlyph.strokes.length === 0 &&
    normalizedGlyph.decorations.length === 0 &&
    normalizedGlyph.xAdvance === defaultGlyphMetrics.xAdvance
  ) {
    return {
      ...normalizedGlyph,
      leftBearing: defaultSpacebarMetrics.leftBearing,
      rightBearing: defaultSpacebarMetrics.rightBearing,
      width: defaultSpacebarMetrics.width,
      xAdvance: defaultSpacebarMetrics.xAdvance,
    };
  }

  return normalizedGlyph;
}

function normalizeFont(font: unknown, usedFontIds: Set<string>, fallbackName: string): FontSet | null {
  if (!isRecord(font)) {
    return null;
  }

  if (isRemovedAngryPreset(font)) {
    return null;
  }

  const now = new Date().toISOString();
  const rawId = safeString(font.id, createId("font"));
  const id = usedFontIds.has(rawId) ? createId("font") : rawId;
  usedFontIds.add(id);

  const rawGlyphs = isRecord(font.glyphs) ? font.glyphs : {};
  const glyphs = fontCharacters.reduce<Record<string, Glyph>>((map, character) => {
    map[character] = normalizeGlyph(rawGlyphs[character], character);
    return map;
  }, {});

  return {
    id,
    name: safeString(font.name, fallbackName),
    characterSettings: normalizeCharacterSettings(font.characterSettings, legacyFontCharacterSettings),
    glyphs,
    createdAt: safeString(font.createdAt, now),
    guideSettings: normalizeGuideSettings(font.guideSettings, defaultFontGuideSettings),
    ...(normalizeRenderProfile(font.renderProfile) ? { renderProfile: "quillParchment" as const } : {}),
    shapeSettings: normalizeShapeSettings(font.shapeSettings, defaultFontShapeSettings),
    ...(isRecord(font.theme)
      ? {
          theme: {
            accentColor: safeString(font.theme.accentColor, "#82d0bc"),
            backgroundColor: safeString(font.theme.backgroundColor, "#f3dfb6"),
            backgroundStyle: safeString(font.theme.backgroundStyle, "paper") as BackgroundStyle,
            backgroundTexture: normalizeBackgroundTexture(font.theme.backgroundTexture),
            inkColor: safeString(font.theme.inkColor, "#191512"),
          },
        }
      : {}),
    updatedAt: safeString(font.updatedAt, now),
  };
}

function normalizeActivity(activity: unknown): ProjectActivity | null {
  if (!isRecord(activity)) {
    return null;
  }

  const type = typeof activity.type === "string" ? activity.type : "recovery";
  const message = typeof activity.message === "string" ? activity.message : "";

  if (!message) {
    return null;
  }

  return {
    ...(typeof activity.character === "string" ? { character: activity.character } : {}),
    ...(isRecord(activity.details) ? { details: activity.details as ProjectActivity["details"] } : {}),
    ...(typeof activity.fontId === "string" ? { fontId: activity.fontId } : {}),
    createdAt: safeString(activity.createdAt, new Date().toISOString()),
    id: safeString(activity.id, createId("activity")),
    message,
    type: type as ProjectActivity["type"],
  };
}

function migrateFontStudioData(rawData: unknown): FontStudioData {
  if (!isRecord(rawData)) {
    return createDefaultData();
  }

  const sourceVersion = typeof rawData.version === "number" ? rawData.version : 1;
  const usedFontIds = new Set<string>();
  const fonts = (Array.isArray(rawData.fonts) ? rawData.fonts : [])
    .map((font, index) => normalizeFont(font, usedFontIds, `Font ${index + 1}`))
    .filter((font): font is FontSet => Boolean(font));

  const safeFonts = fonts.length > 0 ? fonts : [createDefaultFontSet()];
  const activeFontId = safeFonts.some((font) => font.id === rawData.activeFontId)
    ? String(rawData.activeFontId)
    : safeFonts[0].id;

  const activityLog = (Array.isArray(rawData.activityLog) ? rawData.activityLog : [])
    .map(normalizeActivity)
    .filter((activity): activity is ProjectActivity => Boolean(activity))
    .slice(0, MAX_ACTIVITY_ENTRIES);

  const migratedData: FontStudioData = {
    version: CURRENT_STORAGE_VERSION,
    activeFontId,
    activityLog,
    fonts: safeFonts,
    ...(typeof rawData.lastBackupAt === "string" ? { lastBackupAt: rawData.lastBackupAt } : {}),
  };

  if (sourceVersion < CURRENT_STORAGE_VERSION) {
    return recordProjectActivity(migratedData, {
      type: "migration",
      message: `Migrated project storage from v${sourceVersion} to v${CURRENT_STORAGE_VERSION}.`,
    });
  }

  return migratedData;
}

function hasCountableGlyphMarks(glyph: Glyph | GlyphVariant) {
  return glyph.strokes.length > 0 || glyph.decorations.length > 0;
}

function countDrawnGlyphs(data: FontStudioData) {
  return data.fonts.reduce(
    (total, font) =>
      total +
      Object.values(font.glyphs).filter(
        (glyph) => hasCountableGlyphMarks(glyph) || glyph.variants?.some(hasCountableGlyphMarks),
      ).length,
    0,
  );
}

function createBackupRecord(data: FontStudioData, reason: string, createdAt = new Date().toISOString()): ProjectBackup {
  const activeFont = data.fonts.find((font) => font.id === data.activeFontId) ?? data.fonts[0];

  return {
    activeFontName: activeFont?.name ?? "Project",
    createdAt,
    data: {
      ...data,
      lastBackupAt: createdAt,
    },
    fontCount: data.fonts.length,
    glyphCount: countDrawnGlyphs(data),
    id: createId("backup"),
    reason,
  };
}

function normalizeBackup(backup: unknown): ProjectBackup | null {
  if (!isRecord(backup) || !backup.data) {
    return null;
  }

  const data = migrateFontStudioData(backup.data);
  const createdAt = safeString(backup.createdAt, new Date().toISOString());

  return {
    activeFontName: safeString(backup.activeFontName, data.fonts[0]?.name ?? "Project"),
    createdAt,
    data,
    fontCount: typeof backup.fontCount === "number" ? backup.fontCount : data.fonts.length,
    glyphCount: typeof backup.glyphCount === "number" ? backup.glyphCount : countDrawnGlyphs(data),
    id: safeString(backup.id, createId("backup")),
    reason: safeString(backup.reason, "restore point"),
  };
}

function saveBackups(backups: ProjectBackup[]) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(BACKUP_STORAGE_KEY, JSON.stringify(backups.slice(0, MAX_BACKUPS)));
}

function clearAutomaticBackups() {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.removeItem(BACKUP_STORAGE_KEY);
}

function maybeCreateAutomaticBackupFromRaw(rawData: string | null, reason: string) {
  if (!rawData) {
    return;
  }

  try {
    const backups = loadProjectBackups();
    const latestBackup = backups[0];
    const now = Date.now();

    if (
      reason === "autosave" &&
      latestBackup &&
      now - new Date(latestBackup.createdAt).getTime() < AUTO_BACKUP_INTERVAL_MS
    ) {
      return;
    }

    const data = migrateFontStudioData(JSON.parse(rawData));
    const backup = createBackupRecord(data, reason);
    saveBackups([backup, ...backups].slice(0, MAX_BACKUPS));
  } catch {
    // A broken current payload is handled by load recovery, not by autosave backups.
  }
}

export function loadProjectBackups(): ProjectBackup[] {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawBackups = storage.getItem(BACKUP_STORAGE_KEY);
    const parsed = rawBackups ? JSON.parse(rawBackups) : [];

    return (Array.isArray(parsed) ? parsed : [])
      .map(normalizeBackup)
      .filter((backup): backup is ProjectBackup => Boolean(backup))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, MAX_BACKUPS);
  } catch {
    return [];
  }
}

export function createProjectBackup(data: FontStudioData, reason: string) {
  const backup = createBackupRecord(migrateFontStudioData(data), reason);
  const backups = loadProjectBackups();
  saveBackups([backup, ...backups].slice(0, MAX_BACKUPS));
  return backup;
}

export function recordProjectActivity(data: FontStudioData, draft: ProjectActivityDraft): FontStudioData {
  const entry: ProjectActivity = {
    ...draft,
    createdAt: new Date().toISOString(),
    id: createId("activity"),
  };

  return {
    ...data,
    activityLog: [entry, ...(data.activityLog ?? [])].slice(0, MAX_ACTIVITY_ENTRIES),
  };
}

export function cloneFontSet(font: FontSet, existingFonts: FontSet[], requestedName?: string): FontSet {
  const now = new Date().toISOString();
  const existingNames = new Set(existingFonts.map((item) => item.name));
  const baseName = requestedName?.trim() || `${font.name} Copy`;
  let name = baseName;
  let copyNumber = 2;

  while (existingNames.has(name)) {
    name = `${baseName} ${copyNumber}`;
    copyNumber += 1;
  }

  return {
    ...font,
    id: createId("font"),
    name,
    glyphs: Object.fromEntries(
      Object.entries(font.glyphs).map(([character, glyph]) => [
        character,
        {
          ...glyph,
          character,
          decorations: (glyph.decorations ?? []).map((decoration) => ({
            ...decoration,
            id: createId("decoration"),
          })),
          strokes: glyph.strokes.map((stroke) => ({
            ...stroke,
            id: createId("stroke"),
            points: stroke.points.map((point) => ({ ...point })),
          })),
          variants: (glyph.variants ?? []).map((variant) => ({
            ...variant,
            character,
            decorations: (variant.decorations ?? []).map((decoration) => ({
              ...decoration,
              id: createId("decoration"),
            })),
            strokes: variant.strokes.map((stroke) => ({
              ...stroke,
              id: createId("stroke"),
              points: stroke.points.map((point) => ({ ...point })),
            })),
            updatedAt: now,
          })),
          updatedAt: now,
        },
      ]),
    ),
    createdAt: now,
    updatedAt: now,
  };
}

export function loadFontStudioDataWithHealth(): LoadFontStudioDataResult {
  const storage = getStorage();

  if (!storage) {
    return {
      data: createDefaultData(),
      health: createStorageHealth("ok", "Storage is unavailable in this environment; using an in-memory project."),
    };
  }

  const rawData = storage.getItem(STORAGE_KEY);

  if (!rawData) {
    return {
      data: createDefaultData(),
      health: createStorageHealth("ok", "Started a fresh local project."),
    };
  }

  try {
    const parsed = JSON.parse(rawData);
    const sourceVersion = isRecord(parsed) && typeof parsed.version === "number" ? parsed.version : 1;
    const data = migrateFontStudioData(parsed);
    const status = sourceVersion < CURRENT_STORAGE_VERSION ? "migrated" : "ok";
    const message = status === "migrated"
      ? `Migrated stored project from v${sourceVersion} to v${CURRENT_STORAGE_VERSION}.`
      : "Project storage is healthy.";

    return {
      data,
      health: createStorageHealth(status, message),
    };
  } catch {
    storage.setItem(
      CORRUPT_STORAGE_KEY,
      JSON.stringify({
        capturedAt: new Date().toISOString(),
        rawData,
      }),
    );

    const backup = loadProjectBackups()[0];

    if (backup) {
      const data = recordProjectActivity(backup.data, {
        type: "recovery",
        message: `Recovered project from backup "${backup.reason}".`,
      });

      return {
        data,
        health: createStorageHealth(
          "recovered",
          "Current project data was malformed, so the latest backup was restored.",
          ["The corrupt payload was preserved in recovery storage."],
          backup.id,
        ),
      };
    }

    return {
      data: createDefaultData({
        createdAt: new Date().toISOString(),
        id: createId("activity"),
        message: "Reset project after malformed storage could not be recovered.",
        type: "recovery",
      }),
      health: createStorageHealth(
        "reset",
        "Current project data was malformed and no usable backup existed, so a fresh project was created.",
        ["The corrupt payload was preserved in recovery storage."],
      ),
    };
  }
}

export function loadFontStudioData(): FontStudioData {
  return loadFontStudioDataWithHealth().data;
}

export function saveFontStudioData(data: FontStudioData, options: SaveOptions = {}) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  const backupReason = options.backupReason ?? "autosave";

  if (options.createBackup !== false) {
    maybeCreateAutomaticBackupFromRaw(storage.getItem(STORAGE_KEY), backupReason);
  }

  const payload = JSON.stringify(migrateFontStudioData(data));

  try {
    storage.setItem(STORAGE_KEY, payload);
  } catch {
    clearAutomaticBackups();
    storage.setItem(STORAGE_KEY, payload);
  }
}

export function exportFontStudioProject(data: FontStudioData) {
  const exportFile: ProjectExportFile = {
    app: "local-font-studio",
    data: migrateFontStudioData(data),
    exportedAt: new Date().toISOString(),
    schemaVersion: CURRENT_STORAGE_VERSION,
  };

  return JSON.stringify(exportFile, null, 2);
}

export function exportFontSet(font: FontSet) {
  const exportFile: FontExportFile = {
    app: "local-font-studio",
    exportType: "font",
    exportedAt: new Date().toISOString(),
    font,
    schemaVersion: CURRENT_STORAGE_VERSION,
  };

  return JSON.stringify(exportFile, null, 2);
}

export function importFontStudioProject(jsonText: string): FontStudioData {
  const parsed = JSON.parse(jsonText) as unknown;
  const data = isRecord(parsed) && parsed.app === "local-font-studio" && parsed.data
    ? parsed.data
    : parsed;

  const importedData = migrateFontStudioData(data);

  return recordProjectActivity(importedData, {
    type: "import",
    message: "Imported project JSON.",
  });
}
