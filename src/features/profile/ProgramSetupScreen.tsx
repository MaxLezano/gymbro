import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { generateWeeklyProgram, type WeeklyProgram } from '../../core/utils/programGenerator';
import { programRoutines } from '../../core/utils/program';
import { appActions, selectCustomRoutines, selectProfile, useAppStore } from '../../state/appStore';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, ModalHeader } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';
import { profileFromDraft, useProfileDraft } from './profileDraft';
import { DurationSection, FocusMuscleSection, FrequencySection, GymTypeSection } from './ProfileSections';
import { ProgramPreview } from './ProgramPreview';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export function ProgramSetupScreen() {
  const profile = useAppStore(selectProfile);
  const hasProgram = programRoutines(useAppStore(selectCustomRoutines)).length > 0;
  const { draft, update, merge } = useProfileDraft(profile);
  const [preview, setPreview] = useState<WeeklyProgram | null>(null);

  const generate = () => {
    FeedbackService.mediumTap();
    setPreview(generateWeeklyProgram(profileFromDraft(profile, draft)));
  };

  const save = () => {
    if (!preview) return;
    const commit = () => {
      FeedbackService.success();
      appActions.saveProfile(profileFromDraft(profile, draft));
      appActions.saveProgram(preview.routines);
      router.back();
    };
    if (!hasProgram) return commit();
    Alert.alert('Reemplazar programa', 'Tu programa actual se reemplazará. Tus rutinas propias y tu historial no cambian.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Reemplazar', onPress: commit },
    ]);
  };

  return (
    <StackScreen>
      <ModalHeader title={hasProgram ? 'Rehacer programa' : 'Crear programa'} onClose={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {preview ? (
          <>
            <View style={styles.header}>
              <AppText variant="title">{preview.title}</AppText>
              <AppText variant="body" color="textSecondary">
                Sesiones de ~{draft.sessionMinutes} min. Si no te convence, cambia las opciones y vuelve a generarlo.
              </AppText>
            </View>
            <ProgramPreview routines={preview.routines} />
          </>
        ) : (
          <>
            <Section title="Días por semana">
              <FrequencySection draft={draft} update={update} />
            </Section>
            <Section title="Duración de cada sesión">
              <DurationSection draft={draft} update={update} />
            </Section>
            <Section title="Músculo a priorizar">
              <FocusMuscleSection draft={draft} update={update} />
            </Section>
            <Section title="Dónde entrenas">
              <GymTypeSection draft={draft} merge={merge} />
            </Section>
          </>
        )}
      </ScrollView>
      <View style={styles.footer}>
        {preview ? (
          <>
            <Button label="Cambiar" icon="options-outline" variant="secondary" size="lg" onPress={() => setPreview(null)} />
            <Button label="Guardar programa" icon="checkmark" size="lg" style={styles.flex} onPress={save} />
          </>
        ) : (
          <Button label="Generar programa" icon="sparkles" size="lg" fullWidth onPress={generate} />
        )}
      </View>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxxl,
  },
  header: {
    gap: theme.spacing.sm,
  },
  section: {
    gap: theme.spacing.md,
  },
  footer: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  flex: {
    flex: 1,
  },
});
