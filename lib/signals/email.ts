/**
 * Signal: Email Match
 *
 * Compares participant email against the candidate email from
 * the calendar invite. Checks exact match, username similarity,
 * and domain-based signals.
 */

import type { Participant, CalendarData } from '../simulation';
import type { SignalResult } from './name';

export function scoreEmail(
  participant: Participant,
  calendar: CalendarData,
): SignalResult {
  const pEmail = (participant.email ?? '').toLowerCase().trim();
  const cEmail = (calendar.candidateEmail ?? '').toLowerCase().trim();

  // ── No data cases ───────────────────────────────────────────
  if (!pEmail && !cEmail) {
    return { score: 0.5, reason: 'No email available for participant or candidate — cannot score' };
  }

  if (!pEmail) {
    return { score: 0.4, reason: 'Participant has no email — slightly unusual but not conclusive' };
  }

  if (!cEmail) {
    return { score: 0.5, reason: 'No candidate email in calendar — cannot compare' };
  }

  // ── Exact match ─────────────────────────────────────────────
  if (pEmail === cEmail) {
    return { score: 1.0, reason: `Email "${pEmail}" exactly matches candidate email` };
  }

  // ── Parse parts ─────────────────────────────────────────────
  const [pUser, pDomain] = pEmail.split('@');
  const [cUser, cDomain] = cEmail.split('@');

  if (!pDomain || !cDomain) {
    return { score: 0.1, reason: 'Invalid email format — cannot analyse' };
  }

  // ── Same domain check ──────────────────────────────────────
  // If participant is on a corporate domain that matches interviewer emails,
  // they're likely an employee, NOT the candidate
  const corporateDomains = ['company.com', 'corp.com', 'org.com']; // common patterns
  const isOnCorporateDomain = corporateDomains.some((d) => pDomain.includes(d));

  if (pDomain === cDomain) {
    // Same domain — check username similarity
    if (pUser === cUser) {
      return { score: 0.95, reason: `Same domain and username pattern — very likely the same person` };
    }

    // Same domain but different user
    const userOverlap = longestCommonSubstring(pUser, cUser);
    if (userOverlap.length >= 3) {
      return { score: 0.6, reason: `Same domain "${pDomain}", username overlap: "${userOverlap}"` };
    }

    // If it's a generic public domain (gmail, yahoo), matching domain means nothing without username match
    const publicDomains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'aol.com'];
    if (publicDomains.includes(pDomain)) {
      return { score: 0.05, reason: `Generic domain "${pDomain}" match, but no username correlation` };
    }

    return { score: 0.35, reason: `Same custom email domain "${pDomain}" but different username` };
  }

  // ── Different domain ────────────────────────────────────────
  // Candidate typically uses personal email (gmail, outlook, etc.)
  // Interviewers use company email
  const personalDomains = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'protonmail.com', 'icloud.com'];
  const candidateIsPersonal = personalDomains.some((d) => cDomain === d);
  const participantIsCorporate = !personalDomains.some((d) => pDomain === d);

  if (candidateIsPersonal && participantIsCorporate) {
    // Candidate uses gmail, participant uses company.com → probably NOT the candidate
    return { score: 0.05, reason: `Candidate uses personal email (${cDomain}), participant uses corporate email (${pDomain}) — likely an employee` };
  }

  if (isOnCorporateDomain) {
    return { score: 0.05, reason: `Participant on corporate domain "${pDomain}" — likely an interviewer or employee` };
  }

  // ── Username cross-domain check ─────────────────────────────
  if (pUser === cUser) {
    return { score: 0.55, reason: `Same username "${pUser}" across different domains — possible match` };
  }

  return { score: 0.15, reason: `Different email "${pEmail}" — no match with candidate "${cEmail}"` };
}

/** Find the longest common substring between two strings. */
function longestCommonSubstring(a: string, b: string): string {
  const m = a.length;
  const n = b.length;
  let maxLen = 0;
  let endIdx = 0;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
        if (dp[i][j] > maxLen) {
          maxLen = dp[i][j];
          endIdx = i;
        }
      }
    }
  }

  return a.slice(endIdx - maxLen, endIdx);
}
