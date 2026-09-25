import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import type { ActivityLevel, DietaryCondition, ExperienceLevel, FitnessGoal, Gender, GymType, HomeEquipment, NutritionMetrics, PriorityMuscle } from '../../core/types';
import { ACTIVITY_LABELS, DIETARY_CONDITION_LABELS, DIETARY_CONDITIONS, GOAL_LABELS, HOME_EQUIPMENT_OPTIONS } from '../../core/i18n/labels';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, SegmentedControl } from '../../components/ui';
import { MacroSummary } from '../nutrition/MacroSummary';
import { RANGES, type ProfileDraft } from './profileDraft';

type Update = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
type Merge = (patch: Partial<ProfileDraft>) => void;
type Errors = Partial<Record<keyof typeof RANGES, string>>;

export function FieldLabel({ children }: { children: string }) {
  return (
    <AppText variant="overline" color="textMuted" style={styles.fieldLabel}>
      {children}
    </AppText>
  );
}

function NumberField({
  field,
  draft,
  update,
  errors,
  placeholder,
}: {
  field: keyof typeof RANGES;
  draft: ProfileDraft;
  update: Update;
  errors: Errors;
  placeholder?: string;
}) {
  const range = RANGES[field];
  const error = errors[field];
  return (
    <View style={styles.numberField}>
      <FieldLabel>{range.label}</FieldLabel>
      <View style={[styles.inputBox, error && styles.inputError]}>
        <TextInput
          value={draft[field]}
          onChangeText={(text) => update(field, text.replace(',', '.').replace(/[^0-9.]/g, ''))}
          keyboardType="decimal-pad"
          placeholder={placeholder ?? '—'}
          placeholderTextColor={theme.colors.textDisabled}
          maxLength={5}
          selectionColor={theme.colors.primary}
          accessibilityLabel={`${range.label} en ${range.unit}`}
          style={styles.input}
        />
        <AppText variant="subhead" color="textMuted">
          {range.unit}
        </AppText>
      </View>
      {error && (
        <AppText variant="caption" color="danger" numberOfLines={1}>
          {error}
        </AppText>
      )}
    </View>
  );
}

export function BasicsSection({ draft, update, errors, showName = true }: { draft: ProfileDraft; update: Update; errors: Errors; showName?: boolean }) {
  return (
    <View style={styles.section}>
      {showName && (
        <View>
          <FieldLabel>Nombre</FieldLabel>
          <View style={styles.inputBox}>
            <TextInput
              value={draft.name}
              onChangeText={(text) => update('name', text)}
              placeholder="¿Cómo te llamamos?"
              placeholderTextColor={theme.colors.textDisabled}
              maxLength={32}
              autoCapitalize="words"
              selectionColor={theme.colors.primary}
              style={styles.input}
            />
          </View>
        </View>
      )}
      <View>
        <FieldLabel>Sexo biológico</FieldLabel>
        <SegmentedControl<Gender>
          value={draft.gender}
          onChange={(value) => update('gender', value)}
          options={[
            { value: 'male', label: 'Hombre' },
            { value: 'female', label: 'Mujer' },
          ]}
        />
        <AppText variant="caption" color="textMuted" style={styles.help}>
          Lo usan las fórmulas de metabolismo y grasa corporal.
        </AppText>
      </View>
      <View style={styles.row}>
        <NumberField field="age" draft={draft} update={update} errors={errors} placeholder="28" />
        <NumberField field="weightKg" draft={draft} update={update} errors={errors} placeholder="75" />
        <NumberField field="heightCm" draft={draft} update={update} errors={errors} placeholder="175" />
      </View>
    </View>
  );
}

export function MeasurementsSection({ draft, update, errors }: { draft: ProfileDraft; update: Update; errors: Errors }) {
  return (
    <View style={styles.section}>
      <AppText variant="subhead" color="textSecondary">
        Opcional. Con una cinta métrica: cuello bajo la nuez, cintura a la altura del ombligo{draft.gender === 'female' ? ' y cadera en su punto más ancho' : ''}.
      </AppText>
      <View style={styles.row}>
        <NumberField field="neckCm" draft={draft} update={update} errors={errors} />
        <NumberField field="waistCm" draft={draft} update={update} errors={errors} />
        {draft.gender === 'female' && <NumberField field="hipCm" draft={draft} update={update} errors={errors} />}
      </View>
      <View style={styles.rowHalf}>
        <NumberField field="targetBodyFatPercent" draft={draft} update={update} errors={errors} placeholder={draft.gender === 'male' ? '12' : '20'} />
      </View>
    </View>
  );
}

