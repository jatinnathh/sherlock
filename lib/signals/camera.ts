/**
 * Signal: Camera / Webcam Activity
 *
 * Analyses webcam and screen sharing state. Candidates almost
 * always have their webcam on. Screen sharing is a strong
 * indicator of active participation (often candidate demo).
 */

import type { Participant, TimelineEvent } from '../simulation';
import type { SignalResult } from './name';

export function scoreCamera(
  participant: Participant,
  firedEvents: TimelineEvent[],
): SignalResult {
  const webcamOn = participant.webcamOn;
  const screenShare = participant.screenShare;

  // Count webcam toggles for this participant
  const webcamEvents = firedEvents.filter(
    (e) =>
      (e.type === 'webcam_on' || e.type === 'webcam_off') &&
      e.participantId === participant.id,
  );

  const screenShareEvents = firedEvents.filter(
    (e) => e.type === 'screen_share' && e.participantId === participant.id,
  );

  const hasEverSharedScreen = screenShareEvents.length > 0;

  // ── Screen sharing is a strong candidate signal ─────────────
  if (screenShare || hasEverSharedScreen) {
    return {
      score: 0.85,
      reason: `${screenShare ? 'Currently' : 'Previously'} screen sharing — candidates often share screens during technical interviews`,
    };
  }

  // ── Webcam on with stable connection ────────────────────────
  if (webcamOn && webcamEvents.length <= 1) {
    return {
      score: 0.65,
      reason: 'Webcam is ON and stable — expected for a candidate',
    };
  }

  // ── Webcam on but toggled multiple times ────────────────────
  if (webcamOn && webcamEvents.length > 1) {
    return {
      score: 0.55,
      reason: `Webcam is ON but toggled ${webcamEvents.length} times — possibly connection issues`,
    };
  }

  // ── Webcam off ──────────────────────────────────────────────
  if (!webcamOn && webcamEvents.length === 0) {
    // Never turned on — typical for observer
    return {
      score: 0.10,
      reason: 'Webcam has never been turned on — very unusual for a candidate, typical for observers',
    };
  }

  // Turned off after being on
  return {
    score: 0.30,
    reason: 'Webcam was turned off — possibly connection issues or intentional',
  };
}
