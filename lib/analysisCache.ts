type PromptCacheEntry = {
  startTime: number;
  fadeOutTime: number;
  duration: number;
  updatedAt: number;
};

type CacheStore = Record<string, Record<string, PromptCacheEntry>>;

const ASSET_CACHE_URL = '/assets/mixpoints.json';

const isBrowserEnvironment = (): boolean => typeof window !== 'undefined';

let inMemoryCache: CacheStore = {};
let initialized = false;
let initializationPromise: Promise<void> | null = null;

const hashString = (value: string): string => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const getPromptHash = (prompt: string): string => hashString(prompt.trim());

const getTrackCacheKey = (file: File): string => {
  const parts = [file.name, file.size.toString(), file.lastModified.toString()];
  return parts.join('::');
};

const safeParse = (raw: string | null): CacheStore => {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed) {
      return parsed;
    }
    return {};
  } catch (error) {
    console.warn('Failed to parse mix point cache JSON.', error);
    return {};
  }
};

const readCache = (): CacheStore => inMemoryCache;

const loadCacheFromAsset = async () => {
  if (!isBrowserEnvironment()) {
    initialized = true;
    return;
  }

  try {
    const response = await fetch(ASSET_CACHE_URL, { cache: 'no-cache' });
    if (response.ok) {
      const text = await response.text();
      inMemoryCache = safeParse(text);
    } else {
      console.warn(`Failed to load mix point cache asset (${response.status}).`);
      inMemoryCache = {};
    }
  } catch (error) {
    console.warn('Could not load mix point cache asset.', error);
    inMemoryCache = {};
  } finally {
    initialized = true;
    initializationPromise = null;
  }
};

export const initializeAnalysisCache = async () => {
  if (initialized) {
    return;
  }
  if (!initializationPromise) {
    initializationPromise = loadCacheFromAsset();
  }
  return initializationPromise;
};

export const getCachedMixPoints = ({
  file,
  prompt,
  duration,
  toleranceSeconds = 1,
}: {
  file: File;
  prompt: string;
  duration: number;
  toleranceSeconds?: number;
}): { startTime: number; fadeOutTime: number } | null => {
  const cache = readCache();
  const trackKey = getTrackCacheKey(file);
  const promptHash = getPromptHash(prompt);
  const trackEntry = cache[trackKey];
  if (!trackEntry) {
    return null;
  }
  const promptEntry = trackEntry[promptHash];
  if (!promptEntry) {
    return null;
  }
  if (Math.abs(promptEntry.duration - duration) > toleranceSeconds) {
    return null;
  }

  return { startTime: promptEntry.startTime, fadeOutTime: promptEntry.fadeOutTime };
};

export const cacheMixPoints = ({
  file,
  prompt,
  duration,
  startTime,
  fadeOutTime,
}: {
  file: File;
  prompt: string;
  duration: number;
  startTime: number;
  fadeOutTime: number;
}) => {
  const cache = { ...readCache() };
  const trackKey = getTrackCacheKey(file);
  const promptHash = getPromptHash(prompt);

  const trackEntry = cache[trackKey] ? { ...cache[trackKey] } : {};

  trackEntry[promptHash] = {
    duration,
    startTime,
    fadeOutTime,
    updatedAt: Date.now(),
  };

  cache[trackKey] = trackEntry;
  inMemoryCache = cache;
};

export const clearCachedMixPointsForTrack = (file: File, prompt?: string) => {
  const cache = { ...readCache() };
  const trackKey = getTrackCacheKey(file);
  if (!cache[trackKey]) {
    return;
  }

  if (prompt) {
    const promptHash = getPromptHash(prompt);
    if (cache[trackKey][promptHash]) {
      const { [promptHash]: _removed, ...rest } = cache[trackKey];
      if (Object.keys(rest).length === 0) {
        delete cache[trackKey];
      } else {
        cache[trackKey] = rest;
      }
      inMemoryCache = cache;
    }
    return;
  }

  delete cache[trackKey];
  inMemoryCache = cache;
};

export const getCacheSnapshot = (): CacheStore => ({ ...readCache() });
