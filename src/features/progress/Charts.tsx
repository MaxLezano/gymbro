import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../../core/theme';
import { AppText } from '../../components/ui';

export interface BarDatum {
  label: string;
  value: number;
  highlight?: boolean;
}

/**
 * Minimal column chart built with Views (no native chart dependency).
 * One series, one color; the current period is highlighted, the rest muted.
 */
export function BarChart({
  data,
  height = 140,
  formatValue,
}: {
  data: BarDatum[];
  height?: number;
  formatValue: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const highlighted = data.find((item) => item.highlight);

  return (
    <View
      accessible
      accessibilityLabel={`Gráfico. ${data.map((item) => `${item.label}: ${formatValue(item.value)}`).join('. ')}`}
    >
      <View style={[styles.plot, { height }]}>
        {[0.5, 1].map((ratio) => (
          <View key={ratio} style={[styles.gridLine, { bottom: height * ratio }]} />
        ))}
        {data.map((item, index) => {
          const barHeight = item.value > 0 ? Math.max(4, (item.value / max) * height) : 2;
          return (
            <View key={`${item.label}_${index}`} style={styles.column}>
              <View
                style={[
                  styles.bar,
                  {
                    height: barHeight,
                    backgroundColor: item.highlight
                      ? theme.colors.primary
                      : item.value > 0
                        ? 'rgba(255, 159, 10, 0.38)'
                        : theme.colors.surfacePressed,
                  },
                ]}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {data.map((item, index) => (
          <AppText
            key={`${item.label}_${index}`}
            variant="caption"
            color={item.highlight ? 'text' : 'textMuted'}
            style={styles.label}
            numberOfLines={1}
          >
            {item.label}
          </AppText>
        ))}
      </View>
      {highlighted && (
        <AppText variant="caption" color="textSecondary" style={styles.caption}>
          Esta semana: {formatValue(highlighted.value)} · Máximo: {formatValue(max)}
        </AppText>
      )}
    </View>
  );
}

/** Tiny trend line for a list row, drawn as dots on a fixed baseline. */
export function Sparkline({ values, width = 72, height = 28 }: { values: number[]; width?: number; height?: number }) {
  // A single point is not a trend.
  if (values.length < 2) return null;
  const points = values.slice(-8);
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(1, max - min);
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  return (
    <View style={{ width, height }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {points.map((value, index) => {
        const isLast = index === points.length - 1;
        const size = isLast ? 8 : 5;
        return (
          <View
            key={index}
            style={{
              position: 'absolute',
              left: (points.length > 1 ? index * step : width / 2) - size / 2,
              bottom: ((value - min) / range) * (height - size),
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: isLast ? theme.colors.primary : 'rgba(255, 159, 10, 0.45)',
            }}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  plot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: theme.colors.borderStrong,
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '72%',
    maxWidth: 28,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  labels: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  label: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
  },
  caption: {
    marginTop: theme.spacing.md,
  },
});
