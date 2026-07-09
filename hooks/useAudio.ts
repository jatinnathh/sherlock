'use client';

/**
 * useAudio — browser-native TTS audio playback for the simulation.
 *
 * Uses the Web Speech API (SpeechSynthesis) to speak transcript lines
 * in real time with different voices per speaker.
 * No external APIs or MP3 files needed — works everywhere.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface VoiceConfig {
  pitch: number;
  rate: number;
  voiceIndex: number;
}

const VOICE_CONFIGS: Record<string, VoiceConfig> = {
  '1': { pitch: 1.05, rate: 1.0, voiceIndex: 0 },  // Candidate — natural
  '2': { pitch: 0.85, rate: 0.92, voiceIndex: 1 },  // Interviewer — deeper, calmer
  '3': { pitch: 1.15, rate: 1.1, voiceIndex: 2 },   // Observer — if ever speaks
};

export function useAudio() {
  const [audioEnabled, setAudioEnabled] = useState(true);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const enabledRef = useRef(true);

  // Keep ref in sync with state
  useEffect(() => {
    enabledRef.current = audioEnabled;
  }, [audioEnabled]);

  // Load available voices
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function loadVoices() {
      voicesRef.current = speechSynthesis.getVoices();
    }

    loadVoices();
    speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, []);

  const [isSpeaking, setIsSpeaking] = useState(false);

  const speak = useCallback((text: string, speakerId: string) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (!enabledRef.current) return;

    const utterance = new SpeechSynthesisUtterance(text);
    const config = VOICE_CONFIGS[speakerId] ?? VOICE_CONFIGS['1'];

    // Pick different English voices for each speaker
    const voices = voicesRef.current;
    const englishVoices = voices.filter((v) => v.lang.startsWith('en'));

    if (englishVoices.length > 0) {
      const idx = config.voiceIndex % englishVoices.length;
      utterance.voice = englishVoices[idx];
    }

    utterance.pitch = config.pitch;
    utterance.rate = config.rate;
    utterance.volume = 0.75;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => {
      if (!window.speechSynthesis.pending && !window.speechSynthesis.speaking) {
        setIsSpeaking(false);
      }
    };
    utterance.onerror = () => setIsSpeaking(false);

    speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, []);

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  const toggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      if (prev) {
        // Turning off — cancel any in-flight speech
        speechSynthesis?.cancel();
        setIsSpeaking(false);
      }
      return !prev;
    });
  }, []);

  return { speak, stop, audioEnabled, toggleAudio, isSpeaking };
}
