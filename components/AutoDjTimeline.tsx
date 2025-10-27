import React, { useMemo } from 'react';
import { Track } from '../types';
import { formatDuration } from '../lib/utils';
import { CROSSFADE_DURATION } from '../hooks/useDjMixer';

interface AutoDjTimelineProps {
  queue: Track[];
  activeTrackId: string | null;
  nextTrackId: string | null;
  deckAssignments: { A: string | null; B: string | null };
  currentTimes: { A: number; B: number };
}

type TimelineSegment = {
  track: Track;
  start: number;
  end: number;
  mixLength: number;
  fadeDuration: number;
  mixStart: number;
  mixEnd: number;
};

const MIN_SEGMENT_LENGTH = 1;

const AutoDjTimeline: React.FC<AutoDjTimelineProps> = ({
  queue,
  activeTrackId,
  nextTrackId,
  deckAssignments,
  currentTimes,
}) => {
  const segments = useMemo<TimelineSegment[]>(() => {
    let cursor = 0;
    const built: TimelineSegment[] = [];

    queue.forEach((track, index) => {
      const mixStart = track.startTime ?? 0;
      const mixEnd = track.endTime ?? track.duration ?? 0;
      const rawLength = mixEnd - mixStart;
      const mixLength = Math.max(MIN_SEGMENT_LENGTH, rawLength);
      const fadeDuration = Math.min(CROSSFADE_DURATION, mixLength);
      const start = index === 0 ? 0 : Math.max(0, cursor - fadeDuration);
      const end = start + mixLength;
      cursor = end;
      built.push({ track, start, end, mixLength, fadeDuration, mixStart, mixEnd });
    });

    return built;
  }, [queue]);

  const totalDuration = segments.length ? segments[segments.length - 1].end : 0;

  const toPercent = (value: number) => (totalDuration > 0 ? (value / totalDuration) * 100 : 0);

  const nowPercent = useMemo(() => {
    if (!totalDuration) return null;

    const activeSegment = segments.find((segment) => segment.track.id === activeTrackId);
    if (!activeSegment) return null;

    const activeDeck = deckAssignments.A === activeSegment.track.id ? 'A' : deckAssignments.B === activeSegment.track.id ? 'B' : null;
    if (!activeDeck) return null;

    const trackTime = currentTimes[activeDeck];
    const progress = Math.max(0, trackTime - activeSegment.mixStart);
    const clamped = Math.min(progress, activeSegment.mixLength);
    return toPercent(activeSegment.start + clamped);
  }, [activeTrackId, currentTimes, deckAssignments, segments, totalDuration]);

  const getDeckStyles = (trackId: string) => {
    if (deckAssignments.A === trackId) {
      return {
        bar: 'bg-indigo-500/25 border-indigo-400/60 shadow-indigo-500/30 backdrop-blur-sm',
        fade: 'bg-indigo-400/30',
        text: 'text-indigo-100',
      };
    }
    if (deckAssignments.B === trackId) {
      return {
        bar: 'bg-emerald-500/25 border-emerald-400/60 shadow-emerald-500/30 backdrop-blur-sm',
        fade: 'bg-emerald-400/30',
        text: 'text-emerald-100',
      };
    }
    if (trackId === nextTrackId) {
      return {
        bar: 'bg-secondary/30 border-secondary/50',
        fade: 'bg-secondary/40',
        text: 'text-secondary-foreground',
      };
    }
    return {
      bar: 'bg-muted/50 border-border/60',
      fade: 'bg-muted-foreground/20',
      text: 'text-foreground',
    };
  };

  if (!segments.length) {
    return <p className="text-sm text-muted-foreground">Add ready tracks to visualize the AI DJ timeline.</p>;
  }

  return (
    <div className="relative">
      <div className="space-y-4">
        {segments.map((segment) => {
          const deckStyle = getDeckStyles(segment.track.id);
          const widthPercent = toPercent(segment.mixLength);
          const leftPercent = toPercent(segment.start);
          const fadeStartPercent = toPercent(segment.end - segment.fadeDuration);
          const fadeWidthPercent = toPercent(segment.fadeDuration);

          const deckLabel = deckAssignments.A === segment.track.id ? 'Deck A' : deckAssignments.B === segment.track.id ? 'Deck B' : 'Queued';

          return (
            <div key={segment.track.id} className="relative h-16 rounded-md border border-dashed border-border/40 bg-background/40">
              <div
                className={`absolute inset-y-2 flex flex-col justify-center rounded-md border px-3 transition-shadow ${deckStyle.bar}`}
                style={{
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  minWidth: '3rem',
                }}
              >
                <div className={`flex items-center justify-between text-xs font-medium ${deckStyle.text}`}>
                  <span className="truncate pr-4" title={segment.track.name}>
                    {segment.track.name}
                  </span>
                  <span className="uppercase tracking-wide text-[10px] opacity-80">{deckLabel}</span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-foreground/70">
                  <span>{formatDuration(segment.mixStart)}</span>
                  <span>{formatDuration(segment.mixLength)}</span>
                  <span>{formatDuration(segment.mixEnd)}</span>
                </div>
              </div>

              <div
                className={`pointer-events-none absolute inset-y-2 rounded-md ${deckStyle.fade}`}
                style={{
                  left: `${fadeStartPercent}%`,
                  width: `${fadeWidthPercent}%`,
                  minWidth: fadeWidthPercent === 0 ? '0' : undefined,
                }}
              />
            </div>
          );
        })}
      </div>

      {nowPercent !== null && (
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-[2px] bg-primary"
          style={{ left: `${nowPercent}%` }}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-primary">
            NOW
          </div>
        </div>
      )}

      <div className="mt-4 flex justify-between text-[11px] uppercase tracking-wide text-muted-foreground">
        <span>{formatDuration(0)}</span>
        <span>{formatDuration(totalDuration)}</span>
      </div>
    </div>
  );
};

export default AutoDjTimeline;
