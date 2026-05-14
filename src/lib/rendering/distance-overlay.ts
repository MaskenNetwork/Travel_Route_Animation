import { DistanceSettingsState, Language, Stop, Theme } from '@/types';
import { convertDistanceFromKm, getCurrentDistanceFrame, getSegmentDistancesKm } from '@/lib/route-distance';
import { clamp, lerp } from '@/lib/utils/math';
import { drawRoundedRect, getCssColor } from '@/lib/rendering/canvas-utils';

interface DrawDistanceOverlayOptions {
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

export function drawDistanceOverlay(
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
  }: DrawDistanceOverlayOptions
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

function getFirstVisibleOdometerIndex(value: number) {
  if (value <= 0) return DISTANCE_ODOMETER_DIGITS - 1;

  const digitCount = Math.min(DISTANCE_ODOMETER_DIGITS, Math.floor(Math.log10(value)) + 1);

  return DISTANCE_ODOMETER_DIGITS - digitCount;
}

function getTextMiddleBaselineOffset(ctx: CanvasRenderingContext2D) {
  const metrics = ctx.measureText('8');

  return (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
}