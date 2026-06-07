export type SourceThemePalette = {
  accent: string;
  background: string;
  gold: string;
  ink: string;
  primary: string;
  secondary: string;
};

export type ThemeCssVariables = Record<string, string>;

type Rgb = {
  b: number;
  g: number;
  r: number;
};

type ColorScale = Record<number, string>;
type GeneratedColorScales = {
  accent: ColorScale;
  gold: ColorScale;
  primary: ColorScale;
  secondary: ColorScale;
};

type TintedSurfaceOptions = {
  maxAmount: number;
  minColorDistance: number;
  minSurfaceContrast: number;
  minTextContrast: number;
  preferredAmount: number;
};

const BLACK: Rgb = { r: 0, g: 0, b: 0 };
const WHITE: Rgb = { r: 255, g: 255, b: 255 };
const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;

export function generateThemeCssVariables(sourcePalette: SourceThemePalette): ThemeCssVariables {
  const palette = normalizeSourcePalette(sourcePalette);
  const primaryScale = createColorScale(palette.primary, palette.ink);
  const secondaryScale = createColorScale(palette.secondary, palette.ink);
  const accentScale = createColorScale(palette.accent, palette.ink);
  const goldScale = createColorScale(palette.gold, palette.ink);
  const scales: GeneratedColorScales = {
    accent: accentScale,
    gold: goldScale,
    primary: primaryScale,
    secondary: secondaryScale,
  };
  const surfaceTokens = createSurfaceTokens(palette);
  const textTokens = createTextTokens(palette, surfaceTokens);
  const actionTokens = createActionTokens(primaryScale, secondaryScale, surfaceTokens, textTokens);
  const stateTokens = createStateTokens(primaryScale, accentScale, goldScale, surfaceTokens, textTokens);
  const depthTokens = createDepthTokens(palette, surfaceTokens, stateTokens);
  const componentTokens = createComponentTokens(scales, surfaceTokens, textTokens, actionTokens, stateTokens);

  return {
    ...createScaleVariables("primary", primaryScale),
    ...createScaleVariables("secondary", secondaryScale),
    ...createScaleVariables("accent", accentScale),
    ...createScaleVariables("gold", goldScale),
    ...surfaceTokens,
    ...textTokens,
    ...actionTokens,
    ...stateTokens,
    ...depthTokens,
    ...componentTokens,
  };
}

function normalizeSourcePalette(palette: SourceThemePalette): SourceThemePalette {
  return {
    accent: normalizeHex(palette.accent),
    background: normalizeHex(palette.background),
    gold: normalizeHex(palette.gold),
    ink: normalizeHex(palette.ink),
    primary: normalizeHex(palette.primary),
    secondary: normalizeHex(palette.secondary),
  };
}

function createScaleVariables(prefix: string, scale: ColorScale): ThemeCssVariables {
  return SCALE_STEPS.reduce<ThemeCssVariables>((variables, step) => {
    variables[`--${prefix}-${step}`] = scale[step];
    return variables;
  }, {});
}

function createColorScale(sourceHex: string, inkHex: string): ColorScale {
  const source = parseHex(sourceHex);
  const ink = parseHex(inkHex);
  const darkAnchor = relativeLuminance(ink) < 0.52 ? ink : BLACK;

  return {
    50: toHex(mix(source, WHITE, 0.92)),
    100: toHex(mix(source, WHITE, 0.82)),
    200: toHex(mix(source, WHITE, 0.68)),
    300: toHex(mix(source, WHITE, 0.5)),
    400: toHex(mix(source, WHITE, 0.28)),
    500: toHex(source),
    600: toHex(mix(source, darkAnchor, 0.18)),
    700: toHex(mix(source, darkAnchor, 0.36)),
    800: toHex(mix(source, darkAnchor, 0.54)),
    900: toHex(mix(source, darkAnchor, 0.72)),
  };
}

