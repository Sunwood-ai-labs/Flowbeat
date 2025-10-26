
import { Track } from '../types';

// A global AudioContext to be reused.
const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

export async function analyzeAudioFile(file: File): Promise<Partial<Track>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      if (e.target?.result && e.target.result instanceof ArrayBuffer) {
        audioContext.decodeAudioData(
          e.target.result,
          (buffer) => {
            resolve({
              duration: buffer.duration,
              audioBuffer: buffer,
            });
          },
          (error) => {
            console.error(`Error decoding audio data for ${file.name}`, error);
            reject(new Error('Could not decode audio file.'));
          }
        );
      } else {
        reject(new Error('FileReader did not return an ArrayBuffer.'));
      }
    };

    reader.onerror = (error) => {
      console.error(`FileReader error for ${file.name}`, error);
      reject(new Error('Could not read the file.'));
    };

    reader.readAsArrayBuffer(file);
  });
}
