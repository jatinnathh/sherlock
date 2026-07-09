/**
 * Signal: Screen Share Pattern
 *
 * Analyses when a participant shares their screen. Early screen shares are
 * often interviewer setup, while later shares after candidate answers are a
 * strong candidate/coding exercise signal.
 */

import type { Participant, TimelineEvent } from '../simulation';
import type { SignalResult } from './name';

export function scoreScreenShare(
  participant: Participant,
  firedEvents: TimelineEvent[],
): SignalResult {
  const shareEvents = firedEvents.filter(
    (e) => e.type === 'screen_share' && e.participantId === participant.id,
  );

  if (shareEvents.length === 0) {
    if (participant.screenShare) {
      const latestEventTime = firedEvents.at(-1)?.time ?? participant.joinTime;
      const secondsAfterJoin = Math.max(0, latestEventTime - participant.joinTime);
      const candidateLikeLines = firedEvents.filter(
        (e) => e.type === 'transcript' && e.participantId === participant.id,
      ).length;

      if (candidateLikeLines >= 2) {
        return {
          score: 0.88,
          reason: 'Screen share is currently active after candidate-style answers - strong coding/demo signal',
        };
      }

      return {
        score: secondsAfterJoin <= 20 ? 0.62 : 0.76,
        reason: 'Screen share is currently active from participant state, but no timeline event was emitted',
      };
    }

    return {
      score: 0,
      reason: 'No screen share observed yet',
    };
  }

  const firstShare = shareEvents[0];
  const firstShareTime = firstShare.time;
  const secondsAfterJoin = Math.max(0, firstShareTime - participant.joinTime);
  const currentlySharing = participant.screenShare;
  const priorCandidateLikeLines = firedEvents.filter(
    (e) =>
      e.type === 'transcript' &&
      e.participantId === participant.id &&
      e.time < firstShareTime,
  ).length;

  if (secondsAfterJoin <= 20 && priorCandidateLikeLines === 0) {
    return {
      score: 0.22,
      reason: `${currentlySharing ? 'Currently' : 'Previously'} shared screen ${secondsAfterJoin.toFixed(0)}s after joining - more likely interviewer setup than candidate evidence`,
    };
  }

  if (priorCandidateLikeLines >= 2) {
    return {
      score: 0.92,
      reason: `${currentlySharing ? 'Currently' : 'Previously'} shared screen after answering interview questions - strong candidate coding/demo signal`,
    };
  }

  if (firstShareTime >= 45) {
    return {
      score: 0.82,
      reason: `${currentlySharing ? 'Currently' : 'Previously'} shared screen later in the interview - consistent with candidate exercise or portfolio walkthrough`,
    };
  }

  return {
    score: 0.55,
    reason: `${currentlySharing ? 'Currently' : 'Previously'} shared screen during the interview - useful but timing is ambiguous`,
  };
}
