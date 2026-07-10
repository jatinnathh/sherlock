'use client';

import { ParticipantScore } from '@/lib/confidence';
import { LLMResult } from '@/hooks/useLLMReasoning';
import type { CalendarData, Participant, TimelineEvent } from '@/lib/simulation';
import BorderGlow from './BorderGlow';
import { motion } from 'framer-motion';
import './ReportCard.css';

interface ReportCardProps {
  scores: ParticipantScore[];
  llmResult?: LLMResult | null;
  events: TimelineEvent[];
  participants: Record<string, Participant>;
  calendar: CalendarData | null;
  onClose: () => void;
}

export default function ReportCard({
  scores,
  llmResult,
  events,
  participants,
  calendar,
  onClose,
}: ReportCardProps) {
  const candidate = scores.find((s) => s.isCandidate);
  if (!candidate) return null;

  const candidateParticipant = participants[candidate.participantId];
  const rankedScores = [...scores].sort((a, b) => b.confidence - a.confidence);
  const allSignals = [...candidate.signals].sort((a, b) => b.weight - a.weight);
  const transcriptEvidence = getTranscriptEvidence(candidate.participantId, events);

  return (
    <div className="report-overlay">
      <motion.div
        className="report-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <BorderGlow
          edgeSensitivity={30}
          glowColor="0 80 0"
          backgroundColor="#0a0a0a"
          borderRadius={20}
          glowRadius={30}
          glowIntensity={0.8}
          coneSpread={25}
          colors={['#4ade80', '#22c55e', '#16a34a']}
          className="report-glow"
        >
          <div className="card-content report-card">
            <div className="report-header">
              <h2 className="report-title">
                <span className="card-icon">REPORT</span>
                Final Analysis Report
              </h2>
              <button className="report-close" onClick={onClose}>x</button>
            </div>

            <div className="report-summary">
              <div className="report-verdict">
                <span className="report-label">Candidate Identified</span>
                <span className="report-name">{candidate.displayName}</span>
                <span className="report-subtle">Participant ID: {candidate.participantId}</span>
              </div>
              <div className="report-score-box">
                <span className="report-score-label">Final Confidence</span>
                <span className="report-score-val">{candidate.confidence}%</span>
                <span className="report-score-label">
                  {candidate.decisionStatus === 'identified'
                    ? `Identified with +${candidate.margin}% lead`
                    : candidate.decisionStatus === 'tentative'
                      ? `Tentative with +${candidate.margin}% lead`
                      : 'Insufficient evidence for final identification'}
                </span>
              </div>
            </div>

            <div className="report-section">
              <h3 className="report-section-title">All Signals and Evidence</h3>
              <p className="report-desc">
                Every signal below contributed to, or failed to contribute to, the final candidate score.
              </p>
              <div className="report-signals-list">
                {allSignals.map((signal) => {
                  const evidence = buildSignalEvidence(
                    signal.id,
                    candidate.participantId,
                    events,
                    candidateParticipant,
                    calendar,
                  );

                  return (
                    <div key={signal.id} className={`report-signal-detail ${signal.fired ? 'fired' : 'pending'}`}>
                      <div className="report-signal-row">
                        <span className="report-signal-name">{signal.name}</span>
                        <span className="report-signal-weight">
                          {(signal.score * 100).toFixed(0)}% score | {(signal.weight * 100).toFixed(0)}% weight
                        </span>
                      </div>
                      <p className="report-signal-reason">{signal.description}</p>
                      {evidence.length > 0 && (
                        <div className="report-evidence-list">
                          {evidence.map((item, index) => (
                            <div key={`${signal.id}-${index}`} className="report-evidence-item">
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="report-section">
              <h3 className="report-section-title">Transcript Evidence</h3>
              <p className="report-desc">
                Candidate-attributed transcript lines that support the behavioral analysis.
              </p>
              <div className="report-transcript-list">
                {transcriptEvidence.length > 0 ? (
                  transcriptEvidence.map((line, index) => (
                    <div key={index} className="report-transcript-line">
                      <span className="report-time">{formatTime(line.time)}</span>
                      <span>{line.text}</span>
                    </div>
                  ))
                ) : (
                  <div className="report-evidence-item">No candidate transcript lines were available.</div>
                )}
              </div>
            </div>

            <div className="report-section">
              <h3 className="report-section-title">Other Participants Ruled Out</h3>
              <div className="report-ranked-list">
                {rankedScores
                  .filter((score) => score.participantId !== candidate.participantId)
                  .map((score) => (
                    <div key={score.participantId} className="report-ranked-item">
                      <span>{score.displayName}</span>
                      <span>{score.confidence}%</span>
                    </div>
                  ))}
              </div>
            </div>

            {llmResult && (
              <div className="report-section">
                <h3 className="report-section-title">AI Reasoning</h3>
                <p className="report-desc">LLM explanation based on transcript and participant data.</p>
                <div className="report-llm-reasons">
                  {llmResult.signals.map((reason, index) => (
                    <div key={index} className="report-llm-reason">
                      <span className="llm-dot">&gt;</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="report-footer">
              Sherlock AI Fraud Detection Engine
            </div>
          </div>
        </BorderGlow>
      </motion.div>
    </div>
  );
}

function buildSignalEvidence(
  signalId: string,
  participantId: string,
  events: TimelineEvent[],
  participant: Participant | undefined,
  calendar: CalendarData | null,
): string[] {
  const participantEvents = events.filter((event) => event.participantId === participantId);
  const transcriptLines = getTranscriptEvidence(participantId, events);

  switch (signalId) {
    case 'name-match':
      return [
        `Display name: "${participant?.displayName ?? 'unknown'}"`,
        `Expected candidate: "${calendar?.candidateName ?? 'unknown'}"`,
        ...transcriptLines
          .filter((line) => {
            const firstName = calendar?.candidateName.split(' ')[0]?.toLowerCase() ?? '';
            return firstName.length > 0 && line.text.toLowerCase().includes(firstName);
          })
          .slice(0, 2)
          .map((line) => `Transcript ${formatTime(line.time)}: "${line.text}"`),
      ];

    case 'email-match':
      return [
        `Participant email: ${participant?.email ?? 'not available'}`,
        `Candidate email: ${calendar?.candidateEmail || 'not available'}`,
      ];

    case 'transcript-analysis':
      return transcriptLines
        .slice(0, 4)
        .map((line) => `${formatTime(line.time)} "${line.text}"`);

    case 'speaker-pattern': {
      const speakingEvents = participantEvents.filter((event) => event.type === 'speaking');
      const totalMs = speakingEvents.reduce((sum, event) => sum + (event.data.durationMs ?? 0), 0);
      return [
        `${speakingEvents.length} speaking turns`,
        `${(totalMs / 1000).toFixed(1)} seconds of detected speaking activity`,
        ...transcriptLines.slice(0, 2).map((line) => `Transcript ${formatTime(line.time)}: "${line.text}"`),
      ];
    }

    case 'join-timing': {
      const joinEvent = participantEvents.find((event) => event.type === 'join');
      return [
        joinEvent
          ? `Joined at ${formatTime(joinEvent.time)} as "${joinEvent.data.displayName ?? participant?.displayName ?? 'unknown'}"`
          : `Initial join time: ${formatTime(participant?.joinTime ?? 0)}`,
      ];
    }

    case 'screen-share-pattern': {
      const shareEvents = participantEvents.filter((event) => event.type === 'screen_share');
      if (shareEvents.length === 0 && participant?.screenShare) {
        return ['Screen share is currently active from participant state.'];
      }
      return shareEvents.map(
        (event) => `${event.data.active ? 'Started' : 'Stopped'} screen share at ${formatTime(event.time)}`,
      );
    }

    case 'camera-activity':
      return participantEvents
        .filter((event) => event.type === 'webcam_on' || event.type === 'webcam_off')
        .map((event) => `${event.type === 'webcam_on' ? 'Webcam on' : 'Webcam off'} at ${formatTime(event.time)}`);

    default:
      return [];
  }
}

function getTranscriptEvidence(participantId: string, events: TimelineEvent[]) {
  return events
    .filter((event) => event.type === 'transcript' && event.participantId === participantId && event.data.text)
    .map((event) => ({
      time: event.time,
      text: event.data.text ?? '',
    }));
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
}
