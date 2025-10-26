import type { Track } from '../types';

/**
 * Analyzes an audio file to extract its AudioBuffer, duration, and optimal cue point.
 * @param file The audio file to analyze.
 * @returns A promise that resolves with partial track information.
 */
export const analyzeAudioFile = async (file: File): Promise<Partial<Track>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target?.result instanceof ArrayBuffer) {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const audioBuffer = await audioContext.decodeAudioData(event.target.result);
          
          const optimalCuePoint = findOptimalCuePoint(audioBuffer);

          // Placeholder for BPM and key detection
          const bpm = 120 + Math.random() * 20; // Random BPM for demo
          const key = ['C', 'G', 'D', 'A', 'E', 'B'][Math.floor(Math.random() * 6)] + 'm'; // Random key

          resolve({
            duration: audioBuffer.duration,
            audioBuffer,
            bpm,
            key,
            optimalCuePoint,
          });
        } catch (error) {
          console.error("Error decoding audio data:", error);
          reject(new Error("Could not decode audio file."));
        }
      } else {
        reject(new Error("Could not read file."));
      }
    };
    reader.onerror = () => {
      reject(new Error("Error reading file."));
    };
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Finds an optimal point in the track to start a crossfade.
 * This implementation looks for a high-energy, stable section in the last part of the song.
 * @param audioBuffer The AudioBuffer of the track.
 * @returns The time in seconds for the optimal cue point.
 */
function findOptimalCuePoint(audioBuffer: AudioBuffer): number {
  const duration = audioBuffer.duration;
  const channelData = audioBuffer.getChannelData(0); // Use the first channel for analysis
  const sampleRate = audioBuffer.sampleRate;

  // Analyze the section between 60% and 90% of the track to find a good outro point
  const searchStart = Math.floor(duration * 0.6 * sampleRate);
  const searchEnd = Math.floor(duration * 0.9 * sampleRate);
  const segmentSize = sampleRate * 2; // 2-second segments

  let bestSegmentIndex = -1;
  let maxEnergy = 0;

  for (let i = searchStart; i < searchEnd; i += segmentSize) {
    let sumOfSquares = 0;
    const end = Math.min(i + segmentSize, channelData.length);
    for (let j = i; j < end; j++) {
      sumOfSquares += channelData[j] * channelData[j];
    }
    const rms = Math.sqrt(sumOfSquares / (end - i)); // Root Mean Square for energy

    if (rms > maxEnergy) {
      maxEnergy = rms;
      bestSegmentIndex = i;
    }
  }

  if (bestSegmentIndex !== -1) {
    // Return the start time of the best segment
    return bestSegmentIndex / sampleRate;
  }

  // Fallback to 85% of the duration if no suitable point is found
  return duration * 0.85;
}
