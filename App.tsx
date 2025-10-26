
import React from 'react';
import { useDjMixer } from './hooks/useDjMixer';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import TrackList from './components/TrackList';
import PlayerControls from './components/PlayerControls';
import Visualizer from './components/Visualizer';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/Card';
import { GithubIcon } from './components/Icons';

export default function App() {
  const {
    tracks,
    currentTrackIndex,
    nextTrackIndex,
    isPlaying,
    volume,
    crossfade,
    isDurationLimited,
    playbackDurationLimit,
    addTracks,
    togglePlayPause,
    skipNext,
    skipPrevious,
    setVolume,
    setCrossfade,
    setIsDurationLimited,
    setPlaybackDurationLimit,
    analyserNode,
  } = useDjMixer();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-6 lg:p-8 grid gap-6 grid-cols-1 lg:grid-cols-3">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <FileUpload onFilesAdded={addTracks} />
          <TrackList 
            tracks={tracks}
            currentTrackIndex={currentTrackIndex}
            nextTrackIndex={nextTrackIndex}
            isPlaying={isPlaying}
          />
        </div>

        <div className="lg:col-span-2 flex flex-col gap-6">
           <Card className="flex-grow flex flex-col">
            <CardHeader>
              <CardTitle>Player</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between p-4 md:p-6">
              <div className="flex-grow flex items-center justify-center min-h-[200px] md:min-h-[300px]">
                {analyserNode ? (
                  <Visualizer analyserNode={analyserNode} />
                ) : (
                  <div className="text-muted-foreground text-center">
                    <p>Load some tracks to start the party!</p>
                    <p className="text-sm">Audio visualizer will appear here.</p>
                  </div>
                )}
              </div>
              <PlayerControls
                isPlaying={isPlaying}
                onPlayPause={togglePlayPause}
                onNext={skipNext}
                onPrev={skipPrevious}
                volume={volume}
                onVolumeChange={setVolume}
                crossfade={crossfade}
                onCrossfadeChange={setCrossfade}
                isControlsDisabled={tracks.length < 1}
                isDurationLimited={isDurationLimited}
                onDurationLimitChange={setIsDurationLimited}
                playbackDurationLimit={playbackDurationLimit}
                onPlaybackDurationLimitChange={setPlaybackDurationLimit}
                // FIX: Pass the number of tracks to the PlayerControls component.
                numberOfTracks={tracks.length}
              />
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="text-center p-4 text-muted-foreground text-sm">
        <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 hover:text-primary transition-colors">
          <GithubIcon className="w-4 h-4" />
          <span>Auto DJ Mixer</span>
        </a>
      </footer>
    </div>
  );
}
