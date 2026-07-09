'use client';

import { useRef, useCallback } from 'react';
import { SimulationState } from '@/lib/simulation';
import { SCENARIOS } from '@/lib/scenarios';
import BorderGlow from './BorderGlow';
import './MeetingControls.css';

interface MeetingControlsProps {
  state: SimulationState | null;
  speed: number;
  scenario: string;
  audioEnabled: boolean;
  onStart: () => void;
  onPause: () => void;
  onSpeedChange: (speed: number) => void;
  onScenarioChange: (id: string) => void;
  onAudioToggle: () => void;
  onSeek: (time: number) => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function MeetingControls({
  state,
  speed,
  scenario,
  audioEnabled,
  onStart,
  onPause,
  onSpeedChange,
  onScenarioChange,
  onAudioToggle,
  onSeek,
}: MeetingControlsProps) {
  const progressRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const totalDuration = state?.totalDuration ?? 0;
  const progress = state
    ? Math.min((state.currentTime / Math.max(totalDuration, 1)) * 100, 100)
    : 0;

  // Calculate seek time from mouse position on the progress bar
  const getTimeFromEvent = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      if (!progressRef.current || totalDuration <= 0) return 0;
      const rect = progressRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
      return (x / rect.width) * totalDuration;
    },
    [totalDuration],
  );

  const handleProgressClick = useCallback(
    (e: React.MouseEvent) => {
      const time = getTimeFromEvent(e);
      onSeek(time);
    },
    [getTimeFromEvent, onSeek],
  );

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true;
      const time = getTimeFromEvent(e);
      onSeek(time);

      const handleMove = (ev: MouseEvent) => {
        if (!isDragging.current) return;
        const t = getTimeFromEvent(ev);
        onSeek(t);
      };

      const handleUp = () => {
        isDragging.current = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleUp);
      };

      window.addEventListener('mousemove', handleMove);
      window.addEventListener('mouseup', handleUp);
    },
    [getTimeFromEvent, onSeek],
  );

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
      <div className="controls-card">
        <div className="controls-left">
          <div className="sherlock-badge">
            
            <span className="sherlock-text">SHERLOCK</span>
          </div>
          <span className="meeting-platform">
            {state?.calendar?.candidateName
              ? `Interview — ${state.calendar.candidateName}`
              : 'Interview Session'}
          </span>
        </div>

        <div className="controls-center">
          <button
            className={`control-btn ${totalDuration === 0 ? 'disabled' : ''}`}
            onClick={state?.isRunning ? onPause : onStart}
            disabled={totalDuration === 0}
            title={totalDuration === 0 ? "Generate a custom scenario first" : ""}
          >
            {state?.isRunning ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="4" height="12" rx="1" />
                <rect x="9" y="2" width="4" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 2.5v11l9-5.5L4 2.5z" />
              </svg>
            )}
            <span>{state?.isRunning ? 'Pause' : 'Play'}</span>
          </button>

          <div className="speed-selector">
            {[1, 2, 5, 10].map((s) => (
              <button
                key={s}
                className={`speed-btn ${speed === s ? 'active' : ''}`}
                onClick={() => onSpeedChange(s)}
              >
                {s}×
              </button>
            ))}
          </div>

          <button
            className={`audio-toggle ${audioEnabled ? 'on' : 'off'}`}
            onClick={onAudioToggle}
            title={audioEnabled ? 'Mute audio' : 'Unmute audio'}
          >
            {audioEnabled ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <line x1="23" y1="9" x2="17" y2="15" />
                <line x1="17" y1="9" x2="23" y2="15" />
              </svg>
            )}
          </button>
        </div>

        <div className="controls-right">
          <span className="time-display">
            {formatTime(state?.currentTime ?? 0)}
          </span>
          <span className="time-separator">/</span>
          <span className="time-total">
            {formatTime(state?.totalDuration ?? 0)}
          </span>
        </div>

        <div className="scenario-row">
          <span className="scenario-label">Scenario:</span>
          <div className="scenario-pills">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                className={`scenario-pill ${scenario === s.id ? 'active' : ''}`}
                onClick={() => onScenarioChange(s.id)}
                title={s.description}
              >
                {s.label}
              </button>
            ))}
            <button
              className={`scenario-pill custom-pill ${scenario === 'custom' ? 'active' : ''}`}
              onClick={() => onScenarioChange('custom')}
              title="Build your own custom meeting scenario with AI"
            >
              ✨ Custom AI
            </button>
          </div>
        </div>

        {/* ── Draggable Progress Bar ─────────────────────────── */}
        <div
          ref={progressRef}
          className="progress-bar-container"
          onClick={handleProgressClick}
          onMouseDown={handleDragStart}
        >
          <div className="progress-bar" style={{ width: `${progress}%` }} />
          <div
            className="progress-handle"
            style={{ left: `${progress}%` }}
          />
          <div className="progress-glow" style={{ left: `${progress}%` }} />
        </div>
      </div>
    </BorderGlow>
  );
}
