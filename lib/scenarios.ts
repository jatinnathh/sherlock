/**
 * Scenario Definitions — 6 edge cases for testing candidate identification.
 *
 * Each scenario provides complete meeting/transcript/participant data
 * that is loaded into the SimulationEngine.
 */

import type { MeetingData, TranscriptLine, Participant, CalendarData } from './simulation';

export interface Scenario {
  id: string;
  label: string;
  description: string;
  meeting: MeetingData;
  transcript: TranscriptLine[];
  participants: Participant[];
  calendar: CalendarData;
}

// ─── Shared calendar (same candidate for all) ───────────────────────
const CALENDAR: CalendarData = {
  candidateName: 'John Smith',
  candidateEmail: 'john.smith@gmail.com',
  interviewerNames: ['Rahul'],
};

// ─── Base participants ──────────────────────────────────────────────
function makeParticipant(overrides: Partial<Participant> & { id: string; displayName: string }): Participant {
  return {
    email: null,
    role: 'participant',
    joinTime: 2,
    leaveTime: null,
    webcamOn: false,
    screenShare: false,
    nameChanges: [],
    ...overrides,
  };
}

const RAHUL: Participant = makeParticipant({
  id: '2',
  displayName: 'Rahul',
  email: 'rahul@sherlock.ai',
  role: 'interviewer',
  joinTime: 0,
  webcamOn: true,
});

const OBSERVER: Participant = makeParticipant({
  id: '3',
  displayName: 'Observer_01',
  role: 'observer',
  joinTime: 1,
  webcamOn: false,
});

// ─── Base meeting events (join, webcam, speaking) ───────────────────
function baseMeetingEvents(candidateJoinTime = 2, candidateName = 'MacBook Pro'): MeetingData {
  return {
    meetingId: 'sim-001',
    platform: 'Google Meet',
    scheduledStart: '2025-01-15T10:00:00Z',
    events: [
      { time: 0, type: 'join', participantId: '2', data: { displayName: 'Rahul' } },
      { time: 1, type: 'join', participantId: '3', data: { displayName: 'Observer_01' } },
      { time: candidateJoinTime, type: 'join', participantId: '1', data: { displayName: candidateName } },
      { time: candidateJoinTime, type: 'webcam_on', participantId: '2', data: {} },
      { time: candidateJoinTime + 1, type: 'webcam_on', participantId: '1', data: {} },
      { time: 4, type: 'speaking', participantId: '2', data: { durationMs: 4000 } },
      { time: 10, type: 'speaking', participantId: '1', data: { durationMs: 5000 } },
      { time: 28, type: 'speaking', participantId: '1', data: { durationMs: 8000 } },
      { time: 46, type: 'speaking', participantId: '1', data: { durationMs: 10000 } },
      { time: 60, type: 'screen_share', participantId: '1', data: { active: true } },
      { time: 75, type: 'screen_share', participantId: '1', data: { active: false } },
      { time: 85, type: 'speaking', participantId: '1', data: { durationMs: 8000 } },
    ],
  };
}

// ─── Standard transcript ────────────────────────────────────────────
const STANDARD_TRANSCRIPT: TranscriptLine[] = [
  { time: 5, speaker: '2', text: 'Hi everyone, thanks for joining. Let me just confirm — are we all set?' },
  { time: 10, speaker: '1', text: 'Hello, I am John. Yes, I can hear you well.' },
  { time: 20, speaker: '2', text: 'Great. So John, let\'s get started. Tell me a bit about yourself.' },
  { time: 25, speaker: '2', text: 'Specifically, what drew you to this role?' },
  { time: 30, speaker: '1', text: 'Sure. I\'ve been working as a full-stack engineer for four years, primarily with TypeScript and Python.' },
  { time: 38, speaker: '1', text: 'Most recently I built a real-time analytics platform processing two million events per day using Kafka and ClickHouse.' },
  { time: 48, speaker: '2', text: 'That\'s interesting. Can you walk me through the architecture of that system?' },
  { time: 53, speaker: '1', text: 'Absolutely. We had a microservices setup with an event ingestion layer, a stream processing pipeline, and a serving layer.' },
  { time: 70, speaker: '1', text: 'Here you can see the ingestion service on the left, then Kafka in the middle, and ClickHouse on the right for OLAP queries.' },
  { time: 78, speaker: '2', text: 'Nice. How did you handle backpressure when the event volume spiked?' },
  { time: 90, speaker: '1', text: 'We implemented adaptive batching with exponential backoff. During peak loads, we\'d buffer events in Redis and drain them asynchronously.' },
];

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 1: MacBook Pro (device name — hardest case)
// ═══════════════════════════════════════════════════════════════════
const CASE_MACBOOK: Scenario = {
  id: 'macbook',
  label: 'MacBook Pro',
  description: 'Candidate uses laptop name — no name match signal',
  meeting: baseMeetingEvents(2, 'MacBook Pro'),
  transcript: STANDARD_TRANSCRIPT,
  participants: [
    makeParticipant({ id: '1', displayName: 'MacBook Pro', joinTime: 2 }),
    RAHUL,
    OBSERVER,
  ],
  calendar: CALENDAR,
};

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 2: John (easy match)
// ═══════════════════════════════════════════════════════════════════
const CASE_JOHN: Scenario = {
  id: 'john',
  label: 'John',
  description: 'Candidate uses first name — partial name match',
  meeting: baseMeetingEvents(2, 'John'),
  transcript: STANDARD_TRANSCRIPT,
  participants: [
    makeParticipant({ id: '1', displayName: 'John', joinTime: 2 }),
    RAHUL,
    OBSERVER,
  ],
  calendar: CALENDAR,
};

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 3: Renamed Midway (name change event)
// ═══════════════════════════════════════════════════════════════════
const renamedMeeting = baseMeetingEvents(2, 'Participant_47291');
renamedMeeting.events.push({
  time: 20,
  type: 'name_change',
  participantId: '1',
  data: { oldName: 'Participant_47291', newName: 'John Smith' },
});
renamedMeeting.events.sort((a, b) => a.time - b.time);

