import { ActivityLevel, FitnessGoal, Gender, NutritionMetrics, UserProfile } from '../types';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const GOAL_CALORIE_ADJUSTMENTS: Record<FitnessGoal, number> = {
  fat_loss: -400,
  maintenance: 0,
  muscle_gain: 250,
  aggressive_bulk: 500,
};

/**
 * Calculates Basal Metabolic Rate (BMR) using the clinical Mifflin-St Jeor equation.
 */
function calculateBMR(weightKg: number, heightCm: number, age: number, gender: Gender): number {
  if (weightKg <= 0 || heightCm <= 0 || age <= 0) return 0;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return Math.round(gender === 'male' ? base + 5 : base - 161);
}

/**
 * Calculates Total Daily Energy Expenditure (TDEE).
 */
function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.2;
  return Math.round(bmr * multiplier);
}

/**
 * Calculates Body Mass Index (BMI) and official WHO category.
 */
function calculateBMI(weightKg: number, heightCm: number): { bmi: number; category: string } {
  if (weightKg <= 0 || heightCm <= 0) return { bmi: 0, category: 'N/A' };
  const heightM = heightCm / 100;
  const bmi = parseFloat((weightKg / (heightM * heightM)).toFixed(1));

  let category = 'Normal';
  if (bmi < 18.5) category = 'Bajo peso';
  else if (bmi < 25) category = 'Normal';
  else if (bmi < 30) category = 'Sobrepeso';
  else category = 'Obesidad';

  return { bmi, category };
}

/**
 * Calculates Body Fat % using the U.S. Navy Anthropometric Method (Hodgdon-Beckett).
 * Measurements must be in centimeters.
 */
export function calculateBodyFatNavy(
  gender: Gender,
  heightCm: number,
  waistCm: number,
  neckCm: number,
  hipCm?: number
): number | null {
  if (heightCm <= 0 || waistCm <= 0 || neckCm <= 0) return null;

  try {
    if (gender === 'male') {
      const diff = waistCm - neckCm;
      if (diff <= 0) return null;
      // Formula: 495 / (1.0324 - 0.19077 * log10(waist - neck) + 0.15456 * log10(height)) - 450
      const denom = 1.0324 - 0.19077 * Math.log10(diff) + 0.15456 * Math.log10(heightCm);
      if (denom <= 0) return null;
      const bf = 495 / denom - 450;
      return parseFloat(Math.min(60, Math.max(3, bf)).toFixed(1));
    } else {
      if (!hipCm || hipCm <= 0) return null;
      const sumDiff = waistCm + hipCm - neckCm;
      if (sumDiff <= 0) return null;
      // Formula: 495 / (1.29579 - 0.35004 * log10(waist + hip - neck) + 0.22100 * log10(height)) - 450
      const denom = 1.29579 - 0.35004 * Math.log10(sumDiff) + 0.22100 * Math.log10(heightCm);
      if (denom <= 0) return null;
      const bf = 495 / denom - 450;
      return parseFloat(Math.min(65, Math.max(8, bf)).toFixed(1));
    }
  } catch {
    return null;
  }
}

/**
 * Calculates Body Fat % using the Deurenberg equation (BMI, age, sex regression).
 */
function calculateBodyFatDeurenberg(bmi: number, age: number, gender: Gender): number {
  if (bmi <= 0 || age <= 0) return 15;
  const sexFactor = gender === 'male' ? 1 : 0;
  // Deurenberg formula: (1.20 * BMI) + (0.23 * Age) - (10.8 * Sex) - 5.4
  const bf = 1.20 * bmi + 0.23 * age - 10.8 * sexFactor - 5.4;
  return parseFloat(Math.min(60, Math.max(4, bf)).toFixed(1));
}

/**
 * Calculates Normalized Fat-Free Mass Index (FFMI) (Kouri et al., 1995).
 */
function calculateFFMI(
  leanMassKg: number,
  heightCm: number,
  gender: Gender
): { ffmi: number; category: string } {
  if (leanMassKg <= 0 || heightCm <= 0) return { ffmi: 0, category: 'N/A' };
  const heightM = heightCm / 100;
  const rawFFMI = leanMassKg / (heightM * heightM);
  // Normalized to 1.80m reference height:
  const normalizedFFMI = parseFloat((rawFFMI + 6.1 * (1.8 - heightM)).toFixed(1));

  let category = 'Promedio';
  if (gender === 'male') {
    if (normalizedFFMI < 18.0) category = 'Por debajo del promedio';
    else if (normalizedFFMI < 20.0) category = 'Promedio';
    else if (normalizedFFMI < 22.0) category = 'Atlético';
    else if (normalizedFFMI < 23.5) category = 'Avanzado';
    else if (normalizedFFMI <= 25.0) category = 'Límite Natural Genético';
    else category = 'Élite / Nivel Competitivo';
  } else {
    if (normalizedFFMI < 15.0) category = 'Por debajo del promedio';
    else if (normalizedFFMI < 17.0) category = 'Promedio';
    else if (normalizedFFMI < 19.0) category = 'Atlética';
    else if (normalizedFFMI < 21.0) category = 'Avanzada';
    else category = 'Élite';
  }

  return { ffmi: normalizedFFMI, category };
}

