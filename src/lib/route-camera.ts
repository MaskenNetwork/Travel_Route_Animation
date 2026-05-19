import * as d3 from 'd3';
import { Segment, Stop } from '@/types';
import { clamp, lerp, smootherStep } from '@/lib/utils/math';

export interface RouteCameraFrame {
  routeProgress: number;
  center: [number, number];
  scale: number;
  vehicleOpacity: number;
  vehicleScale: number;
  completedStopIndex: number;
  completedStopTransitionIndex?: number;
  completedStopTransitionProgress?: number;
  pulseSegmentIndex?: number;
  pulseSegmentProgress?: number;
}

const ZOOM_PHASE = 0.4;
const DEPARTURE_FADE = 0.2;
const ARRIVAL_FADE = 0.2;
const EARTH_RADIUS_KM = 6371;
const MIN_ZOOM_DISTANCE_KM = 1;
const MIN_DISTANCE_ZOOM_MULTIPLIER = 2;
const MAX_DISTANCE_ZOOM_MULTIPLIER = 1000;
const MAX_ZOOM_DISTANCE_KM = 5000;
const DISTANCE_ZOOM_CURVE = 1.5;
const DEFAULT_SEGMENT_DURATION_SECONDS = 5;
const MIN_SEGMENT_DURATION_SECONDS = 0.1;
const STOP_TRANSITION_SECONDS = 0.8;
const FINAL_ZOOM_SECONDS = 3;

export function getBaseGlobeScale(width: number, height: number) {
  return Math.min(width, height) * 0.35;
}

export function getRouteAnimationDurationSeconds(stops: Stop[], segments: Segment[] = []) {
  const routeDurationSeconds = getRouteDurationSeconds(stops, segments);

  return routeDurationSeconds + FINAL_ZOOM_SECONDS;
}

export function getRouteCameraFrame(
  stops: Stop[],
  segments: Segment[],
  timelineProgress: number,
  baseScale: number
): RouteCameraFrame | null {
  if (!stops.length) return null;
  if (stops.length === 1) {
    return {
      routeProgress: 0,
      center: stops[0].coordinates,
      scale: baseScale,
      vehicleOpacity: 0,
      vehicleScale: 0.88,
      completedStopIndex: 0,
      pulseSegmentIndex: 0,
      pulseSegmentProgress: 0,
    };
  }

  const clampedProgress = clamp(timelineProgress, 0, 1);
  const segmentCount = stops.length - 1;
  const routeDurationSeconds = getRouteDurationSeconds(stops, segments);
  const finalZoomStartSeconds = routeDurationSeconds + STOP_TRANSITION_SECONDS;
  const totalDurationSeconds = finalZoomStartSeconds + FINAL_ZOOM_SECONDS;
  const elapsedSeconds = clampedProgress * totalDurationSeconds;

  if (elapsedSeconds >= routeDurationSeconds && elapsedSeconds < finalZoomStartSeconds) {
    const lastStop = stops[stops.length - 1].coordinates;
    const lastSegmentScale = getSegmentTargetScale(stops[stops.length - 2].coordinates, lastStop, baseScale);
    const transitionProgress = smootherStep((elapsedSeconds - routeDurationSeconds) / STOP_TRANSITION_SECONDS);

    return {
      routeProgress: 1,
      center: lastStop,
      scale: lastSegmentScale,
      vehicleOpacity: 0,
      vehicleScale: 0.88,
      completedStopIndex: stops.length - 2,
      completedStopTransitionIndex: stops.length - 1,
      completedStopTransitionProgress: transitionProgress,
      pulseSegmentIndex: stops.length - 2,
      pulseSegmentProgress: 1,
    };
  }

  if (elapsedSeconds >= finalZoomStartSeconds) {
    const lastStop = stops[stops.length - 1].coordinates;
    const lastSegmentScale = getSegmentTargetScale(stops[stops.length - 2].coordinates, lastStop, baseScale);
    const zoomOutProgress = smootherStep((elapsedSeconds - finalZoomStartSeconds) / FINAL_ZOOM_SECONDS);

    return {
      routeProgress: 1,
      center: lastStop,
      scale: lerp(lastSegmentScale, baseScale, zoomOutProgress),
      vehicleOpacity: 0,
      vehicleScale: 0.88,
      completedStopIndex: stops.length - 1,
      completedStopTransitionIndex: stops.length - 1,
      completedStopTransitionProgress: 1,
      pulseSegmentIndex: stops.length - 2,
      pulseSegmentProgress: 1,
    };
  }

  const segmentTiming = getSegmentTiming(stops, segments, elapsedSeconds);
  const { segmentIndex, segmentTimelineProgress } = segmentTiming;
  const start = stops[segmentIndex].coordinates;
  const end = stops[segmentIndex + 1].coordinates;
  const targetScale = getSegmentTargetScale(start, end, baseScale);
  const previousScale = segmentIndex === 0
    ? baseScale
    : getSegmentTargetScale(stops[segmentIndex - 1].coordinates, start, baseScale);

  if (segmentTiming.isStopTransition) {
    return {
      routeProgress: (segmentIndex + 1) / segmentCount,
      center: end,
      scale: targetScale,
      vehicleOpacity: 0,
      vehicleScale: 0.88,
      completedStopIndex: segmentIndex,
      completedStopTransitionIndex: segmentIndex + 1,
      completedStopTransitionProgress: smootherStep(segmentTiming.stopTransitionProgress),
      pulseSegmentIndex: segmentIndex,
      pulseSegmentProgress: 1,
    };
  }

  if (segmentTimelineProgress < ZOOM_PHASE) {
    const zoomProgress = smootherStep(segmentTimelineProgress / ZOOM_PHASE);

    return {
      routeProgress: segmentIndex / segmentCount,
      center: start,
      scale: lerp(previousScale, targetScale, zoomProgress),
      vehicleOpacity: 0,
      vehicleScale: 0.88,
      completedStopIndex: segmentIndex,
      pulseSegmentIndex: segmentIndex,
      pulseSegmentProgress: 0,
    };
  }

  const travelTimelineProgress = (segmentTimelineProgress - ZOOM_PHASE) / (1 - ZOOM_PHASE);
  const travelProgress = smootherStep(travelTimelineProgress);
  const departureOpacity = smootherStep(travelTimelineProgress / DEPARTURE_FADE);
  const arrivalOpacity = 1 - smootherStep((travelTimelineProgress - (1 - ARRIVAL_FADE)) / ARRIVAL_FADE);
  const vehicleOpacity = Math.min(departureOpacity, arrivalOpacity);
  const vehicleScale = lerp(0.9, 1, vehicleOpacity);

  const center = d3.geoInterpolate(start, end)(travelProgress) as [number, number];

  return {
    routeProgress: (segmentIndex + travelProgress) / segmentCount,
    center,
    scale: targetScale,
    vehicleOpacity,
    vehicleScale,
    completedStopIndex: segmentIndex,
    pulseSegmentIndex: segmentIndex,
    pulseSegmentProgress: travelTimelineProgress,
  };
}