function OptionCard({
  title,
  description,
  selected,
  onPress,
  icon,
  multi,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Checkbox look for options that can be combined. */
  multi?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole={multi ? 'checkbox' : 'radio'}
      accessibilityState={{ selected }}
      onPress={() => {
        FeedbackService.selection();
        onPress();
      }}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && !selected && styles.optionPressed]}
    >
      {icon && (
        <View style={[styles.optionIcon, selected && styles.optionIconSelected]}>
          <Ionicons name={icon} size={18} color={selected ? theme.colors.onPrimary : theme.colors.primary} />
        </View>
      )}
      <View style={styles.flex}>
        <AppText variant="callout" style={styles.bold}>
          {title}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {description}
        </AppText>
      </View>
      {multi ? (
        <View style={[styles.radio, styles.checkbox, selected && styles.checkboxOn]}>
          {selected && <Ionicons name="checkmark" size={15} color={theme.colors.onPrimary} />}
        </View>
      ) : (
        <View style={[styles.radio, selected && styles.radioOn]}>{selected && <View style={styles.radioDot} />}</View>
      )}
    </Pressable>
  );
}

/**
 * "Perder grasa" and "Ganar músculo" can be combined: doing both at once is a
 * recomposition (maintenance calories, high protein). "Volumen intenso" is a big
 * surplus, so it stands alone. The stored goal stays a single FitnessGoal.
 */
type GoalChoice = 'lose' | 'gain' | 'bulk';

function choicesFor(goal: FitnessGoal): Set<GoalChoice> {
  if (goal === 'fat_loss') return new Set(['lose']);
  if (goal === 'muscle_gain') return new Set(['gain']);
  if (goal === 'aggressive_bulk') return new Set(['bulk']);
  return new Set(['lose', 'gain']);
}

function goalFor(choices: Set<GoalChoice>): FitnessGoal {
  if (choices.has('bulk')) return 'aggressive_bulk';
  if (choices.has('lose') && choices.has('gain')) return 'maintenance';
  return choices.has('lose') ? 'fat_loss' : 'muscle_gain';
}

const GOAL_CHOICES: { id: GoalChoice; goal: FitnessGoal; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'lose', goal: 'fat_loss', icon: 'trending-down' },
  { id: 'gain', goal: 'muscle_gain', icon: 'trending-up' },
  { id: 'bulk', goal: 'aggressive_bulk', icon: 'rocket-outline' },
];

export function GoalSection({ draft, update }: { draft: ProfileDraft; update: Update }) {
  const choices = choicesFor(draft.fitnessGoal);
  const toggle = (id: GoalChoice) => {
    let next: Set<GoalChoice>;
    if (id === 'bulk') next = new Set(['bulk']);
    else {
      next = new Set([...choices].filter((choice) => choice !== 'bulk'));
      if (next.has(id)) next.delete(id);
      else next.add(id);
    }
    if (next.size > 0) update('fitnessGoal', goalFor(next));
  };
  const plan = GOAL_LABELS[draft.fitnessGoal];

  return (
    <View style={styles.options}>
      {GOAL_CHOICES.map((item) => (
        <OptionCard
          key={item.id}
          icon={item.icon}
          title={GOAL_LABELS[item.goal].title}
          description={GOAL_LABELS[item.goal].description}
          selected={choices.has(item.id)}
          multi={item.id !== 'bulk'}
          onPress={() => toggle(item.id)}
        />
      ))}
      <View style={styles.hintRow}>
        <Ionicons name="flag-outline" size={16} color={theme.colors.primary} />
        <AppText variant="subhead" color="textSecondary" style={styles.flex}>
          Tu plan: <AppText variant="subhead" style={styles.bold}>{plan.title}</AppText> · {plan.short}
          {draft.fitnessGoal === 'maintenance' ? '. Pierdes grasa y ganas músculo a la vez, con proteína alta.' : ''}
        </AppText>
      </View>
    </View>
  );
}

export function ActivitySection({ draft, update }: { draft: ProfileDraft; update: Update }) {
  return (
    <View style={styles.options}>
      {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
        <OptionCard
          key={level}
          title={ACTIVITY_LABELS[level].title}
          description={ACTIVITY_LABELS[level].description}
          selected={draft.activityLevel === level}
          onPress={() => update('activityLevel', level)}
        />
      ))}
    </View>
  );
}