/**
 * Calculates target athletic weight preserving current lean mass at desired body fat %.
 */
function calculateTargetAthleticWeight(
  leanMassKg: number,
  targetBodyFatPercent: number
): number {
  if (leanMassKg <= 0) return 0;
  const targetBF = Math.max(5, Math.min(40, targetBodyFatPercent));
  const targetWeight = leanMassKg / (1 - targetBF / 100);
  return parseFloat(targetWeight.toFixed(1));
}

/**
 * Calculates recommended daily hydration in liters based on weight and activity.
 */
function calculateHydration(weightKg: number, activityLevel: ActivityLevel): number {
  const baseLiters = weightKg * 0.035;
  const activityBonus: Record<ActivityLevel, number> = {
    sedentary: 0.2,
    light: 0.4,
    moderate: 0.6,
    very_active: 0.8,
    extra_active: 1.0,
  };
  const total = baseLiters + (activityBonus[activityLevel] || 0.4);
  return parseFloat(total.toFixed(1));
}

/**
 * Calculates comprehensive nutrition and sports body composition metrics.
 */
export function calculateNutritionPlan(
  profile: Pick<
    UserProfile,
    | 'weightKg'
    | 'heightCm'
    | 'age'
    | 'gender'
    | 'activityLevel'
    | 'fitnessGoal'
    | 'neckCm'
    | 'waistCm'
    | 'hipCm'
    | 'targetBodyFatPercent'
  >
): NutritionMetrics {
  const bmr = calculateBMR(profile.weightKg, profile.heightCm, profile.age, profile.gender);
  const tdee = calculateTDEE(bmr, profile.activityLevel);
  const targetCalories = Math.max(1200, tdee + (GOAL_CALORIE_ADJUSTMENTS[profile.fitnessGoal] || 0));

  const { bmi, category: bmiCategory } = calculateBMI(profile.weightKg, profile.heightCm);

  // Body Fat Determination: Try U.S. Navy first, then fallback to Deurenberg
  let bodyFatPercent: number;
  let bodyFatMethod: 'navy' | 'deurenberg' = 'deurenberg';

  const navyResult = profile.waistCm && profile.neckCm
    ? calculateBodyFatNavy(profile.gender, profile.heightCm, profile.waistCm, profile.neckCm, profile.hipCm)
    : null;

  if (navyResult !== null) {
    bodyFatPercent = navyResult;
    bodyFatMethod = 'navy';
  } else {
    bodyFatPercent = calculateBodyFatDeurenberg(bmi, profile.age, profile.gender);
    bodyFatMethod = 'deurenberg';
  }

  // Lean and Fat Mass
  const fatMassKg = parseFloat((profile.weightKg * (bodyFatPercent / 100)).toFixed(1));
  const leanMassKg = parseFloat((profile.weightKg - fatMassKg).toFixed(1));

  // FFMI
  const { ffmi, category: ffmiCategory } = calculateFFMI(leanMassKg, profile.heightCm, profile.gender);

  // Target Athletic Weight based on current lean mass
  const defaultTargetBF = profile.gender === 'male' ? 12 : 20;
  const targetBF = profile.targetBodyFatPercent || defaultTargetBF;
  const idealWeightKg = calculateTargetAthleticWeight(leanMassKg, targetBF);

  // WHO Healthy Weight Range (BMI 18.5 - 24.9)
  const heightM = profile.heightCm / 100;
  const healthyWeightRange = {
    min: parseFloat((18.5 * heightM * heightM).toFixed(1)),
    max: parseFloat((24.9 * heightM * heightM).toFixed(1)),
  };

  // Hydration Target
  const waterLitersDaily = calculateHydration(profile.weightKg, profile.activityLevel);

  // Macronutrient Targets based on sports nutrition & lean mass
  // Protein: 2.0g - 2.2g per kg of total bodyweight (or up to 2.5g in aggressive fat loss)
  const proteinMultiplier = profile.fitnessGoal === 'fat_loss' ? 2.2 : 2.0;
  const proteinGrams = Math.round(profile.weightKg * proteinMultiplier);
  const proteinCalories = proteinGrams * 4;

  // Fat: 0.9g per kg of bodyweight (essential hormonal health)
  const fatGrams = Math.round(profile.weightKg * 0.9);
  const fatCalories = fatGrams * 9;

  // Carbs: Remaining calories
  const remainingCalories = Math.max(0, targetCalories - (proteinCalories + fatCalories));
  const carbGrams = Math.round(remainingCalories / 4);

  return {
    bmr,
    tdee,
    targetCalories,
    proteinGrams,
    fatGrams,
    carbGrams,
    bmi,
    bmiCategory,
    bodyFatPercent,
    bodyFatMethod,
    leanMassKg,
    fatMassKg,
    ffmi,
    ffmiCategory,
    idealWeightKg,
    healthyWeightRange,
    waterLitersDaily,
  };
}
