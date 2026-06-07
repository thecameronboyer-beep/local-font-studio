import type { SavedImage } from "../types/fontTypes";

const SAVED_IMAGES_KEY = "quill:saved-images:v1";

export const MAX_SAVED_IMAGES = 24;

function isSavedImage(value: unknown): value is SavedImage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const image = value as Partial<SavedImage>;

  return (
    typeof image.createdAt === "string" &&
    typeof image.fontName === "string" &&
    typeof image.height === "number" &&
    typeof image.id === "string" &&
    typeof image.imageDataUrl === "string" &&
    typeof image.message === "string" &&
    typeof image.width === "number"
  );
}

export function loadSavedImages(): SavedImage[] {
  if (typeof window === "undefined") {
    return [];
  }

  const rawData = window.localStorage.getItem(SAVED_IMAGES_KEY);

  if (!rawData) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawData);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isSavedImage).slice(0, MAX_SAVED_IMAGES);
  } catch {
    return [];
  }
}

export function saveSavedImages(images: SavedImage[]) {
  window.localStorage.setItem(SAVED_IMAGES_KEY, JSON.stringify(images.slice(0, MAX_SAVED_IMAGES)));
}
