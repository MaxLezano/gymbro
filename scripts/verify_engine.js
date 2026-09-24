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
const plan = calculateNutritionPlan({
  gender: 'male', weightKg: 78, heightCm: 178, age: 26, activityLevel: 'moderate', fitnessGoal: 'muscle_gain',
});
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
