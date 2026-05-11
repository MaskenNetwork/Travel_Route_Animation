import { ExportSettingsState, Stop, Theme } from '@/types';
import { exportFrameRates } from '@/lib/export-options';
import { clamp } from '@/lib/utils/math';

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function sanitizeScale(value: number) {
  return Number.isFinite(value) ? clamp(value, 0.5, 3) : 1;
}

export function sanitizeProgress(value: number) {
  return Number.isFinite(value) ? clamp(value, 0, 1) : 0;
}

export function sanitizeSpeed(value: number) {
  return Number.isFinite(value) ? clamp(value, 0.1, 4) : 1;
}

export function sanitizeDurationSeconds(value: number) {
  return Number.isFinite(value) ? clamp(value, 0.1, 300) : 5;
}

export function sanitizeHexColor(value: string, fallback: string) {
  return HEX_COLOR_PATTERN.test(value) ? value : fallback;
}

export function sanitizeTheme(value: Theme): Theme {
  return value === 'dark' ? 'dark' : 'light';
}

export function sanitizeCoordinates(coordinates: [number, number]) {
  const [longitude, latitude] = coordinates;

  return [
    Number.isFinite(longitude) ? clamp(longitude, -180, 180) : 0,
    Number.isFinite(latitude) ? clamp(latitude, -90, 90) : 0,
  ] as [number, number];
}

export function sanitizeStop(stop: Stop, theme: Theme, fallbackColor: string): Stop {
  return {
    ...stop,
    name: stop.name.trim().slice(0, 80) || 'Tappa',
    coordinates: sanitizeCoordinates(stop.coordinates),
    color: sanitizeHexColor(stop.color, fallbackColor),
  };
}

export function sanitizeExportSettings(settings: ExportSettingsState): ExportSettingsState {
  return {
    ...settings,
    fps: exportFrameRates.includes(settings.fps) ? settings.fps : 30,
  };
}