function createSurfaceTokens(palette: SourceThemePalette): ThemeCssVariables {
  const background = parseHex(palette.background);
  const ink = parseHex(palette.ink);
  const inkIsDark = relativeLuminance(ink) < 0.5;
  const panelSeed = inkIsDark ? mix(background, WHITE, 0.66) : mix(background, WHITE, 0.08);
  const panel = ensureContrastWithText(panelSeed, ink, 7);
  const card = mix(panel, ink, inkIsDark ? 0.07 : 0.1);
  const cardHover = mix(panel, ink, inkIsDark ? 0.13 : 0.18);
  const button = mix(panel, ink, inkIsDark ? 0.09 : 0.14);
  const buttonHover = mix(panel, ink, inkIsDark ? 0.15 : 0.22);
  const inset = inkIsDark ? mix(panel, ink, 0.1) : mix(background, BLACK, 0.1);
  const shadowBase = inkIsDark ? ink : mix(background, BLACK, 0.34);
  const pageStart = inkIsDark ? mix(background, WHITE, 0.72) : mix(background, WHITE, 0.06);
  const pageEnd = inkIsDark ? mix(background, ink, 0.12) : mix(background, BLACK, 0.2);

  return {
    "--ui-page-bg": `linear-gradient(135deg, ${toHex(pageStart)} 0%, ${toHex(background)} 48%, ${toHex(pageEnd)} 100%)`,
    "--ui-app-bg": toHex(background),
    "--ui-panel-bg": toHex(panel),
    "--ui-card-bg": toHex(card),
    "--ui-card-hover-bg": toHex(cardHover),
    "--ui-button-bg": toHex(button),
    "--ui-button-hover-bg": toHex(buttonHover),
    "--ui-inset-bg": toHex(inset),
    "--ui-border-soft": toRgba(ink, inkIsDark ? 0.1 : 0.12),
    "--ui-border-medium": toRgba(ink, inkIsDark ? 0.16 : 0.18),
    "--ui-border-strong": toRgba(ink, inkIsDark ? 0.26 : 0.3),
    "--ui-grid-line": toRgba(ink, inkIsDark ? 0.055 : 0.04),
    "--ui-shadow": toRgba(shadowBase, inkIsDark ? 0.18 : 0.34),
    "--ui-shadow-strong": toRgba(shadowBase, inkIsDark ? 0.28 : 0.46),
  };
}

function createTextTokens(palette: SourceThemePalette, surfaceTokens: ThemeCssVariables): ThemeCssVariables {
  const panel = parseCssHex(surfaceTokens["--ui-panel-bg"]);
  const ink = parseHex(palette.ink);
  const main = chooseReadableColor(ink, panel, 7);
  const muted = ensureReadableMixedText(main, panel, 0.34, 4.5);
  const subtle = ensureReadableMixedText(main, panel, 0.5, 3);
  const inverse = relativeLuminance(main) < 0.5
    ? mix(panel, WHITE, 0.24)
    : mix(panel, BLACK, 0.72);

  return {
    "--text-main": toHex(main),
    "--text-muted": toHex(muted),
    "--text-subtle": toHex(subtle),
    "--text-inverse": toHex(inverse),
    "--text-disabled": toHex(mix(main, panel, 0.58)),
  };
}

function createActionTokens(
  primaryScale: ColorScale,
  secondaryScale: ColorScale,
  surfaceTokens: ThemeCssVariables,
  textTokens: ThemeCssVariables,
): ThemeCssVariables {
  const panel = parseCssHex(surfaceTokens["--ui-panel-bg"]);
  const card = parseCssHex(surfaceTokens["--ui-card-bg"]);
  const textMain = parseCssHex(textTokens["--text-main"]);
  const textInverse = parseCssHex(textTokens["--text-inverse"]);
  const primary = pickActionColor(primaryScale, panel, textMain, textInverse);
  const secondaryBg = pickSurfaceSeparatedScaleColor(secondaryScale, card, textMain);
  const secondaryHoverBg = mix(secondaryBg, textMain, relativeLuminance(textMain) < 0.5 ? 0.08 : 0.12);
  const secondaryText = chooseReadableColor(textMain, secondaryBg, 4.5);

  return {
    "--action-primary-bg": toHex(primary.bg),
    "--action-primary-hover-bg": toHex(primary.hoverBg),
    "--action-primary-text": toHex(primary.text),
    "--action-secondary-bg": toHex(secondaryBg),
    "--action-secondary-hover-bg": toHex(secondaryHoverBg),
    "--action-secondary-text": toHex(secondaryText),
  };
}

