/**
 * LLM API Route — calls Groq for AI-powered candidate identification.
 *
 * POST /api/llm
 *
 * Returns structured output:
 * {
 *   candidate: "1",
 *   confidence: 91,
 *   signals: ["reason 1", "reason 2", ...]
 * }
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
    participants: { id: string; displayName: string; email: string | null; webcamOn: boolean }[];
    calendar: { candidateName: string; candidateEmail: string; interviewerNames: string[] };
    transcript: { speaker: string; text: string }[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── Build a clean, focused prompt ───────────────────────────
  const systemPrompt = `You are Sherlock, an AI that identifies which meeting participant is the interview candidate.

Given the meeting data below, determine which participant is the CANDIDATE (not the interviewer, not an observer).

You MUST respond with valid JSON in this exact format:
{
  "candidate": "<participant_id>",
  "confidence": <number 0-100>,
  "signals": [
    "<human-readable reason 1>",
    "<human-readable reason 2>",
    "<human-readable reason 3>"
  ]
}

Rules:
- "candidate" must be a participant ID
- "confidence" is how sure you are (0-100)
- "signals" should be 2-5 specific observations that explain your reasoning
- Focus on WHO is answering questions vs WHO is asking them
- The person introducing themselves as the expected candidate IS the candidate
- Interviewers ask questions, candidates answer them`;

  const participantList = body.participants
    .map((p) => `  ID="${p.id}" Name="${p.displayName}" Email=${p.email ?? 'N/A'} Webcam=${p.webcamOn ? 'ON' : 'OFF'}`)
    .join('\n');

  const transcriptText = body.transcript
    .map((t) => {
      const name = body.participants.find((p) => p.id === t.speaker)?.displayName ?? t.speaker;
      return `  [${name}]: ${t.text}`;
    })
    .join('\n');

  const userPrompt = `Calendar: Candidate="${body.calendar.candidateName}", Interviewers=[${body.calendar.interviewerNames.join(', ')}]

Participants:
${participantList}

Transcript:
${transcriptText || '  (no transcript yet)'}

Which participant is the candidate? Return JSON only.`;

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
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 300,
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

    return NextResponse.json({
      candidate: parsed.candidate ?? null,
      confidence: parsed.confidence ?? 0,
      signals: Array.isArray(parsed.signals) ? parsed.signals : [],
    });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to call Groq API', details: String(err) },
      { status: 500 },
    );
  }
}
