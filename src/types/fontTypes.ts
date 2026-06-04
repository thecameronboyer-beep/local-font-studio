export type GlyphPoint = {
  ink?: number;
  pressure?: number;
  spread?: number;
  x: number;
  y: number;
};

export type GlyphStroke = {
  color?: string;
  highlightColor?: string;
  id: string;
  inkEffect?: GlyphInkEffect;
  points: GlyphPoint[];
  size: number;
  strokeTool?: GlyphStrokeTool;
};

export type GlyphStrokeTool = "pen" | "quill";

export type GlyphInkEffect = "none" | "dramaticPooling" | "subtleSpread" | "bubbleHighlight";

export type ConstructionPointType = "corner" | "smooth" | "symmetric" | "rounded";
export type ConstructionSegmentType = "line" | "curve";
export type ConstructionCornerStyle = "sharp" | "rounded" | "chamfered";

export type ConstructionHandle = {
  x: number;
  y: number;
};

export type ConstructionAnchorPoint = {
  chamferDistance?: number;
  cornerRadius?: number;
  cornerStyle?: ConstructionCornerStyle;
  id: string;
  inHandle?: ConstructionHandle;
  outHandle?: ConstructionHandle;
  segmentType?: ConstructionSegmentType;
  type: ConstructionPointType;
  x: number;
  y: number;
};

export type ConstructionPath = {
  closed: boolean;
  fillColor?: string;
  filled: boolean;
  id: string;
  points: ConstructionAnchorPoint[];
  strokeColor?: string;
  strokeWidth: number;
};

export type GlyphConstruction = {
  fillColor?: string;
  paths: ConstructionPath[];
  strokeColor?: string;
};

export type GlyphDecoration = {
  expression?: "googly" | "happy" | "angry" | "sad" | "tired" | "stoned";
  id: string;
  kind: "googly-eyes";
  size: number;
  x: number;
  y: number;
};

export type GlyphShape = {
  character: string;
  construction?: GlyphConstruction;
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

export type GlyphVariant = GlyphShape;

export type Glyph = GlyphShape & {
  variants?: GlyphVariant[];
};

export type BackgroundStyle =
  | "solid"
  | "paper"
  | "parchment"
  | "manuscript"
  | "midnight"
  | "rage"
  | "blush"
  | "sage"
  | "sky"
  | "lavender"
  | "strawberryRed"
  | "berryPink"
  | "strawberryCream"
  | "lined"
  | "grid";

export type BackgroundTexture = "clean" | "grain" | "fiber" | "canvas" | "woven";

export type FontRenderProfile = "plain" | "quillParchment";

export type FontPaletteId = "strawberryMarket";

export type FontTheme = {
  accentColor: string;
  backgroundColor: string;
  backgroundStyle: BackgroundStyle;
  backgroundTexture: BackgroundTexture;
  inkColor: string;
  paletteId?: FontPaletteId;
};

export type FontCharacterSettings = {
  showForgotten: boolean;
  showHeaderLetters: boolean;
  showSpacebar: boolean;
};

export type FontShapeSettings = {
  heightScale: number;
  letterSpacing: number;
  widthScale: number;
};

export type FontHomeSectionId =
  | "drawActions"
  | "exportControls"
  | "glyphQueue"
  | "previewText";

export type FontHomeSettings = {
  visibleSections: Record<FontHomeSectionId, boolean>;
};

export type FontWritingStyleId = "draw" | "build";

export type FontWritingStyleSettings = {
  enabledStyles: Record<FontWritingStyleId, boolean>;
};

export type FontGuideSettings = {
  ascender: number;
  baseline: number;
  descender: number;
  leftBound: number;
  rightBound: number;
  xHeight: number;
};

export type FontSet = {
  id: string;
  name: string;
  characterSettings: FontCharacterSettings;
  glyphs: Record<string, Glyph>;
  createdAt: string;
  guideSettings: FontGuideSettings;
  homeSettings: FontHomeSettings;
  presetFontId?: string;
  renderProfile?: FontRenderProfile;
  shapeSettings: FontShapeSettings;
  theme?: FontTheme;
  updatedAt: string;
  writingStyleSettings: FontWritingStyleSettings;
};

export type AppliedFontMetricOverrides = Partial<
  Pick<Glyph, "baselineOffset" | "leftBearing" | "rightBearing" | "xAdvance">
>;

export type AppliedLetterMetricOverrides = Partial<
  Pick<Glyph, "baselineOffset" | "height" | "leftBearing" | "rightBearing" | "width" | "xAdvance">
>;

export type FontSpacingApplyDraft = {
  fontMetricOverrides: AppliedFontMetricOverrides;
  glyphMetricOverrides: Record<string, AppliedLetterMetricOverrides>;
  guideSettings: FontGuideSettings | null;
  shapeSettings: FontShapeSettings;
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
  version: 3;
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
  schemaVersion: 3;
};

export type FontExportFile = {
  app: "local-font-studio";
  exportType: "font";
  exportedAt: string;
  font: FontSet;
  schemaVersion: 3;
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
  letterSpacing: number;
  lineSpacing: number;
  inkColor: string;
  backgroundColor: string;
  pagePadding: number;
};
