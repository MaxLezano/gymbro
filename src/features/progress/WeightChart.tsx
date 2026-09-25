import React, { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { theme } from '../../core/theme';
import type { WeightEntry } from '../../core/utils/weightLog';
import { AppText } from '../../components/ui';

const HEIGHT = 120;
const PAD = 8;
/** Keeps the line readable: the last ~6 months of weigh-ins. */
const MAX_POINTS = 26;

const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const kgLabel = (kg: number) => `${kg.toLocaleString('es-ES', { maximumFractionDigits: 1 })} kg`;

/**
 * Body weight over time: one series, so no legend (the card title names it). 2px line,
 * recessive grid, the latest point labeled; tapping a point shows its date and weight.
 */
export function WeightChart({ entries }: { entries: readonly WeightEntry[] }) {
  const [width, setWidth] = useState(0);
  const points = entries.slice(-MAX_POINTS);
  const [selected, setSelected] = useState<number | null>(null);

  const values = points.map((entry) => entry.kg);
  // At least a 2 kg window: day-to-day noise must not look like a cliff.
  const mid = (Math.max(...values) + Math.min(...values)) / 2;
  const span = Math.max(2, Math.max(...values) - Math.min(...values));
  const low = mid - span / 2;
  const x = (index: number) => PAD + (points.length === 1 ? (width - PAD * 2) / 2 : (index / (points.length - 1)) * (width - PAD * 2));
  const y = (kg: number) => PAD + (1 - (kg - low) / span) * (HEIGHT - PAD * 2);

  const shown = selected ?? points.length - 1;
  const focus = points[shown];

  return (
    <View
      accessible
      accessibilityLabel={`Peso corporal. ${points.map((entry) => `${shortDate(entry.date)}: ${kgLabel(entry.kg)}`).join('. ')}`}
    >
      <View style={styles.readout}>
        <AppText variant="caption" color="textSecondary">
          {shortDate(focus.date)}
        </AppText>
        <AppText variant="callout" style={styles.bold}>
          {kgLabel(focus.kg)}
        </AppText>
      </View>
      <View style={{ height: HEIGHT }} onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <Svg width={width} height={HEIGHT}>
            {[0.25, 0.75].map((ratio) => (
              <Line key={ratio} x1={0} x2={width} y1={HEIGHT * ratio} y2={HEIGHT * ratio} stroke={theme.colors.border} strokeWidth={1} />
            ))}
            <Polyline
              points={points.map((entry, index) => `${x(index)},${y(entry.kg)}`).join(' ')}
              fill="none"
              stroke={theme.colors.primary}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {points.map((entry, index) => (
              <Circle
                key={entry.date}
                cx={x(index)}
                cy={y(entry.kg)}
                r={index === shown ? 5 : 3.5}
                fill={index === shown ? theme.colors.primary : theme.colors.surface}
                stroke={theme.colors.primary}
                strokeWidth={2}
              />
            ))}
          </Svg>
        )}
        {/* Hit targets wider than the dots: the whole column around each weigh-in. */}
        <View style={StyleSheet.absoluteFill}>
          {width > 0 &&
            points.map((entry, index) => {
              const column = (width - PAD * 2) / Math.max(1, points.length - 1);
              return (
                <Pressable
                  key={entry.date}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortDate(entry.date)}: ${kgLabel(entry.kg)}`}
                  onPress={() => setSelected(index === selected ? null : index)}
                  style={[styles.hit, { left: x(index) - Math.max(12, column / 2), width: Math.max(24, column) }]}
                />
              );
            })}
        </View>
      </View>
      <View style={styles.axis}>
        <AppText variant="caption" color="textMuted">
          {shortDate(points[0].date)}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {shortDate(points[points.length - 1].date)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  bold: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  hit: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
});
