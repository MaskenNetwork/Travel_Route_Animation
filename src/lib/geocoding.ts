import { Language } from '@/types';

export interface CitySearchResult {
  id?: number;
  name: string;
  names?: Partial<Record<Language, string>>;
  fullName: string;
  fullNames?: Partial<Record<Language, string>>;
  coordinates: [number, number];
  region?: string;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  admin1Id?: number;
  admin2Id?: number;
  admin3Id?: number;
  country?: string;
  countryCode?: string;
  population?: number;
  kind: 'city' | 'region' | 'country';
}

interface OpenMeteoPlace {
  id?: number;
  name: string;
  latitude: number;
  longitude: number;
  country?: string;
  country_code?: string;
  admin1_id?: number;
  admin2_id?: number;
  admin3_id?: number;
  admin1?: string;
  admin2?: string;
  admin3?: string;
  feature_code?: string;
  population?: number;
}

const GEOCODING_TIMEOUT_MS = 7000;
const MAX_QUERY_LENGTH = 80;
const SEARCH_RESULT_COUNT = 30;
const MAX_SEARCH_RESULTS = 8;
const SAME_COORDINATE_DISTANCE_KM = 1;
const SAME_LOCAL_ADMIN_DISTANCE_KM = 35;
const SAME_INCOMPLETE_ADMIN_DISTANCE_KM = 15;
const PARENT_CITY_DISTANCE_KM = 35;
const EARTH_RADIUS_KM = 6371;
const searchCache = new Map<string, CitySearchResult[]>();
const placeCache = new Map<string, CitySearchResult | null>();

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
    count: String(SEARCH_RESULT_COUNT),
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
    const scoredCandidates = places
      .filter(isAllowedPlace)
      .map((place) => toSearchResult(place, language))
      .map((result) => ({
        result,
        score: scoreResult(result, trimmedQuery),
      }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || getResultRank(b.result) - getResultRank(a.result));
    const results = selectUniqueSearchResults(scoredCandidates)
      .map(({ result }) => result)
      .slice(0, MAX_SEARCH_RESULTS);

    searchCache.set(cacheKey, results);
    return results;
  } finally {
    window.clearTimeout(timeoutId);
    signal?.removeEventListener('abort', abortFromCaller);
  }
}

export async function getLocalizedPlaceById(
  id: number,
  language: Language,
  signal?: AbortSignal
): Promise<CitySearchResult | null> {
  const cacheKey = `${language}:${id}`;
  if (placeCache.has(cacheKey)) {
    return placeCache.get(cacheKey) ?? null;
  }

  const params = new URLSearchParams({
    id: String(id),
    language,
    format: 'json',
  });
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), GEOCODING_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller, { once: true });

  try {
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/get?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      placeCache.set(cacheKey, null);
      return null;
    }

    const place = await response.json();
    const result = isAllowedPlace(place) ? toSearchResult(place, language) : null;
    placeCache.set(cacheKey, result);
    return result;
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

function toSearchResult(place: OpenMeteoPlace, language: Language): CitySearchResult {
  const region = place.admin1 || place.admin2 || place.admin3;
  const parts = [place.admin2, place.admin1, place.country].filter(Boolean);
  const kind = getPlaceKind(place.feature_code || '');
  const fullName = parts.length > 0 ? `${place.name}, ${parts.join(', ')}` : place.name;

  return {
    id: place.id,
    name: place.name,
    names: { [language]: place.name },
    fullName,
    fullNames: { [language]: fullName },
    coordinates: [place.longitude, place.latitude],
    region,
    admin1: place.admin1,
    admin2: place.admin2,
    admin3: place.admin3,
    admin1Id: place.admin1_id,
    admin2Id: place.admin2_id,
    admin3Id: place.admin3_id,
    country: place.country,
    countryCode: place.country_code,
    population: place.population,
    kind,
  };
}

export async function enrichSearchResultsLanguage(
  results: CitySearchResult[],
  language: Language,
  signal?: AbortSignal
) {
  const localizedResults = await Promise.all(
    results.map(async (result) => {
      if (!result.id || result.names?.[language]) {
        return result;
      }

      const localizedResult = await getLocalizedPlaceById(result.id, language, signal);
      if (!localizedResult) {
        return result;
      }

      return mergeLocalizedSearchResult(result, localizedResult, language);
    })
  );

  return localizedResults;
}

function mergeLocalizedSearchResult(
  result: CitySearchResult,
  localizedResult: CitySearchResult,
  language: Language
): CitySearchResult {
  return {
    ...result,
    names: {
      ...result.names,
      [language]: localizedResult.name,
    },
    fullNames: {
      ...result.fullNames,
      [language]: localizedResult.fullName,
    },
  };
}

