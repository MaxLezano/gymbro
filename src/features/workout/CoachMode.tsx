import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../../core/theme';
import { useNow } from '../../core/hooks/useNow';
import type { WorkoutSession } from '../../core/types';
import { getExercise } from '../../data/catalog';
import { findLastPerformance, formatDuration, loadStep, suggestLoad } from '../../core/utils/workout';
import { appActions, getAppState, selectHistory, selectRestTimer, useAppStore } from '../../state/appStore';
import { CoachVoice, spokenDuration, spokenKg } from '../../core/services/voice/coachVoice';
import { CoachSettingsStore } from '../../core/services/voice/coachSettings';
import type { VoiceCommand } from '../../core/services/voice/commands';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button } from '../../components/ui';
import { ExerciseThumb } from '../exercises/ExerciseThumb';
import { useVoiceCommands, type ListeningState } from './useVoiceCommands';
import { CoachSettingsSheet } from './CoachSettingsSheet';
import { warmupExerciseIndex, warmupFor } from '../../core/utils/warmup';
import { BAR_KG, formatPlates, platesFor, usesPlates } from '../../core/utils/plates';

interface Position {
  exerciseIndex: number;
  setIndex: number;
}

/** First set not yet completed, in routine order. */
function nextPosition(session: WorkoutSession | null): Position | null {
  if (!session) return null;
  for (let exerciseIndex = 0; exerciseIndex < session.exercises.length; exerciseIndex++) {
    const setIndex = session.exercises[exerciseIndex].sets.findIndex((set) => !set.completed);
    if (setIndex >= 0) return { exerciseIndex, setIndex };
  }
  return null;
}

const keyOf = (position: Position | null) => (position ? `${position.exerciseIndex}:${position.setIndex}` : 'done');

/**
 * Spoken description of a set. Short sentences and no "3: 10" style digits
 * next to a colon: speech engines read those as clock times.
 */
function describeSet(session: WorkoutSession, position: Position): string {
  const log = session.exercises[position.exerciseIndex];
  const set = log.sets[position.setIndex];
  const load = set.weightKg > 0 ? `${spokenKg(set.weightKg)} kilos, ${set.reps} repeticiones` : `${set.reps} repeticiones`;
  return `${log.exerciseName}. Serie ${position.setIndex + 1} de ${log.sets.length}. ${load}.`;
}

// ---------------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------------

