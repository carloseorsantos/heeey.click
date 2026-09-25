import { Blobatar } from '@blobatar/react';
import 'blobatar/motion.css';
import { cn } from '../lib/utils';

interface AvatarProps {
  /** Stable user or guest id: seeds the blob, so people with the same name still look different */
  id: string;
  color: { background: string; stroke: string };
  className?: string;
  title?: string;
  /** Idle motion. Off by default: static avatars render as a cheap <img>. */
  animate?: 'hover' | 'always';
}

/** Hue in degrees of a #rrggbb color, so the blob matches the collaborator's cursor color. */
function hexToHue(hex: string): number | undefined {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return undefined;
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(h * 60 + 360) % 360;
}

// Only the mid and deep swatches: the pale ones vanish on the light tint behind them.
const TRAITS = { tone: [0.5, 0.65] };

/**
 * Collaborator avatar: a deterministic blobatar (https://blobatar.dev) generated from the
 * user id, with its hue locked to the collaborator color. It sits on the light tint of that
 * color with the saturated stroke as a ring, so it still reads as the same person as the cursor.
 */
export function Avatar({ id, color, className, title, animate }: AvatarProps) {
  const hue = hexToHue(color.stroke);
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full ring-[1.5px] ring-inset flex-shrink-0 select-none overflow-hidden',
        className
      )}
      style={{ backgroundColor: color.background, ['--tw-ring-color' as string]: color.stroke }}
      title={title}
      aria-label={title}
      role={title ? 'img' : undefined}
    >
      {animate ? (
        <Blobatar name={id} hue={hue} traits={TRAITS} animate={animate} aria-hidden className="w-[72%] h-[72%]" />
      ) : (
        <Blobatar name={id} hue={hue} traits={TRAITS} alt="" aria-hidden draggable={false} className="w-[72%] h-[72%]" />
      )}
    </span>
  );
}
