import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { ChevronDown, ChevronRight, Menu, Plus } from "lucide-react";
import type {
  BookCompilation,
  BookStructureKind,
  BookStructureItem,
  CompiledPage,
  PlacedPage,
} from "../storage/quillWorkspaceStorage";
import { QuillPageImage } from "./QuillPageImage";

type CompileViewMode = "pages" | "structure";

type CompileViewProps = {
  activeBook: BookCompilation;
  activePageId: string;
  books: BookCompilation[];
  pages: CompiledPage[];
  onAddStructureItem: (kind: BookStructureKind, title: string) => void;
  onCreateBook: () => void;
  onDeletePage: (pageId: string) => void;
  onMovePlacedPage: (placedPageId: string, offset: number) => void;
  onMovePlacedPageToLocation: (placedPageId: string, structureItemId: string, targetIndex: number) => void;
  onOpenAppMenu: () => void;
  onPlacePage: (pageId: string, structureItemId?: string) => void;
  onRemovePlacedPage: (placedPageId: string) => void;
  onRemoveStructureItem: (structureItemId: string) => void;
  onRenameBook: (title: string) => void;
  onRenameStructureItem: (structureItemId: string, title: string) => void;
  onSelectBook: (bookId: string) => void;
  onSelectPage: (pageId: string) => void;
  onUploadPages: (files: File[]) => void;
};

type PlacedPageEntry = {
  page: CompiledPage | null;
  placedPage: PlacedPage;
  placedIndex: number;
  structureIndex: number;
  structureItem: BookStructureItem;
};

const savedPageScreenSize = 10;
const savedPageDragType = "application/x-quill-saved-page";
const placedPageDragType = "application/x-quill-placed-page";
const bookTitleCardId = "book-title";

const structureQuickAdds: Array<{ kind: BookStructureKind; label: string; title: string }> = [
  { kind: "cover", label: "Cover", title: "Book Cover" },
  { kind: "introduction", label: "Intro", title: "Introduction" },
  { kind: "section", label: "Section", title: "Section" },
  { kind: "chapter", label: "Chapter", title: "Chapter" },
];

function getStructureKindLabel(kind: BookStructureKind) {
  if (kind === "cover") {
    return "Cover";
  }

  if (kind === "introduction") {
    return "Introduction";
  }

  if (kind === "chapter") {
    return "Chapter";
  }

  return "Section";
}

function getPageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

function getPageRangeLabel(total: number, pageIndex: number, pageSize: number, emptyLabel: string) {
  if (total <= 0) {
    return emptyLabel;
  }

  const start = pageIndex * pageSize + 1;
  const end = Math.min(total, start + pageSize - 1);

  return `${start}-${end} of ${total}`;
}

