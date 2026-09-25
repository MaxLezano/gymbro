import type { DietaryCondition, NutritionMetrics } from '../../types';
import type { MealPlanItem } from './types';

// ---------------------------------------------------------------------------
// Foods
// ---------------------------------------------------------------------------

/** Properties a condition may rule out. */
type FoodTag = 'gluten' | 'lactose' | 'high_gi' | 'high_sodium' | 'red_meat' | 'egg_yolk';

interface Food {
  id: string;
  /** Spanish display name, as served (cooked weight when relevant). */
  name: string;
  /** Grams of protein, carbohydrate and fat per gram of food. */
  p: number;
  c: number;
  f: number;
  tags?: FoodTag[];
  /**
   * A tagged food stays allowed for a condition when it has an adapted version
   * (e.g. lactose-free yogurt): `name` replaces the display name, `suffix` is appended,
   * and `tags` are properties the adapted version adds (gluten-free pasta is high GI).
   */
  adapt?: Partial<Record<DietaryCondition, { name?: string; suffix?: string; tags?: FoodTag[] }>>;
  /** Counted foods (eggs, tortillas, spoons) are shown in units instead of grams. */
  unit?: { grams: number; singular: string; plural: string };
  /** Serving limits in grams. */
  min?: number;
  max?: number;
  /** Lunch and dinner never share the same main protein family. */
  family?: string;
}

