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

const characterLabels: Record<string, string> = {
  [spacebar]: "spacebar",
  "\u00DE": "Thorn",
  "\u00FE": "thorn",
  "\u00D0": "Eth",
  "\u00F0": "eth",
  "\u00C6": "Ash",
  "\u00E6": "ash",
};

export function getCharacterLabel(character: string) {
  return characterLabels[character] ?? character;
}
