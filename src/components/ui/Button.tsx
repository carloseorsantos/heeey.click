import { forwardRef } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'primary' | 'secondary' | 'plain' | 'tinted' | 'danger' | 'danger-plain';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Square button that only holds an icon (give it an aria-label) */
  iconOnly?: boolean;
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hover shadow-[inset_0_0.5px_0_rgba(255,255,255,0.25)]',
  secondary: 'bg-fill text-label hover:bg-fill-2',
  plain: 'text-label-2 hover:text-label hover:bg-fill',
  tinted: 'bg-accent/10 text-accent-text hover:bg-accent/15',
  danger: 'bg-danger text-white hover:brightness-110',
  'danger-plain': 'text-danger-text hover:bg-danger/10',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-callout gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-[10px]',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
};

const iconSizes: Record<Size, string> = {
  sm: 'w-8 h-8 rounded-lg',
  md: 'w-10 h-10 rounded-[10px]',
  lg: 'w-12 h-12 rounded-xl',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', iconOnly = false, className, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'pressable inline-flex items-center justify-center font-semibold select-none flex-shrink-0',
        'disabled:opacity-40 disabled:pointer-events-none',
        variants[variant],
        iconOnly ? iconSizes[size] : sizes[size],
        className
      )}
      {...props}
    />
  );
});
