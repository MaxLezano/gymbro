import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import type { WorkoutSession } from '../../core/types';
import { countCompletedSets, formatMinutes, formatVolume } from '../../core/utils/workout';
import { AppText, Button, Card, StatTile } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';

export interface NewRecord {
  exerciseName: string;
  oneRepMax: number;
  previous: number | null;
}

export function WorkoutSummary({
  session,
  records,
  onDone,
  onClose,
}: {
  session: WorkoutSession;
  records: NewRecord[];
  onDone: () => void;
  onClose: () => void;
}) {
  return (
    <StackScreen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.trophy}>
            <Ionicons name="trophy" size={36} color={theme.colors.primary} />
          </View>
          <AppText variant="largeTitle" align="center">
            ¡Buen trabajo!
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            {session.title} guardado en tu historial.
          </AppText>
        </View>

        <View style={styles.stats}>
          <StatTile label="Duración" value={formatMinutes(session.durationSeconds)} icon="time-outline" />
          <StatTile label="Volumen" value={formatVolume(session.totalVolumeKg)} icon="barbell-outline" />
        </View>
        <View style={styles.stats}>
          <StatTile label="Ejercicios" value={session.exercises.length} icon="list-outline" />
          <StatTile label="Series" value={countCompletedSets(session.exercises)} icon="checkmark-done-outline" />
        </View>

        <Card padding={0}>
          {session.exercises.map((log, index) => (
            <View key={`${log.exerciseId}_${index}`} style={[styles.exerciseRow, index > 0 && styles.rowBorder]}>
              <AppText variant="callout" style={[styles.flex, styles.bold]} numberOfLines={1}>
                {log.exerciseName}
              </AppText>
              <AppText variant="subhead" color="textSecondary" style={styles.tabular}>
                {log.sets.length} × {Math.max(...log.sets.map((set) => set.weightKg))} kg
              </AppText>
            </View>
          ))}
        </Card>

        {records.length > 0 && (
          <Card tone="accent" style={styles.records}>
            <View style={styles.recordsHeader}>
              <Ionicons name="flash" size={18} color={theme.colors.primary} />
              <AppText variant="headline">Nuevas marcas personales</AppText>
            </View>
            {records.map((record) => (
              <View key={record.exerciseName} style={styles.recordRow}>
                <AppText variant="callout" numberOfLines={1} style={styles.flex}>
                  {record.exerciseName}
                </AppText>
                <AppText variant="callout" color="primary" style={styles.bold}>
                  {record.oneRepMax} kg
                </AppText>
                {record.previous !== null && (
                  <AppText variant="caption" color="success">
                    +{Math.round((record.oneRepMax - record.previous) * 10) / 10}
                  </AppText>
                )}
              </View>
            ))}
            <AppText variant="caption" color="textSecondary">
              1RM estimado con Brzycki/Epley a partir de tu mejor serie.
            </AppText>
          </Card>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Button label="Ver mi progreso" size="lg" fullWidth icon="stats-chart" onPress={onDone} />
        <Button label="Volver al inicio" variant="ghost" size="md" fullWidth onPress={onClose} />
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  hero: {
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xxl,
  },
  trophy: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  records: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  recordsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '800',
  },
  footer: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xs,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  rowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
});
