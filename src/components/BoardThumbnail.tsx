import { useEffect, useRef, useState } from 'react';
import { exportToSvg } from '@excalidraw/excalidraw';
import { Palette } from 'lucide-react';
import { Board } from '../lib/types';

interface BoardThumbnailProps {
  board: Board;
  isDark: boolean;
}

/**
 * Lazily renders a vector preview of the board once the card scrolls into view.
 * Falls back to a neutral placeholder for empty boards or render failures.
 */
export function BoardThumbnail({ board, isDark }: BoardThumbnailProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ready' | 'failed'>('idle');

  const elements = Array.isArray(board.elements)
    ? board.elements.filter((el: any) => !el.isDeleted)
    : [];
  const hasContent = elements.length > 0;

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

  useEffect(() => {
    const node = containerRef.current;
    if (!node || !isVisible || !hasContent) return;

    let cancelled = false;
    exportToSvg({
      elements: elements as any,
      appState: {
        exportBackground: false,
        exportWithDarkMode: isDark,
        exportPadding: 16,
      } as any,
      files: (board.files || {}) as any,
    })
      .then((svg: SVGSVGElement) => {
        if (cancelled || !node) return;
        svg.setAttribute('width', '100%');
        svg.setAttribute('height', '100%');
        svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        svg.setAttribute('aria-hidden', 'true');
        node.replaceChildren(svg);
        setStatus('ready');
      })
      .catch(() => {
        if (!cancelled) setStatus('failed');
      });

    return () => {
      cancelled = true;
    };
    // Re-render only when the board content or theme actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible, hasContent, board.updated_at, board.id, isDark]);

  const showPlaceholder = !hasContent || status !== 'ready';

  return (
    <div className="relative w-full h-full">
      <div
        ref={containerRef}
        className={showPlaceholder ? 'absolute inset-0 opacity-0' : 'absolute inset-0 p-2'}
      />
      {showPlaceholder && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400 dark:text-slate-500">
          <Palette className="w-8 h-8 group-hover:text-brand-500 transition-colors" />
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {hasContent ? 'Gerando prévia…' : 'Quadro vazio'}
          </span>
        </div>
      )}
    </div>
  );
}
