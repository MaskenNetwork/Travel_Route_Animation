import * as d3 from 'd3';
import { GeoPermissibleObjects } from 'd3';
import { AnimationState, DistanceSettingsState, Language, Segment, Stop } from '@/types';
import { getBaseGlobeScale, getRouteCameraFrame } from '@/lib/route-camera';
import { drawGlobeContent } from '@/lib/renderer';

interface RenderExportFrameOptions {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  progress: number;
  stops: Stop[];
  segments: Segment[];
  animation: AnimationState;
  distanceSettings: DistanceSettingsState;
  language: Language;
  worldData: GeoPermissibleObjects;
  visualScale?: number;
  effectScale?: number;
  cameraOverride?: {
    center: [number, number];
    scale: number;
  } | null;
}

export function renderExportFrame({
  ctx,
  width,
  height,
  progress,
  stops,
  segments,
  animation,
  distanceSettings,
  language,
  worldData,
  visualScale = 1,
  effectScale = 1,
  cameraOverride,
}: RenderExportFrameOptions) {
  const baseScale = getBaseGlobeScale(width, height);
  const cameraFrame = getRouteCameraFrame(stops, segments, progress, baseScale);
  const cameraCenter = cameraOverride?.center || cameraFrame?.center || stops[0]?.coordinates || [0, 0];
  const cameraScale = cameraOverride?.scale || cameraFrame?.scale || baseScale;

  const projection = d3.geoOrthographic()
    .scale(cameraScale)
    .translate([width / 2, height / 2])
    .clipAngle(90)
    .rotate([-cameraCenter[0], -cameraCenter[1]]);

  drawGlobeContent(ctx, {
    width,
    height,
    progress: cameraFrame ? cameraFrame.routeProgress : progress,
    stops,
    segments,
    worldData,
    projection,
    pathGenerator: d3.geoPath(projection),
    vehicleSize: animation.vehicleSize * visualScale,
    pathScale: animation.pathSize * visualScale,
    pathStyle: animation.pathStyle,
    stopScale: animation.stopSize * visualScale,
    overlayScale: visualScale,
    vehicleOpacity: cameraFrame?.vehicleOpacity,
    vehicleScale: cameraFrame?.vehicleScale,
    completedStopIndex: cameraFrame?.completedStopIndex,
    completedStopTransitionIndex: cameraFrame?.completedStopTransitionIndex,
    completedStopTransitionProgress: cameraFrame?.completedStopTransitionProgress,
    pulseSegmentIndex: cameraFrame?.pulseSegmentIndex,
    pulseSegmentProgress: cameraFrame?.pulseSegmentProgress,
    vehicleColor: animation.vehicleColor,
    pathColor: animation.pathColor,
    landColor: animation.landColor,
    oceanColor: animation.oceanColor,
    theme: animation.theme,
    effectScale,
    distanceSettings,
    language,
  });
}