const CASE_RENAMED: Scenario = {
  id: 'renamed',
  label: 'Renamed Midway',
  description: 'Starts as "Participant_47291", renames to "John Smith" at 20s',
  meeting: renamedMeeting,
  transcript: STANDARD_TRANSCRIPT,
  participants: [
    makeParticipant({ id: '1', displayName: 'Participant_47291', joinTime: 2, nameChanges: [{ time: 20, newName: 'John Smith' }] }),
    RAHUL,
    OBSERVER,
  ],
  calendar: CALENDAR,
};

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 4: Two Johns (disambiguation required)
// ═══════════════════════════════════════════════════════════════════
const twoJohnsMeeting = baseMeetingEvents(2, 'John');
twoJohnsMeeting.events.push(
  { time: 3, type: 'join', participantId: '4', data: { displayName: 'John S.' } },
  { time: 3, type: 'webcam_on', participantId: '4', data: {} },
  { time: 15, type: 'speaking', participantId: '4', data: { durationMs: 2000 } },
  { time: 45, type: 'speaking', participantId: '4', data: { durationMs: 1500 } },
);
twoJohnsMeeting.events.sort((a, b) => a.time - b.time);

const twoJohnsTranscript: TranscriptLine[] = [
  { time: 5, speaker: '2', text: 'Hi everyone, thanks for joining. We have a few people today.' },
  { time: 10, speaker: '1', text: 'Hello, I am John Smith. Happy to be here.' },
  { time: 15, speaker: '4', text: 'Hi, I\'m John as well — I\'m just sitting in to observe.' },
  { time: 20, speaker: '2', text: 'Great. So John Smith, let\'s get started. Tell me about yourself.' },
  { time: 30, speaker: '1', text: 'Sure. I\'ve been working as a full-stack engineer for four years with TypeScript and Python.' },
  { time: 38, speaker: '1', text: 'Most recently I built a real-time analytics platform processing two million events per day.' },
  { time: 48, speaker: '2', text: 'That\'s interesting. Can you walk me through the architecture?' },
  { time: 53, speaker: '1', text: 'Absolutely. We had a microservices setup with event ingestion, stream processing, and a serving layer.' },
  { time: 70, speaker: '1', text: 'Here you can see the ingestion service, Kafka in the middle, and ClickHouse for OLAP queries.' },
  { time: 78, speaker: '2', text: 'How did you handle backpressure when event volume spiked?' },
  { time: 90, speaker: '1', text: 'We implemented adaptive batching with exponential backoff and a Redis buffer.' },
];

const CASE_TWO_JOHNS: Scenario = {
  id: 'two-johns',
  label: 'Two Johns',
  description: '2 participants named "John" — must disambiguate via signals',
  meeting: twoJohnsMeeting,
  transcript: twoJohnsTranscript,
  participants: [
    makeParticipant({ id: '1', displayName: 'John', joinTime: 2 }),
    RAHUL,
    OBSERVER,
    makeParticipant({ id: '4', displayName: 'John S.', joinTime: 3, webcamOn: true }),
  ],
  calendar: CALENDAR,
};

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 5: Observer Talks a Lot (confusing speaker pattern)
// ═══════════════════════════════════════════════════════════════════
const observerTalksMeeting = baseMeetingEvents(2, 'John');
observerTalksMeeting.events.push(
  { time: 12, type: 'speaking', participantId: '3', data: { durationMs: 6000 } },
  { time: 35, type: 'speaking', participantId: '3', data: { durationMs: 8000 } },
  { time: 55, type: 'speaking', participantId: '3', data: { durationMs: 7000 } },
  { time: 75, type: 'speaking', participantId: '3', data: { durationMs: 5000 } },
  { time: 12, type: 'webcam_on', participantId: '3', data: {} },
);
observerTalksMeeting.events.sort((a, b) => a.time - b.time);

