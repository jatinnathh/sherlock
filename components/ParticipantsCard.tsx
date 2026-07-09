'use client';

import { ParticipantScore } from '@/lib/confidence';
import { Participant } from '@/lib/simulation';
import { motion, AnimatePresence } from 'framer-motion';
import BorderGlow from './BorderGlow';
import './ParticipantsCard.css';

interface ParticipantsCardProps {
  scores: ParticipantScore[];
  participants: Record<string, Participant>;
  onUpdateParticipant?: (id: string, updates: Partial<Participant>) => void;
}

/** Animated counter that smoothly transitions between numbers */
function AnimatedConfidence({ value, className }: { value: number; className: string }) {
  return (
    <motion.span
      className={`confidence-value ${className}`}
      key={value}
      initial={{ opacity: 0.5, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      {value}%
    </motion.span>
  );
}

export default function ParticipantsCard({ scores, participants, onUpdateParticipant }: ParticipantsCardProps) {
  const sorted = [...scores].sort((a, b) => b.confidence - a.confidence);

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
      className="participants-glow"
    >
      <div className="card-content participants-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">👥</span>
            Participants
          </h2>
          <span className="participant-count">{sorted.length}</span>
        </div>

        <div className="participants-list">
          <AnimatePresence mode="popLayout">
            {sorted.map((score, index) => {
              const p = participants[score.participantId];
              if (!p) return null;

              return (
                <motion.div
                  key={score.participantId}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{
                    layout: { type: 'spring', stiffness: 300, damping: 30 },
                    delay: index * 0.05,
                  }}
                  className={`participant-entry ${score.isCandidate ? 'is-candidate' : ''}`}
                >
                  <div className="participant-header">
                    <div className="participant-info">
                      <div className="participant-avatar">
                        <div className={`avatar-circle ${p.webcamOn ? 'active' : 'inactive'}`}>
                          {p.displayName.charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="participant-details">
                        {onUpdateParticipant ? (
                          <input
                            className="participant-name-input"
                            value={p.displayName}
                            onChange={(e) => onUpdateParticipant(p.id, { displayName: e.target.value })}
                            title="Edit display name to test signals live"
                            placeholder="Display Name"
                          />
                        ) : (
                          <span className="participant-name">{p.displayName}</span>
                        )}
                        {(p.email !== null || onUpdateParticipant) && (
                          <div className="participant-email">
                            {onUpdateParticipant ? (
                              <input
                                className="participant-email-input"
                                value={p.email || ''}
                                onChange={(e) => onUpdateParticipant(p.id, { email: e.target.value || null })}
                                placeholder="Email (null)"
                                title="Edit email to test signals live"
                              />
                            ) : (
                              <span className="email-text">{p.email}</span>
                            )}
                          </div>
                        )}
                        <div className="participant-badges">
                          {p.webcamOn && (
                            <span className="badge badge-webcam" title="Webcam ON">🎥</span>
                          )}
                          {p.screenShare && (
                            <span className="badge badge-screen" title="Screen sharing">🖥️</span>
                          )}
                          {score.isCandidate && (
                            <motion.span
                              className={`badge badge-candidate ${score.decisionStatus}`}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 500 }}
                              title={`Confidence lead: ${score.margin}%`}
                            >
                              {getDecisionLabel(score.decisionStatus)}
                            </motion.span>
                          )}
                        </div>
                      </div>
                    </div>
                    <AnimatedConfidence
                      value={score.confidence}
                      className={getConfidenceClass(score.confidence)}
                    />
                  </div>

                  <div className="confidence-bar-track">
                    <motion.div
                      className={`confidence-bar-fill ${getConfidenceClass(score.confidence)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${score.confidence}%` }}
                      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </BorderGlow>
  );
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 60) return 'high';
  if (confidence >= 30) return 'medium';
  return 'low';
}

function getDecisionLabel(status: ParticipantScore['decisionStatus']): string {
  if (status === 'identified') return 'CANDIDATE';
  if (status === 'tentative') return 'TENTATIVE';
  return 'COLLECTING';
}