function scoreResult(result: CitySearchResult, query: string) {
  const normalizedQuery = normalize(query);
  const normalizedName = normalize(result.name);
  const rankScore = getResultRank(result);

  if (normalizedName === normalizedQuery) return categoryScore(result.kind) + 100 + rankScore;
  if (normalizedName.startsWith(normalizedQuery)) return categoryScore(result.kind) + 60 + rankScore - normalizedName.length;
  if (wordStartsWith(normalizedName, normalizedQuery)) return categoryScore(result.kind) + 20 + rankScore - normalizedName.length;

  return 0;
}

function getResultRank(result: CitySearchResult) {
  return Math.log10(Math.max(1, result.population || 0) + 1);
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

function selectUniqueSearchResults<T extends { result: CitySearchResult }>(candidates: T[]) {
  const uniqueCandidates: T[] = [];

  candidates.forEach((candidate) => {
    const hasEquivalentPlace = uniqueCandidates.some((selectedCandidate) =>
      isSameSearchPlace(candidate.result, selectedCandidate.result)
    );

    if (!hasEquivalentPlace) {
      uniqueCandidates.push(candidate);
    }
  });

  return uniqueCandidates;
}

function isSameSearchPlace(first: CitySearchResult, second: CitySearchResult) {
  if (first.id && second.id && first.id === second.id) {
    return true;
  }

  if (!hasSameCountry(first, second)) {
    return false;
  }

  const distanceKm = getDistanceKm(first.coordinates, second.coordinates);
  if (distanceKm <= SAME_COORDINATE_DISTANCE_KM) {
    return true;
  }

  if (isParentCityDuplicate(first, second, distanceKm)) {
    return true;
  }

  if (hasSameLocalAdminArea(first, second)) {
    return distanceKm <= SAME_LOCAL_ADMIN_DISTANCE_KM;
  }

  return hasSameIncompleteAdminArea(first, second)
    && distanceKm <= SAME_INCOMPLETE_ADMIN_DISTANCE_KM;
}

function hasSameCountry(first: CitySearchResult, second: CitySearchResult) {
  if (first.countryCode && second.countryCode) {
    return first.countryCode === second.countryCode;
  }

  return normalize(first.country || '') === normalize(second.country || '');
}

function isParentCityDuplicate(first: CitySearchResult, second: CitySearchResult, distanceKm: number) {
  return distanceKm <= PARENT_CITY_DISTANCE_KM && (
    containsParentCity(first, second) ||
    containsParentCity(second, first)
  );
}

function containsParentCity(parent: CitySearchResult, child: CitySearchResult) {
  return isPrimaryCity(parent) && isInsidePrimaryAdminArea(parent, child);
}

function isPrimaryCity(result: CitySearchResult) {
  return result.kind === 'city' && (result.population || 0) >= 100000;
}

function isInsidePrimaryAdminArea(parent: CitySearchResult, child: CitySearchResult) {
  if (parent.admin1Id && child.admin1Id && parent.admin1Id === child.admin1Id) return true;
  if (parent.admin2Id && child.admin2Id && parent.admin2Id === child.admin2Id) return true;

  const parentAdmin1 = normalize(parent.admin1 || '');
  const childAdmin1 = normalize(child.admin1 || '');
  if (parentAdmin1 && parentAdmin1 === childAdmin1) return true;

  const parentAdmin2 = normalize(parent.admin2 || '');
  const childAdmin2 = normalize(child.admin2 || '');
  return Boolean(parentAdmin2 && parentAdmin2 === childAdmin2);
}

function hasSameLocalAdminArea(first: CitySearchResult, second: CitySearchResult) {
  if (first.admin3Id && second.admin3Id && first.admin3Id === second.admin3Id) return true;
  if (first.admin2Id && second.admin2Id && first.admin2Id === second.admin2Id) return true;

  const firstAdmin3 = normalize(first.admin3 || '');
  const secondAdmin3 = normalize(second.admin3 || '');
  if (firstAdmin3 && firstAdmin3 === secondAdmin3) return true;

  const firstAdmin2 = normalize(first.admin2 || '');
  const secondAdmin2 = normalize(second.admin2 || '');
  return Boolean(firstAdmin2 && firstAdmin2 === secondAdmin2);
}

function hasSameIncompleteAdminArea(first: CitySearchResult, second: CitySearchResult) {
  if (first.admin2 || second.admin2 || first.admin2Id || second.admin2Id) {
    return false;
  }

  if (first.admin1Id && second.admin1Id) {
    return first.admin1Id === second.admin1Id;
  }

  const firstAdmin1 = normalize(first.admin1 || '');
  const secondAdmin1 = normalize(second.admin1 || '');
  return Boolean(firstAdmin1 && firstAdmin1 === secondAdmin1);
}

function getDistanceKm(first: [number, number], second: [number, number]) {
  const [firstLongitude, firstLatitude] = first.map(degreesToRadians);
  const [secondLongitude, secondLatitude] = second.map(degreesToRadians);
  const deltaLatitude = secondLatitude - firstLatitude;
  const deltaLongitude = secondLongitude - firstLongitude;
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(deltaLongitude / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function degreesToRadians(degrees: number) {
  return degrees * Math.PI / 180;
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
