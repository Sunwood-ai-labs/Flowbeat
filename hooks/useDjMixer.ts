import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track } from '../types';
import { analyzeAudioFile } from '../lib/audioAnalysis';

type Player = {
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode | null;
  filterNode: BiquadFilterNode | null;
  analyserNode: AnalyserNode | null;
};

export type TransitionType = 'volume' | 'eq';

export const useDjMixer = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const [isAutoDj, setIsAutoDj] = useState(false);
  const [transitionType, setTransitionType] = useState<TransitionType>('eq');
  const crossfadeDuration = 8; // seconds

  const audioContextRef = useRef<AudioContext | null>(null);
  const playerARef = useRef<Player | null>(null);
  const playerBRef = useRef<Player | null>(null);
  const activePlayerRef = useRef<'A' | 'B'>('A');

  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const progressIntervalRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<number | null>(null);

  const createPlayer = useCallback((context: AudioContext): Player => {
    const gainNode = context.createGain();
    const filterNode = context.createBiquadFilter();
    filterNode.type = 'lowshelf';
    filterNode.frequency.value = 320; // Cutoff frequency for bass
    const analyserNode = context.createAnalyser();
    analyserNode.fftSize = 2048;

    gainNode.connect(filterNode);
    filterNode.connect(analyserNode);
    analyserNode.connect(context.destination);

    return { sourceNode: null, gainNode, filterNode, analyserNode };
  }, []);

  const initializeAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      playerARef.current = createPlayer(context);
      playerBRef.current = createPlayer(context);
      audioContextRef.current = context;
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [createPlayer]);
  
  const cleanupPlayer = useCallback((player: Player | null) => {
    if (player?.sourceNode) {
      try {
        player.sourceNode.stop();
      } catch (e) { /* Ignore errors if already stopped */ }
      player.sourceNode.disconnect();
      player.sourceNode = null;
    }
  }, []);

  useEffect(() => {
    const playerA = playerARef.current;
    const playerB = playerBRef.current;
    return () => {
      cleanupPlayer(playerA);
      cleanupPlayer(playerB);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      audioContextRef.current?.close();
    };
  }, [cleanupPlayer]);

  const addTracks = useCallback(async (files: FileList) => {
    initializeAudio();
    const newTracks: Track[] = [];
    for (const file of Array.from(files)) {
      try {
        const analysis = await analyzeAudioFile(file);
        if (analysis.duration && analysis.audioBuffer && analysis.optimalCuePoint) {
          newTracks.push({
            id: `${file.name}-${Date.now()}`,
            name: file.name,
            file,
            duration: analysis.duration,
            audioBuffer: analysis.audioBuffer,
            bpm: analysis.bpm || null,
            key: analysis.key || null,
            optimalCuePoint: analysis.optimalCuePoint,
          });
        }
      } catch (error) {
        console.error(`Could not analyze file ${file.name}:`, error);
      }
    }
    setTracks(prev => [...prev, ...newTracks]);
    if (currentTrackIndex === -1 && newTracks.length > 0) {
      setCurrentTrackIndex(0);
    }
  }, [initializeAudio, currentTrackIndex]);

  const playTrack = useCallback((index: number, startTime = 0) => {
    if (!audioContextRef.current || index < 0 || index >= tracks.length) return;
    
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    cleanupPlayer(playerARef.current);
    cleanupPlayer(playerBRef.current);
    
    const activePlayer = playerARef.current; // Always start with Player A
    if (!activePlayer?.gainNode || !activePlayer.filterNode) return;
    activePlayerRef.current = 'A';

    const track = tracks[index];
    const source = audioContextRef.current.createBufferSource();
    source.buffer = track.audioBuffer;
    source.connect(activePlayer.gainNode);
    source.start(0, startTime);
    activePlayer.sourceNode = source;

    activePlayer.gainNode.gain.value = volume;
    activePlayer.filterNode.gain.value = 0; // Reset EQ gain

    pausedAtRef.current = startTime;
    startedAtRef.current = audioContextRef.current.currentTime - startTime;
    
    setCurrentTrackIndex(index);
    setIsPlaying(true);

    if (isAutoDj) {
        const timeUntilFade = track.optimalCuePoint - startTime - crossfadeDuration;
        if (timeUntilFade > 0) {
            fadeTimeoutRef.current = window.setTimeout(() => {
                crossfade(index);
            }, timeUntilFade * 1000);
        }
    }

    source.onended = () => {
      if (activePlayerRef.current === 'A' && activePlayer.sourceNode === source) {
         if (isPlaying) {
             setIsPlaying(false);
             setProgress(100);
         }
      }
    };
  }, [tracks, volume, isAutoDj, crossfadeDuration, cleanupPlayer]);

  const crossfade = useCallback((currentIndex: number) => {
    if (!audioContextRef.current || tracks.length < 2) return;
    
    const nextIndex = (currentIndex + 1) % tracks.length;
    const nextTrack = tracks[nextIndex];

    const currentTime = audioContextRef.current.currentTime;

    const fadingOutPlayer = activePlayerRef.current === 'A' ? playerARef.current : playerBRef.current;
    const fadingInPlayer = activePlayerRef.current === 'A' ? playerBRef.current : playerARef.current;
    
    if (!fadingOutPlayer?.gainNode || !fadingInPlayer?.gainNode || !fadingInPlayer.filterNode) return;
    
    // Start next track
    const nextSource = audioContextRef.current.createBufferSource();
    nextSource.buffer = nextTrack.audioBuffer;
    nextSource.connect(fadingInPlayer.gainNode);
    nextSource.start(currentTime);
    fadingInPlayer.sourceNode = nextSource;

    // Volume fade
    fadingOutPlayer.gainNode.gain.linearRampToValueAtTime(0, currentTime + crossfadeDuration);
    fadingInPlayer.gainNode.gain.setValueAtTime(0, currentTime);
    fadingInPlayer.gainNode.gain.linearRampToValueAtTime(volume, currentTime + crossfadeDuration);

    // EQ Mix
    if (transitionType === 'eq' && fadingOutPlayer.filterNode) {
        fadingOutPlayer.filterNode.gain.linearRampToValueAtTime(-40, currentTime + crossfadeDuration * 0.75);
        fadingInPlayer.filterNode.gain.setValueAtTime(-40, currentTime);
        fadingInPlayer.filterNode.gain.linearRampToValueAtTime(0, currentTime + crossfadeDuration * 0.75);
    }

    // After fade, cleanup and update state
    setTimeout(() => {
      cleanupPlayer(fadingOutPlayer);
      if (fadingOutPlayer.filterNode) fadingOutPlayer.filterNode.gain.value = 0; // Reset EQ
      
      activePlayerRef.current = activePlayerRef.current === 'A' ? 'B' : 'A';
      setCurrentTrackIndex(nextIndex);
      
      pausedAtRef.current = 0;
      startedAtRef.current = currentTime;

      // Schedule next fade
      if (isAutoDj) {
        const timeUntilFade = nextTrack.optimalCuePoint - crossfadeDuration;
        if (timeUntilFade > 0) {
            fadeTimeoutRef.current = window.setTimeout(() => {
                crossfade(nextIndex);
            }, timeUntilFade * 1000);
        }
      }
    }, crossfadeDuration * 1000);

  }, [tracks, volume, isAutoDj, crossfadeDuration, transitionType, cleanupPlayer]);

  const togglePlayPause = useCallback(() => {
    initializeAudio();
    if (!audioContextRef.current) return;

    if (isPlaying) {
      audioContextRef.current.suspend().then(() => {
        if (audioContextRef.current) pausedAtRef.current = audioContextRef.current.currentTime - startedAtRef.current;
        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
        setIsPlaying(false);
      });
    } else {
      audioContextRef.current.resume();
      if ((playerARef.current?.sourceNode || playerBRef.current?.sourceNode)) {
        startedAtRef.current = audioContextRef.current.currentTime - pausedAtRef.current;
        setIsPlaying(true);
        // Reschedule fade if in Auto DJ mode
        const track = tracks[currentTrackIndex];
        if (isAutoDj && track) {
            const remainingTime = track.optimalCuePoint - pausedAtRef.current - crossfadeDuration;
            if (remainingTime > 0) {
                 fadeTimeoutRef.current = window.setTimeout(() => crossfade(currentTrackIndex), remainingTime * 1000);
            }
        }
      } else if (tracks.length > 0) {
        playTrack(currentTrackIndex !== -1 ? currentTrackIndex : 0);
      }
    }
  }, [isPlaying, currentTrackIndex, tracks, playTrack, isAutoDj, crossfadeDuration, crossfade, initializeAudio]);

  const skipForward = useCallback(() => {
    if (tracks.length > 0) {
      const nextIndex = (currentTrackIndex + 1) % tracks.length;
      playTrack(nextIndex);
    }
  }, [currentTrackIndex, tracks.length, playTrack]);

  const skipBackward = useCallback(() => {
    if (tracks.length > 0) {
      const prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
      playTrack(prevIndex);
    }
  }, [currentTrackIndex, tracks.length, playTrack]);
  
  const seek = (value: number) => {
    if (currentTrackIndex !== -1) {
      const track = tracks[currentTrackIndex];
      const newTime = (value / 100) * track.duration;
      playTrack(currentTrackIndex, newTime);
    }
  };

  useEffect(() => {
    const activePlayer = activePlayerRef.current === 'A' ? playerARef.current : playerBRef.current;
    if (activePlayer?.gainNode && audioContextRef.current) {
      activePlayer.gainNode.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
    }
  }, [volume]);
  
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = window.setInterval(() => {
        if (audioContextRef.current && currentTrackIndex !== -1 && tracks[currentTrackIndex]) {
          const elapsedTime = audioContextRef.current.currentTime - startedAtRef.current;
          const duration = tracks[currentTrackIndex].duration;
          const newProgress = Math.min((elapsedTime / duration) * 100, 100);
          setProgress(newProgress);
        }
      }, 100);
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [isPlaying, currentTrackIndex, tracks]);

  const nextTrackIndex = tracks.length > 1 && currentTrackIndex !== -1 ? (currentTrackIndex + 1) % tracks.length : -1;

  return {
    tracks,
    addTracks,
    currentTrackIndex,
    nextTrackIndex,
    isPlaying,
    togglePlayPause,
    skipForward,
    skipBackward,
    volume,
    setVolume,
    progress,
    seek,
    isAutoDj,
    setIsAutoDj,
    analyserNodeA: playerARef.current?.analyserNode ?? null,
    analyserNodeB: playerBRef.current?.analyserNode ?? null,
    activePlayer: activePlayerRef.current,
    transitionType,
    setTransitionType,
  };
};
