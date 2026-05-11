import * as d3 from 'd3';
import { DistanceSettingsState, Language, Stop, Segment, TransportMode, Theme, RouteLineStyle } from '@/types';
import { getVehicleIcon } from './icons';
import { getStopThemeColors } from './theme-colors';
import { getCurrentDistanceFrame, getSegmentDistancesKm } from './route-distance';
import { getStopLocationKey } from './route-stops';
import { clamp, easeOutBack, easeOutCubic, lerp } from './utils/math';

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
      const segProg = Math.min(1, Math.max(0, progress * (stops.length - 1) - i));
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
    ? Math.min(Math.floor(Math.max(0, Math.min(0.999999, progress)) * segmentCount), segmentCount - 1)
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
    ctx.fillText(stop.name, coords[0], coords[1] + 10 * stopScale);
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
          const scaledProgress = Math.max(0, Math.min(1, progress)) * segmentCount;
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
  const scaledProgress = Math.max(0, Math.min(1, progress)) * segmentCount;
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

function drawDistanceOverlay(
  ctx: CanvasRenderingContext2D,
  {
    width,
    height,
    progress,
    stops,
    distanceSettings,
    language,
    theme,
    visualScale,
    effectScale,
  }: {
    width: number;
    height: number;
    progress: number;
    stops: Stop[];
    distanceSettings: DistanceSettingsState;
    language: Language;
    theme: Theme;
    visualScale: number;
    effectScale: number;
  }
) {
  if (!distanceSettings.isVisible) return;

  const frame = getCurrentDistanceFrame({
    stops,
    progress,
    unit: distanceSettings.unit,
  }) ?? { totalDistance: 0, unit: distanceSettings.unit };

  const isDark = theme === 'dark';
  const label = language === 'it' ? 'TOTALE' : 'TOTAL';
  const cappedDistance = Math.min(Math.max(0, frame.totalDistance), DISTANCE_ODOMETER_MAX_VALUE);
  const odometerState = getDistanceOdometerState({
    stops,
    progress,
    unit: distanceSettings.unit,
  });
  const baseScale = Math.max(0.3, visualScale * 0.86);
  const maxPanelWidth = Math.max(0, width - DISTANCE_PANEL_EDGE_GAP * 2);
  const unscaledPanelWidth = getDistancePanelWidth(1);
  const scale = Math.min(baseScale, maxPanelWidth / unscaledPanelWidth);
  const paddingX = DISTANCE_PANEL_PADDING_X * scale;
  const panelHeight = DISTANCE_PANEL_HEIGHT * scale;
  const labelWidth = DISTANCE_LABEL_WIDTH * scale;
  const digitBoxWidth = Math.round(DISTANCE_DIGIT_BOX_WIDTH * scale);
  const digitBoxHeight = Math.round(DISTANCE_DIGIT_BOX_HEIGHT * scale);
  const digitGap = Math.round(DISTANCE_DIGIT_GAP * scale);
  const unitWidth = DISTANCE_UNIT_WIDTH * scale;
  const odometerWidth = DISTANCE_ODOMETER_DIGITS * digitBoxWidth + (DISTANCE_ODOMETER_DIGITS - 1) * digitGap;
  const contentWidth = labelWidth + 12 * scale + odometerWidth + 8 * scale + unitWidth;
  const panelWidth = contentWidth + paddingX * 2;
  const x = (width - panelWidth) / 2;
  const bottomMargin = Math.max(70 * effectScale, height * 0.14);
  const y = height - bottomMargin - panelHeight;
  const radius = 13 * scale;

  ctx.save();
  drawRoundedRect(ctx, x, y, panelWidth, panelHeight, radius);
  ctx.fillStyle = getCssColor(isDark ? '--distance-panel-dark' : '--distance-panel-light', isDark ? 'rgba(5, 12, 24, 0.78)' : 'rgba(255, 255, 255, 0.84)');
  ctx.fill();
  ctx.strokeStyle = getCssColor(isDark ? '--distance-border-dark' : '--distance-border-light', isDark ? 'rgba(255,255,255,0.18)' : 'rgba(15,23,42,0.14)');
  ctx.lineWidth = Math.max(1, effectScale);
  ctx.stroke();

  const centerY = y + panelHeight / 2;
  ctx.font = `800 ${DISTANCE_LABEL_FONT_SIZE * scale}px Inter, Arial, sans-serif`;
  ctx.fillStyle = getCssColor(isDark ? '--distance-label-dark' : '--distance-label-light', isDark ? 'rgba(255,255,255,0.58)' : 'rgba(15,23,42,0.52)');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + paddingX, centerY);

  const odometerX = Math.round(x + paddingX + labelWidth + 12 * scale);
  const odometerY = centerY - digitBoxHeight / 2;
  drawOdometerDigits(ctx, {
    startValue: odometerState?.startValue ?? cappedDistance,
    endValue: odometerState?.endValue ?? cappedDistance,
    progress: odometerState?.progress ?? 1,
    x: odometerX,
    y: odometerY,
    digitBoxWidth,
    digitBoxHeight,
    digitGap,
    scale,
    isDark,
  });

  ctx.font = `800 ${DISTANCE_UNIT_FONT_SIZE * scale}px Inter, Arial, sans-serif`;
  ctx.fillStyle = getCssColor(isDark ? '--distance-unit-dark' : '--distance-unit-light', isDark ? 'rgba(255,255,255,0.72)' : 'rgba(15,23,42,0.62)');
  ctx.textAlign = 'left';
  ctx.fillText(frame.unit, odometerX + odometerWidth + 8 * scale, centerY);

  ctx.restore();
}

