import React from 'react';
import { Track } from '../types';
import { Button } from './ui/Button';
import { MusicIcon, TrashIcon, LoaderIcon, AlertTriangleIcon } from './Icons';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { formatDuration } from '../lib/utils';

interface TrackListProps {
  tracks: Track[];
  onLoadToDeckA: (track: Track) => void;
  onLoadToDeckB: (track: Track) => void;
  onRemoveTrack: (trackId: string) => void;
}

const TrackStatusIndicator: React.FC<{ status: Track['analysisStatus'] }> = ({ status }) => {
    switch (status) {
        case 'analyzing':
            return <LoaderIcon className="w-5 h-5 text-muted-foreground animate-spin" />;
        case 'error':
            return <AlertTriangleIcon className="w-5 h-5 text-destructive" />;
        case 'ready':
            return <MusicIcon className="w-5 h-5 text-muted-foreground flex-shrink-0" />;
        default:
             return <MusicIcon className="w-5 h-5 text-muted-foreground flex-shrink-0 opacity-50" />;
    }
}

const MixPointVisualization: React.FC<{ track: Track }> = ({ track }) => {
  if (
    track.analysisStatus !== 'ready' ||
    typeof track.duration !== 'number' ||
    !track.duration ||
    typeof track.startTime !== 'number' ||
    typeof track.fadeOutTime !== 'number'
  ) {
    return null;
  }

  const startPercent = Math.max(0, Math.min(1, track.startTime / track.duration)) * 100;
  const fadePercent = Math.max(0, Math.min(1, track.fadeOutTime / track.duration)) * 100;
  const blendWindow = Math.max(track.fadeOutTime - track.startTime, 0);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>Start {formatDuration(track.startTime)}</span>
        <span>Blend {formatDuration(blendWindow)}</span>
        <span>Fade {formatDuration(track.fadeOutTime)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted/60">
        <div
          className="absolute inset-y-0 left-0 bg-primary/30"
          style={{ width: `${fadePercent}%` }}
        />
        <div
          className="absolute inset-y-0 bg-destructive/25"
          style={{ left: `${fadePercent}%`, right: 0 }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
          style={{ left: `${startPercent}%` }}
        />
      </div>
    </div>
  );
};


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
                <TrackStatusIndicator status={track.analysisStatus} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate" title={track.name}>{track.name}</p>
                  {track.analysisStatus === 'ready' && (
                    <>
                      <p className="text-sm text-muted-foreground">{formatDuration(track.duration)}</p>
                      <MixPointVisualization track={track} />
                    </>
                  )}
                  {track.analysisStatus === 'analyzing' && <p className="text-sm text-muted-foreground">Analyzing...</p>}
                  {track.analysisStatus === 'error' && <p className="text-sm text-destructive">Analysis failed</p>}
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => onLoadToDeckA(track)} disabled={track.analysisStatus !== 'ready'}>
                    Deck A
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onLoadToDeckB(track)} disabled={track.analysisStatus !== 'ready'}>
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
