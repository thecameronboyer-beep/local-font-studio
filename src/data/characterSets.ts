export const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
export const lowercase = "abcdefghijklmnopqrstuvwxyz".split("");
export const headerLetterPrefix = "header:";
export const headerLetters = [...uppercase, ...lowercase].map((character) => `${headerLetterPrefix}${character}`);
export const numbers = "0123456789".split("");
export const punctuation = [".", ",", "?", "!", ":", ";", "'", "\"", "-", "(", ")"];
export const forgotten = ["\u00DE", "\u00FE", "\u00D0", "\u00F0", "\u00C6", "\u00E6"];
export const spacebar = " ";

export const supportedCharacters = [
  ...uppercase,
  ...lowercase,
  ...headerLetters,
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
    showHeaderLetters?: boolean;
    showSpacebar?: boolean;
  };
};

export function getVisibleCharacters(font: FontCharacterVisibility) {
  return [
    ...uppercase,
    ...lowercase,
    ...numbers,
    ...punctuation,
    ...(font.characterSettings?.showHeaderLetters ? headerLetters : []),
    ...(font.characterSettings?.showForgotten ? forgotten : []),
    ...(font.characterSettings?.showSpacebar ? [spacebar] : []),
  ];
}

export function isHeaderLetter(character: string) {
  return character.startsWith(headerLetterPrefix);
}

export function getHeaderSourceCharacter(character: string) {
  return isHeaderLetter(character) ? character.slice(headerLetterPrefix.length) : character;
}

export function getHeaderLetter(character: string) {
  return `${headerLetterPrefix}${character}`;
}

export function canUseHeaderLetter(character: string) {
  return uppercase.includes(character) || lowercase.includes(character);
}

export function getCharacterLabel(character: string) {
  if (isHeaderLetter(character)) {
    return `Header ${getHeaderSourceCharacter(character)}`;
  }

  return character === spacebar ? "spacebar" : character;
}
