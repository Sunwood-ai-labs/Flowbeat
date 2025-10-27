type PromptCacheEntry = {
  startTime: number;
  endTime: number;
  duration: number;
  updatedAt: number;
};

type CacheStore = Record<string, Record<string, PromptCacheEntry>>;

const ASSET_CACHE_URL = '/assets/mixpoints.json';

const isBrowserEnvironment = (): boolean => typeof window !== 'undefined';

let inMemoryCache: CacheStore = {};
let initialized = false;
let initializationPromise: Promise<void> | null = null;
let syncTimeoutHandle: number | null = null;

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

const log = (...args: unknown[]) => {
  if (typeof window === 'undefined') return;
  // eslint-disable-next-line no-console
  console.info('[Flowbeat][Cache]', ...args);
};

const loadCacheFromAsset = async () => {
  if (!isBrowserEnvironment()) {
    initialized = true;
    return;
  }

  log('Loading cache from', ASSET_CACHE_URL);

  try {
    const response = await fetch(ASSET_CACHE_URL, { cache: 'no-cache' });
    if (response.ok) {
      const text = await response.text();
      inMemoryCache = safeParse(text);
      const trackCount = Object.keys(inMemoryCache).length;
      log('Cache load complete. Track keys:', trackCount);
      if (trackCount === 0) {
        log('Cache is currently empty. New analyses will populate public/assets/mixpoints.json.');
      }
    } else {
      console.warn(`[Flowbeat][Cache] Failed to load asset (${response.status} ${response.statusText}).`);
      inMemoryCache = {};
    }
  } catch (error) {
    console.warn('[Flowbeat][Cache] Could not load asset.', error);
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

const scheduleAssetSync = () => {
  if (!isBrowserEnvironment()) {
    log('Skipping asset sync (no window environment).');
    return;
  }

  const envInfo = (import.meta as any)?.env ?? {};
  log('Preparing asset sync. Runtime env:', {
    MODE: envInfo.MODE,
    DEV: envInfo.DEV,
    PROD: envInfo.PROD,
  });

  if (typeof fetch === 'undefined') {
    log('Skipping asset sync (fetch unavailable).');
    return;
  }

  if (syncTimeoutHandle !== null) {
    log('Asset sync already scheduled. Skipping new request.');
    return;
  }

  log('Queueing asset sync...');

  syncTimeoutHandle = window.setTimeout(async () => {
    syncTimeoutHandle = null;
    log('Syncing cache to asset file...');
    try {
      const response = await fetch('/api/mixpoints-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(readCache(), null, 2),
      });
      if (!response.ok) {
        console.warn('[Flowbeat][Cache] Failed to persist asset file.', response.status, await response.text().catch(() => ''));
      } else {
        log('Asset file updated successfully.');
      }
    } catch (error) {
      console.warn('[Flowbeat][Cache] Could not persist asset file.', error);
    }
  }, 300);
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
}): { startTime: number; endTime: number } | null => {
  const cache = readCache();
  const trackKey = getTrackCacheKey(file);
  const promptHash = getPromptHash(prompt);
  const trackEntry = cache[trackKey];
  if (!trackEntry) {
    return null;
  }
  let promptEntry = trackEntry[promptHash];
  if (!promptEntry) {
    for (const [altHash, altEntry] of Object.entries(trackEntry)) {
      if (altHash === promptHash) {
        continue;
      }
      if (Math.abs(altEntry.duration - duration) > toleranceSeconds) {
        continue;
      }

      cacheMixPoints({
        file,
        prompt,
        duration: altEntry.duration,
        startTime: altEntry.startTime,
        endTime: altEntry.endTime,
      });
      promptEntry = altEntry;
      break;
    }

    if (!promptEntry) {
      return null;
    }
  }
  if (Math.abs(promptEntry.duration - duration) > toleranceSeconds) {
    return null;
  }

  return { startTime: promptEntry.startTime, endTime: promptEntry.endTime };
};

export const cacheMixPoints = ({
  file,
  prompt,
  duration,
  startTime,
  endTime,
}: {
  file: File;
  prompt: string;
  duration: number;
  startTime: number;
  endTime: number;
}) => {
  const cache = { ...readCache() };
  const trackKey = getTrackCacheKey(file);
  const promptHash = getPromptHash(prompt);

  const trackEntry = cache[trackKey] ? { ...cache[trackKey] } : {};

  trackEntry[promptHash] = {
    duration,
    startTime,
    endTime,
    updatedAt: Date.now(),
  };

  cache[trackKey] = trackEntry;
  inMemoryCache = cache;
  log('Cached mix points', {
    trackKey,
    promptHash,
    startTime,
    endTime,
  });
  scheduleAssetSync();
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
      log('Cleared cached mix points for prompt', { trackKey, promptHash });
      scheduleAssetSync();
    }
    return;
  }

  delete cache[trackKey];
  inMemoryCache = cache;
  log('Cleared cached mix points for track', { trackKey });
  scheduleAssetSync();
};

export const getCacheSnapshot = (): CacheStore => ({ ...readCache() });
