/**
 * Signal: Join Timing
 *
 * Analyses when a participant joined relative to the scheduled start
 * and other participants. Candidates tend to join on time or slightly
 * early, while observers often join later.
 */

import type { Participant } from '../simulation';
import type { SignalResult } from './name';

export function scoreJoin(
  participant: Participant,
  allParticipants: Participant[],
): SignalResult {
  const joinTime = participant.joinTime;

  // ── Compute join order ──────────────────────────────────────
  const sortedByJoin = [...allParticipants].sort((a, b) => a.joinTime - b.joinTime);
  const joinPosition = sortedByJoin.findIndex((p) => p.id === participant.id);
  const totalParticipants = allParticipants.length;

  // ── Late joiner (joined significantly after others) ─────────
  const earliestJoin = sortedByJoin[0]?.joinTime ?? 0;
  const joinDelay = joinTime - earliestJoin;

  // ── Scoring logic ───────────────────────────────────────────

  // First or second to join → common for candidate + interviewer
  if (joinPosition <= 1 && totalParticipants > 2) {
    // Can't distinguish candidate from interviewer by join alone,
    // but we know it's NOT an observer
    return {
      score: 0.55,
      reason: `Joined ${joinPosition === 0 ? 'first' : 'second'} — typical for candidate or interviewer`,
    };
  }

  // Joined within 5 seconds of start → on time
  if (joinDelay <= 5) {
    return {
      score: 0.50,
      reason: `Joined promptly (${joinDelay}s after first participant) — punctual, consistent with candidate`,
    };
  }

  // Joined 5-30 seconds late → slightly late but normal
  if (joinDelay <= 30) {
    return {
      score: 0.35,
      reason: `Joined ${joinDelay}s after meeting started — slightly late`,
    };
  }

  // Very late joiner → likely observer or backup interviewer
  if (joinDelay > 30) {
    return {
      score: 0.10,
      reason: `Joined ${joinDelay}s late — very late joiners are typically observers`,
    };
  }

  // Default
  return {
    score: 0.30,
    reason: `Join timing (position ${joinPosition + 1}/${totalParticipants}) is inconclusive`,
  };
}
