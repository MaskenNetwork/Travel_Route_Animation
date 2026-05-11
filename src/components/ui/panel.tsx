import React from 'react';
import { cn } from '@/lib/utils/cn';

type SegmentedOption<TValue extends string | number> = {
  value: TValue;
  label: string;
};

export function PanelHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex h-12 shrink-0 items-center gap-3">
      {icon && (
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--action-soft)] text-[var(--action)]">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-sm font-bold uppercase tracking-widest text-[var(--text-strong)]">
          {title}
        </h2>
        {subtitle && (
          <p className="truncate text-[10px] font-semibold uppercase tracking-widest text-[var(--text-faint)]">
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block min-w-0 truncate text-[10px] font-black uppercase tracking-widest text-[var(--text-subtle)]">
      {children}
    </span>
  );
}

export function AlertMessage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]',
        className
      )}
    >
      {children}
    </div>
  );
}

export function SegmentedControl<TValue extends string | number>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label?: string;
  value: TValue;
  options: Array<SegmentedOption<TValue>>;
  onChange: (value: TValue) => void;
  className?: string;
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {label && <SectionLabel>{label}</SectionLabel>}
      <div
        className="grid h-12 gap-2 rounded-xl bg-[var(--panel-muted)] p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'h-full rounded-lg px-2 text-xs font-black uppercase tracking-widest transition-all',
              value === option.value
                ? 'bg-[var(--action)] text-[var(--on-action)] shadow-sm'
                : 'text-[var(--text-muted)] hover:bg-[var(--field-hover)]'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function IconButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'top-action-surface flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[var(--text-strong)] transition-all hover:text-[var(--action)] active:scale-95',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--action)] px-4 text-sm font-bold text-[var(--on-action)] shadow-lg shadow-[var(--action-shadow)] transition-all hover:bg-[var(--action-hover)] active:scale-95 disabled:opacity-60',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function SoftButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'top-action-surface flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold text-[var(--text-strong)] transition-all hover:text-[var(--action)] active:scale-95',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
