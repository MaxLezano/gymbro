import { EXERCISES, normalizeText } from '../../../data/catalog';
import type { HomeEquipment } from '../../types';
import type { TrainingFocus } from '../../utils/programGenerator';

export type CoachIntent = 'routine' | 'exercises' | 'technique' | 'nutrition' | 'body' | 'progress' | 'general';

export interface ParsedQuery {
  intent: CoachIntent;
  focus?: TrainingFocus;
  /** Every focus named, in order ("espalda y bíceps" -> back, arms). focus is the first one. */
  focuses?: TrainingFocus[];
  location?: 'home' | 'gym';
  minutes?: number;
  /** Catalog id of an exercise explicitly mentioned (e.g. "press de banca"). */
  exerciseId?: string;
  /** Equipment the athlete asked to use ("con mancuernas", "sin equipo"): overrides the profile's. */
  equipment?: HomeEquipment[];
}

const EQUIPMENT_PATTERNS: [RegExp, HomeEquipment][] = [
  [/mancuerna|dumbbell/, 'dumbbells'],
  [/barras?(?! de dominad| fija)|barbell/, 'barbell_plates'],
  [/kettlebell|pesa rusa/, 'kettlebell'],
  [/bandas?|ligas?|elastic/, 'resistance_bands'],
  [/barra (de dominadas|fija)|dominadas en casa/, 'pullup_bar'],
  [/sin (equipo|material|nada|pesas)|peso corporal|calistenia/, 'body_weight'],
];

/** Equipment named in a routine request, or undefined to keep the profile's. */
function parseEquipment(text: string): HomeEquipment[] | undefined {
  const named = EQUIPMENT_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, item]) => item);
  return named.length > 0 ? [...new Set(named)] : undefined;
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

/** Anything the coach is for: training, the body, food, recovery, habits and the app. */
const DOMAIN =
  /tecnica|consejo|progresion|mejorar|aprender|ensen|explica|entren|ejercici|gym|gimnasio|muscul|fuerza|pesa|kilo|\bkg\b|serie|repeti|descans|cardio|corr(er|o)|camin|trot|bici|nad(ar|o)|estir|calent|calient|movilidad|flexib|lesion|dolor|agujeta|recuper|dorm|sueno|cansad|hidrat|agua|salud|energia|motiva|habito|constancia|disciplina|app|gymbro|perfil|programa|rutina|coach|entrenador|progres|record|nutri|dieta|kcal|panza|barriga|abdomen|cintura|adelgaz|bajar de peso|perder peso|engord|ganar peso|volumen|definic|tonific|postura|cuerpo|fisico|atleta|deport|objetivo|\bmeta\b|vegetarian|vegan|en casa|peso|altura|imc|grasa|masa|cuanto (tiempo|dias)|cuantas veces|frecuencia|semana|principiante|nivel|maquina|mancuerna|barra|banco|polea|banda|kettlebell|smith|prensa/;
/** Greetings and questions about the coach itself are always fine. */
const SMALL_TALK =
  /^(hola|buenas|buen dia|hey|gracias|ok|dale|genial|perfecto)\b|quien eres|que (puedes|podes|sabes) hacer|como funcion|ayuda|como estas|(por que|porque) no (me )?(puedes|podes|respondes|contestas)|no me (respondes|contestas)|no entiendo/;

/**
 * True for questions clearly outside the coach's job (history, politics,
 * geography, homework...). Checked before calling the model so the chat is
 * not used as a general-purpose AI.
 */
export function isOffTopic(raw: string, query: ParsedQuery = parseQuery(raw), followUp = false): boolean {
  const text = normalizeText(raw);
  if (!text || query.intent !== 'general' || query.focus || query.exerciseId) return false;
  // "Hazla más corta", "cámbiala", "otra": they refer to the previous answer.
  if (followUp && FOLLOW_UP.test(text)) return false;
  return !DOMAIN.test(text) && !SMALL_TALK.test(text);
}

/** Short edits to the coach's previous answer, only meaningful inside a conversation. */
const FOLLOW_UP =
  /^(hazl[ao]|hacel[ao]|cambi(a|al[ao]|ala)|ponle|agrega(le)?|anade(le)?|saca(le)?|quita(le)?|otr[ao]s?|y (si|para)|mas |menos )|\bmas (corta|larga|facil|dificil|intensa|suave|liviana|pesada)\b/;

/** "Más corta" / "más larga" for a routine, in minutes. */
const SHORTER = /\bmas (corta|breve|rapida)\b|menos tiempo/;
const LONGER = /\bmas larga\b|mas tiempo/;

