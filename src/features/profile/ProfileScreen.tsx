import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { appActions, getAppState, selectAccount, selectCustomRoutines, selectProfile, useAppStore } from '../../state/appStore';
import { Avatar } from '../../components/layout/HeaderActions';
import { isGoogleSignInAvailable, signInWithGoogle, signOutFromGoogle } from '../../core/services/googleAuth';
import { isCloudAvailable } from '../../core/services/cloud/supabaseClient';
import { programRoutines } from '../../core/utils/program';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button, Card, ListRow, ModalHeader } from '../../components/ui';
import { StackScreen } from '../../components/layout/TabScreen';
import { profileFromDraft, useProfileDraft } from './profileDraft';
import { CloudBackupSection } from './CloudBackupSection';
import { ActivitySection, BasicsSection, GoalSection, LivePreview, MeasurementsSection, TrainingSection } from './ProfileSections';

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

export function ProfileScreen() {
  const profile = useAppStore(selectProfile);
  const { draft, update, merge, errors, preview, isValid } = useProfileDraft(profile);
  const program = programRoutines(useAppStore(selectCustomRoutines));
  const [linking, setLinking] = useState(false);
  const account = useAppStore(selectAccount);

  const linkGoogle = async () => {
    setLinking(true);
    const result = await signInWithGoogle();
    setLinking(false);
    if (result.status === 'success') {
      FeedbackService.success();
      merge({ name: draft.name.trim() || result.identity.name, email: result.identity.email, photoUrl: result.identity.photoUrl });
    } else if (result.status === 'error') Alert.alert('Google', result.message);
  };

  const unlinkGoogle = () => {
    Alert.alert('Desvincular Google', 'Se quitará tu foto y correo. Tus datos de entrenamiento no cambian.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desvincular',
        style: 'destructive',
        onPress: () => {
          signOutFromGoogle();
          merge({ email: undefined, photoUrl: undefined });
        },
      },
    ]);
  };

  const save = () => {
    if (!isValid) {
      FeedbackService.warning();
      Alert.alert('Revisa los datos', 'Hay valores fuera de rango marcados en rojo.');
      return;
    }
    FeedbackService.success();
    appActions.saveProfile(profileFromDraft(profile, draft));
    router.back();
  };

  const signOut = () => {
    const leave = async () => {
      if (account?.kind === 'google') await signOutFromGoogle();
      await appActions.signOut();
      router.dismissAll();
      router.replace('/login');
    };
    const hasWorkout = !!getAppState().activeWorkout;
    Alert.alert(
      'Cerrar sesión',
      hasWorkout
        ? 'Tienes un entrenamiento en curso: quedará guardado y lo retomarás al volver a entrar.'
        : 'Tus datos quedan guardados en este teléfono para cuando vuelvas a entrar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Cerrar sesión', onPress: leave },
      ]
    );
  };

  const confirmDelete = () => {
    if (!account) return;
    FeedbackService.warning();
    Alert.alert(
      'Eliminar perfil de este teléfono',
      account.cloudUserId
        ? 'Se borrarán de este teléfono tu perfil, rutinas, historial y chat del coach. La copia en la nube se conserva: entra con Google para recuperarla.'
        : 'Se borrarán tu perfil, rutinas, historial y chat del coach. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            if (account.kind === 'google') await signOutFromGoogle();
            await appActions.deleteAccount(account.id);
            router.dismissAll();
            router.replace('/login');
          },
        },
      ]
    );
  };

  return (
    <StackScreen>
      <ModalHeader title="Perfil" onClose={() => router.back()} right={<Button label="Guardar" size="sm" onPress={save} disabled={!isValid} />} />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.accountCard}>
            <Avatar size={52} />
            <View style={styles.flex}>
              <AppText variant="headline" numberOfLines={1}>
                {draft.name.trim() || 'Sin nombre'}
              </AppText>
              <AppText variant="caption" color="textMuted" numberOfLines={1}>
                {account?.kind === 'google' ? `Google · ${account.email}` : draft.email ? `Perfil local · ${draft.email}` : 'Perfil en este teléfono'}
              </AppText>
            </View>
          </View>

          <LivePreview preview={preview} />
          <Section title="Datos básicos">
            <BasicsSection draft={draft} update={update} errors={errors} />
          </Section>
          <Section title="Objetivo">
            <GoalSection draft={draft} update={update} />
          </Section>
          <Section title="Actividad diaria">
            <ActivitySection draft={draft} update={update} />
          </Section>
          <Section title="Entrenamiento">
            <TrainingSection draft={draft} update={update} merge={merge} />
          </Section>
          <Section title="Medidas corporales">
            <MeasurementsSection draft={draft} update={update} errors={errors} />
          </Section>

          <Section title="Tu programa">
            <Card padding={0}>
              <ListRow
                icon="calendar-outline"
                title={program.length ? `Programa de ${program.length} ${program.length === 1 ? 'día' : 'días'}` : 'Aún no tienes programa'}
                subtitle={program.length ? 'Cambia días, duración o foco y regenéralo' : 'Crea un plan semanal según tu objetivo'}
                onPress={() => router.push('/program')}
              />
            </Card>
          </Section>

          {isCloudAvailable && (
            <Section title="Respaldo en la nube">
              <CloudBackupSection />
            </Section>
          )}

          <Section title="Cuenta">
            <Card padding={0}>
              {account?.kind === 'local' && isGoogleSignInAvailable && !isCloudAvailable && !draft.email && (
                <ListRow
                  icon="logo-google"
                  title={linking ? 'Conectando…' : 'Vincular con Google'}
                  subtitle="Usa tu nombre y foto de Google"
                  onPress={linking ? undefined : linkGoogle}
                />
              )}
              {account?.kind === 'local' && !!draft.email && (
                <ListRow icon="logo-google" title={draft.email} subtitle="Vinculada · toca para desvincular" onPress={unlinkGoogle} />
              )}
              <ListRow icon="log-out-outline" title="Cerrar sesión" subtitle="Cambia de cuenta o entra con otra" onPress={signOut} />
              <ListRow icon="trash-outline" title="Eliminar perfil de este teléfono" subtitle="Borra todos sus datos" destructive onPress={confirmDelete} />
            </Card>
          </Section>

          <AppText variant="caption" color="textMuted" align="center">
            {account?.cloudUserId
              ? 'Tus datos se guardan en este teléfono y se respaldan en la nube con tu cuenta de Google.'
              : 'Cada cuenta guarda sus datos por separado, solo en este teléfono.'}
          </AppText>
        </ScrollView>
      </KeyboardAvoidingView>
    </StackScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  scroll: {
    padding: theme.spacing.lg,
    gap: theme.spacing.xxl,
    paddingBottom: theme.spacing.xxxl * 2,
  },
  accountCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.md,
  },
});