function ValueTile({
  label,
  value,
  unit,
  valueLabel,
  plusLabel,
  minusDisabled,
  onMinus,
  onPlus,
}: {
  label: string;
  value: string;
  unit?: string;
  /** Spoken value when the visible one is an abbreviation ("PC"). */
  valueLabel?: string;
  plusLabel?: string;
  minusDisabled?: boolean;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <View style={styles.tile}>
      <AppText variant="overline" color="textMuted">
        {label}
      </AppText>
      <View style={styles.tileValue} accessible={!!valueLabel} accessibilityLabel={valueLabel}>
        <AppText style={styles.tileNumber}>{value}</AppText>
        {unit ? (
          <AppText variant="subhead" color="textMuted" style={styles.tileUnit}>
            {unit}
          </AppText>
        ) : null}
      </View>
      <View style={styles.tileButtons}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Menos ${label.toLowerCase()}`}
          accessibilityState={{ disabled: !!minusDisabled }}
          disabled={minusDisabled}
          onPress={onMinus}
          style={({ pressed }) => [styles.tileButton, pressed && styles.pressed]}
        >
          <Ionicons name="remove" size={22} color={minusDisabled ? theme.colors.textDisabled : theme.colors.text} />
        </Pressable>
        <View style={styles.tileDivider} />
        <Pressable accessibilityRole="button" accessibilityLabel={plusLabel ?? `Más ${label.toLowerCase()}`} onPress={onPlus} style={({ pressed }) => [styles.tileButton, pressed && styles.pressed]}>
          <Ionicons name="add" size={22} color={theme.colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

function SetDots({ total, done }: { total: number; done: number }) {
  return (
    <View style={styles.dots}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[styles.dot, i < done && styles.dotDone, i === done && styles.dotCurrent]} />
      ))}
    </View>
  );
}

function SetStopwatch({ startedAt }: { startedAt: number }) {
  const now = useNow(500);
  return (
    <View style={styles.livePill} accessibilityLabel="Serie en curso">
      <View style={styles.liveDot} />
      <AppText variant="subhead" color="primary" style={styles.bold}>
        En serie
      </AppText>
      <AppText variant="headline" style={styles.liveTime}>
        {formatDuration((now - startedAt) / 1000)}
      </AppText>
    </View>
  );
}

const RING = 232;
const STROKE = 12;

/** Rest countdown with a progress ring. Calls `onEnd` once at zero and warns at 10 s. */
function RestPanel({ endsAt, totalSeconds, onEnd }: { endsAt: number; totalSeconds: number; onEnd: () => void }) {
  const now = useNow(250);
  const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const warned = useRef(false);
  const ended = useRef(false);

  useEffect(() => {
    if (remaining === 10 && !warned.current && totalSeconds > 20) {
      warned.current = true;
      CoachVoice.say('Diez segundos.');
    }
    if (remaining === 0 && !ended.current) {
      ended.current = true;
      onEnd();
    }
  }, [remaining, totalSeconds, onEnd]);

  const radius = (RING - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalSeconds ? Math.min(1, remaining / totalSeconds) : 0;

  return (
    <View style={styles.restPanel} accessibilityLiveRegion="polite">
      <View style={styles.ring}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={radius} stroke={theme.colors.surfaceAlt} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={radius}
            stroke={theme.colors.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <AppText variant="overline" color="primary">
            Descanso
          </AppText>
          <AppText style={styles.restClock}>{formatDuration(remaining)}</AppText>
          <AppText variant="caption" color="textMuted">
            de {formatDuration(totalSeconds)}
          </AppText>
        </View>
      </View>
      <View style={styles.restActions}>
        <Button label="−15 s" variant="secondary" size="md" onPress={() => appActions.adjustRest(-15)} style={styles.restButton} />
        <Button label="+15 s" variant="secondary" size="md" onPress={() => appActions.adjustRest(15)} style={styles.restButton} />
      </View>
    </View>
  );
}

function UpNext({ session, position }: { session: WorkoutSession; position: Position }) {
  const log = session.exercises[position.exerciseIndex];
  const set = log.sets[position.setIndex];
  const exercise = getExercise(log.exerciseId);
  return (
    <View style={styles.upNext}>
      <ExerciseThumb uri={exercise?.thumbnailUrl} size={56} />
      <View style={styles.flex}>
        <AppText variant="caption" color="textMuted">
          A continuación · Serie {position.setIndex + 1} de {log.sets.length}
        </AppText>
        <AppText variant="callout" style={styles.bold} numberOfLines={1}>
          {log.exerciseName}
        </AppText>
      </View>
      <View style={styles.upNextLoad}>
        <AppText variant="headline">{set.weightKg > 0 ? `${set.weightKg} kg` : 'PC'}</AppText>
        <AppText variant="caption" color="textMuted">
          × {set.reps}
        </AppText>
      </View>
    </View>
  );
}

function ToolbarButton({ icon, active, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; active?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!active }}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [styles.toolButton, active && styles.toolButtonActive, pressed && styles.pressed]}
    >
      <Ionicons name={icon} size={20} color={active ? theme.colors.onPrimary : theme.colors.textSecondary} />
    </Pressable>
  );
}

const LISTENING_HINT: Partial<Record<ListeningState, string>> = {
  listening: 'Escuchando: di «terminé», «hice 8 con 20» o «siguiente»',
  denied: 'Sin permiso de micrófono. Actívalo en los ajustes del teléfono.',
  unavailable: 'Este teléfono no tiene reconocimiento de voz.',
};

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Guided workout: one set at a time, a stopwatch while you lift, a rest
 * countdown, spoken prompts and hands-free voice commands.
 */
export function CoachMode({ session, onFinish }: { session: WorkoutSession; onFinish: () => void }) {
  const rest = useAppStore(selectRestTimer);
  const history = useAppStore(selectHistory);
  const [working, setWorking] = useState<{ key: string; startedAt: number } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [speakOn, setSpeakOn] = useState(CoachSettingsStore.get().speak);

  useEffect(() => {
    CoachVoice.warmUp();
    CoachSettingsStore.load().then(() => setSpeakOn(CoachSettingsStore.get().speak));
  }, []);

  const position = nextPosition(session);
  const isWorking = working?.key === keyOf(position);
  const resting = !!rest;

  const startSet = useCallback(() => {
    const current = nextPosition(getAppState().activeWorkout);
    if (!current) return;
    FeedbackService.mediumTap();
    setWorking({ key: keyOf(current), startedAt: Date.now() });
  }, []);

  const endRest = useCallback(() => {
    appActions.clearRest();
    const current = getAppState().activeWorkout;
    const next = nextPosition(current);
    if (!current || !next) return;
    FeedbackService.success();
    if (CoachSettingsStore.get().autoStart) {
      CoachVoice.say(`Vamos. ${describeSet(current, next)}`);
      setWorking({ key: keyOf(next), startedAt: Date.now() });
    } else {
      CoachVoice.say(`Tu turno. ${describeSet(current, next)}`);
    }
  }, []);

  const completeSet = useCallback((values: { reps?: number; weightKg?: number } = {}) => {
    const current = getAppState().activeWorkout;
    const at = nextPosition(current);
    if (!current || !at) return;
    const set = current.exercises[at.exerciseIndex].sets[at.setIndex];
    const reps = values.reps ?? set.reps;
    if (reps <= 0) {
      FeedbackService.warning();
      return;
    }
    appActions.updateSet(at.exerciseIndex, at.setIndex, { completed: true, reps, ...(values.weightKg !== undefined ? { weightKg: values.weightKg } : {}) });
    FeedbackService.success();
    setWorking(null);

    const after = getAppState().activeWorkout;
    const next = nextPosition(after);
    if (!after || !next) {
      appActions.clearRest();
      CoachVoice.say('Entreno completo. Buen trabajo.');
      return;
    }
    const restSeconds = current.exercises[at.exerciseIndex].restSeconds ?? 90;
    appActions.startRest(restSeconds, after.exercises[next.exerciseIndex].exerciseName);
    CoachVoice.say(`Registrado. Descansa ${spokenDuration(restSeconds)}.`);
  }, []);

  const handleCommand = useCallback(
    (command: VoiceCommand) => {
      const current = getAppState().activeWorkout;
      const isResting = !!getAppState().restTimer;
      switch (command.type) {
        case 'done':
          if (isResting) endRest();
          else completeSet(command);
          break;
        case 'start':
        case 'skip':
          if (isResting) endRest();
          else startSet();
          break;
        case 'moreRest':
          if (isResting) {
            appActions.adjustRest(command.seconds);
            CoachVoice.say(`${command.seconds} segundos más.`);
          }
          break;
        case 'repeat': {
          const next = nextPosition(current);
          if (current && next) CoachVoice.say(describeSet(current, next));
          break;
        }
      }
    },
    [completeSet, endRest, startSet]
  );

  const voice = useVoiceCommands(handleCommand);
  const listening = voice.state === 'listening';

  const toggleSpeak = () => {
    const speak = !speakOn;
    CoachSettingsStore.update({ speak });
    if (!speak) CoachVoice.stop();
    setSpeakOn(speak);
  };

  if (!position) {
    return (
      <View style={styles.center}>
        <Ionicons name="trophy" size={56} color={theme.colors.primary} />
        <AppText variant="title" align="center">
          ¡Completaste todas las series!
        </AppText>
        <AppText color="textSecondary" align="center">
          Guarda el entreno para sumar a tu progreso y tus récords.
        </AppText>
        <Button label="Terminar y guardar" icon="checkmark" size="lg" fullWidth onPress={onFinish} />
      </View>
    );
  }

  const log = session.exercises[position.exerciseIndex];
  const set = log.sets[position.setIndex];
  const exercise = getExercise(log.exerciseId);
  const step = loadStep(exercise?.equipment);
  const last = findLastPerformance(log.exerciseId, history);
  const suggestion = position.setIndex === 0 && !resting ? suggestLoad({ equipment: exercise?.equipment, targetReps: log.targetReps, last }) : null;
  const showSuggestion = suggestion?.weightKg != null && suggestion.weightKg !== set.weightKg;
  const doneInExercise = log.sets.filter((item) => item.completed).length;
  // Before the first working set of the session's first heavy lift: the warm-up ramp (never logged).
  const warmup =
    doneInExercise === 0 && position.setIndex === 0 && !isWorking && warmupExerciseIndex(session.exercises) === position.exerciseIndex ? warmupFor(log) : [];
  const barbell = usesPlates(exercise?.equipment);
  const plates = barbell ? platesFor(set.weightKg) : null;
  const barOnly = barbell && set.weightKg === BAR_KG;
  const hint = LISTENING_HINT[voice.state];
  const update = (patch: { weightKg?: number; reps?: number }) => appActions.updateSet(position.exerciseIndex, position.setIndex, patch);

  return (
    <View style={styles.flex}>
      <View style={styles.toolbar}>
        <View style={styles.flex}>
          <AppText variant="caption" color="textMuted">
            Ejercicio {position.exerciseIndex + 1} de {session.exercises.length}
          </AppText>
          <SetDots total={log.sets.length} done={doneInExercise} />
        </View>
        <ToolbarButton icon={listening ? 'mic' : 'mic-off-outline'} active={listening} label={listening ? 'Apagar micrófono' : 'Activar micrófono'} onPress={() => (listening ? voice.stop() : voice.start())} />
        <ToolbarButton icon={speakOn ? 'volume-high' : 'volume-mute'} active={speakOn} label={speakOn ? 'Silenciar al coach' : 'Activar la voz del coach'} onPress={toggleSpeak} />
        <ToolbarButton icon="options-outline" label="Ajustes del coach" onPress={() => setSettingsOpen(true)} />
      </View>
      {hint && (
        <View style={styles.hint}>
          {listening && <View style={styles.liveDot} />}
          <AppText variant="caption" color={listening ? 'textSecondary' : 'textMuted'} style={styles.flexShrink}>
            {hint}
          </AppText>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {resting && rest ? (
          <>
            <RestPanel key={rest.endsAt - rest.totalSeconds * 1000} endsAt={rest.endsAt} totalSeconds={rest.totalSeconds} onEnd={endRest} />
            <UpNext session={session} position={position} />
          </>
        ) : (
          <>
            {exercise?.gifUrl ? (
              <View style={styles.media}>
                <Image source={{ uri: exercise.gifUrl }} style={styles.gif} contentFit="contain" autoplay cachePolicy="disk" accessibilityLabel={`Técnica de ${log.exerciseName}`} />
              </View>
            ) : null}
            <View style={styles.titleBlock}>
              <AppText variant="title" align="center" numberOfLines={2}>
                {log.exerciseName}
              </AppText>
              <AppText variant="subhead" color="textSecondary" align="center">
                Serie {position.setIndex + 1} de {log.sets.length}
                {log.targetReps ? ` · Objetivo ${log.targetReps} reps` : ''}
              </AppText>
            </View>


            {isWorking && working && <SetStopwatch startedAt={working.startedAt} />}

            <View style={styles.tiles}>
              {exercise?.equipment !== 'body weight' || set.weightKg > 0 ? (
                <ValueTile label="Peso" value={`${set.weightKg}`} unit="kg" onMinus={() => update({ weightKg: Math.max(0, set.weightKg - step) })} onPlus={() => update({ weightKg: set.weightKg + step })} />
              ) : (
                // Bodyweight: "PC" instead of a meaningless 0 kg; + adds load (lastre), − back to 0 returns here.
                <ValueTile label="Peso" value="PC" valueLabel="Peso corporal" plusLabel="Añadir lastre" minusDisabled onMinus={() => undefined} onPlus={() => update({ weightKg: step })} />
              )}
              <ValueTile label="Repeticiones" value={`${set.reps}`} onMinus={() => update({ reps: Math.max(1, set.reps - 1) })} onPlus={() => update({ reps: set.reps + 1 })} />
            </View>
            {barOnly && (
              <View style={styles.plates}>
                <Ionicons name="disc-outline" size={16} color={theme.colors.textMuted} />
                <AppText variant="subhead" color="textSecondary">
                  Solo la barra (20 kg), sin discos
                </AppText>
              </View>
            )}
            {plates && (
              <View style={styles.plates} accessible accessibilityLabel={`Discos por lado: ${formatPlates(plates.perSide)}`}>
                <Ionicons name="disc-outline" size={16} color={theme.colors.textMuted} />
                <AppText variant="subhead" color="textSecondary" style={styles.flexShrink}>
                  Por lado: <AppText variant="subhead" style={styles.platesBold}>{formatPlates(plates.perSide)}</AppText>
                  {plates.leftover > 0 ? ` · sin discos para ${plates.leftover.toLocaleString('es-ES')} kg` : ''}
                </AppText>
              </View>
            )}
            {/* Below the weight controls: appearing above them would move the buttons under the finger. */}
            {warmup.length > 0 && (
              <View style={styles.warmup} accessible accessibilityLabel={`Calentamiento antes de la primera serie: ${warmup.map((item) => `${item.weightKg} kilos por ${item.reps}`).join(', ')}`}>
                <View style={styles.warmupTitle}>
                  <Ionicons name="flame-outline" size={16} color={theme.colors.primary} />
                  <AppText variant="callout" style={styles.platesBold}>
                    Calentamiento antes de la 1.ª serie
                  </AppText>
                </View>
                <AppText variant="subhead" color="textSecondary">
                  {warmup.map((item) => `${item.weightKg.toLocaleString('es-ES')} kg × ${item.reps}`).join('  ·  ')}
                </AppText>
                <AppText variant="caption" color="textMuted">
                  Series livianas para entrar en calor: no se registran.
                </AppText>
              </View>
            )}

            {showSuggestion && suggestion && (
              <Pressable accessibilityRole="button" onPress={() => update({ weightKg: suggestion.weightKg ?? set.weightKg })} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
                <Ionicons name="bulb-outline" size={18} color={theme.colors.primary} />
                <View style={styles.flex}>
                  <AppText variant="callout" style={styles.bold}>
                    Usar {suggestion.weightKg} kg
                  </AppText>
                  <AppText variant="caption" color="textSecondary">
                    {suggestion.reason}
                  </AppText>
                </View>
              </Pressable>
            )}
          </>
        )}
      </ScrollView>

      <View style={styles.footer}>
        {resting ? (
          <Button label="Saltar descanso" icon="play-skip-forward" size="lg" fullWidth onPress={endRest} />
        ) : isWorking ? (
          <Button label="Terminé la serie" icon="checkmark" size="lg" fullWidth onPress={() => completeSet()} />
        ) : (
          <Button label="Empezar serie" icon="play" size="lg" fullWidth onPress={startSet} />
        )}
      </View>

      <CoachSettingsSheet
        visible={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          setSpeakOn(CoachSettingsStore.get().speak);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  plates: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  platesBold: {
    fontWeight: '700',
    color: theme.colors.text,
  },
  warmupTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  warmup: {
    gap: 4,
    alignSelf: 'stretch',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
  flex: {
    flex: 1,
  },
  flexShrink: {
    flexShrink: 1,
  },
  bold: {
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  toolButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  toolButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  dot: {
    width: 18,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.colors.surfaceAlt,
  },
  dotDone: {
    backgroundColor: theme.colors.success,
  },
  dotCurrent: {
    backgroundColor: theme.colors.primary,
  },
  scroll: {
    flexGrow: 1,
    padding: theme.spacing.lg,
    gap: theme.spacing.lg,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
  },
  media: {
    height: 180,
    borderRadius: theme.radius.lg,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  gif: {
    width: '100%',
    height: '100%',
  },
  titleBlock: {
    gap: 4,
  },
  livePill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.primary,
  },
  liveTime: {
    fontVariant: ['tabular-nums'],
    minWidth: 48,
  },
  tiles: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingTop: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  tileValue: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    paddingVertical: theme.spacing.sm,
  },
  tileNumber: {
    fontSize: 44,
    lineHeight: 52,
    fontWeight: '800',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  tileUnit: {
    marginLeft: 4,
    fontWeight: '600',
  },
  tileButtons: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    borderTopColor: theme.colors.border,
  },
  tileButton: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDivider: {
    width: StyleSheet.hairlineWidth * 2,
    backgroundColor: theme.colors.border,
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primarySoft,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
  },
  restPanel: {
    alignItems: 'center',
    gap: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  ring: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCenter: {
    position: 'absolute',
    alignItems: 'center',
  },
  restClock: {
    fontSize: 60,
    lineHeight: 70,
    fontWeight: '800',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
  restActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  restButton: {
    minWidth: 110,
  },
  upNext: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
  },
  upNextLoad: {
    alignItems: 'flex-end',
  },
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
});
