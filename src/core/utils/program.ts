import type { Routine, UserProfile, WorkoutSession } from '../types';
import { sessionDate } from './workout';

/** Routines of the current weekly program, ordered by day. */
export function programRoutines(customRoutines: Routine[]): Routine[] {
  return customRoutines
    .filter((routine) => routine.programId)
    .sort((a, b) => (a.programDay ?? 0) - (b.programDay ?? 0));
}

/**
 * Next day to train: the one after the most recently completed program day,
 * wrapping around the week. Day 1 if none was done yet.
 */
export function nextProgramRoutine(program: Routine[], history: WorkoutSession[]): Routine | null {
  if (program.length === 0) return null;
  const ids = new Set(program.map((routine) => routine.id));
  const last = [...history]
    .sort((a, b) => sessionDate(b) - sessionDate(a))
    .find((session) => session.routineId && ids.has(session.routineId));
  if (!last) return program[0];
  const index = program.findIndex((routine) => routine.id === last.routineId);
  return program[(index + 1) % program.length];
}

export interface ProfileCompletion {
  percent: number;
  missing: { key: string; label: string }[];
}

/** What is still worth filling in to personalise the app (Hevy-style nudge). */
export function profileCompletion(profile: UserProfile, hasProgram: boolean, canLinkGoogle: boolean): ProfileCompletion {
  const checks = [
    { key: 'name', label: 'Tu nombre', done: profile.name.trim().length > 0 },
    { key: 'program', label: 'Tu programa semanal', done: hasProgram },
    { key: 'measures', label: 'Medidas de cuello y cintura', done: !!profile.neckCm && !!profile.waistCm },
    { key: 'target', label: 'Tu % de grasa objetivo', done: !!profile.targetBodyFatPercent },
    ...(canLinkGoogle ? [{ key: 'photo', label: 'Foto de perfil (Google)', done: !!profile.photoUrl }] : []),
  ];
  const done = checks.filter((check) => check.done).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter((check) => !check.done).map(({ key, label }) => ({ key, label })),
  };
}
