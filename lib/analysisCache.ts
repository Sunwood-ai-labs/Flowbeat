type PromptCacheEntry = {
  startTime: number;
  fadeOutTime: number;
  duration: number;
  updatedAt: number;
};

type CacheStore = Record<string, Record<string, PromptCacheEntry>>;

const CACHE_STORAGE_KEY = 'flowbeat.mixpoints.cache';

const isBrowserEnvironment = (): boolean => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

let inMemoryCache: CacheStore | null = null;

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
    console.warn('Failed to parse mix point cache; starting fresh.', error);
    return {};
  }
};

const readCache = (): CacheStore => {
  if (isBrowserEnvironment()) {
    if (inMemoryCache) {
      return inMemoryCache;
    }
    const raw = window.localStorage.getItem(CACHE_STORAGE_KEY);
    inMemoryCache = safeParse(raw);
    return inMemoryCache;
  }

  if (!inMemoryCache) {
    inMemoryCache = {};
  }
  return inMemoryCache;
};

const writeCache = (cache: CacheStore) => {
  inMemoryCache = cache;
  if (!isBrowserEnvironment()) {
    return;
  }
  try {
    window.localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(cache));
  } catch (error) {
    console.warn('Failed to persist mix point cache.', error);
  }
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
  writeCache(cache);
};

export const clearCachedMixPointsForTrack = (file: File) => {
  const cache = { ...readCache() };
  const trackKey = getTrackCacheKey(file);
  if (cache[trackKey]) {
    delete cache[trackKey];
    writeCache(cache);
  }
};

