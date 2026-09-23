import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { spring } from '../../lib/motion';

interface MenuProps {
  open: boolean;
  /** Which edge of the trigger the menu hangs from */
  side?: 'top' | 'bottom';
  /** Which side of the trigger the menu lines up with */
  align?: 'start' | 'end';
  className?: string;
  children: React.ReactNode;
  'aria-label'?: string;
}

const ITEM_SELECTOR = '[role="menuitem"]:not([disabled])';
const GAP = 6;
const MARGIN = 8;

/** Visible area for an element: the viewport, narrowed by every ancestor that clips overflow */
function clipBounds(element: HTMLElement) {
  let top = 0;
  let left = 0;
  let right = window.innerWidth;
  let bottom = window.innerHeight;
  for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
    const rect = node.getBoundingClientRect();
    top = Math.max(top, rect.top);
    left = Math.max(left, rect.left);
    right = Math.min(right, rect.right);
    bottom = Math.min(bottom, rect.bottom);
  }
  return { top, left, right, bottom };
}

/**
 * Popover menu that grows out of its trigger (transform-origin on the trigger corner).
 * Place it inside a `relative` wrapper next to the trigger button.
 */
export function Menu({ open, side = 'bottom', align = 'end', className, children, ...aria }: MenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const [placement, setPlacement] = useState({ side, align });

  // Flip to the side with room before the first paint, like a native popover
  useLayoutEffect(() => {
    if (!open) return;
    const menu = ref.current;
    const anchor = menu?.offsetParent as HTMLElement | null;
    if (!menu || !anchor) return;
    const a = anchor.getBoundingClientRect();
    const bounds = clipBounds(anchor);
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;

    let nextAlign = align;
    if (align === 'end' && a.right - width < bounds.left + MARGIN) nextAlign = 'start';
    else if (align === 'start' && a.left + width > bounds.right - MARGIN) nextAlign = 'end';

    let nextSide = side;
    const fitsBelow = a.bottom + GAP + height <= bounds.bottom - MARGIN;
    const fitsAbove = a.top - GAP - height >= bounds.top + MARGIN;
    if (side === 'bottom' && !fitsBelow && fitsAbove) nextSide = 'top';
    else if (side === 'top' && !fitsAbove && fitsBelow) nextSide = 'bottom';

    setPlacement({ side: nextSide, align: nextAlign });
  }, [open, side, align]);

  // Take focus for arrow-key navigation, and hand it back to the trigger on close
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const menu = ref.current;
    menu?.focus({ preventScroll: true });
    return () => {
      const active = document.activeElement;
      if (!active || active === document.body || menu?.contains(active)) {
        trigger?.focus?.({ preventScroll: true });
      }
    };
  }, [open]);

  function handleKeyDown(e: React.KeyboardEvent) {
    const items = Array.from(ref.current?.querySelectorAll<HTMLElement>(ITEM_SELECTOR) ?? []);
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === 'ArrowDown') next = index < 0 ? 0 : (index + 1) % items.length;
    else if (e.key === 'ArrowUp') next = index <= 0 ? items.length - 1 : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    items[next].focus();
  }

  const origin = `${placement.side === 'bottom' ? 'top' : 'bottom'} ${placement.align === 'end' ? 'right' : 'left'}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          role="menu"
          tabIndex={-1}
          aria-label={aria['aria-label']}
          onKeyDown={handleKeyDown}
          style={{ transformOrigin: origin }}
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, transition: { duration: 0.12 } }}
          transition={spring.snappy}
          className={cn(
            'absolute z-50 min-w-[13rem] p-1.5 rounded-xl material-regular shadow-popover outline-none',
            placement.side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
            placement.align === 'end' ? 'right-0' : 'left-0',
            className
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface MenuItemProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon?: LucideIcon;
  destructive?: boolean;
  /** Keyboard equivalent shown on the trailing edge, e.g. "⌘," */
  shortcut?: string;
  children: React.ReactNode;
}

export function MenuItem({ icon: Icon, destructive, shortcut, className, children, ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'w-full flex items-center gap-2.5 h-9 px-2.5 rounded-lg text-sm text-left outline-none',
        'transition-colors duration-100 disabled:opacity-40',
        destructive
          ? 'text-danger-text hover:bg-danger/10 focus-visible:bg-danger/10'
          : 'text-label hover:bg-fill-2 focus-visible:bg-fill-2',
        className
      )}
      {...props}
    >
      {Icon && <Icon className={cn('w-4 h-4 flex-shrink-0', destructive ? '' : 'text-label-2')} />}
      <span className="flex-1 truncate">{children}</span>
      {shortcut && <kbd className="font-sans text-xs text-label-3">{shortcut}</kbd>}
    </button>
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 mx-2.5 h-px bg-separator" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return <p className="px-2.5 pt-1.5 pb-1 text-xs font-semibold text-label-2">{children}</p>;
}
