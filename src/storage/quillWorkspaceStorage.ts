export type CompiledPage = {
  id: string;
  title: string;
  textContent: string;
  excerpt: string;
  width: number;
  height: number;
  createdAt: string;
  updatedAt: string;
};

export type PlacedPage = {
  id: string;
  pageId: string;
  title: string;
  addedAt: string;
};

export type BookStructureKind = "chapter" | "cover" | "introduction" | "section";

export type AutoBookSectionKey = "story" | "changelog";

export type BookStructureItem = {
  id: string;
  title: string;
  kind: BookStructureKind;
  createdAt: string;
  placedPages: PlacedPage[];
  systemSectionKey?: AutoBookSectionKey;
};

export type BookCompilation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  structureItems: BookStructureItem[];
  placedPages: PlacedPage[];
};

export type SaveRenderedQuillPageInput = {
  blob: Blob;
  height: number;
  pageId?: string;
  textContent: string;
  title: string;
  width: number;
};

export type UpdateEntry = {
  bookId: string;
  changelogPageId: string;
  changelogPageNumber: number;
  changelogText: string;
  createdAt: string;
  entryPairId: string;
  id: string;
  sourceActivityId: string;
  storyPageId: string;
  storyPageNumber: number;
  storyText: string;
};

const quillPagesStorageKey = "quill.pages.v1";
const bookCompilationsStorageKey = "quill.book-compilations.v1";
const updateEntriesStorageKey = "quill.update-entries.v1";
const imageDbName = "quill.page-images.v1";
const imageDbStoreName = "pages";
const imageDbVersion = 1;

type StoredPageImage = {
  id: string;
  blob: Blob;
  mimeType: string;
  storedAt: string;
};

export function createQuillId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadCompiledPages(): CompiledPage[] {
  return readJsonArray(quillPagesStorageKey).filter(isCompiledPage);
}

export function saveCompiledPages(pages: CompiledPage[]): void {
  window.localStorage.setItem(quillPagesStorageKey, JSON.stringify(pages.map(normalizeCompiledPage)));
}

export function loadBookCompilations(): BookCompilation[] {
  const books = readJsonArray(bookCompilationsStorageKey).filter(isBookCompilation).map(normalizeBookCompilation);
  return books.length ? books : [createBookCompilation("Untitled Book")];
}

export function saveBookCompilations(books: BookCompilation[]): void {
  const normalizedBooks = books.length ? books.map(normalizeBookCompilation) : [createBookCompilation("Untitled Book")];
  window.localStorage.setItem(bookCompilationsStorageKey, JSON.stringify(normalizedBooks));
}

export function loadUpdateEntries(): UpdateEntry[] {
  return readJsonArray(updateEntriesStorageKey)
    .filter(isUpdateEntry)
    .map(normalizeUpdateEntry)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function saveUpdateEntries(entries: UpdateEntry[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    updateEntriesStorageKey,
    JSON.stringify(entries.map(normalizeUpdateEntry)),
  );
}

export function createBookCompilation(title = "Untitled Book"): BookCompilation {
  const now = new Date().toISOString();

  return {
    id: createQuillId("book"),
    title: normalizeTitle(title, "Untitled Book"),
    createdAt: now,
    updatedAt: now,
    structureItems: getDefaultBookStructureItems(),
    placedPages: [],
  };
}

export function createBookStructureItem(
  title = "Chapter",
  kind: BookStructureKind = "chapter",
  systemSectionKey?: AutoBookSectionKey,
): BookStructureItem {
  const now = new Date().toISOString();

  return {
    id: createQuillId("book-section"),
    title: normalizeTitle(title, "Chapter"),
    kind,
    createdAt: now,
    placedPages: [],
    ...(systemSectionKey ? { systemSectionKey } : {}),
  };
}

export function createPlacedPage(page: CompiledPage): PlacedPage {
  return {
    id: createQuillId("placed-page"),
    pageId: page.id,
    title: page.title,
    addedAt: new Date().toISOString(),
  };
}

export async function saveRenderedQuillPage(input: SaveRenderedQuillPageInput): Promise<CompiledPage> {
  const now = new Date().toISOString();
  const page: CompiledPage = {
    id: input.pageId ?? createQuillId("page"),
    title: normalizeTitle(input.title, "Untitled Page"),
    textContent: normalizeTextContent(input.textContent),
    excerpt: getExcerpt(input.textContent),
    width: Math.max(1, Math.round(input.width)),
    height: Math.max(1, Math.round(input.height)),
    createdAt: now,
    updatedAt: now,
  };

  await putCompiledPageImage(page.id, input.blob);
  saveCompiledPages(upsertCompiledPage(loadCompiledPages(), page));

  return page;
}

export function ensureBookHasAutoSections(book: BookCompilation): BookCompilation {
  const structureItems = ensureBookCoverFirst(
    withRequiredAutoSections(
      Array.isArray(book.structureItems)
        ? book.structureItems.filter(isBookStructureItem).map(normalizeBookStructureItem)
        : [],
    ),
  );

  return {
    ...book,
    structureItems,
    placedPages: flattenStructurePages(structureItems),
  };
}

export function addStructureItemToCompilation(
  books: BookCompilation[],
  bookId: string,
  title: string,
  kind: BookStructureKind = "chapter",
): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) => {
    if (book.id !== bookId) {
      return book;
    }

    const structureItems = getNormalizedStructureItems(book);
    const nextStructureItems = [...structureItems, createBookStructureItem(title, kind)];

    return {
      ...book,
      structureItems: nextStructureItems,
      placedPages: flattenStructurePages(nextStructureItems),
      updatedAt: now,
    };
  });
}

