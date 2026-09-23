import { useEffect, useRef, useState } from 'react';
import { Palette } from 'lucide-react';
import { Board } from '../lib/types';
import { fetchBoardContent } from '../lib/boardQueries';
import { renderBoardThumbnail } from '../lib/thumbnail';

interface BoardThumbnailProps {
  board: Board;
  isDark: boolean;
  /** Called once a missing preview was generated, so it can be stored */
  onThumbnailGenerated?: (boardId: string, thumbnail: string) => void;
}

type Preview =
  | { kind: 'pending' }
  | { kind: 'empty' }
  | { kind: 'image'; src: string }
  | { kind: 'svg' }
  | { kind: 'failed' };

/**
 * Shows the stored board preview. Boards without one (older boards, or new ones not
 * saved yet) get it generated once the card scrolls into view, loading the scene
 * only when the dashboard fetched a summary.
 */
export function BoardThumbnail({ board, isDark, onThumbnailGenerated }: BoardThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [generated, setGenerated] = useState<Preview>({ kind: 'pending' });
  const onGeneratedRef = useRef(onThumbnailGenerated);
  onGeneratedRef.current = onThumbnailGenerated;

  const stored = board.thumbnail;
  const preview: Preview =
    typeof stored === 'string'
      ? stored
        ? { kind: 'image', src: stored }
        : { kind: 'empty' }
      : generated;

  useEffect(() => {
    const node = containerRef.current;
    if (!node || isVisible) return;
    if (typeof IntersectionObserver === 'undefined') {
      setIsVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [isVisible]);

  // Generate a preview only when none is stored
  useEffect(() => {
    if (!isVisible || typeof stored === 'string') return;
    let cancelled = false;

    (async () => {
      const content =
        board.contentLoaded === false
          ? await fetchBoardContent(board.id)
          : { elements: board.elements, files: board.files };
      if (cancelled) return;
      if (!content) {
        setGenerated({ kind: 'failed' });
        return;
      }

      const elements = (content.elements || []).filter((el: any) => !el.isDeleted);
      const thumbnail = await renderBoardThumbnail(elements, content.files);
      if (cancelled) return;

      if (thumbnail !== null) {
        setGenerated(thumbnail ? { kind: 'image', src: thumbnail } : { kind: 'empty' });
        onGeneratedRef.current?.(board.id, thumbnail);
        return;
      }

      // Raster export failed (e.g. cross-origin image): fall back to a vector preview
      try {
        const { exportToSvg } = await import('@excalidraw/excalidraw');
        const svg = await exportToSvg({
          elements: elements as any,
          appState: { exportBackground: false, exportWithDarkMode: false, exportPadding: 16 } as any,
          files: (content.files || {}) as any,
        });
        if (cancelled || !svgRef.current) return;
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('aria-hidden', 'true');
        svgRef.current.replaceChildren(svg);
        setGenerated({ kind: 'svg' });
      } catch {
        if (!cancelled) setGenerated({ kind: 'failed' });
      }
    })();

    return () => {
      cancelled = true;
    };
    // Regenerate only when the board content changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, stored, board.id, board.updated_at, board.contentLoaded]);

  // Previews are rendered in light mode; dark mode uses the same filter as Excalidraw's canvas
  const darkFilter = isDark ? 'invert(93%) hue-rotate(180deg)' : undefined;

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {preview.kind === 'image' && (
        <img
          src={preview.src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-contain p-2"
          style={{ filter: darkFilter }}
        />
      )}
      <div
        ref={svgRef}
        className={preview.kind === 'svg' ? 'absolute inset-0 p-2' : 'absolute inset-0 opacity-0'}
        style={{ filter: darkFilter }}
      />
      {preview.kind !== 'image' && preview.kind !== 'svg' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
          <Palette className="w-8 h-8 group-hover:text-brand-500 transition-colors" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {preview.kind === 'empty'
              ? 'Quadro vazio'
              : preview.kind === 'failed'
                ? 'Prévia indisponível'
                : 'Gerando prévia…'}
          </span>
        </div>
      )}
    </div>
  );
}
