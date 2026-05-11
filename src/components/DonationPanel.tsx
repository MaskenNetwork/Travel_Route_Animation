'use client';

import React from 'react';
import { HeartHandshake, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { IconButton, PanelHeader } from '@/components/ui/panel';
import { useMeasuredActionGroup } from '@/components/useMeasuredActionGroup';

const PAYPAL_URL = 'https://paypal.me/maskennetwork';

export default function DonationPanel({ onClose }: { onClose?: () => void }) {
  const t = useI18n();
  const { availableRef: paypalRef, showLabels: showPaypalLabel } = useMeasuredActionGroup({
    font: '700 14px Inter, sans-serif',
    groupGap: 0,
    iconWidths: [18],
    itemGap: 8,
    itemPaddingX: 16,
    labels: [t.donateWithPaypal],
    layout: 'inline',
  });

  return (
    <aside className="glass flex flex-col rounded-2xl p-4 text-[var(--foreground)] shadow-xl">
      <PanelHeader
        icon={<HeartHandshake size={20} />}
        title={t.supportProject}
        action={
          onClose ? (
            <IconButton onClick={onClose} aria-label={t.close}>
              <X size={19} />
            </IconButton>
          ) : undefined
        }
      />
      <p className="mb-4 text-sm font-medium leading-relaxed text-[var(--text-muted)]">{t.supportProjectCopy}</p>
      <a
        ref={paypalRef as React.RefObject<HTMLAnchorElement>}
        href={PAYPAL_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--action)] px-4 text-sm font-bold text-[var(--on-action)] shadow-lg shadow-[var(--action-shadow)] transition-all hover:bg-[var(--action-hover)] active:scale-95"
      >
        <HeartHandshake size={18} className="shrink-0" />
        {showPaypalLabel && <span className="whitespace-nowrap">{t.donateWithPaypal}</span>}
      </a>
    </aside>
  );
}
