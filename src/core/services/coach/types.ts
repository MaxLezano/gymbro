import type { Routine } from '../../types';

export interface MealPlanItem {
  name: string;
  items: string[];
  kcal?: number;
  proteinGrams?: number;
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
  source: 'online' | 'offline';
}

export interface CoachMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  blocks?: CoachBlock[];
  suggestions?: string[];
  source?: 'online' | 'offline';
  createdAt: number;
}
