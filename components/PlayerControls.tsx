import React from 'react';
import { Button } from './ui/Button';
import { Slider } from './ui/Slider';
import { Switch } from './ui/Switch';
import { PlayIcon, PauseIcon, SkipForwardIcon, SkipBackIcon, Volume2Icon, TimerIcon } from './Icons';

interface PlayerControlsProps {
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  volume: number;
  onVolumeChange: (value: number) => void;
  crossfade: number;
  onCrossfadeChange: (value: number) => void;
  isControlsDisabled: boolean;
  isDurationLimited: boolean;
  onDurationLimitChange: (checked: boolean) => void;
  playbackDurationLimit: number;
  onPlaybackDurationLimitChange: (value: number) => void;
  numberOfTracks: number;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
  isPlaying,
  onPlayPause,
  onNext,
  onPrev,
  volume,
  onVolumeChange,
  crossfade,
  onCrossfadeChange,
  isControlsDisabled,
  isDurationLimited,
  onDurationLimitChange,
  playbackDurationLimit,
  onPlaybackDurationLimitChange,
  numberOfTracks,
}) => {
  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex justify-center items-center gap-4">
        {/* FIX: Use numberOfTracks prop instead of undefined 'tracks' variable and correct disabling logic. */}
        <Button variant="ghost" size="icon" onClick={onPrev} disabled={isControlsDisabled || numberOfTracks < 2}>
          <SkipBackIcon className="w-6 h-6" />
        </Button>
        <Button size="lg" onClick={onPlayPause} disabled={isControlsDisabled}>
          {isPlaying ? <PauseIcon className="w-8 h-8" /> : <PlayIcon className="w-8 h-8" />}
        </Button>
        {/* FIX: Use numberOfTracks prop instead of undefined 'tracks' variable and correct disabling logic. */}
        <Button variant="ghost" size="icon" onClick={onNext} disabled={isControlsDisabled || numberOfTracks < 2}>
          <SkipForwardIcon className="w-6 h-6" />
        </Button>
      </div>
      <div className="space-y-4 pt-4">
        {/* Volume */}
        <div className="flex items-center gap-3">
          <Volume2Icon className="w-5 h-5 text-muted-foreground" />
          <Slider
            min={0}
            max={1}
            step={0.01}
            value={[volume]}
            onValueChange={(value) => onVolumeChange(value[0])}
          />
        </div>
        {/* Crossfade */}
        <div className="flex items-center gap-3">
          <TimerIcon className="w-5 h-5 text-muted-foreground" />
          <Slider
            min={1}
            max={15}
            step={1}
            value={[crossfade]}
            onValueChange={(value) => onCrossfadeChange(value[0])}
            disabled={isControlsDisabled}
          />
           <span className="text-xs w-12 text-right text-muted-foreground">{crossfade}s</span>
        </div>
        {/* Duration Limit */}
        <div className="flex items-center gap-3">
           <Switch
              id="duration-limit-switch"
              checked={isDurationLimited}
              onCheckedChange={onDurationLimitChange}
              disabled={isControlsDisabled}
            />
          <div className={`flex items-center gap-3 w-full transition-opacity ${isDurationLimited ? 'opacity-100' : 'opacity-50'}`}>
            <label htmlFor="duration-limit-switch" className="text-sm font-medium whitespace-nowrap">
                Limit to
            </label>
            <Slider
                min={10}
                max={60}
                step={1}
                value={[playbackDurationLimit]}
                onValueChange={(value) => onPlaybackDurationLimitChange(value[0])}
                disabled={!isDurationLimited || isControlsDisabled}
            />
            <span className="text-xs w-12 text-right text-muted-foreground">{playbackDurationLimit}s</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PlayerControls;
