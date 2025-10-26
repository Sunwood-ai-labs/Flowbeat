
import { useReducer, useRef, useState, useCallback, useEffect } from 'react';
import { Deck, Track } from '../types';

const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

const createNewDeck = (): Deck => {
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

const crossfaderNode = audioContext.createGain();
const masterGainNode = audioContext.createGain();
const masterAnalyserNode = audioContext.createAnalyser();
masterAnalyserNode.fftSize = 2048;

crossfaderNode.connect(masterGainNode);
masterGainNode.connect(masterAnalyserNode);
masterAnalyserNode.connect(audioContext.destination);

type MixerState = {
  deckA: Deck;
  deckB: Deck;
  crossfade: number; // -1 for Deck A, 1 for Deck B, 0 for center
  masterVolume: number;
  isPlaying: boolean;
};

type Action =
  | { type: 'LOAD_TRACK'; deck: 'A' | 'B'; track: Track }
  | { type: 'SET_VOLUME'; deck: 'A' | 'B'; volume: number }
  | { type: 'SET_MASTER_VOLUME'; volume: number }
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
          startOffset: 0,
          startTime: 0,
        },
      };
    case 'SET_VOLUME':
      // The gain will be updated by the crossfader logic
      return { ...state, [deckKey!]: { ...state[deckKey!], volume: action.volume } };
    case 'SET_MASTER_VOLUME':
      masterGainNode.gain.setValueAtTime(action.volume, audioContext.currentTime);
      return { ...state, masterVolume: action.volume };
    case 'SET_CROSSFADE':
      const gainA = Math.cos((action.value + 1) * 0.25 * Math.PI);
      const gainB = Math.cos((1 - action.value) * 0.25 * Math.PI);
      state.deckA.gainNode.gain.setValueAtTime(gainA * state.deckA.volume, audioContext.currentTime);
      state.deckB.gainNode.gain.setValueAtTime(gainB * state.deckB.volume, audioContext.currentTime);
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

export const useDjMixer = () => {
  const [state, dispatch] = useReducer(mixerReducer, {
    deckA: createNewDeck(),
    deckB: createNewDeck(),
    crossfade: 0,
    masterVolume: 1,
    isPlaying: false,
  });

  const animationFrameRef = useRef<number>();
  const [currentTimeA, setCurrentTimeA] = useState(0);
  const [currentTimeB, setCurrentTimeB] = useState(0);

  const playDeck = (deck: 'A' | 'B') => {
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    const deckState = deck === 'A' ? state.deckA : state.deckB;
    if (!deckState.track || deckState.isPlaying) return;

    const source = audioContext.createBufferSource();
    source.buffer = deckState.track.audioBuffer;
    source.connect(deckState.gainNode);
    source.start(0, deckState.startOffset % deckState.track.duration);

    dispatch({
      type: 'SET_DECK_STATE',
      deck,
      state: {
        sourceNode: source,
        isPlaying: true,
        startTime: audioContext.currentTime,
      },
    });
  };

  const pauseDeck = (deck: 'A' | 'B') => {
    const deckState = deck === 'A' ? state.deckA : state.deckB;
    if (!deckState.sourceNode || !deckState.isPlaying) return;

    deckState.sourceNode.stop();
    const elapsedTime = audioContext.currentTime - deckState.startTime;
    const newOffset = (deckState.startOffset + elapsedTime) % deckState.track!.duration;

    dispatch({
      type: 'SET_DECK_STATE',
      deck,
      state: {
        sourceNode: null,
        isPlaying: false,
        startOffset: newOffset,
      },
    });
  };

  const handlePlayPause = useCallback(() => {
    if (state.isPlaying) {
      if(state.deckA.isPlaying) pauseDeck('A');
      if(state.deckB.isPlaying) pauseDeck('B');
      dispatch({ type: 'PAUSE' });
    } else {
      if(state.deckA.track) playDeck('A');
      if(state.deckB.track) playDeck('B');
      dispatch({ type: 'PLAY' });
    }
  }, [state.isPlaying, state.deckA, state.deckB]);

  const loadTrack = useCallback((deck: 'A' | 'B', track: Track) => {
    const deckKey = deck === 'A' ? 'deckA' : 'deckB';
    const currentDeck = state[deckKey];
    if (currentDeck.sourceNode) {
        currentDeck.sourceNode.stop();
    }
    dispatch({ type: 'LOAD_TRACK', deck, track });
  }, [state.deckA, state.deckB]);

  const setVolume = useCallback((deck: 'A' | 'B', volume: number) => {
    dispatch({ type: 'SET_VOLUME', deck, volume });
    // Re-apply crossfade to update gain
    dispatch({ type: 'SET_CROSSFADE', value: state.crossfade });
  }, [state.crossfade]);

  const setMasterVolume = useCallback((volume: number) => {
    dispatch({ type: 'SET_MASTER_VOLUME', volume });
  }, []);

  const setCrossfade = useCallback((value: number) => {
    dispatch({ type: 'SET_CROSSFADE', value });
  }, []);
  
  // Connect decks to crossfader
  useEffect(() => {
    state.deckA.gainNode.connect(crossfaderNode);
    state.deckB.gainNode.connect(crossfaderNode);
    // Set initial crossfade and volume
    setCrossfade(0);
    setVolume('A', 1);
    setVolume('B', 1);

    return () => {
        state.deckA.gainNode.disconnect();
        state.deckB.gainNode.disconnect();
    }
  }, []);

  useEffect(() => {
    const updateCurrentTime = () => {
      if (state.deckA.isPlaying && state.deckA.track) {
        const elapsedTime = audioContext.currentTime - state.deckA.startTime;
        const newTime = state.deckA.startOffset + elapsedTime;
        if(newTime >= state.deckA.track.duration) {
          pauseDeck('A');
        } else {
          setCurrentTimeA(newTime);
        }
      }
      if (state.deckB.isPlaying && state.deckB.track) {
        const elapsedTime = audioContext.currentTime - state.deckB.startTime;
        const newTime = state.deckB.startOffset + elapsedTime;
        if(newTime >= state.deckB.track.duration) {
            pauseDeck('B');
        } else {
            setCurrentTimeB(newTime);
        }
      }
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    };

    if(state.deckA.isPlaying || state.deckB.isPlaying) {
      if(!state.isPlaying) dispatch({type: 'PLAY'});
      animationFrameRef.current = requestAnimationFrame(updateCurrentTime);
    } else {
      if(state.isPlaying) dispatch({type: 'PAUSE'});
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [state.isPlaying, state.deckA, state.deckB]);

  return {
    ...state,
    currentTimeA,
    currentTimeB,
    masterAnalyserNode,
    loadTrack,
    handlePlayPause,
    setVolume,
    setMasterVolume,
    setCrossfade,
  };
};
