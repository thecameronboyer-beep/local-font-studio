import { strawberryMarketPalette } from "./palettes";

export type AppThemeId = "classic" | "midnightLetters" | "strawberryMarket";

export type AppThemeBackground = {
  cssVariables: Record<string, string>;
  id: string;
  label: string;
  swatch: string;
};

export type AppTheme = {
  backgrounds?: AppThemeBackground[];
  cssVariables: Record<string, string>;
  defaultBackgroundId?: string;
  description: string;
  id: AppThemeId;
  label: string;
  paletteId: string;
  swatches: string[];
};

export const defaultAppThemeId: AppThemeId = "classic";
export const APP_THEME_STORAGE_KEY = "quill:app-theme:v3";
export const APP_THEME_BACKGROUND_STORAGE_KEY = "quill:app-theme-background:v1";

export const appThemes: AppTheme[] = [
  {
    id: "classic",
    label: "Classic",
    description: "The original dark studio look.",
    paletteId: "classic",
    swatches: ["#111012", "#1C1A1D", "#242124", "#C8A45D", "#82D0BC", "#F7EFE0"],
    cssVariables: {
      "--app-accent": "#82d0bc",
      "--app-accent-strong": "#63ad9b",
      "--app-bg": "#111012",
      "--app-bg-gradient": "linear-gradient(135deg, #121112 0%, #191614 54%, #101314 100%)",
      "--app-border": "rgba(248, 230, 194, 0.12)",
      "--app-border-strong": "rgba(130, 208, 188, 0.46)",
      "--app-danger": "#cc665e",
      "--app-danger-soft": "rgba(78, 31, 33, 0.9)",
      "--app-gold": "#c8a45d",
      "--app-grid": "rgba(248, 230, 194, 0.035)",
      "--app-heading": "#f7efe0",
      "--app-input": "#0f0e10",
      "--app-ink": "#f7efe0",
      "--app-muted": "#dacbb7",
      "--app-primary": "#c8a45d",
      "--app-primary-strong": "#d9b769",
      "--app-primary-text": "#17110b",
      "--app-shadow": "rgba(0, 0, 0, 0.32)",
      "--app-shadow-strong": "rgba(0, 0, 0, 0.42)",
      "--app-surface": "rgba(28, 26, 29, 0.9)",
      "--app-surface-deep": "#151314",
      "--app-surface-muted": "#1c1a1d",
      "--app-surface-raised": "#242124",
      "--app-surface-solid": "#181618",
      "--app-text": "#f7efe0",
      "--app-text-strong": "#fff7e6",
    },
  },
  {
    id: "midnightLetters",
    label: "Midnight Letters",
    description: "Private night letters, fountain pen ink, and calm literary stationery.",
    paletteId: "midnightLetters",
    swatches: ["#F5F1E8", "#D7E3F4", "#A8B0BF", "#7A2E3A", "#C9A45A", "#2B2F3A"],
    defaultBackgroundId: "parchmentIvory",
    cssVariables: {
      "--app-accent": "#7A2E3A",
      "--app-accent-strong": "#672531",
      "--app-border": "rgba(43, 47, 58, 0.16)",
      "--app-border-strong": "rgba(122, 46, 58, 0.46)",
      "--app-danger": "#7A2E3A",
      "--app-danger-soft": "rgba(122, 46, 58, 0.12)",
      "--app-gold": "#C9A45A",
      "--app-heading": "#2B2F3A",
      "--app-ink": "#2B2F3A",
      "--app-muted": "#5E6675",
      "--app-primary": "#7A2E3A",
      "--app-primary-strong": "#672531",
      "--app-primary-text": "#F5F1E8",
      "--app-text": "#2B2F3A",
      "--app-text-strong": "#20232B",
    },
    backgrounds: [
      {
        id: "parchmentIvory",
        label: "Parchment Ivory",
        swatch: "#F5F1E8",
        cssVariables: {
          "--app-bg": "#F5F1E8",
          "--app-bg-gradient": "linear-gradient(135deg, #fbf8f0 0%, #f5f1e8 48%, #e7ddd0 100%)",
          "--app-grid": "rgba(43, 47, 58, 0.052)",
          "--app-input": "#FFFDF8",
          "--app-shadow": "rgba(43, 47, 58, 0.14)",
          "--app-shadow-strong": "rgba(43, 47, 58, 0.24)",
          "--app-surface": "rgba(255, 252, 246, 0.94)",
          "--app-surface-deep": "#E8DFD2",
          "--app-surface-muted": "#EFE8DE",
          "--app-surface-raised": "#FFFDF8",
          "--app-surface-solid": "#FAF7EF",
        },
      },
      {
        id: "moonlitBlue",
        label: "Moonlit Blue",
        swatch: "#D7E3F4",
        cssVariables: {
          "--app-bg": "#D7E3F4",
          "--app-bg-gradient": "linear-gradient(135deg, #f5f1e8 0%, #d7e3f4 52%, #a8b0bf 100%)",
          "--app-grid": "rgba(43, 47, 58, 0.06)",
          "--app-input": "#F8FBFF",
          "--app-shadow": "rgba(43, 47, 58, 0.16)",
          "--app-shadow-strong": "rgba(43, 47, 58, 0.26)",
          "--app-surface": "rgba(246, 250, 255, 0.92)",
          "--app-surface-deep": "#CBD7E8",
          "--app-surface-muted": "#E6EEF9",
          "--app-surface-raised": "#F8FBFF",
          "--app-surface-solid": "#F1F6FD",
        },
      },
      {
        id: "dustySlate",
        label: "Dusty Slate",
        swatch: "#A8B0BF",
        cssVariables: {
          "--app-bg": "#A8B0BF",
          "--app-bg-gradient": "linear-gradient(135deg, #e7e3db 0%, #c8ced9 44%, #a8b0bf 100%)",
          "--app-grid": "rgba(43, 47, 58, 0.07)",
          "--app-input": "#F5F1E8",
          "--app-shadow": "rgba(43, 47, 58, 0.2)",
          "--app-shadow-strong": "rgba(43, 47, 58, 0.3)",
          "--app-surface": "rgba(238, 241, 246, 0.91)",
          "--app-surface-deep": "#C7CDD7",
          "--app-surface-muted": "#DDE2EA",
          "--app-surface-raised": "#F5F1E8",
          "--app-surface-solid": "#ECEFF5",
        },
      },
    ],
  },
  {
    id: "strawberryMarket",
    label: strawberryMarketPalette.label,
    description: "Cream paper, berry buttons, cocoa ink, leaf-green active states.",
    paletteId: strawberryMarketPalette.id,
    swatches: [
      ...strawberryMarketPalette.main.map((swatch) => swatch.color),
      ...strawberryMarketPalette.accents.map((swatch) => swatch.color),
      strawberryMarketPalette.ink.color,
    ],
    cssVariables: {
      "--app-accent": "#8BCF8A",
      "--app-accent-strong": "#4C8E50",
      "--app-bg": "#FFF4EE",
      "--app-bg-gradient": "linear-gradient(135deg, #fffaf5 0%, #fff4ee 42%, #f8d5d3 100%)",
      "--app-border": "rgba(90, 64, 53, 0.18)",
      "--app-border-strong": "rgba(233, 106, 122, 0.46)",
      "--app-danger": "#B94C5C",
      "--app-danger-soft": "rgba(185, 76, 92, 0.13)",
      "--app-gold": "#F2C66D",
      "--app-grid": "rgba(90, 64, 53, 0.055)",
      "--app-heading": "#7B3D43",
      "--app-input": "#FFFDFC",
      "--app-ink": "#5A4035",
      "--app-muted": "#8A6658",
      "--app-primary": "#E96A7A",
      "--app-primary-strong": "#C94F60",
      "--app-primary-text": "#FFFDFC",
      "--app-shadow": "rgba(90, 64, 53, 0.18)",
      "--app-shadow-strong": "rgba(90, 64, 53, 0.28)",
      "--app-surface": "rgba(255, 250, 245, 0.94)",
      "--app-surface-deep": "#F3D1CE",
      "--app-surface-muted": "#F8E7DF",
      "--app-surface-raised": "#FFF7F1",
      "--app-surface-solid": "#FFFAF5",
      "--app-text": "#5A4035",
      "--app-text-strong": "#38241C",
    },
  },
];

export function normalizeAppThemeId(value: unknown): AppThemeId {
  return value === "classic" || value === "midnightLetters" || value === "strawberryMarket"
    ? value
    : defaultAppThemeId;
}

export function getAppTheme(themeId?: AppThemeId) {
  return appThemes.find((theme) => theme.id === themeId) ?? appThemes[0];
}

export function getDefaultAppThemeBackgroundId(theme: AppTheme) {
  return theme.defaultBackgroundId ?? theme.backgrounds?.[0]?.id ?? "";
}

export function normalizeAppThemeBackgroundId(theme: AppTheme, value: unknown) {
  if (!theme.backgrounds?.length) {
    return "";
  }

  return theme.backgrounds.some((background) => background.id === value)
    ? value as string
    : getDefaultAppThemeBackgroundId(theme);
}

export function getAppThemeBackground(theme: AppTheme, backgroundId?: string) {
  if (!theme.backgrounds?.length) {
    return null;
  }

  const safeBackgroundId = normalizeAppThemeBackgroundId(theme, backgroundId);

  return theme.backgrounds.find((background) => background.id === safeBackgroundId) ?? theme.backgrounds[0];
}
