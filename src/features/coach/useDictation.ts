import { useCallback, useEffect, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { CoachVoice } from '../../core/services/voice/coachVoice';
import { MicOwner } from '../../core/services/voice/micOwner';

/**
 * Speech-to-text for the chat box: words appear live while speaking and the
 * text stays in the input to review before sending. Stops on a pause.
 */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const baseRef = useRef('');
  const onTextRef = useRef(onText);
  // Ignore the 'end' of a session we interrupted (e.g. workout commands).
  const startedRef = useRef(false);

  useEffect(() => {
    onTextRef.current = onText;
  }, [onText]);

  const owns = () => MicOwner.get() === 'dictation';

  const start = useCallback(async (currentText: string) => {
    setError(null);
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError('Este teléfono no tiene reconocimiento de voz.');
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Activa el permiso de micrófono para dictar.');
      return;
    }
    const borrowed = MicOwner.get() === 'commands';
    MicOwner.claim('dictation');
    startedRef.current = false;
    baseRef.current = currentText.trim() ? `${currentText.trim()} ` : '';
    setListening(true);
    CoachVoice.stop();
    if (borrowed) {
      ExpoSpeechRecognitionModule.abort();
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    ExpoSpeechRecognitionModule.start({
      lang: CoachVoice.language,
      interimResults: true,
      continuous: false,
      androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000 },
    });
  }, []);

  const stop = useCallback(() => {
    if (owns()) ExpoSpeechRecognitionModule.stop();
  }, []);

  useSpeechRecognitionEvent('start', () => {
    if (owns()) startedRef.current = true;
  });

  useSpeechRecognitionEvent('result', (event) => {
    if (!owns()) return;
    const transcript = event.results[0]?.transcript ?? '';
    onTextRef.current(`${baseRef.current}${transcript}`);
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (!owns() || !startedRef.current) return;
    if (event.error === 'no-speech' || event.error === 'speech-timeout') setError('No te escuché. Toca el micrófono y habla.');
    else if (event.error === 'not-allowed') setError('Activa el permiso de micrófono para dictar.');
  });

  useSpeechRecognitionEvent('end', () => {
    if (!owns() || !startedRef.current) return;
    startedRef.current = false;
    setListening(false);
    MicOwner.release('dictation');
  });

  useEffect(
    () => () => {
      if (MicOwner.get() === 'dictation') {
        ExpoSpeechRecognitionModule.abort();
        MicOwner.release('dictation');
      }
    },
    []
  );

  return { listening, error, start, stop };
}
