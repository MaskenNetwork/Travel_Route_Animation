'use client';

import React, { useRef, useEffect, useState } from 'react';
import type { GeoPermissibleObjects } from 'd3';
import { useApp } from '@/lib/store';
import { getBaseGlobeScale, getRouteAnimationDurationSeconds, getRouteCameraFrame } from '@/lib/route-camera';
import {
  getExportFormat,
  getExportResolution,
  getExportSize,
  getPreviewSize,
  getRenderToReferenceScale,
  getRenderVisualScale,
} from '@/lib/export-options';
import { loadWorldData } from '@/lib/rendering/world-data';
import { renderExportFrame } from '@/lib/rendering/export-frame';
import { clamp } from '@/lib/utils/math';

interface CameraView {
  center: [number, number];
  scale: number;
}

interface PointerPoint {
  x: number;
  y: number;
}

const PREVIEW_FRAME_PADDING = 12;

const Globe: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { stops, segments, animation, distanceSettings, exportSettings, language, setAnimation } = useApp();
  const [worldData, setWorldData] = useState<GeoPermissibleObjects | null>(null);
  const selectedFormat = getExportFormat(exportSettings.format);
  const previewSize = getPreviewSize(selectedFormat.ratio);
  const [displaySize, setDisplaySize] = useState(previewSize);
  
  const animationRef = useRef(animation);
  const distanceSettingsRef = useRef(distanceSettings);
  const stopsRef = useRef(stops);
  const segmentsRef = useRef(segments);
  const exportSettingsRef = useRef(exportSettings);
  const languageRef = useRef(language);
  const manualCameraRef = useRef<CameraView | null>(null);
  const pointersRef = useRef(new Map<number, PointerPoint>());
  const lastDragPointRef = useRef<PointerPoint | null>(null);
  const pinchRef = useRef<{
    distance: number;
    midpoint: PointerPoint;
    camera: CameraView;
  } | null>(null);

  useEffect(() => {
    animationRef.current = animation;
    if (animation.isPlaying) {
      manualCameraRef.current = null;
    }
  }, [animation]);

  useEffect(() => {
    distanceSettingsRef.current = distanceSettings;
  }, [distanceSettings]);

  useEffect(() => {
    stopsRef.current = stops;
  }, [stops]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    exportSettingsRef.current = exportSettings;
  }, [exportSettings]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateDisplaySize = () => {
      if (!containerRef.current) return;

      const { width: containerWidth, height: containerHeight } = containerRef.current.getBoundingClientRect();
      if (containerWidth <= 0 || containerHeight <= 0) return;

      const availableWidth = Math.max(0, containerWidth - PREVIEW_FRAME_PADDING * 2);
      const availableHeight = Math.max(0, containerHeight - PREVIEW_FRAME_PADDING * 2);
      const fitScale = Math.min(
        availableWidth / previewSize.width,
        availableHeight / previewSize.height
      );

      setDisplaySize({
        width: Math.floor(previewSize.width * fitScale),
        height: Math.floor(previewSize.height * fitScale),
      });
    };

    const resizeObserver = new ResizeObserver(updateDisplaySize);
    resizeObserver.observe(containerRef.current);
    updateDisplaySize();

    return () => resizeObserver.disconnect();
  }, [previewSize.height, previewSize.width]);

  // Load world data
  useEffect(() => {
    const controller = new AbortController();

    loadWorldData(controller.signal)
      .then(setWorldData)
      .catch((error) => {
        if ((error as DOMException).name !== 'AbortError') {
          setWorldData(null);
        }
      });

    return () => controller.abort();
  }, []);

  // Animation loop
  useEffect(() => {
    if (!canvasRef.current || !worldData) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrameId: number;
    let lastTime = performance.now();

    const render = (time: number) => {
      const deltaTime = time - lastTime;
      lastTime = time;

      const currentAnimation = animationRef.current;
      const currentStops = stopsRef.current;
      const currentSegments = segmentsRef.current;
      const currentFormat = getExportFormat(exportSettingsRef.current.format);
      const currentResolution = getExportResolution(exportSettingsRef.current.resolution);
      const currentPreviewSize = getPreviewSize(currentFormat.ratio);
      const currentExportSize = getExportSize(currentFormat.ratio, currentResolution.longSide);
      const previewVisualScale = getRenderVisualScale(currentPreviewSize, currentExportSize);
      const previewEffectScale = getRenderToReferenceScale(currentPreviewSize, currentExportSize);
      const { width, height } = currentPreviewSize;
      let renderProgress = currentAnimation.progress;
      let renderAnimation = currentAnimation;

      if (currentAnimation.isPlaying) {
        const routeDurationMs = getRouteAnimationDurationSeconds(currentStops, currentSegments) * 1000;
        const newProgress = Math.min(1, currentAnimation.progress + (deltaTime / routeDurationMs) * currentAnimation.speed);
        const isFinished = newProgress >= 1;
        renderProgress = newProgress;
        renderAnimation = { ...currentAnimation, progress: newProgress, isPlaying: isFinished ? false : currentAnimation.isPlaying };
        animationRef.current = renderAnimation;
        setAnimation({ progress: newProgress, ...(isFinished ? { isPlaying: false } : {}) });
        
      }

      renderExportFrame({
        ctx: context,
        width,
        height,
        progress: renderProgress,
        stops: currentStops,
        segments: currentSegments,
        animation: renderAnimation,
        distanceSettings: distanceSettingsRef.current,
        language: languageRef.current,
        worldData,
        visualScale: previewVisualScale,
        effectScale: previewEffectScale,
        cameraOverride: renderAnimation.isPlaying ? null : manualCameraRef.current,
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationFrameId);
  }, [worldData, setAnimation]);

  const getCurrentCameraView = () => {
    const currentAnimation = animationRef.current;
    const currentStops = stopsRef.current;
    const currentSegments = segmentsRef.current;
    const currentFormat = getExportFormat(exportSettingsRef.current.format);
    const currentPreviewSize = getPreviewSize(currentFormat.ratio);
    const baseScale = getBaseGlobeScale(currentPreviewSize.width, currentPreviewSize.height);
    const cameraFrame = getRouteCameraFrame(currentStops, currentSegments, currentAnimation.progress, baseScale);

    return manualCameraRef.current || {
      center: cameraFrame?.center || currentStops[0]?.coordinates || [0, 0],
      scale: cameraFrame?.scale || baseScale,
    };
  };

  const clampCameraView = (camera: CameraView): CameraView => {
    const currentFormat = getExportFormat(exportSettingsRef.current.format);
    const currentPreviewSize = getPreviewSize(currentFormat.ratio);
    const baseScale = getBaseGlobeScale(currentPreviewSize.width, currentPreviewSize.height);

    return {
      center: [
        wrapLongitude(camera.center[0]),
        clampLatitude(camera.center[1]),
      ],
      scale: clamp(camera.scale, baseScale * 0.65, baseScale * 80),
    };
  };

  const pauseForManualCamera = () => {
    const currentAnimation = animationRef.current;
    if (currentAnimation.isPlaying) {
      animationRef.current = { ...currentAnimation, isPlaying: false };
      setAnimation({ isPlaying: false });
    }
  };

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>): PointerPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    const currentFormat = getExportFormat(exportSettingsRef.current.format);
    const currentPreviewSize = getPreviewSize(currentFormat.ratio);

    return {
      x: ((event.clientX - rect.left) / rect.width) * currentPreviewSize.width,
      y: ((event.clientY - rect.top) / rect.height) * currentPreviewSize.height,
    };
  };

  const panCamera = (camera: CameraView, deltaX: number, deltaY: number): CameraView => {
    const degreesPerPixel = 180 / (Math.PI * camera.scale);

    return clampCameraView({
      center: [
        camera.center[0] - deltaX * degreesPerPixel,
        camera.center[1] + deltaY * degreesPerPixel,
      ],
      scale: camera.scale,
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pauseForManualCamera();
    manualCameraRef.current = getCurrentCameraView();

    const point = getCanvasPoint(event);
    pointersRef.current.set(event.pointerId, point);
    lastDragPointRef.current = point;

    if (pointersRef.current.size === 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: getPointDistance(first, second),
        midpoint: getPointMidpoint(first, second),
        camera: manualCameraRef.current,
      };
    }
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pointersRef.current.has(event.pointerId)) return;

    event.preventDefault();
    const point = getCanvasPoint(event);
    pointersRef.current.set(event.pointerId, point);

    if (pointersRef.current.size >= 2) {
      const [first, second] = Array.from(pointersRef.current.values());
      const pinch = pinchRef.current;
      if (!pinch || pinch.distance <= 0) return;

      const midpoint = getPointMidpoint(first, second);
      const distance = getPointDistance(first, second);
      const zoomScale = distance / pinch.distance;
      const zoomedCamera = clampCameraView({
        center: pinch.camera.center,
        scale: pinch.camera.scale * zoomScale,
      });
      manualCameraRef.current = panCamera(
        zoomedCamera,
        midpoint.x - pinch.midpoint.x,
        midpoint.y - pinch.midpoint.y
      );
      return;
    }

    const lastPoint = lastDragPointRef.current;
    if (!lastPoint || !manualCameraRef.current) return;

    manualCameraRef.current = panCamera(
      manualCameraRef.current,
      point.x - lastPoint.x,
      point.y - lastPoint.y
    );
    lastDragPointRef.current = point;
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = null;
    const remainingPoint = Array.from(pointersRef.current.values())[0] || null;
    lastDragPointRef.current = remainingPoint;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();

      const currentAnimation = animationRef.current;
      if (currentAnimation.isPlaying) {
        animationRef.current = { ...currentAnimation, isPlaying: false };
        setAnimation({ isPlaying: false });
      }

      const camera = getCurrentCameraView();
      const zoomFactor = Math.exp(-event.deltaY * 0.0015);

      manualCameraRef.current = clampCameraView({
        center: camera.center,
        scale: camera.scale * zoomFactor,
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [setAnimation]);

  return (
    <div 
      ref={containerRef}
      className="flex h-full w-full items-center justify-center overflow-visible"
    >
      <div
        className="glass rounded-2xl p-3 shadow-xl"
        style={{
          width: displaySize.width + PREVIEW_FRAME_PADDING * 2,
          height: displaySize.height + PREVIEW_FRAME_PADDING * 2,
        }}
      >
        <canvas
          ref={canvasRef}
          width={previewSize.width}
          height={previewSize.height}
          style={{ width: '100%', height: '100%' }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          className="h-full w-full touch-none cursor-grab rounded-xl active:cursor-grabbing"
        />
      </div>
    </div>
  );
};

export default Globe;

function getPointDistance(first: PointerPoint, second: PointerPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function getPointMidpoint(first: PointerPoint, second: PointerPoint): PointerPoint {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2,
  };
}

function wrapLongitude(longitude: number) {
  let wrapped = longitude;

  while (wrapped < -180) wrapped += 360;
  while (wrapped > 180) wrapped -= 360;

  return wrapped;
}

function clampLatitude(latitude: number) {
  return clamp(latitude, -85, 85);
}
