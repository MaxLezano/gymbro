import React from 'react';
import { Pressable, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';
import { selectProfile, useAppStore } from '../../state/appStore';
import { AppText, IconButton } from '../ui';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { TourTarget } from '../../features/tour/TourTarget';

export function Avatar({ size = 38, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
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
        style,
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

/** Coach + profile shortcuts shown at the top-right of every tab. `tour`: the copy the tutorial points at. */
export function HeaderActions({ tour = false }: { tour?: boolean }) {
  const coach = (
    <IconButton
      icon="chatbubble-ellipses"
      variant="tonal"
      size={38}
      iconSize={18}
      accessibilityLabel="Abrir Coach IA"
      onPress={() => router.push('/coach')}
    />
  );
  if (!tour) {
    return (
      <>
        {coach}
        <Avatar />
      </>
    );
  }
  return (
    <>
      <TourTarget id="header.coach">{coach}</TourTarget>
      <TourTarget id="header.profile" style={styles.tourAvatar}>
        <Avatar style={styles.noMargin} />
      </TourTarget>
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
  // The margin moves to the tour target so its spotlight stays centered on the avatar.
  tourAvatar: {
    marginLeft: 6,
  },
  noMargin: {
    marginLeft: 0,
  },
  initials: {
    fontWeight: '800',
  },
});
