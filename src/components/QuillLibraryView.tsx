import { useEffect, useMemo, useState } from "react";
import { BookOpen, Files, Menu } from "lucide-react";
import type { BookCompilation, CompiledPage } from "../storage/quillWorkspaceStorage";
import { QuillPageImage } from "./QuillPageImage";

type LibraryViewMode = "pages" | "books" | "preview";

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
  const [activeView, setActiveView] = useState<LibraryViewMode>("pages");
  const selectedPage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0] ?? null,
    [activePageId, pages],
  );

  useEffect(() => {
    document.body.classList.add("library-fullscreen-open");

    return () => {
      document.body.classList.remove("library-fullscreen-open");
    };
  }, []);

  function renderPagesView() {
    return (
      <div className="quill-library-screen-list">
        <div className="compile-drawer-heading">
          <strong>Pages</strong>
          <span>{pages.length}</span>
        </div>
        <div className="compile-page-list quill-library-scroll-list">
          {pages.map((page) => (
            <button
              className={page.id === activePageId ? "library-item-row selected" : "library-item-row"}
              key={page.id}
              type="button"
              onClick={() => onOpenPage(page.id)}
            >
              <Files aria-hidden="true" size={18} />
              <span>
                <strong>{page.title}</strong>
                <small>{page.excerpt}</small>
              </span>
            </button>
          ))}
          {pages.length === 0 && <p className="compile-empty">No saved pages yet.</p>}
        </div>
      </div>
    );
  }

  function renderBooksView() {
    return (
      <div className="quill-library-screen-list">
        <div className="compile-drawer-heading">
          <strong>Books</strong>
          <span>{books.length}</span>
        </div>
        <div className="compile-page-list quill-library-scroll-list">
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
                <small>{book.placedPages.length} placed pages</small>
              </span>
            </button>
          ))}
        </div>
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

  function renderBottomControls() {
    return (
      <div className="phone-image-fullscreen-options quill-library-tabs">
        <button
          className={["secondary-button compact-button compile-fullscreen-tab", activeView === "pages" ? "active-tool" : ""]
            .filter(Boolean)
            .join(" ")}
          type="button"
          aria-pressed={activeView === "pages"}
          onClick={() => setActiveView("pages")}
        >
          Pages
        </button>
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
          className={["secondary-button compact-button compile-fullscreen-tab", activeView === "preview" ? "active-tool" : ""]
            .filter(Boolean)
            .join(" ")}
          type="button"
          aria-pressed={activeView === "preview"}
          onClick={() => setActiveView("preview")}
        >
          Preview
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
        <div className="phone-image-active-settings">Library</div>
        <div className="phone-image-header-actions quill-library-heading-count" aria-label="Library status">
          <span className="preview-summary-pill">{pages.length} pages</span>
        </div>
      </div>

      <div className="phone-image-fullscreen-surface quill-library-fullscreen-surface">
        {activeView === "books" ? renderBooksView() : activeView === "preview" ? renderPreviewView() : renderPagesView()}
      </div>

      <div className="phone-image-fullscreen-bottom-bar phone-image-edit-panel quill-library-bottom-bar">
        <div className="phone-image-action-panel quill-library-status-panel">
          <div className="quill-library-bottom-summary">
            <strong>{activeView === "books" ? activeBook.title : selectedPage?.title ?? "No page selected"}</strong>
            <span>{pages.length} pages / {books.length} books</span>
          </div>
        </div>
        {renderBottomControls()}
      </div>
    </section>
  );
}
