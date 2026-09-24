import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';
import { AppText } from './AppText';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: SegmentedControlProps<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              if (active) return;
              FeedbackService.selection();
              onChange(option.value);
            }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <AppText
              variant="subhead"
              numberOfLines={1}
              style={[styles.label, { color: active ? theme.colors.text : theme.colors.textMuted }]}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.border,
    padding: 3,
  },
  segment: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.sm,
    paddingHorizontal: 6,
  },
  segmentActive: {
    backgroundColor: theme.colors.surfacePressed,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: theme.colors.borderStrong,
  },
  label: {
    fontWeight: '600',
  },
});
