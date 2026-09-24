import type { Routine } from '../../types';
import { getExercise } from '../../../data/catalog';
import { estimateMinutes } from '../../utils/programGenerator';
import { createId } from '../../utils/workout';
import type { CoachBlock, CoachMessage, MealPlanItem } from './types';

/**
 * Free, key-less OpenAI-compatible endpoint (Pollinations). As of 2026 the
 * anonymous tier serves GPT-OSS 20B, which follows JSON output reliably.
 */
const ENDPOINT = 'https://text.pollinations.ai/openai';
const MODEL = 'openai';
const TIMEOUT_MS = 40_000;
const RETRY_DELAY_MS = 1_200;

export const COACH_MODEL_LABEL = 'GPT-OSS 20B';

interface RawBlock {
  type?: string;
  title?: string;
  description?: string;
  exercises?: { id?: string; sets?: number; reps?: string | number; rest?: number; note?: string }[];
  ids?: string[];
  items?: string[];
  meals?: { name?: string; items?: string[]; kcal?: number; protein?: number }[];
}

interface RawReply {
  text?: string;
  blocks?: RawBlock[];
  suggestions?: string[];
}

export interface OnlineResult {
  text: string;
  blocks: CoachBlock[];
  suggestions: string[];
}

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
};

/** Emoji and pictographs: the app shows icons only, whatever the model sends. */
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
const cleanText = (value: unknown, max = 160) =>
  typeof value === 'string' ? value.replace(EMOJI, '').replace(/[ \t]{2,}/g, ' ').trim().slice(0, max) : '';

/** Validates model output against the catalog; anything unknown is dropped. */
export function normalizeBlocks(raw: RawBlock[] | undefined, location: Routine['targetLocation']): CoachBlock[] {
  if (!Array.isArray(raw)) return [];
  const blocks: CoachBlock[] = [];

  for (const block of raw.slice(0, 4)) {
    switch (block?.type) {
      case 'routine': {
        const exercises = (block.exercises ?? [])
          .filter((item) => item?.id && getExercise(String(item.id)))
          .slice(0, 10)
          .map((item) => {
            const exercise = getExercise(String(item.id))!;
            return {
              exerciseId: exercise.id,
              exerciseName: exercise.displayName,
              targetSets: clamp(item.sets, 1, 8, 3),
              targetReps: cleanText(String(item.reps ?? '8-12'), 12) || '8-12',
              restSeconds: clamp(item.rest, 20, 300, 90),
              note: cleanText(item.note, 80) || undefined,
            };
          });
        if (exercises.length >= 2) {
          blocks.push({
            type: 'routine',
            routine: {
              id: createId('routine'),
              title: cleanText(block.title, 48) || 'Rutina del coach',
              description: cleanText(block.description, 140),
              targetLocation: location,
              level: 'intermediate',
              estimatedMinutes: estimateMinutes(exercises),
              exercises,
              isCustom: true,
            },
          });
        }
        break;
      }
      case 'exercises': {
        const ids = [...new Set((block.ids ?? []).map(String))].filter((id) => getExercise(id)).slice(0, 8);
        if (ids.length > 0) blocks.push({ type: 'exercises', title: cleanText(block.title, 48) || undefined, exerciseIds: ids });
        break;
      }
      case 'macros':
      case 'body':
        blocks.push({ type: block.type });
        break;
      case 'tips': {
        const items = (block.items ?? []).map((item) => cleanText(item, 200)).filter(Boolean).slice(0, 8);
        if (items.length > 0) blocks.push({ type: 'tips', title: cleanText(block.title, 48) || undefined, items });
        break;
      }
      case 'meals': {
        const meals: MealPlanItem[] = (block.meals ?? [])
          .map((meal) => ({
            name: cleanText(meal?.name, 32) || 'Comida',
            items: (meal?.items ?? []).map((item) => cleanText(item, 80)).filter(Boolean).slice(0, 6),
            kcal: typeof meal?.kcal === 'number' ? Math.round(meal.kcal) : undefined,
            proteinGrams: typeof meal?.protein === 'number' ? Math.round(meal.protein) : undefined,
          }))
          .filter((meal) => meal.items.length > 0)
          .slice(0, 6);
        if (meals.length > 0) blocks.push({ type: 'meals', title: cleanText(block.title, 48) || undefined, meals });
        break;
      }
    }
  }
  return blocks;
}

const looksLikeReply = (value: unknown): value is RawReply =>
  !!value && typeof value === 'object' && ('text' in value || 'blocks' in value);

/**
 * Models sometimes wrap JSON in prose/code fences or emit a stray leading brace
 * (seen in practice: `{"{"text":...`). Try every plausible start, then salvage
 * at least the "text" field. Returns null only when nothing usable exists.
 */
export function extractJson(content: string): RawReply | null {
  const end = content.lastIndexOf('}');
  const starts: number[] = [];
  const textKey = content.indexOf('{"text"');
  if (textKey !== -1) starts.push(textKey);
  for (let i = content.indexOf('{'); i !== -1 && i < end && starts.length < 8; i = content.indexOf('{', i + 1)) {
    if (!starts.includes(i)) starts.push(i);
  }
  for (const start of starts) {
    try {
      const parsed: unknown = JSON.parse(content.slice(start, end + 1));
      if (looksLikeReply(parsed)) return parsed;
    } catch {
      // try the next candidate
    }
  }

  const text = content.match(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
  if (text) {
    try {
      return { text: JSON.parse(`"${text}"`) as string };
    } catch {
      return null;
    }
  }
  return null;
}

export async function askOnline(
  systemPrompt: string,
  history: CoachMessage[],
  prompt: string,
  location: Routine['targetLocation'],
  signal?: AbortSignal
): Promise<OnlineResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort);

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map((message) => ({ role: message.role, content: message.text.slice(0, 1200) })),
      { role: 'user', content: prompt },
    ];

    const request = () =>
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          messages,
          response_format: { type: 'json_object' },
          // GPT-OSS spends most of its budget reasoning; 'low' cut latency ~8x in tests.
          reasoning_effort: 'low',
          private: true,
          referrer: 'gymbro-app',
        }),
      });

    const attempt = async (): Promise<OnlineResult | null> => {
      let response = await request();
      // The free tier returns sporadic 429/5xx under load: retry once.
      if (response.status === 429 || response.status >= 500) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        response = await request();
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const content: string = data?.choices?.[0]?.message?.content ?? '';
      const parsed = extractJson(content);
      if (!parsed?.text && !parsed?.blocks?.length) {
        // A genuine plain-text answer is still useful; broken JSON must never reach the UI.
        const plain = content.trim();
        return plain.length > 20 && !plain.includes('{') ? { text: cleanText(plain, 2000), blocks: [], suggestions: [] } : null;
      }
      return {
        text: cleanText(parsed.text, 2000),
        blocks: normalizeBlocks(parsed.blocks, location),
        suggestions: (parsed.suggestions ?? []).map((item) => cleanText(item, 60)).filter(Boolean).slice(0, 3),
      };
    };

    // The model occasionally breaks its own JSON: one more try before falling back offline.
    const result = (await attempt()) ?? (await attempt());
    if (!result) throw new Error('Unparseable response');
    return result;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
