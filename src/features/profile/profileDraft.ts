import { useMemo, useState } from 'react';
import type {
  ActivityLevel,
  ExperienceLevel,
  FitnessGoal,
  FocusMuscle,
  Gender,
  GymType,
  HomeEquipment,
  TrainingLocation,
  UserProfile,
} from '../../core/types';
import { calculateNutritionPlan } from '../../core/utils/nutrition';

export interface ProfileDraft {
  name: string;
  gender: Gender;
  age: string;
  weightKg: string;
  heightCm: string;
  neckCm: string;
  waistCm: string;
  hipCm: string;
  targetBodyFatPercent: string;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
  trainingLocation: TrainingLocation;
  experience: ExperienceLevel;
  homeEquipment: HomeEquipment[];
  gymType: GymType;
  daysPerWeek: number;
  sessionMinutes: number;
  focusMuscle: FocusMuscle;
  email?: string;
  photoUrl?: string;
}

const toText = (value?: number) => (value ? String(value) : '');
const toNumber = (value: string) => {
  const parsed = parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const RANGES = {
  age: { min: 14, max: 90, label: 'Edad', unit: 'años' },
  weightKg: { min: 30, max: 250, label: 'Peso', unit: 'kg' },
  heightCm: { min: 120, max: 230, label: 'Altura', unit: 'cm' },
  neckCm: { min: 20, max: 60, label: 'Cuello', unit: 'cm' },
  waistCm: { min: 45, max: 180, label: 'Cintura', unit: 'cm' },
  hipCm: { min: 60, max: 180, label: 'Cadera', unit: 'cm' },
  targetBodyFatPercent: { min: 5, max: 40, label: '% grasa meta', unit: '%' },
} as const;

type NumericField = keyof typeof RANGES;
const REQUIRED: NumericField[] = ['age', 'weightKg', 'heightCm'];

function draftFromProfile(profile: UserProfile): ProfileDraft {
  return {
    name: profile.name,
    gender: profile.gender,
    age: toText(profile.age),
    weightKg: toText(profile.weightKg),
    heightCm: toText(profile.heightCm),
    neckCm: toText(profile.neckCm),
    waistCm: toText(profile.waistCm),
    hipCm: toText(profile.hipCm),
    targetBodyFatPercent: toText(profile.targetBodyFatPercent),
    activityLevel: profile.activityLevel,
    fitnessGoal: profile.fitnessGoal,
    trainingLocation: profile.trainingLocation,
    experience: profile.experience,
    homeEquipment: profile.homeEquipment,
    gymType: profile.gymType ?? (profile.trainingLocation === 'home' ? 'home' : 'large_gym'),
    daysPerWeek: profile.daysPerWeek ?? 3,
    sessionMinutes: profile.sessionMinutes ?? 60,
    focusMuscle: profile.focusMuscle ?? 'balanced',
    email: profile.email,
    photoUrl: profile.photoUrl,
  };
}

function validateDraft(draft: ProfileDraft): Partial<Record<NumericField, string>> {
  const errors: Partial<Record<NumericField, string>> = {};
  (Object.keys(RANGES) as NumericField[]).forEach((field) => {
    const raw = draft[field];
    const range = RANGES[field];
    if (!raw) {
      if (REQUIRED.includes(field)) errors[field] = 'Obligatorio';
      return;
    }
    const value = toNumber(raw);
    if (value === undefined || value < range.min || value > range.max) {
      errors[field] = `${range.min}–${range.max} ${range.unit}`;
    }
  });
  return errors;
}

export function profileFromDraft(base: UserProfile, draft: ProfileDraft): UserProfile {
  const optional = (value: string) => toNumber(value) || undefined;
  return {
    ...base,
    name: draft.name.trim(),
    gender: draft.gender,
    age: Math.round(toNumber(draft.age) ?? base.age),
    weightKg: toNumber(draft.weightKg) ?? base.weightKg,
    heightCm: toNumber(draft.heightCm) ?? base.heightCm,
    neckCm: optional(draft.neckCm),
    waistCm: optional(draft.waistCm),
    hipCm: draft.gender === 'female' ? optional(draft.hipCm) : undefined,
    targetBodyFatPercent: optional(draft.targetBodyFatPercent),
    activityLevel: draft.activityLevel,
    fitnessGoal: draft.fitnessGoal,
    trainingLocation: draft.trainingLocation,
    experience: draft.experience,
    homeEquipment: draft.homeEquipment.includes('body_weight') ? draft.homeEquipment : ['body_weight', ...draft.homeEquipment],
    gymType: draft.gymType,
    daysPerWeek: draft.daysPerWeek,
    sessionMinutes: draft.sessionMinutes,
    focusMuscle: draft.focusMuscle,
    email: draft.email,
    photoUrl: draft.photoUrl,
  };
}

export function useProfileDraft(profile: UserProfile) {
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFromProfile(profile));
  const errors = useMemo(() => validateDraft(draft), [draft]);
  const preview = useMemo(() => {
    const candidate = profileFromDraft(profile, draft);
    return errors.age || errors.weightKg || errors.heightCm ? null : calculateNutritionPlan(candidate);
  }, [draft, errors, profile]);

  const update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));
  const merge = (patch: Partial<ProfileDraft>) => setDraft((prev) => ({ ...prev, ...patch }));

  return { draft, update, merge, errors, preview, isValid: Object.keys(errors).length === 0 };
}
