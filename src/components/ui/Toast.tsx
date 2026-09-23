import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'motion/react';
import { project, spring } from '../../lib/motion';

export interface ToastData {
  id: number;
  message: string;
  onUndo?: () => void;
}

interface ToastProps {
  toast: ToastData | null;
  undoLabel: string;
  onDismiss: () => void;
}

/** Floating status pill. Flick it down to dismiss; the undo action sits right next to the message. */
export function Toast({ toast, undoLabel, onDismiss }: ToastProps) {
  const reduceMotion = useReducedMotion();

  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.y + project(info.velocity.y) > 48) onDismiss();
  }

  return (
    <div
      aria-live="polite"
      className="fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-sm pointer-events-none"
    >
      <AnimatePresence mode="popLayout">
        {toast && (
          <motion.div
            key={toast.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            transition={spring.snappy}
            drag={reduceMotion ? false : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.08, bottom: 1 }}
            onDragEnd={handleDragEnd}
            className="pointer-events-auto flex items-center justify-between gap-3 pl-4 pr-1.5 py-1.5 min-h-[3rem] rounded-2xl bg-[rgb(40_40_44/0.92)] text-white shadow-popover backdrop-blur-xl cursor-grab active:cursor-grabbing touch-none"
          >
            <span className="text-sm truncate">{toast.message}</span>
            {toast.onUndo && (
              <button
                type="button"
                onClick={() => {
                  toast.onUndo?.();
                  onDismiss();
                }}
                className="pressable h-9 px-3 rounded-xl text-sm font-semibold text-[#c4b5fd] hover:bg-white/10 flex-shrink-0"
              >
                {undoLabel}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
