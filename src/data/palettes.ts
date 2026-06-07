import type { BackgroundStyle, FontPaletteId, FontTheme } from "../types/fontTypes";

export type PaletteSwatch = {
  color: string;
  label: string;
};

export type PaletteBackgroundPreset = PaletteSwatch & {
  accentColor: string;
  backgroundColor: string;
  id: BackgroundStyle;
  inkColor: string;
  preview: string;
};

export type FontPalette = {
  accents: PaletteSwatch[];
  backgrounds: PaletteBackgroundPreset[];
  defaultBackgroundId: BackgroundStyle;
  defaultTexture: FontTheme["backgroundTexture"];
  id: FontPaletteId;
  ink: PaletteSwatch;
  label: string;
  main: PaletteSwatch[];
};

export const strawberryMarketPalette: FontPalette = {
  id: "strawberryMarket",
  label: "Strawberry Market",
  main: [
    { color: "#E96A7A", label: "Strawberry Red" },
    { color: "#F48FB1", label: "Berry Pink" },
    { color: "#FFF4EE", label: "Cream" },
  ],
  accents: [
    { color: "#8BCF8A", label: "Leaf Green" },
    { color: "#F2C66D", label: "Seed Gold" },
  ],
  ink: { color: "#5A4035", label: "Cocoa Brown" },
  backgrounds: [
    {
      id: "strawberryRed",
      label: "Strawberry Red",
      color: "#E96A7A",
      backgroundColor: "#E96A7A",
      inkColor: "#5A4035",
      accentColor: "#F2C66D",
      preview: "linear-gradient(135deg, #fff4ee 0%, #e96a7a 58%, #b94c5c 100%)",
    },
    {
      id: "berryPink",
      label: "Berry Pink",
      color: "#F48FB1",
      backgroundColor: "#F48FB1",
      inkColor: "#5A4035",
      accentColor: "#8BCF8A",
      preview: "linear-gradient(135deg, #fff4ee 0%, #f48fb1 62%, #e96a7a 100%)",
    },
    {
      id: "strawberryCream",
      label: "Cream",
      color: "#FFF4EE",
      backgroundColor: "#FFF4EE",
      inkColor: "#5A4035",
      accentColor: "#E96A7A",
      preview: "linear-gradient(135deg, #fffaf5 0%, #fff4ee 56%, #f48fb1 100%)",
    },
  ],
  defaultBackgroundId: "strawberryCream",
  defaultTexture: "grain",
};

export const midnightLettersPalette: FontPalette = {
  id: "midnightLetters",
  label: "Midnight Letters",
  main: [
    { color: "#F5F1E8", label: "Parchment Ivory" },
    { color: "#D7E3F4", label: "Moonlit Blue" },
    { color: "#A8B0BF", label: "Dusty Slate" },
  ],
  accents: [
    { color: "#7A2E3A", label: "Garnet" },
    { color: "#C9A45A", label: "Antique Gold" },
  ],
  ink: { color: "#2B2F3A", label: "Midnight Ink" },
  backgrounds: [
    {
      id: "midnightParchment",
      label: "Parchment Ivory",
      color: "#F5F1E8",
      backgroundColor: "#F5F1E8",
      inkColor: "#2B2F3A",
      accentColor: "#7A2E3A",
      preview: "linear-gradient(135deg, #fffdf8 0%, #f5f1e8 56%, #c9a45a 100%)",
    },
    {
      id: "midnightMoonlit",
      label: "Moonlit Blue",
      color: "#D7E3F4",
      backgroundColor: "#D7E3F4",
      inkColor: "#2B2F3A",
      accentColor: "#7A2E3A",
      preview: "linear-gradient(135deg, #f5f1e8 0%, #d7e3f4 58%, #a8b0bf 100%)",
    },
    {
      id: "midnightSlate",
      label: "Dusty Slate",
      color: "#A8B0BF",
      backgroundColor: "#A8B0BF",
      inkColor: "#2B2F3A",
      accentColor: "#C9A45A",
      preview: "linear-gradient(135deg, #f5f1e8 0%, #c6ccd6 48%, #a8b0bf 100%)",
    },
  ],
  defaultBackgroundId: "midnightParchment",
  defaultTexture: "clean",
};

export const fontPalettes: FontPalette[] = [strawberryMarketPalette, midnightLettersPalette];
export const defaultFontPaletteId: FontPaletteId = "strawberryMarket";

export function getFontPalette(paletteId?: FontPaletteId) {
  return fontPalettes.find((palette) => palette.id === paletteId) ?? strawberryMarketPalette;
}

export function getDefaultFontPaletteTheme(paletteId: FontPaletteId = defaultFontPaletteId): FontTheme {
  const palette = getFontPalette(paletteId);
  const background = palette.backgrounds.find((preset) => preset.id === palette.defaultBackgroundId) ??
    palette.backgrounds[0];

  return {
    accentColor: background.accentColor,
    backgroundColor: background.backgroundColor,
    backgroundStyle: background.id,
    backgroundTexture: palette.defaultTexture,
    inkColor: palette.ink.color,
    paletteId: palette.id,
  };
}

export const paletteInkSwatches = fontPalettes.map((palette) => palette.ink);
export const paletteBackgroundPresets = fontPalettes.flatMap((palette) => palette.backgrounds);
