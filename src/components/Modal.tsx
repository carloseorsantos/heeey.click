import { useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useDragControls, useReducedMotion, type PanInfo } from 'motion/react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { project, spring } from '../lib/motion';
import { useIsCompact } from '../hooks/useMediaQuery';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { useI18n } from '../i18n';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

/** Tinted squircle for a sheet's leading symbol */
export function ModalIcon({ tone = 'accent', children }: { tone?: 'accent' | 'danger'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5',
        tone === 'danger' ? 'bg-danger/10 text-danger-text' : 'bg-accent/10 text-accent-text'
      )}
    >
      {children}
    </div>
  );
}

/**
 * Dialog on wide screens, bottom sheet on phones. The sheet follows the finger 1:1
 * from its grabber and, on release, closes if the flick is heading far enough down
 * (projected from velocity), otherwise springs back carrying that velocity.
 */
export function Modal({ isOpen, onClose, title, description, icon, size = 'md', children }: ModalProps) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const isCompact = useIsCompact();
  const reduceMotion = useReducedMotion();
  const dragControls = useDragControls();

  // Keep showing the last content while the sheet animates out (callers often clear it on close)
  const lastContent = useRef({ title, description, icon, children });
  if (isOpen) lastContent.current = { title, description, icon, children };
  const content = lastContent.current;

  useDialogFocus(isOpen, dialogRef, onClose);

  function handleDragEnd(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) {
    const height = dialogRef.current?.offsetHeight ?? 400;
    // Decide by where the gesture is going, not where it was released
    const projected = info.offset.y + project(info.velocity.y);
    if (info.velocity.y >= 0 && projected > height * 0.4) onClose();
  }

  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.2 } }
    : isCompact
      ? { initial: { y: '100%' }, animate: { y: 0 }, exit: { y: '100%' }, transition: spring.default }
      : {
          initial: { opacity: 0, scale: 0.96 },
          animate: { opacity: 1, scale: 1 },
          exit: { opacity: 0, scale: 0.98, transition: { duration: 0.15 } },
          transition: spring.snappy,
        };

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div key="modal" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
          {/* Dim to focus: this is a modal task */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 bg-[var(--scrim)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onMouseDown={onClose}
          />

          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            aria-labelledby={titleId}
            aria-describedby={content.description ? descriptionId : undefined}
            {...motionProps}
            drag={isCompact && !reduceMotion ? 'y' : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 1 }}
            dragTransition={{ bounceStiffness: 500, bounceDamping: 40 }}
            onDragEnd={handleDragEnd}
            className={cn(
              'relative w-full flex flex-col material-thick shadow-sheet outline-none',
              'max-h-[92dvh] rounded-t-[1.375rem] pb-[env(safe-area-inset-bottom)]',
              'sm:max-h-[calc(100dvh-3rem)] sm:rounded-2xl sm:pb-0',
              size === 'sm' ? 'sm:max-w-sm' : 'sm:max-w-md'
            )}
          >
            {/* Header doubles as the drag handle on phones */}
            <div
              onPointerDown={(e) => isCompact && dragControls.start(e)}
              className="flex-shrink-0 touch-none sm:touch-auto"
            >
              <div className="sm:hidden flex justify-center pt-2 pb-1" aria-hidden="true">
                <div className="w-9 h-[5px] rounded-full bg-label-3/40" />
              </div>
              <div className="flex items-start gap-3 px-5 pt-3 sm:pt-5 pb-4">
                {content.icon}
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id={titleId} className="text-lg font-semibold text-label">
                    {content.title}
                  </h2>
                  {content.description && (
                    <p id={descriptionId} className="mt-0.5 text-callout text-label-2">
                      {content.description}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="pressable -mr-1 w-8 h-8 flex items-center justify-center rounded-full bg-fill text-label-2 hover:text-label hover:bg-fill-2 flex-shrink-0"
                  aria-label={t('common.close')}
                >
                  <X className="w-4 h-4" strokeWidth={2.5} />
                </button>
              </div>
            </div>

            <div data-modal-body className="px-5 pb-5 overflow-y-auto overscroll-contain">
              {content.children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
