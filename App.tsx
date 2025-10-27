import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import FileUpload from './components/FileUpload';
import Header from './components/Header';
import TrackList from './components/TrackList';
import Visualizer from './components/Visualizer';
import { useDjMixer } from './hooks/useDjMixer';
import { analyzeAudioFile } from './lib/audioAnalysis';
import { getMixPointsFromGemini } from './lib/geminiAnalysis';
import { Track } from './types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './components/ui/Card';
import { Button } from './components/ui/Button';
import PromptSettings from './components/PromptSettings';
import { cacheMixPoints, getCachedMixPoints, initializeAnalysisCache, clearCachedMixPointsForTrack } from './lib/analysisCache';
import AutoDjTimeline from './components/AutoDjTimeline';
import { formatDuration } from './lib/utils';

const DEFAULT_GEMINI_PROMPT_NOTES = `ミックス用ではなく、次の処理に渡す再生区間を出してほしいよ。長いイントロは避け、ビートやメロが立ち上がるポイントを startTime に。フェード処理は別ツールが担当だから endTime は「再生を止めたい位置」だけ教えて。startTime から endTime までの尺は 30〜120 秒に収めてね。`;

const useAnalysisCacheReady = () => {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let isMounted = true;
    initializeAnalysisCache()
      .catch((error) => {
        console.warn('Could not load mix point cache from assets.', error);
      })
      .finally(() => {
        if (isMounted) {
          setReady(true);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return ready;
};

const normalizeMixPoints = (
  mixPoints: { startTime: number; endTime: number },
  duration: number
) => {
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  let startTime = Math.max(0, mixPoints.startTime);
  let endTime = Math.min(Math.max(mixPoints.endTime, startTime), safeDuration);

  if (!Number.isFinite(startTime) || startTime >= safeDuration) {
    startTime = Math.max(0, safeDuration - 60);
  }

  if (!Number.isFinite(endTime) || endTime <= startTime) {
    endTime = Math.min(safeDuration, startTime + 90);
  }

  const minWindow = 20;
  const maxWindow = 120;
  let windowSize = endTime - startTime;

  if (windowSize < minWindow) {
    endTime = Math.min(safeDuration, startTime + minWindow);
    windowSize = endTime - startTime;
  }

  if (windowSize > maxWindow) {
    endTime = Math.min(safeDuration, startTime + maxWindow);
    windowSize = endTime - startTime;
  }

  if (endTime > safeDuration) {
    const overflow = endTime - safeDuration;
    startTime = Math.max(0, startTime - overflow);
    endTime = safeDuration;
  }

  return {
    startTime,
    endTime,
  };
};

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [geminiPromptNotes, setGeminiPromptNotes] = useState(DEFAULT_GEMINI_PROMPT_NOTES);
  const cacheReady = useAnalysisCacheReady();

  useEffect(() => {
    if (!cacheReady) return;
    if ((import.meta as any)?.env?.DEV) {
      console.info('[Flowbeat][App]', 'Cache initialized. Ready to process tracks.');
    }
  }, [cacheReady]);
  const getNextReadyTrack = useCallback(
    (currentTrackId: string | null) => {
      const readyTracks = tracks.filter((track) => track.analysisStatus === 'ready');
      if (readyTracks.length === 0) {
        return null;
      }
      if (!currentTrackId) {
        return readyTracks[0];
      }

      const currentIndex = readyTracks.findIndex((track) => track.id === currentTrackId);
      if (currentIndex === -1) {
        return readyTracks[0] ?? null;
      }

      if (readyTracks.length === 1) {
        return readyTracks[0].id === currentTrackId ? null : readyTracks[0];
      }

      for (let offset = 1; offset <= readyTracks.length; offset++) {
        const candidate = readyTracks[(currentIndex + offset) % readyTracks.length];
        if (candidate.id !== currentTrackId) {
          return candidate;
        }
      }

      return null;
    },
    [tracks]
  );

  const mixer = useDjMixer({ isAutoDj: true, tracks, getNextReadyTrack });

  const handleFilesAdded = useCallback(async (files: FileList) => {
    const newTracks: Track[] = Array.from(files)
        .filter(file => !tracks.some(t => t.id === `${file.name}-${file.lastModified}`))
        .map(file => ({
            id: `${file.name}-${file.lastModified}`,
            file,
            name: file.name,
            duration: 0,
            audioBuffer: mixer.audioContext!.createBuffer(1,1,22050),
            analysisStatus: 'pending',
        }));

    if(newTracks.length > 0) {
        setTracks(prev => [...prev, ...newTracks]);
    }
  }, [tracks, mixer.audioContext]);

  const handleReanalyzeTrack = useCallback((trackId: string) => {
    const target = tracks.find((t) => t.id === trackId);
    if (!target) {
      return;
    }

    clearCachedMixPointsForTrack(target.file, geminiPromptNotes);
    setTracks((prev) =>
      prev.map((t) =>
        t.id === trackId
          ? {
              ...t,
              analysisStatus: 'pending',
              startTime: undefined,
              endTime: undefined,
            }
          : t
      )
    );
    toast.success(`再解析を開始しました: ${target.name}`);
  }, [tracks, geminiPromptNotes]);

  useEffect(() => {
    if (!cacheReady) {
      if ((import.meta as any)?.env?.DEV) {
        console.info('[Flowbeat][App]', 'Waiting for cache to initialize before processing tracks.');
      }
      return;
    }
    tracks.forEach(track => {
      if (track.analysisStatus === 'pending' && mixer.audioContext) {

        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, analysisStatus: 'analyzing' } : t));

        const analyze = async () => {
            try {
                const audioAnalysis = await analyzeAudioFile(track.file, mixer.audioContext!);
                const resolvedDuration = audioAnalysis.duration ?? track.duration;

                if (!resolvedDuration || !Number.isFinite(resolvedDuration)) {
                    throw new Error('Could not determine track duration for analysis.');
                }

                const cachedMix = getCachedMixPoints({
                    file: track.file,
                    prompt: geminiPromptNotes,
                    duration: resolvedDuration,
                });

                if (cachedMix) {
                    if ((import.meta as any)?.env?.DEV) {
                        console.info('[Flowbeat][App]', 'Using cached mix points', {
                            track: track.name,
                            prompt: geminiPromptNotes,
                            startTime: cachedMix.startTime,
                            endTime: cachedMix.endTime,
                        });
                    }
                    setTracks(prev => prev.map(t => t.id === track.id ? {
                        ...t,
                        ...audioAnalysis,
                        ...cachedMix,
                        analysisStatus: 'ready'
                    } : t));
                    toast.success(`Loaded cached analysis for ${track.name}.`);
                    return;
                }

                if ((import.meta as any)?.env?.DEV) {
                    console.info('[Flowbeat][App]', 'Requesting Gemini mix points', {
                        track: track.name,
                        duration: resolvedDuration,
                        prompt: geminiPromptNotes,
                    });
                }

                await toast.promise(
                    getMixPointsFromGemini(track.name, resolvedDuration, geminiPromptNotes),
                    {
                        loading: `Analyzing ${track.name} with Gemini...`,
                        success: (mixPoints) => {
                            const normalized = normalizeMixPoints(mixPoints, resolvedDuration);
                            if ((import.meta as any)?.env?.DEV) {
                                console.info('Gemini mix points', {
                                    track: track.name,
                                    prompt: geminiPromptNotes,
                                    raw: mixPoints,
                                    normalized,
                                });
                            }
                            cacheMixPoints({
                                file: track.file,
                                prompt: geminiPromptNotes,
                                duration: resolvedDuration,
                                startTime: normalized.startTime,
                                endTime: normalized.endTime,
                            });
                            setTracks(prev => prev.map(t => t.id === track.id ? {
                                ...t,
                                ...audioAnalysis,
                                ...normalized,
                                analysisStatus: 'ready'
                            } : t));
                            return `Analysis for ${track.name} complete!`;
                        },
                        error: (err) => {
                            setTracks(prev => prev.map(t => t.id === track.id ? { ...t, analysisStatus: 'error' } : t));
                            return `Could not analyze ${track.name}: ${err.message}`;
                        }
                    }
                );

            } catch (error) {
                console.error('Error analyzing file:', track.name, error);
                setTracks(prev => prev.map(t => t.id === track.id ? { ...t, analysisStatus: 'error' } : t));
                const message = error instanceof Error ? error.message : 'Unknown error occurred.';
                toast.error(`Failed to process ${track.name}. ${message}`);
            }
        }
        analyze();
      }
    });
  }, [tracks, mixer.audioContext, geminiPromptNotes, cacheReady]);

  const orderedReadyTracks = useMemo(
    () => tracks.filter((track) => track.analysisStatus === 'ready'),
    [tracks]
  );

  const { deckA, deckB, currentTimeA, currentTimeB, loadTrack } = mixer;
  const deckATrackId = deckA.track?.id ?? null;
  const deckBTrackId = deckB.track?.id ?? null;
  const activeDeck = deckA.isPlaying ? 'A' : deckB.isPlaying ? 'B' : null;
  const activeTrackId = activeDeck === 'A' ? deckATrackId : activeDeck === 'B' ? deckBTrackId : null;
  const activeTrackProgress = activeDeck === 'A' ? currentTimeA : activeDeck === 'B' ? currentTimeB : 0;
  const upcomingTrack = getNextReadyTrack(activeTrackId);

  useEffect(() => {
    if (!orderedReadyTracks.length) return;

    const activeTrack = activeTrackId
      ? orderedReadyTracks.find((track) => track.id === activeTrackId)
      : null;

    const fallbackTrack =
      orderedReadyTracks.find((track) => track.id === deckATrackId) ??
      orderedReadyTracks.find((track) => track.id === deckBTrackId) ??
      orderedReadyTracks[0];

    const primary = activeTrack ?? fallbackTrack;
    if (!primary) return;

    const primaryDeck =
      deckATrackId === primary.id ? 'A' :
      deckBTrackId === primary.id ? 'B' :
      null;

    if (!primaryDeck) {
      loadTrack('A', primary);
      return;
    }

    const nextAuto = getNextReadyTrack(primary.id);
    const otherDeck = primaryDeck === 'A' ? 'B' : 'A';
    const otherDeckId = otherDeck === 'A' ? deckATrackId : deckBTrackId;

    if (nextAuto) {
      if (otherDeckId !== nextAuto.id) {
        loadTrack(otherDeck, nextAuto);
      }
    } else if (otherDeckId) {
      loadTrack(otherDeck, null);
    }
  }, [
    orderedReadyTracks,
    activeTrackId,
    deckATrackId,
    deckBTrackId,
    getNextReadyTrack,
    loadTrack,
  ]);

  const handleRemoveTrack = (trackId: string) => {
    const target = tracks.find((t) => t.id === trackId);
    if (target) {
      clearCachedMixPointsForTrack(target.file);
    }
    setTracks(tracks => tracks.filter(t => t.id !== trackId));
    if (mixer.deckA.track?.id === trackId) mixer.loadTrack('A', null);
    if (mixer.deckB.track?.id === trackId) mixer.loadTrack('B', null);
  };


  const activeTrack = activeTrackId
    ? tracks.find((track) => track.id === activeTrackId) ?? null
    : null;
  const activeMixStart = activeTrack?.startTime ?? 0;
  const activeMixEnd = activeTrack?.endTime ?? activeTrack?.duration ?? 0;
  const activeMixLength = Math.max(0, activeMixEnd - activeMixStart);
  const activeElapsed = activeTrack
    ? Math.max(
        0,
        (activeDeck === 'A' ? mixer.currentTimeA : mixer.currentTimeB) - activeMixStart
      )
    : 0;
  const activeRemaining = activeTrack
    ? Math.max(0, activeMixLength - activeElapsed)
    : 0;

  const deckAssignments = {
    A: deckATrackId,
    B: deckBTrackId,
  } as const;

  const currentTimes = {
    A: mixer.currentTimeA,
    B: mixer.currentTimeB,
  } as const;

  const hasReadyTracks = orderedReadyTracks.length > 0;

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: 'hsl(240 3.7% 15.9%)',
            color: 'hsl(0 0% 98%)',
            border: '1px solid hsl(240 3.7% 15.9%)',
          },
        }}
      />
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid gap-8">
          <div className="grid gap-6 lg:grid-cols-4">
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <FileUpload onFilesAdded={handleFilesAdded} />
                </CardContent>
              </Card>
              <PromptSettings prompt={geminiPromptNotes} onPromptChange={setGeminiPromptNotes} />
              <Card>
                <CardHeader>
                  <CardTitle>AI DJ Status</CardTitle>
                  <CardDescription>Auto-mixing with Gemini cue points.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Now Playing</p>
                    {activeTrack ? (
                      <div className="mt-1 space-y-1">
                        <p className="text-sm font-medium">{activeTrack.name}</p>
                        <div className="flex items-center text-xs text-muted-foreground gap-3">
                          <span>Deck {activeDeck}</span>
                          <span>
                            {formatDuration(Math.max(0, activeElapsed))} / {formatDuration(activeMixLength)}
                          </span>
                          <span>残り {formatDuration(activeRemaining)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">No track is currently active.</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Up Next</p>
                    {upcomingTrack ? (
                      <p className="mt-1 text-sm font-medium">{upcomingTrack.name}</p>
                    ) : (
                      <p className="mt-1 text-sm text-muted-foreground">Add more ready tracks to build the queue.</p>
                    )}
                  </div>
                  <div className="pt-2">
                    <Button
                      className="w-full"
                      onClick={mixer.handlePlayPause}
                      disabled={!hasReadyTracks}
                    >
                      {mixer.isPlaying ? 'Pause Mix' : 'Start Mix'}
                    </Button>
                    {!hasReadyTracks && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Upload tracks and wait for analysis to enable Auto DJ playback.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-3 space-y-4">
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Real-time Mix Timeline</CardTitle>
                  <CardDescription>
                    Segments overlap where crossfades occur. Colors indicate the active deck and upcoming transitions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Visualizer analyserNode={mixer.masterAnalyserNode} />
                  <AutoDjTimeline
                    queue={orderedReadyTracks}
                    activeTrackId={activeTrackId}
                    nextTrackId={upcomingTrack?.id ?? null}
                    deckAssignments={deckAssignments}
                    currentTimes={currentTimes}
                  />
                </CardContent>
              </Card>

              <TrackList
                tracks={tracks}
                activeTrackId={activeTrackId}
                nextTrackId={upcomingTrack?.id ?? null}
                onRemoveTrack={handleRemoveTrack}
                onReanalyzeTrack={handleReanalyzeTrack}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
