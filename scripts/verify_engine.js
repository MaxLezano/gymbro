/**
 * Verification suite for GymBro's pure domain logic (no device needed).
 *
 * Loads the app's real TypeScript sources by transpiling them on the fly with
 * the project's own `typescript` devDependency, so there is nothing extra to
 * install. React Native-only modules are stubbed because the engine never
 * touches them.
 *
 * Run: npm run verify
 */
const fs = require('fs');
const path = require('path');
const Module = require('module');
const ts = require('typescript');

// --- TypeScript loader -------------------------------------------------------
for (const ext of ['.ts', '.tsx']) {
  require.extensions[ext] = (module, filename) => {
    const source = fs.readFileSync(filename, 'utf8');
    const { outputText } = ts.transpileModule(source, {
      fileName: filename,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        resolveJsonModule: true,
      },
    });
    module._compile(outputText, filename);
  };
}

// In-memory AsyncStorage so account/storage logic can be exercised for real.
const memory = new Map();
const asyncStorage = {
  getItem: async (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: async (key, value) => void memory.set(key, value),
  removeItem: async (key) => void memory.delete(key),
  multiGet: async (keys) => keys.map((key) => [key, memory.has(key) ? memory.get(key) : null]),
  multiSet: async (pairs) => pairs.forEach(([key, value]) => memory.set(key, value)),
  multiRemove: async (keys) => keys.forEach((key) => memory.delete(key)),
};
// __esModule: transpiled `import X from` must receive the default export as-is.
const STUBS = {
  '@react-native-async-storage/async-storage': { __esModule: true, default: asyncStorage },
  'expo-localization': { __esModule: true, getLocales: () => [{ languageCode: 'es', languageTag: 'es-AR' }] },
};
const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (STUBS[request]) return STUBS[request];
  return originalLoad.call(this, request, parent, isMain);
};

const src = (file) => require(path.join(__dirname, '..', 'src', file));

