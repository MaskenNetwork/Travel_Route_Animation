'use client';

import React, { useEffect, useState } from 'react';
import { useApp } from '@/lib/store';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { IconButton } from '@/components/ui/panel';
import { useI18n } from '@/lib/i18n';
import { cn } from '@/lib/utils/cn';

type PlayWarningKey = 'playNeedsStops';

const Controls: React.FC = () => {
  const { stops, animation, setAnimation } = useApp();
  const t = useI18n();
  const [playWarning, setPlayWarning] = useState<PlayWarningKey | null>(null);
  const hasAnyStop = stops.length > 0;

  useEffect(() => {
    if (!playWarning) return;

    const timeoutId = window.setTimeout(() => setPlayWarning(null), 3000);

    return () => window.clearTimeout(timeoutId);
  }, [playWarning]);

  const handleTogglePlay = () => {
    if (!hasAnyStop) return;

    if (stops.length < 2) {
      setPlayWarning('playNeedsStops');
      setAnimation({ isPlaying: false });
      return;
    }

    setPlayWarning(null);
    setAnimation({ isPlaying: !animation.isPlaying });
  };

  const handleReset = () => {
    if (!hasAnyStop) return;

    setAnimation({ progress: 0, isPlaying: false });
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!hasAnyStop) return;

    setAnimation({ progress: parseFloat(e.target.value) });
  };

  return (
    <div className="glass playback-panel flex w-[25rem] max-w-[calc(100dvw-2rem)] flex-col gap-4 rounded-2xl p-4 text-[var(--foreground)] shadow-2xl">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex shrink-0 items-center justify-center gap-2">
          <IconButton
            onClick={handleReset}
            disabled={!hasAnyStop}
            className="disabled:opacity-60"
            title={t.resetRoute}
            aria-label={t.resetRoute}
          >
            <RotateCcw size={20} />
          </IconButton>
          
          <button
            type="button"
            onClick={handleTogglePlay}
            disabled={!hasAnyStop}
            className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--action)] text-[var(--on-action)] shadow-lg shadow-[var(--action-shadow-strong)] transition-all hover:bg-[var(--action-hover)] active:scale-95 disabled:opacity-60"
            title={animation.isPlaying ? t.pause : t.play}
            aria-label={animation.isPlaying ? t.pause : t.play}
          >
            {animation.isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" className="ml-0.5" />
            )}
          </button>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={animation.progress}
            disabled={!hasAnyStop}
            onChange={handleProgressChange}
            className={cn(
              'playback-slider h-2 w-full cursor-pointer appearance-none rounded-lg disabled:cursor-default',
              hasAnyStop ? 'is-active' : 'is-disabled'
            )}
          />
          <div className="flex min-w-0 justify-between gap-3">
            <span className="block min-w-0 truncate text-[11px] font-black uppercase tracking-widest text-[var(--text-subtle)]">
              {t.start}
            </span>
            <span className="block min-w-0 truncate text-[11px] font-black uppercase tracking-widest text-[var(--text-subtle)]">
              {t.end}
            </span>
          </div>
        </div>
      </div>

      {playWarning && (
        <div className="rounded-xl border border-[var(--danger-border)] bg-[var(--danger-soft)] px-4 py-3 text-sm font-semibold text-[var(--danger)]">
          {t[playWarning]}
        </div>
      )}
    </div>
  );
};

export default Controls;
