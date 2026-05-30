export const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const lowercase = "abcdefghijklmnopqrstuvwxyz".split("");
export const numbers = "0123456789".split("");
export const punctuation = [".", ",", "?", "!", ":", ";", "'", "\"", "-", "(", ")"];
export const spacebar = " ";

export const supportedCharacters = [
  ...uppercase,
  ...lowercase,
  ...numbers,
  ...punctuation,
];

export const fontCharacters = [
  ...supportedCharacters,
  spacebar,
];

export function getCharacterLabel(character: string) {
  return character === spacebar ? "spacebar" : character;
}