function createStateTokens(
  primaryScale: ColorScale,
  accentScale: ColorScale,
  goldScale: ColorScale,
  surfaceTokens: ThemeCssVariables,
  textTokens: ThemeCssVariables,
): ThemeCssVariables {
  const panel = parseCssHex(surfaceTokens["--ui-panel-bg"]);
  const textMain = parseCssHex(textTokens["--text-main"]);
  const textInverse = parseCssHex(textTokens["--text-inverse"]);
  const textIsDark = relativeLuminance(textMain) < 0.5;
  const selectedBorder = softenColorAgainstSurface(
    pickSurfaceSeparatedScaleColor(accentScale, panel, textMain, 1.7),
    panel,
    1.7,
    0.18,
  );
  const selectedBg = createTintedSurface(panel, selectedBorder, textMain, {
    maxAmount: textIsDark ? 0.56 : 0.48,
    minColorDistance: 0.14,
    minSurfaceContrast: 1.14,
    minTextContrast: 4.5,
    preferredAmount: textIsDark ? 0.42 : 0.36,
  });
  const selectedText = chooseReadableColor(textMain, selectedBg, 4.5);
  const successText = pickSurfaceSeparatedScaleColor(accentScale, panel, textMain);
  const warningText = pickSurfaceSeparatedScaleColor(goldScale, panel, textMain);
  const dangerText = pickSurfaceSeparatedScaleColor(primaryScale, panel, textMain);

  return {
    "--ui-border-active": toHex(selectedBorder),
    "--selected-bg": toHex(selectedBg),
    "--selected-border": toHex(selectedBorder),
    "--selected-text": toHex(selectedText),
    "--success-bg": toHex(mix(panel, successText, 0.18)),
    "--success-text": toHex(chooseReadableColor(successText, mix(panel, successText, 0.18), 4.5)),
    "--warning-bg": toHex(mix(panel, warningText, 0.2)),
    "--warning-text": toHex(chooseReadableColor(warningText, mix(panel, warningText, 0.2), 4.5)),
    "--danger-bg": toHex(mix(panel, dangerText, 0.16)),
    "--danger-text": toHex(chooseReadableColor(dangerText, mix(panel, dangerText, 0.16), 4.5)),
    "--focus-ring": toRgba(selectedBorder, 0.34),
    "--decorative-text": toHex(chooseReadableColor(textInverse, selectedBorder, 4.5)),
    "--selected-inverse-text": toHex(chooseReadableColor(textInverse, selectedBorder, 4.5)),
  };
}

