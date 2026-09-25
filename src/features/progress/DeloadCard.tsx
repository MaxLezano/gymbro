import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import type { DeloadSuggestion } from '../../core/utils/deload';
import { FeedbackService } from '../../core/services/feedback';
import { appActions } from '../../state/appStore';
import { AppText, Button, Card } from '../../components/ui';

/** Shown when regular training stopped moving the main lifts. */
export function DeloadCard({ suggestion }: { suggestion: DeloadSuggestion }) {
  const names = suggestion.stalledLifts.slice(0, 3);
  const lifts = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}` : names[0];
  return (
    <Card>
      <View style={styles.title}>
        <Ionicons name="battery-charging-outline" size={18} color={theme.colors.primary} />
        <AppText variant="headline">Semana de descarga sugerida</AppText>
      </View>
      <AppText variant="subhead" color="textSecondary">
        Hace 3 semanas que no mejoras en {lifts}. Una semana suave te deja recuperar y volver más fuerte:
      </AppText>
      <View style={styles.steps}>
        <AppText variant="subhead">• Mismos ejercicios y días</AppText>
        <AppText variant="subhead">• La mitad de las series</AppText>
        <AppText variant="subhead">• 10 % menos de peso, sin llegar al fallo</AppText>
      </View>
      <Button
        label="Entendido"
        icon="checkmark"
        variant="secondary"
        size="sm"
        onPress={() => {
          FeedbackService.selection();
          appActions.patchProfile({ deloadSnoozedAt: Date.now() });
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  steps: {
    gap: 2,
    marginVertical: theme.spacing.md,
  },
});