// Tweak these values to adjust the distance overlay without touching layout logic.
const DISTANCE_ODOMETER_MAX_VALUE = 999_999;
const DISTANCE_ODOMETER_DIGITS = 6;
const DISTANCE_LABEL_FONT_SIZE = 11;
const DISTANCE_UNIT_FONT_SIZE = DISTANCE_LABEL_FONT_SIZE;
const DISTANCE_DIGIT_FONT_SIZE = 17;
const DISTANCE_PANEL_PADDING_X = 12;
const DISTANCE_PANEL_HEIGHT = 42;
const DISTANCE_LABEL_WIDTH = 54;
const DISTANCE_UNIT_WIDTH = 24;
const DISTANCE_DIGIT_BOX_WIDTH = 12;
const DISTANCE_DIGIT_BOX_HEIGHT = 23;
const DISTANCE_DIGIT_GAP = 2;
const DISTANCE_PANEL_EDGE_GAP = 16;

function getDistancePanelWidth(scale: number) {
  const digitBoxWidth = Math.round(DISTANCE_DIGIT_BOX_WIDTH * scale);
  const digitGap = Math.round(DISTANCE_DIGIT_GAP * scale);
  const odometerWidth = DISTANCE_ODOMETER_DIGITS * digitBoxWidth + (DISTANCE_ODOMETER_DIGITS - 1) * digitGap;
  const contentWidth = DISTANCE_LABEL_WIDTH * scale + 12 * scale + odometerWidth + 8 * scale + DISTANCE_UNIT_WIDTH * scale;

  return contentWidth + DISTANCE_PANEL_PADDING_X * scale * 2;
}

