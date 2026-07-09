'use client';

import { ParticipantScore } from '@/lib/confidence';
import { LLMResult } from '@/hooks/useLLMReasoning';
import BorderGlow from './BorderGlow';
import { motion } from 'framer-motion';
import './ReportCard.css';

interface ReportCardProps {
  scores: ParticipantScore[];
  llmResult?: LLMResult | null;
  onClose: () => void;
}

export default function ReportCard({ scores, llmResult, onClose }: ReportCardProps) {
  const candidate = scores.find((s) => s.isCandidate);
  if (!candidate) return null;

  const activeSignals = candidate.signals.filter((s) => s.fired);

  return (
    <div className="report-overlay">
      <motion.div
        className="report-modal"
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      >
        <BorderGlow
          edgeSensitivity={30}
          glowColor="0 80 0"
          backgroundColor="#0a0a0a"
          borderRadius={20}
          glowRadius={30}
          glowIntensity={0.8}
          coneSpread={25}
          colors={['#4ade80', '#22c55e', '#16a34a']}
          className="report-glow"
        >
          <div className="card-content report-card">
            <div className="report-header">
              <h2 className="report-title">
                <span className="card-icon">📋</span>
                Final Analysis Report
              </h2>
              <button className="report-close" onClick={onClose}>×</button>
            </div>

            <div className="report-summary">
              <div className="report-verdict">
                <span className="report-label">Candidate Identified:</span>
                <span className="report-name">{candidate.displayName}</span>
              </div>
              <div className="report-score-box">
                <span className="report-score-label">Final Confidence</span>
                <span className="report-score-val">{candidate.confidence}%</span>
                <span className="report-score-label">
                  {candidate.decisionStatus === 'identified'
                    ? `Identified with +${candidate.margin}% lead`
                    : candidate.decisionStatus === 'tentative'
                      ? `Tentative with +${candidate.margin}% lead`
                      : 'Insufficient evidence for final identification'}
                </span>
              </div>
            </div>

            <div className="report-section">
              <h3 className="report-section-title">✅ Multiple Weak Signals Combined</h3>
              <p className="report-desc">
                Sherlock relies on aggregating multiple behavioral and contextual signals rather than a single rule.
              </p>
              <div className="report-signals-list">
                {activeSignals.map((sig, i) => (
                  <div key={i} className="report-signal-item">
                    <span className="report-signal-name">{sig.name}</span>
                    <span className="report-signal-weight">{(sig.score * 100).toFixed(0)}% match</span>
                  </div>
                ))}
              </div>
            </div>

            {llmResult && (
              <div className="report-section">
                <h3 className="report-section-title">✅ AI Reasoning (Explainability)</h3>
                <p className="report-desc">Why this participant was selected:</p>
                <div className="report-llm-reasons">
                  {llmResult.signals.map((reason, i) => (
                    <div key={i} className="report-llm-reason">
                      <span className="llm-dot">›</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="report-footer">
              Sherlock AI Fraud Detection Engine
            </div>
          </div>
        </BorderGlow>
      </motion.div>
    </div>
  );
}
