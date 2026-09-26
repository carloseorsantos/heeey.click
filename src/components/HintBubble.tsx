import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { spring } from '../lib/motion';
import { Button } from './ui/Button';

interface HintBubbleProps {
  visible: boolean;
  /** CSS selector of the control the bubble points at */
  anchor: string;
  icon?: React.ReactNode;
  title: string;
  text: string;
  actionLabel: string;
  dismissLabel: string;
  onAction: () => void;
  /** X, or Esc from inside the bubble: the person closed the hint */
  onDismiss: () => void;
  /** Esc anywhere else: just out of the way for now */
  onClose: () => void;
}

type Placement = 'right' | 'below' | 'above';

interface Position {
  placement: Placement;
  style: React.CSSProperties;
  /** Arrow offset along the bubble's edge, in px */
  arrow: number;
}

const GAP = 12;
const MARGIN = 8;
const MAX_WIDTH = 288;

/**
 * Above the anchor when it sits in the lower half (the phone toolbar), next to it when there is
 * room (desktop), under it otherwise
 */
function computePosition(rect: DOMRect): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(MAX_WIDTH, vw - MARGIN * 2);
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const left = Math.min(Math.max(MARGIN, centerX - 32), vw - MARGIN - width);
  if (centerY > vh / 2) {
    return { placement: 'above', style: { left, bottom: vh - rect.top + GAP, width }, arrow: centerX - left };
  }
  if (rect.right + GAP + width <= vw - MARGIN) {
    const top = Math.max(MARGIN, rect.top - 6);
    return { placement: 'right', style: { left: rect.right + GAP, top, width }, arrow: centerY - top };
  }
  return { placement: 'below', style: { left, top: rect.bottom + GAP, width }, arrow: centerX - left };
}

// Triangle drawn outside the bubble, so the translucent material does not stack over itself
const ARROW: Record<Placement, { className: string; points: string; size: [number, number] }> = {
  right: { className: '-left-[7px] -translate-y-1/2', points: '8,0 0,7 8,14', size: [8, 14] },
  below: { className: '-top-[7px] -translate-x-1/2', points: '0,8 7,0 14,8', size: [14, 8] },
  above: { className: '-bottom-[7px] -translate-x-1/2', points: '0,0 7,8 14,0', size: [14, 8] },
};

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

/**
 * A small hint pointing at a control. It never takes focus; screen readers hear its text through
 * a live region that stays mounted, so the announcement is not lost when the bubble appears.
 */
export function HintBubble({ visible, anchor, icon, title, text, actionLabel, dismissLabel, onAction, onDismiss, onClose }: HintBubbleProps) {
  const [position, setPosition] = useState<Position | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const shown = visible && !!position;

  useLayoutEffect(() => {
    if (!visible) return;
    // Looked up on every update: Excalidraw mounts a different button when it switches to the phone layout
    const update = () => {
      const target = document.querySelector(anchor);
      setPosition(target?.isConnected ? computePosition(target.getBoundingClientRect()) : null);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [visible, anchor]);

  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (bubbleRef.current?.contains(document.activeElement)) return onDismiss();
      // Esc meant for something else (text editing, a rename field, a selection) only moves the hint away
      if (!e.defaultPrevented && !isEditable(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [shown, onDismiss, onClose]);

  const offset = position?.placement === 'right' ? { x: -6, y: 0 } : { x: 0, y: position?.placement === 'above' ? 6 : -6 };
  const arrow = position && ARROW[position.placement];

  return (
    <>
      <div role="status" className="sr-only">
        {shown ? `${title}. ${text}` : ''}
      </div>
      <AnimatePresence>
        {shown && position && arrow && (
          <motion.div
            key="hint"
            ref={bubbleRef}
            role="group"
            aria-label={title}
            initial={{ opacity: 0, scale: 0.96, ...offset }}
            animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={spring.snappy}
            style={position.style}
            className="fixed z-30 p-3 rounded-2xl material-regular shadow-popover"
          >
            <svg
              aria-hidden="true"
              width={arrow.size[0]}
              height={arrow.size[1]}
              className={`absolute ${arrow.className}`}
              style={position.placement === 'right' ? { top: position.arrow } : { left: position.arrow }}
            >
              <polygon points={arrow.points} fill="var(--material-regular)" />
            </svg>
            <div className="relative flex items-start gap-2.5">
              {icon && <div className="mt-0.5 text-accent-text flex-shrink-0">{icon}</div>}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-label pt-0.5">{title}</p>
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="pressable -mt-0.5 -mr-0.5 w-7 h-7 flex items-center justify-center rounded-full bg-fill text-label-2 hover:text-label flex-shrink-0"
                    aria-label={dismissLabel}
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2.5} />
                  </button>
                </div>
                <p className="text-callout text-label-2 mt-0.5">{text}</p>
                <Button variant="primary" size="sm" className="mt-2.5" onClick={onAction}>
                  {actionLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
