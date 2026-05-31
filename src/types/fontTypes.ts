export type GlyphPoint = {
  ink?: number;
  pressure?: number;
  spread?: number;
  x: number;
  y: number;
};

export type GlyphStroke = {
  color?: string;
  id: string;
  inkEffect?: GlyphInkEffect;
  points: GlyphPoint[];
  size: number;
  strokeTool?: GlyphStrokeTool;
};

export type GlyphStrokeTool = "pen" | "quill";

export type GlyphInkEffect = "none" | "dramaticPooling" | "subtleSpread";

export type GlyphDecoration = {
  expression?: "googly" | "happy" | "angry" | "sad" | "tired" | "stoned";
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
  | "parchment"
  | "midnight"
  | "rage"
  | "blush"
  | "sage"
  | "sky"
  | "lavender"
  | "lined"
  | "grid";

export type BackgroundTexture = "clean" | "grain" | "fiber" | "canvas" | "woven";

export type FontRenderProfile = "plain" | "quillParchment";

export type FontTheme = {
  accentColor: string;
  backgroundColor: string;
  backgroundStyle: BackgroundStyle;
  backgroundTexture: BackgroundTexture;
  inkColor: string;
};

export type FontCharacterSettings = {
  showForgotten: boolean;
  showSpacebar: boolean;
};

export type FontShapeSettings = {
  heightScale: number;
  widthScale: number;
};

export type FontGuideSettings = {
  ascender: number;
  baseline: number;
  descender: number;
  xHeight: number;
};

export type FontSet = {
  id: string;
  name: string;
  characterSettings: FontCharacterSettings;
  glyphs: Record<string, Glyph>;
  createdAt: string;
  guideSettings: FontGuideSettings;
  renderProfile?: FontRenderProfile;
  shapeSettings: FontShapeSettings;
  theme?: FontTheme;
  updatedAt: string;
};

export type ProjectActivityType =
  | "backup"
  | "font_create"
  | "font_delete"
  | "font_duplicate"
  | "font_rename"
  | "glyph_edit"
  | "import"
  | "export"
  | "metrics_batch"
  | "migration"
  | "recovery"
  | "restore";

export type ProjectActivity = {
  character?: string;
  createdAt: string;
  details?: Record<string, boolean | number | string | null>;
  fontId?: string;
  id: string;
  message: string;
  type: ProjectActivityType;
};

export type ProjectActivityDraft = Omit<ProjectActivity, "createdAt" | "id">;

export type FontStudioData = {
  version: 2;
  activeFontId: string;
  activityLog: ProjectActivity[];
  fonts: FontSet[];
  lastBackupAt?: string;
};

export type ProjectBackup = {
  activeFontName: string;
  createdAt: string;
  data: FontStudioData;
  fontCount: number;
  glyphCount: number;
  id: string;
  reason: string;
};

export type StorageHealthStatus = "ok" | "migrated" | "recovered" | "reset";

export type StorageHealthCheck = {
  checkedAt: string;
  message: string;
  recoveredBackupId?: string;
  status: StorageHealthStatus;
  storageVersion: number;
  warnings: string[];
};

export type ProjectExportFile = {
  app: "local-font-studio";
  data: FontStudioData;
  exportedAt: string;
  schemaVersion: 2;
};

export type FontExportFile = {
  app: "local-font-studio";
  exportType: "font";
  exportedAt: string;
  font: FontSet;
  schemaVersion: 2;
};

export type SavedImage = {
  createdAt: string;
  fontName: string;
  height: number;
  id: string;
  imageDataUrl: string;
  message: string;
  width: number;
};

export type SavedImageDraft = Omit<SavedImage, "createdAt" | "id">;

export type PreviewSettings = {
  fontSize: number;
  lineSpacing: number;
  inkColor: string;
  backgroundColor: string;
  pagePadding: number;
};
