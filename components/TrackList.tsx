import React from 'react';
import { Track } from '../types';
import { Button } from './ui/Button';
import { MusicIcon, TrashIcon, LoaderIcon, AlertTriangleIcon } from './Icons';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { formatDuration } from '../lib/utils';

interface TrackListProps {
  tracks: Track[];
  activeTrackId: string | null;
  nextTrackId: string | null;
  onRemoveTrack: (trackId: string) => void;
  onReanalyzeTrack: (trackId: string) => void;
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
    typeof track.endTime !== 'number'
  ) {
    return null;
  }

  const startPercent = Math.max(0, Math.min(1, track.startTime / track.duration)) * 100;
  const endPercent = Math.max(0, Math.min(1, track.endTime / track.duration)) * 100;
  const segmentLength = Math.max(track.endTime - track.startTime, 0);

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>Start {formatDuration(track.startTime)}</span>
        <span>Length {formatDuration(segmentLength)}</span>
        <span>End {formatDuration(track.endTime)}</span>
      </div>
      <div className="relative h-2 rounded-full bg-muted/60">
        <div
          className="absolute inset-y-0 left-0 bg-primary/30"
          style={{ width: `${endPercent}%` }}
        />
        <div
          className="absolute inset-y-0 bg-destructive/25"
          style={{ left: `${endPercent}%`, right: 0 }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
          style={{ left: `${startPercent}%` }}
        />
      </div>
    </div>
  );
};


const TrackList: React.FC<TrackListProps> = ({ tracks, activeTrackId, nextTrackId, onRemoveTrack, onReanalyzeTrack }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI DJ Library</CardTitle>
      </CardHeader>
      <CardContent>
        {tracks.length === 0 ? (
          <p className="text-muted-foreground">Add some audio files to get started.</p>
        ) : (
          <ul className="space-y-2 max-h-96 overflow-y-auto">
            {tracks.map((track) => (
              <li
                key={track.id}
                className={`flex items-center gap-4 p-2 rounded-md transition-colors ${
                  track.id === activeTrackId
                    ? 'bg-primary/10 border border-primary/40'
                    : track.id === nextTrackId
                    ? 'bg-secondary/10 border border-secondary/30'
                    : 'hover:bg-accent'
                }`}
              >
                <TrackStatusIndicator status={track.analysisStatus} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate" title={track.name}>{track.name}</p>
                    {track.id === activeTrackId && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-semibold text-primary-foreground/80">
                        Now Playing
                      </span>
                    )}
                    {track.id === nextTrackId && track.id !== activeTrackId && (
                      <span className="rounded-full bg-secondary/20 px-2 py-0.5 text-xs font-semibold text-secondary-foreground/80">
                        Up Next
                      </span>
                    )}
                  </div>
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onReanalyzeTrack(track.id)}
                    disabled={track.analysisStatus === 'analyzing'}
                  >
                    再解析
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
