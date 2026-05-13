'use client';

import React, { useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { useApp } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { IconButton } from '@/components/ui/panel';
import { getLocalizedPlaceById } from '@/lib/geocoding';

export default function GlobalActions() {
  const { language, setLanguage, stops, uiTheme, setInterfaceTheme, updateStop } = useApp();
  const t = useI18n();

  useEffect(() => {
    const stopsToLocalize = stops.filter((stop) => stop.geocodingId && !stop.names?.[language]);
    if (stopsToLocalize.length === 0) return;

    const controller = new AbortController();

    stopsToLocalize.forEach((stop) => {
      if (!stop.geocodingId) return;

      getLocalizedPlaceById(stop.geocodingId, language, controller.signal)
        .then((localizedStop) => {
          if (!localizedStop || controller.signal.aborted) return;

          updateStop(stop.id, {
            names: {
              ...stop.names,
              [language]: localizedStop.name,
            },
          });
        })
        .catch((error) => {
          if ((error as DOMException).name === 'AbortError') return;
        });
    });

    return () => controller.abort();
  }, [language, stops, updateStop]);

  return (
    <>
      <div className="pointer-events-auto fixed left-4 top-4 z-40">
        <IconButton
          onClick={() => setInterfaceTheme(uiTheme === 'dark' ? 'light' : 'dark')}
          aria-label={uiTheme === 'dark' ? t.useLightInterface : t.useDarkInterface}
          className="top-action-surface h-12 w-12 shadow-xl"
        >
          {uiTheme === 'dark' ? <Sun size={21} /> : <Moon size={21} />}
        </IconButton>
      </div>

      <div className="pointer-events-auto fixed right-4 top-4 z-40">
        <IconButton
          onClick={() => setLanguage(language === 'it' ? 'en' : 'it')}
          aria-label={language === 'it' ? t.switchToEnglish : t.switchToItalian}
          className="top-action-surface h-12 w-12 shadow-xl"
        >
          <FlagIcon language={language} />
        </IconButton>
      </div>
    </>
  );
}

function FlagIcon({ language }: { language: 'it' | 'en' }) {
  if (language === 'it') {
    return (
      <span
        aria-hidden="true"
        className="relative block h-5 w-6 overflow-hidden rounded border border-white/60 shadow-sm ring-1 ring-black/10"
      >
        <span className="absolute inset-y-0 left-0 w-1/3 bg-[#159b55]" />
        <span className="absolute inset-y-0 left-1/3 w-1/3 bg-white" />
        <span className="absolute inset-y-0 right-0 w-1/3 bg-[#d62612]" />
        <span className="absolute inset-0 bg-gradient-to-b from-white/30 via-transparent to-black/10" />
      </span>
    );
  }

  return (
      <span
        aria-hidden="true"
      className="relative block h-5 w-6 overflow-hidden rounded border border-white/60 bg-[#1f3f8b] shadow-sm ring-1 ring-black/10"
    >
      <span className="absolute left-1/2 top-1/2 h-9 w-1.5 -translate-x-1/2 -translate-y-1/2 rotate-56 bg-white" />
      <span className="absolute left-1/2 top-1/2 h-9 w-1.5 -translate-x-1/2 -translate-y-1/2 -rotate-56 bg-white" />
      <span className="absolute left-1/2 top-1/2 h-9 w-0.5 -translate-x-1/2 -translate-y-1/2 rotate-56 bg-[#d62612]" />
      <span className="absolute left-1/2 top-1/2 h-9 w-0.5 -translate-x-1/2 -translate-y-1/2 -rotate-56 bg-[#d62612]" />
      <span className="absolute inset-y-0 left-1/2 w-1.5 -translate-x-1/2 bg-white" />
      <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 bg-white" />
      <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-[#d62612]" />
      <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 bg-[#d62612]" />
      <span className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/15" />
    </span>
  );
}
