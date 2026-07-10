'use client';

/* eslint-disable react-hooks/set-state-in-effect */

import { useState, useEffect, useMemo, useRef } from 'react';
import { useSimulation } from '@/hooks/useSimulation';
import { useLLMReasoning } from '@/hooks/useLLMReasoning';
import { useAudio } from '@/hooks/useAudio';
import MeetingControls from './MeetingControls';
import ParticipantsCard from './ParticipantsCard';
import TranscriptCard from './TranscriptCard';
import SignalsCard from './SignalsCard';
import ReasoningCard from './ReasoningCard';
import ConfidenceTimeline from './ConfidenceTimeline';
import ScenarioBuilder, { type GeneratedScenario } from './ScenarioBuilder';
import ReportCard from './ReportCard';
import './Dashboard.css';

export default function Dashboard() {
  const [scenarioId, setScenarioId] = useState('macbook');
  const [customScenario, setCustomScenario] = useState<GeneratedScenario | null>(null);
  const [dismissedReportKey, setDismissedReportKey] = useState<string | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const initializationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seekSilenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSeekingRef = useRef(false);
  
  // Track notified runs so we don't spam the email API
  const notifiedRunsRef = useRef<Set<string>>(new Set());

  const handleCardClick = (e: React.MouseEvent, cardId: string) => {
    // Only expand if they didn't click an interactive element
    const target = e.target as HTMLElement;
    const interactiveTags = ['button', 'input', 'select', 'textarea', 'option', 'label'];
    const tagName = target.tagName.toLowerCase();
    
    if (interactiveTags.includes(tagName) || target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }
    setExpandedCard(prev => prev === cardId ? null : cardId);
  };

  const { state, scores, events, history, start, pause, speed, setSpeed, seekTo, updateParticipant } =
    useSimulation(1, scenarioId, customScenario);
  const { llmResult, isLLMLoading } = useLLMReasoning(state, scores, events);
  const { speak, stop, audioEnabled, toggleAudio, isSpeaking } = useAudio();

  // Track last processed event index for audio
  const lastAudioIdx = useRef(0);
  const eventCountRef = useRef(0);

  const clearInitializationTimer = () => {
    if (initializationTimerRef.current) {
      clearTimeout(initializationTimerRef.current);
      initializationTimerRef.current = null;
    }
  };

  const clearSeekSilenceTimer = () => {
    if (seekSilenceTimerRef.current) {
      clearTimeout(seekSilenceTimerRef.current);
      seekSilenceTimerRef.current = null;
    }
  };

  // Speak new transcript events as they arrive
  useEffect(() => {
    eventCountRef.current = events.length;
    const atEnd = Boolean(state && state.totalDuration > 0 && state.currentTime >= state.totalDuration);

    if (!audioEnabled || speed !== 1 || isSeekingRef.current || atEnd) {
      if (atEnd) stop();
      lastAudioIdx.current = events.length;
      return;
    }

    const newEvents = events.slice(lastAudioIdx.current);
    for (const ev of newEvents) {
      if (ev.type === 'transcript' && ev.data.text) {
        speak(ev.data.text, ev.participantId);
      }
    }
    lastAudioIdx.current = events.length;
  }, [events, audioEnabled, speed, state, speak, stop]);

  useEffect(() => {
    if (speed !== 1) {
      stop();
      lastAudioIdx.current = events.length;
    }
  }, [speed, events.length, stop]);

  // Stop audio when scenario changes
  useEffect(() => {
    stop();
    lastAudioIdx.current = 0;
    clearInitializationTimer();
    clearSeekSilenceTimer();
    isSeekingRef.current = false;
    setIsInitializing(false);
  }, [scenarioId, customScenario, stop]);

  useEffect(() => {
    return () => {
      clearInitializationTimer();
      clearSeekSilenceTimer();
    };
  }, []);

  const handleGenerate = (data: GeneratedScenario) => {
    setCustomScenario(data);
    setScenarioId('custom');
  };

  const scenarioRunKey = customScenario
    ? `custom:${customScenario.meeting.meetingId}:${customScenario.meeting.events.length}:${customScenario.transcript.length}`
    : scenarioId;
  const simulationComplete = Boolean(
    state &&
      state.totalDuration > 0 &&
      state.currentTime >= state.totalDuration &&
      (!state.isRunning || !isSpeaking),
  );
  const showReport = simulationComplete && dismissedReportKey !== scenarioRunKey;

  const activeSpeakerId = useMemo(() => {
    if (!state) return null;
    const now = state.currentTime;
    const activeSpeakingEvent = [...events]
      .reverse()
      .find((event) => {
        if (event.type !== 'speaking') return false;
        const durationSeconds = (event.data.durationMs ?? 2500) / 1000;
        return now >= event.time && now <= event.time + Math.max(durationSeconds, 1.5);
      });

    if (activeSpeakingEvent) return activeSpeakingEvent.participantId;

    const recentTranscriptEvent = [...events]
      .reverse()
      .find((event) => event.type === 'transcript' && now >= event.time && now <= event.time + 3.5);

    return recentTranscriptEvent?.participantId ?? null;
  }, [events, state]);

  const handleStart = () => {
    if (isInitializing || state?.isRunning) return;
    setIsInitializing(true);
    clearInitializationTimer();
    initializationTimerRef.current = setTimeout(() => {
      setIsInitializing(false);
      start();
      initializationTimerRef.current = null;
    }, 1600);
  };

  const handlePause = () => {
    clearInitializationTimer();
    clearSeekSilenceTimer();
    isSeekingRef.current = false;
    setIsInitializing(false);
    pause();
    stop();
  };

  const handleSeek = (time: number) => {
    stop();
    clearSeekSilenceTimer();
    isSeekingRef.current = true;
    seekTo(time);
    seekSilenceTimerRef.current = setTimeout(() => {
      lastAudioIdx.current = eventCountRef.current;
      isSeekingRef.current = false;
      seekSilenceTimerRef.current = null;
    }, 250);
  };

  // Send email notification when simulation completes
  useEffect(() => {
    if (simulationComplete && scenarioRunKey && !notifiedRunsRef.current.has(scenarioRunKey)) {
      notifiedRunsRef.current.add(scenarioRunKey);
      
      const topScore = scores.find(s => s.isCandidate);
      const confidence = topScore ? `${topScore.confidence}%` : 'Unknown';
      
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'Simulation Completed',
          scenario: scenarioId,
          result: confidence,
          details: `Candidate Name: ${state?.calendar.candidateName}\nTotal Events: ${events.length}`
        })
      }).catch(console.error);
    }
  }, [simulationComplete, scenarioRunKey, scores, scenarioId, state, events.length]);

  // Send email notification on page visit
  useEffect(() => {
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'Page Visit',
        scenario: 'N/A',
        result: 'N/A',
        details: 'A user has loaded the Sherlock Dashboard.'
      })
    }).catch(console.error);
  }, []);

  return (
    <div className="dashboard">
      {expandedCard && (
        <div className="dashboard-expand-overlay" onClick={() => setExpandedCard(null)} />
      )}

      <div className="dashboard-controls">
        <MeetingControls
          state={state}
          speed={speed}
          scenario={scenarioId}
          audioEnabled={audioEnabled}
          isInitializing={isInitializing}
          onStart={handleStart}
          onPause={handlePause}
          onSpeedChange={setSpeed}
          onScenarioChange={(id) => {
            clearInitializationTimer();
            clearSeekSilenceTimer();
            isSeekingRef.current = false;
            setIsInitializing(false);
            stop();
            setScenarioId(id);
          }}
          onAudioToggle={toggleAudio}
          onSeek={handleSeek}
        />
      </div>

      <div className={`dashboard-participants dashboard-card-wrapper ${expandedCard === 'participants' ? 'expanded' : ''}`} onClick={(e) => handleCardClick(e, 'participants')}>
        <ParticipantsCard
          scores={scores}
          participants={state?.participants ?? {}}
          activeSpeakerId={activeSpeakerId}
          onUpdateParticipant={updateParticipant}
        />
      </div>

      <div className={`dashboard-transcript dashboard-card-wrapper ${expandedCard === 'transcript' ? 'expanded' : ''}`} onClick={(e) => handleCardClick(e, 'transcript')}>
        <TranscriptCard
          events={events}
          participants={state?.participants ?? {}}
        />
      </div>

      <div className={`dashboard-signals dashboard-card-wrapper ${expandedCard === 'signals' ? 'expanded' : ''}`} onClick={(e) => handleCardClick(e, 'signals')}>
        <SignalsCard scores={scores} />
      </div>

      <div className={`dashboard-reasoning dashboard-card-wrapper ${expandedCard === 'reasoning' ? 'expanded' : ''}`} onClick={(e) => handleCardClick(e, 'reasoning')}>
        <ReasoningCard
          scores={scores}
          llmResult={llmResult}
          isLLMLoading={isLLMLoading}
        />
      </div>

      <div className={`dashboard-timeline dashboard-card-wrapper ${expandedCard === 'timeline' ? 'expanded' : ''}`} onClick={(e) => handleCardClick(e, 'timeline')}>
        <ConfidenceTimeline history={history} />
      </div>

      {scenarioId === 'custom' && (
        <div className={`dashboard-builder dashboard-card-wrapper ${expandedCard === 'builder' ? 'expanded' : ''}`} onClick={(e) => handleCardClick(e, 'builder')}>
          <ScenarioBuilder
            onGenerate={handleGenerate}
          />
        </div>
      )}

      {showReport && (
        <ReportCard
          scores={scores}
          llmResult={llmResult}
          events={events}
          participants={state?.participants ?? {}}
          calendar={state?.calendar ?? null}
          onClose={() => setDismissedReportKey(scenarioRunKey)}
        />
      )}

      {isInitializing && (
        <div className="data-sync-overlay" aria-live="polite">
          <div className="data-sync-panel">
            <div className="sync-orbit">
              <span />
              <span />
              <span />
            </div>
            <div className="sync-copy">
              <span>Connecting to WebRTC streams...</span>
              <span>Initializing AI fraud models...</span>
              <span>Calibrating participant identity signals...</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
