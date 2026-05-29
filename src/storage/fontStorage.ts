import { supportedCharacters } from "../data/characterSets";
import type { FontSet, FontStudioData, Glyph } from "../types/fontTypes";

const STORAGE_KEY = "local-font-studio:data:v1";

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

function createDefaultData(): FontStudioData {
  const font = createDefaultFontSet();

  return {
    version: 1,
    activeFontId: font.id,
    fonts: [font],
  };
}

function isRemovedAngryPreset(font: FontSet) {
  return font.name === "Angry Face" || font.theme?.backgroundStyle === "rage";
}

function normalizeFont(font: FontSet): FontSet {
  const normalizedGlyphs = supportedCharacters.reduce<Record<string, Glyph>>((map, character) => {
    const storedGlyph = font.glyphs?.[character];
    map[character] = storedGlyph
      ? {
          ...createEmptyGlyph(character),
          ...storedGlyph,
          character,
          strokes: Array.isArray(storedGlyph.strokes) ? storedGlyph.strokes : [],
        }
      : createEmptyGlyph(character);

    return map;
  }, {});

  return {
    ...font,
    name: font.name || "My First Font",
    glyphs: normalizedGlyphs,
  };
}

export function loadFontStudioData(): FontStudioData {
  if (typeof window === "undefined") {
    return createDefaultData();
  }

  const rawData = window.localStorage.getItem(STORAGE_KEY);

  if (!rawData) {
    return createDefaultData();
  }

  try {
    const parsed = JSON.parse(rawData) as FontStudioData;

    if (!Array.isArray(parsed.fonts) || parsed.fonts.length === 0) {
      return createDefaultData();
    }

    const fonts = parsed.fonts.filter((font) => !isRemovedAngryPreset(font)).map(normalizeFont);

    if (fonts.length === 0) {
      return createDefaultData();
    }

    const activeFontId = fonts.some((font) => font.id === parsed.activeFontId)
      ? parsed.activeFontId
      : fonts[0].id;

    return {
      version: 1,
      activeFontId,
      fonts,
    };
  } catch {
    return createDefaultData();
  }
}

export function saveFontStudioData(data: FontStudioData) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
