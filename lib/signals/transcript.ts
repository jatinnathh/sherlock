/**
 * Signal: Transcript Analysis
 *
 * Analyses the content of what a participant says to determine
 * if they are the candidate. Looks for:
 * - Self-introduction patterns ("I am X", "my name is X")
 * - Answer-giving language (candidates answer questions)
 * - Question-asking language (interviewers ask questions)
 * - Technical/experience sharing (candidates describe their work)
 * - Name references by others
 */

import type { TimelineEvent, CalendarData } from '../simulation';
import type { SignalResult } from './name';

interface TranscriptLine {
  speaker: string;
  text: string;
}

export function scoreTranscript(
  participantId: string,
  firedEvents: TimelineEvent[],
  calendar: CalendarData,
): SignalResult {
  // Gather this participant's transcript lines
  const myLines = firedEvents.filter(
    (e) => e.type === 'transcript' && e.participantId === participantId,
  );

  // Gather ALL transcript lines (to detect how others reference this person)
  const allLines: TranscriptLine[] = firedEvents
    .filter((e) => e.type === 'transcript')
    .map((e) => ({ speaker: e.participantId, text: (e.data.text ?? '').toLowerCase() }));

  const otherLines = allLines.filter((l) => l.speaker !== participantId);

  if (myLines.length === 0) {
    return { score: 0.0, reason: 'No transcript data for this participant' };
  }

  const myText = myLines.map((t) => (t.data.text ?? '').toLowerCase()).join(' ');
  const candidateFirst = calendar.candidateName.split(' ')[0].toLowerCase();

  let score = 0.25; // base - they're at least speaking
  const reasons: string[] = [];

  // ── 1. Self-introduction ────────────────────────────────────
  const introPatterns = [
    `i am ${candidateFirst}`,
    `i'm ${candidateFirst}`,
    `my name is ${candidateFirst}`,
    `this is ${candidateFirst}`,
    'hello, i am',
    'hi, i am',
    'hi, my name',
  ];
  const hasSelfIntro = introPatterns.some((p) => myText.includes(p));
  if (hasSelfIntro) {
    score += 0.30;
    reasons.push(`Self-introduced as "${candidateFirst}"`);
  }

  // ── 2. Answer-giving language ───────────────────────────────
  const answerPhrases = [
    'sure', 'absolutely', 'let me', "i've been", 'i have been',
    'i built', 'i worked', 'we had', 'we implemented', 'i designed',
    'i developed', 'my experience', 'my role', 'in my previous',
    'i was responsible', 'i led', 'i managed', 'my approach',
  ];
  const answerHits = answerPhrases.filter((p) => myText.includes(p));
  if (answerHits.length >= 3) {
    score += 0.20;
    reasons.push(`Strong answer-giving language (${answerHits.length} patterns matched)`);
  } else if (answerHits.length >= 1) {
    score += 0.10;
    reasons.push(`Some answer-giving language (${answerHits.length} patterns matched)`);
  }

  // ── 3. Question-asking language (negative — interviewer indicator) ──
  const questionPhrases = [
    'tell me about', 'can you explain', 'how did you', 'walk me through',
    'what about', 'describe a time', 'give me an example', 'why did you',
    'what would you', 'how would you', 'let me ask', 'my next question',
    'thanks for joining', 'let\'s get started',
  ];
  const questionHits = questionPhrases.filter((p) => myText.includes(p));
  if (questionHits.length >= 2) {
    score -= 0.30;
    reasons.push(`Uses interviewer-style questioning language (${questionHits.length} patterns)`);
  } else if (questionHits.length === 1) {
    score -= 0.10;
    reasons.push('One interviewer-style question detected');
  }

  // ── 4. Technical/experience content ─────────────────────────
  const techPhrases = [
    'architecture', 'database', 'api', 'microservice', 'pipeline',
    'deploy', 'kubernetes', 'docker', 'react', 'python', 'typescript',
    'algorithm', 'system design', 'scalab', 'performance', 'latency',
    'kafka', 'redis', 'aws', 'gcp', 'azure',
  ];
  const techHits = techPhrases.filter((p) => myText.includes(p));
  if (techHits.length >= 2) {
    score += 0.10;
    reasons.push(`Discusses technical topics (${techHits.slice(0, 3).join(', ')})`);
  }

  // ── 5. Others reference this person by candidate name ───────
  const othersRefCandidate = otherLines.some(
    (l) => l.text.includes(candidateFirst) && candidateFirst.length > 2,
  );
  if (othersRefCandidate) {
    // Others call this person by the candidate's name (indirect signal)
    // Check if the reference happens in context of speaking TO this participant
    score += 0.10;
    reasons.push(`Other participants reference "${candidateFirst}" in conversation`);
  }

  score = Math.min(Math.max(score, 0), 1);

  return {
    score,
    reason: reasons.length > 0
      ? reasons.join('. ') + '.'
      : 'Transcript content is inconclusive — insufficient patterns detected',
  };
}
