'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { AnimationState, DistanceSettingsState, ExportSettingsState, Language, Segment, Stop, Theme } from '@/types';
import { getStopThemeColors, getThemeDefaults } from '@/lib/theme-colors';
import {
  sanitizeDurationSeconds,
  sanitizeExportSettings,
  sanitizeHexColor,
  sanitizeProgress,
  sanitizeScale,
  sanitizeSpeed,
  sanitizeStop,
  sanitizeTheme,
} from '@/lib/domain/validation';
import { isTransportMode } from '@/lib/domain/transport';
import { hasConsecutiveDuplicateStops, isSameStopLocation } from '@/lib/route-stops';

interface AppContextType {
  stops: Stop[];
  segments: Segment[];
  animation: AnimationState;
  exportSettings: ExportSettingsState;
  distanceSettings: DistanceSettingsState;
  uiTheme: Theme;
  language: Language;
  addStop: (stop: Stop) => void;
  removeStop: (id: string) => void;
  updateStop: (id: string, updates: Partial<Stop>) => void;
  updateSegment: (id: string, updates: Partial<Segment>) => void;
  setAnimation: (updates: Partial<AnimationState>) => void;
  setExportSettings: (updates: Partial<ExportSettingsState>) => void;
  setDistanceSettings: (updates: Partial<DistanceSettingsState>) => void;
  setTheme: (theme: Theme) => void;
  setInterfaceTheme: (theme: Theme) => void;
  setLanguage: (language: Language) => void;
  reorderStops: (newStops: Stop[]) => void;
}

interface AppState {
  stops: Stop[];
  segments: Segment[];
  animation: AnimationState;
  exportSettings: ExportSettingsState;
  distanceSettings: DistanceSettingsState;
  uiTheme: Theme;
  language: Language;
}

type AppAction =
  | { type: 'addStop'; stop: Stop }
  | { type: 'removeStop'; id: string }
  | { type: 'updateStop'; id: string; updates: Partial<Stop> }
  | { type: 'updateSegment'; id: string; updates: Partial<Segment> }
  | { type: 'setAnimation'; updates: Partial<AnimationState> }
  | { type: 'setExportSettings'; updates: Partial<ExportSettingsState> }
  | { type: 'setDistanceSettings'; updates: Partial<DistanceSettingsState> }
  | { type: 'setTheme'; theme: Theme }
  | { type: 'setInterfaceTheme'; theme: Theme }
  | { type: 'setLanguage'; language: Language }
  | { type: 'reorderStops'; stops: Stop[] };

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, createInitialState());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.uiTheme === 'dark');
    document.documentElement.classList.toggle('light', state.uiTheme === 'light');
  }, [state.uiTheme]);

  useEffect(() => {
    document.documentElement.lang = state.language;
  }, [state.language]);

  const addStop = useCallback((stop: Stop) => dispatch({ type: 'addStop', stop }), []);
  const removeStop = useCallback((id: string) => dispatch({ type: 'removeStop', id }), []);
  const updateStop = useCallback((id: string, updates: Partial<Stop>) => {
    dispatch({ type: 'updateStop', id, updates });
  }, []);
  const updateSegment = useCallback((id: string, updates: Partial<Segment>) => {
    dispatch({ type: 'updateSegment', id, updates });
  }, []);
  const setAnimation = useCallback((updates: Partial<AnimationState>) => {
    dispatch({ type: 'setAnimation', updates });
  }, []);
  const setExportSettings = useCallback((updates: Partial<ExportSettingsState>) => {
    dispatch({ type: 'setExportSettings', updates });
  }, []);
  const setDistanceSettings = useCallback((updates: Partial<DistanceSettingsState>) => {
    dispatch({ type: 'setDistanceSettings', updates });
  }, []);
  const setTheme = useCallback((theme: Theme) => dispatch({ type: 'setTheme', theme }), []);
  const setInterfaceTheme = useCallback((theme: Theme) => {
    dispatch({ type: 'setInterfaceTheme', theme });
  }, []);
  const setLanguage = useCallback((language: Language) => {
    dispatch({ type: 'setLanguage', language });
  }, []);
  const reorderStops = useCallback((stops: Stop[]) => dispatch({ type: 'reorderStops', stops }), []);

  const contextValue = useMemo<AppContextType>(
    () => ({
      ...state,
      addStop,
      removeStop,
      updateStop,
      updateSegment,
      setAnimation,
      setExportSettings,
      setDistanceSettings,
      setTheme,
      setInterfaceTheme,
      setLanguage,
      reorderStops,
    }),
    [
      state,
      addStop,
      removeStop,
      updateStop,
      updateSegment,
      setAnimation,
      setExportSettings,
      setDistanceSettings,
      setTheme,
      setInterfaceTheme,
      setLanguage,
      reorderStops,
    ]
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'addStop': {
      const theme = state.animation.theme;
      const stop = sanitizeStop(action.stop, theme, getStopThemeColors(theme).finalStop);
      if (isSameStopLocation(state.stops.at(-1), stop)) {
        return state;
      }

      const stops = applyStopTheme([...state.stops, stop], theme);
      const lastPreviousStop = stops.at(-2);
      const addedStop = stops.at(-1);

      return {
        ...state,
        stops,
        segments:
          lastPreviousStop && addedStop
            ? [
                ...state.segments,
                {
                  id: crypto.randomUUID(),
                  fromId: lastPreviousStop.id,
                  toId: addedStop.id,
                  transportMode: 'plane',
                  durationSeconds: 5,
                },
              ]
            : state.segments,
      };
    }
    case 'removeStop': {
      const stops = applyStopTheme(
        state.stops.filter((stop) => stop.id !== action.id),
        state.animation.theme
      );

      return {
        ...state,
        stops,
        segments: rebuildSegments(stops, state.segments.filter((segment) => segment.fromId !== action.id && segment.toId !== action.id)),
      };
    }
    case 'updateStop':
      return {
        ...state,
        stops: applyStopTheme(
          state.stops.map((stop) =>
            stop.id === action.id
              ? sanitizeStop({ ...stop, ...action.updates }, state.animation.theme, stop.color)
              : stop
          ),
          state.animation.theme
        ),
      };
    case 'updateSegment':
      return {
        ...state,
        segments: state.segments.map((segment) =>
          segment.id === action.id ? sanitizeSegment({ ...segment, ...action.updates }) : segment
        ),
      };
    case 'setAnimation':
      return {
        ...state,
        animation: sanitizeAnimation({ ...state.animation, ...action.updates }, state.animation),
      };
    case 'setExportSettings':
      return {
        ...state,
        exportSettings: sanitizeExportSettings({ ...state.exportSettings, ...action.updates }),
      };
    case 'setDistanceSettings':
      return {
        ...state,
        distanceSettings: sanitizeDistanceSettings({ ...state.distanceSettings, ...action.updates }),
      };
    case 'setTheme': {
      const theme = sanitizeTheme(action.theme);

      return {
        ...state,
        animation: {
          ...state.animation,
          theme,
          ...getThemeDefaults(theme),
        },
        stops: applyStopTheme(state.stops, theme),
      };
    }
    case 'setInterfaceTheme':
      return { ...state, uiTheme: sanitizeTheme(action.theme) };
    case 'setLanguage':
      return { ...state, language: action.language === 'en' ? 'en' : 'it' };
    case 'reorderStops': {
      if (hasConsecutiveDuplicateStops(action.stops)) {
        return state;
      }

      const stops = applyStopTheme(action.stops, state.animation.theme);

      return {
        ...state,
        stops,
        segments: rebuildSegments(stops, state.segments),
      };
    }
    default:
      return state;
  }
}

