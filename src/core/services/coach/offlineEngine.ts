import type { UserProfile } from '../../types';
import { getExercises, getExercise } from '../../../data/catalog';
import { fitsHomeEquipment } from '../../utils/equipment';
import { FOCUS_LABELS, generateRoutine, suggestFocus } from '../../utils/programGenerator';
import { estimateOneRepMax, personalRecords } from '../../utils/workout';
import { GOAL_LABELS, labelTarget } from '../../i18n/labels';
import type { CoachContext } from './context';
import type { ParsedQuery } from './intents';
import { buildMealPlan } from './mealPlan';
import { adaptedToNote, lowCalorieNote, medicalDisclaimerFor } from './nutritionNotes';
import type { CoachReply } from './types';

export { buildMealPlan } from './mealPlan';
export { LOW_CALORIE_TARGET, MEDICAL_DISCLAIMER } from './nutritionNotes';

function prescriptionText(profile: UserProfile): string {
  switch (profile.fitnessGoal) {
    case 'fat_loss':
      return 'Como estás en déficit, prioriza **mantener las cargas** de los básicos y descansa lo justo. El músculo se conserva con intensidad, no con volumen extra.';
    case 'aggressive_bulk':
      return 'Con superávit agresivo, empuja los **compuestos en rangos de 5–8** y busca subir carga cada semana.';
    case 'maintenance':
      return 'Para recomposición, trabaja cerca del fallo (**RIR 1–2**) y registra cada sesión para asegurar sobrecarga progresiva.';
    default:
      return 'Para ganar músculo, deja **1–2 repeticiones en reserva** en cada serie y sube peso cuando completes el tope del rango en todas las series.';
  }
}

const DEFAULT_SUGGESTIONS = ['Armame una rutina para hoy', '¿Cuánta proteína necesito?', '¿Cómo progreso más rápido?'];

