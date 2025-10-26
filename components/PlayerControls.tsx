
import React from 'react';
import { Deck } from '../types';
import { Button } from './ui/Button';
import { PauseIcon, PlayIcon, Volume2Icon } from './Icons';
import { Slider } from './ui/Slider';
import { formatDuration } from '../lib/utils';
import { Card, CardContent } from './ui/Card';


interface PlayerControlsProps {
  deckA: Deck;
  deckB: Deck;
  currentTimeA: number;
  currentTimeB: number;
  isPlaying: boolean;
  crossfade: number;
  masterVolume: number;
  onPlayPause: () => void;
  onCrossfadeChange: (value: number) => void;
  onVolumeChange: (deck: 'A' | 'B', value: number) => void;
  onMasterVolumeChange: (value: number) => void;
}

const DeckControl: React.FC<{
  deck: Deck,
  currentTime: number,
  deckLabel: 'A' | 'B',
  onVolumeChange: (value: number) => void
}> = ({ deck, currentTime, deckLabel, onVolumeChange }) => {
  return (
    <div className="flex-1 space-y-2">
      <h3 className="text-lg font-bold text-center">Deck {deckLabel}</h3>
      <div className="h-12 p-2 text-center border rounded-md bg-muted text-muted-foreground truncate" title={deck.track?.name}>
        {deck.track ? deck.track.name : 'Load a track'}
      </div>
      <div className="flex justify-between text-sm text-muted-foreground">
        <span>{formatDuration(currentTime)}</span>
        <span>{deck.track ? formatDuration(deck.track.duration) : '0:00'}</span>
      </div>
      <Slider
          value={[currentTime]}
          max={deck.track?.duration || 0}
          step={0.1}
          disabled
        />
      <div className="flex items-center gap-2">
        <Volume2Icon className="w-5 h-5" />
        <Slider
          value={[deck.volume]}
          onValueChange={(v) => onVolumeChange(v[0])}
          max={1}
          step={0.01}
        />
      </div>
    </div>
  );
};

const PlayerControls: React.FC<PlayerControlsProps> = ({
  deckA,
  deckB,
  currentTimeA,
  currentTimeB,
  isPlaying,
  crossfade,
  onPlayPause,
  onCrossfadeChange,
  onVolumeChange,
}) => {

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
            <DeckControl 
              deck={deckA} 
              currentTime={currentTimeA} 
              deckLabel="A" 
              onVolumeChange={(v) => onVolumeChange('A', v)}
            />
            
            <div className="flex flex-col items-center justify-center gap-4 pt-8 px-4">
              <Button onClick={onPlayPause} size="lg" className="w-16 h-16 rounded-full">
                {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
              </Button>
            </div>

            <DeckControl 
              deck={deckB} 
              currentTime={currentTimeB} 
              deckLabel="B" 
              onVolumeChange={(v) => onVolumeChange('B', v)}
            />
        </div>
        <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-center">Crossfader</p>
            <Slider
                value={[crossfade]}
                onValueChange={(v) => onCrossfadeChange(v[0])}
                min={-1}
                max={1}
                step={0.01}
            />
        </div>
      </CardContent>
    </Card>
  );
};

export default PlayerControls;