const observerTalksTranscript: TranscriptLine[] = [
  { time: 5, speaker: '2', text: 'Hi everyone, thanks for joining. Let me just confirm — are we all set?' },
  { time: 10, speaker: '1', text: 'Hello, I am John. Yes, I can hear you well.' },
  { time: 12, speaker: '3', text: 'Hi, I just wanted to mention that I\'ll be taking detailed notes for the hiring committee.' },
  { time: 18, speaker: '3', text: 'Also, I have a few technical questions prepared for later if that\'s okay.' },
  { time: 20, speaker: '2', text: 'Sure. John, let\'s start. Tell me about yourself.' },
  { time: 30, speaker: '1', text: 'I\'ve been working as a full-stack engineer for four years, primarily TypeScript and Python.' },
  { time: 35, speaker: '3', text: 'Quick note — we\'re particularly interested in distributed systems experience, if you could speak to that.' },
  { time: 38, speaker: '1', text: 'Absolutely. I built a real-time analytics platform processing two million events per day using Kafka.' },
  { time: 48, speaker: '2', text: 'Can you walk through the architecture?' },
  { time: 53, speaker: '1', text: 'We had a microservices setup with event ingestion, stream processing, and a serving layer.' },
  { time: 55, speaker: '3', text: 'That sounds similar to what we use internally. How did you handle schema evolution?' },
  { time: 60, speaker: '1', text: 'We used Avro schemas with a schema registry. Backwards compatibility was enforced at the registry level.' },
  { time: 75, speaker: '3', text: 'Interesting. And what about observability? How did you monitor the pipeline health?' },
  { time: 80, speaker: '1', text: 'We had Prometheus metrics, Grafana dashboards, and PagerDuty alerts for SLA breaches.' },
  { time: 90, speaker: '2', text: 'Great. That covers the technical depth we were looking for.' },
];

const CASE_OBSERVER_TALKS: Scenario = {
  id: 'observer-talks',
  label: 'Observer Talks',
  description: 'Observer speaks frequently — confuses speaker pattern signal',
  meeting: observerTalksMeeting,
  transcript: observerTalksTranscript,
  participants: [
    makeParticipant({ id: '1', displayName: 'John', joinTime: 2 }),
    RAHUL,
    { ...OBSERVER, webcamOn: true },
  ],
  calendar: CALENDAR,
};

// ═══════════════════════════════════════════════════════════════════
// SCENARIO 6: Candidate Joins Late
// ═══════════════════════════════════════════════════════════════════
const lateJoinMeeting = baseMeetingEvents(30, 'John Smith');
// Add pre-join chatter between Rahul and Observer
lateJoinMeeting.events.push(
  { time: 5, type: 'speaking', participantId: '2', data: { durationMs: 5000 } },
  { time: 12, type: 'speaking', participantId: '3', data: { durationMs: 3000 } },
);
lateJoinMeeting.events.sort((a, b) => a.time - b.time);

const lateJoinTranscript: TranscriptLine[] = [
  { time: 5, speaker: '2', text: 'Looks like the candidate hasn\'t joined yet. Let\'s give them a minute.' },
  { time: 12, speaker: '3', text: 'Sure. I have the resume pulled up — John Smith, four years of full-stack experience.' },
  { time: 20, speaker: '2', text: 'Still waiting. I\'ll send a quick reminder.' },
  { time: 32, speaker: '1', text: 'Hi, sorry I\'m late! Had some technical difficulties. I\'m John Smith.' },
  { time: 35, speaker: '2', text: 'No worries! Glad you could make it. Let\'s jump right in.' },
  { time: 40, speaker: '2', text: 'Tell me about yourself and your background.' },
  { time: 45, speaker: '1', text: 'Sure. I\'ve been a full-stack engineer for four years, working mostly with TypeScript and Python.' },
  { time: 53, speaker: '1', text: 'My most recent project was a real-time analytics platform processing two million events daily.' },
  { time: 65, speaker: '2', text: 'Walk me through the architecture.' },
  { time: 70, speaker: '1', text: 'We had microservices with an event ingestion layer, Kafka for streaming, and ClickHouse for queries.' },
  { time: 80, speaker: '2', text: 'How did you handle backpressure?' },
  { time: 85, speaker: '1', text: 'Adaptive batching with exponential backoff. Redis queue for peak load buffering.' },
  { time: 95, speaker: '2', text: 'Great answers. Let\'s move to the next section.' },
];

const CASE_LATE_JOINER: Scenario = {
  id: 'late-joiner',
  label: 'Late Joiner',
  description: 'Candidate joins 30s late — join timing signal inverted',
  meeting: lateJoinMeeting,
  transcript: lateJoinTranscript,
  participants: [
    makeParticipant({ id: '1', displayName: 'John Smith', joinTime: 30 }),
    RAHUL,
    OBSERVER,
  ],
  calendar: CALENDAR,
};

// ═══════════════════════════════════════════════════════════════════
// Export all scenarios
// ═══════════════════════════════════════════════════════════════════
export const SCENARIOS: Scenario[] = [
  CASE_MACBOOK,
  CASE_JOHN,
  CASE_RENAMED,
  CASE_TWO_JOHNS,
  CASE_OBSERVER_TALKS,
  CASE_LATE_JOINER,
];

export function getScenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? CASE_MACBOOK;
}
