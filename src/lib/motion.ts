import type { Transition } from 'motion/react';

/**
 * Springs, in Apple's terms: `bounce` ≈ 1 − damping ratio, `duration` ≈ response.
 * Critically damped by default; bounce only where a gesture carried momentum.
 */
export const spring = {
  /** Default for UI that appears or moves (menus, dialogs, layout) */
  default: { type: 'spring', bounce: 0, duration: 0.4 } satisfies Transition,
  /** Small, quick surfaces (popovers, toasts) */
  snappy: { type: 'spring', bounce: 0, duration: 0.3 } satisfies Transition,
  /** Sheets and drawers released after a drag */
  momentum: { type: 'spring', bounce: 0.18, duration: 0.35 } satisfies Transition,
} as const;

/**
 * Where a flick would come to rest, using the exponential decay scroll views use.
 * decelerationRate ≈ 0.998 feels like normal scrolling, 0.99 is snappier.
 */
export function project(velocity: number, decelerationRate = 0.998): number {
  return ((velocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

/** Progressive resistance past a boundary: the further you pull, the less it follows */
export function rubberband(overshoot: number, dimension: number, constant = 0.55): number {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
