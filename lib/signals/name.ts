/**
 * Signal: Name Match
 *
 * Compares participant display name against the candidate name
 * from the calendar invite using fuzzy matching, substring checks,
 * and Levenshtein distance.
 */

import type { Participant, CalendarData } from '../simulation';

export interface SignalResult {
  score: number;     // 0–1, how likely this participant is the candidate
  reason: string;    // human-readable explanation
}

/** Compute Levenshtein edit distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

/** Normalised Levenshtein similarity (1 = identical, 0 = completely different). */
function similarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

export function scoreName(
  participant: Participant,
  calendar: CalendarData,
): SignalResult {
  const pName = participant.displayName.toLowerCase().trim();
  const cName = calendar.candidateName.toLowerCase().trim();

  // Guard: no candidate name available
  if (!cName) {
    return { score: 0.5, reason: 'No candidate name provided in calendar — cannot score' };
  }

  const cParts = cName.split(/\s+/);
  const cFirst = cParts[0];
  const cLast = cParts.length > 1 ? cParts[cParts.length - 1] : '';

  // ── Exact match ─────────────────────────────────────────────
  if (pName === cName) {
    return { score: 1.0, reason: `Display name "${participant.displayName}" exactly matches candidate "${calendar.candidateName}"` };
  }

  // ── Both first AND last name present ────────────────────────
  if (cLast && pName.includes(cFirst) && pName.includes(cLast)) {
    return { score: 0.92, reason: `Display name contains both first ("${cFirst}") and last ("${cLast}") name` };
  }

  // ── First name exact match ──────────────────────────────────
  if (pName === cFirst || pName.includes(cFirst)) {
    const sim = similarity(pName, cName);
    const score = Math.max(0.55, Math.min(0.80, sim + 0.15));
    return { score, reason: `Display name "${participant.displayName}" contains candidate first name "${cFirst}"` };
  }

  // ── Last name match ─────────────────────────────────────────
  if (cLast && pName.includes(cLast)) {
    return { score: 0.50, reason: `Display name "${participant.displayName}" contains candidate last name "${cLast}"` };
  }

  // ── Reverse containment (candidate name contains display name) ──
  if (cName.includes(pName) && pName.length > 2) {
    return { score: 0.45, reason: `Candidate name "${calendar.candidateName}" contains "${participant.displayName}"` };
  }

  // ── Known interviewer name match — strongly NOT candidate ───
  const isInterviewer = calendar.interviewerNames.some(
    (iName) => pName.includes(iName.toLowerCase()),
  );
  if (isInterviewer) {
    return { score: 0.0, reason: `"${participant.displayName}" matches known interviewer name` };
  }

  // ── Fuzzy similarity fallback ───────────────────────────────
  const sim = similarity(pName, cName);
  if (sim > 0.6) {
    return { score: sim * 0.6, reason: `Fuzzy similarity ${(sim * 100).toFixed(0)}% between "${participant.displayName}" and "${calendar.candidateName}"` };
  }

  // ── Device name patterns ────────────────────────────────────
  const devicePatterns = ['macbook', 'iphone', 'ipad', 'galaxy', 'pixel', 'desktop', 'laptop', 'windows'];
  const isDevice = devicePatterns.some((d) => pName.includes(d));
  if (isDevice) {
    return { score: 0.15, reason: `"${participant.displayName}" appears to be a device name — no name match possible` };
  }

  // ── No match ────────────────────────────────────────────────
  return { score: 0.05, reason: `No name match between "${participant.displayName}" and candidate "${calendar.candidateName}"` };
}
