import { ExportFormat, ExportResolution } from '@/types';

export const exportFormats = [
  { id: '16:9' as ExportFormat, label: 'Orizzontale', ratio: 16 / 9 },
  { id: '9:16' as ExportFormat, label: 'Verticale', ratio: 9 / 16 },
  { id: '1:1' as ExportFormat, label: 'Quadrato', ratio: 1 },
];

export const exportResolutions = [
  { id: '1080' as ExportResolution, label: 'Full HD', longSide: 1920 },
  { id: '1440' as ExportResolution, label: '2K', longSide: 2560 },
  { id: '2160' as ExportResolution, label: '4K', longSide: 3840 },
];

export const exportFrameRates = [24, 30, 60];

export function getExportFormat(format: ExportFormat) {
  return exportFormats.find((item) => item.id === format) || exportFormats[0];
}

export function getExportResolution(resolution: ExportResolution) {
  return exportResolutions.find((item) => item.id === resolution) || exportResolutions[0];
}

export function getExportSize(ratio: number, longSide: number) {
  if (ratio > 1) {
    return {
      width: longSide,
      height: Math.round(longSide / ratio),
    };
  }

  if (ratio < 1) {
    return {
      width: Math.round(longSide * ratio),
      height: longSide,
    };
  }

  const squareSide = Math.round(longSide * 9 / 16);

  return { width: squareSide, height: squareSide };
}

export function getPreviewSize(ratio: number, longSide = 800) {
  if (ratio === 1) {
    return { width: longSide, height: longSide };
  }

  return getExportSize(ratio, longSide);
}

export function getExportVisualScale(exportSize: { width: number; height: number }, previewSize: { width: number; height: number }) {
  return getRenderVisualScale(exportSize, exportSize, previewSize);
}

export function getRenderVisualScale(
  renderSize: { width: number; height: number },
  referenceSize: { width: number; height: number },
  baselineSize = getPreviewSize(referenceSize.width / referenceSize.height)
) {
  const renderToBaselineScale = Math.min(renderSize.width / baselineSize.width, renderSize.height / baselineSize.height);
  const aspectBalance = Math.min(referenceSize.width, referenceSize.height) / Math.max(referenceSize.width, referenceSize.height);
  const aspectCorrection = Math.pow(aspectBalance, 0.5);
  const orientationCorrection = referenceSize.width > referenceSize.height
    ? 0.85
    : referenceSize.width < referenceSize.height
      ? 1.15
      : 1;

  return renderToBaselineScale * aspectCorrection * orientationCorrection;
}

export function getRenderToReferenceScale(
  renderSize: { width: number; height: number },
  referenceSize: { width: number; height: number }
) {
  return Math.min(renderSize.width / referenceSize.width, renderSize.height / referenceSize.height);
}
