import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import type { BookCompilation, CompiledPage } from "../storage/quillWorkspaceStorage";
import { QuillPageImage } from "./QuillPageImage";

type LibraryViewMode = "books" | "preview";

type QuillLibraryViewProps = {
  activeBook: BookCompilation;
  activePageId: string;
  books: BookCompilation[];
  pages: CompiledPage[];
  onOpenAppMenu: () => void;
  onOpenBook: (bookId: string) => void;
  onOpenPage: (pageId: string) => void;
};

export function QuillLibraryView({
  activeBook,
  activePageId,
  books,
  pages,
  onOpenAppMenu,
  onOpenBook,
  onOpenPage,
}: QuillLibraryViewProps) {
  const [activeView, setActiveView] = useState<LibraryViewMode>("books");
  const pageById = useMemo(() => new Map(pages.map((page) => [page.id, page])), [pages]);
  const activeBookPages = useMemo(
    () => activeBook.placedPages.map((placedPage) => pageById.get(placedPage.pageId)).filter(isCompiledPage),
    [activeBook.placedPages, pageById],
  );
  const selectedBookPageIndex = activeBookPages.findIndex((page) => page.id === activePageId);
  const selectedPage = activeBookPages[selectedBookPageIndex] ?? activeBookPages[0] ?? pageById.get(activePageId) ?? null;
  const hasBookPages = activeBookPages.length > 0;

  useEffect(() => {
    document.body.classList.add("library-fullscreen-open");

    return () => {
      document.body.classList.remove("library-fullscreen-open");
    };
  }, []);

  function renderBooksView() {
    return (
      <div className="compile-page-list quill-library-scroll-list quill-library-books-list">
        {books.map((book) => (
          <button
            className={book.id === activeBook.id ? "library-item-row selected" : "library-item-row"}
            key={book.id}
            type="button"
            onClick={() => onOpenBook(book.id)}
          >
            <BookOpen aria-hidden="true" size={18} />
            <span>
              <strong>{book.title}</strong>
              <small>
                {formatCount(book.placedPages.length, "page")} placed in {formatCount(book.structureItems.length, "section")}
              </small>
            </span>
          </button>
        ))}
        {books.length === 0 && <p className="compile-empty">No books yet.</p>}
      </div>
    );
  }

  function renderPreviewView() {
    return (
      <div className="quill-library-viewer quill-library-preview-stage">
        <QuillPageImage page={selectedPage} />
        <div>
          <strong>{selectedPage?.title ?? "No saved page selected"}</strong>
          <span>{selectedPage?.excerpt ?? "Save from Compose to add pages here."}</span>
        </div>
      </div>
    );
  }

  function openBookPageAt(index: number) {
    if (activeBookPages.length === 0) {
      return;
    }

    const wrappedIndex = (index + activeBookPages.length) % activeBookPages.length;
    onOpenPage(activeBookPages[wrappedIndex].id);
    setActiveView("preview");
  }

  function openPreviousBookPage() {
    openBookPageAt(selectedBookPageIndex >= 0 ? selectedBookPageIndex - 1 : activeBookPages.length - 1);
  }

  function openNextBookPage() {
    openBookPageAt(selectedBookPageIndex >= 0 ? selectedBookPageIndex + 1 : 0);
  }

  function renderBottomControls() {
    return (
      <div className="phone-image-fullscreen-options quill-library-tabs">
        <button
          className={["secondary-button compact-button compile-fullscreen-tab", activeView === "books" ? "active-tool" : ""]
            .filter(Boolean)
            .join(" ")}
          type="button"
          aria-pressed={activeView === "books"}
          onClick={() => setActiveView("books")}
        >
          Books
        </button>
        <button
          className="secondary-button compact-button compile-fullscreen-tab quill-library-page-nav-button"
          type="button"
          aria-label="Previous page"
          title="Previous page"
          disabled={!hasBookPages}
          onClick={openPreviousBookPage}
        >
          <ChevronLeft aria-hidden="true" size={16} />
          <span>Previous Page</span>
        </button>
        <button
          className="secondary-button compact-button compile-fullscreen-tab quill-library-page-nav-button"
          type="button"
          aria-label="Next page"
          title="Next page"
          disabled={!hasBookPages}
          onClick={openNextBookPage}
        >
          <span>Next Page</span>
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
    );
  }

  return (
    <section className="studio-panel phone-image-fullscreen quill-library-fullscreen" aria-label="Library">
      <div className="panel-heading phone-image-fullscreen-heading quill-library-heading">
        <button
          className="secondary-button compact-button phone-image-home-button"
          type="button"
          aria-label="Open menu"
          title="Menu"
          onClick={onOpenAppMenu}
        >
          <Menu aria-hidden="true" />
        </button>
        <div className="phone-image-active-settings">Book Library</div>
        <div className="phone-image-header-actions quill-library-heading-count" aria-label="Library status">
          <span className="preview-summary-pill">{formatCount(books.length, "book")}</span>
        </div>
      </div>

      <div className={`phone-image-fullscreen-surface quill-library-fullscreen-surface view-${activeView}`}>
        {activeView === "books" ? renderBooksView() : renderPreviewView()}
      </div>

      <div className="phone-image-fullscreen-bottom-bar phone-image-edit-panel quill-library-bottom-bar">
        <div className="phone-image-action-panel quill-library-status-panel">
          <div className="quill-library-bottom-summary">
            <strong>{activeView === "books" ? activeBook.title : selectedPage?.title ?? "No page selected"}</strong>
            <span>{formatCount(books.length, "book")} / {formatCount(pages.length, "page")}</span>
          </div>
        </div>
        {renderBottomControls()}
      </div>
    </section>
  );
}

function formatCount(count: number, label: string): string {
  return `${count} ${label}${count === 1 ? "" : "s"}`;
}

function isCompiledPage(page: CompiledPage | undefined): page is CompiledPage {
  return Boolean(page);
}
