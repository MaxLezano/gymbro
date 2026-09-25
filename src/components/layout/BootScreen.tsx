import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { theme } from '../../core/theme';

const LOGO = require('../../../assets/splash-icon.png');

interface BootScreenProps {
  /** 0..1 */
  progress: number;
}

/**
 * Continues the native splash (same background and logo size) with a progress bar while
 * the app preloads what its screens need, so no tab stalls the first time it opens.
 */
export function BootScreen({ progress }: BootScreenProps) {
  const [fill] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fill, { toValue: progress, duration: 250, useNativeDriver: false }).start();
  }, [fill, progress]);

  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}>
      <Image source={LOGO} style={styles.logo} contentFit="contain" />
      <View style={styles.track}>
        <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
  },
  logo: {
    width: 140,
    height: 140,
  },
  track: {
    // Narrower than the logo and hairline-thin: a hint of progress, not a feature.
    position: 'absolute',
    bottom: '12%',
    width: 96,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
  fill: {
    height: '100%',
    borderRadius: 1.5,
    backgroundColor: theme.colors.primary,
  },
});
