import { supportedCharacters } from "../data/characterSets";
import type { FontSet, FontStudioData, Glyph, GlyphPoint, GlyphStroke } from "../types/fontTypes";

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

function stroke(points: GlyphPoint[], size = 0.028): GlyphStroke {
  return {
    id: createId("stroke"),
    points,
    size,
  };
}

function line(fromX: number, fromY: number, toX: number, toY: number, size = 0.028) {
  return stroke(
    [
      { x: fromX, y: fromY },
      { x: toX, y: toY },
    ],
    size,
  );
}

function curve(points: Array<readonly [number, number]>, size = 0.022) {
  return stroke(points.map(([x, y]) => ({ x, y })), size);
}

function clamp(value: number) {
  return Math.min(0.98, Math.max(0.02, value));
}

function wobbleValue(seed: number, index: number, axis: number, amount: number) {
  const raw = Math.sin(seed * 12.9898 + index * 78.233 + axis * 37.719) * 43758.5453;
  return (raw - Math.floor(raw) - 0.5) * amount;
}

function wobblyPoints(points: Array<readonly [number, number]>, seed: number, amount = 0.022) {
  return points.map(([x, y], index) => ({
    x: clamp(x + wobbleValue(seed, index, 1, amount)),
    y: clamp(y + wobbleValue(seed, index, 2, amount)),
  }));
}

function childStroke(points: Array<readonly [number, number]>, seed: number, size = 0.026, wobble = 0.022) {
  return stroke(wobblyPoints(points, seed, wobble), size);
}

function childLoop(
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  seed: number,
  size = 0.025,
  start = 0,
  end = Math.PI * 2,
) {
  const points: Array<readonly [number, number]> = [];
  const steps = 14;

  for (let index = 0; index <= steps; index += 1) {
    const angle = start + ((end - start) * index) / steps;
    points.push([centerX + Math.cos(angle) * radiusX, centerY + Math.sin(angle) * radiusY]);
  }

  return childStroke(points, seed, size, 0.018);
}

function circle(centerX: number, centerY: number, radius: number, size = 0.02) {
  const points: GlyphPoint[] = [];

  for (let index = 0; index <= 12; index += 1) {
    const angle = (Math.PI * 2 * index) / 12;
    points.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  }

  return stroke(points, size);
}

