export function exportWaxSealPNG(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/png");
  });
}

export function getWaxSealPNGDataUrl(canvas: HTMLCanvasElement) {
  return canvas.toDataURL("image/png");
}

