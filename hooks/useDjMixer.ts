import { useReducer, useRef, useState, useCallback, useEffect } from 'react';
import { Deck, Track } from '../types';

const CROSSFADE_DURATION = 10; // seconds

const createNewDeck = (audioContext: AudioContext): Deck => {
  const gainNode = audioContext.createGain();
  const analyserNode = audioContext.createAnalyser();
  analyserNode.fftSize = 2048;
  gainNode.connect(analyserNode);
  return {
    track: null,
    sourceNode: null,
    gainNode,
    analyserNode,
    volume: 1,
    isPlaying: false,
    startTime: 0,
    startOffset: 0,
  };
};

type MixerState = {
  deckA: Deck;
  deckB: Deck;
  crossfade: number; // -1 for Deck A, 1 for Deck B, 0 for center
  isPlaying: boolean;
};

type Action =
  | { type: 'LOAD_TRACK'; deck: 'A' | 'B'; track: Track | null }
  | { type: 'SET_VOLUME'; deck: 'A' | 'B'; volume: number }
  | { type: 'SET_CROSSFADE'; value: number }
  | { type: 'PLAY' }
  | { type: 'PAUSE' }
  | { type: 'SET_DECK_STATE'; deck: 'A' | 'B'; state: Partial<Deck> };

const mixerReducer = (state: MixerState, action: Action): MixerState => {
  const deckKey = 'deck' in action ? (action.deck === 'A' ? 'deckA' : 'deckB') : null;

  switch (action.type) {
    case 'LOAD_TRACK':
      return {
        ...state,
        [deckKey!]: {
          ...state[deckKey!],
          track: action.track,
          isPlaying: false,
          startOffset: action.track?.startTime || 0,
          startTime: 0,
        },
      };
    case 'SET_VOLUME':
      return { ...state, [deckKey!]: { ...state[deckKey!], volume: action.volume } };
    case 'SET_CROSSFADE':
      return { ...state, crossfade: action.value };
    case 'PLAY':
      return { ...state, isPlaying: true };
    case 'PAUSE':
      return { ...state, isPlaying: false };
    case 'SET_DECK_STATE':
      return { ...state, [deckKey!]: { ...state[deckKey!], ...action.state } };
    default:
      return state;
  }
};

