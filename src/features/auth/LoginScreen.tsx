import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import type { Account } from '../../storage';
import { appActions, selectAccounts, useAppStore } from '../../state/appStore';
import { isGoogleSignInAvailable } from '../../core/services/googleAuth';
import { isCloudAvailable } from '../../core/services/cloud/supabaseClient';
import { FeedbackService } from '../../core/services/feedback';
import { AppText, Button } from '../../components/ui';
import { WelcomeHero } from './WelcomeHero';
import { signInWithGoogleAndCloud } from './googleCloud';

const MAX_VISIBLE_ACCOUNTS = 3;

function AccountAvatar({ account, size = 40 }: { account: Account; size?: number }) {
  const initials = account.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {account.photoUrl ? (
        <Image source={{ uri: account.photoUrl }} style={{ width: size, height: size }} contentFit="cover" />
      ) : initials ? (
        <AppText variant="subhead" color="primary" style={styles.bold}>
          {initials}
        </AppText>
      ) : (
        <Ionicons name="person" size={size * 0.45} color={theme.colors.primary} />
      )}
    </View>
  );
}

/** Routes to the right place once an account's data is loaded. */
function enter(onboarded: boolean) {
  router.replace(onboarded ? '/' : '/onboarding');
}

export function LoginScreen() {
  const accounts = useAppStore(selectAccounts);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? accounts : accounts.slice(0, MAX_VISIBLE_ACCOUNTS);

  const continueAs = async (account: Account) => {
    // Backed-up accounts need a fresh cloud session (it is closed on sign-out).
    if (account.cloudUserId && isCloudAvailable) {
      await withGoogle();
      return;
    }
    FeedbackService.mediumTap();
    setBusy(account.id);
    const profile = await appActions.signIn(account);
    setBusy(null);
    enter(profile.hasCompletedOnboarding);
  };

  const withGoogle = async () => {
    setBusy('google');
    const result = await signInWithGoogleAndCloud();
    if (result.status !== 'success') {
      setBusy(null);
      if (result.status === 'error') Alert.alert('Google', result.message);
      return;
    }
    const { identity } = result;
    const id = `google_${identity.email.toLowerCase()}`;
    // A local profile that turned its backup on keeps its own id; reuse it.
    const existing = accounts.find((item) => item.id === id) ?? accounts.find((item) => item.cloudUserId && item.email === identity.email);
    const profile = await appActions.signIn({
      id: existing?.id ?? id,
      kind: 'google',
      name: identity.name,
      email: identity.email,
      photoUrl: identity.photoUrl,
      // Offline right now: keep the link, the profile offers to reconnect.
      cloudUserId: result.cloudUserId ?? existing?.cloudUserId,
    });
    setBusy(null);
    FeedbackService.success();
    enter(profile.hasCompletedOnboarding);
  };

  const createLocal = async () => {
    FeedbackService.mediumTap();
    setBusy('new');
    await appActions.signIn({ id: `local_${Date.now().toString(36)}`, kind: 'local', name: '' });
    setBusy(null);
    router.replace('/onboarding');
  };

  const confirmRemove = (account: Account) => {
    FeedbackService.warning();
    Alert.alert(
      `Quitar ${account.name || 'este perfil'}`,
      'Se borrarán de este teléfono su perfil, rutinas e historial. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Quitar', style: 'destructive', onPress: () => appActions.deleteAccount(account.id) },
      ]
    );
  };

  return (
    <WelcomeHero>
      {visible.length > 0 && (
        <View style={styles.accounts}>
          <AppText variant="overline" color="textMuted">
            Continuar como
          </AppText>
          {visible.map((account) => (
            <Pressable
              key={account.id}
              accessibilityRole="button"
              accessibilityLabel={`Continuar como ${account.name || 'perfil sin nombre'}`}
              accessibilityHint="Mantén presionado para quitarlo de este teléfono"
              disabled={busy !== null}
              onPress={() => continueAs(account)}
              onLongPress={() => confirmRemove(account)}
              style={({ pressed }) => [styles.accountRow, pressed && styles.accountPressed]}
            >
              <AccountAvatar account={account} />
              <View style={styles.flex}>
                <AppText variant="callout" style={styles.bold} numberOfLines={1}>
                  {account.name || 'Perfil sin nombre'}
                </AppText>
                <AppText variant="caption" color="textMuted" numberOfLines={1}>
                  {account.kind === 'google' ? account.email : 'Perfil en este teléfono'}
                </AppText>
              </View>
              {busy === account.id ? (
                <AppText variant="caption" color="primary">
                  Entrando…
                </AppText>
              ) : (
                <Ionicons name="chevron-forward" size={18} color={theme.colors.textMuted} />
              )}
            </Pressable>
          ))}
          {accounts.length > MAX_VISIBLE_ACCOUNTS && (
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setShowAll((value) => !value)}>
              <AppText variant="caption" color="primary" style={styles.bold} align="center">
                {showAll ? 'Ver menos' : `Ver ${accounts.length - MAX_VISIBLE_ACCOUNTS} más`}
              </AppText>
            </Pressable>
          )}
        </View>
      )}

      {isGoogleSignInAvailable && (
        <Button
          label="Continuar con Google"
          icon="logo-google"
          variant={accounts.length ? 'secondary' : 'primary'}
          size="lg"
          fullWidth
          loading={busy === 'google'}
          disabled={busy !== null && busy !== 'google'}
          onPress={withGoogle}
        />
      )}
      <Button
        label={accounts.length ? 'Crear perfil nuevo' : 'Empezar'}
        icon={accounts.length ? 'person-add-outline' : undefined}
        iconRight={accounts.length ? undefined : 'arrow-forward'}
        variant={accounts.length || isGoogleSignInAvailable ? 'secondary' : 'primary'}
        size="lg"
        fullWidth
        loading={busy === 'new'}
        disabled={busy !== null && busy !== 'new'}
        onPress={createLocal}
      />
      <View style={styles.privacyRow}>
        <Ionicons name="lock-closed-outline" size={13} color={theme.colors.textMuted} />
        <AppText variant="caption" color="textMuted">
          {isCloudAvailable ? 'Gratis. Con Google, tus datos se respaldan en la nube.' : 'Gratis. Tus datos se quedan en tu teléfono.'}
        </AppText>
      </View>
    </WelcomeHero>
  );
}

const styles = StyleSheet.create({
  accounts: {
    gap: theme.spacing.sm,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    minHeight: 60,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(28,28,31,0.92)',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
  },
  accountPressed: {
    backgroundColor: theme.colors.surfacePressed,
  },
  avatar: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
});
