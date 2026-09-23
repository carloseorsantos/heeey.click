import { cn } from '../../lib/utils';

/** Inset grouped section, like a grouped table in System Settings */
export function SettingsGroup({
  title,
  footer,
  className,
  children,
}: {
  title?: string;
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      {title && <h3 className="section-label px-1 mb-1.5">{title}</h3>}
      <div className="rounded-xl bg-fill divide-y divide-separator overflow-hidden">{children}</div>
      {footer && <p className="px-1 mt-1.5 text-xs text-label-2">{footer}</p>}
    </section>
  );
}

/** Label on the left, control on the right */
export function SettingsRow({
  label,
  description,
  children,
  className,
}: {
  label: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 px-4 py-3 min-h-[3.25rem]', className)}>
      <div className="min-w-0">
        <p className="text-sm text-label">{label}</p>
        {description && <p className="text-xs text-label-2 mt-0.5">{description}</p>}
      </div>
      {children && <div className="flex-shrink-0">{children}</div>}
    </div>
  );
}
