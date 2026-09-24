import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import type { Routine, UserProfile } from '../../core/types';
import { LEVEL_LABELS } from '../../core/i18n/labels';
import { routineCompatibility } from '../../core/utils/equipment';
import { getExercise } from '../../data/catalog';
import { coverForRoutine } from '../../data/covers';
import { AppText, Badge, Card, CoverImage, IconButton } from '../../components/ui';

interface RoutineCardProps {
  routine: Routine;
  profile: Pick<UserProfile, 'trainingLocation' | 'homeEquipment'>;
  onStart: (routine: Routine) => void;
  /** Highlights the program day that comes next. */
  highlight?: string;
}

export const RoutineCard = React.memo(function RoutineCard({ routine, profile, onStart, highlight }: RoutineCardProps) {
  const compatibility = routineCompatibility(routine, profile);
  const names = routine.exercises
    .slice(0, 3)
    .map((item) => getExercise(item.exerciseId)?.displayName ?? item.exerciseName)
    .filter(Boolean)
    .join(' · ');
  const extra = routine.exercises.length - 3;

  return (
    <Card
      padding={0}
      onPress={() => router.push({ pathname: '/routine/[id]', params: { id: routine.id } })}
      accessibilityLabel={`Rutina ${routine.title}`}
      style={highlight ? styles.highlighted : undefined}
    >
      <CoverImage source={coverForRoutine(routine)} height={132}>
        <View style={styles.coverRow}>
          <View style={styles.flex}>
            {highlight && (
              <AppText variant="overline" color="primary" style={styles.highlightLabel}>
                {highlight}
              </AppText>
            )}
            <AppText variant="headline" numberOfLines={2} style={styles.onImage}>
              {routine.title}
            </AppText>
            <AppText variant="caption" style={styles.onImageMuted}>
              {routine.exercises.length} ejercicios · ~{routine.estimatedMinutes} min · {LEVEL_LABELS[routine.level]}
            </AppText>
          </View>
          <IconButton
            icon="play"
            variant="primary"
            size={44}
            iconSize={20}
            accessibilityLabel={`Empezar ${routine.title}`}
            onPress={() => onStart(routine)}
          />
        </View>
      </CoverImage>

      <View style={styles.body}>
        <AppText variant="subhead" color="textSecondary" numberOfLines={1}>
          {names}
          {extra > 0 ? ` · +${extra}` : ''}
        </AppText>
        {(routine.isCustom || profile.trainingLocation === 'home') && (
          <View style={styles.badges}>
            {routine.isCustom && !routine.programId && <Badge label="Mi rutina" tone="accent" icon="person-outline" />}
            {routine.programId && <Badge label="Mi programa" tone="accent" icon="calendar-outline" />}
            {profile.trainingLocation === 'home' &&
              (compatibility.isFullyAvailable ? (
                <Badge label="Compatible con tu equipo" tone="success" icon="checkmark" />
              ) : (
                <Badge label={`${compatibility.available} de ${compatibility.total} con tu equipo`} icon="alert-circle-outline" />
              ))}
          </View>
        )}
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  highlighted: {
    borderColor: theme.colors.primaryBorder,
  },
  coverRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.md,
  },
  flex: {
    flex: 1,
  },
  highlightLabel: {
    marginBottom: 2,
  },
  onImage: {
    color: '#FFFFFF',
  },
  onImageMuted: {
    color: 'rgba(255,255,255,0.78)',
  },
  body: {
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