// --- Tiny test harness -------------------------------------------------------
let passed = 0;
const failures = [];
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}
async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    failures.push(name);
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const near = (actual, expected, tolerance, label) =>
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ~${expected}, got ${actual}`);

// --- Modules under test ------------------------------------------------------
const { calculateNutritionPlan, calculateBodyFatNavy } = src('core/utils/nutrition.ts');
const { getExercises, getExercise } = src('data/catalog.ts');
const EXERCISES = getExercises();
const { estimateOneRepMax, parseTargetReps, weekStreak, pluralize, suggestLoad, formatRest } = src('core/utils/workout.ts');
const { fitsHomeEquipment, requiredHomeEquipment } = src('core/utils/equipment.ts');
const { generateRoutine, FOCUS_LABELS } = src('core/utils/programGenerator.ts');
const { SEED_ROUTINES, Accounts, Storage } = src('storage/index.ts');
const { parseQuery, isOffTopic, unknownExerciseName } = src('core/services/coach/intents.ts');
const { extractJson, normalizeBlocks, isProviderNotice } = src('core/services/coach/onlineClient.ts');
const { buildMealPlan } = src('core/services/coach/offlineEngine.ts');
const { mergeCollection, mergeProfile, trackDeletions, pruneTombstones, TOMBSTONE_TTL_MS } = src('core/services/cloud/merge.ts');
const { parseVoiceCommand } = src('core/services/voice/commands.ts');

console.log('\n1. Exercise dataset');
test('1324 exercises with unique ids', () => {
  assert(EXERCISES.length === 1324, `got ${EXERCISES.length}`);
  assert(new Set(EXERCISES.map((e) => e.id)).size === EXERCISES.length, 'duplicate ids');
});
test('every exercise has media and instructions', () => {
  const missing = EXERCISES.filter((e) => !e.gifUrl || !e.thumbnailUrl || e.instructions.length === 0);
  assert(missing.length === 0, `${missing.length} incomplete, e.g. ${missing[0]?.id}`);
});
test('English fallback names are title-cased', () => {
  const { formatExerciseName } = src('core/i18n/labels.ts');
  assert(formatExerciseName(getExercise('0289').name) === 'Dumbbell Bench Press', formatExerciseName(getExercise('0289').name));
});

console.log('\n2. Nutrition engine (Mifflin-St Jeor, Navy, macros)');
const profileForPlan = { gender: 'male', weightKg: 78, heightCm: 178, age: 26, activityLevel: 'moderate', fitnessGoal: 'muscle_gain' };
const plan = calculateNutritionPlan(profileForPlan);
test('BMR 1768 / TDEE 2740 / target 2990 kcal', () => {
  near(plan.bmr, 1768, 1, 'BMR');
  near(plan.tdee, 2740, 2, 'TDEE');
  near(plan.targetCalories, 2990, 2, 'target');
});
test('macros: 2.0 g/kg protein, 0.9 g/kg fat, carbs fill the rest', () => {
  assert(plan.proteinGrams === 156 && plan.fatGrams === 70, `${plan.proteinGrams}/${plan.fatGrams}`);
  near(plan.proteinGrams * 4 + plan.fatGrams * 9 + plan.carbGrams * 4, plan.targetCalories, 4, 'kcal from macros');
});
test('U.S. Navy body fat in a plausible range', () => {
  const bf = calculateBodyFatNavy('male', 178, 82, 38);
  assert(bf > 10 && bf < 20, `got ${bf}`);
  assert(calculateBodyFatNavy('female', 165, 72, 34) === null, 'female requires hip');
});

console.log('\n3. Training math');
test('1RM: single = weight, Brzycki <= 10 reps, Epley above', () => {
  assert(estimateOneRepMax(100, 1) === 100, 'single');
  near(estimateOneRepMax(100, 5), 112.5, 0.1, 'Brzycki 5');
  near(estimateOneRepMax(100, 12), 140, 0.1, 'Epley 12');
  assert(estimateOneRepMax(0, 10) === 0, 'bodyweight 0');
});
test('target reps parsing', () => {
  assert(parseTargetReps('8-12') === 10 && parseTargetReps('20') === 20 && parseTargetReps('Al fallo') === 10, 'parse');
});
test('Spanish pluralization', () => assert(pluralize(1, 'serie') === '1 serie' && pluralize(3, 'serie') === '3 series', 'plural'));
test('rest labels', () => assert(formatRest(120) === '2 min' && formatRest(90) === '1 min 30 s' && formatRest(45) === '45 s', 'rest'));
test('double progression: top of range -> add the smallest step', () => {
  const s = suggestLoad({ equipment: 'barbell', targetReps: '6-10', last: { weightKg: 60, reps: 10 } });
  assert(s.kind === 'up' && s.weightKg === 62.5, JSON.stringify(s));
  assert(suggestLoad({ equipment: 'dumbbell', targetReps: '10-12', last: { weightKg: 14, reps: 12 } }).weightKg === 16, 'dumbbells +2');
});
test('double progression: inside the range keeps the load, below it goes lighter', () => {
  assert(suggestLoad({ equipment: 'barbell', targetReps: '6-10', last: { weightKg: 60, reps: 8 } }).weightKg === 60, 'repeat');
  const down = suggestLoad({ equipment: 'barbell', targetReps: '6-10', last: { weightKg: 60, reps: 4 } });
  assert(down.kind === 'down' && down.weightKg === 55, JSON.stringify(down));
});
test('no history: bodyweight, 1RM estimate or first-time guidance', () => {
  assert(suggestLoad({ equipment: 'body weight', targetReps: '8-12' }).kind === 'bodyweight', 'bodyweight');
  assert(suggestLoad({ equipment: 'barbell', targetReps: '8', oneRepMax: 100 }).weightKg === 80, 'inverse Brzycki 8 reps ~ 80%');
  const first = suggestLoad({ equipment: 'cable', targetReps: '10-12' });
  assert(first.kind === 'first' && first.weightKg === null, 'first time');
});
test('week streak counts consecutive weeks', () => {
  const now = new Date('2026-09-24T12:00:00').getTime();
  const day = 86_400_000;
  const session = (t) => ({ startedAt: t, completedAt: t, exercises: [] });
  assert(weekStreak([session(now), session(now - 7 * day), session(now - 21 * day)], now) === 2, 'streak');
});

console.log('\n4. Equipment compatibility');
test('pull-ups need a bar, push-ups do not, cables are gym-only', () => {
  assert(!fitsHomeEquipment(getExercise('0652'), ['body_weight']), 'pull-up without bar');
  assert(fitsHomeEquipment(getExercise('0652'), ['body_weight', 'pullup_bar']), 'pull-up with bar');
  assert(fitsHomeEquipment(getExercise('0662'), ['body_weight']), 'push-up');
  assert(requiredHomeEquipment(getExercise('0861')) === null, 'cable row');
  assert(!fitsHomeEquipment(getExercise('0289'), ['body_weight', 'dumbbells']), 'db bench needs a bench');
});

console.log('\n5. Program generator');
test('every focus builds a valid routine at home with bodyweight only', () => {
  const profile = { trainingLocation: 'home', homeEquipment: ['body_weight'], fitnessGoal: 'muscle_gain', experience: 'intermediate' };
  for (const focus of Object.keys(FOCUS_LABELS)) {
    const routine = generateRoutine({ focus, profile });
    assert(routine.exercises.length >= 2, `${focus}: only ${routine.exercises.length} exercises`);
    for (const item of routine.exercises) {
      const exercise = getExercise(item.exerciseId);
      assert(exercise, `${focus}: unknown id ${item.exerciseId}`);
      assert(fitsHomeEquipment(exercise, profile.homeEquipment), `${focus}: ${exercise.name} needs equipment`);
    }
  }
});
test('no duplicated exercises inside a routine', () => {
  const routine = generateRoutine({ focus: 'cardio', profile: { trainingLocation: 'gym', homeEquipment: [], fitnessGoal: 'fat_loss', experience: 'advanced' } });
  const ids = routine.exercises.map((item) => item.exerciseId);
  assert(new Set(ids).size === ids.length, 'duplicates');
});
test('priority muscles add extra work on the days that train them', () => {
  const base = { trainingLocation: 'gym', homeEquipment: [], fitnessGoal: 'muscle_gain', experience: 'advanced' };
  const targetsOf = (focusMuscles) =>
    generateRoutine({ focus: 'lower', profile: { ...base, focusMuscles }, maxExercises: 8 }).exercises.map((item) => getExercise(item.exerciseId).target);
  const count = (list, target) => list.filter((item) => item === target).length;
  const balanced = targetsOf([]);
  const both = targetsOf(['glutes', 'core']);
  assert(count(both, 'glutes') > count(balanced, 'glutes') && count(both, 'abs') > count(balanced, 'abs'), `${balanced} | ${both}`);
  const upper = generateRoutine({ focus: 'upper', profile: { ...base, focusMuscles: ['glutes'] } }).exercises;
  assert(!upper.some((item) => getExercise(item.exerciseId).target === 'glutes'), 'glutes on an upper day');
});
test('old single priority migrates to the list', () => {
  const { migrateProfile } = src('storage/index.ts');
  assert(migrateProfile({ focusMuscle: 'legs' }).focusMuscles.join() === 'legs', 'legs');
  assert(migrateProfile({ focusMuscle: 'balanced' }).focusMuscles.length === 0, 'balanced');
  assert(migrateProfile({ focusMuscle: 'legs', focusMuscles: ['arms', 'core'] }).focusMuscles.join() === 'arms,core', 'new wins');
});
test('recomposition eats at maintenance with high protein', () => {
  const recomp = calculateNutritionPlan({ ...profileForPlan, fitnessGoal: 'maintenance' });
  assert(recomp.targetCalories === recomp.tdee && recomp.proteinGrams === Math.round(profileForPlan.weightKg * 2.2), JSON.stringify(recomp));
});
test('seed routines reference real exercises', () => {
  for (const routine of SEED_ROUTINES) {
    for (const item of routine.exercises) assert(getExercise(item.exerciseId), `${routine.id}: ${item.exerciseId}`);
  }
});

console.log('\n6. AI coach plumbing');
test('intent parsing', () => {
  assert(parseQuery('Armame una rutina de pecho en casa de 30 minutos').intent === 'routine', 'routine');
  assert(parseQuery('Armame una rutina de pecho en casa').focus === 'chest', 'focus');
  assert(parseQuery('Armame una rutina en casa').location === 'home', 'location');
  assert(parseQuery('¿Qué como antes de entrenar?').intent === 'nutrition', 'nutrition');
  assert(parseQuery('¿Cómo mejoro mi press de banca?').exerciseId === '0025', 'exercise alias');
});
test('equipment named in a routine request is parsed, exercise names are not', () => {
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  assert(same(parseQuery('Armame una rutina de espalda con mancuernas').equipment, ['dumbbells']), 'dumbbells');
  assert(same(parseQuery('rutina de piernas sin equipo').equipment, ['body_weight']), 'bodyweight');
  assert(same(parseQuery('rutina con barra de dominadas').equipment, ['pullup_bar']), 'pull-up bar is not a barbell');
  assert(parseQuery('¿Cómo hago el remo con mancuerna?').equipment === undefined, 'exercise name kept as exercise');
  assert(parseQuery('Armame una rutina de pecho').equipment === undefined, 'profile kit kept');
});
test('off-topic questions are refused, fitness ones are not', () => {
  const blocked = ['Que sabes de las islas malvinas?', 'quién ganó el mundial 2022', 'escribime un poema de amor', 'cuál es la capital de Francia', 'resolveme esta ecuación 2x+3=7'];
  const allowed = ['hola', 'gracias!', 'cómo bajo la panza', 'qué como antes de entrenar', 'me duele la rodilla al hacer sentadilla', 'cuántas veces por semana entreno', 'dormí mal, entreno igual?', 'qué puedes hacer', 'armame una rutina', 'cómo uso la app', 'Dame consejos de técnica y progresión para Archer Push Up', 'Por qué no me puedes responder lo que te pregunto'];
  const wrongBlocked = blocked.filter((text) => !isOffTopic(text));
  const wrongAllowed = allowed.filter((text) => isOffTopic(text));
  assert(wrongBlocked.length === 0 && wrongAllowed.length === 0, `not blocked: ${wrongBlocked} | wrongly blocked: ${wrongAllowed}`);
});
test('made-up exercise names are caught, real ones are not', () => {
  assert(unknownExerciseName('la técnica de entrenamiento del mono colgado de la cola la') === 'mono colgado de la cola la', String(unknownExerciseName('la técnica de entrenamiento del mono colgado de la cola la')));
  const real = ['cómo hago bien el press militar', 'técnica de la sentadilla búlgara', 'cómo se hace el paseo del granjero', 'Dame consejos de técnica y progresión para Barbell Decline Pullover', 'técnica del face pull', 'qué como después de entrenar'];
  const flagged = real.filter((text) => unknownExerciseName(text));
  assert(flagged.length === 0, `wrongly flagged: ${flagged}`);
});
test('tolerant JSON extraction (real malformed output seen in production)', () => {
  assert(extractJson('{"{"text":"hola","blocks":[]}').text === 'hola', 'stray brace');
  assert(extractJson('```json\n{"text":"x"}\n```').text === 'x', 'fenced');
  assert(extractJson('{"text":"solo texto","blocks":[{"type":"meals"').text === 'solo texto', 'truncated');
  assert(extractJson('sin json') === null, 'plain');
});
test('model blocks are validated against the catalog', () => {
  const blocks = normalizeBlocks(
    [
      { type: 'routine', title: 'X', exercises: [{ id: '0289', sets: 99, reps: '8-12', rest: 5 }, { id: '9999' }, { id: '0662' }] },
      { type: 'exercises', ids: ['0025', 'nope'] },
      { type: 'unknown' },
    ],
    'gym'
  );
  assert(blocks.length === 2, `got ${blocks.length} blocks`);
  const routine = blocks[0].routine;
  assert(routine.exercises.length === 2, 'unknown id dropped');
  assert(routine.exercises[0].targetSets === 8 && routine.exercises[0].restSeconds === 20, 'values clamped');
  assert(blocks[1].exerciseIds.length === 1, 'invalid exercise id dropped');
});
test('offline meal plan lands within 15% of the protein target', () => {
  const protein = buildMealPlan(plan).reduce((sum, meal) => sum + (meal.proteinGrams ?? 0), 0);
  near(protein, plan.proteinGrams, plan.proteinGrams * 0.15, 'protein');
});
const menuOf = (date, conditions) => JSON.stringify(buildMealPlan(plan, { date, conditions }));
const DAYS = Array.from({ length: 30 }, (_, i) => new Date(2026, 0, 1 + i));
test('meal plan: same day is stable, different days vary', () => {
  assert(menuOf('2026-03-10') === menuOf('2026-03-10'), 'same date differs');
  assert(menuOf(new Date(2026, 2, 10, 8)) === menuOf(new Date(2026, 2, 10, 22)), 'same local day differs by hour');
  const distinct = new Set(DAYS.slice(0, 7).map((day) => menuOf(day)));
  assert(distinct.size >= 6, `only ${distinct.size} distinct menus in a week`);
});
test('meal plan: swapping one meal changes only that meal, and stays stable', () => {
  const base = buildMealPlan(plan, { date: '2026-03-10' });
  const swapped = buildMealPlan(plan, { date: '2026-03-10', swaps: { 1: 1 } });
  assert(JSON.stringify(swapped) === JSON.stringify(buildMealPlan(plan, { date: '2026-03-10', swaps: { 1: 1 } })), 'swap not stable');
  assert(JSON.stringify(swapped[1]) !== JSON.stringify(base[1]), 'lunch did not change');
  [0, 2, 3].forEach((index) => assert(JSON.stringify(swapped[index]) === JSON.stringify(base[index]), `meal ${index} changed`));
  // Every swap gives a new option for a while, not the same two alternating.
  const lunches = new Set([0, 1, 2, 3].map((n) => buildMealPlan(plan, { date: '2026-03-10', swaps: { 1: n } })[1].name));
  assert(lunches.size >= 3, `only ${lunches.size} distinct lunches in 4 swaps`);
});
test('meal plan: another snack does not repeat the breakfast foods when it can avoid it', () => {
  const mains = /huevo|clara|pan integral|tortillas|yogur|queso|proteína en polvo|avena/;
  const foodsOf = (meal) => new Set(meal.items.filter((item) => mains.test(item)).map((item) => item.replace(/^[\d\s]+(g de |ml de )?/, '')));
  for (const day of DAYS.slice(0, 10)) {
    const breakfast = foodsOf(buildMealPlan(plan, { date: day })[0]);
    const snack = foodsOf(buildMealPlan(plan, { date: day, swaps: { 2: 1 } })[2]);
    const shared = [...snack].filter((food) => breakfast.has(food));
    assert(shared.length === 0, `${day.toDateString()}: snack repeats ${shared}`);
  }
});
test('meal plan: cooks with what is at home, and says when it cannot', () => {
  const meals = buildMealPlan(plan, { date: '2026-03-10', pantry: ['chicken', 'whiteRice'] });
  const plates = [meals[1], meals[3]];
  assert(plates.every((meal) => meal.fromPantry && meal.name.includes('Arroz blanco con pechuga de pollo a la plancha')), plates.map((m) => m.name).join(' / '));
  assert(meals[0].fromPantry === false, 'breakfast cannot be made from chicken and rice');
  assert(buildMealPlan(plan, { date: '2026-03-10' })[0].fromPantry === undefined, 'no pantry, no flag');
  // "Another option" with a small pantry keeps the only dish it can make instead of leaving the pantry.
  const pantry = ['chicken', 'whiteRice', 'eggs', 'wholeBread'];
  const swappedSnack = buildMealPlan(plan, { date: '2026-03-10', pantry, swaps: { 2: 1 } })[2];
  assert(swappedSnack.fromPantry === true, `snack left the pantry: ${swappedSnack.name}`);
});
test('meal plan: lunch and dinner are named after the plate', () => {
  const meals = buildMealPlan(plan, { date: '2026-03-10' });
  assert(/^Almuerzo · .+ con .+/.test(meals[1].name) && /^Cena · .+ con .+/.test(meals[3].name), `${meals[1].name} / ${meals[3].name}`);
});
test('meal plan: lunch and dinner never share the main protein', () => {
  const MAINS = /pollo|vacuna|cerdo|pescado|salmón|atún|tofu/;
  for (const day of DAYS) {
    const meals = buildMealPlan(plan, { date: day });
    const main = (meal) => meal.items.find((item) => MAINS.test(item)).match(MAINS)[0].replace('salmón', 'pescado');
    assert(main(meals[1]) !== main(meals[3]), `${day.toDateString()}: ${main(meals[1])}`);
  }
});
test('meal plan stays close to protein and calories every day (large and small athletes)', () => {
  const small = calculateNutritionPlan({ gender: 'female', weightKg: 55, heightCm: 160, age: 35, activityLevel: 'light', fitnessGoal: 'fat_loss' });
  for (const [target, kcalTolerance] of [[plan, 0.15], [small, 0.2]]) {
    for (const day of DAYS) {
      const meals = buildMealPlan(target, { date: day });
      const sum = (key) => meals.reduce((total, meal) => total + meal[key], 0);
      near(sum('proteinGrams'), target.proteinGrams, target.proteinGrams * 0.15, `protein ${day.toDateString()}`);
      near(sum('kcal'), target.targetCalories, target.targetCalories * kcalTolerance, `kcal ${target.targetCalories} ${day.toDateString()}`);
    }
  }
});
const FORBIDDEN = {
  celiac: /pan integral|fideos de trigo|\bavena\b(?! certificada sin TACC)|trigo/i,
  lactose_intolerance: /yogur griego natural|leche descremada(?! deslactosada)|queso cottage|proteína en polvo(?! aislada sin lactosa)/i,
  diabetes: /banana|arroz blanco|papa hervida|jugo|pan blanco/i,
  hypertension: /atún en lata|embutido|jamón|queso duro/i,
  high_cholesterol: /carne vacuna|manteca|mantequilla(?! de maní)|(^|\| )\d+ huevos?\b/i,
};
const CONDITIONS = Object.keys(FORBIDDEN);
const combos = Array.from({ length: 1 << CONDITIONS.length }, (_, mask) => CONDITIONS.filter((_, i) => mask & (1 << i)));
test('meal plan respects every combination of dietary conditions', () => {
  for (const conditions of combos) {
    for (const day of DAYS.slice(0, 10)) {
      const meals = buildMealPlan(plan, { date: day, conditions });
      assert(meals.length === 4 && meals.every((meal) => meal.items.length >= 2), `empty meal for ${conditions}`);
      const text = meals.flatMap((meal) => meal.items).join(' | ');
      for (const condition of conditions) assert(!FORBIDDEN[condition].test(text), `${condition} in [${conditions}]: ${text}`);
      if (conditions.includes('hypertension')) assert(/sin sal agregada/.test(text), 'no salt note');
    }
  }
});
test('dietary conditions reach the coach and old profiles get none', () => {
  const { migrateProfile } = src('storage/index.ts');
  assert(migrateProfile({}).dietaryConditions.length === 0, 'missing field');
  assert(migrateProfile({ dietaryConditions: ['celiac'] }).dietaryConditions.join() === 'celiac', 'kept');
  const { offlineReply } = src('core/services/coach/offlineEngine.ts');
  const { describeAthlete } = src('core/services/coach/context.ts');
  const profile = { ...migrateProfile({ ...profileForPlan }), dietaryConditions: ['celiac', 'diabetes'] };
  const reply = offlineReply({ intent: 'nutrition' }, { profile, plan, history: [] });
  assert(/no reemplazan/.test(reply.text) && /celiaquía/.test(reply.text), reply.text);
  assert(!/no reemplazan/.test(offlineReply({ intent: 'nutrition' }, { profile: { ...profile, dietaryConditions: [] }, plan, history: [] }).text), 'disclaimer without conditions');
  assert(/Celiaquía/.test(describeAthlete({ profile, plan, history: [] })), 'context');
});
test('celiac + diabetes drops high-GI gluten-free pasta and bread', () => {
  for (const day of DAYS) {
    const text = buildMealPlan(plan, { date: day, conditions: ['celiac', 'diabetes'] }).flatMap((meal) => meal.items).join(' | ');
    assert(!/fideos sin TACC|pan sin TACC/.test(text), text);
  }
  const celiacOnly = DAYS.map((day) => buildMealPlan(plan, { date: day, conditions: ['celiac'] }).flatMap((meal) => meal.items).join(' | ')).join(' | ');
  assert(/sin TACC/.test(celiacOnly), 'celiac alone keeps gluten-free options');
});
test('dish names match the foods picked and lunch/dinner vary their carb', () => {
  for (const conditions of [[], ['celiac', 'diabetes']]) {
    for (const day of DAYS) {
      const meals = buildMealPlan(plan, { date: day, conditions });
      for (const meal of meals) {
        const items = meal.items.join(' | ');
        if (/Tostadas/.test(meal.name)) assert(/pan/.test(items), `${meal.name}: ${items}`);
        if (/[Tt]ortillas/.test(meal.name)) assert(/tortillas/.test(items), `${meal.name}: ${items}`);
      }
      if (conditions.length === 0) {
        const carb = (meal) => meal.items[0].replace(/^\d+ (g de )?/, '');
        assert(carb(meals[1]) !== carb(meals[3]), `same carb ${day.toDateString()}: ${carb(meals[1])}`);
      }
    }
  }
});
test('calorie targets under 1500 kcal always warn', () => {
  const { offlineReply } = src('core/services/coach/offlineEngine.ts');
  const { migrateProfile } = src('storage/index.ts');
  const profile = migrateProfile({ ...profileForPlan });
  assert(!/Atención/.test(offlineReply({ intent: 'nutrition' }, { profile, plan, history: [] }).text), 'normal plan warned');
  const tiny = { ...plan, targetCalories: 1100, proteinGrams: 90, carbGrams: 100, fatGrams: 35 };
  assert(/Atención.*muy baja/.test(offlineReply({ intent: 'nutrition' }, { profile, plan: tiny, history: [] }).text), 'tiny plan not warned');
});

test('Spanish search terms find the classic lifts', () => {
  const search = (query) => {
    const terms = query.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/\s+/);
    return EXERCISES.filter((exercise) => terms.every((term) => exercise.searchText.includes(term)));
  };
  const expect = { sentadilla: /squat/i, 'press de banca': /bench press/i, dominadas: /pull.?up|chin.?up/i, 'peso muerto': /deadlift/i, remo: /row/i };
  for (const [query, pattern] of Object.entries(expect)) {
    const found = search(query);
    assert(found.length > 0 && found.some((exercise) => pattern.test(exercise.name)), `${query}: ${found.length}`);
  }
});
test('i18n: every locale has the same catalog keys and every exercise has a Spanish name', () => {
  const flatKeys = (value, prefix = '') =>
    typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => flatKeys(child, `${prefix}${key}.`)) : [prefix];
  const es = flatKeys(require('../src/core/i18n/locales/es/catalog.json')).sort();
  const en = flatKeys(require('../src/core/i18n/locales/en/catalog.json')).sort();
  const onlyEs = es.filter((key) => !en.includes(key));
  const onlyEn = en.filter((key) => !es.includes(key));
  assert(onlyEs.length === 0 && onlyEn.length === 0, `only es: ${onlyEs.slice(0, 5)} | only en: ${onlyEn.slice(0, 5)}`);
  const names = require('../src/core/i18n/locales/es/exercises.json');
  const missing = EXERCISES.filter((exercise) => !names[exercise.id]);
  assert(missing.length === 0, `missing Spanish names: ${missing.slice(0, 5).map((e) => e.id)}`);
  assert(getExercise('0043').displayName === names['0043'], 'catalog uses the translation');
});
test('saved sessions show exercise names in the current language', () => {
  const { logDisplayName } = src('core/utils/workout.ts');
  const names = require('../src/core/i18n/locales/es/exercises.json');
  assert(logDisplayName({ exerciseId: '0043', exerciseName: 'Barbell Full Squat' }) === names['0043'], 'old English name');
  assert(logDisplayName({ exerciseId: 'custom_1', exerciseName: 'Mi ejercicio' }) === 'Mi ejercicio', 'custom exercise');
});
test('every suggestion the coach offers is answered, never refused as off-topic', () => {
  const { offlineReply } = src('core/services/coach/offlineEngine.ts');
  const { migrateProfile } = src('storage/index.ts');
  const context = { profile: migrateProfile({ ...profileForPlan }), plan, history: [] };
  const offered = new Set(['Armame una rutina para hoy', 'Armame un menú de un día que cumpla mis macros', '¿Cómo progreso en mis ejercicios?',
    '¿Cómo está mi composición corporal?', 'Dame ejercicios de espalda para hacer en casa', '¿Cómo hago bien la sentadilla?',
    'Armame una rutina de 30 minutos', '¿Cómo mejoro mi press de banca?', '¿Qué como antes de entrenar?']);
  for (const intent of ['routine', 'exercise', 'exercises', 'nutrition', 'body', 'progress', 'general']) {
    for (const location of ['home', 'gym']) {
      try {
        offlineReply({ intent, location, exerciseId: '0043' }, context).suggestions.forEach((s) => offered.add(s));
      } catch {
        // intents that need more query fields are covered by others
      }
    }
  }
  const refused = [...offered].filter((prompt) => isOffTopic(prompt, parseQuery(prompt), true));
  assert(refused.length === 0, `refused: ${refused.join(' | ')}`);
});
test('"hazla más corta" asks for a shorter routine even without the model', () => {
  const short = parseQuery('Hazla más corta');
  assert(short.intent === 'routine' && short.minutes <= 30, JSON.stringify(short));
  const long = parseQuery('hazla más larga');
  assert(long.intent === 'routine' && long.minutes >= 60, JSON.stringify(long));
});
test('provider billing notices never reach the chat as a coach answer', () => {
  const notice = "The account behind this API key doesn't have enough credits. Please [top up](https://enter.pollinations.ai/top-up), then try again.";
  assert(isProviderNotice(notice, 57) && isProviderNotice("Hola", 0), "notice not detected");
  assert(!isProviderNotice('{"text":"Sube de peso cuando completes el rango."}', 120), "real answer flagged");
  assert(!isProviderNotice("Para ganar fuerza entrena cerca del fallo y descansa bien entre series.", 80), "plain answer flagged");
});
test('first-time loads never go below an empty barbell', () => {
  const { startingWeight } = src('core/utils/workout.ts');
  assert(startingWeight('barbell') === 20 && startingWeight('olympic barbell') === 20, 'barbell');
  assert(startingWeight('body weight') === 0 && startingWeight('band') === 0, 'no load');
  assert(startingWeight('dumbbell') > 0 && startingWeight('cable') > 0, 'free weights');
});

console.log('\n7. Voice commands');
const cmd = (text) => JSON.stringify(parseVoiceCommand(text));
test('"terminé" with or without the wake word', () => {
  assert(cmd('GymBro terminé') === '{"type":"done"}', cmd('GymBro terminé'));
  assert(cmd('listo') === '{"type":"done"}' && cmd('gym bro ya está') === '{"type":"done"}', 'listo / ya está');
});
test('reps and load from the phrase', () => {
  assert(cmd('hice 8') === '{"type":"done","reps":8}', cmd('hice 8'));
  assert(cmd('8 con 22,5') === '{"type":"done","reps":8,"weightKg":22.5}', cmd('8 con 22,5'));
  assert(cmd('terminé diez repeticiones con 20 kilos') === '{"type":"done","reps":10,"weightKg":20}', cmd('terminé diez repeticiones con 20 kilos'));
  assert(cmd('listo 22 y medio kilos') === '{"type":"done","weightKg":22.5}', cmd('listo 22 y medio kilos'));
});
test('rest control: skip, more time, start, repeat', () => {
  assert(cmd('siguiente') === '{"type":"skip"}', cmd('siguiente'));
  assert(cmd('más tiempo') === '{"type":"moreRest","seconds":15}', cmd('más tiempo'));
  assert(cmd('30 segundos más') === '{"type":"moreRest","seconds":30}', cmd('30 segundos más'));
  assert(cmd('un minuto más') === '{"type":"moreRest","seconds":60}', cmd('un minuto más'));
  assert(cmd('GymBro vamos') === '{"type":"start"}', cmd('GymBro vamos'));
  assert(cmd('qué toca') === '{"type":"repeat"}', cmd('qué toca'));
});
test('unrelated talk is ignored', () => {
  assert(parseVoiceCommand('hola cómo andás') === null && parseVoiceCommand('') === null, 'null');
});

console.log('\n8. Cloud backup merge');
const doc = (items, updatedAt, deleted = {}) => ({ items: items.map((id) => ({ id })), deleted, updatedAt });
const ids = (merged) => merged.items.map((item) => item.id).join(',');
test('two phones: sessions from both survive (union by id)', () => {
  assert(ids(mergeCollection(doc(['a', 'b'], 20), doc(['c', 'a'], 10), 100)) === 'a,b,c', 'union keeps order of newer side');
});
test('a deletion on one phone is not resurrected by the other', () => {
  const merged = mergeCollection(doc(['b'], 20, { a: 15 }), doc(['a', 'b'], 10), 100);
  assert(ids(merged) === 'b' && merged.deleted.a === 15, ids(merged));
});
test('same item on both sides: the newer document wins', () => {
  const local = { items: [{ id: 'r', title: 'old' }], deleted: {}, updatedAt: 10 };
  const remote = { items: [{ id: 'r', title: 'new' }], deleted: {}, updatedAt: 20 };
  assert(mergeCollection(local, remote, 100).items[0].title === 'new', 'remote newer');
});
test('nothing in the cloud yet: local data is kept as is', () => {
  assert(ids(mergeCollection(doc(['a'], 0), null, 100)) === 'a', 'kept');
});
test('profile: last write wins, fresh install adopts the backup', () => {
  assert(mergeProfile({ profile: 'phone', updatedAt: 0 }, { profile: 'cloud', updatedAt: 5 }).profile === 'cloud', 'reinstall');
  assert(mergeProfile({ profile: 'phone', updatedAt: 9 }, { profile: 'cloud', updatedAt: 5 }).profile === 'phone', 'local newer');
});
test('deletions become tombstones; re-adding an id clears it', () => {
  const deleted = trackDeletions(['a', 'b'], ['b'], {}, 7);
  assert(deleted.a === 7 && !deleted.b, 'a tombstoned');
  assert(!trackDeletions(['b'], ['a', 'b'], deleted, 8).a, 'a restored');
});
test('old tombstones expire', () => {
  assert(Object.keys(pruneTombstones({ a: 0, b: TOMBSTONE_TTL_MS }, TOMBSTONE_TTL_MS + 1)).join() === 'b', 'a expired');
});

console.log('\n8b. Favorites, recents, goals and shared notes');
test('dataset equipment matches the name prefix (lever, smith, cable, ...)', () => {
  const RULES = [
    [/^ez ?bar(bell)? /, 'ez barbell'],
    [/^lever /, 'leverage machine'],
    [/^smith /, 'smith machine'],
    [/^cable /, 'cable'],
    [/^dumbbell /, 'dumbbell'],
    [/^barbell /, 'barbell'],
    [/^kettlebell /, 'kettlebell'],
    [/^band /, 'band'],
    [/^sled /, 'sled machine'],
  ];
  const wrong = EXERCISES.filter((exercise) => {
    const rule = RULES.find(([pattern]) => pattern.test(exercise.name));
    return rule && exercise.equipment !== rule[1];
  });
  assert(wrong.length === 0, `${wrong.length} mismatched, e.g. ${wrong[0]?.id} ${wrong[0]?.name} (${wrong[0]?.equipment})`);
  assert(getExercise('0574').equipment === 'leverage machine', 'lever bent over row is a machine');
});
test('recent exercises: newest session first, distinct, capped', () => {
  const { recentExerciseIds } = src('core/utils/exerciseLists.ts');
  const session = (at, ids) => ({ id: `s${at}`, startedAt: at, completedAt: at, exercises: ids.map((exerciseId) => ({ exerciseId, sets: [] })) });
  const history = [session(1, ['a', 'b']), session(3, ['c', 'a']), session(2, ['d'])];
  assert(recentExerciseIds(history).join() === 'c,a,d,b', recentExerciseIds(history).join());
  assert(recentExerciseIds(history, 2).join() === 'c,a', 'limit');
  assert(recentExerciseIds([]).length === 0, 'empty history');
});
test('favorites toggle to the front without duplicates', () => {
  const { toggleFavorite } = src('core/utils/exerciseLists.ts');
  assert(toggleFavorite(undefined, 'a').join() === 'a', 'first');
  assert(toggleFavorite(['b'], 'a').join() === 'a,b', 'newest first');
  assert(toggleFavorite(['a', 'b'], 'a').join() === 'b', 'removed');
});
test('favorites survive migration and the cloud merge', () => {
  const { migrateProfile } = src('storage/index.ts');
  const old = migrateProfile({ name: 'x' });
  assert(Array.isArray(old.favoriteExerciseIds) && old.favoriteExerciseIds.length === 0, 'old profiles get []');
  assert(old.profileNudgeDismissed === false, 'nudge visible by default');
  assert(migrateProfile({ favoriteExerciseIds: ['a', 'a', 3, 'b'] }).favoriteExerciseIds.join() === 'a,b', 'cleaned');
  assert(migrateProfile({ profileNudgeDismissed: true }).profileNudgeDismissed === true, 'dismissal kept');
  const local = { profile: migrateProfile({ favoriteExerciseIds: ['a'] }), updatedAt: 1 };
  const remote = { profile: migrateProfile({ favoriteExerciseIds: ['b', 'c'] }), updatedAt: 2 };
  assert(mergeProfile(local, remote).profile.favoriteExerciseIds.join() === 'b,c', 'newer profile brings its favorites');
  assert(mergeProfile(remote, null).profile.favoriteExerciseIds.join() === 'b,c', 'no remote keeps local');
});
test('goal: onboarding draft may be unset, saving keeps a real goal', () => {
  const { profileFromDraft } = src('features/profile/profileDraft.ts');
  const { migrateProfile } = src('storage/index.ts');
  const base = migrateProfile({ fitnessGoal: 'fat_loss' });
  const draft = {
    name: 'A', gender: 'male', age: '30', weightKg: '80', heightCm: '180', neckCm: '', waistCm: '', hipCm: '', targetBodyFatPercent: '',
    activityLevel: 'moderate', fitnessGoal: null, trainingLocation: 'gym', experience: 'beginner', homeEquipment: ['body_weight'],
    gymType: 'large_gym', daysPerWeek: 3, sessionMinutes: 60, focusMuscles: [], dietaryConditions: [],
  };
  assert(profileFromDraft(base, draft).fitnessGoal === 'fat_loss', 'null keeps base');
  assert(profileFromDraft(base, { ...draft, fitnessGoal: 'maintenance' }).fitnessGoal === 'maintenance', 'chosen goal saved');
  assert(profileFromDraft({ ...base, favoriteExerciseIds: ['z'] }, draft).favoriteExerciseIds.join() === 'z', 'profile edits keep favorites');
  const es = require(path.join(__dirname, '..', 'src', 'core', 'i18n', 'locales', 'es', 'catalog.json'));
  assert(Object.keys(es.goals).join() === 'fat_loss,maintenance,muscle_gain,aggressive_bulk', 'four goals');
  assert(/grasa.*músculo/.test(es.goals.maintenance.description), es.goals.maintenance.description);
});
test('meal plan notes are shared by the coach and the Nutrition tab', () => {
  const { adaptedToNote, lowCalorieNote, medicalDisclaimerFor, MEDICAL_DISCLAIMER, LOW_CALORIE_TARGET } = src('core/services/coach/nutritionNotes.ts');
  const { offlineReply } = src('core/services/coach/offlineEngine.ts');
  const { migrateProfile } = src('storage/index.ts');
  assert(adaptedToNote([]) === null && medicalDisclaimerFor([]) === null, 'nothing without conditions');
  assert(adaptedToNote(['celiac', 'celiac']) === 'Adaptado a: celiaquía.', adaptedToNote(['celiac']));
  assert(lowCalorieNote(LOW_CALORIE_TARGET) === null && /1499 kcal/.test(lowCalorieNote(1499)), 'threshold');
  const profile = migrateProfile({ ...profileForPlan, dietaryConditions: ['hypertension'] });
  const tiny = { ...plan, targetCalories: 1200 };
  const text = offlineReply({ intent: 'nutrition' }, { profile, plan: tiny, history: [] }).text;
  for (const note of [adaptedToNote(['hypertension']), lowCalorieNote(1200), MEDICAL_DISCLAIMER]) assert(text.includes(note), `coach misses: ${note}`);
});
test('coach status only degrades after two basic replies in a row', () => {
  const { coachAiDegraded } = src('core/services/coach/status.ts');
  assert(!coachAiDegraded([]), 'empty');
  assert(!coachAiDegraded([undefined, 'online', undefined, 'offline']), 'one hiccup');
  assert(coachAiDegraded(['online', 'offline', undefined, 'scope', 'offline']), 'two in a row (user turns and scope ignored)');
  assert(!coachAiDegraded(['offline', 'offline', 'online']), 'recovered');
});

console.log('\n8. Accounts (per-device data spaces)');
(async () => {
  await testAsync('"con mancuernas" overrides the saved kit in the coach routine', async () => {
    const { askCoach } = src('core/services/coach/index.ts');
    const { migrateProfile } = src('storage/index.ts');
    const profile = migrateProfile({ ...profileForPlan, trainingLocation: 'home', homeEquipment: ['resistance_bands', 'barbell_plates'] });
    const reply = await askCoach({ prompt: 'Armame una rutina de espalda con mancuernas', history: [], profile, workouts: [], offlineOnly: true });
    const routine = reply.blocks.find((block) => block.type === 'routine')?.routine;
    assert(routine && routine.exercises.length >= 3, 'routine returned');
    const kit = routine.exercises.map((item) => getExercise(item.exerciseId).equipment);
    assert(kit.every((equipment) => equipment === 'dumbbell' || equipment === 'body weight'), `off-kit: ${kit}`);
  });
  await testAsync('a short AI routine is completed to fill the session, across every focus asked', async () => {
    const { askCoach } = src('core/services/coach/index.ts');
    const { migrateProfile } = src('storage/index.ts');
    const profile = migrateProfile({ ...profileForPlan, sessionMinutes: 60 });
    const rows = EXERCISES.filter((exercise) => exercise.equipment === 'dumbbell' && exercise.target === 'upper back').slice(0, 2);
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        content: JSON.stringify({ text: 'Rutina corta', blocks: [{ type: 'routine', title: 'Espalda', exercises: rows.map((row) => ({ id: row.id, sets: 3, reps: '10', rest: 90 })) }] }),
      }),
    });
    try {
      const reply = await askCoach({ prompt: 'Armame una rutina de espalda y biceps con mancuernas', history: [], profile, workouts: [] });
      const routine = reply.blocks.find((block) => block.type === 'routine')?.routine;
      assert(routine && routine.exercises.length >= 6, `only ${routine?.exercises.length} exercises`);
      const targets = routine.exercises.map((item) => getExercise(item.exerciseId).target);
      assert(targets.includes('biceps'), `no biceps: ${targets}`);
      assert(new Set(routine.exercises.map((item) => item.exerciseId)).size === routine.exercises.length, 'duplicates');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
  test('catalog browsing order is alphabetical in Spanish, without the slow locale collator', () => {
    const { firstCatalogPage } = src('features/exercises/useExerciseSearch.ts');
    const { normalizeText } = src('data/catalog.ts');
    const all = firstCatalogPage(EXERCISES.length);
    assert(all.length === EXERCISES.length, 'nothing lost');
    const keys = all.map((exercise) => normalizeText(exercise.displayName));
    assert(keys.every((key, i) => i === 0 || keys[i - 1] <= key), 'sorted');
  });
  await testAsync('the coach reports which model answered (fallback included)', async () => {
    const { askCoach } = src('core/services/coach/index.ts');
    const { migrateProfile } = src('storage/index.ts');
    const realFetch = globalThis.fetch;
    const reply = (provider) => async () => ({ ok: true, status: 200, json: async () => ({ content: '{"text":"Descansa 2 minutos entre series pesadas."}', provider }) });
    try {
      const profile = migrateProfile({ ...profileForPlan });
      globalThis.fetch = reply('workers-ai');
      assert((await askCoach({ prompt: '¿Cuánto descanso entre series?', history: [], profile, workouts: [] })).provider === 'workers-ai', 'fallback');
      globalThis.fetch = reply('something-else');
      assert((await askCoach({ prompt: '¿Cuánto descanso entre series?', history: [], profile, workouts: [] })).provider === undefined, 'unknown provider ignored');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
  test('longer sessions get more sets, and every day fits the chosen time', () => {
    const { generateWeeklyProgram, estimateMinutes } = src('core/utils/programGenerator.ts');
    const base = { trainingLocation: 'gym', homeEquipment: [], fitnessGoal: 'muscle_gain', experience: 'intermediate', daysPerWeek: 4 };
    const totals = [45, 60, 75, 90].map((sessionMinutes) => {
      const { routines } = generateWeeklyProgram({ ...base, sessionMinutes });
      routines.forEach((routine) => assert(estimateMinutes(routine.exercises) <= sessionMinutes + 5, `${sessionMinutes} min day lasts ${estimateMinutes(routine.exercises)}`));
      routines.forEach((routine) => routine.exercises.forEach((item) => assert(item.targetSets <= 5, `${item.targetSets} sets`)));
      return routines.reduce((sum, routine) => sum + routine.exercises.reduce((s, item) => s + item.targetSets, 0), 0);
    });
    assert(totals.every((total, i) => i === 0 || total > totals[i - 1]), `weekly sets by duration: ${totals}`);
  });
  test('daily log: meals and water reset each day and stay in range', () => {
    const { logFor, toggleMeal, addWater, eatenTotals } = src('core/utils/dailyLog.ts');
    const stale = { todayLog: { date: '2026-03-09', eatenMeals: [0, 1], waterMl: 2000 } };
    const today = logFor(stale, '2026-03-10');
    assert(today.eatenMeals.length === 0 && today.waterMl === 0, 'yesterday leaked');
    let log = toggleMeal(toggleMeal(today, 2), 0);
    assert(JSON.stringify(log.eatenMeals) === '[0,2]', `eaten ${log.eatenMeals}`);
    log = toggleMeal(log, 2);
    assert(JSON.stringify(log.eatenMeals) === '[0]', 'untick');
    assert(addWater(log, -250).waterMl === 0 && addWater(log, 20000).waterMl === 10000, 'water bounds');
    const totals = eatenTotals([{ kcal: 700, proteinGrams: 50 }, { kcal: 1100, proteinGrams: 70 }], toggleMeal(log, 1));
    assert(totals.kcal === 1800 && totals.protein === 120, JSON.stringify(totals));
  });
  test('weight log: one entry per day, change over time, weekly weigh-in', () => {
    const { recordWeight, weightChange, weighInDue } = src('core/utils/weightLog.ts');
    let log = recordWeight(undefined, '2026-03-01', 92.04);
    log = recordWeight(log, '2026-03-15', 91.2);
    log = recordWeight(log, '2026-03-08', 91.8);
    log = recordWeight(log, '2026-03-15', 91.0);
    assert(log.map((entry) => entry.date).join() === '2026-03-01,2026-03-08,2026-03-15' && log[0].kg === 92, JSON.stringify(log));
    const change = weightChange(log, 7);
    assert(change.kg === -0.8 && change.days === 7, JSON.stringify(change));
    assert(weightChange(log, 30).kg === -1 && weightChange(log.slice(0, 1), 7) === null, 'change');
    assert(weighInDue(log, '2026-03-22') && !weighInDue(log, '2026-03-21') && weighInDue(undefined, '2026-03-21'), 'due');
  });
  test('warm-up ramps to the first heavy lift and never touches working sets', () => {
    const { warmupSets, warmupExerciseIndex } = src('core/utils/warmup.ts');
    const fmt = (sets) => sets.map((s) => `${s.weightKg}x${s.reps}`).join(' ');
    assert(fmt(warmupSets('barbell', 100)) === '20x10 50x5 70x3 85x2', fmt(warmupSets('barbell', 100)));
    assert(fmt(warmupSets('barbell', 60)) === '20x10 30x5 42.5x3', fmt(warmupSets('barbell', 60)));
    assert(fmt(warmupSets('dumbbell', 32)) === '16x8 24x4', fmt(warmupSets('dumbbell', 32)));
    assert(warmupSets('barbell', 25).length === 0 && warmupSets('body weight', 80).length === 0, 'light or bodyweight');
    const sets = (kg) => [{ id: 's', setNumber: 1, type: 'normal', weightKg: kg, reps: 8, completed: false }];
    const dumbbellRow = EXERCISES.find((e) => e.equipment === 'dumbbell');
    const pushUp = EXERCISES.find((e) => e.equipment === 'body weight');
    const benchId = '0025';
    const index = warmupExerciseIndex([
      { exerciseId: pushUp.id, exerciseName: '', sets: sets(0) },
      { exerciseId: dumbbellRow.id, exerciseName: '', sets: sets(10) },
      { exerciseId: benchId, exerciseName: '', sets: sets(70) },
    ]);
    assert(index === 2, `first heavy lift is ${index}`);
  });
  test('plate calculator: plates per side for a standard bar', () => {
    const { platesFor, usesPlates } = src('core/utils/plates.ts');
    assert(platesFor(20) === null && platesFor(15) === null, 'empty bar');
    assert(platesFor(60).perSide.join() === '20', platesFor(60).perSide.join());
    assert(platesFor(102.5).perSide.join() === '25,15,1.25', platesFor(102.5).perSide.join());
    const odd = platesFor(61);
    assert(odd.perSide.join() === '20' && odd.leftover === 1, JSON.stringify(odd));
    assert(usesPlates('barbell') && !usesPlates('dumbbell') && !usesPlates('ez barbell'), 'equipment');
  });
  test('deload is suggested only when regular training stops progressing', () => {
    const { suggestDeload, DELOAD_SNOOZE_MS } = src('core/utils/deload.ts');
    const DAY = 24 * 60 * 60 * 1000;
    const now = new Date(2026, 5, 26, 12).getTime();
    // Two sessions a week for 8 weeks; `kg(week)` gives the bench and row load of that week.
    const history = (kg) =>
      Array.from({ length: 16 }, (_, i) => {
        const week = Math.floor(i / 2);
        const at = now - (55 - i * 3.5) * DAY;
        const set = (w) => [{ id: 'x', setNumber: 1, type: 'normal', weightKg: w, reps: 5, completed: true }];
        return {
          id: `s${i}`, title: 'A', startedAt: at, completedAt: at, durationSeconds: 3600, totalVolumeKg: 0, status: 'completed',
          exercises: [
            { exerciseId: '0025', exerciseName: 'Press de banca', sets: set(kg(week)) },
            { exerciseId: '0027', exerciseName: 'Remo', sets: set(kg(week) - 10) },
          ],
        };
      });
    const progressing = history((week) => 60 + week * 2.5);
    const stalled = history((week) => (week < 3 ? 60 + week * 2.5 : 65));
    assert(suggestDeload(progressing, { now }) === null, 'progressing lifter told to deload');
    const suggestion = suggestDeload(stalled, { now });
    assert(suggestion && suggestion.stalledLifts.length === 2, JSON.stringify(suggestion));
    assert(suggestDeload(stalled, { now, snoozedAt: now - DAY }) === null, 'snooze ignored');
    assert(suggestDeload(stalled, { now, snoozedAt: now - DELOAD_SNOOZE_MS - DAY }) !== null, 'snooze never ends');
    assert(suggestDeload(stalled.slice(-4), { now }) === null, 'irregular training');
  });
  test('level changes the routine: sets, reps and rest', () => {
    const { generateRoutine, adjustSetsForLevel } = src('core/utils/programGenerator.ts');
    const base = { trainingLocation: 'gym', homeEquipment: [], fitnessGoal: 'muscle_gain' };
    const sets = (experience) => generateRoutine({ focus: 'upper', profile: { ...base, experience }, maxExercises: 6 }).exercises.reduce((sum, item) => sum + item.targetSets, 0);
    assert(sets('beginner') < sets('intermediate') && sets('intermediate') < sets('advanced'), `sets ${sets('beginner')}/${sets('intermediate')}/${sets('advanced')}`);
    const beginner = generateRoutine({ focus: 'upper', profile: { ...base, experience: 'beginner' }, maxExercises: 6 }).exercises[0];
    assert(beginner.targetReps === '8-12', `beginner reps ${beginner.targetReps}`);
    const routine = [{ exerciseId: '0025', targetSets: 3, targetReps: '8', restSeconds: 90 }, { exerciseId: '0027', targetSets: 1, targetReps: '8', restSeconds: 90 }];
    assert(adjustSetsForLevel(routine, 'intermediate', 'advanced').map((item) => item.targetSets).join() === '4,2', 'up');
    assert(adjustSetsForLevel(routine, 'intermediate', 'beginner').map((item) => item.targetSets).join() === '2,1', 'down, never below 1');
  });
  test('water reminders fire every N hours inside the window', () => {
    const { waterHours } = src('core/utils/waterSchedule.ts');
    assert(waterHours({ everyHours: 2, fromHour: 9, toHour: 21 }).join() === '9,11,13,15,17,19,21', 'every 2 h');
    assert(waterHours({ everyHours: 3, fromHour: 8, toHour: 20 }).join() === '8,11,14,17,20', 'every 3 h');
  });
  test('only the newest program stays when two devices merged theirs', () => {
    const { programRoutines, withoutStalePrograms } = src('core/utils/program.ts');
    const day = (programId, programDay, createdAt) => ({ id: `${programId}${programDay}`, programId, programDay, createdAt, exercises: [] });
    const merged = [day('old', 1, 100), day('old', 2, 101), day('new', 1, 200), day('new', 2, 201), { id: 'mine', exercises: [], createdAt: 50 }];
    assert(programRoutines(merged).map((r) => r.id).join() === 'new1,new2', programRoutines(merged).map((r) => r.id).join());
    assert(withoutStalePrograms(merged).map((r) => r.id).join() === 'new1,new2,mine', 'own routines are kept');
  });
  test('everyday food questions reach the coach as nutrition', () => {
    const food = [
      'Yogurt con una banana, 1 manzana, una mandarina, cereal de maíz y nueces está bien para merendar?',
      '¿Puedo cenar pizza el fin de semana?',
      'tomar mate antes de entrenar está bien?',
      '¿Cuántos huevos puedo comer por día?',
    ];
    const blocked = food.filter((text) => isOffTopic(text));
    assert(blocked.length === 0, `refused: ${blocked}`);
    assert(food.every((text) => parseQuery(text).intent === 'nutrition'), food.map((t) => parseQuery(t).intent).join());
    assert(parseQuery('¿te puedo preguntar algo? espera, aclara la técnica').intent !== 'nutrition', 'pronoun/espera/aclara are not food');
    assert(isOffTopic('cuál es la capital de Francia'), 'still refuses clearly unrelated questions');
  });
  test('every focus named in a request is kept', () => {
    const focuses = parseQuery('Armame una rutina de espalda y biceps').focuses;
    assert(JSON.stringify(focuses) === JSON.stringify(['back', 'arms']), `focuses: ${focuses}`);
    assert(parseQuery('Armame una rutina de pecho').focuses === undefined, 'single focus');
  });
  memory.clear();

  await testAsync('accounts are isolated from each other', async () => {
    await Accounts.setCurrent('google_a@x.com');
    await Storage.saveProfile({ ...(await Storage.loadAll()).profile, name: 'A' });
    await Accounts.setCurrent('local_b');
    const b = await Storage.loadAll();
    assert(b.profile.name === '' && b.history.length === 0, 'fresh space for B');
    await Accounts.setCurrent('google_a@x.com');
    assert((await Storage.loadAll()).profile.name === 'A', 'A kept its data');
  });

  await testAsync('signed out: writes are dropped instead of crashing', async () => {
    await Accounts.setCurrent(null);
    await Storage.saveProfile({ name: 'ghost' });
    assert(![...memory.values()].some((value) => String(value).includes('ghost')), 'nothing written');
  });

  await testAsync('removing an account deletes its data and signs it out', async () => {
    await Accounts.upsert({ id: 'local_b', kind: 'local', name: 'B', lastUsedAt: 1 });
    await Accounts.setCurrent('local_b');
    await Storage.saveProfile({ name: 'B' });
    await Accounts.remove('local_b');
    assert(![...memory.keys()].some((key) => key.endsWith(':local_b')), 'data gone');
    assert((await Accounts.getCurrentId()) === null, 'signed out');
    assert(!(await Accounts.list()).some((item) => item.id === 'local_b'), 'removed from registry');
  });

  await testAsync('sync meta is stored per account and survives a reload', async () => {
    await Accounts.setCurrent('google_a@x.com');
    await Storage.saveSyncMeta({ updatedAt: { profile: 5 }, deleted: { customRoutines: { r1: 1 }, history: {} }, knownIds: { customRoutines: [], history: [] } });
    await Accounts.setCurrent('local_c');
    assert((await Storage.loadSyncMeta()).updatedAt.profile === undefined, 'fresh meta for another account');
    await Accounts.setCurrent('google_a@x.com');
    const meta = await Storage.loadSyncMeta();
    assert(meta.updatedAt.profile === 5 && meta.deleted.customRoutines.r1 === 1, 'meta kept');
  });

  await testAsync('local writes notify the sync, silent and signed-out writes do not', async () => {
    const heard = [];
    Storage.setWriteListener((kind) => heard.push(kind));
    await Accounts.setCurrent('google_a@x.com');
    await Storage.saveHistory([]);
    await Storage.saveCustomRoutines([], { silent: true });
    await Accounts.setCurrent(null);
    await Storage.saveProfile({ name: 'ghost' });
    Storage.setWriteListener(null);
    assert(heard.join() === 'history', `heard: ${heard.join()}`);
  });

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length > 0) process.exit(1);
})();
