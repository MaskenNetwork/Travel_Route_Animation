'use client';

import { useState } from 'react';
import Globe from '@/components/Globe';
import Sidebar from '@/components/Sidebar';
import Controls from '@/components/Controls';
import ExportPanel from '@/components/ExportPanel';
import DonationPanel from '@/components/DonationPanel';
import GlobalActions from '@/components/GlobalActions';
import AppFooter from '@/components/AppFooter';
import { useMeasuredActionGroup } from '@/components/useMeasuredActionGroup';
import { Download, HeartHandshake, Map } from 'lucide-react';
import { useI18n } from '@/lib/i18n';

type MobilePanel = 'route' | 'export' | 'donate' | null;

export default function Home() {
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>(null);
  const t = useI18n();
  const { availableRef: mobileActionsRef, showLabels: showMobileActionLabels } = useMeasuredActionGroup({
    font: '600 14px Inter, sans-serif',
    groupGap: 16,
    iconWidths: [19, 19, 19],
    itemGap: 8,
    itemPaddingX: 14.5,
    labels: [t.route, t.export, t.supportProject],
    layout: 'mobile-grid',
  });

  return (
    <main className="relative h-dvh w-dvw overflow-hidden bg-[var(--background)]">
      <div
        className="absolute min-[1120px]:!bottom-6"
        style={{
          top: 'clamp(1rem, 2vw, 1.5rem)',
          right: 'clamp(1rem, 2vw, 1.5rem)',
          bottom: '9rem',
          left: 'clamp(1rem, 2vw, 1.5rem)',
        }}
      >
        <Globe />
      </div>

      {/* Floating UI Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <GlobalActions />
        <AppFooter />

        <div className="absolute bottom-36 left-1/2 -translate-x-1/2 pointer-events-auto min-[1120px]:bottom-6">
          <Controls />
        </div>

        <div className="absolute bottom-6 left-6 top-24 hidden w-[20rem] pointer-events-auto min-[1120px]:block">
          <Sidebar />
        </div>
        
        <div className="absolute bottom-6 right-6 top-24 hidden w-[20rem] pointer-events-auto min-[1120px]:flex min-[1120px]:flex-col min-[1120px]:gap-4">
          <div className="min-h-0 flex-1">
            <ExportPanel />
          </div>
          <DonationPanel />
        </div>

        <div
          ref={mobileActionsRef as React.RefObject<HTMLDivElement>}
          className="absolute inset-x-4 bottom-4 z-30 grid grid-cols-2 gap-4 pointer-events-auto min-[1120px]:hidden"
        >
          <button
            type="button"
            title={t.route}
            aria-label={t.route}
            onClick={() => setMobilePanel('route')}
            className="action-label-container top-action-surface flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl px-[14.5px] text-sm font-semibold text-[var(--text-strong)] shadow-xl transition-all hover:text-[var(--action)] active:scale-95"
          >
            <Map className="shrink-0" size={19} />
            {showMobileActionLabels && <span className="whitespace-nowrap">{t.route}</span>}
          </button>
          <button
            type="button"
            title={t.export}
            aria-label={t.export}
            onClick={() => setMobilePanel('export')}
            className="action-label-container top-action-surface flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl px-[14.5px] text-sm font-semibold text-[var(--text-strong)] shadow-xl transition-all hover:text-[var(--action)] active:scale-95"
          >
            <Download className="shrink-0" size={19} />
            {showMobileActionLabels && <span className="whitespace-nowrap">{t.export}</span>}
          </button>
          <button
            type="button"
            title={t.supportProject}
            aria-label={t.supportProject}
            onClick={() => setMobilePanel('donate')}
            className="action-label-container top-action-surface col-span-2 flex h-12 items-center justify-center gap-2 overflow-hidden rounded-xl px-[14.5px] text-sm font-semibold text-[var(--text-strong)] shadow-xl transition-all hover:text-[var(--action)] active:scale-95"
          >
            <HeartHandshake className="shrink-0" size={19} />
            {showMobileActionLabels && <span className="whitespace-nowrap">{t.supportProject}</span>}
          </button>
        </div>
      </div>

      {mobilePanel && (
        <div className="fixed inset-0 z-50 bg-[var(--mobile-overlay)] p-4 backdrop-blur-sm min-[1120px]:hidden">
          <button
            type="button"
            aria-label={t.close}
            title={t.close}
            onClick={() => setMobilePanel(null)}
            className="absolute inset-0 cursor-default"
          />
          <section className="panel-surface absolute inset-x-4 bottom-4 top-[max(4rem,env(safe-area-inset-top))] flex flex-col rounded-2xl p-4 shadow-2xl">
            <div className="min-h-0 flex-1">
              {mobilePanel === 'route' ? (
                <Sidebar onClose={() => setMobilePanel(null)} />
              ) : mobilePanel === 'export' ? (
                <ExportPanel onClose={() => setMobilePanel(null)} />
              ) : (
                <DonationPanel onClose={() => setMobilePanel(null)} />
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
