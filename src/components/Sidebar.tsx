'use client';

import React, { useState } from 'react';
import { Map, Settings2, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { getStopThemeColors } from '@/lib/theme-colors';
import StopSearch from '@/components/sidebar/StopSearch';
import StopsList from '@/components/sidebar/StopsList';
import RouteStylePanel from '@/components/sidebar/RouteStylePanel';
import { AlertMessage, IconButton, PanelHeader, SoftButton } from '@/components/ui/panel';
import { useI18n } from '@/lib/i18n';
import { hasConsecutiveDuplicateStops, isSameStopLocation } from '@/lib/route-stops';
import { useMeasuredActionGroup } from '@/components/useMeasuredActionGroup';
import { useAutoDismissedState } from '@/components/useAutoDismissedState';

type RouteWarningKey = 'consecutiveStopWarning';

export default function Sidebar({ onClose }: { onClose?: () => void }) {
  const {
    stops,
    segments,
    animation,
    distanceSettings,
    addStop,
    removeStop,
    updateSegment,
    reorderStops,
    setAnimation,
    setDistanceSettings,
    setTheme,
  } = useApp();
  const t = useI18n();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [routeWarning, setRouteWarning] = useAutoDismissedState<RouteWarningKey | null>(null);
  const { availableRef: routeSettingsRef, showLabels: showRouteSettingsLabel } = useMeasuredActionGroup({
    font: '600 14px Inter, sans-serif',
    groupGap: 0,
    iconWidths: [16],
    itemGap: 8,
    itemPaddingX: 16,
    labels: [t.routeSettings],
    layout: 'inline',
  });

  const handleAddStop = (result: { name: string; coordinates: [number, number] }) => {
    const nextStop = {
      id: crypto.randomUUID(),
      name: result.name,
      coordinates: result.coordinates,
      color: getStopThemeColors(animation.theme).stop,
    };

    if (isSameStopLocation(stops.at(-1), nextStop)) {
      setRouteWarning('consecutiveStopWarning');
      return;
    }

    setRouteWarning(null);
    addStop(nextStop);
  };

  const handleReorderStops = (newStops: typeof stops) => {
    if (hasConsecutiveDuplicateStops(newStops)) {
      setRouteWarning('consecutiveStopWarning');
      return false;
    }

    setRouteWarning(null);
    reorderStops(newStops);
    return true;
  };

  return (
    <div className="glass relative flex h-full min-h-0 flex-col overflow-hidden rounded-2xl p-4 text-[var(--foreground)] shadow-xl">
      <PanelHeader
        icon={<Map size={20} />}
        title={t.route}
        subtitle={`${stops.length} ${stops.length === 1 ? t.stop_one : t.stop_other}`}
        action={
          onClose ? (
            <IconButton onClick={onClose} aria-label={t.close}>
              <X size={19} />
            </IconButton>
          ) : undefined
        }
      />

      <StopSearch onSelect={handleAddStop} />

      {routeWarning && (
        <AlertMessage className="mb-4">
          {t[routeWarning]}
        </AlertMessage>
      )}

      <div className="min-h-0 flex-1">
        <StopsList
          stops={stops}
          segments={segments}
          theme={animation.theme}
          progress={animation.progress}
          onRemoveStop={removeStop}
          onReorderStops={handleReorderStops}
          onUpdateSegment={updateSegment}
        />
      </div>

      <div ref={routeSettingsRef as React.RefObject<HTMLDivElement>} className="mt-4 shrink-0 border-t border-[var(--panel-border)] pt-4">
        <SoftButton onClick={() => setIsSettingsOpen(true)}>
          <Settings2 size={16} className="shrink-0" />
          {showRouteSettingsLabel && <span className="whitespace-nowrap">{t.routeSettings}</span>}
        </SoftButton>
      </div>

      {isSettingsOpen && (
        <RouteStylePanel
          animation={animation}
          distanceSettings={distanceSettings}
          onClose={() => setIsSettingsOpen(false)}
          onSetAnimation={setAnimation}
          onSetDistanceSettings={setDistanceSettings}
          onSetTheme={setTheme}
        />
      )}
    </div>
  );
}
