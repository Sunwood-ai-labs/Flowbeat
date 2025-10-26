import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import FileUpload from './components/FileUpload';
import Header from './components/Header';
import PlayerControls from './components/PlayerControls';
import TrackList from './components/TrackList';
import Visualizer from './components/Visualizer';
import { useDjMixer } from './hooks/useDjMixer';
import { analyzeAudioFile } from './lib/audioAnalysis';
import { getMixPointsFromGemini } from './lib/geminiAnalysis';
import { Track } from './types';
import { Card, CardContent } from './components/ui/Card';
import PromptSettings from './components/PromptSettings';
import TransitionTimeline from './components/TransitionTimeline';
import { cacheMixPoints, getCachedMixPoints, initializeAnalysisCache, clearCachedMixPointsForTrack } from './lib/analysisCache';

const DEFAULT_GEMINI_PROMPT_NOTES = `ミックスはタイトに。次の曲のグルーヴが立ち上がってから 8〜12 秒以内に再生を開始し、最後のサビが終わった瞬間にクロスフェードを開始してください（終端の 12〜18 秒前が目安）。エネルギーが落ちるブレイク中のフェードは避けてください。`;

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
  mixPoints: { startTime: number; fadeOutTime: number },
  duration: number
) => {
  let startTime = Math.max(0, mixPoints.startTime);
  let fadeOutTime = Math.min(mixPoints.fadeOutTime, duration - 10);

  if (!Number.isFinite(fadeOutTime) || fadeOutTime <= 0) {
    fadeOutTime = Math.max(duration - 14, duration * 0.85);
  }

  if (fadeOutTime <= startTime) {
    fadeOutTime = Math.min(duration - 10, Math.max(startTime + 12, duration * 0.85));
  }

  const minWindow = 8;
  const maxWindow = 18;
  const currentWindow = fadeOutTime - startTime;

  if (currentWindow < minWindow) {
    startTime = Math.max(0, fadeOutTime - minWindow);
  } else if (currentWindow > maxWindow) {
    startTime = Math.max(0, fadeOutTime - maxWindow);
  }

  return {
    startTime,
    fadeOutTime,
  };
};

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isAutoDj, setIsAutoDj] = useState(false);
  const [geminiPromptNotes, setGeminiPromptNotes] = useState(DEFAULT_GEMINI_PROMPT_NOTES);
  const cacheReady = useAnalysisCacheReady();
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

  const mixer = useDjMixer({ isAutoDj, tracks, getNextReadyTrack });

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
              fadeOutTime: undefined,
            }
          : t
      )
    );
    toast.success(`再解析を開始しました: ${target.name}`);
  }, [tracks, geminiPromptNotes]);

  useEffect(() => {
    if (!cacheReady) {
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
                    console.info('Requesting Gemini mix points', {
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
                                fadeOutTime: normalized.fadeOutTime,
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
    if (!isAutoDj) return;
    if (!orderedReadyTracks.length) return;

    const primary = orderedReadyTracks.find((track) => track.id === deckATrackId) ?? orderedReadyTracks[0];

    if (primary && deckATrackId !== primary.id) {
      loadTrack('A', primary);
      return;
    }

    const nextAuto = primary ? getNextReadyTrack(primary.id) : null;

    if (nextAuto) {
      if (deckBTrackId !== nextAuto.id) {
        loadTrack('B', nextAuto);
      }
    } else if (deckBTrackId) {
      loadTrack('B', null);
    }
  }, [isAutoDj, orderedReadyTracks, deckATrackId, deckBTrackId, getNextReadyTrack, loadTrack]);

  const handleRemoveTrack = (trackId: string) => {
    const target = tracks.find((t) => t.id === trackId);
    if (target) {
      clearCachedMixPointsForTrack(target.file);
    }
    setTracks(tracks => tracks.filter(t => t.id !== trackId));
    if (mixer.deckA.track?.id === trackId) mixer.loadTrack('A', null);
    if (mixer.deckB.track?.id === trackId) mixer.loadTrack('B', null);
  };


  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <Toaster position="top-center" toastOptions={{
          style: {
            background: 'hsl(240 3.7% 15.9%)',
            color: 'hsl(0 0% 98%)',
            border: '1px solid hsl(240 3.7% 15.9%)',
          }
      }} />
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid gap-8">
          <Visualizer analyserNode={mixer.masterAnalyserNode} />

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1 space-y-4">
              <Card>
                  <CardContent className="p-4">
                    <FileUpload onFilesAdded={handleFilesAdded} />
                  </CardContent>
              </Card>
              <PromptSettings prompt={geminiPromptNotes} onPromptChange={setGeminiPromptNotes} />
            </div>
            <div className="md:col-span-2 space-y-4">
                <TrackList
                    tracks={tracks}
                    onLoadToDeckA={(track) => mixer.loadTrack('A', track)}
                    onLoadToDeckB={(track) => mixer.loadTrack('B', track)}
                    onRemoveTrack={handleRemoveTrack}
                    onReanalyzeTrack={handleReanalyzeTrack}
                />
                <TransitionTimeline
                  queue={orderedReadyTracks}
                  activeTrackId={activeTrackId}
                  nextTrackId={upcomingTrack?.id ?? null}
                  activeTrackProgress={activeTrackProgress}
                  isAutoDj={isAutoDj}
                  deckAId={deckATrackId}
                  deckBId={deckBTrackId}
                />
            </div>
          </div>

          <PlayerControls
            deckA={mixer.deckA}
            deckB={mixer.deckB}
            currentTimeA={mixer.currentTimeA}
            currentTimeB={mixer.currentTimeB}
            isPlaying={mixer.isPlaying}
            crossfade={mixer.crossfade}
            isAutoDj={isAutoDj}
            onPlayPause={mixer.handlePlayPause}
            onCrossfadeChange={mixer.setCrossfade}
            onVolumeChange={mixer.setVolume}
            onAutoDjChange={setIsAutoDj}
          />

        </div>
      </main>
    </div>
  );
}

export default App;
