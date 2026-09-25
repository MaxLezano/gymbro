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
const STUBS = { '@react-native-async-storage/async-storage': { __esModule: true, default: asyncStorage } };
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
const { EXERCISES, getExercise } = src('data/catalog.ts');
const { estimateOneRepMax, parseTargetReps, weekStreak, pluralize, suggestLoad, formatRest } = src('core/utils/workout.ts');
const { fitsHomeEquipment, requiredHomeEquipment } = src('core/utils/equipment.ts');
const { generateRoutine, FOCUS_LABELS } = src('core/utils/programGenerator.ts');
const { SEED_ROUTINES, Accounts, Storage } = src('storage/index.ts');
const { parseQuery, isOffTopic, unknownExerciseName } = src('core/services/coach/intents.ts');
const { extractJson, normalizeBlocks } = src('core/services/coach/onlineClient.ts');
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
test('display names are title-cased', () => assert(getExercise('0289').displayName === 'Dumbbell Bench Press', getExercise('0289').displayName));

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

console.log('\n8. Accounts (per-device data spaces)');
(async () => {
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
