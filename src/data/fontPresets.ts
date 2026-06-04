export type FontPresetId =
  | "fredoka"
  | "baloo2"
  | "dynapuff"
  | "bubblegumSans"
  | "sniglet"
  | "patrickHand"
  | "shortStack"
  | "schoolbell"
  | "comicNeue"
  | "cuteFont"
  | "singleDay"
  | "gaegu"
  | "cedarvilleCursive"
  | "imFellEnglish"
  | "imFellDWPica"
  | "medievalSharp"
  | "uncialAntiqua"
  | "germaniaOne"
  | "pirataOne"
  | "grenzeGotisch"
  | "oldStandardTT"
  | "cinzelDecorative"
  | "almendraSC";

export type FontPreset = {
  family: string;
  id: FontPresetId;
  label: string;
  license: "Apache-2.0" | "OFL";
  sourcePath: string;
  weight: number;
};

const FONT_PRESET_PREFIX = "preset:";

export const fontPresets: FontPreset[] = [
  {
    family: "LFS Fredoka",
    id: "fredoka",
    label: "Fredoka",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/Fredoka.ttf",
    weight: 600,
  },
  {
    family: "LFS Baloo 2",
    id: "baloo2",
    label: "Baloo 2",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/Baloo2.ttf",
    weight: 600,
  },
  {
    family: "LFS DynaPuff",
    id: "dynapuff",
    label: "DynaPuff",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/DynaPuff.ttf",
    weight: 600,
  },
  {
    family: "LFS Bubblegum Sans",
    id: "bubblegumSans",
    label: "Bubblegum Sans",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/BubblegumSans-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Sniglet",
    id: "sniglet",
    label: "Sniglet",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/Sniglet-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Patrick Hand",
    id: "patrickHand",
    label: "Patrick Hand",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/PatrickHand-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Short Stack",
    id: "shortStack",
    label: "Short Stack",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/ShortStack-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Schoolbell",
    id: "schoolbell",
    label: "Schoolbell",
    license: "Apache-2.0",
    sourcePath: "/assets/fonts/presets/Schoolbell-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Comic Neue",
    id: "comicNeue",
    label: "Comic Neue",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/ComicNeue-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Cute Font",
    id: "cuteFont",
    label: "Cute Font",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/CuteFont-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Single Day",
    id: "singleDay",
    label: "Single Day",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/SingleDay-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Gaegu",
    id: "gaegu",
    label: "Gaegu",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/Gaegu-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Cedarville Cursive",
    id: "cedarvilleCursive",
    label: "Cedarville Cursive",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/Cedarville-Cursive.ttf",
    weight: 400,
  },
  {
    family: "LFS IM Fell English",
    id: "imFellEnglish",
    label: "IM Fell English",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/IMFellEnglish-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS IM Fell DW Pica",
    id: "imFellDWPica",
    label: "IM Fell DW Pica",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/IMFellDWPica-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS MedievalSharp",
    id: "medievalSharp",
    label: "MedievalSharp",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/MedievalSharp-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Uncial Antiqua",
    id: "uncialAntiqua",
    label: "Uncial Antiqua",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/UncialAntiqua-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Germania One",
    id: "germaniaOne",
    label: "Germania One",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/GermaniaOne-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Pirata One",
    id: "pirataOne",
    label: "Pirata One",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/PirataOne-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Grenze Gotisch",
    id: "grenzeGotisch",
    label: "Grenze Gotisch",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/GrenzeGotisch.ttf",
    weight: 700,
  },
  {
    family: "LFS Old Standard TT",
    id: "oldStandardTT",
    label: "Old Standard TT",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/OldStandardTT-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Cinzel Decorative",
    id: "cinzelDecorative",
    label: "Cinzel Decorative",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/CinzelDecorative-Regular.ttf",
    weight: 400,
  },
  {
    family: "LFS Almendra SC",
    id: "almendraSC",
    label: "Almendra SC",
    license: "OFL",
    sourcePath: "/assets/fonts/presets/AlmendraSC-Regular.ttf",
    weight: 400,
  },
];

export function getFontPresetOptionId(id: FontPresetId) {
  return `${FONT_PRESET_PREFIX}${id}`;
}

export function getFontPresetById(id: string | null | undefined) {
  return fontPresets.find((preset) => preset.id === id) ?? null;
}

export function getFontPresetFromOptionId(optionId: string) {
  if (!optionId.startsWith(FONT_PRESET_PREFIX)) {
    return null;
  }

  const presetId = optionId.slice(FONT_PRESET_PREFIX.length);

  return fontPresets.find((preset) => preset.id === presetId) ?? null;
}

export function getFontPresetCanvasFont(preset: FontPreset, size: number) {
  return `${preset.weight} ${size}px "${preset.family}", ui-sans-serif, system-ui, sans-serif`;
}
