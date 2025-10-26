
import React from 'react';
import type { Track } from '../types';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { formatDuration } from '../lib/utils';
import { MusicIcon, PlayIcon } from './Icons';
import { cn } from '../lib/utils';

interface TrackListProps {
  tracks: Track[];
  currentTrackIndex: number;
  nextTrackIndex: number;
  isPlaying: boolean;
}

const TrackList: React.FC<TrackListProps> = ({ tracks, currentTrackIndex, nextTrackIndex, isPlaying }) => {
  if (tracks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Playlist</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <MusicIcon className="w-12 h-12 mx-auto mb-4" />
            <p>Your playlist is empty.</p>
            <p className="text-sm">Add some tracks to get started!</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col h-full max-h-[calc(100vh-250px)]">
      <CardHeader>
        <CardTitle>Playlist</CardTitle>
      </CardHeader>
      <CardContent className="overflow-y-auto p-0">
        <ul className="divide-y divide-border">
          {tracks.map((track, index) => {
            const isCurrent = index === currentTrackIndex;
            const isNext = index === nextTrackIndex && tracks.length > 1;
            return (
              <li
                key={track.id}
                className={cn(
                  "flex items-center justify-between p-3 transition-colors",
                  isCurrent && "bg-secondary"
                )}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                    {isCurrent && isPlaying ? (
                        <PlayIcon className="w-5 h-5 text-green-400 flex-shrink-0"/>
                    ) : (
                        <MusicIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    )}
                  <span className="truncate font-medium text-sm">{track.name}</span>
                </div>
                <div className="flex items-center gap-2">
                    {isNext && <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">Next</span>}
                    <span className="text-sm text-muted-foreground">{formatDuration(track.duration)}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
};

export default TrackList;
