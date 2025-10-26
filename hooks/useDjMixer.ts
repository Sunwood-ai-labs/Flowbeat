
import { useState, useRef, useCallback, useEffect } from 'react';
import type { Track } from '../types';
import { analyzeAudioFile } from '../lib/audioAnalysis';

export const useDjMixer = () => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [progress, setProgress] = useState(0);
  const [isAutoDj, setIsAutoDj] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserNodeRef = useRef<AnalyserNode | null>(null);

  const startedAtRef = useRef(0);
  const pausedAtRef = useRef(0);
  const progressIntervalRef = useRef<number | null>(null);

  const cleanupPlayback = useCallback(() => {
    if (sourceNodeRef.current) {
      sourceNodeRef.current.onended = null;
      try {
        sourceNodeRef.current.stop();
      } catch (e) {
        // Can throw if already stopped
      }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  const initializeAudio = useCallback(() => {
    if (!audioContextRef.current) {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = context;

      gainNodeRef.current = context.createGain();
      gainNodeRef.current.gain.value = volume;

      analyserNodeRef.current = context.createAnalyser();
      analyserNodeRef.current.fftSize = 2048;

      gainNodeRef.current.connect(analyserNodeRef.current);
      analyserNodeRef.current.connect(context.destination);
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }
  }, [volume]);

  const addTracks = useCallback(async (files: FileList) => {
    initializeAudio();
    const newTracks: Track[] = [];
    for (const file of Array.from(files)) {
      try {
        const analysis = await analyzeAudioFile(file);
        if (analysis.duration && analysis.audioBuffer) {
          newTracks.push({
            id: `${file.name}-${Date.now()}`,
            name: file.name,
            file,
            duration: analysis.duration,
            audioBuffer: analysis.audioBuffer,
            bpm: analysis.bpm || null,
            key: analysis.key || null,
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
    if (!audioContextRef.current || !gainNodeRef.current || index < 0 || index >= tracks.length) return;
    
    cleanupPlayback();

    const track = tracks[index];
    const source = audioContextRef.current.createBufferSource();
    source.buffer = track.audioBuffer;
    source.connect(gainNodeRef.current);
    
    source.start(0, startTime);
    sourceNodeRef.current = source;
    
    pausedAtRef.current = startTime;
    startedAtRef.current = audioContextRef.current.currentTime - startTime;
    
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    
    source.onended = () => {
      // Only process 'onended' if it's the current source, to avoid old events firing.
      if (sourceNodeRef.current === source) {
        cleanupPlayback();
        setIsPlaying(false);
        if (isAutoDj) {
            const nextIndex = (index + 1) % tracks.length;
            if (tracks.length > 0) {
              playTrack(nextIndex);
            }
        } else {
            setProgress(100); // Mark as finished
        }
      }
    };
  }, [tracks, cleanupPlayback, isAutoDj]);
  
  const togglePlayPause = useCallback(() => {
    initializeAudio();
    if (!audioContextRef.current) return;

    if (isPlaying) {
      audioContextRef.current.suspend().then(() => {
        if (audioContextRef.current) {
          pausedAtRef.current = audioContextRef.current.currentTime - startedAtRef.current;
        }
        setIsPlaying(false);
      });
    } else {
      audioContextRef.current.resume();
      if (sourceNodeRef.current) { // Resuming a paused track
        startedAtRef.current = audioContextRef.current.currentTime - pausedAtRef.current;
        setIsPlaying(true);
      } else if (currentTrackIndex !== -1) { // Playing a track from start
        playTrack(currentTrackIndex, pausedAtRef.current);
      } else if (tracks.length > 0) { // Playing first track
        playTrack(0);
      }
    }
  }, [isPlaying, currentTrackIndex, tracks, playTrack, initializeAudio]);

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
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.setValueAtTime(volume, audioContextRef.current?.currentTime ?? 0);
    }
  }, [volume]);
  
  useEffect(() => {
    if (isPlaying) {
      progressIntervalRef.current = window.setInterval(() => {
        if (audioContextRef.current && currentTrackIndex !== -1 && tracks[currentTrackIndex]) {
          const elapsedTime = pausedAtRef.current + (audioContextRef.current.currentTime - startedAtRef.current);
          const duration = tracks[currentTrackIndex].duration;
          const newProgress = Math.min((elapsedTime / duration) * 100, 100);
          setProgress(newProgress);
        }
      }, 100);
    } else if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
    }
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, currentTrackIndex, tracks]);

  useEffect(() => {
    return () => {
      cleanupPlayback();
      audioContextRef.current?.close();
    };
  }, [cleanupPlayback]);

  return {
    tracks,
    addTracks,
    currentTrackIndex,
    nextTrackIndex: tracks.length > 1 && currentTrackIndex !== -1 ? (currentTrackIndex + 1) % tracks.length : -1,
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
    analyserNode: analyserNodeRef.current,
  };
};