const FOODS = {
  // Main proteins (cooked)
  chicken: { id: 'chicken', name: 'pechuga de pollo (cocida)', p: 0.31, c: 0, f: 0.036, min: 60, max: 300, family: 'poultry' },
  beef: { id: 'beef', name: 'carne vacuna magra (cocida)', p: 0.29, c: 0, f: 0.08, min: 60, max: 280, tags: ['red_meat'], family: 'beef' },
  pork: { id: 'pork', name: 'lomo de cerdo magro (cocido)', p: 0.27, c: 0, f: 0.06, min: 60, max: 280, family: 'pork' },
  whiteFish: { id: 'whiteFish', name: 'pescado blanco (merluza o similar, cocido)', p: 0.23, c: 0, f: 0.02, min: 60, max: 350, family: 'fish' },
  salmon: { id: 'salmon', name: 'salmón (cocido)', p: 0.25, c: 0, f: 0.12, min: 60, max: 250, family: 'fish' },
  tuna: {
    id: 'tuna',
    name: 'atún en lata al agua',
    p: 0.26,
    c: 0,
    f: 0.01,
    min: 60,
    max: 240,
    tags: ['high_sodium'],
    adapt: { hypertension: { name: 'atún al natural bajo en sodio' } },
    family: 'tuna',
  },
  tofu: { id: 'tofu', name: 'tofu firme', p: 0.15, c: 0.02, f: 0.08, min: 60, max: 350, family: 'tofu' },

  // Breakfast and snack proteins
  greekYogurt: {
    id: 'greekYogurt',
    name: 'yogur griego natural',
    p: 0.1,
    c: 0.04,
    f: 0.02,
    min: 100,
    max: 300,
    tags: ['lactose'],
    adapt: { lactose_intolerance: { name: 'yogur griego deslactosado' } },
  },
  cottage: {
    id: 'cottage',
    name: 'queso cottage o queso fresco magro',
    p: 0.12,
    c: 0.035,
    f: 0.045,
    min: 60,
    max: 250,
    tags: ['lactose', 'high_sodium'],
    adapt: { lactose_intolerance: { name: 'queso fresco deslactosado' }, hypertension: { suffix: 'bajo en sodio' } },
  },
  eggs: {
    id: 'eggs',
    name: 'huevos',
    p: 0.13,
    c: 0.01,
    f: 0.1,
    max: 100,
    tags: ['egg_yolk'],
    unit: { grams: 50, singular: 'huevo', plural: 'huevos' },
  },
  eggWhites: { id: 'eggWhites', name: 'claras de huevo', p: 0.11, c: 0.01, f: 0.002, min: 60, max: 300 },
  wheyProtein: {
    id: 'wheyProtein',
    name: 'proteína en polvo',
    p: 0.8,
    c: 0.08,
    f: 0.06,
    min: 20,
    max: 50,
    tags: ['lactose'],
    adapt: { lactose_intolerance: { name: 'proteína en polvo aislada sin lactosa o vegetal' } },
  },

  // Carbohydrates (cooked where it applies)
  whiteRice: { id: 'whiteRice', name: 'arroz blanco (cocido)', p: 0.027, c: 0.28, f: 0.003, max: 450, tags: ['high_gi'] },
  brownRice: { id: 'brownRice', name: 'arroz integral (cocido)', p: 0.026, c: 0.23, f: 0.009, max: 450 },
  pasta: {
    id: 'pasta',
    name: 'fideos de trigo (cocidos, al dente)',
    p: 0.058,
    c: 0.25,
    f: 0.009,
    max: 400,
    tags: ['gluten'],
    adapt: { celiac: { name: 'fideos sin TACC (cocidos)', tags: ['high_gi'] } },
  },
  potato: { id: 'potato', name: 'papa hervida', p: 0.02, c: 0.2, f: 0.001, max: 500, tags: ['high_gi'] },
  sweetPotato: { id: 'sweetPotato', name: 'batata al horno', p: 0.02, c: 0.21, f: 0.002, max: 450 },
  quinoa: { id: 'quinoa', name: 'quinoa (cocida)', p: 0.044, c: 0.21, f: 0.019, max: 400 },
  lentils: { id: 'lentils', name: 'lentejas (cocidas)', p: 0.09, c: 0.2, f: 0.004, max: 250 },
  chickpeas: { id: 'chickpeas', name: 'garbanzos (cocidos)', p: 0.089, c: 0.27, f: 0.026, max: 200 },
  cornTortillas: {
    id: 'cornTortillas',
    name: 'tortillas de maíz',
    p: 0.06,
    c: 0.45,
    f: 0.03,
    max: 180,
    unit: { grams: 30, singular: 'tortilla de maíz', plural: 'tortillas de maíz' },
  },
  oats: {
    id: 'oats',
    name: 'avena',
    p: 0.13,
    c: 0.66,
    f: 0.07,
    min: 30,
    max: 120,
    tags: ['gluten'],
    adapt: { celiac: { name: 'avena certificada sin TACC' } },
  },
  wholeBread: {
    id: 'wholeBread',
    name: 'pan integral',
    p: 0.13,
    c: 0.41,
    f: 0.04,
    min: 40,
    max: 150,
    tags: ['gluten', 'high_sodium'],
    adapt: { celiac: { name: 'pan sin TACC', tags: ['high_gi'] }, hypertension: { suffix: 'bajo en sodio' } },
  },

  // Fruit (1–2 units per meal)
  banana: { id: 'banana', min: 120, max: 240, name: 'banana', p: 0.011, c: 0.23, f: 0.003, tags: ['high_gi'], unit: { grams: 120, singular: 'banana', plural: 'bananas' } },
  apple: { id: 'apple', min: 180, max: 360, name: 'manzana', p: 0.003, c: 0.14, f: 0.002, unit: { grams: 180, singular: 'manzana', plural: 'manzanas' } },
  pear: { id: 'pear', min: 170, max: 340, name: 'pera', p: 0.004, c: 0.15, f: 0.001, unit: { grams: 170, singular: 'pera', plural: 'peras' } },
  orange: { id: 'orange', min: 180, max: 360, name: 'naranja', p: 0.009, c: 0.12, f: 0.001, unit: { grams: 180, singular: 'naranja', plural: 'naranjas' } },
  berries: {
    id: 'berries',
    name: 'frutos rojos',
    p: 0.007,
    c: 0.12,
    f: 0.003,
    min: 150,
    max: 300,
    unit: { grams: 150, singular: 'taza de frutos rojos', plural: 'tazas de frutos rojos' },
  },

  // Drinks for shakes (fixed serving)
  milk: {
    id: 'milk',
    name: 'ml de leche descremada',
    p: 0.034,
    c: 0.05,
    f: 0.002,
    tags: ['lactose'],
    adapt: { lactose_intolerance: { name: 'ml de leche descremada deslactosada' } },
  },
  almondDrink: { id: 'almondDrink', name: 'ml de bebida de almendras sin azúcar', p: 0.004, c: 0.003, f: 0.011 },

  // Fats
  avocado: { id: 'avocado', name: 'palta', p: 0.02, c: 0.09, f: 0.15, min: 30, max: 150 },
  oliveOil: {
    id: 'oliveOil',
    name: 'aceite de oliva',
    p: 0,
    c: 0,
    f: 1,
    min: 13.5,
    max: 40,
    unit: { grams: 13.5, singular: 'cda de aceite de oliva', plural: 'cda de aceite de oliva' },
  },
  nuts: {
    id: 'nuts',
    name: 'frutos secos (nueces o almendras)',
    p: 0.18,
    c: 0.1,
    f: 0.55,
    min: 10,
    max: 40,
    adapt: { hypertension: { suffix: 'sin sal' } },
  },
  seeds: { id: 'seeds', name: 'semillas de chía o lino', p: 0.18, c: 0.08, f: 0.42, min: 10, max: 30 },
  peanutButter: {
    id: 'peanutButter',
    name: 'mantequilla de maní natural',
    p: 0.25,
    c: 0.2,
    f: 0.5,
    min: 10,
    max: 40,
    adapt: { hypertension: { suffix: 'sin sal agregada' } },
  },
} satisfies Record<string, Food>;

