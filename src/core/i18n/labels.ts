import type {
  ActivityLevel,
  ExperienceLevel,
  FitnessGoal,
  HomeEquipment,
  TrainingLocation,
} from '../types';

/** Spanish labels for the English taxonomy used by the exercise dataset. */
export const BODY_PART_LABELS: Record<string, string> = {
  waist: 'Abdomen',
  'upper legs': 'Piernas',
  back: 'Espalda',
  'lower legs': 'Pantorrillas',
  chest: 'Pecho',
  'upper arms': 'Brazos',
  cardio: 'Cardio',
  shoulders: 'Hombros',
  'lower arms': 'Antebrazos',
  neck: 'Cuello',
};

export const TARGET_LABELS: Record<string, string> = {
  abs: 'Abdominales',
  quads: 'Cuádriceps',
  lats: 'Dorsales',
  calves: 'Gemelos',
  pectorals: 'Pectorales',
  glutes: 'Glúteos',
  hamstrings: 'Isquiotibiales',
  adductors: 'Aductores',
  abductors: 'Abductores',
  triceps: 'Tríceps',
  biceps: 'Bíceps',
  'cardiovascular system': 'Cardiovascular',
  spine: 'Lumbar',
  'upper back': 'Espalda alta',
  delts: 'Deltoides',
  forearms: 'Antebrazos',
  traps: 'Trapecios',
  'serratus anterior': 'Serrato',
  'levator scapulae': 'Elevador escápula',
  'hip flexors': 'Flexores de cadera',
  'lower back': 'Zona lumbar',
  shoulders: 'Hombros',
  core: 'Core',
  chest: 'Pecho',
  back: 'Espalda',
  obliques: 'Oblicuos',
  wrists: 'Muñecas',
  hands: 'Manos',
  ankles: 'Tobillos',
  feet: 'Pies',
  groin: 'Ingle',
  'rotator cuff': 'Manguito rotador',
  'inner thighs': 'Aductores',
  rhomboids: 'Romboides',
  'rear deltoids': 'Deltoides posterior',
  trapezius: 'Trapecio',
  deltoids: 'Deltoides',
  'upper chest': 'Pecho superior',
  'ankle stabilizers': 'Estabilizadores de tobillo',
  quadriceps: 'Cuádriceps',
  brachialis: 'Braquial',
  'latissimus dorsi': 'Dorsal ancho',
  'wrist flexors': 'Flexores de muñeca',
  'wrist extensors': 'Extensores de muñeca',
  abdominals: 'Abdominales',
  'grip muscles': 'Agarre',
  'lower abs': 'Abdomen inferior',
  soleus: 'Sóleo',
  sternocleidomastoid: 'Esternocleidomastoideo',
  shins: 'Tibiales',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  'body weight': 'Peso corporal',
  cable: 'Polea',
  'leverage machine': 'Máquina',
  assisted: 'Asistido',
  'medicine ball': 'Balón medicinal',
  'stability ball': 'Fitball',
  band: 'Banda',
  barbell: 'Barra',
  rope: 'Cuerda',
  dumbbell: 'Mancuerna',
  'ez barbell': 'Barra Z',
  'sled machine': 'Prensa',
  'upper body ergometer': 'Ergómetro',
  kettlebell: 'Kettlebell',
  'olympic barbell': 'Barra olímpica',
  weighted: 'Con lastre',
  'bosu ball': 'Bosu',
  'resistance band': 'Banda elástica',
  roller: 'Rodillo',
  'skierg machine': 'SkiErg',
  hammer: 'Martillo',
  'smith machine': 'Máquina Smith',
  'wheel roller': 'Rueda abdominal',
  'stationary bike': 'Bicicleta fija',
  tire: 'Neumático',
  'trap bar': 'Barra hexagonal',
  'elliptical machine': 'Elíptica',
  'stepmill machine': 'Escaladora',
};

const capitalize = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

export const labelBodyPart = (value: string) => BODY_PART_LABELS[value] ?? capitalize(value);
export const labelTarget = (value: string) => TARGET_LABELS[value] ?? capitalize(value);
export const labelEquipment = (value: string) => EQUIPMENT_LABELS[value] ?? capitalize(value);

const LOWERCASE_WORDS = new Set(['on', 'with', 'to', 'of', 'the', 'and', 'a', 'in', 'v.']);

/** Dataset names are lowercase ("dumbbell bench press"); present them in title case. */
export function formatExerciseName(name: string): string {
  return name
    .replace(/в°/g, '°')
    .split(' ')
    .map((word, index) => {
      if (index > 0 && LOWERCASE_WORDS.has(word)) return word;
      return word
        .split('-')
        .map((part) => (/^\(?[a-z]/.test(part) ? part.replace(/[a-z]/, (c) => c.toUpperCase()) : part))
        .join('-');
    })
    .join(' ');
}

export const GOAL_LABELS: Record<FitnessGoal, { title: string; short: string; description: string }> = {
  fat_loss: { title: 'Perder grasa', short: 'Déficit −400 kcal', description: 'Definición conservando músculo' },
  maintenance: { title: 'Recomposición', short: 'Mantenimiento', description: 'Mismo peso, mejor composición' },
  muscle_gain: { title: 'Ganar músculo', short: 'Superávit +250 kcal', description: 'Volumen limpio con poca grasa' },
  aggressive_bulk: { title: 'Volumen intenso', short: 'Superávit +500 kcal', description: 'Máxima ganancia de masa y fuerza' },
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; description: string }> = {
  sedentary: { title: 'Sedentario', description: 'Trabajo de escritorio, poco movimiento' },
  light: { title: 'Ligero', description: '1–3 entrenamientos por semana' },
  moderate: { title: 'Moderado', description: '3–5 entrenamientos por semana' },
  very_active: { title: 'Muy activo', description: '6–7 entrenamientos por semana' },
  extra_active: { title: 'Atleta', description: 'Doble sesión o trabajo físico' },
};

export const LOCATION_LABELS: Record<TrainingLocation, string> = {
  home: 'En casa',
  gym: 'Gimnasio',
  hybrid: 'Ambos',
};

export const LEVEL_LABELS: Record<ExperienceLevel, string> = {
  beginner: 'Principiante',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export const HOME_EQUIPMENT_OPTIONS: { id: HomeEquipment; label: string; icon: string }[] = [
  { id: 'body_weight', label: 'Peso corporal', icon: 'body-outline' },
  { id: 'dumbbells', label: 'Mancuernas', icon: 'barbell-outline' },
  { id: 'adjustable_bench', label: 'Banco', icon: 'bed-outline' },
  { id: 'barbell_plates', label: 'Barra y discos', icon: 'barbell' },
  { id: 'pullup_bar', label: 'Barra de dominadas', icon: 'remove-outline' },
  { id: 'kettlebell', label: 'Kettlebell', icon: 'fitness-outline' },
  { id: 'resistance_bands', label: 'Bandas elásticas', icon: 'git-commit-outline' },
  { id: 'treadmill', label: 'Cinta de correr', icon: 'walk-outline' },
  { id: 'stationary_bike', label: 'Bicicleta fija', icon: 'bicycle-outline' },
  { id: 'ab_wheel', label: 'Rueda abdominal', icon: 'ellipse-outline' },
];
