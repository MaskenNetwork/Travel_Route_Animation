'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { AnimationState, DistanceSettingsState, ExportSettingsState, Language, Segment, Stop, Theme } from '@/types';
import { appReducer, createInitialState } from '@/lib/state/app-state';

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

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