function createCharacterStrokes(character: string) {
  const lowerCharacter = character.toLowerCase();
  const isUppercase = character >= "A" && character <= "Z";
  const seed = character.charCodeAt(0) + (isUppercase ? 140 : 0);
  const top = isUppercase ? 0.13 : 0.2;
  const bottom = isUppercase ? 0.82 : 0.8;
  const strokes: GlyphStroke[] = [];

  switch (lowerCharacter) {
    case "a":
      strokes.push(childLoop(0.45, 0.55, 0.2, 0.22, seed), childStroke([[0.62, 0.38], [0.66, 0.78]], seed + 1));
      return strokes;
    case "b":
      strokes.push(childStroke([[0.28, top], [0.24, bottom]], seed), childLoop(0.47, 0.58, 0.21, 0.22, seed + 1));
      return strokes;
    case "c":
      return [childStroke([[0.68, 0.34], [0.48, 0.24], [0.26, 0.38], [0.23, 0.6], [0.36, 0.76], [0.65, 0.73]], seed, 0.028)];
    case "d":
      strokes.push(childLoop(0.43, 0.58, 0.2, 0.22, seed), childStroke([[0.66, top], [0.66, bottom]], seed + 1));
      return strokes;
    case "e":
      strokes.push(childStroke([[0.66, 0.36], [0.5, 0.24], [0.3, 0.34], [0.28, 0.56], [0.43, 0.73], [0.68, 0.67]], seed), childStroke([[0.32, 0.51], [0.66, 0.49]], seed + 1, 0.022));
      return strokes;
    case "f":
      strokes.push(childStroke([[0.62, top], [0.44, 0.15], [0.38, 0.38], [0.37, bottom]], seed), childStroke([[0.26, 0.43], [0.66, 0.41]], seed + 1));
      return strokes;
    case "g":
      strokes.push(childLoop(0.45, 0.53, 0.2, 0.2, seed), childStroke([[0.64, 0.38], [0.61, 0.78], [0.48, 0.94], [0.28, 0.88]], seed + 1));
      return strokes;
    case "h":
      strokes.push(childStroke([[0.28, top], [0.26, bottom]], seed), childStroke([[0.28, 0.52], [0.43, 0.36], [0.62, 0.5], [0.64, bottom]], seed + 1));
      return strokes;
    case "i":
      strokes.push(childStroke([[0.5, 0.37], [0.48, bottom]], seed), circle(0.49, 0.22, 0.025, 0.018));
      return strokes;
    case "j":
      strokes.push(childStroke([[0.55, 0.36], [0.54, 0.8], [0.43, 0.94], [0.31, 0.86]], seed), circle(0.56, 0.22, 0.025, 0.018));
      return strokes;
    case "k":
      strokes.push(childStroke([[0.3, top], [0.28, bottom]], seed), childStroke([[0.3, 0.57], [0.66, 0.33]], seed + 1), childStroke([[0.33, 0.56], [0.68, bottom]], seed + 2));
      return strokes;
    case "l":
      return [childStroke([[0.5, top], [0.48, bottom], [0.56, 0.82]], seed)];
    case "m":
      strokes.push(childStroke([[0.22, 0.45], [0.22, bottom]], seed), childStroke([[0.23, 0.5], [0.36, 0.36], [0.5, 0.53], [0.5, bottom]], seed + 1), childStroke([[0.5, 0.52], [0.63, 0.36], [0.76, 0.54], [0.76, bottom]], seed + 2));
      return strokes;
    case "n":
      strokes.push(childStroke([[0.27, 0.45], [0.27, bottom]], seed), childStroke([[0.27, 0.5], [0.45, 0.36], [0.65, 0.52], [0.66, bottom]], seed + 1));
      return strokes;
    case "o":
      return [childLoop(0.49, 0.55, 0.23, 0.25, seed, 0.028)];
    case "p":
      strokes.push(childStroke([[0.28, 0.38], [0.26, 0.94]], seed), childLoop(0.47, 0.52, 0.2, 0.2, seed + 1));
      return strokes;
    case "q":
      strokes.push(childLoop(0.45, 0.53, 0.2, 0.21, seed), childStroke([[0.64, 0.38], [0.66, 0.94]], seed + 1));
      return strokes;
    case "r":
      strokes.push(childStroke([[0.31, 0.43], [0.3, bottom]], seed), childStroke([[0.31, 0.5], [0.47, 0.35], [0.62, 0.42]], seed + 1));
      return strokes;
    case "s":
      return [childStroke([[0.66, 0.32], [0.45, 0.22], [0.28, 0.37], [0.42, 0.52], [0.64, 0.61], [0.55, 0.78], [0.28, 0.72]], seed, 0.028)];
    case "t":
      strokes.push(childStroke([[0.5, top + 0.08], [0.5, bottom]], seed), childStroke([[0.25, 0.42], [0.72, 0.4]], seed + 1));
      return strokes;
    case "u":
      return [childStroke([[0.28, 0.39], [0.27, 0.68], [0.42, 0.81], [0.62, 0.75], [0.65, 0.42], [0.66, 0.79]], seed, 0.028)];
    case "v":
      return [childStroke([[0.26, 0.38], [0.49, 0.8], [0.74, 0.38]], seed, 0.03)];
    case "w":
      return [childStroke([[0.18, 0.4], [0.33, 0.8], [0.49, 0.55], [0.61, 0.8], [0.82, 0.38]], seed, 0.028)];
    case "x":
      strokes.push(childStroke([[0.28, 0.36], [0.68, 0.8]], seed), childStroke([[0.68, 0.36], [0.27, 0.8]], seed + 1));
      return strokes;
    case "y":
      strokes.push(childStroke([[0.27, 0.38], [0.5, 0.68], [0.73, 0.38]], seed), childStroke([[0.5, 0.68], [0.41, 0.94]], seed + 1));
      return strokes;
    case "z":
      return [childStroke([[0.25, 0.35], [0.7, 0.34], [0.3, 0.78], [0.74, 0.77]], seed, 0.028)];
    case "0":
      return [childLoop(0.5, 0.52, 0.24, 0.34, seed, 0.028), childStroke([[0.64, 0.25], [0.36, 0.78]], seed + 1, 0.019)];
    case "1":
      return [childStroke([[0.44, 0.24], [0.55, 0.15], [0.53, 0.82]], seed, 0.03), childStroke([[0.39, 0.82], [0.66, 0.82]], seed + 1, 0.022)];
    case "2":
      return [childStroke([[0.3, 0.29], [0.5, 0.16], [0.72, 0.3], [0.64, 0.5], [0.32, 0.82], [0.74, 0.82]], seed, 0.028)];
    case "3":
      return [childStroke([[0.29, 0.24], [0.67, 0.24], [0.5, 0.49], [0.71, 0.62], [0.5, 0.83], [0.27, 0.72]], seed, 0.028)];
    case "4":
      strokes.push(childStroke([[0.62, 0.18], [0.62, 0.85]], seed), childStroke([[0.65, 0.18], [0.25, 0.58], [0.75, 0.58]], seed + 1, 0.027));
      return strokes;
    case "5":
      return [childStroke([[0.68, 0.2], [0.34, 0.2], [0.3, 0.47], [0.58, 0.46], [0.72, 0.64], [0.56, 0.82], [0.28, 0.74]], seed, 0.028)];
    case "6":
      return [childStroke([[0.66, 0.24], [0.38, 0.34], [0.28, 0.59], [0.38, 0.79], [0.65, 0.72], [0.64, 0.53], [0.38, 0.54]], seed, 0.028)];
    case "7":
      return [childStroke([[0.26, 0.22], [0.74, 0.22], [0.43, 0.84]], seed, 0.03)];
    case "8":
      return [childLoop(0.5, 0.36, 0.18, 0.17, seed, 0.025), childLoop(0.5, 0.67, 0.22, 0.21, seed + 1, 0.027)];
    case "9":
      return [childStroke([[0.65, 0.79], [0.66, 0.33], [0.52, 0.19], [0.3, 0.28], [0.31, 0.48], [0.55, 0.5], [0.67, 0.36]], seed, 0.028)];
    case ".":
      return [circle(0.5, 0.82, 0.035, 0.03)];
    case ",":
      return [circle(0.48, 0.78, 0.032, 0.028), line(0.5, 0.81, 0.42, 0.92, 0.022)];
    case "?":
      return [
        curve([[0.34, 0.25], [0.44, 0.14], [0.6, 0.15], [0.68, 0.28], [0.61, 0.43], [0.5, 0.52]], 0.026),
        circle(0.5, 0.82, 0.032, 0.026),
      ];
    case "!":
      return [line(0.5, 0.17, 0.5, 0.66, 0.03), circle(0.5, 0.82, 0.034, 0.03)];
    case ":":
      return [circle(0.5, 0.36, 0.032, 0.026), circle(0.5, 0.72, 0.032, 0.026)];
    case ";":
      return [circle(0.5, 0.36, 0.032, 0.026), circle(0.48, 0.72, 0.032, 0.026), line(0.5, 0.75, 0.42, 0.9, 0.022)];
    case "'":
      return [line(0.52, 0.13, 0.46, 0.34, 0.028)];
    case "\"":
      return [line(0.43, 0.13, 0.39, 0.34, 0.024), line(0.61, 0.13, 0.57, 0.34, 0.024)];
    case "-":
      return [line(0.32, 0.5, 0.68, 0.5, 0.03)];
    case "(":
      return [curve([[0.62, 0.14], [0.43, 0.28], [0.36, 0.5], [0.43, 0.72], [0.62, 0.88]], 0.026)];
    case ")":
      return [curve([[0.38, 0.14], [0.57, 0.28], [0.64, 0.5], [0.57, 0.72], [0.38, 0.88]], 0.026)];
    default:
      return [];
  }
}

