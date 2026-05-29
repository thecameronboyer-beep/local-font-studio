export type GlyphPoint = {
  ink?: number;
  pressure?: number;
  x: number;
  y: number;
};

export type GlyphStroke = {
  color?: string;
  id: string;
  points: GlyphPoint[];
  size: number;
};

export type GlyphDecoration = {
  id: string;
  kind: "googly-eyes";
  size: number;
  x: number;
  y: number;
};

export type Glyph = {
  character: string;
  decorations: GlyphDecoration[];
  strokes: GlyphStroke[];
  width: number;
  height: number;
  xAdvance: number;
  baselineOffset: number;
  leftBearing: number;
  rightBearing: number;
  updatedAt: string;
};

export type BackgroundStyle =
  | "solid"
  | "paper"
  | "midnight"
  | "rage"
  | "blush"
  | "sage"
  | "sky"
  | "lavender"
  | "lined"
  | "grid";

export type FontTheme = {
  accentColor: string;
  backgroundColor: string;
  backgroundStyle: BackgroundStyle;
  inkColor: string;
};

export type FontSet = {
  id: string;
  name: string;
  glyphs: Record<string, Glyph>;
  createdAt: string;
  theme?: FontTheme;
  updatedAt: string;
};

export type FontStudioData = {
  version: 1;
  activeFontId: string;
  fonts: FontSet[];
};

export type PreviewSettings = {
  fontSize: number;
  lineSpacing: number;
  inkColor: string;
  backgroundColor: string;
  pagePadding: number;
};