function applyStopTheme(stops: Stop[], theme: Theme) {
  const colors = getStopThemeColors(theme);

  return stops.map((stop, index) => ({
    ...stop,
    color: index === stops.length - 1 ? colors.finalStop : colors.stop,
  }));
}

function createInitialState(): AppState {
  const theme: Theme = 'light';

  return {
    stops: [],
    segments: [],
    uiTheme: theme,
    language: 'it',
    animation: {
      isPlaying: false,
      progress: 0,
      speed: 1,
      currentStopIndex: 0,
      vehicleSize: 1,
      pathSize: 1,
      stopSize: 1,
      pathStyle: 'dashed',
      theme,
      ...getThemeDefaults(theme),
    },
    exportSettings: {
      format: '16:9',
      resolution: '1080',
      fps: 30,
    },
    distanceSettings: {
      isVisible: true,
      unit: 'km',
      scale: 1,
    },
  };
}

function rebuildSegments(stops: Stop[], existingSegments: Segment[]) {
  return stops.slice(0, -1).map((stop, index) => {
    const nextStop = stops[index + 1];
    const existingSegment = existingSegments.find(
      (segment) => segment.fromId === stop.id && segment.toId === nextStop.id
    );

    return sanitizeSegment({
      id: existingSegment?.id || crypto.randomUUID(),
      fromId: stop.id,
      toId: nextStop.id,
      transportMode: existingSegment?.transportMode || 'plane',
      durationSeconds: existingSegment?.durationSeconds ?? 5,
    });
  });
}

function sanitizeSegment(segment: Segment): Segment {
  return {
    ...segment,
    transportMode: isTransportMode(segment.transportMode) ? segment.transportMode : 'plane',
    durationSeconds: sanitizeDurationSeconds(segment.durationSeconds),
  };
}

function sanitizeAnimation(animation: AnimationState, fallback: AnimationState): AnimationState {
  return {
    ...animation,
    progress: sanitizeProgress(animation.progress),
    speed: sanitizeSpeed(animation.speed),
    vehicleSize: sanitizeScale(animation.vehicleSize),
    pathSize: sanitizeScale(animation.pathSize),
    stopSize: sanitizeScale(animation.stopSize),
    pathStyle: animation.pathStyle === 'solid' ? 'solid' : 'dashed',
    vehicleColor: sanitizeHexColor(animation.vehicleColor, fallback.vehicleColor),
    pathColor: sanitizeHexColor(animation.pathColor, fallback.pathColor),
    landColor: sanitizeHexColor(animation.landColor, fallback.landColor),
    oceanColor: sanitizeHexColor(animation.oceanColor, fallback.oceanColor),
    theme: sanitizeTheme(animation.theme),
  };
}

function sanitizeDistanceSettings(settings: DistanceSettingsState): DistanceSettingsState {
  return {
    isVisible: Boolean(settings.isVisible),
    unit: settings.unit === 'mi' ? 'mi' : 'km',
    scale: sanitizeScale(settings.scale),
  };
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
