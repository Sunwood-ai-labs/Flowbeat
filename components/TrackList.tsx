
import React from 'react';
import { Track } from '../types';
import { Button } from './ui/Button';
import { MusicIcon, TrashIcon } from './Icons';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { formatDuration } from '../lib/utils';

interface TrackListProps {
  tracks: Track[];
  onLoadToDeckA: (track: Track) => void;
  onLoadToDeckB: (track: Track) => void;
  onRemoveTrack: (trackId: string) => void;
}

const TrackList: React.FC<TrackListProps> = ({ tracks, onLoadToDeckA, onLoadToDeckB, onRemoveTrack }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Track Library</CardTitle>
      </CardHeader>
      <CardContent>
        {tracks.length === 0 ? (
          <p className="text-muted-foreground">Add some audio files to get started.</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {tracks.map((track) => (
              <li key={track.id} className="flex items-center gap-4 p-2 rounded-md hover:bg-accent">
                <MusicIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" title={track.name}>{track.name}</p>
                  <p className="text-sm text-muted-foreground">{formatDuration(track.duration)}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => onLoadToDeckA(track)}>
                    Deck A
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onLoadToDeckB(track)}>
                    Deck B
                  </Button>
                   <Button variant="ghost" size="icon" onClick={() => onRemoveTrack(track.id)}>
                    <TrashIcon className="w-4 h-4" />
                   </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default TrackList;
