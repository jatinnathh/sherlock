'use client';

import { ConfidenceSnapshot } from '@/hooks/useSimulation';
import BorderGlow from './BorderGlow';
import './ConfidenceTimeline.css';

interface ConfidenceTimelineProps {
  history: ConfidenceSnapshot[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ConfidenceTimeline({ history }: ConfidenceTimelineProps) {
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
      className="timeline-glow"
    >
      <div className="card-content timeline-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">📈</span>
            Confidence Timeline
          </h2>
          <span className="card-count">{history.length} snapshots</span>
        </div>

        {history.length === 0 ? (
          <div className="timeline-empty">
            <span>Timeline will populate as the simulation runs</span>
          </div>
        ) : (
          <div className="timeline-table">
            <div className="timeline-header-row">
              <span className="timeline-col time-col">Time</span>
              <span className="timeline-col conf-col">Confidence</span>
              <span className="timeline-col reason-col">Reason</span>
            </div>
            {history.map((snap, i) => {
              const prevConf = i > 0 ? history[i - 1].confidence : 0;
              const delta = snap.confidence - prevConf;
              return (
                <div
                  key={i}
                  className="timeline-row"
                  style={{
                    animationDelay: `${i * 0.05}s`,
                  }}
                >
                  <span className="timeline-col time-col">{formatTime(snap.time)}</span>
                  <span className="timeline-col conf-col">
                    <span className="conf-value">{snap.confidence}%</span>
                    {delta !== 0 && (
                      <span className={`conf-delta ${delta > 0 ? 'up' : 'down'}`}>
                        {delta > 0 ? '+' : ''}{delta}
                      </span>
                    )}
                  </span>
                  <span className="timeline-col reason-col">{snap.reason}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </BorderGlow>
  );
}
