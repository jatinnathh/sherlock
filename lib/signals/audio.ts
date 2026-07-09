/**
 * Signal: Audio Activity
 *
 * Analyses raw audio participation metrics: total speaking time,
 * speaking frequency, average turn duration, and silence gaps.
 * This complements the speaker ratio signal by looking at absolute
 * audio engagement rather than relative ratios.
 */

import type { TimelineEvent } from '../simulation';
import type { SignalResult } from './name';

export function scoreAudio(
  participantId: string,
  firedEvents: TimelineEvent[],
): SignalResult {
  const speakingEvents = firedEvents.filter(
    (e) => e.type === 'speaking' && e.participantId === participantId,
  );

  // ── No audio data ───────────────────────────────────────────
  if (speakingEvents.length === 0) {
    return {
      score: 0.0,
      reason: 'No audio activity detected for this participant',
    };
  }

  // ── Compute metrics ─────────────────────────────────────────
  let totalDurationMs = 0;
  const durations: number[] = [];

  for (const e of speakingEvents) {
    const dur = e.data.durationMs ?? 0;
    totalDurationMs += dur;
    durations.push(dur);
  }

  const turnCount = speakingEvents.length;
  const avgTurnMs = totalDurationMs / turnCount;
  const totalDurationSec = totalDurationMs / 1000;

  // ── Longest turn (candidates often have extended answers) ───
  const maxTurn = Math.max(...durations);
  const hasLongTurns = maxTurn >= 6000; // 6+ seconds = substantive answer

  // ── Turn duration variance (candidates have varied turn lengths) ──
  const mean = avgTurnMs;
  const variance = durations.reduce((sum, d) => sum + Math.pow(d - mean, 2), 0) / turnCount;
  const stdDev = Math.sqrt(variance);
  const hasVariedTurns = stdDev > 1500; // high variance = mixed short/long responses

  // ── Scoring ─────────────────────────────────────────────────
  let score = 0.3; // base
  const reasons: string[] = [];

  // Multiple speaking turns → active participant
  if (turnCount >= 3) {
    score += 0.15;
    reasons.push(`${turnCount} speaking turns — actively engaged`);
  } else if (turnCount >= 1) {
    score += 0.05;
    reasons.push(`${turnCount} speaking turn(s) — limited engagement`);
  }

  // Long speaking turns → answering questions in depth
  if (hasLongTurns) {
    score += 0.20;
    reasons.push(`Has extended responses (longest: ${(maxTurn / 1000).toFixed(1)}s) — typical for answering interview questions`);
  }

  // Varied turn lengths → natural conversation (short confirmations + long explanations)
  if (hasVariedTurns) {
    score += 0.10;
    reasons.push('Varied response lengths — natural Q&A pattern');
  }

  // Total speaking time threshold
  if (totalDurationSec >= 15) {
    score += 0.10;
    reasons.push(`${totalDurationSec.toFixed(1)}s total speaking time — substantial participation`);
  }

  score = Math.min(score, 1.0);

  return {
    score,
    reason: reasons.length > 0
      ? reasons.join('. ') + '.'
      : `Audio activity: ${turnCount} turns, ${totalDurationSec.toFixed(1)}s total`,
  };
}
