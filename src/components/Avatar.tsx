import { getInitials, cn } from '../lib/utils';

interface AvatarProps {
  name: string;
  color: { background: string; stroke: string };
  className?: string;
  title?: string;
}

/**
 * Collaborator avatar. Initials use dark text on the light tint of the collaborator color
 * (always ≥ 7:1 contrast) and the saturated stroke color as a ring to keep the identity.
 */
export function Avatar({ name, color, className, title }: AvatarProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full text-[11px] font-semibold tracking-normal text-[#1d1d1f] ring-[1.5px] ring-inset flex-shrink-0 select-none',
        className
      )}
      style={{ backgroundColor: color.background, ['--tw-ring-color' as string]: color.stroke }}
      title={title}
      aria-label={title}
    >
      {getInitials(name)}
    </span>
  );
}
