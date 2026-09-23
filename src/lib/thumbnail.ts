/**
 * Small raster previews stored in boards.thumbnail so the dashboard does not
 * need to download whole scenes. '' means "known empty board"; null (column
 * default) means no preview was generated yet.
 */

export const THUMBNAIL_MAX_SIZE = 480;
/** Minimum time between thumbnail renders while someone is drawing */
export const THUMBNAIL_INTERVAL_MS = 20_000;

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/**
 * Renders a light-theme WebP preview (transparent background, dark mode is applied
 * with a CSS filter on the dashboard). Returns '' for empty boards and null when
 * rendering fails (e.g. a cross-origin image taints the canvas).
 */
export async function renderBoardThumbnail(
  elements: readonly any[],
  files: Record<string, any> | null | undefined
): Promise<string | null> {
  const live = elements.filter((el) => el && !el.isDeleted);
  if (live.length === 0) return '';

  try {
    // Loaded on demand so the dashboard bundle does not include Excalidraw
    const { exportToBlob } = await import('@excalidraw/excalidraw');
    const blob = await exportToBlob({
      elements: live,
      appState: { exportBackground: false, exportWithDarkMode: false } as any,
      files: (files || {}) as any,
      mimeType: 'image/webp',
      quality: 0.7,
      maxWidthOrHeight: THUMBNAIL_MAX_SIZE,
      exportPadding: 16,
    });
    return await blobToDataURL(blob);
  } catch (e) {
    console.warn('Não foi possível gerar a miniatura do quadro:', e);
    return null;
  }
}