function createComponentTokens(
  scales: GeneratedColorScales,
  surfaceTokens: ThemeCssVariables,
  textTokens: ThemeCssVariables,
  actionTokens: ThemeCssVariables,
  stateTokens: ThemeCssVariables,
): ThemeCssVariables {
  const panel = parseCssHex(surfaceTokens["--ui-panel-bg"]);
  const buttonBase = parseCssHex(surfaceTokens["--ui-button-bg"]);
  const cardBase = parseCssHex(surfaceTokens["--ui-card-bg"]);
  const insetBase = parseCssHex(surfaceTokens["--ui-inset-bg"]);
  const textMain = parseCssHex(textTokens["--text-main"]);
  const textMuted = parseCssHex(textTokens["--text-muted"]);
  const textIsDark = relativeLuminance(textMain) < 0.5;
  const softPrimary = parseCssHex(scales.primary[textIsDark ? 300 : 700]);
  const softSecondary = parseCssHex(scales.secondary[textIsDark ? 200 : 800]);
  const softAccent = parseCssHex(scales.accent[textIsDark ? 200 : 700]);
  const softGold = parseCssHex(scales.gold[textIsDark ? 100 : 800]);
  const neutralTint = mix(mix(softPrimary, softSecondary, 0.24), softGold, 0.18);
  const cardTint = mix(mix(softPrimary, softSecondary, 0.22), softGold, 0.18);
  const cardTitleTint = mix(neutralTint, softPrimary, 0.3);
  const chipTint = mix(softGold, softAccent, 0.24);
  const fieldTint = mix(softGold, panel, 0.42);
  const neutralBg = createTintedSurface(buttonBase, neutralTint, textMain, {
    maxAmount: textIsDark ? 0.64 : 0.52,
    minColorDistance: textIsDark ? 0.13 : 0.1,
    minSurfaceContrast: textIsDark ? 1.08 : 1.12,
    minTextContrast: 4.5,
    preferredAmount: textIsDark ? 0.48 : 0.36,
  });
  const neutralBorder = softenColorAgainstSurface(
    pickSurfaceSeparatedScaleColor(scales.primary, neutralBg, textMain, 1.38),
    neutralBg,
    1.38,
    textIsDark ? 0.18 : 0.26,
  );
  const cardBg = createTintedSurface(cardBase, cardTint, textMain, {
    maxAmount: textIsDark ? 0.48 : 0.52,
    minColorDistance: textIsDark ? 0.09 : 0.12,
    minSurfaceContrast: textIsDark ? 1.06 : 1.1,
    minTextContrast: 4.5,
    preferredAmount: textIsDark ? 0.32 : 0.34,
  });
  const cardBorder = softenColorAgainstSurface(
    pickSurfaceSeparatedScaleColor(scales.gold, cardBg, textMain, 1.24),
    cardBg,
    1.24,
    0.34,
  );
  const cardTitleBg = createTintedSurface(insetBase, cardTitleTint, textMain, {
    maxAmount: textIsDark ? 0.46 : 0.48,
    minColorDistance: textIsDark ? 0.08 : 0.1,
    minSurfaceContrast: textIsDark ? 1.06 : 1.08,
    minTextContrast: 4.5,
    preferredAmount: textIsDark ? 0.28 : 0.3,
  });
  const fieldBg = createTintedSurface(insetBase, fieldTint, textMain, {
    maxAmount: 0.24,
    minColorDistance: 0.035,
    minSurfaceContrast: 1.02,
    minTextContrast: 4.5,
    preferredAmount: 0.12,
  });
  const fieldBorder = softenColorAgainstSurface(
    pickSurfaceSeparatedScaleColor(scales.gold, fieldBg, textMain, 1.22),
    fieldBg,
    1.22,
    0.36,
  );
  const chipBg = createTintedSurface(cardBase, chipTint, textMain, {
    maxAmount: 0.3,
    minColorDistance: 0.045,
    minSurfaceContrast: 1.03,
    minTextContrast: 4.5,
    preferredAmount: 0.16,
  });
  const chipBorder = softenColorAgainstSurface(
    pickSurfaceSeparatedScaleColor(scales.gold, chipBg, textMain, 1.18),
    chipBg,
    1.18,
    0.42,
  );
  const dropzoneBase = mix(panel, textMain, textIsDark ? 0.035 : 0.06);
  const dropzoneBg = createTintedSurface(dropzoneBase, mix(cardTint, panel, 0.64), textMain, {
    maxAmount: 0.22,
    minColorDistance: 0.035,
    minSurfaceContrast: 1.02,
    minTextContrast: 4.5,
    preferredAmount: 0.12,
  });
  const dropzoneBorder = softenColorAgainstSurface(
    pickSurfaceSeparatedScaleColor(scales.secondary, dropzoneBg, textMain, 1.18),
    dropzoneBg,
    1.18,
    0.46,
  );
  const disabledBg = mix(cardBg, panel, 0.52);

  return {
    "--control-neutral-bg": toHex(neutralBg),
    "--control-neutral-border": toHex(neutralBorder),
    "--control-neutral-text": toHex(chooseReadableColor(textMain, neutralBg, 4.5)),
    "--control-primary-bg": actionTokens["--action-primary-bg"],
    "--control-primary-border": actionTokens["--action-primary-bg"],
    "--control-primary-text": actionTokens["--action-primary-text"],
    "--control-selected-bg": stateTokens["--selected-bg"],
    "--control-selected-border": stateTokens["--selected-border"],
    "--control-selected-text": stateTokens["--selected-text"],
    "--control-danger-bg": stateTokens["--danger-bg"],
    "--control-danger-border": stateTokens["--danger-text"],
    "--control-danger-text": stateTokens["--danger-text"],
    "--control-disabled-bg": toHex(disabledBg),
    "--control-disabled-border": toHex(softenColorAgainstSurface(cardBorder, disabledBg, 1.12, 0.5)),
    "--control-disabled-text": toHex(ensureReadableMixedText(textMain, disabledBg, 0.5, 3.2)),
    "--field-bg": toHex(fieldBg),
    "--field-border": toHex(fieldBorder),
    "--field-text": toHex(chooseReadableColor(textMain, fieldBg, 4.5)),
    "--chip-bg": toHex(chipBg),
    "--chip-border": toHex(chipBorder),
    "--chip-text": toHex(chooseReadableColor(textMuted, chipBg, 4.5, [textMuted, textMain])),
    "--card-bg": toHex(cardBg),
    "--card-border": toHex(cardBorder),
    "--card-title-bg": toHex(cardTitleBg),
    "--dropzone-bg": toHex(dropzoneBg),
    "--dropzone-border": toHex(dropzoneBorder),
    "--dropzone-text": toHex(chooseReadableColor(textMuted, dropzoneBg, 4.5, [textMuted, textMain])),
  };
}

