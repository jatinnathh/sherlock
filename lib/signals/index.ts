/**
 * Signal Extractors — barrel export.
 *
 * Each signal is one file, one function, one concern.
 * Import them individually or use this barrel to get everything.
 */

export { scoreName } from './name';
export { scoreEmail } from './email';
export { scoreTranscript } from './transcript';
export { scoreSpeaker } from './speaker';
export { scoreJoin } from './join';
export { scoreCamera } from './camera';
export { scoreAudio } from './audio';

export type { SignalResult } from './name';
