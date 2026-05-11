'use client';

import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { CitySearchResult, searchCity } from '@/lib/geocoding';
import { PrimaryButton } from '@/components/ui/panel';
import { useApp } from '@/lib/store';
import { useI18n } from '@/lib/i18n';

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
        const results = await searchCity(trimmedQuery, language, controller.signal);
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
        <div className="panel-surface absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-y-auto rounded-xl shadow-2xl">
          {isSearching && searchResults.length === 0 && (
            <div className="px-4 py-3 text-sm text-[var(--text-muted)]">{t.searching}</div>
          )}
          {searchResults.map((result) => (
            <button
              key={`${result.kind}-${result.fullName}-${result.coordinates.join(',')}`}
              type="button"
              onClick={() => selectResult(result)}
              className="flex min-h-12 w-full flex-col justify-center gap-0.5 border-b border-[var(--panel-border)] px-4 py-2 text-left text-sm transition-colors last:border-none hover:bg-[var(--action-soft)]"
            >
              <div className="w-full truncate font-semibold leading-tight">{result.name}</div>
              <div className="w-full truncate text-[10px] leading-tight opacity-60">{result.fullName}</div>
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
