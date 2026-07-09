/**
 * Signal: Camera / Webcam Activity
 *
 * Analyses webcam activity. Candidates commonly keep their webcam on,
 * while silent observers often leave video disabled.
 */

import type { Participant, TimelineEvent } from '../simulation';
import type { SignalResult } from './name';

export function scoreCamera(
  participant: Participant,
  firedEvents: TimelineEvent[],
): SignalResult {
  const webcamOn = participant.webcamOn;

  const webcamEvents = firedEvents.filter(
    (e) =>
      (e.type === 'webcam_on' || e.type === 'webcam_off') &&
      e.participantId === participant.id,
  );

  if (webcamOn && webcamEvents.length <= 1) {
    return {
      score: 0.65,
      reason: 'Webcam is on and stable - expected for a candidate',
    };
  }

  if (webcamOn && webcamEvents.length > 1) {
    return {
      score: 0.55,
      reason: `Webcam is on but toggled ${webcamEvents.length} times - possibly connection issues`,
    };
  }

  if (!webcamOn && webcamEvents.length === 0) {
    return {
      score: 0.10,
      reason: 'Webcam has never been turned on - very unusual for a candidate, typical for observers',
    };
  }

  return {
    score: 0.30,
    reason: 'Webcam was turned off - possibly connection issues or intentional',
  };
}
