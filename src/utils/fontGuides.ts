import type { FontGuideSettings } from "../types/fontTypes";

export type FontGuideKey = keyof FontGuideSettings;
export type FontGuideAxis = "x" | "y";

export const fontGuideRows: Array<{
  axis: FontGuideAxis;
  color: string;
  key: FontGuideKey;
  label: string;
}> = [
  { key: "ascender", label: "Ascender", color: "rgba(41, 128, 145, 0.86)", axis: "y" },
  { key: "xHeight", label: "Height", color: "rgba(181, 132, 42, 0.9)", axis: "y" },
  { key: "baseline", label: "Baseline", color: "rgba(35, 112, 76, 0.92)", axis: "y" },
  { key: "descender", label: "Descender", color: "rgba(133, 58, 57, 0.86)", axis: "y" },
  { key: "leftBound", label: "Left", color: "rgba(68, 85, 118, 0.76)", axis: "x" },
  { key: "rightBound", label: "Right", color: "rgba(68, 85, 118, 0.76)", axis: "x" },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function roundGuideValue(value: number) {
  return Number(value.toFixed(2));
}

export function clampFontGuideSettings(
  settings: FontGuideSettings,
  key: FontGuideKey,
  value: number,
): FontGuideSettings {
  const next = {
    ...settings,
    leftBound: settings.leftBound ?? 0.1,
    rightBound: settings.rightBound ?? 0.9,
    [key]: clamp(value, 0.02, 0.98),
  };

  next.ascender = clamp(next.ascender, 0.04, next.xHeight - 0.04);
  next.xHeight = clamp(next.xHeight, next.ascender + 0.04, next.baseline - 0.04);
  next.baseline = clamp(next.baseline, next.xHeight + 0.04, next.descender - 0.04);
  next.descender = clamp(next.descender, next.baseline + 0.04, 0.98);
  next.leftBound = clamp(next.leftBound, 0.02, next.rightBound - 0.08);
  next.rightBound = clamp(next.rightBound, next.leftBound + 0.08, 0.98);

  return {
    ascender: roundGuideValue(next.ascender),
    baseline: roundGuideValue(next.baseline),
    descender: roundGuideValue(next.descender),
    leftBound: roundGuideValue(next.leftBound),
    rightBound: roundGuideValue(next.rightBound),
    xHeight: roundGuideValue(next.xHeight),
  };
}
