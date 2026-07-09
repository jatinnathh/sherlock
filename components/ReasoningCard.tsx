'use client';

import { ParticipantScore } from '@/lib/confidence';
import { LLMResult } from '@/hooks/useLLMReasoning';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import BorderGlow from './BorderGlow';
import './ReasoningCard.css';

interface ReasoningCardProps {
  scores: ParticipantScore[];
  llmResult?: LLMResult | null;
  isLLMLoading?: boolean;
}

const signalVariants: Variants = {
  hidden: { opacity: 0, x: -16, filter: 'blur(4px)' },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    filter: 'blur(0px)',
    transition: { delay: i * 0.12, duration: 0.35, ease: [0, 0, 0.2, 1] },
  }),
};

export default function ReasoningCard({ scores, llmResult, isLLMLoading }: ReasoningCardProps) {
  const candidate = scores.find((s) => s.isCandidate);
  const reasonLines = candidate?.reasoning.split('\n').filter(Boolean) ?? [];

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
      className="reasoning-glow"
    >
      <div className="card-content reasoning-card">
        <div className="card-header">
          <h2 className="card-title">
            <span className="card-icon">🧠</span>
            Reasoning
          </h2>
        </div>

        {!candidate ? (
          <div className="reasoning-empty">
            <span className="empty-icon">🧠</span>
            <span>Analysis will begin when the meeting starts</span>
          </div>
        ) : (
          <div className="reasoning-content">
            {/* ── Rule-based verdict ──────────────────────────── */}
            <motion.div
              className="reasoning-verdict"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="verdict-label">Rule-based:</span>
              <span className="verdict-name">{candidate.displayName}</span>
              <motion.span
                key={candidate.confidence}
                className={`verdict-confidence ${getConfidenceClass(candidate.confidence)}`}
                initial={{ scale: 1.3, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 400 }}
              >
                {candidate.confidence}%
              </motion.span>
              <span className="verdict-label">
                {getDecisionCopy(candidate)}
              </span>
            </motion.div>

            {/* ── LLM AI Reasoning ───────────────────────────── */}
            <AnimatePresence>
              {(llmResult || isLLMLoading) && (
                <motion.div
                  className="llm-section"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="llm-header">
                    <span className="llm-badge">AI</span>
                    <span className="llm-label">Groq Analysis</span>
                    {isLLMLoading && (
                      <motion.span
                        className="llm-loading"
                        animate={{ opacity: [0.3, 0.8, 0.3] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                      >
                        thinking…
                      </motion.span>
                    )}
                  </div>

                  {llmResult && (
                    <>
                      <div className="reasoning-verdict llm-verdict">
                        <span className="verdict-label">LLM says:</span>
                        <span className="verdict-name">
                          {scores.find((s) => s.participantId === llmResult.candidate)?.displayName ??
                            `Participant ${llmResult.candidate}`}
                        </span>
                        <motion.span
                          key={llmResult.confidence}
                          className={`verdict-confidence ${getConfidenceClass(llmResult.confidence)}`}
                          initial={{ scale: 1.3 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400 }}
                        >
                          {llmResult.confidence}%
                        </motion.span>
                      </div>

                      <div className="llm-signals">
                        {llmResult.signals.map((signal, i) => (
                          <motion.div
                            key={`${signal}-${i}`}
                            className="llm-signal-line"
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.15, duration: 0.3 }}
                          >
                            <span className="llm-signal-dot">✓</span>
                            {signal}
                          </motion.div>
                        ))}
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Rule-based breakdown (staggered) ────────────── */}
            <div className="reasoning-breakdown">
              <AnimatePresence mode="popLayout">
                {reasonLines.map((line, i) => (
                  <motion.div
                    key={`${line.slice(0, 20)}-${i}`}
                    className="reasoning-line"
                    custom={i}
                    variants={signalVariants}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    {line}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {scores.filter((s) => !s.isCandidate).length > 0 && (
              <div className="reasoning-others">
                <span className="others-label">Others ruled out:</span>
                {scores
                  .filter((s) => !s.isCandidate)
                  .map((s) => (
                    <span key={s.participantId} className="others-chip">
                      {s.displayName} ({s.confidence}%)
                    </span>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </BorderGlow>
  );
}

function getConfidenceClass(confidence: number): string {
  if (confidence >= 60) return 'high';
  if (confidence >= 30) return 'medium';
  return 'low';
}

function getDecisionCopy(score: ParticipantScore): string {
  if (score.decisionStatus === 'identified') {
    return `identified, +${score.margin}% lead`;
  }
  if (score.decisionStatus === 'tentative') {
    return `tentative, +${score.margin}% lead`;
  }
  return 'collecting evidence';
}
