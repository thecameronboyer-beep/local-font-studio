export type CustomBackgroundFormatId = "phone" | "square" | "portrait" | "landscape" | "custom";

export type CustomBackgroundLayer = {
  id: string;
  name: string;
  opacity: number;
  order: number;
  visible: boolean;
};

export type CustomBackground = {
  baseColor: string;
  createdAt: string;
  format: CustomBackgroundFormatId;
  height: number;
  id: string;
  layers: CustomBackgroundLayer[];
  name: string;
  thumbnailDataUrl: string;
  updatedAt: string;
  width: number;
};

const customBackgroundStorageKey = "quill.custom-backgrounds.v1";
const customBackgroundDbName = "quill.custom-background-images.v1";
const customBackgroundDbStoreName = "backgrounds";
const customBackgroundDbVersion = 1;

type StoredCustomBackgroundImage = {
  blob: Blob;
  id: string;
  mimeType: string;
  storedAt: string;
};

export function createCustomBackgroundId(prefix = "background"): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createCustomBackgroundLayer(name = "Layer 1"): CustomBackgroundLayer {
  return {
    id: createCustomBackgroundId("background-layer"),
    name,
    opacity: 1,
    order: 0,
    visible: true,
  };
}

export function loadCustomBackgrounds(): CustomBackground[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(customBackgroundStorageKey) ?? "[]") as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isCustomBackground).map(normalizeCustomBackground);
  } catch {
    return [];
  }
}

export function saveCustomBackgrounds(backgrounds: CustomBackground[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    customBackgroundStorageKey,
    JSON.stringify(backgrounds.map(normalizeCustomBackground).slice(0, 48)),
  );
}

export function upsertCustomBackground(
  backgrounds: CustomBackground[],
  background: CustomBackground,
): CustomBackground[] {
  const normalized = normalizeCustomBackground(background);
  return [normalized, ...backgrounds.filter((item) => item.id !== normalized.id)].slice(0, 48);
}

export async function getCustomBackgroundFlatBlob(backgroundId: string): Promise<Blob | null> {
  return getCustomBackgroundBlob(getFlatBlobKey(backgroundId));
}

export async function putCustomBackgroundFlatBlob(backgroundId: string, blob: Blob): Promise<void> {
  await putCustomBackgroundBlob(getFlatBlobKey(backgroundId), blob);
}

export async function getCustomBackgroundLayerBlob(backgroundId: string, layerId: string): Promise<Blob | null> {
  return getCustomBackgroundBlob(getLayerBlobKey(backgroundId, layerId));
}

export async function putCustomBackgroundLayerBlob(
  backgroundId: string,
  layerId: string,
  blob: Blob,
): Promise<void> {
  await putCustomBackgroundBlob(getLayerBlobKey(backgroundId, layerId), blob);
}

export async function deleteCustomBackgroundImages(background: CustomBackground): Promise<void> {
  const keys = [
    getFlatBlobKey(background.id),
    ...background.layers.map((layer) => getLayerBlobKey(background.id, layer.id)),
  ];

  await Promise.all(keys.map(deleteCustomBackgroundBlob));
}

function normalizeCustomBackground(background: CustomBackground): CustomBackground {
  const width = clampInteger(background.width, 1080, 120, 6000);
  const height = clampInteger(background.height, 1920, 120, 6000);
  const layers = Array.isArray(background.layers)
    ? background.layers.filter(isCustomBackgroundLayer).map(normalizeCustomBackgroundLayer)
    : [];

  return {
    ...background,
    baseColor: normalizeColor(background.baseColor, "#fff7ef"),
    createdAt: typeof background.createdAt === "string" ? background.createdAt : new Date().toISOString(),
    format: isCustomBackgroundFormat(background.format) ? background.format : "phone",
    height,
    id: typeof background.id === "string" && background.id ? background.id : createCustomBackgroundId(),
    layers: layers.length ? layers.sort((left, right) => left.order - right.order) : [createCustomBackgroundLayer()],
    name: normalizeName(background.name),
    thumbnailDataUrl: typeof background.thumbnailDataUrl === "string" ? background.thumbnailDataUrl : "",
    updatedAt: typeof background.updatedAt === "string" ? background.updatedAt : new Date().toISOString(),
    width,
  };
}