export const useDjMixer = ({
  isAutoDj,
  tracks,
  getNextReadyTrack,
}: {
  isAutoDj: boolean;
  tracks: Track[];
  getNextReadyTrack?: (currentTrackId: string | null) => Track | null;
}) => {
  // Use a single useState lazy initializer for all synchronous setup.
  const [mixerSetup] = useState(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master nodes
    const crossfaderNode = audioContext.createGain();
    const masterGainNode = audioContext.createGain();
    const masterAnalyserNode = audioContext.createAnalyser();
    masterAnalyserNode.fftSize = 2048;

    crossfaderNode.connect(masterGainNode);
    masterGainNode.connect(masterAnalyserNode);
    masterAnalyserNode.connect(audioContext.destination);

    // Initial state for the reducer
    const initialState: MixerState = {
        deckA: createNewDeck(audioContext),
        deckB: createNewDeck(audioContext),
        crossfade: 0,
        isPlaying: false,
    };
    
    return {
        audioContext,
        crossfaderNode,
        masterGainNode,
        masterAnalyserNode,
        initialState
    };
  });

  const { audioContext, crossfaderNode, masterAnalyserNode, initialState } = mixerSetup;
  
  const [state, dispatch] = useReducer(mixerReducer, initialState);

  const animationFrameRef = useRef<number | null>(null);
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);
  const autoDjState = useRef({ isFading: false });

  const playDeck = useCallback((deck: 'A' | 'B', offset?: number) => {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const deckState = deck === 'A' ? state.deckA : state.deckB;
    if (!deckState.track || deckState.isPlaying) return;

    const source = audioContext.createBufferSource();
    source.buffer = deckState.track.audioBuffer;
    source.connect(deckState.gainNode);
    const startOffset = offset ?? deckState.startOffset;
    source.start(0, startOffset % deckState.track.duration);

    dispatch({
      type: 'SET_DECK_STATE',
      deck,
      state: { sourceNode: source, isPlaying: true, startTime: audioContext.currentTime, startOffset },
    });
  }, [state.deckA, state.deckB, audioContext]);

  const pauseDeck = useCallback((deck: 'A' | 'B') => {
    const deckState = deck === 'A' ? state.deckA : state.deckB;
    if (!deckState.sourceNode || !deckState.isPlaying) return;

    deckState.sourceNode.stop(0);
    const elapsedTime = audioContext.currentTime - deckState.startTime;
    const newOffset = (deckState.startOffset + elapsedTime);

    dispatch({
      type: 'SET_DECK_STATE',
      deck,
      state: { sourceNode: null, isPlaying: false, startOffset: newOffset >= deckState.track!.duration ? 0 : newOffset },
    });
  }, [state.deckA, state.deckB, audioContext]);

  const handlePlayPause = useCallback(() => {
    if (state.isPlaying) {
      if(state.deckA.isPlaying) pauseDeck('A');
      if(state.deckB.isPlaying) pauseDeck('B');
      dispatch({ type: 'PAUSE' });
    } else {
      const deckToPlay = state.deckA.track && !state.deckA.isPlaying ? 'A' : (state.deckB.track && !state.deckB.isPlaying ? 'B' : null);
      if(deckToPlay) {
        playDeck(deckToPlay);
        dispatch({ type: 'PLAY' });
      }
    }
  }, [state.isPlaying, state.deckA, state.deckB, playDeck, pauseDeck]);

  const loadTrack = useCallback((deck: 'A' | 'B', track: Track | null) => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const currentDeck = state[deckKey];
    if (currentDeck.sourceNode) {
        currentDeck.sourceNode.stop(0);
    }
    dispatch({ type: 'LOAD_TRACK', deck, track });
  }, [state.deckA, state.deckB]);

  const setVolume = useCallback((deck: 'A' | 'B', volume: number) => {
    dispatch({ type: 'SET_VOLUME', deck, volume });
  }, []);

  const setCrossfade = useCallback((value: number) => {
    dispatch({ type: 'SET_CROSSFADE', value });
  }, []);
  
  // Connect decks to crossfader
  useEffect(() => {
    state.deckA.gainNode.connect(crossfaderNode);
    state.deckB.gainNode.connect(crossfaderNode);
    return () => {
        try {
            state.deckA.gainNode.disconnect();
            state.deckB.gainNode.disconnect();
        } catch(e) {
            console.warn("Could not disconnect nodes cleanly on cleanup.");
        }
    }
  }, [state.deckA.gainNode, state.deckB.gainNode, crossfaderNode]);

  // Effect to handle crossfade audio changes
  useEffect(() => {
    const gainA = Math.cos((state.crossfade + 1) * 0.25 * Math.PI);
    const gainB = Math.cos((1 - state.crossfade) * 0.25 * Math.PI);
    state.deckA.gainNode.gain.setTargetAtTime(gainA * state.deckA.volume, audioContext.currentTime, 0.01);
    state.deckB.gainNode.gain.setTargetAtTime(gainB * state.deckB.volume, audioContext.currentTime, 0.01);
  }, [state.crossfade, state.deckA.volume, state.deckB.volume, state.deckA.gainNode, state.deckB.gainNode, audioContext]);


  // Time-update and AutoDJ logic
  useEffect(() => {
    const update = () => {
      let activeDeck: 'A' | 'B' | null = null;
      if (state.deckA.isPlaying) activeDeck = 'A';
      else if (state.deckB.isPlaying) activeDeck = 'B';
      
      const currentTimeA = state.deckA.isPlaying ? state.deckA.startOffset + (audioContext.currentTime - state.deckA.startTime) : state.deckA.startOffset;
      const currentTimeB = state.deckB.isPlaying ? state.deckB.startOffset + (audioContext.currentTime - state.deckB.startTime) : state.deckB.startOffset;

      setCurrentTimeA(currentTimeA);
      setCurrentTimeB(currentTimeB);

      if (isAutoDj && activeDeck && !autoDjState.current.isFading) {
        const activeDeckState = activeDeck === 'A' ? state.deckA : state.deckB;
        const currentTime = activeDeck === 'A' ? currentTimeA : currentTimeB;

        if (activeDeckState.track?.endTime && currentTime >= activeDeckState.track.endTime) {
          const nextDeck: 'A' | 'B' = activeDeck === 'A' ? 'B' : 'A';
            const nextDeckState = nextDeck === 'A' ? state.deckA : state.deckB;

          const candidateFromCallback = getNextReadyTrack
            ? getNextReadyTrack(activeDeckState.track?.id ?? null)
            : undefined;

          let nextTrack: Track | undefined;

          if (candidateFromCallback && candidateFromCallback.id !== activeDeckState.track?.id) {
            nextTrack = candidateFromCallback;
          } else if (
            nextDeckState.track &&
            nextDeckState.track.analysisStatus === 'ready' &&
            nextDeckState.track.id !== activeDeckState.track?.id
          ) {
            nextTrack = nextDeckState.track;
          } else if (activeDeckState.track) {
            const currentIndex = tracks.findIndex((t) => t.id === activeDeckState.track!.id);

            const findFrom = (start: number, end: number, step: number) => {
              for (let i = start; i !== end; i += step) {
                const candidate = tracks[i];
                if (
                  candidate &&
                  candidate.analysisStatus === 'ready' &&
                  candidate.id !== activeDeckState.track!.id
                ) {
                  return candidate;
                }
              }
              return undefined;
            };

            if (currentIndex >= 0) {
              nextTrack =
                findFrom(currentIndex + 1, tracks.length, 1) ??
                findFrom(0, currentIndex, 1);
            } else {
              nextTrack = tracks.find(
                (candidate) => candidate.analysisStatus === 'ready'
              );
            }
          }

            if (nextTrack && nextTrack.id === activeDeckState.track?.id) {
            nextTrack = undefined;
          }

          if (nextTrack) {
            autoDjState.current.isFading = true;
            if (nextDeckState.track?.id !== nextTrack.id) {
              loadTrack(nextDeck, nextTrack);
            }

            setTimeout(() => {
              // Gives a moment for the track to load
              const now = audioContext.currentTime;
              const upcomingGainNode = nextDeck === 'A' ? state.deckA.gainNode : state.deckB.gainNode;
              const currentGainNode = activeDeck === 'A' ? state.deckA.gainNode : state.deckB.gainNode;
              const currentVolume = activeDeck === 'A' ? state.deckA.volume : state.deckB.volume;

              upcomingGainNode.gain.cancelScheduledValues(now);
              upcomingGainNode.gain.setValueAtTime(0, now);

              currentGainNode.gain.cancelScheduledValues(now);
              currentGainNode.gain.setValueAtTime(currentVolume, now);

              const start = activeDeck === 'A' ? -1 : 1;
              setCrossfade(start);

              playDeck(nextDeck, nextTrack!.startTime ?? 0);

              const targetFade = nextDeck === 'B' ? 1 : -1;
              const fadeStartTime = performance.now();

              const animateFade = (now: number) => {
                const elapsed = (now - fadeStartTime) / 1000;
                const progress = Math.min(elapsed / CROSSFADE_DURATION, 1);
                const newValue = start + (targetFade - start) * progress;
                setCrossfade(newValue);
                if (progress < 1) {
                  requestAnimationFrame(animateFade);
                } else {
                  pauseDeck(activeDeck!);
                  loadTrack(activeDeck!, null);
                  autoDjState.current.isFading = false;
                }
              };
              requestAnimationFrame(animateFade);
            }, 100);
          }
        }
      }

      if(state.deckA.track && currentTimeA >= state.deckA.track.duration) pauseDeck('A');
      if(state.deckB.track && currentTimeB >= state.deckB.track.duration) pauseDeck('B');

      animationFrameRef.current = requestAnimationFrame(update);
    };

    if(state.deckA.isPlaying || state.deckB.isPlaying) {
      if(!state.isPlaying) dispatch({type: 'PLAY'});
      animationFrameRef.current = requestAnimationFrame(update);
    } else {
      if(state.isPlaying) dispatch({type: 'PAUSE'});
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    }

    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [state.isPlaying, state.deckA, state.deckB, isAutoDj, tracks, loadTrack, pauseDeck, playDeck, setCrossfade, audioContext, getNextReadyTrack]);

  return {
    ...state,
    audioContext,
    currentTimeA,
    currentTimeB,
    masterAnalyserNode,
    loadTrack,
    handlePlayPause,
    setVolume,
    setCrossfade,
  };
};