function createAngryFaceStrokes(character: string) {
  if (character === " ") {
    return [];
  }

  const seed = character.charCodeAt(0) || 7;
  const size = [".", ",", ":", ";", "'", "\"", "-", "(", ")"].includes(character) ? 0.09 : 0.12;
  const centerX = clamp(0.5 + wobbleValue(seed, 1, 1, 0.18));
  const centerY = clamp((character >= "a" && character <= "z" ? 0.56 : 0.52) + wobbleValue(seed, 2, 2, 0.12));
  const eyeY = centerY - size * 0.08;
  const browY = centerY - size * 0.26;
  const mouthY = centerY + size * 0.32;

  return [
    line(centerX - size * 0.42, browY, centerX - size * 0.08, browY + size * 0.17, 0.016),
    line(centerX + size * 0.42, browY, centerX + size * 0.08, browY + size * 0.17, 0.016),
    circle(centerX - size * 0.22, eyeY, size * 0.052, 0.01),
    circle(centerX + size * 0.22, eyeY, size * 0.052, 0.01),
    curve(
      [
        [centerX - size * 0.34, mouthY],
        [centerX - size * 0.16, mouthY - size * 0.14],
        [centerX, mouthY - size * 0.18],
        [centerX + size * 0.16, mouthY - size * 0.14],
        [centerX + size * 0.34, mouthY],
      ],
      0.016,
    ),
  ];
}

