/**
 * Signal: Speaker Pattern
 *
 * Analyses the relative speaking ratio of a participant.
 * In a typical interview, the candidate speaks 40–65% of the time.
 * Interviewers speak 25–40%. Observers speak < 5%.
 */

import type { TimelineEvent } from '../simulation';
import type { SignalResult } from './name';

export function scoreSpeaker(
  participantId: string,
  firedEvents: TimelineEvent[],
): SignalResult {
  const speakingEvents = firedEvents.filter((e) => e.type === 'speaking');

  if (speakingEvents.length === 0) {
    return {
      score: 0.0,
      reason: 'No speaking data available yet',
    };
  }

  // ── Compute per-participant totals ──────────────────────────
  const durations: Record<string, number> = {};
  const turnCounts: Record<string, number> = {};
  let grandTotal = 0;

  for (const e of speakingEvents) {
    const dur = e.data.durationMs ?? 0;
    durations[e.participantId] = (durations[e.participantId] ?? 0) + dur;
    turnCounts[e.participantId] = (turnCounts[e.participantId] ?? 0) + 1;
    grandTotal += dur;
  }

  const myDuration = durations[participantId] ?? 0;
  const myTurns = turnCounts[participantId] ?? 0;
  const ratio = grandTotal > 0 ? myDuration / grandTotal : 0;
  const totalParticipants = Object.keys(durations).length;

  // ── No speaking at all ──────────────────────────────────────
  if (myDuration === 0) {
    return {
      score: 0.02,
      reason: 'This participant has not spoken — very unlikely to be the candidate',
    };
  }

  // ── Dominant speaker (> 70%) → possibly candidate but a bit unusual ──
  if (ratio > 0.70) {
    return {
      score: 0.55,
      reason: `Speaking ${(ratio * 100).toFixed(0)}% of the time (${(myDuration / 1000).toFixed(1)}s across ${myTurns} turns) — dominant speaker, possibly monologuing candidate`,
    };
  }

  // ── Sweet spot for candidate: 35–70% ────────────────────────
  if (ratio >= 0.35) {
    // Score peaks at ~55% ratio (ideal candidate ratio)
    const idealRatio = 0.55;
    const deviation = Math.abs(ratio - idealRatio);
    const score = Math.max(0.65, 0.95 - deviation * 2);

    return {
      score,
      reason: `Speaking ${(ratio * 100).toFixed(0)}% of the time (${(myDuration / 1000).toFixed(1)}s across ${myTurns} turns) — consistent with candidate speaking pattern`,
    };
  }

  // ── Moderate speaker (20–35%) → typical interviewer range ───
  if (ratio >= 0.20) {
    return {
      score: 0.30,
      reason: `Speaking ${(ratio * 100).toFixed(0)}% of the time — more typical of an interviewer`,
    };
  }

  // ── Minimal speaker (5–20%) → unlikely candidate ────────────
  if (ratio >= 0.05) {
    return {
      score: 0.12,
      reason: `Speaking only ${(ratio * 100).toFixed(0)}% of the time — minimal participation`,
    };
  }

  // ── Almost silent (< 5%) → observer ─────────────────────────
  return {
    score: 0.03,
    reason: `Speaking less than 5% of the time — likely an observer (${totalParticipants} participants total)`,
  };
}
