import { useEffect, useState } from "react";
import { getCompiledPageImageBlob, type CompiledPage } from "../storage/quillWorkspaceStorage";

type QuillPageImageProps = {
  className?: string;
  page: CompiledPage | null;
};

export function QuillPageImage({ className = "", page }: QuillPageImageProps) {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    let canceled = false;
    let objectUrl = "";

    setImageUrl("");

    if (!page) {
      return () => undefined;
    }

    getCompiledPageImageBlob(page.id)
      .then((blob) => {
        if (!blob || canceled) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      })
      .catch(() => {
        if (!canceled) {
          setImageUrl("");
        }
      });

    return () => {
      canceled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [page]);

  if (!page) {
    return (
      <div className={`quill-page-empty ${className}`}>
        <strong>No page selected</strong>
        <span>Save a page from Compose, then select it here.</span>
      </div>
    );
  }

  if (imageUrl) {
    return (
      <img
        className={`quill-page-image ${className}`}
        src={imageUrl}
        alt={page.title}
      />
    );
  }

  return (
    <div className={`quill-page-text-fallback ${className}`}>
      <strong>{page.title}</strong>
      <p>{page.textContent || page.excerpt}</p>
    </div>
  );
}
