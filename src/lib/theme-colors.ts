import { AnimationState, Theme } from '@/types';

export const themeDefaults: Record<Theme, Pick<AnimationState, 'landColor' | 'oceanColor' | 'vehicleColor' | 'pathColor'>> = {
  light: {
    landColor: '#86e0a3',
    oceanColor: '#85c1f5',
    vehicleColor: '#323232',
    pathColor: '#3264ff',
  },
  dark: {
    landColor: '#0c243c',
    oceanColor: '#1d4e7a',
    vehicleColor: '#dfdfdf',
    pathColor: '#6496ff',
  },
};

export const stopThemeColors: Record<Theme, { stop: string; finalStop: string }> = {
  light: {
    stop: '#3264ff',
    finalStop: '#ff6432',
  },
  dark: {
    stop: '#6496ff',
    finalStop: '#ff9664',
  },
};

export function getThemeDefaults(theme: Theme): Pick<AnimationState, 'landColor' | 'oceanColor' | 'vehicleColor' | 'pathColor'> {
  return themeDefaults[theme];
}

export function getStopThemeColors(theme: Theme) {
  return stopThemeColors[theme];
}