type FoodId = keyof typeof FOODS;

/** Tags each condition rules out, unless the food has an adapted version for it. */
const EXCLUDED_TAGS: Record<DietaryCondition, FoodTag[]> = {
  celiac: ['gluten'],
  lactose_intolerance: ['lactose'],
  diabetes: ['high_gi'],
  hypertension: ['high_sodium'],
  high_cholesterol: ['red_meat', 'egg_yolk'],
};

function allowed(food: Food, conditions: DietaryCondition[]): boolean {
  const tags = [...(food.tags ?? []), ...conditions.flatMap((condition) => food.adapt?.[condition]?.tags ?? [])];
  return conditions.every((condition) => {
    const blocked = tags.some((tag) => EXCLUDED_TAGS[condition].includes(tag));
    return !blocked || Boolean(food.adapt?.[condition]);
  });
}

function displayName(food: Food, conditions: DietaryCondition[]): string {
  let name = food.name;
  const suffixes: string[] = [];
  for (const condition of conditions) {
    const adapted = food.adapt?.[condition];
    if (adapted?.name) name = adapted.name;
    if (adapted?.suffix) suffixes.push(adapted.suffix);
  }
  return suffixes.length ? `${name} ${suffixes.join(', ')}` : name;
}

// ---------------------------------------------------------------------------
// Meal templates
// ---------------------------------------------------------------------------

type Macro = 'p' | 'c' | 'f';

interface Slot {
  /** Interchangeable foods for this slot (filtered by the athlete's conditions). */
  pool: FoodId[];
  /** Macro this slot fills with whatever the earlier slots left uncovered. */
  fills?: Macro;
  /** Fixed serving in grams (shake liquid) instead of a macro-driven amount. */
  fixed?: number;
  /** Optional slots are skipped when their macro is already covered or no food is allowed. */
  optional?: boolean;
}

interface Template {
  /** Dish name; a function names it after the foods actually picked (bread vs. tortillas). */
  dish?: string | ((picked: Set<string>) => string);
  /** Slots run in order: fixed items first, then carbs → protein → fat. */
  slots: Slot[];
  /** Extra free items shown as-is (vegetables). */
  extras?: string[];
}