function drawOdometerDigits(
  ctx: CanvasRenderingContext2D,
  {
    startValue,
    endValue,
    progress,
    x,
    y,
    digitBoxWidth,
    digitBoxHeight,
    digitGap,
    scale,
    isDark,
  }: {
    startValue: number;
    endValue: number;
    progress: number;
    x: number;
    y: number;
    digitBoxWidth: number;
    digitBoxHeight: number;
    digitGap: number;
    scale: number;
    isDark: boolean;
  }
) {
  ctx.save();
  ctx.font = `800 ${DISTANCE_DIGIT_FONT_SIZE * scale}px Inter, Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const digitBaselineOffset = getTextMiddleBaselineOffset(ctx);
  const clampedProgress = clamp(progress, 0, 1);
  const snappedProgress = clampedProgress >= 0.999999 ? 1 : clampedProgress;
  const cappedStartValue = clamp(Math.round(startValue), 0, DISTANCE_ODOMETER_MAX_VALUE);
  const cappedEndValue = clamp(Math.round(endValue), 0, DISTANCE_ODOMETER_MAX_VALUE);
  const displayedValue = Math.round(lerp(cappedStartValue, cappedEndValue, snappedProgress));
  const firstVisibleStartIndex = getFirstVisibleOdometerIndex(cappedStartValue);
  const firstVisibleIndex = getFirstVisibleOdometerIndex(displayedValue);

  for (let index = 0; index < DISTANCE_ODOMETER_DIGITS; index++) {
    const place = Math.pow(10, DISTANCE_ODOMETER_DIGITS - index - 1);
    const startWheelPosition = Math.floor(cappedStartValue / place);
    const endWheelPosition = Math.floor(cappedEndValue / place);
    const wheelPosition = lerp(startWheelPosition, endWheelPosition, snappedProgress);
    const snappedWheelPosition = snappedProgress === 1 ? endWheelPosition : wheelPosition;
    const baseWheelPosition = Math.floor(snappedWheelPosition);
    const rollProgress = snappedProgress === 1 ? 0 : snappedWheelPosition - baseWheelPosition;
    const currentDigit = baseWheelPosition % 10;
    const nextDigit = (currentDigit + 1) % 10;
    const shouldRoll = rollProgress > 0.000001;
    const isEnteringDigit = index < firstVisibleStartIndex && startWheelPosition === 0 && endWheelPosition > 0;
    const isFirstEnteringTurn = isEnteringDigit && snappedWheelPosition > 0 && snappedWheelPosition < 1;
    const isVisible = index >= firstVisibleIndex || (isEnteringDigit && snappedWheelPosition > 0);
    const digitX = x + index * (digitBoxWidth + digitGap);
    const digitCenterX = digitX + digitBoxWidth / 2;
    const digitCenterY = y + digitBoxHeight / 2;
    const digitBaselineY = digitCenterY + digitBaselineOffset;

    drawRoundedRect(ctx, digitX, y, digitBoxWidth, digitBoxHeight, 4 * scale);
    ctx.fillStyle = getCssColor(isDark ? '--distance-digit-box-dark' : '--distance-digit-box-light', isDark ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)');
    ctx.fill();
    ctx.strokeStyle = getCssColor(isDark ? '--distance-digit-border-dark' : '--distance-digit-border-light', isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.10)');
    ctx.lineWidth = Math.max(0.6, 0.8 * scale);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(digitX, y, digitBoxWidth, digitBoxHeight);
    ctx.clip();
    ctx.fillStyle = getCssColor(isDark ? '--distance-digit-dark' : '--distance-digit-light', isDark ? '#ffffff' : '#0f172a');
    if (isVisible) {
      if (isFirstEnteringTurn && currentDigit === 0) {
        if (shouldRoll) {
          ctx.fillText(String(nextDigit), digitCenterX, digitBaselineY - (1 - rollProgress) * digitBoxHeight);
        }
      } else if (shouldRoll) {
        ctx.fillText(String(currentDigit), digitCenterX, digitBaselineY + rollProgress * digitBoxHeight);
        ctx.fillText(String(nextDigit), digitCenterX, digitBaselineY - (1 - rollProgress) * digitBoxHeight);
      } else {
        ctx.fillText(String(currentDigit), digitCenterX, digitBaselineY);
      }
    }
    ctx.restore();
  }

  ctx.restore();
}

function getDistanceOdometerState({
  stops,
  progress,
  unit,
}: {
  stops: Stop[];
  progress: number;
  unit: DistanceSettingsState['unit'];
}) {
  const segmentCount = Math.max(0, stops.length - 1);
  if (segmentCount < 1) return null;

  const distances = getSegmentDistancesKm(stops).map((distanceKm) => convertDistanceFromKm(distanceKm, unit));
  const scaledProgress = clamp(progress, 0, 1) * segmentCount;
  const segmentIndex = Math.min(Math.floor(Math.min(scaledProgress, segmentCount - 0.000001)), segmentCount - 1);
  const segmentProgress = progress >= 1 ? 1 : scaledProgress - segmentIndex;
  const startValue = distances
    .slice(0, segmentIndex)
    .reduce((total, distance) => total + distance, 0);
  const endValue = startValue + (distances[segmentIndex] || 0);

  return {
    startValue: Math.min(Math.max(0, startValue), DISTANCE_ODOMETER_MAX_VALUE),
    endValue: Math.min(Math.max(0, endValue), DISTANCE_ODOMETER_MAX_VALUE),
    progress: clamp(segmentProgress, 0, 1),
  };
}

function convertDistanceFromKm(distanceKm: number, unit: DistanceSettingsState['unit']) {
  return unit === 'mi' ? distanceKm * 0.621371 : distanceKm;
}

function getFirstVisibleOdometerIndex(value: number) {
  if (value <= 0) return DISTANCE_ODOMETER_DIGITS - 1;

  const digitCount = Math.min(DISTANCE_ODOMETER_DIGITS, Math.floor(Math.log10(value)) + 1);

  return DISTANCE_ODOMETER_DIGITS - digitCount;
}

function getTextMiddleBaselineOffset(ctx: CanvasRenderingContext2D) {
  const metrics = ctx.measureText('8');

  return (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const safeRadius = Math.min(radius, width / 2, height / 2);

  ctx.beginPath();
  ctx.moveTo(x + safeRadius, y);
  ctx.lineTo(x + width - safeRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  ctx.lineTo(x + width, y + height - safeRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  ctx.lineTo(x + safeRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  ctx.lineTo(x, y + safeRadius);
  ctx.quadraticCurveTo(x, y, x + safeRadius, y);
  ctx.closePath();
}

function getSegmentPosition(stops: Stop[], segmentIndex: number, segmentProgress: number): [number, number] | null {
  const stop1 = stops[segmentIndex];
  const stop2 = stops[segmentIndex + 1];
  if (!stop1 || !stop2) return null;

  return d3.geoInterpolate(stop1.coordinates, stop2.coordinates)(
    Math.max(0, Math.min(1, segmentProgress))
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
  const clampedProgress = Math.max(0, Math.min(1, progress));
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

function getCssColor(name: string, fallback: string) {
  if (typeof document === 'undefined') return fallback;

  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