function normalizeCustomBackgroundLayer(layer: CustomBackgroundLayer): CustomBackgroundLayer {
  return {
    ...layer,
    id: typeof layer.id === "string" && layer.id ? layer.id : createCustomBackgroundId("background-layer"),
    name: normalizeName(layer.name, "Layer"),
    opacity: clampNumber(layer.opacity, 1, 0, 1),
    order: clampInteger(layer.order, 0, 0, 99),
    visible: typeof layer.visible === "boolean" ? layer.visible : true,
  };
}

function isCustomBackground(value: unknown): value is CustomBackground {
  if (!value || typeof value !== "object") {
    return false;
  }

  const background = value as Partial<CustomBackground>;
  return (
    typeof background.id === "string" &&
    typeof background.name === "string" &&
    typeof background.width === "number" &&
    typeof background.height === "number" &&
    Array.isArray(background.layers)
  );
}

function isCustomBackgroundLayer(value: unknown): value is CustomBackgroundLayer {
  if (!value || typeof value !== "object") {
    return false;
  }

  const layer = value as Partial<CustomBackgroundLayer>;
  return typeof layer.id === "string" && typeof layer.name === "string";
}

function isCustomBackgroundFormat(value: unknown): value is CustomBackgroundFormatId {
  return value === "phone" || value === "square" || value === "portrait" || value === "landscape" || value === "custom";
}

function normalizeName(value: string, fallback = "Untitled background"): string {
  return (typeof value === "string" ? value : "").trim().replace(/\s+/g, " ").slice(0, 80) || fallback;
}

function normalizeColor(value: string, fallback: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function clampInteger(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function clampNumber(value: number, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function getFlatBlobKey(backgroundId: string): string {
  return `${backgroundId}:flat`;
}

function getLayerBlobKey(backgroundId: string, layerId: string): string {
  return `${backgroundId}:layer:${layerId}`;
}

async function getCustomBackgroundBlob(key: string): Promise<Blob | null> {
  const db = await openCustomBackgroundDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(customBackgroundDbStoreName, "readonly");
    const store = transaction.objectStore(customBackgroundDbStoreName);
    const request = store.get(key);

    request.onerror = () => reject(request.error ?? new Error("Could not load custom background image."));
    request.onsuccess = () => {
      const record = request.result as StoredCustomBackgroundImage | undefined;
      resolve(record?.blob ?? null);
    };
  });
}

async function putCustomBackgroundBlob(key: string, blob: Blob): Promise<void> {
  const db = await openCustomBackgroundDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(customBackgroundDbStoreName, "readwrite");
    const store = transaction.objectStore(customBackgroundDbStoreName);
    const request = store.put({
      blob,
      id: key,
      mimeType: blob.type || "image/png",
      storedAt: new Date().toISOString(),
    } satisfies StoredCustomBackgroundImage);

    request.onerror = () => reject(request.error ?? new Error("Could not save custom background image."));
    request.onsuccess = () => resolve();
  });
}

async function deleteCustomBackgroundBlob(key: string): Promise<void> {
  const db = await openCustomBackgroundDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(customBackgroundDbStoreName, "readwrite");
    const store = transaction.objectStore(customBackgroundDbStoreName);
    const request = store.delete(key);

    request.onerror = () => reject(request.error ?? new Error("Could not delete custom background image."));
    request.onsuccess = () => resolve();
  });
}

function openCustomBackgroundDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(customBackgroundDbName, customBackgroundDbVersion);

    request.onerror = () => reject(request.error ?? new Error("Could not open custom background storage."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(customBackgroundDbStoreName)) {
        db.createObjectStore(customBackgroundDbStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}