const FRUIT: FoodId[] = ['banana', 'apple', 'pear', 'orange', 'berries'];
const MAIN_PROTEINS: FoodId[] = ['chicken', 'beef', 'pork', 'whiteFish', 'salmon', 'tuna', 'tofu'];
const MAIN_CARBS: FoodId[] = ['whiteRice', 'brownRice', 'pasta', 'potato', 'sweetPotato', 'quinoa', 'lentils', 'chickpeas', 'cornTortillas'];
const MAIN_FATS: FoodId[] = ['avocado', 'oliveOil', 'nuts', 'seeds'];

const toastBase = (picked: Set<string>) => (picked.has('cornTortillas') ? 'tortillas de maíz' : 'tostadas');
const eggName = (picked: Set<string>) => (picked.has('eggs') ? 'huevos' : 'claras');
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const BREAKFASTS: Template[] = [
  {
    dish: 'Avena con yogur',
    slots: [{ pool: ['oats'], fills: 'c' }, { pool: FRUIT, fills: 'c', optional: true }, { pool: ['greekYogurt'], fills: 'p' }, { pool: ['seeds', 'nuts'], fills: 'f', optional: true }],
  },
  {
    dish: (picked) => capitalize(`${toastBase(picked)} con ${eggName(picked)}`),
    slots: [{ pool: ['wholeBread', 'cornTortillas'], fills: 'c' }, { pool: FRUIT, fills: 'c', optional: true }, { pool: ['eggs', 'eggWhites'], fills: 'p' }, { pool: ['eggWhites'], fills: 'p', optional: true }, { pool: ['avocado'], fills: 'f', optional: true }],
  },
  {
    dish: 'Panqueques de avena',
    slots: [{ pool: ['oats'], fills: 'c' }, { pool: ['eggs', 'eggWhites'], fills: 'p' }, { pool: ['eggWhites'], fills: 'p', optional: true }, { pool: ['peanutButter', 'nuts'], fills: 'f', optional: true }, { pool: ['berries', 'apple'], fills: 'c', optional: true }],
  },
  {
    dish: 'Licuado de proteína',
    slots: [{ pool: ['milk', 'almondDrink'], fixed: 300 }, { pool: ['oats'], fills: 'c' }, { pool: FRUIT, fills: 'c', optional: true }, { pool: ['wheyProtein'], fills: 'p' }, { pool: ['peanutButter', 'seeds'], fills: 'f', optional: true }],
  },
  {
    dish: (picked) => capitalize(`${toastBase(picked)} con queso fresco`),
    slots: [{ pool: ['wholeBread', 'cornTortillas'], fills: 'c' }, { pool: FRUIT, fills: 'c', optional: true }, { pool: ['cottage'], fills: 'p' }, { pool: ['avocado', 'seeds'], fills: 'f', optional: true }],
  },
];

const SNACKS: Template[] = [
  {
    dish: 'Yogur con fruta y frutos secos',
    slots: [{ pool: FRUIT, fills: 'c' }, { pool: ['greekYogurt'], fills: 'p' }, { pool: ['nuts', 'seeds'], fills: 'f', optional: true }],
  },
  {
    dish: (picked) => capitalize(`${eggName(picked)} con ${toastBase(picked)}`),
    slots: [{ pool: ['wholeBread', 'cornTortillas'], fills: 'c' }, { pool: FRUIT, fills: 'c', optional: true }, { pool: ['eggs', 'eggWhites'], fills: 'p' }, { pool: ['eggWhites'], fills: 'p', optional: true }],
  },
  {
    dish: 'Batido de proteína',
    slots: [{ pool: ['milk', 'almondDrink'], fixed: 250 }, { pool: FRUIT, fills: 'c' }, { pool: ['wheyProtein'], fills: 'p' }],
  },
  {
    dish: 'Queso fresco con fruta',
    slots: [{ pool: FRUIT, fills: 'c' }, { pool: ['cottage'], fills: 'p' }, { pool: ['nuts'], fills: 'f', optional: true }],
  },
];

