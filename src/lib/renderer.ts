import * as d3 from 'd3';
import { DistanceSettingsState, Language, Stop, Segment, TransportMode, Theme, RouteLineStyle } from '@/types';
import { getVehicleIcon } from './icons';
import { getStopThemeColors } from './theme-colors';
import { getStopLocationKey } from './route-stops';
import { getStopName } from './stop-display';
import { drawDistanceOverlay } from './rendering/distance-overlay';
import { getCssColor } from './rendering/canvas-utils';
import { clamp, easeOutBack, easeOutCubic } from './utils/math';

export interface RenderOptions {
  width: number;
  height: number;
  progress: number;
  stops: Stop[];
  segments: Segment[];
  worldData: d3.GeoPermissibleObjects;
  projection: d3.GeoProjection;
  pathGenerator: d3.GeoPath;
  vehicleSize: number;
  pathScale?: number;
  pathStyle?: RouteLineStyle;
  stopScale?: number;
  overlayScale?: number;
  vehicleOpacity?: number;
  vehicleScale?: number;
  completedStopIndex?: number;
  completedStopTransitionIndex?: number;
  completedStopTransitionProgress?: number;
  pulseSegmentIndex?: number;
  pulseSegmentProgress?: number;
  vehicleColor: string;
  pathColor: string;
  landColor: string;
  oceanColor: string;
  theme: Theme;
  effectScale?: number;
  distanceSettings: DistanceSettingsState;
  language: Language;
}