export function renameStructureItemInCompilation(
  books: BookCompilation[],
  bookId: string,
  structureItemId: string,
  title: string,
): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) => {
    if (book.id !== bookId) {
      return book;
    }

    const structureItems = getNormalizedStructureItems(book).map((item) =>
      item.id === structureItemId
        ? {
            ...item,
            title: normalizeTitle(title, item.title),
          }
        : item,
    );

    return {
      ...book,
      structureItems,
      placedPages: flattenStructurePages(structureItems),
      updatedAt: now,
    };
  });
}

export function removeStructureItemFromCompilation(
  books: BookCompilation[],
  bookId: string,
  structureItemId: string,
): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) => {
    if (book.id !== bookId) {
      return book;
    }

    const structureItems = getNormalizedStructureItems(book).filter((item) => item.id !== structureItemId);

    return {
      ...book,
      structureItems,
      placedPages: flattenStructurePages(structureItems),
      updatedAt: now,
    };
  });
}

export function placePageInCompilation(
  books: BookCompilation[],
  bookId: string,
  page: CompiledPage,
  structureItemId?: string,
): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) => {
    if (book.id !== bookId) {
      return book;
    }

    const structureItems = getNormalizedStructureItems(book);
    const fallbackItem = structureItems[0] ?? createBookStructureItem("Chapter 1", "chapter");
    const targetItemId = structureItemId && structureItems.some((item) => item.id === structureItemId)
      ? structureItemId
      : fallbackItem.id;
    const placedPage = createPlacedPage(page);
    const nextStructureItems = (structureItems.length ? structureItems : [fallbackItem]).map((item) =>
      item.id === targetItemId
        ? {
            ...item,
            placedPages: [...item.placedPages, placedPage],
          }
        : item,
    );

    return {
      ...book,
      structureItems: nextStructureItems,
      placedPages: flattenStructurePages(nextStructureItems),
      updatedAt: now,
    };
  });
}

export function removePlacedPageFromCompilation(
  books: BookCompilation[],
  bookId: string,
  placedPageId: string,
): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) => {
    if (book.id !== bookId) {
      return book;
    }

    const structureItems = getNormalizedStructureItems(book).map((item) => ({
      ...item,
      placedPages: item.placedPages.filter((page) => page.id !== placedPageId),
    }));

    return {
      ...book,
      structureItems,
      placedPages: flattenStructurePages(structureItems),
      updatedAt: now,
    };
  });
}

export function movePlacedPageInCompilation(
  books: BookCompilation[],
  bookId: string,
  placedPageId: string,
  offset: number,
): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) => {
    if (book.id !== bookId) {
      return book;
    }

    const structureItems = getNormalizedStructureItems(book);
    const sectionIndex = structureItems.findIndex((item) => item.placedPages.some((page) => page.id === placedPageId));

    if (sectionIndex < 0) {
      return book;
    }

    const section = structureItems[sectionIndex];
    const fromIndex = section.placedPages.findIndex((page) => page.id === placedPageId);
    const toIndex = fromIndex + offset;

    if (fromIndex < 0 || toIndex < 0 || toIndex >= section.placedPages.length) {
      return book;
    }

    const placedPages = [...section.placedPages];
    const [page] = placedPages.splice(fromIndex, 1);
    if (!page) {
      return book;
    }
    placedPages.splice(toIndex, 0, page);
    const nextStructureItems = structureItems.map((item, index) =>
      index === sectionIndex
        ? {
            ...item,
            placedPages,
          }
        : item,
    );

    return {
      ...book,
      structureItems: nextStructureItems,
      placedPages: flattenStructurePages(nextStructureItems),
      updatedAt: now,
    };
  });
}