const GYM_TYPES: { id: GymType; title: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'large_gym', title: 'Gimnasio completo', description: 'Máquinas, poleas, barras y mancuernas', icon: 'business-outline' },
  { id: 'basic_gym', title: 'Gimnasio básico', description: 'Equipamiento esencial y pocas máquinas', icon: 'storefront-outline' },
  { id: 'garage_gym', title: 'Gimnasio en casa', description: 'Rack, barra, banco y mancuernas', icon: 'home-outline' },
  { id: 'home', title: 'En casa con poco material', description: 'Peso corporal y lo que tengas a mano', icon: 'bed-outline' },
];

const GARAGE_PRESET: HomeEquipment[] = ['body_weight', 'barbell_plates', 'adjustable_bench', 'dumbbells', 'pullup_bar'];

export function GymTypeSection({ draft, merge }: { draft: ProfileDraft; merge: Merge }) {
  const select = (gymType: GymType) => {
    if (gymType === 'large_gym' || gymType === 'basic_gym') merge({ gymType, trainingLocation: 'gym' });
    else if (gymType === 'garage_gym') {
      merge({ gymType, trainingLocation: 'home', homeEquipment: [...new Set([...draft.homeEquipment, ...GARAGE_PRESET])] });
    } else merge({ gymType, trainingLocation: 'home' });
  };
  return (
    <View style={styles.options}>
      {GYM_TYPES.map((item) => (
        <OptionCard
          key={item.id}
          icon={item.icon}
          title={item.title}
          description={item.description}
          selected={draft.gymType === item.id}
          onPress={() => select(item.id)}
        />
      ))}
    </View>
  );
}

const EXPERIENCE_OPTIONS: { id: ExperienceLevel; title: string; description: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'beginner', title: 'Principiante', description: 'Menos de 1 año entrenando', icon: 'leaf-outline' },
  { id: 'intermediate', title: 'Intermedio', description: 'Entre 1 y 3 años', icon: 'trending-up' },
  { id: 'advanced', title: 'Avanzado', description: 'Más de 3 años de entrenamiento serio', icon: 'flash-outline' },
];

export function ExperienceSection({ draft, update }: { draft: ProfileDraft; update: Update }) {
  return (
    <View style={styles.options}>
      {EXPERIENCE_OPTIONS.map((item) => (
        <OptionCard
          key={item.id}
          icon={item.icon}
          title={item.title}
          description={item.description}
          selected={draft.experience === item.id}
          onPress={() => update('experience', item.id)}
        />
      ))}
    </View>
  );
}

