import { normalizeText } from '../../../data/catalog';
import type { TrainingFocus } from '../../utils/programGenerator';

export type CoachIntent = 'routine' | 'exercises' | 'technique' | 'nutrition' | 'body' | 'progress' | 'general';

export interface ParsedQuery {
  intent: CoachIntent;
  focus?: TrainingFocus;
  location?: 'home' | 'gym';
  minutes?: number;
  /** Catalog id of an exercise explicitly mentioned (e.g. "press de banca"). */
  exerciseId?: string;
}

const FOCUS_PATTERNS: [RegExp, TrainingFocus][] = [
  [/full ?body|cuerpo completo|todo el cuerpo/, 'full_body'],
  [/torso|tren superior|parte de arriba/, 'upper'],
  [/tren inferior|parte de abajo/, 'lower'],
  [/\bpush\b|empuje/, 'push'],
  [/\bpull\b|tiron|traccion/, 'pull'],
  [/pecho|pectoral/, 'chest'],
  [/espalda|dorsal/, 'back'],
  [/hombro|deltoid/, 'shoulders'],
  [/brazo|bicep|tricep/, 'arms'],
  [/abdom|abs\b|core|six ?pack|oblicu/, 'core'],
  [/glute|cola\b|trasero/, 'glutes'],
  [/pierna|cuadricep|femoral|isquio|gemel|pantorrilla/, 'legs'],
  [/cardio|hiit|quemar grasa|resistencia|aerobic/, 'cardio'],
];

/** Spanish gym vocabulary -> canonical catalog exercise. */
const EXERCISE_ALIASES: [RegExp, string][] = [
  [/press (de )?banca|bench press/, '0025'],
  [/press inclinado/, '0047'],
  [/sentadilla goblet|goblet/, '1760'],
  [/sentadilla|squat/, '0043'],
  [/peso muerto rumano|rumano/, '0085'],
  [/peso muerto|deadlift/, '0032'],
  [/dominada|pull ?up/, '0652'],
  [/chin ?up/, '1326'],
  [/jalon|pulldown/, '2330'],
  [/remo con barra/, '0027'],
  [/remo con mancuerna/, '0292'],
  [/remo/, '0861'],
  [/press militar|press de hombro|overhead/, '0091'],
  [/elevaciones? laterales?/, '0334'],
  [/curl martillo|hammer/, '0313'],
  [/curl/, '0294'],
  [/fondos|dips?/, '0251'],
  [/flexiones|lagartijas|push ?up/, '0662'],
  [/zancada|estocada|lunge/, '0336'],
  [/hip thrust|puente de gluteo/, '1409'],
  [/plancha|plank/, '0464'],
  [/prensa/, '0739'],
  [/extension de cuadricep|extension de pierna/, '0585'],
  [/curl femoral/, '0586'],
  [/gemelo|pantorrilla|calf/, '0417'],
];

export function parseQuery(raw: string): ParsedQuery {
  const text = normalizeText(raw);

  const focus = FOCUS_PATTERNS.find(([pattern]) => pattern.test(text))?.[1];
  const exerciseId = EXERCISE_ALIASES.find(([pattern]) => pattern.test(text))?.[1];
  const location = /en casa|sin gimnasio|sin gym|home/.test(text) ? 'home' : /gimnasio|\bgym\b/.test(text) ? 'gym' : undefined;
  const minutesMatch = text.match(/(\d{2,3})\s*(min|minutos)/);
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : undefined;

  let intent: CoachIntent = 'general';
  if (/rutina|programa|plan de entren|entrenamiento de|sesion|workout|split|arma(me)?\b|genera|dise[nñ]a/.test(text) && !/comida|dieta|menu/.test(text)) {
    intent = 'routine';
  } else if (
    // "como" alone also means "how", so only match it in eating phrases.
    /comer|comida|dieta|menu|caloria|macro|proteina|carbohidrato|desayun|almuerz|cena|merienda|suplement|creatina|batido|que como|pre.?entreno|post.?entreno|(antes|despues) de entrenar/.test(text)
  ) {
    intent = 'nutrition';
  } else if (/grasa corporal|composicion|ffmi|masa magra|imc|peso ideal|cuanto deberia pesar|mi peso/.test(text)) {
    intent = 'body';
  } else if (/progres|estanc|record|1rm|subir (de )?peso|sobrecarga|mejorar mi|mas fuerte|fuerza en/.test(text)) {
    intent = exerciseId ? 'technique' : 'progress';
  } else if (exerciseId && /tecnica|como (se )?hac|forma|postura|consejo|error/.test(text)) {
    intent = 'technique';
  } else if (/ejercicio|alternativ|reemplaz|sustitu|movimiento|que hago para/.test(text) || (focus && !exerciseId)) {
    intent = 'exercises';
  } else if (exerciseId) {
    intent = 'technique';
  }

  return { intent, focus, location, minutes, exerciseId };
}
