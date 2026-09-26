import React, { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import {
  DEFAULT_WATER,
  DEFAULT_WEIGH_IN,
  defaultTrainingDays,
  Reminders,
  waterHours,
  type ReminderResult,
} from '../../core/services/reminders';
import { FeedbackService } from '../../core/services/feedback';
import { appActions, selectProfile, useAppStore } from '../../state/appStore';
import { AppText, Card, Chip, ModalHeader } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';

/** Monday first, as a Spanish week reads; values are expo weekdays (1 = Sunday). */
const WEEK = [
  { day: 2, label: 'L', name: 'lunes' },
  { day: 3, label: 'M', name: 'martes' },
  { day: 4, label: 'X', name: 'miércoles' },
  { day: 5, label: 'J', name: 'jueves' },
  { day: 6, label: 'V', name: 'viernes' },
  { day: 7, label: 'S', name: 'sábado' },
  { day: 1, label: 'D', name: 'domingo' },
];
const dayName = (day: number) => WEEK.find((item) => item.day === day)?.name ?? '';
const clock = (hour: number, minute = 0) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/** Explains a failed schedule instead of silently flipping the switch back. */
function explain(result: ReminderResult): boolean {
  if (result === 'ok') return true;
  FeedbackService.warning();
  if (result === 'denied') {
    Alert.alert('Notificaciones bloqueadas', 'GymBro no tiene permiso para avisarte. Actívalo en los ajustes del teléfono y vuelve a intentarlo.', [
      { text: 'Ahora no', style: 'cancel' },
      { text: 'Abrir ajustes', onPress: () => Linking.openSettings().catch(() => undefined) },
    ]);
  } else {
    Alert.alert('No se pudo programar', 'El teléfono rechazó el aviso. Prueba de nuevo en unos segundos.');
  }
  return false;
}

export function RemindersScreen() {
  const profile = useAppStore(selectProfile);

  const training = profile.trainingReminder;
  // Switches answer the tap immediately; they only go back if scheduling fails (with an explanation).
  const [trainingOn, setTrainingOn] = useState(() => !!training && training.days.length > 0);
  const defaultDays = defaultTrainingDays(profile.daysPerWeek ?? 3);
  // Older builds saved "off" as an empty day list: that must not make "on" impossible.
  const [trainingDraft, setTrainingDraft] = useState(() =>
    training?.days.length ? training : { days: defaultDays, hour: training?.hour ?? 19, minute: training?.minute ?? 0 }
  );

  const [weighOn, setWeighOn] = useState(() => !!profile.weighInReminder);
  const [weighDraft, setWeighDraft] = useState(() => profile.weighInSchedule ?? DEFAULT_WEIGH_IN);

  const [waterOn, setWaterOn] = useState(() => !!profile.waterReminder);
  const [waterDraft, setWaterDraft] = useState(() => profile.waterReminder ?? DEFAULT_WATER);

  const saveTraining = async (requested: typeof trainingDraft, on: boolean, fromToggle = false) => {
    // Turning the switch on with no day picked starts from the program's days.
    const next = fromToggle && on && requested.days.length === 0 ? { ...requested, days: defaultDays } : requested;
    setTrainingDraft(next);
    const active = on && next.days.length > 0;
    setTrainingOn(active);
    if (explain(await Reminders.setTraining(active ? next : null))) appActions.patchProfile({ trainingReminder: active ? next : undefined });
    // A failed schedule leaves nothing pending (replace() cancels first): off is the truth.
    else setTrainingOn(false);
  };
  const saveWeigh = async (next: typeof weighDraft, on: boolean) => {
    setWeighDraft(next);
    setWeighOn(on);
    if (explain(await Reminders.setWeighIn(on ? next : null))) appActions.patchProfile({ weighInReminder: on, weighInSchedule: next });
    else setWeighOn(false);
  };
  const saveWater = async (next: typeof waterDraft, on: boolean) => {
    setWaterDraft(next);
    setWaterOn(on);
    if (explain(await Reminders.setWater(on ? next : null))) appActions.patchProfile({ waterReminder: on ? next : undefined });
    else setWaterOn(false);
  };

  const waterCount = waterHours(waterDraft).length;

  return (
    <StackScreen>
      <ModalHeader title="Notificaciones" onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <AppText variant="body" color="textSecondary">
          Todas son opcionales y se generan en tu teléfono: funcionan sin internet.
        </AppText>

        <Section
          icon="barbell-outline"
          title="Entrenar"
          summary={trainingOn ? `${trainingDraft.days.length} ${trainingDraft.days.length === 1 ? 'día' : 'días'} a las ${clock(trainingDraft.hour, trainingDraft.minute)}` : 'Un aviso los días que eliges'}
          value={trainingOn}
          onToggle={(on) => saveTraining(trainingDraft, on, true)}
        >
          <Label text="Días" />
          <View style={styles.days}>
            {WEEK.map((item) => (
              <DayButton
                key={item.day}
                label={item.label}
                name={item.name}
                on={trainingDraft.days.includes(item.day)}
                onPress={() =>
                  saveTraining(
                    {
                      ...trainingDraft,
                      days: trainingDraft.days.includes(item.day) ? trainingDraft.days.filter((day) => day !== item.day) : [...trainingDraft.days, item.day],
                    },
                    true
                  )
                }
              />
            ))}
          </View>
          <Label text="Hora" />
          <TimeStepper hour={trainingDraft.hour} minute={trainingDraft.minute} onChange={(hour, minute) => saveTraining({ ...trainingDraft, hour, minute }, true)} />
        </Section>

        <Section
          icon="scale-outline"
          title="Pesarte"
          summary={weighOn ? `Los ${dayName(weighDraft.day)} a las ${clock(weighDraft.hour, weighDraft.minute)}` : 'Un aviso por semana'}
          value={weighOn}
          onToggle={(on) => saveWeigh(weighDraft, on)}
        >
          <Label text="Día" />
          <View style={styles.days}>
            {WEEK.map((item) => (
              <DayButton key={item.day} label={item.label} name={item.name} on={weighDraft.day === item.day} onPress={() => saveWeigh({ ...weighDraft, day: item.day }, true)} />
            ))}
          </View>
          <Label text="Hora" />
          <TimeStepper hour={weighDraft.hour} minute={weighDraft.minute} onChange={(hour, minute) => saveWeigh({ ...weighDraft, hour, minute }, true)} />
        </Section>

        <Section
          icon="water-outline"
          title="Tomar agua"
          summary={waterOn ? `${waterCount} avisos al día, de ${clock(waterDraft.fromHour)} a ${clock(waterDraft.toHour)}` : 'Para llegar a tu meta diaria'}
          value={waterOn}
          onToggle={(on) => saveWater(waterDraft, on)}
        >
          <Label text="Cada" />
          <View style={styles.chips}>
            {[1, 2, 3].map((hours) => (
              <Chip key={hours} size="sm" label={hours === 1 ? '1 hora' : `${hours} horas`} selected={waterDraft.everyHours === hours} onPress={() => saveWater({ ...waterDraft, everyHours: hours }, true)} />
            ))}
          </View>
          <View style={styles.range}>
            <View style={styles.flex}>
              <Label text="Desde" />
              <TimeStepper hour={waterDraft.fromHour} step={60} max={waterDraft.toHour} onChange={(hour) => saveWater({ ...waterDraft, fromHour: hour }, true)} />
            </View>
            <View style={styles.flex}>
              <Label text="Hasta" />
              <TimeStepper hour={waterDraft.toHour} step={60} min={waterDraft.fromHour} onChange={(hour) => saveWater({ ...waterDraft, toHour: hour }, true)} />
            </View>
          </View>
        </Section>
      </ScrollView>
    </StackScreen>
  );
}

function Section({
  icon,
  title,
  summary,
  value,
  onToggle,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  summary: string;
  value: boolean;
  onToggle: (on: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <View style={styles.sectionHeader}>
        <View style={styles.icon}>
          <Ionicons name={icon} size={18} color={theme.colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="headline">{title}</AppText>
          <AppText variant="caption" color="textMuted">
            {summary}
          </AppText>
        </View>
        <Switch
          value={value}
          onValueChange={(on) => {
            FeedbackService.selection();
            onToggle(on);
          }}
          trackColor={{ true: theme.colors.primary, false: theme.colors.surfacePressed }}
          thumbColor={theme.colors.text}
          accessibilityLabel={`Recordatorio: ${title}`}
        />
      </View>
      {value && <View style={styles.sectionBody}>{children}</View>}
    </Card>
  );
}

function Label({ text }: { text: string }) {
  return (
    <AppText variant="overline" color="textMuted">
      {text}
    </AppText>
  );
}

function DayButton({ label, name, on, onPress }: { label: string; name: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on }}
      accessibilityLabel={name}
      onPress={() => {
        FeedbackService.selection();
        onPress();
      }}
      style={[styles.day, on && styles.dayOn]}
    >
      <AppText variant="callout" style={[styles.dayLabel, on && styles.dayLabelOn]}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Time picker without a native dialog: − / + in steps (30 min by default), wraps around midnight. */
function TimeStepper({
  hour,
  minute = 0,
  step = 30,
  min = 0,
  max = 23,
  onChange,
}: {
  hour: number;
  minute?: number;
  step?: number;
  min?: number;
  max?: number;
  onChange: (hour: number, minute: number) => void;
}) {
  const shift = (delta: number) => {
    let total = hour * 60 + minute + delta;
    if (step === 60) total = Math.min(max * 60, Math.max(min * 60, total));
    else total = (total + 24 * 60) % (24 * 60);
    FeedbackService.lightTap();
    onChange(Math.floor(total / 60), total % 60);
  };
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel="Antes" onPress={() => shift(-step)} style={styles.stepButton} hitSlop={6}>
        <Ionicons name="remove" size={18} color={theme.colors.text} />
      </Pressable>
      <AppText variant="title" style={styles.time} accessibilityLabel={`Hora ${clock(hour, minute)}`}>
        {clock(hour, minute)}
      </AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Después" onPress={() => shift(step)} style={styles.stepButton} hitSlop={6}>
        <Ionicons name="add" size={18} color={theme.colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.xxxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  sectionBody: {
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  flex: {
    flex: 1,
  },
  days: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  day: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  dayOn: {
    backgroundColor: theme.colors.primary,
  },
  dayLabel: {
    fontWeight: '700',
    color: theme.colors.textSecondary,
  },
  dayLabelOn: {
    color: theme.colors.onPrimary,
  },
  chips: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  range: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
  },
  time: {
    minWidth: 72,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
