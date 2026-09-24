export type Gender = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary' // 1.2
  | 'light' // 1.375
  | 'moderate' // 1.55
  | 'very_active' // 1.725
  | 'extra_active'; // 1.9

export type FitnessGoal =
  | 'fat_loss' // -400 kcal
  | 'maintenance' // 0 kcal
  | 'muscle_gain' // +250 kcal
  | 'aggressive_bulk'; // +500 kcal

export type TrainingLocation = 'gym' | 'home' | 'hybrid';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

/** Where the athlete trains, from a full club to the living room. Drives equipment presets. */
export type GymType = 'large_gym' | 'basic_gym' | 'garage_gym' | 'home';

/** Muscle group the athlete wants to prioritise inside a balanced program. */
export type FocusMuscle = 'balanced' | 'chest' | 'back' | 'legs' | 'glutes' | 'shoulders' | 'arms' | 'core';

/** Cover artwork bundled with the app (see src/data/covers.ts). */
export type CoverKey =
  | 'push'
  | 'pull'
  | 'legs'
  | 'full_body'
  | 'upper'
  | 'arms'
  | 'core'
  | 'glutes'
  | 'home'
  | 'hiit'
  | 'cardio';

export type HomeEquipment =
  | 'body_weight'
  | 'dumbbells'
  | 'barbell_plates'
  | 'adjustable_bench'
  | 'pullup_bar'
  | 'kettlebell'
  | 'resistance_bands'
  | 'treadmill'
  | 'stationary_bike'
  | 'ab_wheel';

export interface UserProfile {
  id: string;
  name: string;
  gender: Gender;
  age: number;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
  fitnessGoal: FitnessGoal;
  trainingLocation: TrainingLocation;
  experience: ExperienceLevel;
  homeEquipment: HomeEquipment[];
  hasCompletedOnboarding: boolean;
  // Program preferences (onboarding questionnaire)
  gymType?: GymType;
  daysPerWeek?: number;
  sessionMinutes?: number;
  focusMuscle?: FocusMuscle;
  // Optional Google account link (display only; data stays on device)
  email?: string;
  photoUrl?: string;
  // Anthropometric measurements (U.S. Navy method)
  neckCm?: number;
  waistCm?: number;
  hipCm?: number;
  targetBodyFatPercent?: number;
}

export interface NutritionMetrics {
  bmr: number;
  tdee: number;
  targetCalories: number;
  proteinGrams: number;
  fatGrams: number;
  carbGrams: number;
  bmi: number;
  bmiCategory: string;
  bodyFatPercent: number;
  bodyFatMethod: 'navy' | 'deurenberg';
  leanMassKg: number;
  fatMassKg: number;
  ffmi: number;
  ffmiCategory: string;
  idealWeightKg: number;
  healthyWeightRange: { min: number; max: number };
  waterLitersDaily: number;
}

export interface Exercise {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  secondaryMuscles: string[];
  equipment: string;
  isHomeFriendly: boolean;
  instructions: string[];
  thumbnailUrl: string | null;
  gifUrl: string | null;
}

export interface RoutineExercise {
  exerciseId: string;
  exerciseName?: string;
  targetSets: number;
  targetReps: string; // e.g. "8-12"
  restSeconds: number;
  note?: string;
}

export interface Routine {
  id: string;
  title: string;
  description: string;
  targetLocation: 'gym' | 'home' | 'all';
  level: ExperienceLevel;
  estimatedMinutes: number;
  requiredEquipment?: HomeEquipment[];
  exercises: RoutineExercise[];
  isCustom?: boolean;
  createdAt?: number;
  cover?: CoverKey;
  /** Set when the routine belongs to a generated weekly program. */
  programId?: string;
  programDay?: number;
}

export type SetType = 'warmup' | 'normal' | 'failure' | 'dropset';

export interface SetLog {
  id: string;
  setNumber: number;
  type: SetType;
  weightKg: number;
  reps: number;
  completed: boolean;
  rpe?: number;
}

export interface WorkoutExerciseLog {
  exerciseId: string;
  exerciseName: string;
  targetMuscle?: string;
  targetReps?: string;
  restSeconds?: number;
  sets: SetLog[];
}

export interface WorkoutSession {
  id: string;
  title: string;
  routineId?: string;
  startedAt: number;
  completedAt?: number;
  durationSeconds: number;
  totalVolumeKg: number;
  exercises: WorkoutExerciseLog[];
  status: 'in_progress' | 'completed' | 'abandoned';
}