export function movePlacedPageToStructureItemInCompilation(
  books: BookCompilation[],
  bookId: string,
  placedPageId: string,
  targetStructureItemId: string,
  targetIndex: number,
): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) => {
    if (book.id !== bookId) {
      return book;
    }

    const structureItems = getNormalizedStructureItems(book);
    const sourceItem = structureItems.find((item) => item.placedPages.some((page) => page.id === placedPageId));
    const placedPage = sourceItem?.placedPages.find((page) => page.id === placedPageId);

    if (!sourceItem || !placedPage || !structureItems.some((item) => item.id === targetStructureItemId)) {
      return book;
    }

    const withoutPlacedPage = structureItems.map((item) => ({
      ...item,
      placedPages: item.placedPages.filter((page) => page.id !== placedPageId),
    }));
    const nextStructureItems = withoutPlacedPage.map((item) => {
      if (item.id !== targetStructureItemId) {
        return item;
      }

      const clampedIndex = Math.max(0, Math.min(targetIndex, item.placedPages.length));
      const placedPages = [...item.placedPages];
      placedPages.splice(clampedIndex, 0, placedPage);

      return {
        ...item,
        placedPages,
      };
    });

    return {
      ...book,
      structureItems: nextStructureItems,
      placedPages: flattenStructurePages(nextStructureItems),
      updatedAt: now,
    };
  });
}

export function renameBookCompilation(books: BookCompilation[], bookId: string, title: string): BookCompilation[] {
  const now = new Date().toISOString();

  return books.map((book) =>
    book.id === bookId
      ? {
          ...book,
          title: normalizeTitle(title, book.title),
          updatedAt: now,
        }
      : book,
  );
}

export async function getCompiledPageImageBlob(pageId: string): Promise<Blob | null> {
  const db = await openImageDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(imageDbStoreName, "readonly");
    const store = transaction.objectStore(imageDbStoreName);
    const request = store.get(pageId);

    request.onerror = () => reject(request.error ?? new Error("Could not load page image."));
    request.onsuccess = () => {
      const record = request.result as StoredPageImage | undefined;
      resolve(record?.blob ?? null);
    };
  });
}

async function putCompiledPageImage(pageId: string, blob: Blob): Promise<void> {
  const db = await openImageDb();

  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(imageDbStoreName, "readwrite");
    const store = transaction.objectStore(imageDbStoreName);
    const request = store.put({
      id: pageId,
      blob,
      mimeType: blob.type || "image/png",
      storedAt: new Date().toISOString(),
    } satisfies StoredPageImage);

    request.onerror = () => reject(request.error ?? new Error("Could not save page image."));
    request.onsuccess = () => resolve();
  });
}

function readJsonArray(key: string): unknown[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeCompiledPage(page: CompiledPage): CompiledPage {
  return {
    ...page,
    title: normalizeTitle(page.title, "Untitled Page"),
    textContent: normalizeTextContent(page.textContent),
    excerpt: getExcerpt(page.textContent || page.excerpt),
    width: Math.max(1, Math.round(page.width)),
    height: Math.max(1, Math.round(page.height)),
  };
}

function normalizeBookCompilation(book: BookCompilation): BookCompilation {
  const structureItems = getNormalizedStructureItems(book);

  return {
    ...book,
    title: normalizeTitle(book.title, "Untitled Book"),
    structureItems,
    placedPages: flattenStructurePages(structureItems),
  };
}

function flattenStructurePages(structureItems: BookStructureItem[]): PlacedPage[] {
  return structureItems.flatMap((item) => item.placedPages);
}

function getNormalizedStructureItems(book: BookCompilation): BookStructureItem[] {
  const existingItems = Array.isArray(book.structureItems)
    ? book.structureItems.filter(isBookStructureItem).map(normalizeBookStructureItem)
    : [];

  if (existingItems.length > 0) {
    return ensureBookCoverFirst(withRequiredAutoSections(existingItems));
  }

  const placedPages = Array.isArray(book.placedPages)
    ? book.placedPages.filter(isPlacedPage).map(normalizePlacedPage)
    : [];

  if (placedPages.length === 0) {
    return getDefaultBookStructureItems();
  }

  return ensureBookCoverFirst(withRequiredAutoSections([
    {
      ...createBookStructureItem("Chapter 1", "chapter"),
      placedPages,
    },
  ]));
}

function ensureBookCoverFirst(structureItems: BookStructureItem[]): BookStructureItem[] {
  const coverIndex = structureItems.findIndex((item) => item.kind === "cover");

  if (coverIndex === 0) {
    return structureItems;
  }

  if (coverIndex > 0) {
    const cover = structureItems[coverIndex];
    return [cover, ...structureItems.filter((_, index) => index !== coverIndex)];
  }

  return [createBookStructureItem("Book Cover", "cover"), ...structureItems];
}

function normalizeBookStructureItem(item: BookStructureItem): BookStructureItem {
  return {
    ...item,
    title: normalizeTitle(item.title, "Chapter"),
    kind: isBookStructureKind(item.kind) ? item.kind : "chapter",
    placedPages: item.placedPages.filter(isPlacedPage).map(normalizePlacedPage),
    ...(isAutoBookSectionKey(item.systemSectionKey) ? { systemSectionKey: item.systemSectionKey } : {}),
  };
}

function normalizePlacedPage(page: PlacedPage): PlacedPage {
  return {
    ...page,
    title: normalizeTitle(page.title, "Untitled Page"),
  };
}

function isCompiledPage(value: unknown): value is CompiledPage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const page = value as Partial<CompiledPage>;
  return (
    typeof page.id === "string" &&
    typeof page.title === "string" &&
    typeof page.width === "number" &&
    typeof page.height === "number" &&
    typeof page.createdAt === "string" &&
    typeof page.updatedAt === "string"
  );
}

