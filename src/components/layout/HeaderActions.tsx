import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';
import { selectProfile, useAppStore } from '../../state/appStore';
import { AppText, IconButton } from '../ui';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

export function Avatar({ size = 38 }: { size?: number }) {
  const profile = useAppStore(selectProfile);
  const name = profile.name.trim();
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Abrir perfil"
      hitSlop={4}
      onPress={() => {
        FeedbackService.lightTap();
        router.push('/profile');
      }}
      style={({ pressed }) => [
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && { opacity: 0.7 },
      ]}
    >
      {profile.photoUrl ? (
        <Image source={{ uri: profile.photoUrl }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" />
      ) : initials ? (
        <AppText variant="subhead" color="primary" style={styles.initials}>
          {initials}
        </AppText>
      ) : (
        <Ionicons name="person" size={size * 0.45} color={theme.colors.primary} />
      )}
    </Pressable>
  );
}

/** Coach + profile shortcuts shown at the top-right of every tab. */
export function HeaderActions() {
  return (
    <>
      <IconButton
        icon="chatbubble-ellipses"
        variant="tonal"
        size={38}
        iconSize={18}
        accessibilityLabel="Abrir Coach IA"
        onPress={() => router.push('/coach')}
      />
      <Avatar />
    </>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: theme.colors.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.primaryBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  initials: {
    fontWeight: '800',
  },
});
