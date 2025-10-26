export interface Track {
  id: string;
  name: string;
  duration: number;
  file: File;
  audioBuffer: AudioBuffer;
  bpm: number | null;
  key: string | null;
  optimalCuePoint: number; // The optimal point in seconds to start a crossfade
}

export interface Transition {
  type: 'fade' | 'crossfade' | 'cut';
  duration: number;
}
