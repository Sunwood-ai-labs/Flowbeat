import React from 'react';
import { Track } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { formatDuration } from '../lib/utils';

interface TransitionTimelineProps {
  queue: Track[];
  activeTrackId: string | null;
  nextTrackId: string | null;
  activeTrackProgress: number;
  isAutoDj: boolean;
  deckAId: string | null;
  deckBId: string | null;
}

const TransitionTimeline: React.FC<TransitionTimelineProps> = ({
  queue,
  activeTrackId,
  nextTrackId,
  activeTrackProgress,
  isAutoDj,
  deckAId,
  deckBId,
}) => {
  const renderTrack = (track: Track) => {
    const start = track.startTime ?? 0;
    const fadeOut = track.fadeOutTime ?? track.duration;
    const totalDuration = track.duration || fadeOut || start || 1;
    const playableWindow = Math.max(fadeOut - start, 0);

    const isActive = track.id === activeTrackId;
    const isNext = !isActive && track.id === nextTrackId;
    const isDeckA = track.id === deckAId;
    const isDeckB = track.id === deckBId;

    const progressSeconds = Math.max(activeTrackProgress - start, 0);
    const progressRatio = isActive && playableWindow > 0
      ? Math.min(progressSeconds / playableWindow, 1)
      : 0;

    const progressPosition = isActive
      ? ((Math.min(activeTrackProgress, fadeOut) / totalDuration) * 100)
      : 0;

    const startPercent = (Math.min(start, totalDuration) / totalDuration) * 100;
    const fadePercent = (Math.min(fadeOut, totalDuration) / totalDuration) * 100;

    const timeUntilFade = isActive
      ? Math.max(fadeOut - activeTrackProgress, 0)
      : null;

    const roleLabel = isActive
      ? 'Now Playing'
      : isNext
        ? 'Up Next'
        : 'Queued';

    const deckLabel = isDeckA ? 'Deck A' : isDeckB ? 'Deck B' : null;

    return (
      <li
        key={track.id}
        className={`rounded-lg border border-border p-3 transition-colors ${
          isActive
            ? 'bg-accent/40'
            : isNext
            ? 'bg-muted/40'
            : 'bg-background'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="font-medium truncate" title={track.name}>
            {track.name}
          </p>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {roleLabel}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Start {formatDuration(start)}</span>
          <span>Fade {formatDuration(fadeOut)}</span>
          <span>Total {formatDuration(track.duration)}</span>
          {deckLabel && (
            <span className="font-semibold text-primary">{deckLabel}</span>
          )}
        </div>
        <div className="mt-3 relative h-2 rounded-full bg-muted">
          <div
            className="absolute inset-y-0 rounded-full bg-primary/30"
            style={{
              left: `${startPercent}%`,
              width: `${Math.max(fadePercent - startPercent, 0)}%`,
            }}
          />
          <div
            className="absolute inset-y-0 rounded-full bg-destructive/20"
            style={{ left: `${fadePercent}%`, right: 0 }}
          />
          {isActive && (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-background bg-primary shadow"
              style={{ left: `${progressPosition}%` }}
            />
          )}
        </div>
        {isActive && playableWindow > 0 && (
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{Math.round(progressRatio * 100)}% of mix window</span>
            <span className="font-medium text-primary">
              Transition in {formatDuration(timeUntilFade ?? 0)}
            </span>
          </div>
        )}
      </li>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mix Timeline</CardTitle>
        <CardDescription>
          {isAutoDj
            ? 'Auto DJ follows this order using Gemini’s mix points.'
            : 'Auto DJ is off. Turn it on to follow this queue automatically.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {queue.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Add tracks and wait for Gemini analysis to build the timeline.
          </p>
        ) : (
          <ul className="space-y-3">
            {queue.map(renderTrack)}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default TransitionTimeline;
