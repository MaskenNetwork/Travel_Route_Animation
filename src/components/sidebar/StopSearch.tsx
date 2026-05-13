'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { CitySearchResult, enrichSearchResultsLanguage, searchCity } from '@/lib/geocoding';
import { PrimaryButton } from '@/components/ui/panel';
import { useApp } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { Language } from '@/types';

interface StopSearchProps {
  disabled?: boolean;
  onSelect: (result: CitySearchResult) => void;
}

export default function StopSearch({ disabled, onSelect }: StopSearchProps) {
  const { language } = useApp();
  const t = useI18n();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CitySearchResult[]>([]);

  React.useEffect(() => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        const results = await searchLocalizedCities(trimmedQuery, language, controller.signal);
        setSearchResults(results);
      } catch (error) {
        if ((error as DOMException).name !== 'AbortError') {
          setSearchResults([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 120);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [language, query]);

  const selectResult = (result: CitySearchResult) => {
    onSelect(result);
    setQuery('');
    setSearchResults([]);
    setIsSearching(false);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    if (searchResults.length > 0) {
      selectResult(searchResults[0]);
    }
  };

  const updateQuery = (value: string) => {
    setQuery(value);

    if (value.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
  };

  return (
    <form onSubmit={handleSubmit} className="relative mb-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          placeholder={t.addCity}
          className="field-surface h-12 min-w-0 flex-1 rounded-xl px-4 text-sm text-[var(--foreground)] placeholder:text-[var(--text-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--action)]/50"
        />
        <PrimaryButton
          type="submit"
          disabled={disabled || isSearching || !query.trim()}
          className="h-12 w-12 px-0 py-0"
          aria-label={t.addFirstCity}
        >
          <Plus size={20} />
        </PrimaryButton>
      </div>

      {(searchResults.length > 0 || isSearching) && (
        <div className="panel-surface absolute left-0 right-0 top-full z-50 mt-2 max-h-60 rounded-xl p-1 shadow-2xl">
          <div className="custom-scrollbar max-h-[14.5rem] overflow-y-auto">
            {isSearching && searchResults.length === 0 && (
              <div className="px-4 py-3 text-sm text-[var(--text-muted)]">{t.searching}</div>
            )}
            {searchResults.map((result) => {
              const resultName = getResultName(result, language);
              const resultFullName = getResultFullName(result, language);
              const resultTitle = `${resultName} - ${resultFullName}`;

              return (
                <button
                  key={`${result.kind}-${result.fullName}-${result.coordinates.join(',')}`}
                  type="button"
                  title={resultTitle}
                  aria-label={resultTitle}
                  onClick={() => selectResult(result)}
                  className="flex min-h-14 w-full flex-col justify-center gap-1 border-b border-[var(--panel-border)] px-4 py-2 text-left text-sm transition-colors last:border-none hover:bg-[var(--action-soft)]"
                >
                  <SearchResultScrollableText className="font-semibold leading-tight">
                    {resultName}
                  </SearchResultScrollableText>
                  <SearchResultScrollableText className="text-[10px] leading-tight">
                    <span className="opacity-60">{resultFullName}</span>
                  </SearchResultScrollableText>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </form>
  );
}

interface SearchResultScrollableTextProps {
  children: React.ReactNode;
  className?: string;
}

function SearchResultScrollableText({ children, className }: SearchResultScrollableTextProps) {
  const scrollRef = React.useRef<HTMLSpanElement>(null);
  const scrollbarRef = React.useRef<HTMLSpanElement>(null);
  const thumbRef = React.useRef<HTMLSpanElement>(null);
  const dragOffsetRef = React.useRef(0);
  const [hasOverflow, setHasOverflow] = React.useState(false);
  const [isDragging, setIsDragging] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);

  const updateScrollState = React.useCallback(() => {
    const element = scrollRef.current;

    if (!element) return;

    const maxScroll = element.scrollWidth - element.clientWidth;

    setHasOverflow(maxScroll > 1);
    setScrollProgress(maxScroll > 0 ? element.scrollLeft / maxScroll : 0);
  }, []);

  const scrollToPointer = React.useCallback((clientX: number) => {
    const element = scrollRef.current;
    const scrollbar = scrollbarRef.current;
    const thumb = thumbRef.current;

    if (!element || !scrollbar || !thumb) return;

    const maxScroll = element.scrollWidth - element.clientWidth;
    const maxThumbLeft = scrollbar.clientWidth - thumb.offsetWidth;

    if (maxScroll <= 0 || maxThumbLeft <= 0) return;

    const scrollbarRect = scrollbar.getBoundingClientRect();
    const thumbLeft = clientX - scrollbarRect.left - dragOffsetRef.current;
    const progress = Math.min(Math.max(thumbLeft / maxThumbLeft, 0), 1);

    element.scrollLeft = progress * maxScroll;
    setScrollProgress(progress);
  }, []);

  const startScrollbarDrag = React.useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      const scrollbar = scrollbarRef.current;
      const thumb = thumbRef.current;

      if (!scrollbar || !thumb) return;

      event.preventDefault();
      event.stopPropagation();

      const thumbRect = thumb.getBoundingClientRect();
      const pointerIsOnThumb = event.clientX >= thumbRect.left && event.clientX <= thumbRect.right;

      dragOffsetRef.current = pointerIsOnThumb ? event.clientX - thumbRect.left : thumb.offsetWidth / 2;
      scrollbar.setPointerCapture(event.pointerId);
      setIsDragging(true);
      scrollToPointer(event.clientX);
    },
    [scrollToPointer],
  );

  const continueScrollbarDrag = React.useCallback(
    (event: React.PointerEvent<HTMLSpanElement>) => {
      if (!isDragging) return;

      event.preventDefault();
      event.stopPropagation();
      scrollToPointer(event.clientX);
    },
    [isDragging, scrollToPointer],
  );

  const stopScrollbarDrag = React.useCallback((event: React.PointerEvent<HTMLSpanElement>) => {
    if (!isDragging) return;

    event.preventDefault();
    event.stopPropagation();

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
  }, [isDragging]);

  React.useEffect(() => {
    const element = scrollRef.current;

    if (!element) return;

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(element);

    window.addEventListener('resize', updateScrollState);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateScrollState);
    };
  }, [children, updateScrollState]);

  const scrollbarStyle = {
    '--scrollbar-progress': scrollProgress,
  } as React.CSSProperties;

  return (
    <span className="block w-full">
      <span ref={scrollRef} onScroll={updateScrollState} className={`search-result-scroll ${className || ''}`}>
        {children}
      </span>
      {hasOverflow && (
        <span
          ref={scrollbarRef}
          aria-hidden="true"
          className={`search-result-scrollbar ${isDragging ? 'is-dragging' : ''}`}
          style={scrollbarStyle}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={startScrollbarDrag}
          onPointerMove={continueScrollbarDrag}
          onPointerUp={stopScrollbarDrag}
          onPointerCancel={stopScrollbarDrag}
        >
          <span ref={thumbRef} className="search-result-scrollbar-thumb" />
        </span>
      )}
    </span>
  );
}

async function searchLocalizedCities(query: string, language: Language, signal: AbortSignal) {
  const alternateLanguage = language === 'it' ? 'en' : 'it';
  const primaryResults = await searchCity(query, language, signal);

  return enrichSearchResultsLanguage(primaryResults, alternateLanguage, signal);
}

function getResultName(result: CitySearchResult, language: Language) {
  return result.names?.[language] || result.name;
}

function getResultFullName(result: CitySearchResult, language: Language) {
  return result.fullNames?.[language] || result.fullName;
}
