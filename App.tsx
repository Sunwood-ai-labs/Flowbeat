import React, { useState, useCallback, useEffect } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import FileUpload from './components/FileUpload';
import Header from './components/Header';
import PlayerControls from './components/PlayerControls';
import TrackList from './components/TrackList';
import Visualizer from './components/Visualizer';
import { useDjMixer } from './hooks/useDjMixer';
import { analyzeAudioFile } from './lib/audioAnalysis';
import { getMixPointsFromGemini } from './lib/geminiAnalysis';
import { Track } from './types';
import { Card, CardContent } from './components/ui/Card';

function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isAutoDj, setIsAutoDj] = useState(false);
  const mixer = useDjMixer({ isAutoDj, tracks });

  const handleFilesAdded = useCallback(async (files: FileList) => {
    const newTracks: Track[] = Array.from(files)
        .filter(file => !tracks.some(t => t.id === `${file.name}-${file.lastModified}`))
        .map(file => ({
            id: `${file.name}-${file.lastModified}`,
            file,
            name: file.name,
            duration: 0,
            audioBuffer: mixer.audioContext!.createBuffer(1,1,22050),
            analysisStatus: 'pending',
        }));

    if(newTracks.length > 0) {
        setTracks(prev => [...prev, ...newTracks]);
    }
  }, [tracks, mixer.audioContext]);

  useEffect(() => {
    tracks.forEach(track => {
      if (track.analysisStatus === 'pending' && mixer.audioContext) {
        
        setTracks(prev => prev.map(t => t.id === track.id ? { ...t, analysisStatus: 'analyzing' } : t));

        const analyze = async () => {
            try {
                const audioAnalysis = await analyzeAudioFile(track.file, mixer.audioContext!);
                
                toast.promise(
                    getMixPointsFromGemini(track.name, audioAnalysis.duration!),
                    {
                        loading: `Analyzing ${track.name} with Gemini...`,
                        success: (mixPoints) => {
                            setTracks(prev => prev.map(t => t.id === track.id ? { 
                                ...t, 
                                ...audioAnalysis,
                                ...mixPoints,
                                analysisStatus: 'ready' 
                            } : t));
                            return `Analysis for ${track.name} complete!`;
                        },
                        error: (err) => {
                             setTracks(prev => prev.map(t => t.id === track.id ? { ...t, analysisStatus: 'error' } : t));
                            return `Could not analyze ${track.name}: ${err.message}`;
                        }
                    }
                );

            } catch (error) {
                console.error('Error analyzing file:', track.name, error);
                setTracks(prev => prev.map(t => t.id === track.id ? { ...t, analysisStatus: 'error' } : t));
                toast.error(`Failed to process ${track.name}.`);
            }
        }
        analyze();
      }
    });
  }, [tracks, mixer.audioContext]);

  const handleRemoveTrack = (trackId: string) => {
    setTracks(tracks => tracks.filter(t => t.id !== trackId));
    if (mixer.deckA.track?.id === trackId) mixer.loadTrack('A', null);
    if (mixer.deckB.track?.id === trackId) mixer.loadTrack('B', null);
  };


  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground">
      <Toaster position="top-center" toastOptions={{
          style: {
            background: 'hsl(240 3.7% 15.9%)',
            color: 'hsl(0 0% 98%)',
            border: '1px solid hsl(240 3.7% 15.9%)',
          }
      }} />
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
            isAutoDj={isAutoDj}
            onPlayPause={mixer.handlePlayPause}
            onCrossfadeChange={mixer.setCrossfade}
            onVolumeChange={mixer.setVolume}
            onAutoDjChange={setIsAutoDj}
          />

        </div>
      </main>
    </div>
  );
}

export default App;