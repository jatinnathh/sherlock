/**
 * Generate API Route — uses Groq to generate a custom meeting scenario.
 *
 * POST /api/generate
 *
 * Takes user-defined conditions and returns complete scenario data
 * (calendar, participants, meeting events, transcript) that can be
 * fed directly into the SimulationEngine.
 */

import { NextRequest, NextResponse } from 'next/server';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

export async function POST(request: NextRequest) {
  const apiKey = process.env.GROQ_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GROQ_KEY not configured in .env' },
      { status: 500 },
    );
  }

  let body: {
    candidateName: string;
    candidateEmail: string;
    displayStyle: string;
    joinBehavior: string;
    webcam: string;
    observerBehavior: string;
    specialCondition: string;
    interviewerName: string;
    customPrompt: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const systemPrompt = `You are a meeting data generator for an AI interview fraud detection system called Sherlock.

Generate a REALISTIC interview meeting scenario based on the conditions below. The meeting is on Google Meet between an interviewer and a candidate.

You MUST return valid JSON in this EXACT structure:
{
  "calendar": {
    "candidateName": "<full candidate name>",
    "candidateEmail": "<candidate email>",
    "interviewerNames": ["<interviewer name>"]
  },
  "participants": [
    {
      "id": "1",
      "displayName": "<candidate display name per style>",
      "email": "<candidate email from conditions, or null if style dictates>",
      "role": "participant",
      "joinTime": <seconds>,
      "leaveTime": null,
      "webcamOn": false,
      "screenShare": false,
      "nameChanges": []
    },
    {
      "id": "2",
      "displayName": "<interviewer name>",
      "email": "<interviewer email>",
      "role": "interviewer",
      "joinTime": 0,
      "leaveTime": null,
      "webcamOn": true,
      "screenShare": false,
      "nameChanges": []
    },
    {
      "id": "3",
      "displayName": "Observer_01",
      "email": null,
      "role": "observer",
      "joinTime": 1,
      "leaveTime": null,
      "webcamOn": false,
      "screenShare": false,
      "nameChanges": []
    }
  ],
  "meeting": {
    "meetingId": "custom-001",
    "platform": "Google Meet",
    "scheduledStart": "2025-01-15T10:00:00Z",
    "events": [
      {"time": 0, "type": "join", "participantId": "2", "data": {"displayName": "<name>"}},
      {"time": 1, "type": "join", "participantId": "3", "data": {"displayName": "Observer_01"}},
      {"time": <joinTime>, "type": "join", "participantId": "1", "data": {"displayName": "<name>"}},
      {"time": <joinTime+1>, "type": "webcam_on", "participantId": "1", "data": {}},
      ...more speaking/webcam/screen_share events
    ]
  },
  "transcript": [
    {"time": 5, "speaker": "2", "text": "<interviewer greeting>"},
    {"time": 10, "speaker": "1", "text": "<candidate response>"},
    ...8-12 lines total, realistic interview conversation
  ]
}

RULES:
- Generate 8-12 transcript lines with realistic interview dialogue
- Event times must be in ascending order
- The candidate must introduce themselves naturally
- Include speaking events that match transcript timing
- The candidate should speak ~60% of the time
- Keep all times under 120 seconds
- If name_change is specified, add it as a meeting event AND update nameChanges array
- Ensure event types are ONLY: "join", "leave", "webcam_on", "webcam_off", "speaking", "name_change", "screen_share"
- speaking events need "durationMs" in data
- webcam/screen_share events need empty data {} or {"active": true/false}`;

  const conditionsPrompt = `Generate a meeting scenario with these conditions:

Candidate Name: ${body.candidateName}
Candidate Email: ${body.candidateEmail}
Display Name Style: ${body.displayStyle}
Join Behavior: ${body.joinBehavior}
Webcam: ${body.webcam}
Observer Behavior: ${body.observerBehavior}
Special Condition: ${body.specialCondition}
Interviewer Name: ${body.interviewerName}
${body.customPrompt ? `\nAdditional Requirements: ${body.customPrompt}` : ''}

Return JSON only. No markdown, no explanation.`;

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: conditionsPrompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { error: `Groq API error: ${response.status}`, details: errorText },
        { status: response.status },
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return NextResponse.json({ error: 'No content in Groq response' }, { status: 500 });
    }

    const parsed = JSON.parse(content);

    // Validate and return
    return NextResponse.json({
      calendar: parsed.calendar,
      participants: parsed.participants,
      meeting: parsed.meeting,
      transcript: parsed.transcript,
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to generate scenario', details: String(err) },
      { status: 500 },
    );
  }
}