export function CompileView({
  activeBook,
  activePageId,
  books,
  pages,
  onAddStructureItem,
  onCreateBook,
  onDeletePage,
  onMovePlacedPage,
  onMovePlacedPageToLocation,
  onOpenAppMenu,
  onPlacePage,
  onRemovePlacedPage,
  onRemoveStructureItem,
  onRenameBook,
  onRenameStructureItem,
  onSelectBook,
  onSelectPage,
  onUploadPages,
}: CompileViewProps) {
  const [activeView, setActiveView] = useState<CompileViewMode>("structure");
  const [structureAddOpen, setStructureAddOpen] = useState(false);
  const [savedPagesPageIndex, setSavedPagesPageIndex] = useState(0);
  const [selectedTrayPageId, setSelectedTrayPageId] = useState("");
  const [selectedStructureCardId, setSelectedStructureCardId] = useState(bookTitleCardId);
  const [dragTargetId, setDragTargetId] = useState("");
  const [minimizedStructureItemIds, setMinimizedStructureItemIds] = useState<string[]>([]);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const pageById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const structureItems = activeBook.structureItems ?? [];
  const selectedPageActionId = selectedTrayPageId || activePageId;
  const canDeleteSelectedPage = activeView === "pages" && pages.some((page) => page.id === selectedPageActionId);
  const savedPagesPageCount = getPageCount(pages.length, savedPageScreenSize);
  const visibleSavedPages = pages.slice(
    savedPagesPageIndex * savedPageScreenSize,
    savedPagesPageIndex * savedPageScreenSize + savedPageScreenSize,
  );

  useEffect(() => {
    document.body.classList.add("editor-fullscreen-open");

    return () => {
      document.body.classList.remove("editor-fullscreen-open");
    };
  }, []);

  useEffect(() => {
    setSavedPagesPageIndex((current) => Math.min(current, savedPagesPageCount - 1));
  }, [savedPagesPageCount]);

  useEffect(() => {
    setSelectedStructureCardId(bookTitleCardId);
  }, [activeBook.id]);

  useEffect(() => {
    setSelectedStructureCardId((current) =>
      current === bookTitleCardId || structureItems.some((item) => item.id === current)
        ? current
        : bookTitleCardId,
    );
  }, [structureItems]);

  useEffect(() => {
    setMinimizedStructureItemIds((current) => {
      const nextIds = current.filter((id) => structureItems.some((item) => item.id === id));

      return nextIds.length === current.length ? current : nextIds;
    });
  }, [structureItems]);

  function getNextStructureTitle(kind: BookStructureKind, baseTitle: string) {
    if (kind !== "chapter" && kind !== "section") {
      return baseTitle;
    }

    const matchingCount = structureItems.filter((item) => item.kind === kind).length + 1;

    return `${baseTitle} ${matchingCount}`;
  }

  function closePopovers() {
    setStructureAddOpen(false);
  }

  function showStructureView() {
    closePopovers();
    setActiveView("structure");
  }

  function showPagesView() {
    closePopovers();
    setActiveView("pages");
  }

  function addStructureItem(kind: BookStructureKind, title: string) {
    onAddStructureItem(kind, getNextStructureTitle(kind, title));
    setActiveView("structure");
    setStructureAddOpen(false);
  }

  function toggleStructureAdd() {
    setActiveView("structure");
    setStructureAddOpen((current) => !current);
  }

  function toggleStructureItemMinimized(structureItemId: string) {
    setMinimizedStructureItemIds((current) =>
      current.includes(structureItemId)
        ? current.filter((id) => id !== structureItemId)
        : [...current, structureItemId],
    );
  }

  function handleSavedPageClick(pageId: string) {
    setSelectedTrayPageId((current) => (current === pageId ? "" : pageId));
    onSelectPage(pageId);
  }

  function openUploadPicker() {
    uploadInputRef.current?.click();
  }

  function handleUploadInputChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = "";
    if (files.length > 0) {
      onUploadPages(files);
      setActiveView("pages");
    }
  }

  function deleteSelectedPage() {
    if (!canDeleteSelectedPage) {
      return;
    }

    onDeletePage(selectedPageActionId);
    setSelectedTrayPageId("");
  }

  function placeSelectedPage(structureItemId: string) {
    if (!selectedTrayPageId) {
      return;
    }

    onPlacePage(selectedTrayPageId, structureItemId);
    setSelectedTrayPageId("");
  }

  function handleSavedPageDragStart(event: DragEvent<HTMLElement>, pageId: string) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(savedPageDragType, pageId);
    event.dataTransfer.setData("text/plain", pageId);
  }

  function handlePlacedPageDragStart(event: DragEvent<HTMLElement>, placedPageId: string) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(placedPageDragType, placedPageId);
    event.dataTransfer.setData("text/plain", placedPageId);
  }

  function handleDropToStructure(event: DragEvent<HTMLElement>, structureItemId: string, targetIndex: number) {
    event.preventDefault();
    setDragTargetId("");

    const savedPageId = event.dataTransfer.getData(savedPageDragType);
    const placedPageId = event.dataTransfer.getData(placedPageDragType);

    if (savedPageId) {
      onPlacePage(savedPageId, structureItemId);
      setSelectedTrayPageId("");
      return;
    }

    if (placedPageId) {
      onMovePlacedPageToLocation(placedPageId, structureItemId, targetIndex);
    }
  }

  function handleDropZoneDragOver(event: DragEvent<HTMLElement>, structureItemId: string) {
    event.preventDefault();
    event.dataTransfer.dropEffect = event.dataTransfer.types.includes(savedPageDragType) ? "copy" : "move";
    setDragTargetId(structureItemId);
  }

  function renderStructureAddMenu() {
    if (!structureAddOpen) {
      return null;
    }

    return (
      <div className="compile-add-popover" role="menu" aria-label="Structure options">
        <strong>Structure Options</strong>
        {structureQuickAdds.map((item) => (
          <button
            className="secondary-button compact-button"
            key={item.kind}
            type="button"
            role="menuitem"
            onClick={() => addStructureItem(item.kind, item.title)}
          >
            {item.label}
          </button>
        ))}
      </div>
    );
  }

  function renderPagesStage() {
    return (
      <div className="compile-pages-stage" aria-label="Saved pages">
        {visibleSavedPages.map((page) => {
          const selected = selectedTrayPageId === page.id;

          return (
            <button
              className={["compile-page-viewer-card", selected ? "selected" : "", activePageId === page.id ? "active-page" : ""]
                .filter(Boolean)
                .join(" ")}
              draggable
              key={page.id}
              type="button"
              aria-pressed={selected}
              onClick={() => handleSavedPageClick(page.id)}
              onDragStart={(event) => handleSavedPageDragStart(event, page.id)}
            >
              <span className="compile-page-viewer-image">
                <QuillPageImage page={page} />
              </span>
              <span className="compile-page-viewer-copy">
                <strong>{page.title}</strong>
              </span>
            </button>
          );
        })}
        {pages.length === 0 && (
          <article className="compile-map-empty">
            <strong>No saved pages</strong>
            <span>Save pages from Compose or make a meaningful edit to create entries.</span>
          </article>
        )}
      </div>
    );
  }

  function renderPlacedPageCard(entry: PlacedPageEntry) {
    return (
      <article
        className="compile-map-page-card"
        draggable
        key={entry.placedPage.id}
        onDragStart={(event) => handlePlacedPageDragStart(event, entry.placedPage.id)}
        onDragOver={(event) => handleDropZoneDragOver(event, entry.structureItem.id)}
        onDrop={(event) => handleDropToStructure(event, entry.structureItem.id, entry.placedIndex)}
      >
        <button className="compile-map-page-title" type="button" onClick={() => onSelectPage(entry.placedPage.pageId)}>
          <strong>{entry.placedPage.title}</strong>
          <span>{entry.page?.excerpt ?? "Saved page"}</span>
        </button>
        <div className="compile-map-page-actions">
          <button
            className="secondary-button compact-button"
            type="button"
            aria-label={`Move ${entry.placedPage.title} up`}
            onClick={() => onMovePlacedPage(entry.placedPage.id, -1)}
          >
            Up
          </button>
          <button
            className="secondary-button compact-button"
            type="button"
            aria-label={`Move ${entry.placedPage.title} down`}
            onClick={() => onMovePlacedPage(entry.placedPage.id, 1)}
          >
            Down
          </button>
          <button
            className="danger-button compact-button"
            type="button"
            aria-label={`Remove ${entry.placedPage.title}`}
            onClick={() => onRemovePlacedPage(entry.placedPage.id)}
          >
            Remove
          </button>
        </div>
      </article>
    );
  }

  function renderStructureSlot(item: BookStructureItem, visibleIndex: number) {
    const structureIndex = visibleIndex;
    const selectedPage = selectedTrayPageId ? pageById.get(selectedTrayPageId) : null;
    const isDragTarget = dragTargetId === item.id;
    const minimized = minimizedStructureItemIds.includes(item.id);
    const selected = selectedStructureCardId === item.id;

    return (
      <article
        className={["compile-map-slot", selected ? "selected" : "", minimized ? "minimized" : "", isDragTarget ? "drop-target" : ""]
          .filter(Boolean)
          .join(" ")}
        key={item.id}
        onClick={() => setSelectedStructureCardId(item.id)}
        onDragOver={(event) => handleDropZoneDragOver(event, item.id)}
        onDragLeave={() => setDragTargetId((current) => (current === item.id ? "" : current))}
        onDrop={(event) => handleDropToStructure(event, item.id, item.placedPages.length)}
      >
        <div className="compile-map-slot-heading">
          <button
            className="secondary-button compact-button compile-map-slot-minimize"
            type="button"
            aria-expanded={!minimized}
            aria-label={`${minimized ? "Expand" : "Minimize"} ${item.title}`}
            onClick={() => toggleStructureItemMinimized(item.id)}
          >
            {minimized ? <ChevronRight aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
          </button>
          <div className="compile-map-slot-title">
            <input
              aria-label={`${getStructureKindLabel(item.kind)} title`}
              value={item.title}
              onFocus={() => setSelectedStructureCardId(item.id)}
              onChange={(event) => onRenameStructureItem(item.id, event.target.value)}
            />
          </div>
          <button
            className="danger-button compact-button"
            type="button"
            onClick={() => onRemoveStructureItem(item.id)}
          >
            Remove
          </button>
        </div>

        {!minimized ? (
          <>
            <div className="compile-map-pages">
              {item.placedPages.slice(0, 3).map((placedPage, placedIndex) =>
                renderPlacedPageCard({
                  page: pageById.get(placedPage.pageId) ?? null,
                  placedPage,
                  placedIndex,
                  structureIndex,
                  structureItem: item,
                }),
              )}
              {item.placedPages.length > 3 && <p className="compile-map-overflow">+ {item.placedPages.length - 3} more in this location</p>}
              {item.placedPages.length === 0 && <p className="compile-empty">No pages placed here.</p>}
            </div>

            {selectedTrayPageId ? (
              <button
                className="compile-drop-zone"
                type="button"
                onClick={() => placeSelectedPage(item.id)}
              >
                {selectedPage ? `Place ${selectedPage.title}` : "Place selected page"}
              </button>
            ) : null}
          </>
        ) : null}
      </article>
    );
  }

  function renderStructureMap() {
    return (
      <div className="compile-map-stage" aria-label="Book map">
        <div className="compile-map">
          <label
            className={["compile-book-name-row", selectedStructureCardId === bookTitleCardId ? "selected" : ""]
              .filter(Boolean)
              .join(" ")}
            onClick={() => setSelectedStructureCardId(bookTitleCardId)}
          >
            <span>Book Title</span>
            <input
              aria-label="Book name"
              placeholder="Book name"
              value={activeBook.title}
              onFocus={() => setSelectedStructureCardId(bookTitleCardId)}
              onChange={(event) => onRenameBook(event.target.value)}
            />
          </label>
          {structureItems.map((item, index) => renderStructureSlot(item, index))}
          {structureItems.length === 0 && (
            <article className="compile-map-empty">
              <strong>No structure yet</strong>
              <span>Use Add to create a cover, intro, or chapter.</span>
            </article>
          )}
        </div>
      </div>
    );
  }

  function renderActionRow() {
    if (activeView === "pages") {
      return (
        <div className="compile-action-row" aria-label="Saved pages paging">
          <button
            className="secondary-button compact-button compile-action-button"
            type="button"
            disabled={savedPagesPageIndex <= 0}
            onClick={() => setSavedPagesPageIndex((current) => Math.max(0, current - 1))}
          >
            Previous
          </button>
          <span className="compile-action-chip">
            {getPageRangeLabel(pages.length, savedPagesPageIndex, savedPageScreenSize, "No pages")}
          </span>
          <button
            className="secondary-button compact-button compile-action-button"
            type="button"
            disabled={savedPagesPageIndex >= savedPagesPageCount - 1}
            onClick={() => setSavedPagesPageIndex((current) => Math.min(savedPagesPageCount - 1, current + 1))}
          >
            Next
          </button>
        </div>
      );
    }

    return null;
  }

  function renderBottomControls() {
    if (activeView === "pages") {
      return (
        <div className="phone-image-category-row compile-fullscreen-category-row compile-map-controls pages" aria-label="Compile page tools">
          <input
            ref={uploadInputRef}
            className="compile-upload-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleUploadInputChange}
          />
          <div className="compile-add-wrap">
            {renderStructureAddMenu()}
            <button
              className={["secondary-button compact-button compile-fullscreen-tab", structureAddOpen ? "active-tool" : ""]
                .filter(Boolean)
                .join(" ")}
              type="button"
              aria-expanded={structureAddOpen}
              onClick={toggleStructureAdd}
            >
              Add
            </button>
          </div>
          <button
            className="secondary-button compact-button compile-fullscreen-tab"
            type="button"
            aria-pressed={false}
            onClick={showStructureView}
          >
            Structure
          </button>
          <button
            className="secondary-button compact-button compile-fullscreen-tab active-tool"
            type="button"
            aria-pressed
            onClick={showPagesView}
          >
            Pages
          </button>
          <button className="secondary-button compact-button compile-fullscreen-tab" type="button" onClick={openUploadPicker}>
            Upload
          </button>
          <button
            className="danger-button compact-button compile-fullscreen-tab"
            type="button"
            disabled={!canDeleteSelectedPage}
            onClick={deleteSelectedPage}
          >
            Delete
          </button>
        </div>
      );
    }

    return (
      <div className="phone-image-category-row compile-fullscreen-category-row compile-map-controls" aria-label="Compile tools">
        <div className="compile-add-wrap">
          {renderStructureAddMenu()}
          <button
            className={["secondary-button compact-button compile-fullscreen-tab", structureAddOpen ? "active-tool" : ""]
              .filter(Boolean)
              .join(" ")}
            type="button"
            aria-expanded={structureAddOpen}
            onClick={toggleStructureAdd}
          >
            Add
          </button>
        </div>
        <button
          className="secondary-button compact-button compile-fullscreen-tab active-tool"
          type="button"
          aria-pressed={true}
          onClick={showStructureView}
        >
          Structure
        </button>
        <button
          className="secondary-button compact-button compile-fullscreen-tab"
          type="button"
          aria-pressed={false}
          onClick={showPagesView}
        >
          Pages
        </button>
      </div>
    );
  }

  const actionRow = renderActionRow();

  return (
    <section className={["studio-panel phone-image-fullscreen compile-fullscreen", actionRow ? "" : "compact-bottom"].filter(Boolean).join(" ")} aria-label="Book builder">
      <div className="panel-heading phone-image-fullscreen-heading compile-map-heading">
        <button
          className="secondary-button compact-button phone-image-home-button"
          type="button"
          aria-label="Open menu"
          title="Menu"
          onClick={onOpenAppMenu}
        >
          <Menu aria-hidden="true" />
        </button>
        <div className="compile-book-heading-fields">
          <select value={activeBook.id} onChange={(event) => onSelectBook(event.target.value)} aria-label="Active book">
            {books.map((book) => (
              <option key={book.id} value={book.id}>
                {book.title}
              </option>
            ))}
          </select>
          <button className="secondary-button compact-button compile-new-book-button" type="button" onClick={onCreateBook}>
            <Plus aria-hidden="true" size={16} />
            <span>New</span>
          </button>
        </div>
        <div className="phone-image-header-actions compile-fullscreen-count" aria-label="Book status">
          <span className="preview-summary-pill">{activeBook.placedPages.length} placed</span>
        </div>
      </div>

      <div className="phone-image-fullscreen-surface compile-fullscreen-surface">
        {activeView === "pages" ? renderPagesStage() : renderStructureMap()}
      </div>

      <div className={["phone-image-fullscreen-bottom-bar phone-image-edit-panel compile-fullscreen-bottom-bar", actionRow ? "" : "compact"].filter(Boolean).join(" ")}>
        {actionRow ? (
          <div className="phone-image-action-panel compile-fullscreen-action-panel">
            {actionRow}
          </div>
        ) : null}
        {renderBottomControls()}
      </div>
    </section>
  );
}
