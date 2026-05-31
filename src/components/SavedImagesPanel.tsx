import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import type { SavedImage } from "../types/fontTypes";

type SavedImagesPanelProps = {
  images: SavedImage[];
  onClose: () => void;
  onDeleteImage: (imageId: string) => void;
};

function dataUrlToFile(dataUrl: string, fileName: string) {
  const [header, base64Data] = dataUrl.split(",");
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch?.[1] ?? "image/png";
  const binary = window.atob(base64Data);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], fileName, { type: mimeType });
}

function getSavedImageFileName(image: SavedImage) {
  return `${image.fontName.trim().replace(/[^a-z0-9]+/gi, "-") || "font-studio"}-${image.id}.png`;
}

function downloadSavedImage(image: SavedImage) {
  const link = document.createElement("a");
  link.href = image.imageDataUrl;
  link.download = getSavedImageFileName(image);
  link.click();
}

function formatSavedDate(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

export default function SavedImagesPanel({ images, onClose, onDeleteImage }: SavedImagesPanelProps) {
  const [status, setStatus] = useState("");

  async function shareNativeSavedImage(image: SavedImage) {
    const base64Data = image.imageDataUrl.split(",")[1];

    if (!base64Data) {
      setStatus("Could not make this image yet.");
      return false;
    }

    const canShare = await Share.canShare().catch(() => ({ value: false }));

    if (!canShare.value) {
      return false;
    }

    const writeResult = await Filesystem.writeFile({
      data: base64Data,
      directory: Directory.Cache,
      path: `share/${Date.now()}-${getSavedImageFileName(image)}`,
      recursive: true,
    });

    await Share.share({
      dialogTitle: "Share image",
      files: [writeResult.uri],
      text: image.message,
      title: image.fontName,
    });

    setStatus("Share opened.");
    return true;
  }

  async function shareSavedImage(image: SavedImage) {
    if (Capacitor.isNativePlatform()) {
      try {
        if (await shareNativeSavedImage(image)) {
          return;
        }
      } catch {
        setStatus("Android sharing did not work. Try Save PNG.");
        return;
      }
    }

    const file = dataUrlToFile(image.imageDataUrl, getSavedImageFileName(image));
    const shareData: ShareData & { files?: File[] } = {
      files: [file],
      text: image.message,
      title: image.fontName,
    };

    try {
      if (navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        setStatus("Share opened.");
        return;
      }

      if (navigator.share) {
        await navigator.share({
          text: image.message,
          title: image.fontName,
        });
        setStatus("Shared the message text.");
        return;
      }

      downloadSavedImage(image);
      setStatus("Sharing is not supported here, so I saved the PNG.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("Share canceled.");
        return;
      }

      setStatus("Sharing did not work here.");
    }
  }

  return (
    <section className="studio-panel saved-images-fullscreen" aria-label="Saved images">
      <div className="panel-heading saved-images-heading">
        <div>
          <p className="eyebrow">Gallery</p>
          <h2>Saved Images</h2>
        </div>
        <button className="secondary-button compact-button" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="saved-images-status" aria-live="polite">
        {status}
      </div>

      <div className="saved-images-list">
        {images.length === 0 ? (
          <div className="saved-images-empty">
            <h3>No saved images yet</h3>
            <p>Use Save PNG on the home screen to keep a message here.</p>
          </div>
        ) : (
          images.map((image) => (
            <article className="saved-image-card" key={image.id}>
              <img src={image.imageDataUrl} alt="" className="saved-image-preview" />
              <div className="saved-image-info">
                <p className="saved-image-message">{image.message}</p>
                <span>
                  {image.fontName} - {formatSavedDate(image.createdAt)}
                </span>
              </div>
              <div className="saved-image-actions">
                <button className="primary-button compact-button" type="button" onClick={() => shareSavedImage(image)}>
                  Share
                </button>
                <button className="secondary-button compact-button" type="button" onClick={() => downloadSavedImage(image)}>
                  Save PNG
                </button>
                <button className="danger-button compact-button" type="button" onClick={() => onDeleteImage(image.id)}>
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
