import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getLocale, t, translate, type Locale } from '../i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const COLLABORATOR_PALETTE = [
  { background: '#fee2e2', stroke: '#ef4444' }, // red
  { background: '#ffedd5', stroke: '#f97316' }, // orange
  { background: '#fef3c7', stroke: '#f59e0b' }, // amber
  { background: '#dcfce7', stroke: '#10b981' }, // green
  { background: '#e0e7ff', stroke: '#6366f1' }, // indigo
  { background: '#f3e8ff', stroke: '#a855f7' }, // purple
  { background: '#fce7f3', stroke: '#ec4899' }, // pink
  { background: '#cffafe', stroke: '#06b6d4' }, // cyan
  { background: '#ccfbf1', stroke: '#14b8a6' }, // teal
  { background: '#fae8ff', stroke: '#d946ef' }, // fuchsia
];

export function getRandomCollaboratorColor(seed?: string): { background: string; stroke: string } {
  if (seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % COLLABORATOR_PALETTE.length;
    return COLLABORATOR_PALETTE[index];
  }
  return COLLABORATOR_PALETTE[Math.floor(Math.random() * COLLABORATOR_PALETTE.length)];
}

const ANIMAL_NAMES: Record<Locale, string[]> = {
  'pt-BR': [
    'Gavião', 'Raposa', 'Golfinho', 'Panda', 'Lobo',
    'Águia', 'Leão', 'Coruja', 'Tigre', 'Lontra',
    'Koala', 'Falcão', 'Gato', 'Urso', 'Castor',
  ],
  'en-US': [
    'Hawk', 'Fox', 'Dolphin', 'Panda', 'Wolf',
    'Eagle', 'Lion', 'Owl', 'Tiger', 'Otter',
    'Koala', 'Falcon', 'Cat', 'Bear', 'Beaver',
  ],
  'es-ES': [
    'Halcón', 'Zorro', 'Delfín', 'Panda', 'Lobo',
    'Águila', 'León', 'Búho', 'Tigre', 'Nutria',
    'Koala', 'Cernícalo', 'Gato', 'Oso', 'Castor',
  ],
};

export function generateGuestName(locale: Locale = getLocale()): string {
  const names = ANIMAL_NAMES[locale];
  const animal = names[Math.floor(Math.random() * names.length)];
  const num = Math.floor(10 + Math.random() * 90);
  return `${animal} #${num}`;
}

/** Relative time in the given locale ("há 5 minutos" / "5 minutes ago"), dates after a week */
export function formatDateRelative(dateStr: string | Date, locale: Locale = getLocale()): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (Number.isNaN(diffSeconds)) return translate(locale, 'dates.recently');

    if (diffSeconds < 60) return translate(locale, 'dates.justNow');
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return relative.format(-diffMinutes, 'minute');
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return relative.format(-diffHours, 'hour');
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return relative.format(-diffDays, 'day');

    return date.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return translate(locale, 'dates.recently');
  }
}

/** Calendar date in the given locale ("24 de out." / "Oct 24"), with the year when it is not this year */
export function formatDateShort(dateStr: string | Date, locale: Locale = getLocale()): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
  });
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  waitMs: number
): ((...args: Parameters<T>) => void) & {
  cancel: () => void;
  flush: () => ReturnType<T> | undefined;
} {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: Parameters<T> | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    pendingArgs = args;
    timeout = setTimeout(() => {
      timeout = null;
      pendingArgs = null;
      func(...args);
    }, waitMs);
  };

  debounced.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    pendingArgs = null;
  };

  // Runs the pending call right away and returns its result (undefined when nothing is pending)
  debounced.flush = (): ReturnType<T> | undefined => {
    if (!timeout || !pendingArgs) return undefined;
    const args = pendingArgs;
    clearTimeout(timeout);
    timeout = null;
    pendingArgs = null;
    return func(...args);
  };

  return debounced;
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limitMs: number
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let lastRan = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;

    if (now - lastRan >= limitMs) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      lastRan = now;
      func(...args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        lastRan = Date.now();
        timeout = null;
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limitMs - (now - lastRan));
    }
  };

  throttled.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    lastArgs = null;
  };

  return throttled;
}

