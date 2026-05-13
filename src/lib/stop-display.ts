import { Language, Stop } from '@/types';

export function getStopName(stop: Pick<Stop, 'name' | 'names'>, language: Language) {
  return stop.names?.[language] || stop.name;
}
