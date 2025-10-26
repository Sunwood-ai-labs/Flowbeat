import React from 'react';
import { Button } from './ui/Button';
import { Slider } from './ui/Slider';
import { Switch } from './ui/Switch';
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  Volume2Icon,
  TimerIcon,
} from './Icons';
import { formatDuration } from '../lib/utils';
import type { Track } from '../types';
import type { TransitionType } from '../hooks/useDjMixer';

interface PlayerControlsProps {
  isPlaying: boolean;
  togglePlayPause: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  volume: number;
  setVolume: (volume: number) => void;
  progress: number;
  seek: (value: number) => void;
  isAutoDj: boolean;
  setIsAutoDj: (value: boolean) => void;
  currentTrack: Track | null;
  transitionType: TransitionType;
  setTransitionType: (type: TransitionType) => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
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
  currentTrack,
  transitionType,
  setTransitionType,
}) => {
  const duration = currentTrack?.duration ?? 0;
  const currentTime = (progress / 100) * duration;
  const cuePointPercentage = currentTrack ? (currentTrack.optimalCuePoint / duration) * 100 : 0;

  return (
    <div className="border-t border-border bg-background p-4 flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="text-sm font-mono text-muted-foreground w-12 text-right">
          {formatDuration(currentTime)}
        </span>
        <div className="relative w-full">
            <Slider
              value={[progress]}
              onValueChange={(value) => seek(value[0])}
              max={100}
              step={0.1}
              disabled={!currentTrack}
            />
            {currentTrack && isAutoDj && (
                <div 
                    className="absolute top-1/2 h-4 w-1 bg-red-500 rounded-full -translate-y-1/2 pointer-events-none"
                    style={{ left: `calc(${cuePointPercentage}% - 2px)`}}
                    title={`Cue Point: ${formatDuration(currentTrack.optimalCuePoint)}`}
                />
            )}
        </div>
        <span className="text-sm font-mono text-muted-foreground w-12">
          {formatDuration(duration)}
        </span>
      </div>
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4 w-1/3">
          <div className="flex items-center gap-2">
            <TimerIcon className="w-5 h-5" />
            <span className="text-sm font-medium">Auto DJ</span>
            <Switch checked={isAutoDj} onCheckedChange={setIsAutoDj} disabled={!currentTrack} />
          </div>
           <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Transition:</span>
             <Button
                variant={transitionType === 'volume' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTransitionType('volume')}
                disabled={!currentTrack}
                className="h-8"
              >
                Volume
              </Button>
              <Button
                variant={transitionType === 'eq' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => setTransitionType('eq')}
                disabled={!currentTrack}
                className="h-8"
              >
                EQ Mix
              </Button>
          </div>
        </div>
        <div className="flex items-center gap-4 w-1/3 justify-center">
          <Button variant="ghost" size="icon" onClick={skipBackward} disabled={!currentTrack}>
            <SkipBackIcon className="w-6 h-6" />
          </Button>
          <Button size="lg" onClick={togglePlayPause} disabled={!currentTrack}>
            {isPlaying ? (
              <PauseIcon className="w-6 h-6" />
            ) : (
              <PlayIcon className="w-6 h-6" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={skipForward} disabled={!currentTrack}>
            <SkipForwardIcon className="w-6 h-6" />
          </Button>
        </div>
        <div className="flex items-center gap-2 w-1/3 justify-end">
          <Volume2Icon className="w-5 h-5" />
          <Slider
            value={[volume * 100]}
            onValueChange={(value) => setVolume(value[0] / 100)}
            max={100}
            className="w-32"
          />
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;
