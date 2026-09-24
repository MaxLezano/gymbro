import React from 'react';
import { ImageSourcePropType, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../core/theme';

interface CoverImageProps {
  source: ImageSourcePropType;
  height: number;
  radius?: number;
  /** How far up the dark scrim reaches (0-1). Text sits on the scrim, keeping contrast >= 4.5:1. */
  scrim?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function CoverImage({ source, height, radius = 0, scrim = 0.75, style, children }: CoverImageProps) {
  return (
    <View style={[styles.container, { height, borderRadius: radius }, style]}>
      <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessibilityIgnoresInvertColors />
      <LinearGradient
        colors={['transparent', 'rgba(10,10,11,0.55)', 'rgba(10,10,11,0.95)']}
        locations={[1 - scrim, 1 - scrim / 2, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceAlt,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: theme.spacing.lg,
  },
});
