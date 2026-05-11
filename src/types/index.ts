export type TransportMode = 
  | 'plane' 
  | 'ship' 
  | 'train' 
  | 'bus'
  | 'camper'
  | 'car' 
  | 'moto' 
  | 'bike' 
  | 'scooter';

export type Theme = 'light' | 'dark';
export type Language = 'it' | 'en';

export type ExportFormat = '16:9' | '9:16' | '1:1';
export type ExportResolution = '1080' | '1440' | '2160';
export type DistanceUnit = 'km' | 'mi';
export type RouteLineStyle = 'dashed' | 'solid';

export interface Stop {
  id: string;
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
  color: string;
}

export interface Segment {
  id: string;
  fromId: string;
  toId: string;
  transportMode: TransportMode;
  durationSeconds: number;
}

export interface ItineraryState {
  stops: Stop[];
  segments: Segment[];
}

export interface AnimationState {
  isPlaying: boolean;
  progress: number;
  speed: number;
  currentStopIndex: number;
  vehicleSize: number;
  pathSize: number;
  stopSize: number;
  pathStyle: RouteLineStyle;
  vehicleColor: string;
  pathColor: string;
  landColor: string;
  oceanColor: string;
  theme: Theme;
}

export interface ExportSettingsState {
  format: ExportFormat;
  resolution: ExportResolution;
  fps: number;
}

export interface DistanceSettingsState {
  isVisible: boolean;
  unit: DistanceUnit;
  scale: number;
}