export function drawGlobeContent(ctx: CanvasRenderingContext2D, options: RenderOptions) {
  const { 
    width, height, progress, stops, segments, worldData, 
    projection, pathGenerator, vehicleSize, pathScale = 1, pathStyle = 'dashed', stopScale = 1, overlayScale = 1, vehicleOpacity = 1, vehicleScale = 1, 
    completedStopIndex, completedStopTransitionIndex, completedStopTransitionProgress = 1, pulseSegmentIndex, pulseSegmentProgress, vehicleColor, pathColor, 
    landColor, oceanColor, theme, effectScale = 1, distanceSettings, language
  } = options;

  // Determiniamo se siamo in un contesto scuro
  const isDark = theme === 'dark';

  // Colori basati sul tema e sulle selezioni utente
  const colors = {
    ocean: oceanColor,
    land: landColor,
    border: getCssColor(isDark ? '--globe-border-dark' : '--globe-border-light', isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)'),
    path: pathColor,
    text: getCssColor(isDark ? '--globe-label-dark' : '--globe-label-light', isDark ? '#ffffff' : '#000000'),
    textShadow: getCssColor(isDark ? '--globe-label-shadow-dark' : '--globe-label-shadow-light', isDark ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.9)'),
  };

  // 0. Clear properly
  ctx.clearRect(0, 0, width, height);

  // 1. Ocean
  ctx.beginPath();
  ctx.arc(width / 2, height / 2, projection.scale(), 0, 2 * Math.PI);
  ctx.fillStyle = colors.ocean;
  ctx.fill();

  // 2. Countries
  ctx.beginPath();
  pathGenerator.context(ctx)(worldData);
  ctx.fillStyle = colors.land;
  ctx.fill();
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = Math.max(0.6, 0.38 * Math.max(pathScale, stopScale));
  ctx.stroke();

  // 3. Paths with Deep Shadow
  if (stops.length > 1) {
    ctx.save();
    ctx.shadowColor = getCssColor('--route-shadow', 'rgba(0,0,0,0.4)');
    ctx.shadowBlur = 6 * effectScale;
    ctx.shadowOffsetY = 3 * effectScale;
    ctx.lineCap = 'butt';

    ctx.strokeStyle = colors.path;
    ctx.lineWidth = 2.5 * pathScale;
    const drawnRouteSegments = new Set<string>();
    for (let i = 0; i < stops.length - 1; i++) {
      const segProg = clamp(progress * (stops.length - 1) - i, 0, 1);
      if (segProg <= 0) continue;
      const start = stops[i].coordinates;
      const end = stops[i + 1].coordinates;
      const routeSegmentKey = getRouteSegmentKey(start, end);
      if (drawnRouteSegments.has(routeSegmentKey)) continue;

      drawnRouteSegments.add(routeSegmentKey);
      drawProjectedRouteLine(ctx, projection, start, end, segProg, pathScale, pathStyle);
    }
    ctx.restore();
  }

  // 4. Stops & Labels
  const segmentCount = Math.max(0, stops.length - 1);
  const activeSegmentIndex = segmentCount > 0
    ? Math.min(Math.floor(clamp(progress, 0, 0.999999) * segmentCount), segmentCount - 1)
    : 0;
  const markerStops = getUniqueStopMarkers(stops);
  markerStops.forEach(({ stop, stopIndexes }) => {
    const coords = projection(stop.coordinates);
    if (!coords) return;
    if (!isVisibleOnProjection(stop.coordinates, projection)) return;

    const stopTransition = getMergedStopColorTransition(
      stopIndexes,
      activeSegmentIndex,
      segmentCount,
      theme,
      completedStopIndex,
      completedStopTransitionIndex,
      completedStopTransitionProgress
    );
    const stopColor = stopTransition.color;
    const pulsePhase = getRoutePulsePhase(
      pulseSegmentIndex ?? activeSegmentIndex,
      pulseSegmentProgress ?? getRouteSegmentProgress(progress, segmentCount),
      segments
    );
    const baseRadius = 5 * stopScale;
    const pulseScale = stopTransition.isChanging ? Math.min(stopTransition.scale, 1) : stopTransition.scale;
    const pulseRadius = (8 + pulsePhase * 7) * pulseScale * stopScale;
    const pulseAlpha = '34';

    ctx.beginPath();
    ctx.arc(coords[0], coords[1], pulseRadius, 0, 2 * Math.PI);
    ctx.fillStyle = `${stopColor}${pulseAlpha}`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(coords[0], coords[1], baseRadius * stopTransition.scale, 0, 2 * Math.PI);
    ctx.fillStyle = stopColor;
    ctx.fill();
    ctx.strokeStyle = getCssColor(isDark ? '--stop-stroke-dark' : '--stop-stroke-light', isDark ? '#ffffff' : '#0f172a');
    ctx.lineWidth = 2 * stopScale;
    ctx.stroke();

    ctx.font = `bold ${12 * stopScale}px Inter, sans-serif`;
    ctx.fillStyle = colors.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = colors.textShadow;
    ctx.shadowBlur = 4 * stopScale;
    ctx.fillText(getStopName(stop, language), coords[0], coords[1] + 10 * stopScale);
    ctx.shadowBlur = 0; 
  });

  // 5. Vehicle with Dynamic Perspective Shadow
  if (stops.length > 1 && vehicleOpacity > 0.01) {
    const currentPos = getCurrentPosition(stops, progress);
    if (currentPos) {
      const coords = projection(currentPos);
      if (coords) {
        if (isVisibleOnProjection(currentPos, projection)) {
          const segmentCount = stops.length - 1;
          const scaledProgress = clamp(progress, 0, 1) * segmentCount;
          const currentSegmentIndex = Math.min(Math.floor(scaledProgress), segmentCount - 1);
          const currentSegmentProgress = scaledProgress - currentSegmentIndex;
          const mode = segments[currentSegmentIndex]?.transportMode || 'plane';
          
          const delta = 0.002;
          const pos1 = getSegmentPosition(stops, currentSegmentIndex, Math.max(0, currentSegmentProgress - delta));
          const pos2 = getSegmentPosition(stops, currentSegmentIndex, Math.min(1, currentSegmentProgress + delta));
          
          let heading = 0;
          if (pos1 && pos2) {
            const c1 = projection(pos1);
            const c2 = projection(pos2);
            if (c1 && c2 && (Math.abs(c1[0] - c2[0]) > 0.01 || Math.abs(c1[1] - c2[1]) > 0.01)) {
              heading = Math.atan2(c2[1] - c1[1], c2[0] - c1[0]);
            }
          }

          drawVehicle(ctx, coords[0], coords[1], heading, mode, vehicleSize * vehicleScale, vehicleColor, vehicleOpacity, effectScale);
        }
      }
    }
  }

  // 6. Horizon Glow - Improved Atmosphere
  const gradient = ctx.createRadialGradient(width/2, height/2, projection.scale() * 0.8, width/2, height/2, projection.scale());
  gradient.addColorStop(0, getCssColor('--horizon-start', 'rgba(0,0,0,0)'));
  gradient.addColorStop(1, getCssColor(isDark ? '--horizon-dark' : '--horizon-light', isDark ? 'rgba(0,0,0,0.5)' : 'rgba(14,116,144,0.14)'));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(width/2, height/2, projection.scale(), 0, 2 * Math.PI);
  ctx.fill();

  drawDistanceOverlay(ctx, {
    width,
    height,
    progress,
    stops,
    distanceSettings,
    language,
    theme,
    visualScale: overlayScale * distanceSettings.scale,
    effectScale,
  });
}

function getUniqueStopMarkers(stops: Stop[]) {
  const markers = new Map<string, { stop: Stop; stopIndexes: number[] }>();

  stops.forEach((stop, index) => {
    const key = getStopLocationKey(stop);
    const existingMarker = markers.get(key);

    if (existingMarker) {
      existingMarker.stopIndexes.push(index);
      return;
    }

    markers.set(key, { stop, stopIndexes: [index] });
  });

  return Array.from(markers.values());
}

