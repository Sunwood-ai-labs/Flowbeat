
import React from 'react';
import { useDjMixer } from './hooks/useDjMixer';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import TrackList from './components/TrackList';
import PlayerControls from './components/PlayerControls';
import Visualizer from './components/Visualizer';

const App: React.FC = () => {
  const {
    tracks,
    addTracks,
    currentTrackIndex,
    nextTrackIndex,
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
    analyserNode,
  } = useDjMixer();

  const currentTrack = currentTrackIndex !== -1 ? tracks[currentTrackIndex] : null;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow container mx-auto p-4 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
        <div className="md:col-span-1 flex flex-col gap-4">
          <FileUpload onFilesAdded={addTracks} />
          <TrackList 
            tracks={tracks} 
            currentTrackIndex={currentTrackIndex} 
            nextTrackIndex={nextTrackIndex}
            isPlaying={isPlaying}
          />
        </div>
        <div className="md:col-span-2 flex flex-col justify-center items-center gap-4">
          <h2 className="text-xl font-semibold text-center truncate w-full px-4">
            {currentTrack ? currentTrack.name : 'No track selected'}
          </h2>
          <Visualizer analyserNode={analyserNode} isPlaying={isPlaying} />
          <p className="text-muted-foreground">
            {currentTrack ? `BPM: ${currentTrack.bpm?.toFixed(1) ?? '...'} | Key: ${currentTrack.key ?? '...'}` : 'Upload tracks to start mixing.'}
          </p>
        </div>
      </main>
      <PlayerControls
        isPlaying={isPlaying}
        togglePlayPause={togglePlayPause}
        skipForward={skipForward}
        skipBackward={skipBackward}
        volume={volume}
        setVolume={setVolume}
        progress={progress}
        seek={seek}
        isAutoDj={isAutoDj}
        setIsAutoDj={setIsAutoDj}
        currentTrack={currentTrack}
      />
    </div>
  );
};

export default App;
