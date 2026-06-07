import { strawberryMarketPalette } from "./palettes";
import { generateThemeCssVariables, type SourceThemePalette } from "./themeGenerator";

export type AppThemeId = "classic" | "midnightLetters" | "strawberryMarket";

export type AppTheme = {
  cssVariables: Record<string, string>;
  description: string;
  id: AppThemeId;
  label: string;
  paletteId: string;
  sourcePalette: SourceThemePalette;
  swatches: string[];
};

type AppThemeSource = {
  description: string;
  id: AppThemeId;
  label: string;
  paletteId: string;
  sourcePalette: SourceThemePalette;
};

export const defaultAppThemeId: AppThemeId = "classic";
export const APP_THEME_STORAGE_KEY = "quill:app-theme:v3";

const classicSourcePalette: SourceThemePalette = {
  primary: "#C8A45D",
  secondary: "#242124",
  background: "#111012",
  accent: "#82D0BC",
  gold: "#C8A45D",
  ink: "#F7EFE0",
};

const midnightCorrespondenceSourcePalette: SourceThemePalette = {
  primary: "#7A2E3A",
  secondary: "#D7E3F4",
  background: "#F5F1E8",
  accent: "#A8B0BF",
  gold: "#C9A45A",
  ink: "#2B2F3A",
};

const strawberryMarketSourcePalette: SourceThemePalette = {
  primary: "#E96A7A",
  secondary: "#F48FB1",
  background: "#FFF4EE",
  accent: "#8BCF8A",
  gold: "#F2C66D",
  ink: "#5A4035",
};

export const appThemes: AppTheme[] = [
  createAppTheme({
    id: "classic",
    label: "Classic",
    description: "The original dark studio look.",
    paletteId: "classic",
    sourcePalette: classicSourcePalette,
  }),
  createAppTheme({
    id: "midnightLetters",
    label: "Midnight Correspondence",
    description: "Private correspondence, fountain pen ink, and calm literary stationery.",
    paletteId: "midnightLetters",
    sourcePalette: midnightCorrespondenceSourcePalette,
  }),
  createAppTheme({
    id: "strawberryMarket",
    label: strawberryMarketPalette.label,
    description: "Cream paper, berry buttons, cocoa ink, leaf-green active states.",
    paletteId: strawberryMarketPalette.id,
    sourcePalette: strawberryMarketSourcePalette,
  }),
];

function createAppTheme(source: AppThemeSource): AppTheme {
  return {
    cssVariables: generateThemeCssVariables(source.sourcePalette),
    description: source.description,
    id: source.id,
    label: source.label,
    paletteId: source.paletteId,
    sourcePalette: source.sourcePalette,
    swatches: [
      source.sourcePalette.primary,
      source.sourcePalette.secondary,
      source.sourcePalette.background,
      source.sourcePalette.accent,
      source.sourcePalette.gold,
      source.sourcePalette.ink,
    ],
  };
}

export function normalizeAppThemeId(value: unknown): AppThemeId {
  return value === "classic" || value === "midnightLetters" || value === "strawberryMarket"
    ? value
    : defaultAppThemeId;
}

export function getAppTheme(themeId?: AppThemeId) {
  return appThemes.find((theme) => theme.id === themeId) ?? appThemes[0];
}
