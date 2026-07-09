'use client';

import { useState, useEffect, useRef } from 'react';
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

  // Speak new transcript events as they arrive
  useEffect(() => {
    if (!audioEnabled) return;
    const newEvents = events.slice(lastAudioIdx.current);
    for (const ev of newEvents) {
      if (ev.type === 'transcript' && ev.data.text) {
        speak(ev.data.text, ev.participantId);
      }
    }
    lastAudioIdx.current = events.length;
  }, [events, audioEnabled, speak]);

  // Stop audio when scenario changes
  useEffect(() => {
    stop();
    lastAudioIdx.current = 0;
  }, [scenarioId, customScenario, stop]);

  const handleGenerate = (data: GeneratedScenario) => {
    setCustomScenario(data);
    setScenarioId('custom');
  };

  const scenarioRunKey = customScenario
    ? `custom:${customScenario.meeting.meetingId}:${customScenario.meeting.events.length}:${customScenario.transcript.length}`
    : scenarioId;
  const simulationComplete = Boolean(
    state && state.totalDuration > 0 && state.currentTime >= state.totalDuration + 1 && !isSpeaking,
  );
  const showReport = simulationComplete && dismissedReportKey !== scenarioRunKey;

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
          onStart={start}
          onPause={() => { pause(); stop(); }}
          onSpeedChange={setSpeed}
          onScenarioChange={(id) => { stop(); setScenarioId(id); }}
          onAudioToggle={toggleAudio}
          onSeek={(time) => { stop(); seekTo(time); }}
        />
      </div>

      <div className={`dashboard-participants dashboard-card-wrapper ${expandedCard === 'participants' ? 'expanded' : ''}`} onClick={(e) => handleCardClick(e, 'participants')}>
        <ParticipantsCard
          scores={scores}
          participants={state?.participants ?? {}}
          onUpdateParticipant={scenarioId === 'custom' ? updateParticipant : undefined}
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
          onClose={() => setDismissedReportKey(scenarioRunKey)}
        />
      )}
    </div>
  );
}
