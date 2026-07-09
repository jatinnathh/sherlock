'use client';

import { useState } from 'react';
import type { CalendarData, MeetingData, Participant, TranscriptLine } from '@/lib/simulation';
import BorderGlow from './BorderGlow';
import './ScenarioBuilder.css';

interface ScenarioBuilderProps {
  onGenerate: (data: GeneratedScenario) => void;
}

export interface GeneratedScenario {
  calendar: CalendarData;
  participants: Participant[];
  meeting: MeetingData;
  transcript: TranscriptLine[];
}

const DISPLAY_STYLES = [
  'Full Name (John Smith)',
  'First Name Only (John)',
  'Device Name (MacBook Pro)',
  'Nickname (JSmith_99)',
  'Random ID (Participant_47291)',
  'Company Name (John - Acme Inc)',
];

const JOIN_BEHAVIORS = ['On time (2s)', 'Slightly late (15s)', 'Late (30s)', 'Very late (60s)'];
const WEBCAM_OPTIONS = ['On from start', 'Off entire meeting', 'Turns on midway', 'Turns on then off'];
const OBSERVER_OPTIONS = ['Silent', 'Occasional comments', 'Talks a lot', 'Asks technical questions'];
const SPECIAL_CONDITIONS = [
  'None',
  'Candidate renames midway',
  'Two participants with similar names',
  'Candidate drops and reconnects',
  'Candidate shares screen',
  'Interview is very technical',
  'Interview is behavioral',
  'Candidate gives short answers',
];

export default function ScenarioBuilder({ onGenerate }: ScenarioBuilderProps) {
  const [candidateName, setCandidateName] = useState('John Smith');
  const [candidateEmail, setCandidateEmail] = useState('john.smith@gmail.com');
  const [interviewerName, setInterviewerName] = useState('Rahul');
  const [displayStyle, setDisplayStyle] = useState(DISPLAY_STYLES[0]);
  const [joinBehavior, setJoinBehavior] = useState(JOIN_BEHAVIORS[0]);
  const [webcam, setWebcam] = useState(WEBCAM_OPTIONS[0]);
  const [observer, setObserver] = useState(OBSERVER_OPTIONS[0]);
  const [special, setSpecial] = useState(SPECIAL_CONDITIONS[0]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateName,
          candidateEmail,
          interviewerName,
          displayStyle,
          joinBehavior,
          webcam,
          observerBehavior: observer,
          specialCondition: special,
          customPrompt,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error('Generate failed:', err);
        return;
      }

      const data: GeneratedScenario = await res.json();
      onGenerate(data);
    } catch (err) {
      console.error('Generate error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <BorderGlow
    
      edgeSensitivity={30}
      glowColor="0 0 80"
      backgroundColor="#0a0a0a"
      borderRadius={20}
      glowRadius={30}
      glowIntensity={0.6}
      coneSpread={25}
      colors={['#ffffff', '#cccccc', '#999999']}
    >
      <div className="card-content builder-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">⚡</span>
            Custom Scenario
          </h2>
          <span className="builder-badge">AI Generated</span>
        </div>

        <div className="builder-grid">
          <div className="builder-section">
            <label className="builder-label">Candidate Name</label>
            <input
              className="builder-input"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              placeholder="John Smith"
            />
          </div>

          <div className="builder-section">
            <label className="builder-label">Candidate Email</label>
            <input
              className="builder-input"
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              placeholder="john@example.com"
            />
          </div>

          <div className="builder-section">
            <label className="builder-label">Interviewer</label>
            <input
              className="builder-input"
              value={interviewerName}
              onChange={(e) => setInterviewerName(e.target.value)}
              placeholder="Rahul"
            />
          </div>

          <div className="builder-section">
            <label className="builder-label">Display Name Style</label>
            <select className="builder-select" value={displayStyle} onChange={(e) => setDisplayStyle(e.target.value)}>
              {DISPLAY_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="builder-section">
            <label className="builder-label">Join Behavior</label>
            <select className="builder-select" value={joinBehavior} onChange={(e) => setJoinBehavior(e.target.value)}>
              {JOIN_BEHAVIORS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="builder-section">
            <label className="builder-label">Webcam</label>
            <select className="builder-select" value={webcam} onChange={(e) => setWebcam(e.target.value)}>
              {WEBCAM_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="builder-section">
            <label className="builder-label">Observer</label>
            <select className="builder-select" value={observer} onChange={(e) => setObserver(e.target.value)}>
              {OBSERVER_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="builder-section">
            <label className="builder-label">Special Condition</label>
            <select className="builder-select" value={special} onChange={(e) => setSpecial(e.target.value)}>
              {SPECIAL_CONDITIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="builder-section full-width">
          <label className="builder-label">Custom Conditions (optional)</label>
          <textarea
            className="builder-textarea"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="E.g., Candidate has a thick accent, interviewer asks about distributed systems, candidate seems nervous..."
            rows={2}
          />
        </div>

        <button
          className={`builder-generate-btn ${isGenerating ? 'loading' : ''}`}
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="spinner" />
              Generating scenario...
            </>
          ) : (
            <>
              <span>🎬</span>
              Generate & Play
            </>
          )}
        </button>
      </div>
    </BorderGlow>
  );
}