function isPlacedPage(value: unknown): value is PlacedPage {
  if (!value || typeof value !== "object") {
    return false;
  }

  const page = value as Partial<PlacedPage>;
  return (
    typeof page.id === "string" &&
    typeof page.pageId === "string" &&
    typeof page.title === "string" &&
    typeof page.addedAt === "string"
  );
}

function isBookStructureItem(value: unknown): value is BookStructureItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Partial<BookStructureItem>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.createdAt === "string" &&
    Array.isArray(item.placedPages)
  );
}

function isAutoBookSectionKey(value: unknown): value is AutoBookSectionKey {
  return value === "story" || value === "changelog";
}

function isBookStructureKind(value: unknown): value is BookStructureKind {
  return value === "chapter" || value === "cover" || value === "introduction" || value === "section";
}

function isBookCompilation(value: unknown): value is BookCompilation {
  if (!value || typeof value !== "object") {
    return false;
  }

  const book = value as Partial<BookCompilation>;
  return (
    typeof book.id === "string" &&
    typeof book.title === "string" &&
    typeof book.createdAt === "string" &&
    typeof book.updatedAt === "string" &&
    Array.isArray(book.placedPages)
  );
}

function isUpdateEntry(value: unknown): value is UpdateEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<UpdateEntry>;
  return (
    typeof entry.id === "string" &&
    typeof entry.bookId === "string" &&
    typeof entry.sourceActivityId === "string" &&
    typeof entry.createdAt === "string" &&
    typeof entry.storyPageId === "string" &&
    typeof entry.changelogPageId === "string" &&
    typeof entry.storyPageNumber === "number" &&
    typeof entry.changelogPageNumber === "number" &&
    typeof entry.storyText === "string" &&
    typeof entry.changelogText === "string"
  );
}

function normalizeUpdateEntry(entry: UpdateEntry): UpdateEntry {
  return {
    ...entry,
    changelogPageNumber: Math.max(1, Math.round(entry.changelogPageNumber)),
    changelogText: normalizeTextContent(entry.changelogText),
    storyPageNumber: Math.max(1, Math.round(entry.storyPageNumber)),
    storyText: normalizeTextContent(entry.storyText),
  };
}

function normalizeTitle(value: string, fallback: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 96) || fallback;
}

function normalizeTextContent(value: string): string {
  return value.replace(/\r\n?/g, "\n").trim().slice(0, 120_000);
}

function getExcerpt(text: string): string {
  const excerpt = normalizeTextContent(text).replace(/\s+/g, " ").slice(0, 150);
  return excerpt || "Saved Quill page.";
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(imageDbName, imageDbVersion);

    request.onerror = () => reject(request.error ?? new Error("Could not open Quill page image storage."));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(imageDbStoreName)) {
        db.createObjectStore(imageDbStoreName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function upsertCompiledPage(pages: CompiledPage[], page: CompiledPage): CompiledPage[] {
  const nextPages = pages.filter((item) => item.id !== page.id);
  return [page, ...nextPages];
}

function getDefaultBookStructureItems(): BookStructureItem[] {
  return [
    createBookStructureItem("Book Cover", "cover"),
    createBookStructureItem("Story", "section", "story"),
    createBookStructureItem("Changelog", "section", "changelog"),
  ];
}

function withRequiredAutoSections(structureItems: BookStructureItem[]): BookStructureItem[] {
  const nextItems = [...structureItems];

  if (!nextItems.some((item) => item.systemSectionKey === "story")) {
    nextItems.push(createBookStructureItem("Story", "section", "story"));
  }

  if (!nextItems.some((item) => item.systemSectionKey === "changelog")) {
    nextItems.push(createBookStructureItem("Changelog", "section", "changelog"));
  }

  return nextItems.map((item) => {
    if (item.systemSectionKey === "story") {
      return {
        ...item,
        kind: "section",
        title: "Story",
      };
    }

    if (item.systemSectionKey === "changelog") {
      return {
        ...item,
        kind: "section",
        title: "Changelog",
      };
    }

    return item;
  });
}
