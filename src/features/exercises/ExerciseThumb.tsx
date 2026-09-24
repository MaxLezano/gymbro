import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';

interface ExerciseThumbProps {
  uri: string | null | undefined;
  size?: number;
  radius?: number;
}

/**
 * Dataset thumbnails are white-background JPGs; a light tile keeps them from
 * looking like glaring holes in the dark UI and keeps the edges clean.
 */
export const ExerciseThumb = React.memo(function ExerciseThumb({ uri, size = 56, radius = theme.radius.sm }: ExerciseThumbProps) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.image}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <Ionicons name="barbell-outline" size={size * 0.42} color={theme.colors.textMuted} />
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  tile: {
    backgroundColor: '#EDEDED',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