function createDepthTokens(
  palette: SourceThemePalette,
  surfaceTokens: ThemeCssVariables,
  stateTokens: ThemeCssVariables,
): ThemeCssVariables {
  const background = parseHex(palette.background);
  const ink = parseHex(palette.ink);
  const panel = parseCssHex(surfaceTokens["--ui-panel-bg"]);
  const selectedBorder = parseCssHex(stateTokens["--selected-border"]);
  const inkIsDark = relativeLuminance(ink) < 0.5;
  const shadowBase = inkIsDark ? ink : mix(background, BLACK, 0.34);
  const lowerEdge = inkIsDark ? mix(panel, ink, 0.48) : mix(panel, BLACK, 0.18);
  const highlight = inkIsDark ? WHITE : mix(panel, WHITE, 0.55);
  const restShadowAlpha = inkIsDark ? 0.14 : 0.2;
  const panelShadowAlpha = inkIsDark ? 0.12 : 0.18;

  return {
    "--depth-button-rest": [
      `inset 0 1px 0 ${toRgba(highlight, 0.22)}`,
      `inset 0 -1px 0 ${toRgba(lowerEdge, 0.2)}`,
      `0 2px 5px ${toRgba(shadowBase, restShadowAlpha)}`,
    ].join(", "),
    "--depth-button-pressed": [
      `inset 0 2px 4px ${toRgba(shadowBase, inkIsDark ? 0.18 : 0.24)}`,
      `inset 0 1px 0 ${toRgba(highlight, 0.08)}`,
    ].join(", "),
    "--depth-button-selected": [
      `inset 0 1px 0 ${toRgba(highlight, 0.18)}`,
      `inset 0 -1px 0 ${toRgba(selectedBorder, 0.3)}`,
      `0 2px 6px ${toRgba(shadowBase, inkIsDark ? 0.12 : 0.16)}`,
    ].join(", "),
    "--depth-card-rest": [
      `inset 0 1px 0 ${toRgba(highlight, 0.12)}`,
      `0 1px 3px ${toRgba(shadowBase, inkIsDark ? 0.08 : 0.12)}`,
    ].join(", "),
    "--depth-panel": `0 6px 18px ${toRgba(shadowBase, panelShadowAlpha)}`,
    "--depth-inset": [
      `inset 0 1px 4px ${toRgba(shadowBase, inkIsDark ? 0.16 : 0.2)}`,
      `inset 0 1px 0 ${toRgba(highlight, 0.08)}`,
    ].join(", "),
  };
}

