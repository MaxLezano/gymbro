import { calculateNutritionPlan } from '../../utils/nutrition';
import type { UserProfile, WorkoutSession } from '../../types';
import { describeAthlete, describeCandidates, describeHistory, selectCandidates, type CoachContext } from './context';
import { parseQuery, type ParsedQuery } from './intents';
import { offlineReply } from './offlineEngine';
import { askOnline } from './onlineClient';
import type { CoachMessage, CoachReply } from './types';

export type { CoachBlock, CoachMessage, CoachReply, MealPlanItem } from './types';
export { COACH_MODEL_LABEL } from './onlineClient';

const INTENT_HINT: Record<ParsedQuery['intent'], string> = {
  routine: 'El atleta pide una rutina: incluye SIEMPRE un bloque "routine" con 4-7 ejercicios del catálogo.',
  exercises: 'El atleta busca ejercicios: incluye un bloque "exercises" con 3-6 ids del catálogo.',
  technique: 'El atleta pregunta por la técnica o progresión de un ejercicio: incluye un bloque "exercises" con ese id y un bloque "tips" con claves de técnica.',
  nutrition: 'Pregunta de nutrición: incluye el bloque "macros" y, si pide menú o comidas, un bloque "meals" que respete sus macros.',
  body: 'Pregunta de composición corporal: incluye el bloque "body".',
  progress: 'Pregunta de progreso: usa su historial y récords; incluye un bloque "tips" con objetivos concretos (peso × reps).',
  general: 'Responde de forma breve; usa bloques solo si aportan.',
};

const TRAINING_INTENTS: ParsedQuery['intent'][] = ['routine', 'exercises', 'technique', 'progress', 'general'];

function buildSystemPrompt(context: CoachContext, query: ParsedQuery): string {
  // Keep the prompt lean: catalog and history only matter for training questions,
  // and every extra token adds latency on the free tier.
  const trainingContext = TRAINING_INTENTS.includes(query.intent)
    ? `

HISTORIAL
${describeHistory(context.history)}

CATÁLOGO DISPONIBLE (id | nombre | músculo | equipo). Solo puedes recomendar ejercicios de esta lista y SIEMPRE por su id:
${describeCandidates(selectCandidates(query, context))}`
    : '';

  return `Eres GymBro Coach, entrenador personal de fuerza y nutricionista deportivo. Hablas SIEMPRE en español neutro, cercano y directo, y tuteas al atleta: títulos, notas y sugerencias también en español, sin anglicismos (di "torso", no "upper body"; "aprieta", no "squeeze"). Nunca uses emojis.

PERFIL DEL ATLETA
${describeAthlete(context)}${trainingContext}

FORMATO: responde SOLO con un objeto JSON válido:
{"text": string, "blocks": Block[], "suggestions": string[]}
- "text": máximo 70 palabras, Markdown simple (**negrita**, listas con "- "). Explica el porqué, no repitas lo que muestran los bloques.
- Block puede ser:
  {"type":"routine","title":string,"description":string,"exercises":[{"id":string,"sets":number,"reps":string,"rest":number,"note":string}]}
  {"type":"exercises","title":string,"ids":string[]}
  {"type":"tips","title":string,"items":string[]}
  {"type":"meals","title":string,"meals":[{"name":string,"items":string[],"kcal":number,"protein":number}]}
  {"type":"macros"}  (muestra sus calorías y macros)
  {"type":"body"}    (muestra su composición corporal)
- "suggestions": 3 preguntas naturales y bien escritas (máx. 7 palabras) que el atleta haría a continuación sobre ESTE mismo tema, en primera persona. Ej: "¿Cómo caliento antes?", "Hazla más corta".

REGLAS
- Adapta todo a su objetivo, nivel y equipo. Series, repeticiones y descansos según evidencia (hipertrofia 6-12 reps, fuerza 3-6, RIR 1-3).
- Si no sabes algo o es un tema médico, recomienda consultar a un profesional.
- ${INTENT_HINT[query.intent]}`;
}

export interface AskCoachOptions {
  prompt: string;
  history: CoachMessage[];
  profile: UserProfile;
  workouts: WorkoutSession[];
  signal?: AbortSignal;
  /** Skip the network entirely (user preference or no connectivity). */
  offlineOnly?: boolean;
}

export async function askCoach({ prompt, history, profile, workouts, signal, offlineOnly }: AskCoachOptions): Promise<CoachReply> {
  const context: CoachContext = { profile, plan: calculateNutritionPlan(profile), history: workouts };
  const query = parseQuery(prompt);
  const location = query.location ?? (profile.trainingLocation === 'home' ? 'home' : 'gym');

  if (!offlineOnly) {
    try {
      const online = await askOnline(buildSystemPrompt(context, query), history, prompt, location, signal);
      // If the model skipped the routine the athlete explicitly asked for, attach ours.
      if (query.intent === 'routine' && !online.blocks.some((block) => block.type === 'routine')) {
        const fallback = offlineReply(query, context);
        online.blocks = [...fallback.blocks, ...online.blocks];
      }
      if (online.suggestions.length === 0) online.suggestions = offlineReply(query, context).suggestions;
      return { ...online, source: 'online' };
    } catch (error) {
      if (signal?.aborted) throw error;
      // Network/model failure: fall through to the deterministic engine.
      if (__DEV__) console.warn('[coach] online failed, using offline engine:', error instanceof Error ? error.message : error);
    }
  }

  return { ...offlineReply(query, context), source: 'offline' };
}
