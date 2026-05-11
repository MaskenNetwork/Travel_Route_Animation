import { TransportMode } from '@/types';

export const transportOptions = [
  { id: 'plane', label: 'Aereo' },
  { id: 'ship', label: 'Nave' },
  { id: 'train', label: 'Treno' },
  { id: 'bus', label: 'Bus' },
  { id: 'camper', label: 'Camper' },
  { id: 'car', label: 'Auto' },
  { id: 'moto', label: 'Moto' },
  { id: 'bike', label: 'Bicicletta' },
  { id: 'scooter', label: 'Monopattino' },
] as const satisfies ReadonlyArray<{ id: TransportMode; label: string }>;

const transportModeIds = new Set<TransportMode>(transportOptions.map((option) => option.id));

export function isTransportMode(value: string): value is TransportMode {
  return transportModeIds.has(value as TransportMode);
}
