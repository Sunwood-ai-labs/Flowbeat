
import React, { useState, useCallback } from 'react';
import { Toaster } from 'react-hot-toast';
import FileUpload from './components/FileUpload';
import Header from './components/Header';
import PlayerControls from './components/PlayerControls';
import TrackList from './components/TrackList';
import Visualizer from './components/Visualizer';
import { useDjMixer } from './hooks/useDjMixer';
import { analyzeAudioFile } from './lib/audioAnalysis';
import { Track } from './types';
import { Card, CardContent } from './components/ui/Card';


function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const mixer = useDjMixer();

  const handleFilesAdded = useCallback(async (files: FileList) => {
    const newTracks: Track[] = [];
    for (const file of Array.from(files)) {
      // Prevent duplicates
      if (tracks.some(t => t.id === `${file.name}-${file.lastModified}`)) continue;

      try {
        const analysis = await analyzeAudioFile(file);
        newTracks.push({
          id: `${file.name}-${file.lastModified}`,
          file,
          name: file.name,
          duration: analysis.duration!,
          audioBuffer: analysis.audioBuffer!,
        });
      } catch (error) {
        console.error('Error analyzing file:', file.name, error);
      }
    }
    setTracks((prev) => [...prev, ...newTracks]);
  }, [tracks]);

  const handleRemoveTrack = (trackId: string) => {
    setTracks(tracks => tracks.filter(t => t.id !== trackId));
  };


  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <Toaster />
      <Header />
      <main className="container mx-auto p-4 md:p-8">
        <div className="grid gap-8">
          <Visualizer analyserNode={mixer.masterAnalyserNode} />

          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <Card>
                  <CardContent className="p-4">
                    <FileUpload onFilesAdded={handleFilesAdded} />
                  </CardContent>
              </Card>
            </div>
            <div className="md:col-span-2">
                <TrackList
                    tracks={tracks}
                    onLoadToDeckA={(track) => mixer.loadTrack('A', track)}
                    onLoadToDeckB={(track) => mixer.loadTrack('B', track)}
                    onRemoveTrack={handleRemoveTrack}
                />
            </div>
          </div>

          <PlayerControls
            deckA={mixer.deckA}
            deckB={mixer.deckB}
            currentTimeA={mixer.currentTimeA}
            currentTimeB={mixer.currentTimeB}
            isPlaying={mixer.isPlaying}
            crossfade={mixer.crossfade}
            masterVolume={mixer.masterVolume}
            onPlayPause={mixer.handlePlayPause}
            onCrossfadeChange={mixer.setCrossfade}
            onVolumeChange={mixer.setVolume}
            onMasterVolumeChange={mixer.setMasterVolume}
          />

        </div>
      </main>
    </div>
  );
}

export default App;
