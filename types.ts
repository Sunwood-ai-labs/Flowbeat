
export interface Track {
  id: string;
  name: string;
  duration: number;
  file: File;
  audioBuffer: AudioBuffer;
  bpm: number | null;
  key: string | null;
}

export interface Transition {
  type: 'fade' | 'crossfade' | 'cut';
  duration: number;
}
