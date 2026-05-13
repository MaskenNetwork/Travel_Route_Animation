'use client';

import React from 'react';
import { Monitor, Smartphone, Square } from 'lucide-react';
import { ExportSettingsState } from '@/types';
import {
  exportFormats,
  exportFrameRates,
  exportResolutions,
  getExportFormat,
  getExportResolution,
} from '@/lib/export-options';
import { cn } from '@/lib/utils/cn';
import { SectionLabel, SegmentedControl } from '@/components/ui/panel';
import { useI18n } from '@/lib/i18n';
import { useMeasuredActionGroup } from '@/components/useMeasuredActionGroup';

interface ExportSettingsControlsProps {
  settings: ExportSettingsState;
  onChange: (updates: Partial<ExportSettingsState>) => void;
}

const formatIcons = {
  '16:9': <Monitor size={18} />,
  '9:16': <Smartphone size={18} />,
  '1:1': <Square size={18} />,
};

export default function ExportSettingsControls({ settings, onChange }: ExportSettingsControlsProps) {
  const t = useI18n();
  const selectedFormat = getExportFormat(settings.format);
  const selectedResolution = getExportResolution(settings.resolution);

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar">
      <section className="space-y-3">
        <SectionLabel>{t.format}</SectionLabel>
        <div className="space-y-2">
          {exportFormats.map((format) => (
            <ExportFormatButton
              key={format.id}
              id={format.id}
              icon={formatIcons[format.id]}
              isSelected={selectedFormat.id === format.id}
              label={t.formats[format.id]}
              onClick={() => onChange({ format: format.id })}
            />
          ))}
        </div>
      </section>

      <SegmentedControl
        label={t.resolution}
        value={selectedResolution.id}
        options={exportResolutions.map((resolution) => ({
          value: resolution.id,
          label: getExportResolution(resolution.id).label,
        }))}
        onChange={(resolution) => onChange({ resolution })}
        className="space-y-3"
      />

      <SegmentedControl
        label={t.fps}
        value={settings.fps}
        options={exportFrameRates.map((fps) => ({ value: fps, label: String(fps) }))}
        onChange={(fps) => onChange({ fps })}
        className="space-y-3"
      />
    </div>
  );
}

function ExportFormatButton({
  id,
  icon,
  isSelected,
  label,
  onClick,
}: {
  id: ExportSettingsState['format'];
  icon: React.ReactNode;
  isSelected: boolean;
  label: string;
  onClick: () => void;
}) {
  const { availableRef, showLabels } = useMeasuredActionGroup({
    font: '500 14px Inter, sans-serif',
    groupGap: 0,
    iconWidths: [18],
    itemGap: 12,
    itemPaddingX: 16,
    labels: [label],
    layout: 'inline',
  });

  return (
    <button
      ref={availableRef as React.RefObject<HTMLButtonElement>}
      type="button"
      title={`${label} (${id})`}
      aria-label={`${label} (${id})`}
      onClick={onClick}
      className={cn(
        'flex h-12 w-full items-center justify-start gap-3 rounded-xl px-4 text-sm transition-all',
        isSelected
          ? 'bg-[var(--action)] text-[var(--on-action)] shadow-lg shadow-[var(--action-shadow)]'
          : 'top-action-surface text-[var(--text-strong)] hover:text-[var(--action)]'
      )}
    >
      <span className="shrink-0">{icon}</span>
      {showLabels && (
        <div className="flex min-w-0 flex-col items-start">
          <span className="truncate font-medium">{label}</span>
          <span className={cn('text-[10px]', isSelected ? 'text-[var(--on-action)]/70' : 'opacity-40')}>{id}</span>
        </div>
      )}
    </button>
  );
}