function createAngryGlyph(character: string, now: string): Glyph {
  if (character === " ") {
    return {
      ...createEmptyGlyph(character),
      xAdvance: 0.42,
      updatedAt: now,
    };
  }

  const strokes = [...createCharacterStrokes(character), ...createAngryFaceStrokes(character)].map((glyphStroke) => ({
    ...glyphStroke,
    size: glyphStroke.size * 0.82,
  }));

  return {
    character,
    strokes,
    width: 1,
    height: 1,
    xAdvance: character === "." || character === "," || character === ":" || character === ";" ? 0.62 : 0.9,
    baselineOffset: 0.76,
    leftBearing: 0.04,
    rightBearing: 0.04,
    updatedAt: now,
  };
}

export function createAngryFaceFontSet(): FontSet {
  const now = new Date().toISOString();
  const glyphs = supportedCharacters.reduce<Record<string, Glyph>>((map, character) => {
    map[character] = createAngryGlyph(character, now);
    return map;
  }, {});

  return {
    id: createId("font"),
    name: "Angry Face",
    glyphs,
    createdAt: now,
    theme: {
      accentColor: "#ffb000",
      backgroundColor: "#1a0507",
      backgroundStyle: "rage",
      inkColor: "#ff3b30",
    },
    updatedAt: now,
  };
}

export function isAngryFaceFontSet(font: FontSet) {
  return font.name === "Angry Face" && font.theme?.backgroundStyle === "rage";
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

function normalizeFont(font: FontSet): FontSet {
  if (isAngryFaceFontSet(font)) {
    const refreshedPreset = createAngryFaceFontSet();

    return {
      ...refreshedPreset,
      id: font.id,
      createdAt: font.createdAt || refreshedPreset.createdAt,
    };
  }

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

    const normalizedFonts = parsed.fonts.map(normalizeFont);
    let firstAngryFaceId = "";
    const fonts = normalizedFonts.filter((font) => {
      if (!isAngryFaceFontSet(font)) {
        return true;
      }

      if (!firstAngryFaceId) {
        firstAngryFaceId = font.id;
        return true;
      }

      return false;
    });
    const requestedActiveFontId =
      normalizedFonts.some((font) => font.id === parsed.activeFontId && !fonts.some((item) => item.id === font.id))
        ? firstAngryFaceId
        : parsed.activeFontId;
    const activeFontId = fonts.some((font) => font.id === requestedActiveFontId)
      ? requestedActiveFontId
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
