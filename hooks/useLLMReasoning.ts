'use client';

/**
 * useLLMReasoning — calls the Groq LLM API at key moments
 * during the simulation for AI-powered candidate identification.
 *
 * Triggers after 2 transcript lines, then every 3 new lines.
 * Returns structured output: { candidate, confidence, signals[] }
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { SimulationState, TimelineEvent } from '@/lib/simulation';
import type { ParticipantScore } from '@/lib/confidence';

export interface LLMResult {
  candidate: string;
  confidence: number;
  signals: string[];
}

export function useLLMReasoning(
  state: SimulationState | null,
  scores: ParticipantScore[],
  events: TimelineEvent[],
) {
  const [result, setResult] = useState<LLMResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastCallCountRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const prevEventsLenRef = useRef(0);

  // Reset when scenario changes (events drop back to 0)
  useEffect(() => {
    if (events.length === 0 && prevEventsLenRef.current > 0) {
      setResult(null);
      lastCallCountRef.current = 0;
    }
    prevEventsLenRef.current = events.length;
  }, [events.length]);

  const callLLM = useCallback(async () => {
    if (!state) return;

    const transcriptEvents = events.filter((e) => e.type === 'transcript');

    // Cancel previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);

    try {
      const body = {
        participants: Object.values(state.participants).map((p) => ({
          id: p.id,
          displayName: p.displayName,
          email: p.email,
          webcamOn: p.webcamOn,
        })),
        calendar: state.calendar,
        transcript: transcriptEvents.map((e) => ({
          speaker: e.participantId,
          text: e.data.text ?? '',
        })),
      };

      const res = await fetch('/api/llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.ok) {
        const data = await res.json();
        setResult({
          candidate: data.candidate ?? '',
          confidence: data.confidence ?? 0,
          signals: Array.isArray(data.signals) ? data.signals : [],
        });
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      console.error('LLM call failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, [state, events]);

  // Trigger LLM call after enough transcript data
  useEffect(() => {
    const transcriptCount = events.filter((e) => e.type === 'transcript').length;

    // First call after 2 transcript lines, then every 3 new lines
    if (transcriptCount >= 2 && transcriptCount - lastCallCountRef.current >= 2) {
      lastCallCountRef.current = transcriptCount;
      callLLM();
    }
  }, [events, callLLM]);

  return { llmResult: result, isLLMLoading: isLoading };
}