const PLATE: Template = {
  slots: [
    { pool: MAIN_CARBS, fills: 'c' },
    { pool: FRUIT, fills: 'c', optional: true },
    { pool: MAIN_PROTEINS, fills: 'p' },
    { pool: MAIN_FATS, fills: 'f', optional: true },
  ],
  extras: ['Verduras a gusto'],
};

/** Always-valid template: none of its foods carry a tag any condition rules out. */
const SAFE_TEMPLATE: Template = {
  slots: [{ pool: ['quinoa'], fills: 'c' }, { pool: ['apple'], fills: 'c', optional: true }, { pool: ['whiteFish'], fills: 'p' }, { pool: ['oliveOil'], fills: 'f', optional: true }],
};

// ---------------------------------------------------------------------------
// Deterministic daily seed
// ---------------------------------------------------------------------------

/** Local calendar day as YYYY-MM-DD: the menu changes at midnight, not in UTC. */
export function localDateKey(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** FNV-1a hash + mulberry32: tiny, fast and stable across platforms. */
function seededRandom(seed: string): () => number {
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(list: T[], random: () => number): T => list[Math.floor(random() * list.length)];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

/** Rounds servings to 10 g (5 g for small, dense foods like nuts or protein powder). */
const roundServing = (value: number, step: number) => Math.max(step, Math.round(value / step) * step);

interface Target {
  p: number;
  c: number;
  f: number;
}

interface Portion {
  food: Food;
  grams: number;
  label: string;
}

function portionLabel(food: Food, grams: number, conditions: DietaryCondition[], fixed: boolean): { grams: number; label: string } {
  const name = displayName(food, conditions);
  if (food.unit) {
    const count = Math.max(1, Math.round(grams / food.unit.grams));
    const unitName = food.adapt && conditions.some((condition) => food.adapt?.[condition]) ? name : count === 1 ? food.unit.singular : food.unit.plural;
    return { grams: count * food.unit.grams, label: `${count} ${unitName}` };
  }
  // Drinks carry their unit ("ml de ...") in the name.
  if (fixed) return { grams, label: `${grams} ${name}` };
  const rounded = roundServing(grams, (food.max ?? 400) <= 50 ? 5 : 10);
  return { grams: rounded, label: `${rounded} g de ${name}` };
}

/** Smallest uncovered amount (g) worth an optional extra item. */
const MIN_GAP: Target = { p: 5, c: 15, f: 4 };

/** Foods each condition favors: they count twice when picking. */
const PREFERRED: Partial<Record<DietaryCondition, FoodId[]>> = {
  diabetes: ['lentils', 'chickpeas', 'quinoa', 'brownRice'],
  high_cholesterol: ['whiteFish', 'salmon', 'oliveOil', 'nuts'],
};

/** Serving limits stretch with the calorie target: bigger plates for big bulks, smaller minimums for small cuts. */
interface Bounds {
  min: number;
  max: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function planMeal(
  template: Template,
  target: Target,
  conditions: DietaryCondition[],
  random: () => number,
  bounds: Bounds,
  avoid: { family?: string; foods: Set<string> } = { foods: new Set() }
): { portions: Portion[]; extras: string[] } | null {
  const covered: Target = { p: 0, c: 0, f: 0 };
  const portions: Portion[] = [];
  const preferred = new Set(conditions.flatMap((condition) => PREFERRED[condition] ?? []));

  for (const slot of template.slots) {
    const options = slot.pool
      .flatMap((id) => (preferred.has(id) ? [id, id] : [id]))
      .map((id) => FOODS[id] as Food)
      // A food shows up once per meal (an egg-white complement never repeats the egg whites).
      .filter((food) => allowed(food, conditions) && !portions.some((portion) => portion.food.id === food.id));
    if (options.length === 0) {
      if (slot.optional) continue;
      return null;
    }
    // Soft variety: skip the previous main protein family and foods already eaten today, unless nothing else fits.
    const newFamily = avoid.family ? options.filter((food) => food.family !== avoid.family) : options;
    const unseen = newFamily.filter((food) => !avoid.foods.has(food.id));
    const food = pick(unseen.length ? unseen : newFamily.length ? newFamily : options, random);

    let grams: number;
    if (slot.fixed !== undefined) {
      grams = food.unit ? slot.fixed * food.unit.grams : slot.fixed;
    } else {
      const macro = slot.fills ?? 'c';
      const remaining = target[macro] - covered[macro];
      // Optional extras only when there is a meaningful gap left.
      if (slot.optional && remaining < MIN_GAP[macro]) continue;
      grams = Math.max(0, remaining) / food[macro];
      grams = Math.min((food.max ?? 400) * bounds.max, Math.max((food.min ?? 30) * bounds.min, grams));
    }

    const { grams: served, label } = portionLabel(food, grams, conditions, slot.fixed !== undefined);
    covered.p += food.p * served;
    covered.c += food.c * served;
    covered.f += food.f * served;
    portions.push({ food, grams: served, label });
  }
  return { portions, extras: template.extras ?? [] };
}

export interface MealPlanOptions {
  /** Dietary health conditions from the athlete's profile. */
  conditions?: DietaryCondition[];
  /** Day to plan for (defaults to today); the same local day always gives the same menu. */
  date?: Date | string;
}

/** Share of the day's macros for each meal. */
const MEALS: { name: string; share: number; templates: Template[] }[] = [
  { name: 'Desayuno', share: 0.25, templates: BREAKFASTS },
  { name: 'Almuerzo', share: 0.35, templates: [PLATE] },
  { name: 'Merienda', share: 0.15, templates: SNACKS },
  { name: 'Cena', share: 0.25, templates: [PLATE] },
];

/**
 * A varied day of eating that lands close to the athlete's macros. Foods rotate
 * daily (seeded by the local date) and respect the athlete's dietary conditions.
 */
export function buildMealPlan(plan: NutritionMetrics, options: MealPlanOptions = {}): MealPlanItem[] {
  const conditions = [...new Set(options.conditions ?? [])];
  const dateKey = typeof options.date === 'string' ? options.date : localDateKey(options.date);
  const random = seededRandom(`${dateKey}|${[...conditions].sort().join(',')}`);
  const bounds: Bounds = { min: clamp(plan.targetCalories / 2400, 0.5, 1), max: clamp(plan.targetCalories / 2800, 1, 1.6) };
  let lastFamily: string | undefined;
  const eaten = new Set<string>();

  return MEALS.map((meal) => {
    const target: Target = { p: plan.proteinGrams * meal.share, c: plan.carbGrams * meal.share, f: plan.fatGrams * meal.share };
    let template = pick(meal.templates, random);
    let planned = planMeal(template, target, conditions, random, bounds, { family: lastFamily, foods: eaten });
    if (!planned) {
      template = SAFE_TEMPLATE;
      planned = planMeal(SAFE_TEMPLATE, target, conditions, random, bounds)!;
    }
    const main = planned.portions.find((portion) => portion.food.family);
    if (main) lastFamily = main.food.family;
    const picked = new Set(planned.portions.map((portion) => portion.food.id));
    picked.forEach((id) => eaten.add(id));
    const dish = typeof template.dish === 'function' ? template.dish(picked) : template.dish;

    const totals = planned.portions.reduce(
      (sum, { food, grams }) => ({ p: sum.p + food.p * grams, c: sum.c + food.c * grams, f: sum.f + food.f * grams }),
      { p: 0, c: 0, f: 0 }
    );
    let extras = planned.extras;
    if (conditions.includes('hypertension')) {
      extras = extras.length
        ? extras.map((item) => `${item}, sin sal agregada (condimenta con limón, ajo o hierbas)`)
        : planned.portions.some((portion) => portion.food.family)
          ? ['Cocina sin sal agregada']
          : [];
    }
    return {
      name: dish ? `${meal.name} · ${dish}` : meal.name,
      kcal: Math.round(totals.p * 4 + totals.c * 4 + totals.f * 9),
      proteinGrams: Math.round(totals.p),
      items: [...planned.portions.map((portion) => portion.label), ...extras],
    };
  });
}