function createBaseElement(type: string, x: number, y: number, width: number, height: number, custom: Record<string, any> = {}) {
  return {
    id: generateId().slice(0, 12),
    type,
    x,
    y,
    width,
    height,
    angle: 0,
    strokeColor: '#1e1e1e',
    backgroundColor: 'transparent',
    fillStyle: 'solid',
    strokeWidth: 2,
    strokeStyle: 'solid',
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: { type: 3 },
    seed: Math.floor(Math.random() * 100000),
    version: 1,
    versionNonce: Math.floor(Math.random() * 100000),
    isDeleted: false,
    boundElements: null,
    updated: Date.now(),
    link: null,
    locked: false,
    ...custom,
  };
}

// Rough box for hand-drawn text (Excalifont averages ~0.6em per character). Excalidraw clips text
// to its box, so it has to fit every line, not just the first
function estimateTextBox(text: string, fontSize: number, lineHeight: number) {
  // A loop, not Math.max(...lines): spreading a text with ~100k lines overflows the call stack
  let lineCount = 0;
  let longestLine = 0;
  for (const line of text.split('\n')) {
    lineCount++;
    if (line.length > longestLine) longestLine = line.length;
  }
  return {
    width: longestLine * (fontSize * 0.6),
    // Same order as Excalidraw's getTextHeight, so a correctly sized box compares equal
    height: lineCount * (fontSize * lineHeight),
  };
}

function createTextElement(x: number, y: number, text: string, custom: Record<string, any> = {}) {
  const fontSize = custom.fontSize || 20;
  const lineHeight = custom.lineHeight || 1.25;
  const { width, height } = estimateTextBox(text, fontSize, lineHeight);
  return createBaseElement('text', x, y, width, height, {
    text,
    fontSize,
    fontFamily: 1,
    textAlign: 'left',
    verticalAlign: 'top',
    containerId: null,
    originalText: text,
    lineHeight,
    ...custom,
  });
}

/**
 * Grows free-standing text boxes shorter than their lines, so boards saved with a single-line
 * height (e.g. older templates) show every line. Only the height changes: it is exact, while the
 * width would be a guess. Board elements are untrusted, so odd sizes are left alone.
 */
export function fitTextHeights<T extends Record<string, any>>(elements: readonly T[]): T[] {
  return elements.map((el) => {
    if (el.type !== 'text' || el.containerId || typeof el.text !== 'string') return el;
    const { fontSize, lineHeight, height } = el;
    if (![fontSize, lineHeight, height].every((n) => typeof n === 'number' && Number.isFinite(n) && n >= 0)) {
      return el;
    }
    const needed = estimateTextBox(el.text, fontSize, lineHeight).height;
    return Number.isFinite(needed) && height < needed ? { ...el, height: needed } : el;
  });
}

export function getBrainstormingTemplate(): any[] {
  return [
    createTextElement(80, 50, t('templates.brainstorming.title'), {
      fontSize: 28,
      strokeColor: '#6366f1',
    }),
    // Sticky Note 1 (Amarelo)
    createBaseElement('rectangle', 80, 130, 280, 180, {
      backgroundColor: '#fef08a',
      strokeColor: '#ca8a04',
      fillStyle: 'solid',
      roundness: { type: 3 },
    }),
    createTextElement(95, 150, t('templates.brainstorming.goal'), {
      fontSize: 16,
      strokeColor: '#713f12',
    }),
    // Sticky Note 2 (Verde)
    createBaseElement('rectangle', 400, 130, 280, 180, {
      backgroundColor: '#bbf7d0',
      strokeColor: '#16a34a',
      fillStyle: 'solid',
      roundness: { type: 3 },
    }),
    createTextElement(415, 150, t('templates.brainstorming.features'), {
      fontSize: 16,
      strokeColor: '#14532d',
    }),
    // Sticky Note 3 (Roxo)
    createBaseElement('rectangle', 720, 130, 280, 180, {
      backgroundColor: '#e9d5ff',
      strokeColor: '#9333ea',
      fillStyle: 'solid',
      roundness: { type: 3 },
    }),
    createTextElement(735, 150, t('templates.brainstorming.nextSteps'), {
      fontSize: 16,
      strokeColor: '#581c87',
    }),
  ];
}

