'use client';

import React from 'react';
import { Moon, Settings2, X, Sun } from 'lucide-react';
import { AnimationState, DistanceSettingsState, DistanceUnit, RouteLineStyle, Theme } from '@/types';
import { cn } from '@/lib/utils/cn';
import { IconButton, PanelHeader, PrimaryButton, SectionLabel } from '@/components/ui/panel';
import { useI18n } from '@/lib/i18n';
import { useMeasuredActionGroup } from '@/components/useMeasuredActionGroup';

interface RouteStylePanelProps {
  animation: AnimationState;
  distanceSettings: DistanceSettingsState;
  onClose: () => void;
  onSetAnimation: (updates: Partial<AnimationState>) => void;
  onSetDistanceSettings: (updates: Partial<DistanceSettingsState>) => void;
  onSetTheme: (theme: Theme) => void;
}

export default function RouteStylePanel({
  animation,
  distanceSettings,
  onClose,
  onSetAnimation,
  onSetDistanceSettings,
  onSetTheme,
}: RouteStylePanelProps) {
  const t = useI18n();
  const { availableRef: themeButtonsRef, showLabels: showThemeButtonLabels } = useMeasuredActionGroup({
    font: '900 12px Inter, sans-serif',
    groupGap: 8,
    groupPaddingX: 4,
    iconWidths: [15, 15],
    itemGap: 8,
    itemPaddingX: 16,
    labels: [t.light, t.dark],
    layout: 'mobile-grid',
  });

  return (
    <div className="panel-surface absolute inset-0 z-[60] flex flex-col rounded-2xl p-4 text-[var(--foreground)] shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300">
      <PanelHeader
        icon={<Settings2 size={20} />}
        title={t.settings}
        subtitle={t.routeStyle}
        action={
          <IconButton onClick={onClose} aria-label={t.closeSettings}>
            <X size={19} />
          </IconButton>
        }
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
        <section className="space-y-3">
          <SectionLabel>{t.globe}</SectionLabel>
          <div ref={themeButtonsRef as React.RefObject<HTMLDivElement>} className="grid h-12 grid-cols-2 gap-2 rounded-xl bg-[var(--panel-muted)] p-1">
            <ThemeButton active={animation.theme === 'light'} icon={<Sun size={15} />} label={t.light} onClick={() => onSetTheme('light')} showLabel={showThemeButtonLabels} />
            <ThemeButton active={animation.theme === 'dark'} icon={<Moon size={15} />} label={t.dark} onClick={() => onSetTheme('dark')} showLabel={showThemeButtonLabels} dark />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label={t.land} value={animation.landColor} onChange={(landColor) => onSetAnimation({ landColor })} />
            <ColorField label={t.water} value={animation.oceanColor} onChange={(oceanColor) => onSetAnimation({ oceanColor })} />
          </div>
        </section>

        <section className="space-y-3">
          <SectionLabel>{t.vehicle}</SectionLabel>
          <ColorField label={t.color} value={animation.vehicleColor} onChange={(vehicleColor) => onSetAnimation({ vehicleColor })} />
          <ScaleSlider label={t.scale} value={animation.vehicleSize} onChange={(vehicleSize) => onSetAnimation({ vehicleSize })} />
        </section>

        <section className="space-y-3">
          <SectionLabel>{t.line}</SectionLabel>
          <ColorField label={t.color} value={animation.pathColor} onChange={(pathColor) => onSetAnimation({ pathColor })} />
          <SegmentedControl<RouteLineStyle>
            value={animation.pathStyle}
            options={[
              { value: 'dashed', label: t.dashedLine },
              { value: 'solid', label: t.solidLine },
            ]}
            onChange={(pathStyle) => onSetAnimation({ pathStyle })}
          />
          <ScaleSlider label={t.scale} value={animation.pathSize} onChange={(pathSize) => onSetAnimation({ pathSize })} />
        </section>

        <section className="space-y-3">
          <SectionLabel>{t.stops}</SectionLabel>
          <ScaleSlider label={t.scale} value={animation.stopSize} onChange={(stopSize) => onSetAnimation({ stopSize })} />
        </section>

        <section className="space-y-3">
          <SectionLabel>{t.odometer}</SectionLabel>
          <ToggleRow
            label={t.showDistance}
            checked={distanceSettings.isVisible}
            onChange={(isVisible) => onSetDistanceSettings({ isVisible })}
          />
          {distanceSettings.isVisible && (
            <>
              <SegmentedControl<DistanceUnit>
                value={distanceSettings.unit}
                options={[
                  { value: 'km', label: t.km },
                  { value: 'mi', label: t.mi },
                ]}
                onChange={(unit) => onSetDistanceSettings({ unit })}
              />
              <ScaleSlider label={t.scale} value={distanceSettings.scale} onChange={(scale) => onSetDistanceSettings({ scale })} />
            </>
          )}
        </section>
      </div>

      <div className="mt-4 shrink-0 border-t border-[var(--panel-border)] pt-4">
        <PrimaryButton onClick={onClose} className="text-xs uppercase tracking-widest">
          {t.confirmClose}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="field-surface flex h-12 cursor-pointer items-center justify-between gap-3 rounded-xl px-4">
      <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--action)]"
      />
    </label>
  );
}

function SegmentedControl<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: TValue;
  options: Array<{ value: TValue; label: string }>;
  onChange: (value: TValue) => void;
}) {
  return (
    <div className="space-y-2">
      {label && <span className="block text-[10px] font-black uppercase tracking-widest text-[var(--text-subtle)]">{label}</span>}
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
              value === option.value ? 'bg-[var(--action)] text-[var(--on-action)] shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--field-hover)]'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeButton({
  active,
  icon,
  label,
  onClick,
  showLabel,
  dark,
}: {
  active: boolean;
  icon?: React.ReactNode;
  label: string;
  onClick: () => void;
  showLabel: boolean;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-full items-center justify-center gap-2 rounded-lg px-3 text-xs font-black uppercase tracking-widest transition-all',
        active
          ? dark
            ? 'bg-[var(--dark-option-bg)] text-[var(--dark-option-text)] shadow-sm shadow-[var(--dark-option-shadow)]'
            : 'bg-[var(--light-option-bg)] text-[var(--light-option-text)] shadow-sm'
          : 'text-[var(--text-muted)] hover:bg-[var(--field-hover)]'
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {showLabel && <span className="whitespace-nowrap">{label}</span>}
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="field-surface flex h-12 items-center gap-3 rounded-xl px-3">
      <input
        type="color"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border-none bg-transparent"
      />
      <span className="min-w-0 flex-1 truncate text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
    </label>
  );
}

function ScaleSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="field-surface block rounded-xl p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="text-xs font-black uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
        <span className="rounded-lg bg-[var(--action-soft)] px-3 py-1 text-[10px] font-black text-[var(--action)]">{value}x</span>
      </div>
      <div>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={value}
          onChange={(event) => onChange(parseFloat(event.target.value))}
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-[var(--field-bg)] accent-[var(--action)]"
        />
        <div className="mt-2 flex justify-between text-[10px] font-bold text-[var(--text-faint)]">
          <span>0.5x</span>
          <span>3.0x</span>
        </div>
      </div>
    </label>
  );
}
