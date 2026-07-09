'use client';

import { ParticipantScore } from '@/lib/confidence';
import BorderGlow from './BorderGlow';
import './SignalsCard.css';

interface SignalsCardProps {
  scores: ParticipantScore[];
}

export default function SignalsCard({ scores }: SignalsCardProps) {
  // Show signals for the top candidate
  const candidate = scores.find((s) => s.isCandidate);
  const signals = candidate?.signals ?? [];

  const firedSignals = signals.filter((s) => s.fired);
  const pendingSignals = signals.filter((s) => !s.fired);

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
      className="signals-glow"
    >
      <div className="card-content signals-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">📡</span>
            Current Signals
          </h2>
          {candidate && (
            <span className="signals-for">
              for {candidate.displayName}
            </span>
          )}
        </div>

        {firedSignals.length === 0 && pendingSignals.length === 0 ? (
          <div className="signals-empty">
            <span className="empty-icon">📡</span>
            <span>No signals detected yet</span>
          </div>
        ) : (
          <div className="signals-list">
            {firedSignals.map((signal) => (
              <div key={signal.id} className="signal-chip fired">
                <div className="signal-chip-header">
                  <span className="signal-name">{signal.name}</span>
                  <span className={`signal-score ${getScoreClass(signal.score)}`}>
                    {(signal.score * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="signal-bar-track">
                  <div
                    className={`signal-bar-fill ${getScoreClass(signal.score)}`}
                    style={{ width: `${signal.score * 100}%` }}
                  />
                </div>
                <p className="signal-desc">{signal.description}</p>
              </div>
            ))}

            {pendingSignals.map((signal) => (
              <div key={signal.id} className="signal-chip pending">
                <div className="signal-chip-header">
                  <span className="signal-name">{signal.name}</span>
                  <span className="signal-score pending-score">—</span>
                </div>
                <p className="signal-desc">{signal.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </BorderGlow>
  );
}

function getScoreClass(score: number): string {
  if (score >= 0.6) return 'high';
  if (score >= 0.3) return 'medium';
  return 'low';
}
