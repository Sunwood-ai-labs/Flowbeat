import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track } from '../types';

interface PlayerNode {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

export const useDjMixer = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(-1);
  const [nextTrackIndex, setNextTrackIndex] = useState(-1);
  const [volume, setVolume] = useState(0.8);
  const [crossfade, setCrossfade] = useState(5); // in seconds
  const [isDurationLimited, setIsDurationLimited] = useState(false);
  const [playbackDurationLimit, setPlaybackDurationLimit] = useState(30); // Default 30 seconds

  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);
  
  const player1Ref = useRef<PlayerNode | null>(null);
  const player2Ref = useRef<PlayerNode | null>(null);
  const activePlayerRef = useRef<React.MutableRefObject<PlayerNode | null>>(player1Ref);
  const nextPlayerRef = useRef<React.MutableRefObject<PlayerNode | null>>(player2Ref);
  
  const trackEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const initializeAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = context;
      masterGainRef.current = context.createGain();
      analyserNodeRef.current = context.createAnalyser();
      analyserNodeRef.current.fftSize = 256;
      masterGainRef.current.connect(analyserNodeRef.current);
      analyserNodeRef.current.connect(context.destination);
    }
  }, []);

  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.setValueAtTime(volume, audioContextRef.current?.currentTime ?? 0);
    }
  }, [volume]);

  const cleanup = useCallback(() => {
    if (trackEndTimerRef.current) {
      clearTimeout(trackEndTimerRef.current);
    }
    player1Ref.current?.source.stop();
    player2Ref.current?.source.stop();
    setIsPlaying(false);
    setCurrentTrackIndex(-1);
    setNextTrackIndex(-1);
  }, []);
  
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const addTracks = useCallback(async (files: FileList) => {
    initializeAudio();
    const context = audioContextRef.current;
    if (!context) return;

    const newTracks: Track[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('audio/')) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const audioBuffer = await context.decodeAudioData(arrayBuffer);
          newTracks.push({
            id: `${file.name}-${Date.now()}`,
            file,
            name: file.name.replace(/\.[^/.]+$/, ""),
            url: URL.createObjectURL(file),
            duration: audioBuffer.duration,
            audioBuffer,
          });
        } catch (error) {
          console.error('Error decoding audio data:', error);
        }
      }
    }
    setTracks(prev => [...prev, ...newTracks]);
  }, [initializeAudio]);

  const scheduleNextTrack = useCallback((track: Track, nextIndex: number) => {
      if (trackEndTimerRef.current) clearTimeout(trackEndTimerRef.current);
      
      const playDuration = isDurationLimited 
          ? Math.min(track.duration, playbackDurationLimit) 
          : track.duration;

      const transitionTime = (playDuration - crossfade) * 1000;

      if (transitionTime > 0 && tracks.length > 1) {
          trackEndTimerRef.current = setTimeout(() => {
              prepareAndCrossfadeToNext(nextIndex);
          }, transitionTime);
      } else if (tracks.length <=1) {
          trackEndTimerRef.current = setTimeout(() => {
              setIsPlaying(false);
              setCurrentTrackIndex(-1);
          }, playDuration * 1000);
      }
  }, [isDurationLimited, playbackDurationLimit, crossfade, tracks.length]);

  const playTrack = useCallback((trackIndex: number) => {
    if (!audioContextRef.current || !masterGainRef.current || trackIndex < 0 || trackIndex >= tracks.length) {
      return;
    }
    
    const context = audioContextRef.current;
    const track = tracks[trackIndex];
    
    const source = context.createBufferSource();
    source.buffer = track.audioBuffer;
    
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, context.currentTime); // Start silent
    
    source.connect(gain);
    gain.connect(masterGainRef.current);
    source.start(0);

    const activePlayer = activePlayerRef.current.current;
    if (activePlayer) {
        activePlayer.source.stop();
    }
    activePlayerRef.current.current = { source, gain };

    gain.gain.linearRampToValueAtTime(1, context.currentTime + 1); // Fade in

    setCurrentTrackIndex(trackIndex);
    setIsPlaying(true);

    const nextIdx = (trackIndex + 1) % tracks.length;
    setNextTrackIndex(nextIdx);

    scheduleNextTrack(track, nextIdx);

  }, [tracks, scheduleNextTrack]);

  const prepareAndCrossfadeToNext = useCallback((nextIdx: number) => {
    if (!audioContextRef.current || !masterGainRef.current || nextIdx < 0 || nextIdx >= tracks.length) {
      return;
    }

    const context = audioContextRef.current;
    const nextTrack = tracks[nextIdx];
    
    // Prepare next player
    const source = context.createBufferSource();
    source.buffer = nextTrack.audioBuffer;
    const gain = context.createGain();
    source.connect(gain);
    gain.connect(masterGainRef.current);

    // Swap players
    const temp = activePlayerRef.current;
    activePlayerRef.current = nextPlayerRef.current;
    nextPlayerRef.current = temp;
    
    const nextPlayer = nextPlayerRef.current;
    if(nextPlayer.current){
        nextPlayer.current.source.stop();
    }
    nextPlayer.current = { source, gain };

    // Crossfade
    const now = context.currentTime;
    const currentGain = activePlayerRef.current.current?.gain;
    
    if(currentGain) {
        currentGain.gain.linearRampToValueAtTime(0, now + crossfade);
    }

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, now + crossfade);
    source.start(now);

    // Set new state and schedule next transition
    setCurrentTrackIndex(nextIdx);
    const nextNextIdx = (nextIdx + 1) % tracks.length;
    setNextTrackIndex(nextNextIdx);
    
    scheduleNextTrack(nextTrack, nextNextIdx);

  }, [tracks, crossfade, scheduleNextTrack]);
  
  const togglePlayPause = useCallback(() => {
    if (tracks.length === 0) return;
    
    if (isPlaying) {
      audioContextRef.current?.suspend();
      setIsPlaying(false);
      if (trackEndTimerRef.current) clearTimeout(trackEndTimerRef.current);
    } else {
      audioContextRef.current?.resume();
      if (currentTrackIndex === -1) {
        playTrack(0);
      } else {
        setIsPlaying(true);
        // Reschedule when resuming
        const currentTrack = tracks[currentTrackIndex];
        const nextIdx = (currentTrackIndex + 1) % tracks.length;
        // This is a simplified resume, a more accurate one would need to track remaining time.
        scheduleNextTrack(currentTrack, nextIdx);
      }
    }
  }, [isPlaying, tracks, currentTrackIndex, playTrack, scheduleNextTrack]);

  const skipTrack = useCallback((direction: number) => {
    if(tracks.length < 2) return;
    const newIndex = (currentTrackIndex + direction + tracks.length) % tracks.length;
    
    if (trackEndTimerRef.current) clearTimeout(trackEndTimerRef.current);
    player1Ref.current?.source.stop();
    player2Ref.current?.source.stop();
    
    playTrack(newIndex);
  }, [currentTrackIndex, tracks.length, playTrack]);
  
  const skipNext = useCallback(() => skipTrack(1), [skipTrack]);
  const skipPrevious = useCallback(() => skipTrack(-1), [skipTrack]);

  return {
    tracks,
    currentTrackIndex,
    nextTrackIndex,
    isPlaying,
    volume,
    crossfade,
    addTracks,
    togglePlayPause,
    skipNext,
    skipPrevious,
    setVolume,
    setCrossfade,
    analyserNode: analyserNodeRef.current,
    isDurationLimited,
    setIsDurationLimited,
    playbackDurationLimit,
    setPlaybackDurationLimit
  };
};