export function offlineReply(query: ParsedQuery, context: CoachContext): Omit<CoachReply, 'source'> {
  const { profile, plan, history } = context;
  const atHome = (query.location ?? (profile.trainingLocation === 'home' ? 'home' : 'gym')) === 'home';

  switch (query.intent) {
    case 'routine': {
      const recent = history.slice(0, 2).flatMap((s) => s.exercises.map((log) => getExercise(log.exerciseId)?.bodyPart ?? ''));
      const focus = query.focus ?? suggestFocus(recent);
      const maxExercises = query.minutes ? Math.max(3, Math.min(7, Math.round(query.minutes / 9))) : undefined;
      const routine = generateRoutine({ focus, profile, location: atHome ? 'home' : 'gym', maxExercises });
      return {
        text:
          `Te armé una sesión de **${FOCUS_LABELS[focus].toLowerCase()}** ${atHome ? 'con el equipo que tienes en casa' : 'para el gimnasio'}, ` +
          `de unos ${routine.estimatedMinutes} minutos.\n\n${prescriptionText(profile)}`,
        blocks: [{ type: 'routine', routine }],
        suggestions: [query.minutes && query.minutes <= 30 ? 'Hazla más larga' : 'Hazla más corta', atHome ? 'Cámbiala para el gimnasio' : 'Cámbiala para hacerla en casa', '¿Cómo caliento antes?'],
      };
    }

    case 'technique': {
      const exercise = query.exerciseId ? getExercise(query.exerciseId) : undefined;
      if (!exercise) break;
      const record = personalRecords(history).find((item) => item.exerciseId === exercise.id);
      const tips = exercise.instructions.slice(0, 4);
      const progression = record
        ? `Tu mejor serie es ${record.bestWeightKg} kg × ${record.bestReps} (1RM ≈ ${record.bestOneRepMax} kg). Próximo objetivo: ${record.bestWeightKg} kg × ${record.bestReps + 1}, luego sube 2,5 kg.`
        : 'Empieza con un peso que te permita 10 repeticiones limpias dejando 2 en reserva y regístralo.';
      return {
        text: `**${exercise.displayName}** trabaja principalmente ${labelTarget(exercise.target).toLowerCase()}.\n\n${progression}`,
        blocks: [
          { type: 'exercises', exerciseIds: [exercise.id] },
          { type: 'tips', title: 'Claves de técnica', items: [...tips, 'Controla la bajada en 2–3 segundos y no rebotes.'] },
        ],
        suggestions: [`Alternativas a ${exercise.displayName}`, 'Armame una rutina con este ejercicio', '¿Cuántas series por semana?'],
      };
    }

    case 'exercises': {
      const base = query.exerciseId ? getExercise(query.exerciseId) : undefined;
      const targetSet = base ? [base.target] : undefined;
      const routine = query.focus ? generateRoutine({ focus: query.focus, profile, location: atHome ? 'home' : 'gym', maxExercises: 6 }) : null;
      let ids = routine?.exercises.map((item) => item.exerciseId) ?? [];
      if (targetSet) {
        ids = getExercises().filter(
          (exercise) =>
            targetSet.includes(exercise.target) &&
            exercise.id !== base?.id &&
            !/v\. \d|\(|pov/.test(exercise.name) &&
            (!atHome || fitsHomeEquipment(exercise, profile.homeEquipment))
        )
          .slice(0, 6)
          .map((exercise) => exercise.id);
      }
      if (ids.length === 0) break;
      return {
        text: base
          ? `Estas alternativas trabajan lo mismo que **${base.displayName}**${atHome ? ' y puedes hacerlas en casa' : ''}. Toca cualquiera para ver la técnica.`
          : `Estos son los mejores ejercicios de **${FOCUS_LABELS[query.focus!].toLowerCase()}** para tu equipo. Toca uno para ver la técnica.`,
        blocks: [{ type: 'exercises', exerciseIds: ids }],
        suggestions: ['Armame una rutina con estos', '¿Cuántas series y repeticiones?', '¿Cómo progreso con ellos?'],
      };
    }

    case 'nutrition': {
      const conditions = profile.dietaryConditions ?? [];
      const lowCalorie = lowCalorieNote(plan.targetCalories);
      const adapted = adaptedToNote(conditions);
      const disclaimer = medicalDisclaimerFor(conditions);
      return {
        text:
          `Para **${GOAL_LABELS[profile.fitnessGoal].title.toLowerCase()}** tu meta es **${plan.targetCalories} kcal** al día. ` +
          `Reparte la proteína en 3–5 tomas de unos ${Math.round(plan.proteinGrams / 4)} g y concentra los carbohidratos alrededor del entrenamiento.\n\n` +
          `Este es tu menú de hoy, cerca de tus macros (cantidades aproximadas; cambia cada día).${adapted ? ` ${adapted}` : ''}` +
          (lowCalorie ? `\n\n**Atención:** ${lowCalorie}` : '') +
          (disclaimer ? `\n\n${disclaimer}` : ''),
        blocks: [{ type: 'macros' }, { type: 'meals', meals: buildMealPlan(plan, { conditions }) }],
        suggestions: ['¿Qué como antes de entrenar?', 'Dame opciones vegetarianas', '¿Me conviene tomar creatina?'],
      };
    }

    case 'body': {
      const diff = Math.round((profile.weightKg - plan.idealWeightKg) * 10) / 10;
      return {
        text:
          `Tu grasa corporal estimada es **${plan.bodyFatPercent}%** con **${plan.leanMassKg} kg** de masa magra. ` +
          (diff > 0
            ? `Para llegar a tu peso atlético (${plan.idealWeightKg} kg) te sobran unos **${diff} kg de grasa**, conservando todo tu músculo.`
            : `Estás por debajo de tu peso atlético: tienes margen para ganar unos **${Math.abs(diff)} kg** de músculo.`) +
          `\n\nTu FFMI de ${plan.ffmi} es **${plan.ffmiCategory.toLowerCase()}**.`,
        blocks: [{ type: 'body' }],
        suggestions: ['¿Cuánto tardo en llegar a mi meta?', '¿Cómo mido mi grasa con cinta?', 'Plan de comidas para mi objetivo'],
      };
    }

    case 'progress': {
      const records = personalRecords(history).slice(0, 4);
      if (records.length === 0) {
        return {
          text: 'Aún no tengo sesiones tuyas para analizar. Registra 2–3 entrenamientos y te diré exactamente cuánto subir en cada ejercicio.',
          blocks: [
            {
              type: 'tips',
              title: 'Doble progresión',
              items: [
                'Elige un rango, por ejemplo 8–12 repeticiones.',
                'Cuando hagas 12 en todas las series, sube 2,5 kg (tren superior) o 5 kg (piernas).',
                'Vuelve a empezar desde 8 repeticiones con el nuevo peso.',
                'Si te estancas 2 semanas, baja 10 % el peso y reconstruye.',
              ],
            },
          ],
          suggestions: DEFAULT_SUGGESTIONS,
        };
      }
      return {
        text: 'Según tu historial, estos son tus próximos objetivos para seguir progresando (doble progresión):',
        blocks: [
          {
            type: 'tips',
            title: 'Próxima sesión',
            items: records.map((record) => {
              const nextReps = record.bestReps + 1;
              return `${record.exerciseName}: ${record.bestWeightKg} kg × ${nextReps} (1RM ≈ ${estimateOneRepMax(record.bestWeightKg, nextReps)} kg)`;
            }),
          },
          { type: 'exercises', title: 'Tus ejercicios clave', exerciseIds: records.map((record) => record.exerciseId) },
        ],
        suggestions: ['Estoy estancado, ¿qué hago?', '¿Cuánto descanso entre series?', 'Armame una rutina de fuerza'],
      };
    }
  }

  return {
    text:
      'Puedo **armarte rutinas** con tu equipo, **explicarte la técnica** de cualquier ejercicio, ' +
      '**revisar tu progreso** y **planificar tus comidas** según tus macros. ¿Por dónde empezamos?',
    blocks: [],
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
