import { supportedCharacters } from "../data/characterSets";
import type {
  BackgroundStyle,
  FontSet,
  FontStudioData,
  Glyph,
  GlyphDecoration,
  GlyphPoint,
  GlyphStroke,
  ProjectActivity,
  ProjectActivityDraft,
  ProjectBackup,
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

export function createId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyGlyph(character: string): Glyph {
  return {
    character,
    decorations: [],
    strokes: [],
    ...defaultGlyphMetrics,
    updatedAt: new Date().toISOString(),
  };
}

export function createFontSet(name: string): FontSet {
  const glyphs = supportedCharacters.reduce<Record<string, Glyph>>((map, character) => {
    map[character] = createEmptyGlyph(character);
    return map;
  }, {});

  const now = new Date().toISOString();

  return {
    id: createId("font"),
    name,
    glyphs,
    createdAt: now,
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

function normalizePoint(point: unknown): GlyphPoint | null {
  if (!isRecord(point) || typeof point.x !== "number" || typeof point.y !== "number") {
    return null;
  }

  return {
    ...(typeof point.ink === "number" ? { ink: point.ink } : {}),
    ...(typeof point.pressure === "number" ? { pressure: point.pressure } : {}),
    x: point.x,
    y: point.y,
  };
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

  return {
    ...(typeof stroke.color === "string" ? { color: stroke.color } : {}),
    id: safeString(stroke.id, createId("stroke")),
    points,
    size: safeNumber(stroke.size, 8, 1, 64),
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

function normalizeGlyph(rawGlyph: unknown, character: string): Glyph {
  const emptyGlyph = createEmptyGlyph(character);

  if (!isRecord(rawGlyph)) {
    return emptyGlyph;
  }

  return {
    ...emptyGlyph,
    width: safeNumber(rawGlyph.width, emptyGlyph.width, 0.1, 3),
    height: safeNumber(rawGlyph.height, emptyGlyph.height, 0.1, 3),
    xAdvance: safeNumber(rawGlyph.xAdvance, emptyGlyph.xAdvance, 0.1, 3),
    baselineOffset: safeNumber(rawGlyph.baselineOffset, emptyGlyph.baselineOffset, -2, 2),
    leftBearing: safeNumber(rawGlyph.leftBearing, emptyGlyph.leftBearing, -1, 1),
    rightBearing: safeNumber(rawGlyph.rightBearing, emptyGlyph.rightBearing, -1, 1),
    character,
    decorations: Array.isArray(rawGlyph.decorations)
      ? rawGlyph.decorations
          .map(normalizeDecoration)
          .filter((decoration): decoration is GlyphDecoration => Boolean(decoration))
      : [],
    strokes: Array.isArray(rawGlyph.strokes)
      ? rawGlyph.strokes.map(normalizeStroke).filter((stroke): stroke is GlyphStroke => Boolean(stroke))
      : [],
    updatedAt: safeString(rawGlyph.updatedAt, emptyGlyph.updatedAt),
  };
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
  const glyphs = supportedCharacters.reduce<Record<string, Glyph>>((map, character) => {
    map[character] = normalizeGlyph(rawGlyphs[character], character);
    return map;
  }, {});

  return {
    id,
    name: safeString(font.name, fallbackName),
    glyphs,
    createdAt: safeString(font.createdAt, now),
    ...(isRecord(font.theme)
      ? {
          theme: {
            accentColor: safeString(font.theme.accentColor, "#82d0bc"),
            backgroundColor: safeString(font.theme.backgroundColor, "#f3dfb6"),
            backgroundStyle: safeString(font.theme.backgroundStyle, "paper") as BackgroundStyle,
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

function countDrawnGlyphs(data: FontStudioData) {
  return data.fonts.reduce(
    (total, font) =>
      total +
      Object.values(font.glyphs).filter(
        (glyph) => glyph.strokes.length > 0 || glyph.decorations.length > 0,
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

  storage.setItem(STORAGE_KEY, JSON.stringify(migrateFontStudioData(data)));
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
