'use client';

/* eslint-disable react-hooks/set-state-in-effect */

/**
 * useSimulation - bridges SimulationEngine to React state.
 *
 * Accepts a scenario ID to load different edge cases.
 * Tracks confidence history over time for the timeline display.
 * Exposes a seek function for the draggable progress bar.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SimulationEngine,
  type CalendarData,
  type MeetingData,
  type Participant,
  type SimulationState,
  type TimelineEvent,
  type TranscriptLine,
} from '@/lib/simulation';
import { computeAllConfidences, type ParticipantScore } from '@/lib/confidence';
import { getScenarioById } from '@/lib/scenarios';
import type { GeneratedScenario } from '@/components/ScenarioBuilder';

export interface ConfidenceSnapshot {
  time: number;
  confidence: number;
  reason: string;
}

export function useSimulation(
  initialSpeed =2 ,
  scenarioId: string | null = 'macbook',
  customScenario: GeneratedScenario | null = null
) {
  const engineRef = useRef<SimulationEngine | null>(null);
  const [state, setState] = useState<SimulationState | null>(null);
  const [scores, setScores] = useState<ParticipantScore[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [speed, setSpeedState] = useState(initialSpeed);
  const speedRef = useRef(initialSpeed);
  const [history, setHistory] = useState<ConfidenceSnapshot[]>([]);
  const lastConfRef = useRef(0);

  useEffect(() => {
    const engine = new SimulationEngine({ speed: speedRef.current, tickIntervalMs: 200 });
    
    // Load data from either custom scenario or predefined scenario ID
    let meeting: MeetingData;
    let transcript: TranscriptLine[];
    let participants: Participant[];
    let calendar: CalendarData;
    
    if (scenarioId === 'custom' && customScenario) {
      meeting = customScenario.meeting;
      transcript = customScenario.transcript;
      participants = customScenario.participants;
      calendar = customScenario.calendar;
    } else if (scenarioId === 'custom') {
      // Empty scenario while building
      meeting = { meetingId: 'custom-pending', platform: 'Sherlock', scheduledStart: new Date().toISOString(), events: [] };
      transcript = [];
      participants = [];
      calendar = { candidateName: 'Pending...', candidateEmail: '', interviewerNames: [] };
    } else {
      const scenario = getScenarioById(scenarioId ?? 'macbook');
      meeting = scenario.meeting;
      transcript = scenario.transcript;
      participants = scenario.participants;
      calendar = scenario.calendar;
    }

    engine.load(meeting, transcript, participants, calendar);
    engineRef.current = engine;

    // Reset states
    setEvents([]);
    setHistory([]);
    lastConfRef.current = 0;

    // Set initial state
    const initial = engine.getState();
    setState(initial);
    const initialScores = computeAllConfidences(
      initial.participants,
      initial.calendar,
      initial.firedEvents,
    );
    setScores(initialScores);

    engine.onEvent((event, simState) => {
      setEvents((prev) => [...prev, event]);
      setState({ ...simState });

      const newScores = computeAllConfidences(
        simState.participants,
        simState.calendar,
        simState.firedEvents,
      );
      setScores(newScores);

      // Track confidence history — add snapshot when confidence changes
      const topScore = newScores.find((s) => s.isCandidate);
      if (topScore && Math.abs(topScore.confidence - lastConfRef.current) >= 3) {
        // Find the signal that most recently changed
        const activeSignals = topScore.signals
          .filter((s) => s.fired)
          .sort((a, b) => (b.score * b.weight) - (a.score * a.weight));
        const reason = activeSignals[0]?.name ?? 'Initial';

        setHistory((prev) => [
          ...prev,
          {
            time: Math.round(simState.currentTime),
            confidence: topScore.confidence,
            reason: `${reason} (${(activeSignals[0]?.score * 100).toFixed(0)}%)`,
          },
        ]);
        lastConfRef.current = topScore.confidence;
      }
    });

    engine.onTick((simState) => {
      setState({ ...simState });
    });

    return () => {
      engine.pause();
    };
  }, [scenarioId, customScenario]);

  const start = useCallback(() => {
    engineRef.current?.start();
  }, []);

  const pause = useCallback(() => {
    engineRef.current?.pause();
    const s = engineRef.current?.getState();
    if (s) setState({ ...s });
  }, []);

  const setSpeed = useCallback((newSpeed: number) => {
    speedRef.current = newSpeed;
    setSpeedState(newSpeed);
    engineRef.current?.setSpeed(newSpeed);
  }, []);

  const seekTo = useCallback((time: number) => {
    if (!engineRef.current) return;
    // Clear events so they can rebuild
    setEvents([]);
    setHistory([]);
    lastConfRef.current = 0;
    engineRef.current.seekTo(time);
  }, []);

  const updateParticipant = useCallback((id: string, updates: Partial<Participant>) => {
    if (!engineRef.current) return;
    engineRef.current.updateParticipant(id, updates);
    
    // Force immediate recalculation of scores to update the UI
    const currentState = engineRef.current.getState();
    setState(currentState);
    
    const newScores = computeAllConfidences(
      currentState.participants,
      currentState.calendar,
      currentState.firedEvents,
    );
    setScores(newScores);
  }, []);

  return {
    state,
    scores,
    events,
    history,
    start,
    pause,
    speed,
    setSpeed,
    seekTo,
    updateParticipant,
  };
}