/** Words any real exercise name tends to contain (Spanish and English). */
const GYM_VOCABULARY =
  /press|curl|remo|row|sentadilla|squat|peso muerto|deadlift|dominad|chin|flexion|lagartija|push|pull|plancha|plank|zancada|estocada|lunge|elevacion|raise|jalon|fondo|dip|puente|bridge|thrust|hip|crunch|abdominal|extension|apertura|fly|burpee|salto|jump|swing|patada|kick|paseo|walk|carry|farmer|face|clean|snatch|arranque|cargada|step|subida|gemelo|calf|tijera|escalador|mountain|sprint|comba|cuerda|rueda|rollout|good morning|hiperextension|superman|bird|dead bug|bicho|hollow|l-sit|muscle up|pistol|nordic|sissy|rana|frog|mariposa|butterfly|cable|polea|mancuerna|dumbbell|barra|barbell|kettlebell|banda|band|maquina|machine|prensa|leg|arm|shrug|encogimiento|twist|giro|rotacion|pullover|pec|deck|bulgar|goblet|sumo|rumano|romanian|martillo|hammer|frances|skull|tricep|bicep|lateral|frontal|militar|inclinad|declinad|remada|trote|carrera|natacion|bici|estiramiento|stretch/;

/**
 * Name of the exercise in a technique question when the app cannot identify it
 * and it does not even look like an exercise ("mono colgado de la cola").
 * The small free model would invent a description for it, so the app answers
 * honestly instead. Returns null when the question is fine to send.
 */
export function unknownExerciseName(raw: string, query: ParsedQuery = parseQuery(raw)): string | null {
  if (query.exerciseId) return null;
  const text = normalizeText(raw);
  const match = text.match(/(?:tecnica|como (?:se )?hace|como hago|como realizo|como ejecuto)(?:\s+(?:bien|correctamente))?(?:\s+(?:de|del|para|el|la|los|las|un|una|entrenamiento|ejercicio))*\s+(.+)/);
  const name = match?.[1]?.replace(/[?¿!.,]+/g, '').trim();
  if (!name || name.length < 3 || GYM_VOCABULARY.test(name)) return null;
  return name;
}

export const OFF_TOPIC_REPLY =
  'Solo puedo ayudarte con tu entrenamiento, tu nutrición y el uso de GymBro. Pregúntame por una rutina, la técnica de un ejercicio o qué comer según tu objetivo.';

/** Catalog names (normalized), longest first so "barbell decline pullover" beats "pullover". */
let catalogNames: { name: string; id: string }[] | null = null;
function exerciseByCatalogName(text: string): string | undefined {
  // Both the translated and the original English name, so either one is recognized.
  catalogNames ??= EXERCISES.flatMap((exercise) => [
    { name: normalizeText(exercise.displayName), id: exercise.id },
    { name: normalizeText(exercise.name), id: exercise.id },
  ])
    .filter((item) => item.name.length >= 6)
    .sort((a, b) => b.name.length - a.name.length);
  return catalogNames.find((item) => text.includes(item.name))?.id;
}

export function parseQuery(raw: string): ParsedQuery {
  const text = normalizeText(raw);

  const focuses = [...new Set(FOCUS_PATTERNS.filter(([pattern]) => pattern.test(text)).map(([, item]) => item))];
  const focus = focuses[0];
  // Exact catalog names first (e.g. from the exercise screen's "Preguntar"), then Spanish gym slang.
  const exerciseId = exerciseByCatalogName(text) ?? EXERCISE_ALIASES.find(([pattern]) => pattern.test(text))?.[1];
  const location = /en casa|sin gimnasio|sin gym|home/.test(text) ? 'home' : /gimnasio|\bgym\b/.test(text) ? 'gym' : undefined;
  const minutesMatch = text.match(/(\d{2,3})\s*(min|minutos)/);
  const resized = SHORTER.test(text) ? 30 : LONGER.test(text) ? 75 : undefined;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : resized;

  let intent: CoachIntent = 'general';
  // "técnica de entrenamiento de..." asks how, not for a routine.
  if (
    resized !== undefined ||
    (/rutina|programa|plan de entren|entrenamiento de|sesion|workout|split|arma(me)?\b|genera|dise[nñ]a/.test(text) && !/comida|dieta|menu|tecnica|como se hace/.test(text))
  ) {
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

  // Only routine and exercise requests use it: in "remo con mancuerna" it names the exercise, not the kit.
  const equipment = intent === 'routine' || intent === 'exercises' ? parseEquipment(text) : undefined;

  return { intent, focus, focuses: focuses.length > 1 ? focuses : undefined, location, minutes, exerciseId, equipment };
}
