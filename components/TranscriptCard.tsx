'use client';

import { useRef, useEffect } from 'react';
import { TimelineEvent, Participant } from '@/lib/simulation';
import BorderGlow from './BorderGlow';
import './TranscriptCard.css';

interface TranscriptCardProps {
  events: TimelineEvent[];
  participants: Record<string, Participant>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function TranscriptCard({ events, participants }: TranscriptCardProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const transcriptEvents = events.filter((e) => e.type === 'transcript');

  // Auto-scroll to bottom on new transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcriptEvents.length]);

  return (
    <BorderGlow
      edgeSensitivity={30}
      glowColor="0 0 80"
      backgroundColor="#0a0a0a"
      borderRadius={20}
      glowRadius={30}
      glowIntensity={0.6}
      coneSpread={25}
      colors={['#ffffff', '#cccccc', '#999999']}
      className="transcript-glow"
    >
      <div className="card-content transcript-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">💬</span>
            Meeting Transcript
          </h2>
          <span className="transcript-count">
            {transcriptEvents.length} {transcriptEvents.length === 1 ? 'line' : 'lines'}
          </span>
        </div>

        <div className="transcript-scroll" ref={scrollRef}>
          {transcriptEvents.length === 0 ? (
            <div className="transcript-empty">
              <span className="empty-icon">⏳</span>
              <span>Waiting for conversation to begin…</span>
            </div>
          ) : (
            transcriptEvents.map((event, i) => {
              const speaker = participants[event.participantId];
              const speakerName = speaker?.displayName ?? `Participant ${event.participantId}`;

              return (
                <div key={i} className="transcript-line">
                  <span className="transcript-time">{formatTime(event.time)}</span>
                  <div className="transcript-content">
                    <span className="transcript-speaker">{speakerName}</span>
                    <span className="transcript-text">{event.data.text}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </BorderGlow>
  );
}
