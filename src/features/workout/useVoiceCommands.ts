import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { parseVoiceCommand, VOICE_VOCABULARY, type VoiceCommand } from '../../core/services/voice/commands';
import { CoachVoice } from '../../core/services/voice/coachVoice';
import { MicOwner } from '../../core/services/voice/micOwner';

export type ListeningState = 'off' | 'listening' | 'denied' | 'unavailable';

/**
 * Hands-free commands while the coach screen is open. Android stops continuous
 * recognition after silence or errors, so it is restarted for as long as the
 * athlete keeps the microphone on. Chat dictation can borrow the mic; commands
 * resume when it is released.
 */
export function useVoiceCommands(onCommand: (command: VoiceCommand) => void) {
  const [state, setState] = useState<ListeningState>('off');
  const wantedRef = useRef(false);
  const onCommandRef = useRef(onCommand);
  const lastTranscriptRef = useRef('');
  const restartRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  const owns = () => MicOwner.get() === 'commands';

  const begin = useCallback(() => {
    if (!wantedRef.current || (MicOwner.get() && !owns())) return;
    MicOwner.claim('commands');
    lastTranscriptRef.current = '';
    ExpoSpeechRecognitionModule.start({
      lang: CoachVoice.language,
      interimResults: false,
      continuous: true,
      contextualStrings: VOICE_VOCABULARY,
      androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1200 },
    });
  }, []);

  const start = useCallback(async () => {
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setState('unavailable');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setState('denied');
      return;
    }
    wantedRef.current = true;
    setState('listening');
    begin();
  }, [begin]);

  const stop = useCallback(() => {
    wantedRef.current = false;
    if (restartRef.current) clearTimeout(restartRef.current);
    if (owns()) {
      ExpoSpeechRecognitionModule.abort();
      MicOwner.release('commands');
    }
    setState('off');
  }, []);

  // Resume after the chat dictation hands the mic back.
  useEffect(
    () =>
      MicOwner.subscribe((owner) => {
        if (owner === null && wantedRef.current) restartRef.current = setTimeout(begin, 350);
      }),
    [begin]
  );

  useSpeechRecognitionEvent('result', (event) => {
    if (!owns() || !event.isFinal || CoachVoice.isSpeaking()) return;
    const transcript = event.results[0]?.transcript ?? '';
    // Continuous sessions may repeat what was already said; only parse the new part.
    const fresh = transcript.startsWith(lastTranscriptRef.current) ? transcript.slice(lastTranscriptRef.current.length) : transcript;
    lastTranscriptRef.current = transcript;
    const command = parseVoiceCommand(fresh);
    if (command) onCommandRef.current(command);
  });

  useSpeechRecognitionEvent('end', () => {
    if (!owns() || !wantedRef.current) return;
    restartRef.current = setTimeout(begin, 350);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!owns()) return;
    if (event.error === 'not-allowed') {
      wantedRef.current = false;
      MicOwner.release('commands');
      setState('denied');
    }
    // Other errors (no speech, network, busy) end the session; 'end' restarts it.
  });

  // Never leave the microphone open after leaving the screen.
  useEffect(
    () => () => {
      wantedRef.current = false;
      if (restartRef.current) clearTimeout(restartRef.current);
      if (MicOwner.get() === 'commands') {
        ExpoSpeechRecognitionModule.abort();
        MicOwner.release('commands');
      }
    },
    []
  );

  return { state, start, stop };
}
