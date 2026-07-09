/**
 * Confidence Engine — orchestrates all signal extractors and computes
 * a weighted confidence score for each participant.
 *
 * Each signal is a separate module in lib/signals/.
 * This file wires them together and produces the final score.
 */

import type {
  Participant,
  CalendarData,
  TimelineEvent,
} from './simulation';

import { scoreName } from './signals/name';
import { scoreEmail } from './signals/email';
import { scoreTranscript } from './signals/transcript';
import { scoreSpeaker } from './signals/speaker';
import { scoreJoin } from './signals/join';
import { scoreCamera } from './signals/camera';
import { scoreScreenShare } from './signals/screenshare';
import type { SignalResult } from './signals/name';

// ─── Public Types ───────────────────────────────────────────────────

export interface Signal {
  id: string;
  name: string;
  weight: number;       // importance 0–1
  score: number;        // raw score 0–1
  description: string;  // human-readable explanation
  fired: boolean;       // has this signal contributed yet?
}

export interface ParticipantScore {
  participantId: string;
  displayName: string;
  confidence: number;   // 0-100
  margin: number;        // lead over the second-place participant
  decisionStatus: 'identified' | 'tentative' | 'insufficient_evidence';
  signals: Signal[];
  reasoning: string;
  isCandidate: boolean;  // current leading participant, not always a final decision
}

// ─── Signal Weights ─────────────────────────────────────────────────

/**
 * Weight configuration for each signal.
 * Weights sum to exactly 1.0 (100%) for direct normalisation.
 *
 *   Name         28% - strongest single signal
 *   Transcript   22% - what they say reveals identity
 *   Speaking     16% - candidate talks 40-65% of the time
 *   Email        14% - calendar email match
 *   Join          8% - join order/timing
 *   Screen Share  8% - coding/demo workflow signal
 *   Camera        4% - webcam on/off is weak alone
 */
const SIGNAL_WEIGHTS: Record<string, number> = {
  'name-match':          0.28,
  'email-match':         0.14,
  'transcript-analysis': 0.22,
  'speaker-pattern':     0.16,
  'join-timing':         0.08,
  'screen-share-pattern': 0.08,
  'camera-activity':     0.04,
};

// ─── Signal Wiring ──────────────────────────────────────────────────

function extractSignals(
  participantId: string,
  participant: Participant,
  calendar: CalendarData,
  firedEvents: TimelineEvent[],
  allParticipants: Participant[],
): Signal[] {
  // Run each extractor
  const results: { id: string; name: string; result: SignalResult }[] = [
    {
      id: 'name-match',
      name: 'Name Match',
      result: scoreName(participant, calendar),
    },
    {
      id: 'email-match',
      name: 'Email Match',
      result: scoreEmail(participant, calendar),
    },
    {
      id: 'transcript-analysis',
      name: 'Transcript Analysis',
      result: scoreTranscript(participantId, firedEvents, calendar),
    },
    {
      id: 'speaker-pattern',
      name: 'Speaker Pattern',
      result: scoreSpeaker(participantId, firedEvents),
    },
    {
      id: 'join-timing',
      name: 'Join Timing',
      result: scoreJoin(participant, allParticipants),
    },
    {
      id: 'screen-share-pattern',
      name: 'Screen Share',
      result: scoreScreenShare(participant, firedEvents),
    },
    {
      id: 'camera-activity',
      name: 'Camera Activity',
      result: scoreCamera(participant, firedEvents),
    },
  ];

  return results.map(({ id, name, result }) => ({
    id,
    name,
    weight: SIGNAL_WEIGHTS[id] ?? 0.1,
    score: result.score,
    description: result.reason,
    fired: result.score > 0,
  }));
}

// ─── Main Scorer ────────────────────────────────────────────────────

export function computeParticipantScore(
  participantId: string,
  participant: Participant,
  calendar: CalendarData,
  firedEvents: TimelineEvent[],
  allParticipants: Participant[],
): ParticipantScore {
  const signals = extractSignals(
    participantId,
    participant,
    calendar,
    firedEvents,
    allParticipants,
  );

  // Weighted average
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of signals) {
    weightedSum += s.score * s.weight;
    totalWeight += s.weight;
  }
  const confidence = totalWeight > 0
    ? Math.round((weightedSum / totalWeight) * 100)
    : 0;

  // Build reasoning from active signals, sorted by impact (score × weight)
  const activeSignals = signals.filter((s) => s.fired);
  const topSignals = [...activeSignals].sort(
    (a, b) => (b.score * b.weight) - (a.score * a.weight),
  );
  const reasoning = topSignals
    .map((s) => `• ${s.name} (${(s.score * 100).toFixed(0)}%): ${s.description}`)
    .join('\n');

  return {
    participantId,
    displayName: participant.displayName,
    confidence,
    margin: 0,
    decisionStatus: 'insufficient_evidence',
    signals,
    reasoning,
    isCandidate: false, // set by computeAllConfidences
  };
}

export function computeAllConfidences(
  participants: Record<string, Participant>,
  calendar: CalendarData,
  firedEvents: TimelineEvent[],
): ParticipantScore[] {
  const allParticipants = Object.values(participants);

  const scores = Object.entries(participants).map(([id, p]) =>
    computeParticipantScore(id, p, calendar, firedEvents, allParticipants),
  );

  // Mark the current leader and expose whether the evidence is decisive.
  // A production system should keep observing when the score or margin is weak.
  const sorted = [...scores].sort((a, b) => b.confidence - a.confidence);
  if (sorted.length > 0) {
    const [top, runnerUp] = sorted;
    const margin = top.confidence - (runnerUp?.confidence ?? 0);
    const decisionStatus: ParticipantScore['decisionStatus'] =
      top.confidence >= 75 && margin >= 12
        ? 'identified'
        : top.confidence >= 45 && margin >= 8
          ? 'tentative'
          : 'insufficient_evidence';

    for (const s of scores) {
      s.isCandidate = s.participantId === top.participantId;
      s.margin = s.participantId === top.participantId ? margin : 0;
      s.decisionStatus = s.participantId === top.participantId
        ? decisionStatus
        : 'insufficient_evidence';
    }
  }

  return scores;
}
