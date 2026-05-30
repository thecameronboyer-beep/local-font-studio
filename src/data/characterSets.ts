export const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const lowercase = "abcdefghijklmnopqrstuvwxyz".split("");
export const numbers = "0123456789".split("");
export const punctuation = [".", ",", "?", "!", ":", ";", "'", "\"", "-", "(", ")"];
export const forgotten = ["\u00DE", "\u00FE", "\u00D0", "\u00F0", "\u00C6", "\u00E6"];
export const spacebar = " ";

export const supportedCharacters = [
  ...uppercase,
  ...lowercase,
  ...numbers,
  ...punctuation,
  ...forgotten,
];

export const fontCharacters = [
  ...supportedCharacters,
  spacebar,
];

type FontCharacterVisibility = {
  characterSettings?: {
    showForgotten?: boolean;
    showSpacebar?: boolean;
  };
};

export function getVisibleCharacters(font: FontCharacterVisibility) {
  return [
    ...uppercase,
    ...lowercase,
    ...numbers,
    ...punctuation,
    ...(font.characterSettings?.showForgotten ? forgotten : []),
    ...(font.characterSettings?.showSpacebar ? [spacebar] : []),
  ];
}

export function getCharacterLabel(character: string) {
  return character === spacebar ? "spacebar" : character;
}
