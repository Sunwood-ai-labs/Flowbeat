export interface Track {
  id: string;
  file: File;
  name: string;
  duration: number;
  audioBuffer: AudioBuffer;
  analysisStatus: 'pending' | 'analyzing' | 'ready' | 'error';
  startTime?: number;
  fadeOutTime?: number;
}

export interface Deck {
  track: Track | null;
  sourceNode: AudioBufferSourceNode | null;
  gainNode: GainNode;
  volume: number;
  isPlaying: boolean;
  startTime: number; // The AudioContext's currentTime when playback started
  startOffset: number; // The offset within the track to start/resume from
  analyserNode: AnalyserNode;
}