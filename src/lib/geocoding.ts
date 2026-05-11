import { Language } from '@/types';

export interface CitySearchResult {
  name: string;
  fullName: string;
  coordinates: [number, number];
  region?: string;
  country?: string;
  kind: 'city' | 'region' | 'country';
}

interface OpenMeteoPlace {
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  feature_code?: string;
  population?: number;
}

const GEOCODING_TIMEOUT_MS = 7000;
const MAX_QUERY_LENGTH = 80;
const searchCache = new Map<string, CitySearchResult[]>();

export async function searchCity(query: string, language: Language = 'it', signal?: AbortSignal): Promise<CitySearchResult[]> {
  const trimmedQuery = query.trim().slice(0, MAX_QUERY_LENGTH);
  if (trimmedQuery.length < 2) {
    return [];
  }

  const cacheKey = `${language}:${normalize(trimmedQuery)}`;
  const cachedResults = searchCache.get(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }

  const params = new URLSearchParams({
    name: trimmedQuery,
    count: '10',
    language,
    format: 'json',
  });
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), GEOCODING_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const places: OpenMeteoPlace[] = Array.isArray(data.results) ? data.results : [];
    const results = places
      .filter(isAllowedPlace)
      .map(toSearchResult)
      .map((result) => ({
        result,
        score: scoreResult(result, trimmedQuery),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ result }) => result)
      .slice(0, 8);

    searchCache.set(cacheKey, results);
    return results;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

function isAllowedPlace(place: OpenMeteoPlace) {
  if (
    typeof place.name !== 'string' ||
    typeof place.latitude !== 'number' ||
    typeof place.longitude !== 'number'
  ) {
    return false;
  }

  const featureCode = place.feature_code || '';

  if (isCountryCode(featureCode) || isRegionCode(featureCode)) {
    return true;
  }

  if (!isCityCode(featureCode)) {
    return false;
  }

  if (featureCode === 'PPLX') {
    return false;
  }

  return featureCode !== 'PPL' || (place.population || 0) >= 50000;
}

function toSearchResult(place: OpenMeteoPlace): CitySearchResult {
  const region = place.admin1 || place.admin2 || place.admin3;
  const parts = [region, place.country].filter(Boolean);
  const kind = getPlaceKind(place.feature_code || '');

  return {
    name: place.name,
    fullName: parts.length > 0 ? `${place.name}, ${parts.join(', ')}` : place.name,
    coordinates: [place.longitude, place.latitude],
    region,
    country: place.country,
    kind,
  };
}

function scoreResult(result: CitySearchResult, query: string) {
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(result.name);

  if (normalizedName === normalizedQuery) return categoryScore(result.kind) + 100;
  if (normalizedName.startsWith(normalizedQuery)) return categoryScore(result.kind) + 60 - normalizedName.length;
  if (wordStartsWith(normalizedName, normalizedQuery)) return categoryScore(result.kind) + 20 - normalizedName.length;

  return 0;
}

function categoryScore(kind: CitySearchResult['kind']) {
  if (kind === 'city') return 900;
  if (kind === 'region') return 600;
  return 300;
}

function getPlaceKind(featureCode: string): CitySearchResult['kind'] {
  if (isCountryCode(featureCode)) return 'country';
  if (isRegionCode(featureCode)) return 'region';
  return 'city';
}

function isCityCode(featureCode: string) {
  return ['PPLC', 'PPLA', 'PPLA2', 'PPLA3', 'PPLA4', 'PPL'].includes(featureCode);
}

function isRegionCode(featureCode: string) {
  return ['ADM1', 'ADM2'].includes(featureCode);
}

function isCountryCode(featureCode: string) {
  return ['PCLI', 'PCLD', 'PCLF', 'PCLIX'].includes(featureCode);
}

function wordStartsWith(value: string, query: string) {
  return value.split(' ').some((part) => part.startsWith(query));
}

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
