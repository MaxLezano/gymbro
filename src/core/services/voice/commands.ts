/**
 * Turns a spoken phrase into a workout command. Pure and offline: recognizers
 * already return digits for most numbers ("hice 8 con 22,5"); number words are
 * a fallback. The "GymBro" prefix is optional.
 */
export type VoiceCommand =
  | { type: 'done'; reps?: number; weightKg?: number }
  | { type: 'start' }
  | { type: 'skip' }
  | { type: 'moreRest'; seconds: number }
  | { type: 'repeat' };

const WORD_NUMBERS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10,
  once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90, cien: 100,
};

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // "gym bro", "yimbro", "gimbro"... are all the wake word.
    .replace(/\b(gym ?bro|yim ?bro|gim ?bro|jim ?bro)\b/g, ' ')
    // "22 y medio" -> 22.5, "22,5" -> 22.5
    .replace(/(\d+) y medio/g, (_, n) => `${n}.5`)
    .replace(/(\d+),(\d+)/g, '$1.$2')
    .replace(/\b([a-z]+)\b/g, (word) => (word in WORD_NUMBERS ? String(WORD_NUMBERS[word]) : word))
    .replace(/\s+/g, ' ')
    .trim();

const NUM = '(\\d+(?:\\.\\d+)?)';
const firstNumber = (text: string, pattern: RegExp) => {
  const match = text.match(pattern);
  return match ? Number(match[1]) : undefined;
};

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const text = normalize(transcript);
  if (!text) return null;

  if (/\b(mas tiempo|mas descanso|espera|un momento)\b/.test(text) || /\d+ (segundos|minutos?) mas/.test(text)) {
    const minutes = firstNumber(text, /(\d+) minutos?/);
    const seconds = minutes !== undefined ? minutes * 60 : (firstNumber(text, /(\d+) segundos/) ?? 15);
    return { type: 'moreRest', seconds };
  }
  if (/\b(repeti(r|lo)|de nuevo|otra vez que)\b/.test(text) || /\bque (dijiste|toca)\b/.test(text)) {
    return { type: 'repeat' };
  }
  // "hice 8", "8 repeticiones", "8 con 22.5", "22.5 kilos".
  const repsBeforeCon = text.match(new RegExp(`${NUM} con ${NUM}`));
  const reps =
    firstNumber(text, new RegExp(`${NUM} (?:repeticiones|repeticion|reps|veces)`)) ??
    firstNumber(text, new RegExp(`\\bhice ${NUM}`)) ??
    (repsBeforeCon ? Number(repsBeforeCon[1]) : undefined);
  const weightKg =
    firstNumber(text, new RegExp(`${NUM} (?:kilos|kilo|kg|kilogramos)`)) ??
    (repsBeforeCon ? Number(repsBeforeCon[2]) : firstNumber(text, new RegExp(`\\bcon ${NUM}`)));
  const saidDone = /\b(termine|terminado|termino|listo|lista|hecho|hecha|ya esta|serie hecha|fin|done)\b/.test(text);

  if (saidDone || reps !== undefined || weightKg !== undefined) {
    return {
      type: 'done',
      ...(reps !== undefined && Number.isInteger(reps) && reps > 0 && reps < 100 ? { reps } : {}),
      ...(weightKg !== undefined && weightKg >= 0 && weightKg < 500 ? { weightKg } : {}),
    };
  }
  if (/\b(saltar|salta|siguiente|seguimos|ya descanse)\b/.test(text)) return { type: 'skip' };
  if (/\b(empiezo|empezar|empezamos|arranco|arrancamos|vamos|comienzo)\b/.test(text)) return { type: 'start' };
  return null;
}

/** Words that bias the recognizer toward our vocabulary. */
export const VOICE_VOCABULARY = ['GymBro', 'terminé', 'listo', 'saltar', 'siguiente', 'más tiempo', 'repeticiones', 'kilos', 'empiezo'];
