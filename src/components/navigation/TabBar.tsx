import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { theme } from '../../core/theme';
import { FeedbackService } from '../../core/services/feedback';
import { AppText } from '../ui';
import { WorkoutMiniBar } from './WorkoutMiniBar';

type IconName = keyof typeof Ionicons.glyphMap;

const ICONS: Record<string, { active: IconName; idle: IconName }> = {
  index: { active: 'home', idle: 'home-outline' },
  train: { active: 'barbell', idle: 'barbell-outline' },
  exercises: { active: 'grid', idle: 'grid-outline' },
  progress: { active: 'stats-chart', idle: 'stats-chart-outline' },
  nutrition: { active: 'nutrition', idle: 'nutrition-outline' },
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.wrapper}>
      <WorkoutMiniBar />
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const focused = state.index === index;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const icons = ICONS[route.name] ?? { active: 'ellipse', idle: 'ellipse-outline' };
          const color = focused ? theme.colors.primary : theme.colors.textMuted;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) {
              FeedbackService.selection();
              navigation.navigate(route.name, route.params);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={onPress}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={styles.item}
            >
              {/* collapsable=false: stops Fabric from flattening the idle pill, which dropped its radius once activated. */}
              <View collapsable={false} style={[styles.iconPill, focused && styles.iconPillActive]}>
                <Ionicons name={focused ? icons.active : icons.idle} size={22} color={color} />
              </View>
              <AppText
                variant="caption"
                numberOfLines={1}
                style={[styles.label, { color, fontWeight: focused ? '700' : '500' }]}
              >
                {label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: theme.colors.background,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.borderStrong,
    paddingTop: 6,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 52,
  },
  iconPill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: theme.colors.primarySoft,
  },
  label: {
    fontSize: 11,
  },
});
