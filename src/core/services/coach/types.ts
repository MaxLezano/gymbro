import type { Routine } from '../../types';

export interface MealPlanItem {
  name: string;
  items: string[];
  kcal?: number;
  proteinGrams?: number;
  /** Only in pantry mode: whether the meal could be made with what the athlete has at home. */
  fromPantry?: boolean;
}

export type CoachBlock =
  | { type: 'routine'; routine: Routine }
  | { type: 'exercises'; title?: string; exerciseIds: string[] }
  | { type: 'macros' }
  | { type: 'body' }
  | { type: 'tips'; title?: string; items: string[] }
  | { type: 'meals'; title?: string; meals: MealPlanItem[] };

export interface CoachReply {
  text: string;
  blocks: CoachBlock[];
  suggestions: string[];
  /** 'scope' = answered locally because the question is outside the coach's job. */
  source: 'online' | 'offline' | 'scope';
  /** Which model answered an online reply (the proxy falls back between free tiers). */
  provider?: CoachProvider;
}

export type CoachProvider = 'gemini' | 'workers-ai';

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  blocks?: CoachBlock[];
  suggestions?: string[];
  source?: CoachReply['source'];
  provider?: CoachProvider;
  createdAt: number;
}
