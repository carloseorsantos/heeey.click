import { useId } from 'react';
import { motion } from 'motion/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';
import { spring } from '../../lib/motion';

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  lang?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
}

/** Segmented control whose selection pill slides between segments */
export function SegmentedControl<T extends string>({ value, options, onChange, className, ...aria }: SegmentedControlProps<T>) {
  const layoutId = useId();

  function handleKeyDown(e: React.KeyboardEvent) {
    const index = options.findIndex((o) => o.value === value);
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(index + step + options.length) % options.length];
    onChange(next.value);
    (e.currentTarget.querySelector(`[data-value="${next.value}"]`) as HTMLElement | null)?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={aria['aria-label']}
      onKeyDown={handleKeyDown}
      className={cn('flex p-0.5 rounded-[10px] bg-fill', className)}
    >
      {options.map(({ value: optionValue, label, icon: Icon, lang }) => {
        const selected = optionValue === value;
        return (
          <button
            key={optionValue}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-value={optionValue}
            lang={lang}
            onClick={() => onChange(optionValue)}
            className={cn(
              'relative flex-1 h-8 px-3 flex items-center justify-center gap-1.5 rounded-lg text-callout outline-none transition-colors',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              selected ? 'text-label font-semibold' : 'text-label-2 hover:text-label'
            )}
          >
            {selected && (
              <motion.span
                layoutId={layoutId}
                transition={spring.snappy}
                className="absolute inset-0 rounded-lg bg-surface-raised shadow-[0_0_0_0.5px_rgba(0,0,0,0.06),0_2px_6px_rgba(0,0,0,0.1)]"
              />
            )}
            {Icon && <Icon className="relative w-4 h-4" />}
            <span className="relative truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