function getRouteSegmentKey(start: [number, number], end: [number, number]) {
  const endpoints = [
    getCoordinateKey(start),
    getCoordinateKey(end),
  ].sort();

  return endpoints.join('>');
}

function getCoordinateKey(coordinates: [number, number]) {
  return coordinates.map((coordinate) => coordinate.toFixed(5)).join(',');
}

function getCurrentPosition(stops: Stop[], progress: number): [number, number] | null {
  if (!stops || stops.length === 0) return null;
  if (stops.length === 1) return stops[0].coordinates;
  const segmentCount = stops.length - 1;
  const scaledProgress = clamp(progress, 0, 1) * segmentCount;
  const segmentIndex = Math.min(Math.floor(scaledProgress), segmentCount - 1);
  const segmentProgress = scaledProgress - segmentIndex;
  const stop1 = stops[segmentIndex];
  const stop2 = stops[segmentIndex + 1];
  if (!stop1 || !stop2) return stops[0].coordinates;
  return d3.geoInterpolate(stop1.coordinates, stop2.coordinates)(segmentProgress) as [number, number];
}

function getRouteSegmentProgress(progress: number, segmentCount: number) {
  if (segmentCount < 1) return 1;

  const scaledProgress = clamp(progress, 0, 1) * segmentCount;

  return progress >= 1 ? 1 : scaledProgress - Math.floor(Math.min(scaledProgress, segmentCount - 0.000001));
}

function getRoutePulsePhase(segmentIndex: number, segmentProgress: number, segments: Segment[]) {
  const durationSeconds = Math.max(0.1, segments[segmentIndex]?.durationSeconds ?? 5);
  const pulseCount = getEvenPulseCount(durationSeconds);

  return (Math.cos(Math.PI * 2 * clamp(segmentProgress, 0, 1) * pulseCount) + 1) / 2;
}

function getEvenPulseCount(durationSeconds: number) {
  return Math.max(2, Math.round(durationSeconds / 2.5 / 2) * 2);
}

function getSegmentPosition(stops: Stop[], segmentIndex: number, segmentProgress: number): [number, number] | null {
  const stop1 = stops[segmentIndex];
  const stop2 = stops[segmentIndex + 1];
  if (!stop1 || !stop2) return null;

  return d3.geoInterpolate(stop1.coordinates, stop2.coordinates)(
    clamp(segmentProgress, 0, 1)
  ) as [number, number];
}

