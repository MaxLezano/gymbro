import * as Speech from 'expo-speech';
import { getLocales } from 'expo-localization';
import { CoachSettingsStore } from './coachSettings';

const LOCALE = getLocales()[0];
/** Spanish voice matching the phone's region when it is Spanish (es-AR, es-MX...). */
const LANGUAGE = LOCALE?.languageTag?.startsWith('es') ? LOCALE.languageTag : 'es-ES';

// ---------------------------------------------------------------------------
// Connectivity (cheap, cached): picks the online or offline variant of a voice.
// ---------------------------------------------------------------------------

let online = true;
let checkedAt = 0;
const CHECK_EVERY_MS = 60_000;

function refreshConnectivity() {
  if (Date.now() - checkedAt < CHECK_EVERY_MS) return;
  checkedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);
  fetch('https://clients3.google.com/generate_204', { method: 'HEAD', signal: controller.signal })
    .then((res) => {
      online = res.ok || res.status === 204;
    })
    .catch(() => {
      online = false;
    })
    .finally(() => clearTimeout(timeout));
}

// ---------------------------------------------------------------------------
// Voices: Android ships each voice twice ("...-local" and "...-network").
// They are grouped into one option; the variant is chosen when speaking.
// ---------------------------------------------------------------------------

interface VoiceGroup {
  key: string;
  language: string;
  local?: string;
  network?: string;
}

export interface CoachVoiceOption {
  id: string;
  label: string;
  detail: string;
}

const MAX_VOICES = 5;
const REGIONS: Record<string, string> = {
  ES: 'España',
  US: 'Latinoamérica',
  MX: 'México',
  AR: 'Argentina',
  CO: 'Colombia',
  CL: 'Chile',
};
const LATAM = new Set(['US', 'MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'UY']);

let groups = new Map<string, VoiceGroup>();

const groupKeyOf = (identifier: string) => identifier.replace(/-(local|network)$/i, '');
const regionOf = (language: string) => language.split(/[-_]/)[1]?.toUpperCase() ?? '';

/** Phone region first, then Latin America, then Spain. */
function regionRank(region: string): number {
  if (region === LOCALE?.regionCode?.toUpperCase()) return 0;
  return LATAM.has(region) ? 1 : 2;
}

/** Up to five Spanish voices installed on the phone, with readable names. */
export async function spanishVoices(): Promise<CoachVoiceOption[]> {
  try {
    const voices = (await Speech.getAvailableVoicesAsync()).filter((voice) => voice.language.toLowerCase().startsWith('es'));
    const next = new Map<string, VoiceGroup>();
    for (const voice of voices) {
      const key = groupKeyOf(voice.identifier);
      const group = next.get(key) ?? { key, language: voice.language };
      if (/-network$/i.test(voice.identifier)) group.network = voice.identifier;
      else group.local = voice.identifier;
      next.set(key, group);
    }
    groups = next;

    const perRegion = new Map<string, number>();
    return [...next.values()]
      .sort((a, b) => regionRank(regionOf(a.language)) - regionRank(regionOf(b.language)) || a.key.localeCompare(b.key))
      .slice(0, MAX_VOICES)
      .map((group) => {
        const region = regionOf(group.language);
        const regionName = REGIONS[region] ?? group.language;
        const index = (perRegion.get(regionName) ?? 0) + 1;
        perRegion.set(regionName, index);
        const detail = group.local && group.network ? 'Con o sin internet' : group.local ? 'Funciona sin internet' : 'Necesita internet';
        return { id: group.key, label: `${regionName} · Voz ${index}`, detail };
      });
  } catch {
    return [];
  }
}

/** Concrete voice for a chosen option: the online variant only when connected. */
function resolveVoice(key: string | undefined): string | undefined {
  if (!key) return undefined;
  const group = groups.get(groupKeyOf(key));
  if (!group) return key;
  return (online ? group.network ?? group.local : group.local ?? group.network) ?? undefined;
}

// ---------------------------------------------------------------------------
// Speaking
// ---------------------------------------------------------------------------

let speaking = false;

function speak(text: string, voiceKey: string | undefined) {
  const { rate, deep } = CoachSettingsStore.get();
  refreshConnectivity();
  Speech.stop();
  speaking = true;
  const done = () => {
    speaking = false;
  };
  Speech.speak(text, { language: LANGUAGE, voice: resolveVoice(voiceKey), rate, pitch: deep ? 0.85 : 1, onDone: done, onStopped: done, onError: done });
}

/**
 * The coach's spoken prompts, using the voice, speed and tone chosen in the
 * coach settings. While it talks, `isSpeaking()` is true so the command
 * listener can ignore its own voice.
 */
export const CoachVoice = {
  language: LANGUAGE,
  isSpeaking: () => speaking,
  /** Loads the voice list so the chosen voice resolves on the first prompt. */
  warmUp() {
    refreshConnectivity();
    if (groups.size === 0) spanishVoices();
  },
  say(text: string) {
    const { speak: enabled, voiceId } = CoachSettingsStore.get();
    if (enabled) speak(text, voiceId);
  },
  /** Plays a sample with a given voice, even when prompts are muted. */
  preview(voiceKey: string | undefined) {
    speak('Hola, soy tu entrenador. Vamos con la primera serie.', voiceKey);
  },
  stop() {
    speaking = false;
    Speech.stop();
  },
};

/** "22.5" -> "22 y medio", "20" -> "20" (reads naturally in Spanish). */
export function spokenKg(kg: number): string {
  const whole = Math.floor(kg);
  const fraction = Math.round((kg - whole) * 10) / 10;
  if (fraction === 0) return `${whole}`;
  if (fraction === 0.5) return `${whole} y medio`;
  return `${kg}`.replace('.', ' coma ');
}

/** 120 -> "2 minutos", 90 -> "1 minuto y 30 segundos", 45 -> "45 segundos" */
export function spokenDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const minutePart = minutes === 1 ? '1 minuto' : `${minutes} minutos`;
  if (minutes === 0) return `${secs} segundos`;
  return secs === 0 ? minutePart : `${minutePart} y ${secs} segundos`;
}
