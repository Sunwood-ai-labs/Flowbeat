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
    analyserNodeA,
    analyserNodeB,
    activePlayer,
    transitionType,
    setTransitionType
  } = useDjMixer();

  const currentTrack = currentTrackIndex !== -1 ? tracks[currentTrackIndex] : null;
  const nextTrack = nextTrackIndex !== -1 ? tracks[nextTrackIndex] : null;
  
  const deckATrack = activePlayer === 'A' ? currentTrack : nextTrack;
  const deckBTrack = activePlayer === 'B' ? currentTrack : nextTrack;

  const deckAAnalyser = activePlayer === 'A' ? analyserNodeA : analyserNodeB;
  const deckBAnalyser = activePlayer === 'B' ? analyserNodeA : analyserNodeB;

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Header />
      <main className="flex-grow container mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <FileUpload onFilesAdded={addTracks} />
          <TrackList 
            tracks={tracks} 
            currentTrackIndex={currentTrackIndex} 
            nextTrackIndex={nextTrackIndex}
            isPlaying={isPlaying}
          />
        </div>
        <div className="lg:col-span-2 flex flex-col md:flex-row justify-center items-stretch gap-6">
          {/* Deck A */}
          <div className="flex-1 flex flex-col justify-center items-center gap-3 p-4 border rounded-lg bg-secondary/30">
            <h2 className="text-lg font-semibold text-center truncate w-full px-2 text-green-400">
              Deck A: {deckATrack ? deckATrack.name : 'Load a track'}
            </h2>
            <Visualizer analyserNode={deckAAnalyser} isPlaying={isPlaying} />
            <p className="text-muted-foreground text-sm h-5">
              {deckATrack ? `BPM: ${deckATrack.bpm?.toFixed(1) ?? '...'} | Key: ${deckATrack.key ?? '...'}` : ''}
            </p>
          </div>
          {/* Deck B */}
          <div className="flex-1 flex flex-col justify-center items-center gap-3 p-4 border rounded-lg bg-secondary/30">
             <h2 className="text-lg font-semibold text-center truncate w-full px-2 text-blue-400">
              Deck B: {deckBTrack ? deckBTrack.name : 'Waiting...'}
            </h2>
            <Visualizer analyserNode={deckBAnalyser} isPlaying={isPlaying} />
             <p className="text-muted-foreground text-sm h-5">
              {deckBTrack ? `BPM: ${deckBTrack.bpm?.toFixed(1) ?? '...'} | Key: ${deckBTrack.key ?? '...'}` : ''}
            </p>
          </div>
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
        transitionType={transitionType}
        setTransitionType={setTransitionType}
      />
    </div>
  );
};

export default App;