function pickActionColor(
  scale: ColorScale,
  surface: Rgb,
  textMain: Rgb,
  textInverse: Rgb,
): { bg: Rgb; hoverBg: Rgb; text: Rgb } {
  const textIsDark = relativeLuminance(textMain) < 0.5;
  const preferredSteps = textIsDark ? [700, 800, 900, 600, 500, 400] : [300, 400, 200, 500, 600, 700];
  const preferredTextCandidates = [textInverse, textMain];

  for (const step of preferredSteps) {
    const bg = parseCssHex(scale[step]);
    if (contrastRatio(bg, surface) < 1.45) {
      continue;
    }

    for (const text of preferredTextCandidates) {
      if (contrastRatio(text, bg) >= 4.5) {
        return {
          bg,
          hoverBg: mix(bg, textMain, textIsDark ? 0.12 : 0.1),
          text,
        };
      }
    }
  }

  const fallbackBg = parseCssHex(scale[textIsDark ? 800 : 300]);
  return {
    bg: fallbackBg,
    hoverBg: mix(fallbackBg, textMain, textIsDark ? 0.12 : 0.1),
    text: chooseReadableColor(textInverse, fallbackBg, 4.5, [textInverse, textMain, WHITE, BLACK]),
  };
}

function pickSurfaceSeparatedScaleColor(
  scale: ColorScale,
  surface: Rgb,
  preferredText: Rgb,
  minimumContrast = 1.5,
): Rgb {
  const preferredSteps = relativeLuminance(preferredText) < 0.5
    ? [600, 700, 500, 800, 400, 900]
    : [400, 300, 500, 200, 600, 700];
  let best = parseCssHex(scale[preferredSteps[0]]);
  let bestContrast = contrastRatio(best, surface);

  for (const step of preferredSteps) {
    const candidate = parseCssHex(scale[step]);
    const candidateContrast = contrastRatio(candidate, surface);
    if (candidateContrast >= minimumContrast) {
      return candidate;
    }
    if (candidateContrast > bestContrast) {
      best = candidate;
      bestContrast = candidateContrast;
    }
  }

  return best;
}