export function EquipmentSection({ draft, update }: { draft: ProfileDraft; update: Update }) {
  const toggle = (id: HomeEquipment) => {
    FeedbackService.selection();
    update(
      'homeEquipment',
      draft.homeEquipment.includes(id) ? draft.homeEquipment.filter((item) => item !== id) : [...draft.homeEquipment, id]
    );
  };
  return (
    <View style={styles.equipmentGrid}>
      {HOME_EQUIPMENT_OPTIONS.map((item) => {
        const selected = item.id === 'body_weight' || draft.homeEquipment.includes(item.id);
        const locked = item.id === 'body_weight';
        return (
          <Pressable
            key={item.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected, disabled: locked }}
            disabled={locked}
            onPress={() => toggle(item.id)}
            style={({ pressed }) => [styles.equipment, selected && styles.equipmentOn, pressed && styles.optionPressed]}
          >
            <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={selected ? theme.colors.primary : theme.colors.textMuted} />
            <AppText
              variant="subhead"
              style={[styles.equipmentLabel, { color: selected ? theme.colors.text : theme.colors.textSecondary }]}
              numberOfLines={2}
            >
              {item.label}
            </AppText>
            {selected && <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Recommended weekly frequency by experience (lets every muscle get 2 sessions/week). */
export const RECOMMENDED_DAYS: Record<ExperienceLevel, number> = { beginner: 3, intermediate: 4, advanced: 5 };

const SPLIT_HINTS: Record<number, string> = {
  1: 'Cuerpo completo',
  2: 'Cuerpo completo ×2',
  3: 'Cuerpo completo o Push/Pull/Legs',
  4: 'Torso / Pierna ×2',
  5: 'Torso / Pierna + Push/Pull/Legs',
  6: 'Push/Pull/Legs ×2',
};

export function FrequencySection({ draft, update }: { draft: ProfileDraft; update: Update }) {
  const recommended = RECOMMENDED_DAYS[draft.experience];
  return (
    <View style={styles.section}>
      <View style={styles.dayGrid}>
        {[1, 2, 3, 4, 5, 6].map((days) => {
          const selected = draft.daysPerWeek === days;
          return (
            <Pressable
              key={days}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${days} días por semana${days === recommended ? ', recomendado' : ''}`}
              onPress={() => {
                FeedbackService.selection();
                update('daysPerWeek', days);
              }}
              style={({ pressed }) => [styles.dayTile, selected && styles.optionSelected, pressed && !selected && styles.optionPressed]}
            >
              <AppText variant="title" style={{ color: selected ? theme.colors.primary : theme.colors.text }}>
                {days}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {days === 1 ? 'día' : 'días'}
              </AppText>
              {days === recommended && <View style={styles.recommendedDot} />}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hintRow}>
        <Ionicons name="git-branch-outline" size={16} color={theme.colors.primary} />
        <AppText variant="subhead" color="textSecondary" style={styles.flex}>
          Tu split: <AppText variant="subhead" style={styles.bold}>{SPLIT_HINTS[draft.daysPerWeek]}</AppText>
          {draft.daysPerWeek === recommended ? ' · recomendado para tu nivel' : ''}
        </AppText>
      </View>
    </View>
  );
}

const DURATIONS = [30, 45, 60, 75, 90];

export function DurationSection({ draft, update }: { draft: ProfileDraft; update: Update }) {
  return (
    <View style={styles.options}>
      {DURATIONS.map((minutes) => (
        <OptionCard
          key={minutes}
          icon="time-outline"
          title={minutes < 60 ? `${minutes} min` : minutes === 60 ? '1 hora' : `1 h ${minutes - 60} min`}
          description={
            minutes <= 30
              ? 'Rápido y efectivo, 3 ejercicios'
              : minutes <= 45
                ? '4–5 ejercicios'
                : minutes <= 60
                  ? '5–6 ejercicios · recomendado'
                  : '6–7 ejercicios, más volumen'
          }
          selected={draft.sessionMinutes === minutes}
          onPress={() => update('sessionMinutes', minutes)}
        />
      ))}
    </View>
  );
}

const FOCUS_OPTIONS: { id: PriorityMuscle | 'balanced'; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'balanced', label: 'Equilibrado', icon: 'body-outline' },
  { id: 'chest', label: 'Pecho', icon: 'shirt-outline' },
  { id: 'back', label: 'Espalda', icon: 'git-merge-outline' },
  { id: 'legs', label: 'Piernas', icon: 'walk-outline' },
  { id: 'glutes', label: 'Glúteos', icon: 'accessibility-outline' },
  { id: 'shoulders', label: 'Hombros', icon: 'barbell-outline' },
  { id: 'arms', label: 'Brazos', icon: 'fitness-outline' },
  { id: 'core', label: 'Core (abdomen)', icon: 'ellipse-outline' },
];

/** More than this and "priority" stops meaning anything. */
const MAX_PRIORITIES = 3;

export function FocusMuscleSection({ draft, update }: { draft: ProfileDraft; update: Update }) {
  const selected = draft.focusMuscles;
  const full = selected.length >= MAX_PRIORITIES;

  const toggle = (id: PriorityMuscle | 'balanced') => {
    if (id === 'balanced') update('focusMuscles', []);
    else if (selected.includes(id)) update('focusMuscles', selected.filter((muscle) => muscle !== id));
    else if (!full) update('focusMuscles', [...selected, id]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.equipmentGrid}>
        {FOCUS_OPTIONS.map((item) => {
          const on = item.id === 'balanced' ? selected.length === 0 : selected.includes(item.id);
          const disabled = !on && item.id !== 'balanced' && full;
          return (
            <Pressable
              key={item.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on, disabled }}
              disabled={disabled}
              onPress={() => {
                FeedbackService.selection();
                toggle(item.id);
              }}
              style={({ pressed }) => [
                styles.equipment,
                on && styles.equipmentOn,
                disabled && styles.disabled,
                pressed && styles.optionPressed,
              ]}
            >
              <Ionicons name={item.icon} size={18} color={on ? theme.colors.primary : theme.colors.textMuted} />
              <AppText
                variant="subhead"
                style={[styles.equipmentLabel, { color: on ? theme.colors.text : theme.colors.textSecondary }]}
                numberOfLines={1}
              >
                {item.label}
              </AppText>
              {on && <Ionicons name="checkmark-circle" size={16} color={theme.colors.primary} />}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
        <AppText variant="subhead" color="textSecondary" style={styles.flex}>
          {selected.length === 0
            ? `Puedes elegir hasta ${MAX_PRIORITIES} grupos.`
            : `${selected.length} de ${MAX_PRIORITIES} elegidos. Cada uno suma ejercicios extra los días que lo entrenas.`}
        </AppText>
      </View>
    </View>
  );
}

const CONDITION_ICONS: Record<DietaryCondition, keyof typeof Ionicons.glyphMap> = {
  celiac: 'leaf-outline',
  lactose_intolerance: 'water-outline',
  diabetes: 'pulse-outline',
  hypertension: 'heart-outline',
  high_cholesterol: 'fish-outline',
};

/** Optional health conditions the coach's meal plans must respect. */
export function DietaryConditionsSection({ draft, update }: { draft: ProfileDraft; update: Update }) {
  const selected = draft.dietaryConditions;
  const toggle = (id: DietaryCondition) =>
    update('dietaryConditions', selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);

  return (
    <View style={styles.section}>
      <View style={styles.options}>
        <OptionCard
          multi
          icon="checkmark-done-outline"
          title="Ninguna"
          description="Sin restricciones en tus menús"
          selected={selected.length === 0}
          onPress={() => update('dietaryConditions', [])}
        />
        {DIETARY_CONDITIONS.map((id) => (
          <OptionCard
            key={id}
            multi
            icon={CONDITION_ICONS[id]}
            title={DIETARY_CONDITION_LABELS[id].title}
            description={DIETARY_CONDITION_LABELS[id].description}
            selected={selected.includes(id)}
            onPress={() => toggle(id)}
          />
        ))}
      </View>
      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={16} color={theme.colors.primary} />
        <AppText variant="subhead" color="textSecondary" style={styles.flex}>
          Adaptamos los menús del coach. Son recomendaciones generales y no reemplazan a tu médico o nutricionista.
        </AppText>
      </View>
    </View>
  );
}

/** Compact training block for the Profile screen. */
export function TrainingSection({ draft, update, merge }: { draft: ProfileDraft; update: Update; merge: Merge }) {
  return (
    <View style={styles.section}>
      <View>
        <FieldLabel>¿Dónde entrenas?</FieldLabel>
        <GymTypeSection draft={draft} merge={merge} />
      </View>
      <View>
        <FieldLabel>Experiencia</FieldLabel>
        <SegmentedControl<ExperienceLevel>
          value={draft.experience}
          onChange={(value) => update('experience', value)}
          options={[
            { value: 'beginner', label: 'Empiezo' },
            { value: 'intermediate', label: '1–3 años' },
            { value: 'advanced', label: '+3 años' },
          ]}
        />
      </View>
      {draft.trainingLocation !== 'gym' && (
        <View>
          <FieldLabel>Equipo en casa</FieldLabel>
          <EquipmentSection draft={draft} update={update} />
        </View>
      )}
    </View>
  );
}

export function LivePreview({ preview }: { preview: NutritionMetrics | null }) {
  if (!preview) return null;
  return (
    <View style={styles.preview}>
      <View style={styles.previewTop}>
        <AppText variant="caption" color="textMuted">
          Tu meta diaria
        </AppText>
        <AppText variant="title" color="primary" style={styles.tabular}>
          {preview.targetCalories.toLocaleString('es-ES')} kcal
        </AppText>
      </View>
      <MacroSummary plan={preview} compact />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.lg,
  },
  fieldLabel: {
    marginBottom: theme.spacing.sm,
  },
  help: {
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  rowHalf: {
    width: '50%',
  },
  numberField: {
    flex: 1,
    gap: 4,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 50,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
  },
  inputError: {
    borderColor: theme.colors.danger,
  },
  input: {
    flex: 1,
    minWidth: 0,
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 0,
  },
  options: {
    gap: theme.spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  optionSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primarySoft,
  },
  optionPressed: {
    backgroundColor: theme.colors.surfaceAlt,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconSelected: {
    backgroundColor: theme.colors.primary,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: theme.colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    borderColor: theme.colors.primary,
  },
  checkbox: {
    borderRadius: 6,
  },
  checkboxOn: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  disabled: {
    opacity: 0.4,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.primary,
  },
  dayGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  dayTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  recommendedDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.success,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  equipment: {
    flexGrow: 1,
    flexBasis: '40%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    minHeight: 52,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  equipmentOn: {
    borderColor: theme.colors.primaryBorder,
    backgroundColor: theme.colors.primarySoft,
  },
  equipmentLabel: {
    flex: 1,
    fontWeight: '600',
  },
  preview: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
  },
  previewTop: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  bold: {
    fontWeight: '700',
  },
  flex: {
    flex: 1,
  },
});
