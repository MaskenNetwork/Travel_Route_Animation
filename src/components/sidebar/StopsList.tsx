'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Reorder } from 'framer-motion';
import { GripVertical, MapPin, Trash2 } from 'lucide-react';
import { Language, Segment, Stop } from '@/types';
import { getStopThemeColors } from '@/lib/theme-colors';
import { getRouteCameraFrame } from '@/lib/route-camera';
import { isTransportMode, transportOptions } from '@/lib/domain/transport';
import { sanitizeDurationSeconds } from '@/lib/domain/validation';
import { clamp, easeOutBack, easeOutCubic } from '@/lib/utils/math';
import { useI18n } from '@/lib/i18n';
import { getStopName } from '@/lib/stop-display';

interface StopsListProps {
  stops: Stop[];
  segments: Segment[];
  language: Language;
  theme: 'light' | 'dark';
  progress: number;
  onRemoveStop: (id: string) => void;
  onReorderStops: (stops: Stop[]) => boolean;
  onUpdateSegment: (id: string, updates: Partial<Segment>) => void;
}

export default function StopsList({
  stops,
  segments,
  language,
  theme,
  progress,
  onRemoveStop,
  onReorderStops,
  onUpdateSegment,
}: StopsListProps) {
  const t = useI18n();
  const [durationDrafts, setDurationDrafts] = useState<Record<string, string>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [draftStops, setDraftStops] = useState<Stop[]>([]);
  const draftStopsRef = useRef(stops);

  useEffect(() => {
    draftStopsRef.current = stops;
  }, [stops]);

  const displayedStops = isDragging ? draftStops : stops;
  const routeFrame = getRouteCameraFrame(displayedStops, segments, progress, 1);

  const handleDragStart = () => {
    draftStopsRef.current = stops;
    setDraftStops(stops);
    setIsDragging(true);
  };

  const updateDraftStops = (newStops: Stop[]) => {
    draftStopsRef.current = newStops;
    setDraftStops(newStops);
  };

  const handleDrop = () => {
    const nextStops = draftStopsRef.current;
    const didCommit = onReorderStops(nextStops);

    if (!didCommit) {
      draftStopsRef.current = stops;
    }

    setDraftStops([]);
    setIsDragging(false);
  };

  if (stops.length === 0) {
    return (
      <div className="flex h-full min-h-40 flex-col items-center justify-center text-center text-sm opacity-40">
        <MapPin size={32} className="mb-2" />
        <p>
          {t.noStops}
          <br />
          {t.startWithCity}
        </p>
      </div>
    );
  }

  return (
    <Reorder.Group
      axis="y"
      values={displayedStops}
      onReorder={updateDraftStops}
      className="h-full space-y-3 overflow-y-auto pr-2 custom-scrollbar"
    >
      {displayedStops.map((stop, index) => {
        const segment = segments[index];
        const themeColors = getStopThemeColors(theme);
        const stopTransition = getSidebarStopTransition(index, displayedStops.length, routeFrame, themeColors);
        const stopColor = stopTransition.color;
        const stopName = getStopName(stop, language);
        const rowStyle = {
          '--stop-color': stopColor,
          '--stop-scale': stopTransition.scale,
        } as React.CSSProperties;

        return (
          <Reorder.Item
            key={stop.id}
            value={stop}
            onDragStart={handleDragStart}
            onDragEnd={handleDrop}
            className="space-y-2 cursor-grab active:cursor-grabbing"
          >
            <div
              className="group relative flex h-12 min-h-12 items-center gap-3 overflow-hidden rounded-xl border border-[var(--stop-color)] bg-[var(--panel-muted)] px-3 py-0 transition-all hover:bg-[var(--field-hover)]"
              style={rowStyle}
            >
              <GripVertical size={14} className="shrink-0 text-[var(--text-subtle)]" />
              <span className="h-4 w-4 shrink-0 rounded-full border border-white/80 bg-[var(--stop-color)] shadow-sm" style={{ transform: 'scale(var(--stop-scale))' }} />
              <span className="flex-1 truncate text-sm font-medium">{stopName}</span>

              <div className="flex items-center transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRemoveStop(stop.id);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--delete)] hover:bg-[var(--delete-soft)]"
                  aria-label={`Rimuovi ${stopName}`}
                  title={`Rimuovi ${stopName}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {index < displayedStops.length - 1 && segment && (
              <div className="grid grid-cols-[1fr_6rem] gap-2 rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-muted)]/45 p-3">
                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[var(--text-subtle)]">
                    {t.vehicle}
                  </span>
                  <select
                    value={segment.transportMode}
                    onChange={(event) => {
                      if (isTransportMode(event.target.value)) {
                        onUpdateSegment(segment.id, { transportMode: event.target.value });
                      }
                    }}
                    className="field-surface h-12 w-full rounded-xl px-3 text-sm font-semibold outline-none transition-all focus:ring-2 focus:ring-[var(--action)]/40"
                  >
                    {transportOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {t.transport[option.id]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="min-w-0">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-[var(--text-subtle)]">
                    {t.seconds}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={durationDrafts[segment.id] ?? String(segment.durationSeconds ?? 5).replace('.', ',')}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDurationDrafts((current) => ({ ...current, [segment.id]: value }));

                      if (!/^\d*([,.]\d*)?$/.test(value)) return;

                      const parsedDuration = Number(value.replace(',', '.'));
                      if (Number.isFinite(parsedDuration)) {
                        onUpdateSegment(segment.id, { durationSeconds: sanitizeDurationSeconds(parsedDuration) });
                      }
                    }}
                    onBlur={() => {
                      setDurationDrafts((current) => {
                        const next = { ...current };
                        delete next[segment.id];
                        return next;
                      });
                    }}
                    className="field-surface h-12 w-full rounded-xl px-3 text-right text-sm font-semibold text-[var(--foreground)] outline-none transition-all focus:ring-2 focus:ring-[var(--action)]/40"
                    aria-label={`Durata tratta ${index + 1} in secondi`}
                  />
                </label>
              </div>
            )}
          </Reorder.Item>
        );
      })}
    </Reorder.Group>
  );
}

function getSidebarStopTransition(
  stopIndex: number,
  stopCount: number,
  routeFrame: ReturnType<typeof getRouteCameraFrame>,
  themeColors: { stop: string; finalStop: string }
) {
  const inactiveColor = themeColors.stop;
  const currentColor = themeColors.finalStop;
  const segmentCount = Math.max(0, stopCount - 1);

  if (segmentCount === 0) {
    return { color: currentColor, scale: 1, isCurrent: true, isChanging: false };
  }

  if (!routeFrame) {
    return {
      color: stopIndex === 0 ? currentColor : inactiveColor,
      scale: 1,
      isCurrent: stopIndex === 0,
      isChanging: false,
    };
  }

  const completedStopIndex = routeFrame.completedStopIndex;
  const transitionIndex = routeFrame.completedStopTransitionIndex;
  const transitionProgress = routeFrame.completedStopTransitionProgress ?? 1;

  if (transitionIndex !== undefined) {
    if (stopIndex === completedStopIndex && stopIndex !== transitionIndex) {
      return getSmoothStopSwapTransition(transitionProgress, currentColor, inactiveColor);
    }

    if (stopIndex === transitionIndex) {
      return getSmoothStopSwapTransition(transitionProgress, inactiveColor, currentColor);
    }
  }

  if (stopIndex === completedStopIndex) {
    return { color: currentColor, scale: 1, isCurrent: true, isChanging: false };
  }

  return { color: inactiveColor, scale: 1, isCurrent: false, isChanging: false };
}

function getSmoothStopSwapTransition(progress: number, startColor: string, endColor: string) {
  const transitionProgress = clamp(progress, 0, 1);

  if (transitionProgress <= 0) {
    return { color: startColor, scale: 1, isCurrent: startColor === endColor, isChanging: false };
  }

  const scale = transitionProgress < 0.5
    ? 1 - easeOutCubic(transitionProgress / 0.5) * 0.72
    : 0.28 + easeOutBack((transitionProgress - 0.5) / 0.5) * 0.72;

  return {
    color: transitionProgress < 0.5 ? startColor : endColor,
    scale,
    isCurrent: true,
    isChanging: transitionProgress < 1,
  };
}
