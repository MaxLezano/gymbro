import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../core/theme';
import { AppText } from '../../components/ui';

/** Protein per meal, centered so it fills the same height as the water tile beside it. */
export function ProteinPerMealTile({ grams, meals }: { grams: number; meals: number }) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${grams} gramos de proteína por comida, ${meals} comidas al día`}>
      <View style={styles.labelRow}>
        <Ionicons name="restaurant-outline" size={14} color={theme.colors.primary} />
        <AppText variant="caption" color="textMuted">
          Proteína por comida
        </AppText>
      </View>
      <View style={styles.center}>
        <View style={styles.valueRow}>
          <AppText style={styles.value}>{grams}</AppText>
          <AppText variant="headline" color="textMuted">
            g
          </AppText>
        </View>
        <AppText variant="caption" color="textSecondary">
          en {meals} comidas al día
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  value: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '800',
    color: theme.colors.text,
    fontVariant: ['tabular-nums'],
  },
});
