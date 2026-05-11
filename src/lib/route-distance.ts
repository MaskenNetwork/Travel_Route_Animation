import * as d3 from 'd3';
import { DistanceUnit, Language, Stop } from '@/types';
import { clamp } from '@/lib/utils/math';

const EARTH_RADIUS_KM = 6371;
const KM_TO_MI = 0.621371;

export interface CurrentDistanceFrame {
  totalDistance: number;
  unit: DistanceUnit;
}

export function getSegmentDistancesKm(stops: Stop[]) {
  return stops.slice(0, -1).map((stop, index) => {
    const nextStop = stops[index + 1];

    return d3.geoDistance(stop.coordinates, nextStop.coordinates) * EARTH_RADIUS_KM;
  });
}

export function getCurrentDistanceFrame({
  stops,
  progress,
  unit,
}: {
  stops: Stop[];
  progress: number;
  unit: DistanceUnit;
}): CurrentDistanceFrame | null {
  const segmentCount = Math.max(0, stops.length - 1);
  if (segmentCount < 1) return null;

  const distancesKm = getSegmentDistancesKm(stops);
  const clampedProgress = clamp(progress, 0, 1);
  const scaledProgress = clampedProgress * segmentCount;
  const activeSegmentIndex = Math.min(Math.floor(Math.min(scaledProgress, segmentCount - 0.000001)), segmentCount - 1);
  const activeSegmentProgress = clampedProgress >= 1 ? 1 : scaledProgress - activeSegmentIndex;
  const completedDistanceKm = distancesKm
    .slice(0, activeSegmentIndex)
    .reduce((total, distance) => total + distance, 0);
  const currentLegDistanceKm = distancesKm[activeSegmentIndex] || 0;
  const legDistanceKm = currentLegDistanceKm * clamp(activeSegmentProgress, 0, 1);
  const totalDistanceKm = completedDistanceKm + legDistanceKm;

  return {
    totalDistance: convertDistanceFromKm(totalDistanceKm, unit),
    unit,
  };
}

export function formatDistanceValue(value: number, language: Language) {
  return new Intl.NumberFormat(language === 'it' ? 'it-IT' : 'en-US', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function convertDistanceFromKm(distanceKm: number, unit: DistanceUnit) {
  return unit === 'mi' ? distanceKm * KM_TO_MI : distanceKm;
}
