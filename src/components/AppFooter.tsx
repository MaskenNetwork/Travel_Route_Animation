'use client';

import { Scale, Sparkles } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { useMeasuredActionGroup } from '@/components/useMeasuredActionGroup';

const links = {
  github: 'https://github.com/MaskenNetwork',
  license: 'https://github.com/MaskenNetwork/Travel_Route_Animation/blob/main/LICENSE',
  credits: 'https://www.svgrepo.com/collection/vehicles-and-transport-glyphs/',
};

export default function AppFooter() {
  const t = useI18n();
  const { availableRef, showLabels } = useMeasuredActionGroup({
    font: '600 14px Inter, sans-serif',
    groupGap: 4,
    groupPaddingX: 8,
    iconWidths: [18, 18, 18],
    itemGap: 6,
    itemPaddingX: 9,
    labels: [t.footerGithub, t.footerLicense, t.footerCredits],
    layout: 'inline',
    separatorWidth: 1,
  });

  return (
    <footer
      ref={availableRef as React.RefObject<HTMLElement>}
      className="pointer-events-auto fixed left-1/2 top-4 z-30 flex w-[calc(100vw-10rem)] -translate-x-1/2 justify-center"
    >
      <nav
        aria-label={t.footerNavigation}
        className="top-action-surface flex h-12 max-w-full items-center justify-center gap-x-1 rounded-xl px-2 text-sm font-semibold text-[var(--text-strong)] shadow-lg"
      >
        <a
          href={links.github}
          target="_blank"
          rel="noreferrer"
          aria-label={t.footerGithub}
          className="action-label-container flex h-9 min-w-9 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-[9px] transition hover:bg-[var(--field-hover)] hover:text-[var(--action)]"
        >
          <span className="shrink-0">
            <GithubLogo />
          </span>
          {showLabels && <span className="whitespace-nowrap">{t.footerGithub}</span>}
        </a>

        <span className="h-4 w-px bg-[var(--panel-border)]" aria-hidden="true" />

        <a
          href={links.license}
          target="_blank"
          rel="noreferrer"
          aria-label={t.footerLicense}
          className="action-label-container flex h-9 min-w-9 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-[9px] transition hover:bg-[var(--field-hover)] hover:text-[var(--action)]"
        >
          <Scale className="shrink-0" size={18} />
          {showLabels && <span className="whitespace-nowrap">{t.footerLicense}</span>}
        </a>

        <span className="h-4 w-px bg-[var(--panel-border)]" aria-hidden="true" />

        <a
          href={links.credits}
          target="_blank"
          rel="noreferrer"
          aria-label={t.footerCredits}
          className="action-label-container flex h-9 min-w-9 items-center justify-center gap-1.5 overflow-hidden rounded-lg px-[9px] transition hover:bg-[var(--field-hover)] hover:text-[var(--action)]"
        >
          <Sparkles className="shrink-0" size={18} />
          {showLabels && <span className="whitespace-nowrap">{t.footerCredits}</span>}
        </a>
      </nav>
    </footer>
  );
}

function GithubLogo() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px] shrink-0 fill-current"
    >
      <path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.35 6.84 9.71.5.09.68-.22.68-.49 0-.24-.01-.88-.01-1.73-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.67.35-1.12.63-1.38-2.22-.26-4.55-1.14-4.55-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.28 9.28 0 0 1 12 6.98c.85 0 1.7.12 2.5.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.14 10.14 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" />
    </svg>
  );
}
