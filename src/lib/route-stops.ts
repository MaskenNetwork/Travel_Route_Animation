import { Stop } from '@/types';

const COORDINATE_PRECISION = 5;

export function getStopLocationKey(stop: Pick<Stop, 'coordinates'>) {
  return stop.coordinates.map((coordinate) => coordinate.toFixed(COORDINATE_PRECISION)).join(',');
}

export function isSameStopLocation(
  first?: Pick<Stop, 'coordinates'> | null,
  second?: Pick<Stop, 'coordinates'> | null
) {
  if (!first || !second) return false;

  return getStopLocationKey(first) === getStopLocationKey(second);
}

export function hasConsecutiveDuplicateStops(stops: Pick<Stop, 'coordinates'>[]) {
  return stops.some((stop, index) => index > 0 && isSameStopLocation(stops[index - 1], stop));
}
