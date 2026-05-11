'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';

type ActionGroupLayout = 'inline' | 'mobile-grid';

type MeasuredActionGroupOptions = {
  font: string;
  groupGap: number;
  groupPaddingX?: number;
  iconWidths: number[];
  itemGap: number;
  itemPaddingX: number;
  labels: string[];
  layout: ActionGroupLayout;
  separatorWidth?: number;
};

export function useMeasuredActionGroup({
  font,
  groupGap,
  groupPaddingX = 0,
  iconWidths,
  itemGap,
  itemPaddingX,
  labels,
  layout,
  separatorWidth = 0,
}: MeasuredActionGroupOptions) {
  const availableRef = useRef<HTMLDivElement | HTMLElement>(null);
  const [showLabels, setShowLabels] = useState(true);
  const labelsKey = useMemo(() => labels.join('\u0000'), [labels]);

  useLayoutEffect(() => {
    const available = availableRef.current;
    if (!available) return;

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) return;

    const measureText = (label: string) => {
      context.font = font;
      return Math.ceil(context.measureText(label).width);
    };

    const itemWidth = (index: number) => {
      return iconWidths[index] + itemGap + measureText(labels[index]) + itemPaddingX * 2;
    };

    const requiredWidth = () => {
      if (layout === 'inline') {
        const itemsWidth = labels.reduce((sum, _label, index) => sum + itemWidth(index), 0);
        const separatorsWidth = Math.max(0, labels.length - 1) * separatorWidth;
        const gapsWidth = Math.max(0, labels.length * 2 - 2) * groupGap;

        return groupPaddingX * 2 + itemsWidth + separatorsWidth + gapsWidth;
      }

      if (labels.length <= 2) {
        return (
          groupPaddingX * 2 +
          labels.reduce((sum, _label, index) => sum + itemWidth(index), 0) +
          Math.max(0, labels.length - 1) * groupGap
        );
      }

      return groupPaddingX * 2 + Math.max(itemWidth(0) + itemWidth(1) + groupGap, itemWidth(2));
    };

    const updateVisibility = () => {
      setShowLabels(available.clientWidth >= requiredWidth());
    };

    updateVisibility();

    document.fonts?.ready.then(updateVisibility);

    const resizeObserver = new ResizeObserver(updateVisibility);
    resizeObserver.observe(available);

    window.addEventListener('resize', updateVisibility);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateVisibility);
    };
  }, [
    font,
    groupGap,
    groupPaddingX,
    iconWidths,
    itemGap,
    itemPaddingX,
    labels,
    labelsKey,
    layout,
    separatorWidth,
  ]);

  return { availableRef, showLabels };
}
