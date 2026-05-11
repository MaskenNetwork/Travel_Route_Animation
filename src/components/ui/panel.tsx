import React from 'react';
import { cn } from '@/lib/utils/cn';

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