export function getFlowchartTemplate(): any[] {
  // Each step label spans its card and is centered by Excalidraw, so any locale's text sits in the middle
  const stepLabel = (cardX: number, cardWidth: number, text: string, strokeColor: string) =>
    createTextElement(cardX + 10, 140 + (70 - 18 * 1.25) / 2, text, {
      fontSize: 18,
      strokeColor,
      width: cardWidth - 20,
      textAlign: 'center',
    });
  return [
    createTextElement(80, 50, t('templates.flowchart.title'), {
      fontSize: 28,
      strokeColor: '#059669',
    }),
    // Step 1: Start
    createBaseElement('rectangle', 80, 140, 160, 70, {
      backgroundColor: '#d1fae5',
      strokeColor: '#059669',
      fillStyle: 'solid',
      roundness: { type: 3 },
    }),
    stepLabel(80, 160, t('templates.flowchart.start'), '#065f46'),

    // Arrow 1 -> 2
    createBaseElement('arrow', 245, 175, 80, 0, {
      strokeColor: '#059669',
      points: [[0, 0], [80, 0]],
      endArrowhead: 'arrow',
    }),

    // Step 2: Processing
    createBaseElement('rectangle', 330, 140, 170, 70, {
      backgroundColor: '#e0e7ff',
      strokeColor: '#4f46e5',
      fillStyle: 'solid',
      roundness: { type: 3 },
    }),
    stepLabel(330, 170, t('templates.flowchart.run'), '#312e81'),

    // Arrow 2 -> 3
    createBaseElement('arrow', 505, 175, 80, 0, {
      strokeColor: '#4f46e5',
      points: [[0, 0], [80, 0]],
      endArrowhead: 'arrow',
    }),

    // Step 3: Success
    createBaseElement('rectangle', 590, 140, 160, 70, {
      backgroundColor: '#fef3c7',
      strokeColor: '#d97706',
      fillStyle: 'solid',
      roundness: { type: 3 },
    }),
    stepLabel(590, 160, t('templates.flowchart.done'), '#78350f'),
  ];
}

export function getWireframeTemplate(): any[] {
  // Nav is anchored to the right edge of the header bar, since its length varies per locale
  const nav = t('templates.wireframe.nav');
  const navX = 80 + 680 - 25 - estimateTextBox(nav, 14, 1.25).width;
  return [
    createTextElement(80, 40, t('templates.wireframe.title'), {
      fontSize: 28,
      strokeColor: '#4338ca',
    }),
    // Browser Frame Container
    createBaseElement('rectangle', 80, 100, 680, 420, {
      backgroundColor: '#f8fafc',
      strokeColor: '#64748b',
      strokeWidth: 2,
    }),
    // Header Bar
    createBaseElement('rectangle', 80, 100, 680, 50, {
      backgroundColor: '#ffffff',
      strokeColor: '#cbd5e1',
      strokeWidth: 1,
    }),
    createTextElement(105, 115, 'Heeey App', { fontSize: 18, strokeColor: '#7c3aed' }),
    // Nav Items
    createTextElement(navX, 117, nav, { fontSize: 14, strokeColor: '#64748b' }),
    // Hero Card
    createBaseElement('rectangle', 120, 180, 600, 160, {
      backgroundColor: '#ffffff',
      strokeColor: '#e2e8f0',
      strokeWidth: 1,
      roundness: { type: 3 },
    }),
    createTextElement(150, 210, t('templates.wireframe.heading'), { fontSize: 22, strokeColor: '#0f172a' }),
    createTextElement(150, 245, t('templates.wireframe.subheading'), { fontSize: 14, strokeColor: '#64748b' }),
    // CTA Button
    createBaseElement('rectangle', 150, 280, 140, 40, {
      backgroundColor: '#7c3aed',
      strokeColor: '#6d28d9',
      roundness: { type: 3 },
    }),
    createTextElement(185, 290, t('templates.wireframe.cta'), { fontSize: 14, strokeColor: '#ffffff' }),
  ];
}

