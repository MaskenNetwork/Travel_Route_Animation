'use client';

import React, { useEffect, useState } from 'react';
import { Download, Film, Loader2, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { getRouteAnimationDurationSeconds } from '@/lib/route-camera';
import { exportVideo } from '@/lib/video-export';
import {
  getExportFormat,
  getExportResolution,
  getExportSize,
  getExportVisualScale,
  getPreviewSize,
} from '@/lib/export-options';
import { loadWorldData } from '@/lib/rendering/world-data';
import { renderExportFrame } from '@/lib/rendering/export-frame';
import ExportSettingsControls from '@/components/export/ExportSettingsControls';
import { IconButton, PanelHeader, PrimaryButton } from '@/components/ui/panel';
import { useI18n } from '@/lib/i18n';
import { useMeasuredActionGroup } from '@/components/useMeasuredActionGroup';

type ExportErrorMessage =
  | { type: 'i18n'; key: 'exportNeedsStops' | 'exportFailed' }
  | { type: 'text'; message: string };

export default function ExportPanel({ onClose }: { onClose?: () => void }) {
  const { stops, segments, animation, distanceSettings, exportSettings, language, setExportSettings } = useApp();
  const t = useI18n();
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportError, setExportError] = useState<ExportErrorMessage | null>(null);

  useEffect(() => {
    if (!exportError) return;

    const timeoutId = window.setTimeout(() => setExportError(null), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [exportError]);

  const selectedFormat = getExportFormat(exportSettings.format);
  const selectedResolution = getExportResolution(exportSettings.resolution);
  const exportSize = getExportSize(selectedFormat.ratio, selectedResolution.longSide);
  const previewSize = getPreviewSize(selectedFormat.ratio);
  const exportVisualScale = getExportVisualScale(exportSize, previewSize);
  const canExport = stops.length > 0 && !isExporting;
  const exportButtonLabel = isExporting ? `${t.exporting} ${Math.round(exportProgress * 100)}%` : t.downloadVideo;
  const { availableRef: exportButtonRef, showLabels: showExportButtonLabel } = useMeasuredActionGroup({
    font: '700 14px Inter, sans-serif',
    groupGap: 0,
    iconWidths: [20],
    itemGap: 8,
    itemPaddingX: 16,
    labels: [exportButtonLabel],
    layout: 'inline',
  });
  const exportErrorText = exportError
    ? exportError.type === 'i18n'
      ? t[exportError.key]
      : exportError.message
    : null;

  const handleExport = async () => {
    if (stops.length < 2) {
      setExportError({ type: 'i18n', key: 'exportNeedsStops' });
      return;
    }

    setIsExporting(true);
    setExportProgress(0);
    setExportError(null);

    try {
      const worldData = await loadWorldData();
      const blob = await exportVideo(
        (progress, ctx) => {
          renderExportFrame({
            ctx,
            width: exportSize.width,
            height: exportSize.height,
            progress,
            stops,
            segments,
            animation,
            distanceSettings,
            language,
            worldData,
            visualScale: exportVisualScale,
          });
        },
        {
          width: exportSize.width,
          height: exportSize.height,
          fps: exportSettings.fps,
          duration: getRouteAnimationDurationSeconds(stops, segments),
        },
        setExportProgress
      );

      downloadBlob(
        blob,
        `travel-animation-${selectedFormat.id}-${exportSize.width}x${exportSize.height}-${exportSettings.fps}fps.mp4`
      );
    } catch (error) {
      setExportError(error instanceof Error ? { type: 'text', message: error.message } : { type: 'i18n', key: 'exportFailed' });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="glass flex h-full flex-col rounded-2xl p-4 text-[var(--foreground)] shadow-xl">
      <PanelHeader
        icon={<Film size={20} />}
        title={t.exportPanel}
        subtitle={`${exportSize.width} x ${exportSize.height} - ${exportSettings.fps} fps`}
        action={
          onClose ? (
            <IconButton onClick={onClose} aria-label={t.close}>
              <X size={19} />
            </IconButton>
          ) : undefined
        }
      />

      <ExportSettingsControls settings={exportSettings} onChange={setExportSettings} />

      {exportErrorText && (
        <div className="mt-4 rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
          {exportErrorText}
        </div>
      )}

      <div ref={exportButtonRef as React.RefObject<HTMLDivElement>} className="mt-4 shrink-0 border-t border-[var(--panel-border)] pt-4">
        <PrimaryButton
          onClick={handleExport}
          disabled={!canExport}
          className="relative overflow-hidden"
        >
          {isExporting ? (
            <>
              <Loader2 size={20} className="shrink-0 animate-spin" />
              {showExportButtonLabel && <span className="whitespace-nowrap">{exportButtonLabel}</span>}
              <div
                className="absolute bottom-0 left-0 h-1 bg-[var(--export-progress)] transition-all duration-300"
                style={{ width: `${exportProgress * 100}%` }}
              />
            </>
          ) : (
            <>
              <Download size={20} className="shrink-0" />
              {showExportButtonLabel && <span className="whitespace-nowrap">{exportButtonLabel}</span>}
            </>
          )}
        </PrimaryButton>
      </div>
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