function drawProjectedRouteLine(
  ctx: CanvasRenderingContext2D,
  projection: d3.GeoProjection,
  start: [number, number],
  end: [number, number],
  progress: number,
  visualScale: number,
  style: RouteLineStyle
) {
  const interpolate = d3.geoInterpolate(start, end);
  const clampedProgress = clamp(progress, 0, 1);
  const totalDistance = d3.geoDistance(start, end);
  const sampleCount = Math.max(24, Math.ceil(totalDistance * projection.scale() / (10 * visualScale)));

  if (totalDistance === 0) return;

  if (style === 'solid') {
    ctx.setLineDash([]);
  } else {
    ctx.lineCap = 'butt';
    ctx.setLineDash([8 * visualScale, 6 * visualScale]);
  }
  ctx.lineDashOffset = 0;
  ctx.beginPath();
  drawProjectedLinePath(ctx, projection, interpolate, clampedProgress, sampleCount);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawProjectedLinePath(
  ctx: CanvasRenderingContext2D,
  projection: d3.GeoProjection,
  interpolate: (t: number) => [number, number],
  progress: number,
  sampleCount: number
) {
  let isDrawing = false;

  for (let i = 0; i <= sampleCount; i++) {
    const t = progress * (i / sampleCount);
    const coordinates = interpolate(t) as [number, number];
    const point = projection(coordinates);
    const visible = point && isVisibleOnProjection(coordinates, projection);

    if (!visible || !point) {
      isDrawing = false;
      continue;
    }

    if (!isDrawing) {
      ctx.moveTo(point[0], point[1]);
      isDrawing = true;
    } else {
      ctx.lineTo(point[0], point[1]);
    }
  }
}

function isVisibleOnProjection(coordinates: [number, number], projection: d3.GeoProjection) {
  const rotation = projection.rotate();
  const lambda = degreesToRadians(coordinates[0] + rotation[0]);
  const phi = degreesToRadians(coordinates[1]);
  const centerPhi = degreesToRadians(-rotation[1]);
  const dot = Math.cos(phi) * Math.cos(centerPhi) * Math.cos(lambda) + Math.sin(phi) * Math.sin(centerPhi);

  return dot > 0;
}

function degreesToRadians(degrees: number) {
  return degrees * 0.017453292519943295;
}

function getStopColorTransition(
  stopIndex: number,
  activeSegmentIndex: number,
  segmentCount: number,
  theme: Theme,
  completedStopIndex = activeSegmentIndex,
  completedStopTransitionIndex?: number,
  completedStopTransitionProgress = 1
) {
  const themeColors = getStopThemeColors(theme);
  const inactiveColor = themeColors.stop;
  const currentColor = themeColors.finalStop;

  if (segmentCount === 0) {
    return { color: inactiveColor, scale: 1, isChanging: false };
  }

  if (completedStopTransitionIndex !== undefined) {
    if (stopIndex === completedStopIndex && stopIndex !== completedStopTransitionIndex) {
      return getStopColorSwapTransition(completedStopTransitionProgress, currentColor, inactiveColor);
    }

    if (stopIndex === completedStopTransitionIndex) {
      return getStopColorSwapTransition(completedStopTransitionProgress, inactiveColor, currentColor);
    }
  }

  if (stopIndex === completedStopIndex) {
    return { color: currentColor, scale: 1, isChanging: false };
  }

  return { color: inactiveColor, scale: 1, isChanging: false };
}

function getMergedStopColorTransition(
  stopIndexes: number[],
  activeSegmentIndex: number,
  segmentCount: number,
  theme: Theme,
  completedStopIndex = activeSegmentIndex,
  completedStopTransitionIndex?: number,
  completedStopTransitionProgress = 1
) {
  const themeColors = getStopThemeColors(theme);
  const currentColor = themeColors.finalStop.toLowerCase();
  const transitions = stopIndexes.map((stopIndex) =>
    getStopColorTransition(
      stopIndex,
      activeSegmentIndex,
      segmentCount,
      theme,
      completedStopIndex,
      completedStopTransitionIndex,
      completedStopTransitionProgress
    )
  );
  const changingTransition = transitions.find((transition) => transition.isChanging);
  const currentTransition = transitions.find((transition) => transition.color.toLowerCase() === currentColor);
  const scale = changingTransition
    ? changingTransition.scale
    : 1;

  return {
    color: changingTransition?.color || currentTransition?.color || themeColors.stop,
    scale,
    isChanging: Boolean(changingTransition),
  };
}

function getStopColorSwapTransition(segmentProgress: number, startColor: string, endColor: string) {
  const transitionProgress = clamp(segmentProgress, 0, 1);

  if (transitionProgress <= 0) {
    return { color: startColor, scale: 1, isChanging: false };
  }

  const scale = transitionProgress < 0.5
    ? 1 - easeOutCubic(transitionProgress / 0.5) * 0.72
    : 0.28 + easeOutBack((transitionProgress - 0.5) / 0.5) * 0.72;

  return {
    color: transitionProgress < 0.5 ? startColor : endColor,
    scale,
    isChanging: transitionProgress < 1,
  };
}

function drawVehicle(ctx: CanvasRenderingContext2D, x: number, y: number, rotation: number, mode: TransportMode, size: number, color: string, opacity = 1, effectScale = 1) {
  const icon = getVehicleIcon(mode, color);
  if (!icon) return; 
  
  const iconSize = 44 * size; 
  const { rotation: uprightRotation, flipX } = getUprightVehicleTransform(rotation);

  // 1. Ombra
  ctx.save();
  ctx.translate(x + 5 * effectScale, y + 5 * effectScale); 
  ctx.rotate(uprightRotation);
  ctx.scale(flipX ? -1 : 1, 1);
  ctx.translate(-iconSize / 2, -iconSize / 2);
  ctx.globalAlpha = 0.2 * opacity;
  ctx.filter = `blur(${3 * effectScale}px) brightness(0)`;
  ctx.drawImage(icon, 0, 0, iconSize, iconSize);
  ctx.restore();

  // 2. Veicolo
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(uprightRotation);
  ctx.scale(flipX ? -1 : 1, 1);
  ctx.translate(-iconSize / 2, -iconSize / 2);
  ctx.globalAlpha = opacity;
  
  // Disegna l'icona (che è già stata colorata e orientata in icons.ts)
  ctx.drawImage(icon, 0, 0, iconSize, iconSize);
  
  ctx.restore();
}

function getUprightVehicleTransform(rotation: number) {
  const flipX = rotation > Math.PI / 2 || rotation < -Math.PI / 2;
  const uprightRotation = flipX ? normalizeRadians(rotation - Math.PI) : rotation;

  return { rotation: uprightRotation, flipX };
}

function normalizeRadians(angle: number) {
  let normalized = angle;

  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }

  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  return normalized;
}