function getSegmentTargetScale(
  start: [number, number],
  end: [number, number],
  baseScale: number
) {
  const distanceKm = Math.max(MIN_ZOOM_DISTANCE_KM, d3.geoDistance(start, end) * EARTH_RADIUS_KM);

  return baseScale * getDistanceZoomMultiplier(distanceKm);
}

function getDistanceZoomMultiplier(distanceKm: number) {
  const clampedDistanceKm = clamp(distanceKm, MIN_ZOOM_DISTANCE_KM, MAX_ZOOM_DISTANCE_KM);
  const distanceProgress = clamp(
    (Math.log(clampedDistanceKm) - Math.log(MIN_ZOOM_DISTANCE_KM))
    / (Math.log(MAX_ZOOM_DISTANCE_KM) - Math.log(MIN_ZOOM_DISTANCE_KM)),
    0,
    1
  );
  const curvedProgress = Math.pow(distanceProgress, DISTANCE_ZOOM_CURVE);

  return Math.exp(lerp(
    Math.log(MAX_DISTANCE_ZOOM_MULTIPLIER),
    Math.log(MIN_DISTANCE_ZOOM_MULTIPLIER),
    curvedProgress
  ));
}

function getRouteDurationSeconds(stops: Stop[], segments: Segment[]) {
  const segmentCount = Math.max(0, stops.length - 1);
  let duration = 0;

  for (let i = 0; i < segmentCount; i++) {
    duration += getSegmentDurationSeconds(segments[i]);
    if (i < segmentCount - 1) {
      duration += STOP_TRANSITION_SECONDS;
    }
  }

  return Math.max(DEFAULT_SEGMENT_DURATION_SECONDS, duration);
}

function getSegmentTiming(stops: Stop[], segments: Segment[], elapsedSeconds: number) {
  const segmentCount = stops.length - 1;
  let elapsedBeforeSegment = 0;

  for (let i = 0; i < segmentCount; i++) {
    const segmentDuration = getSegmentDurationSeconds(segments[i]);

    if (elapsedSeconds <= elapsedBeforeSegment + segmentDuration || i === segmentCount - 1) {
      return {
        segmentIndex: i,
        segmentTimelineProgress: clamp((elapsedSeconds - elapsedBeforeSegment) / segmentDuration, 0, 1),
      };
    }

    elapsedBeforeSegment += segmentDuration;

    if (i < segmentCount - 1) {
      if (elapsedSeconds <= elapsedBeforeSegment + STOP_TRANSITION_SECONDS) {
        return {
          segmentIndex: i,
          segmentTimelineProgress: 1,
          isStopTransition: true,
          stopTransitionProgress: clamp((elapsedSeconds - elapsedBeforeSegment) / STOP_TRANSITION_SECONDS, 0, 1),
        };
      }

      elapsedBeforeSegment += STOP_TRANSITION_SECONDS;
    }
  }

  return { segmentIndex: 0, segmentTimelineProgress: 0 };
}

function getSegmentDurationSeconds(segment?: Segment) {
  const duration = segment?.durationSeconds ?? DEFAULT_SEGMENT_DURATION_SECONDS;

  return Number.isFinite(duration) ? Math.max(MIN_SEGMENT_DURATION_SECONDS, duration) : DEFAULT_SEGMENT_DURATION_SECONDS;
}