function createTintedSurface(base: Rgb, tint: Rgb, text: Rgb, options: TintedSurfaceOptions): Rgb {
  const amounts = createTintAmounts(options.preferredAmount, options.maxAmount);
  let best = base;
  let bestScore = -Infinity;

  for (const amount of amounts) {
    const candidate = mix(base, tint, amount);
    const textContrast = contrastRatio(text, candidate);
    if (textContrast < options.minTextContrast) {
      continue;
    }

    const surfaceContrast = contrastRatio(candidate, base);
    const distance = colorDistance(candidate, base);
    const score = surfaceContrast + distance * 4 - Math.abs(amount - options.preferredAmount);

    if (
      (surfaceContrast >= options.minSurfaceContrast || distance >= options.minColorDistance)
      && score > bestScore
    ) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function createTintAmounts(preferredAmount: number, maxAmount: number): number[] {
  const max = clamp(maxAmount, 0, 1);
  const preferred = clamp(preferredAmount, 0, max);
  const amounts: number[] = [];

  for (let amount = 0; amount <= max + 0.001; amount += 0.02) {
    amounts.push(Number(amount.toFixed(2)));
  }

  return amounts.sort((first, second) => {
    const firstDistance = Math.abs(first - preferred);
    const secondDistance = Math.abs(second - preferred);
    return firstDistance - secondDistance;
  });
}

function softenColorAgainstSurface(
  color: Rgb,
  surface: Rgb,
  minimumContrast: number,
  maxSurfaceMix: number,
): Rgb {
  for (let amount = maxSurfaceMix; amount >= 0; amount -= 0.02) {
    const candidate = mix(color, surface, amount);
    if (contrastRatio(candidate, surface) >= minimumContrast) {
      return candidate;
    }
  }

  return color;
}

function colorDistance(first: Rgb, second: Rgb): number {
  const red = first.r - second.r;
  const green = first.g - second.g;
  const blue = first.b - second.b;
  return Math.sqrt(red * red + green * green + blue * blue) / Math.sqrt(3 * 255 * 255);
}

function ensureReadableMixedText(text: Rgb, surface: Rgb, initialSurfaceMix: number, targetRatio: number): Rgb {
  for (let mixAmount = initialSurfaceMix; mixAmount >= 0; mixAmount -= 0.05) {
    const candidate = mix(text, surface, mixAmount);
    if (contrastRatio(candidate, surface) >= targetRatio) {
      return candidate;
    }
  }

  return chooseReadableColor(text, surface, targetRatio);
}

function chooseReadableColor(preferred: Rgb, background: Rgb, targetRatio: number, candidates: Rgb[] = []): Rgb {
  if (contrastRatio(preferred, background) >= targetRatio) {
    return preferred;
  }

  const fallbackCandidates = candidates.length > 0 ? candidates : [preferred, WHITE, BLACK];
  return fallbackCandidates.reduce(
    (best, candidate) => contrastRatio(candidate, background) > contrastRatio(best, background) ? candidate : best,
    fallbackCandidates[0],
  );
}

function ensureContrastWithText(surface: Rgb, text: Rgb, targetRatio: number): Rgb {
  if (contrastRatio(surface, text) >= targetRatio) {
    return surface;
  }

  const target = relativeLuminance(text) < 0.5 ? WHITE : BLACK;
  for (let index = 1; index <= 24; index += 1) {
    const candidate = mix(surface, target, index / 24);
    if (contrastRatio(candidate, text) >= targetRatio) {
      return candidate;
    }
  }

  return target;
}

function normalizeHex(hex: string): string {
  return toHex(parseHex(hex));
}

function parseCssHex(value: string): Rgb {
  return parseHex(value);
}

function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, "");
  const expanded = value.length === 3
    ? value.split("").map((character) => `${character}${character}`).join("")
    : value;

  if (!/^[\da-f]{6}$/i.test(expanded)) {
    throw new Error(`Invalid theme color: ${hex}`);
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function toHex(color: Rgb): string {
  return `#${toHexChannel(color.r)}${toHexChannel(color.g)}${toHexChannel(color.b)}`.toUpperCase();
}

function toHexChannel(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function toRgba(color: Rgb, alpha: number): string {
  return `rgba(${clamp(Math.round(color.r), 0, 255)}, ${clamp(Math.round(color.g), 0, 255)}, ${clamp(Math.round(color.b), 0, 255)}, ${alpha.toFixed(3)})`;
}

function mix(color: Rgb, target: Rgb, targetAmount: number): Rgb {
  const amount = clamp(targetAmount, 0, 1);
  return {
    r: color.r + (target.r - color.r) * amount,
    g: color.g + (target.g - color.g) * amount,
    b: color.b + (target.b - color.b) * amount,
  };
}

function contrastRatio(first: Rgb, second: Rgb): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

function relativeLuminance(color: Rgb): number {
  const [r, g, b] = [color.r, color.g, color.b].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
