export const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const lowercase = "abcdefghijklmnopqrstuvwxyz".split("");
export const numbers = "0123456789".split("");
export const punctuation = [".", ",", "?", "!", ":", ";", "'", "\"", "-", "(", ")", " "];

export const supportedCharacters = [
  ...uppercase,
  ...lowercase,
  ...numbers,
  ...punctuation,
];

export function getCharacterLabel(character: string) {
  return character === " " ? "space" : character;
}
