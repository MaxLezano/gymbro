import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../core/theme';

/** Root container for tab screens: background + top safe area. */
export function TabScreen({ style, children, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View {...rest} style={[styles.container, { paddingTop: insets.top }, style]}>
      {children}
    </View>
  );
}

/** Root container for stacked/modal screens: full safe area. */
export function StackScreen({ style, children, ...rest }: ViewProps) {
  const insets = useSafeAreaInsets();
  return (
    <View {...rest} style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
